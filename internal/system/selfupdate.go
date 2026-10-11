package system

import (
	"archive/tar"
	"archive/zip"
	"compress/gzip"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"log/slog"
	"net/http"
	"os"
	"os/exec"
	"path"
	"path/filepath"
	"runtime"
	"strings"
	"time"
)

const (
	// binaryBaseName is the executable inside a release archive (plus ".exe" on Windows).
	binaryBaseName = "f1telemetry"
	// checksumsAssetName is the release's list of SHA-256 sums, one "<hex>  <file>" line per archive.
	checksumsAssetName = "checksums.txt"
	zipExt             = ".zip"
	tarGzExt           = ".tar.gz"

	// The release archives are about 10 MB and the binary about 30 MB; these caps only stop a
	// runaway download or archive.
	maxArchiveBytes   = 200 << 20
	maxChecksumsBytes = 64 << 10
	maxBinaryBytes    = 400 << 20

	// downloadTimeout is how long a whole download may take, on a slow connection too.
	downloadTimeout = 10 * time.Minute
	// versionCheckTimeout is how long the new binary may take to print its version.
	versionCheckTimeout = 30 * time.Second

	// newBinarySuffix names the extracted binary until it replaces the running one.
	newBinarySuffix = ".new"
	// replacedBinarySuffix names the running executable once Windows moved it aside for the new one.
	replacedBinarySuffix = ".old"
	executableMode       = 0o755
)

var (
	// releaseDownloadPrefix is the only place updates are downloaded from: this app's own releases.
	releaseDownloadPrefix = "https://github.com/" + DefaultGitHubRepo + "/releases/download/"

	// downloadClient fetches release files; the update check's client times out too soon for them.
	downloadClient = &http.Client{Timeout: downloadTimeout}

	// checkBinaryVersion makes sure the extracted binary runs and is the version expected.
	checkBinaryVersion = runVersionCheck
)

// InstallRelease downloads rel's archive for this platform, checks it against the release's
// checksums, makes sure the binary in it runs and is rel's version, and puts it in place of exe.
// The running app keeps running the old version until it restarts. On any error exe is left as it
// was.
func InstallRelease(ctx context.Context, rel *UpdateCheckResponse, exe string) error {
	target, err := filepath.EvalSymlinks(exe)
	if err != nil {
		return fmt.Errorf("can't find the running executable: %w", err)
	}
	archive, sums, err := releaseArchive(rel, runtime.GOOS, runtime.GOARCH)
	if err != nil {
		return err
	}

	sumsData, err := downloadBytes(ctx, sums, maxChecksumsBytes)
	if err != nil {
		return err
	}
	wantSum, err := checksumFor(sumsData, archive.Name)
	if err != nil {
		return err
	}

	dir := filepath.Dir(target)
	tmp, err := os.CreateTemp(dir, "."+binaryBaseName+"-update-*")
	if err != nil {
		return fmt.Errorf("can't write to %s: %w", dir, osReason(err))
	}
	defer func() {
		_ = tmp.Close()
		_ = os.Remove(tmp.Name())
	}()

	gotSum, err := downloadTo(ctx, archive, tmp, maxArchiveBytes)
	if err != nil {
		return err
	}
	if gotSum != wantSum {
		return fmt.Errorf("%s doesn't match its checksum: the download is damaged, try again", archive.Name)
	}

	newPath := target + newBinarySuffix
	if err := extractBinary(tmp, archive.Name, binaryName(runtime.GOOS), newPath); err != nil {
		_ = os.Remove(newPath)
		return err
	}
	if err := checkBinaryVersion(ctx, newPath, rel.LatestVersion); err != nil {
		_ = os.Remove(newPath)
		return err
	}
	if err := replaceExecutable(target, newPath, runtime.GOOS == "windows"); err != nil {
		_ = os.Remove(newPath)
		return err
	}
	slog.Info("Update installed", "version", rel.LatestVersion, "executable", target)
	return nil
}

// RemoveReplacedExecutable deletes the executable an update moved aside on Windows. It runs at
// startup; when the old process still holds the file, the next start removes it.
func RemoveReplacedExecutable(exe string) error {
	target, err := filepath.EvalSymlinks(exe)
	if err != nil {
		return err
	}
	if err := os.Remove(target + replacedBinarySuffix); err != nil && !errors.Is(err, os.ErrNotExist) {
		return err
	}
	return nil
}

// binaryName is the executable's name inside the release archive for goos.
func binaryName(goos string) string {
	if goos == "windows" {
		return binaryBaseName + ".exe"
	}
	return binaryBaseName
}

// releaseArchive picks rel's archive for goos/goarch ("f1telemetry_<tag>_<goos>_<goarch>.zip" or
// ".tar.gz", as the release workflow names them) and its checksums file.
func releaseArchive(rel *UpdateCheckResponse, goos, goarch string) (archive, sums ReleaseAssetInfo, err error) {
	base := fmt.Sprintf("%s_%s_%s_%s", binaryBaseName, rel.LatestVersion, goos, goarch)
	var foundArchive, foundSums bool
	for _, a := range rel.Assets {
		switch a.Name {
		case base + zipExt, base + tarGzExt:
			archive, foundArchive = a, true
		case checksumsAssetName:
			sums, foundSums = a, true
		}
	}
	if !foundArchive {
		return archive, sums, fmt.Errorf("release %s has no download for %s/%s", rel.LatestVersion, goos, goarch)
	}
	if !foundSums {
		return archive, sums, fmt.Errorf("release %s has no %s to check the download against", rel.LatestVersion, checksumsAssetName)
	}
	return archive, sums, nil
}

// checksumFor finds name's SHA-256 in a checksums file written by sha256sum.
func checksumFor(sums []byte, name string) (string, error) {
	for line := range strings.SplitSeq(string(sums), "\n") {
		fields := strings.Fields(line)
		if len(fields) != 2 || strings.TrimPrefix(fields[1], "*") != name {
			continue
		}
		sum := strings.ToLower(fields[0])
		if decoded, err := hex.DecodeString(sum); err != nil || len(decoded) != sha256.Size {
			return "", fmt.Errorf("%s has a malformed checksum for %s", checksumsAssetName, name)
		}
		return sum, nil
	}
	return "", fmt.Errorf("%s has no checksum for %s", checksumsAssetName, name)
}

// openDownload starts downloading asset, which must be one of this app's own release files.
func openDownload(ctx context.Context, asset ReleaseAssetInfo) (io.ReadCloser, error) {
	if !strings.HasPrefix(asset.DownloadURL, releaseDownloadPrefix) {
		return nil, fmt.Errorf("refusing to download %s from %s", asset.Name, asset.DownloadURL)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, asset.DownloadURL, http.NoBody)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("User-Agent", "F1Telemetry-Updater")
	resp, err := downloadClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("couldn't download %s: %w", asset.Name, err)
	}
	if resp.StatusCode != http.StatusOK {
		_ = resp.Body.Close()
		return nil, fmt.Errorf("couldn't download %s: GitHub answered %d", asset.Name, resp.StatusCode)
	}
	return resp.Body, nil
}

// downloadBytes downloads a small release file into memory.
func downloadBytes(ctx context.Context, asset ReleaseAssetInfo, limit int64) ([]byte, error) {
	body, err := openDownload(ctx, asset)
	if err != nil {
		return nil, err
	}
	defer body.Close()
	data, err := io.ReadAll(io.LimitReader(body, limit+1))
	if err != nil {
		return nil, fmt.Errorf("couldn't download %s: %w", asset.Name, err)
	}
	if int64(len(data)) > limit {
		return nil, fmt.Errorf("%s is larger than expected", asset.Name)
	}
	return data, nil
}

// downloadTo writes asset to w and returns its SHA-256 as hex.
func downloadTo(ctx context.Context, asset ReleaseAssetInfo, w io.Writer, limit int64) (string, error) {
	body, err := openDownload(ctx, asset)
	if err != nil {
		return "", err
	}
	defer body.Close()
	hash := sha256.New()
	n, err := io.Copy(io.MultiWriter(w, hash), io.LimitReader(body, limit+1))
	if err != nil {
		return "", fmt.Errorf("couldn't download %s: %w", asset.Name, err)
	}
	if n > limit {
		return "", fmt.Errorf("%s is larger than expected", asset.Name)
	}
	return hex.EncodeToString(hash.Sum(nil)), nil
}

// extractBinary writes the archive entry named binary (at the archive's root) to dest, executable.
func extractBinary(archive *os.File, archiveName, binary, dest string) error {
	if _, err := archive.Seek(0, io.SeekStart); err != nil {
		return err
	}
	var src io.Reader
	switch {
	case strings.HasSuffix(archiveName, zipExt):
		info, err := archive.Stat()
		if err != nil {
			return err
		}
		zr, err := zip.NewReader(archive, info.Size())
		if err != nil {
			return fmt.Errorf("%s is not a valid zip: %w", archiveName, err)
		}
		f, err := zr.Open(binary)
		if err != nil {
			return fmt.Errorf("%s has no %s", archiveName, binary)
		}
		defer f.Close()
		src = f
	case strings.HasSuffix(archiveName, tarGzExt):
		gz, err := gzip.NewReader(archive)
		if err != nil {
			return fmt.Errorf("%s is not a valid tar.gz: %w", archiveName, err)
		}
		defer gz.Close()
		if src, err = findTarEntry(tar.NewReader(gz), archiveName, binary); err != nil {
			return err
		}
	default:
		return fmt.Errorf("%s is not a zip or tar.gz", archiveName)
	}

	out, err := os.OpenFile(dest, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, executableMode)
	if err != nil {
		return fmt.Errorf("can't write to %s: %w", filepath.Dir(dest), osReason(err))
	}
	n, copyErr := io.Copy(out, io.LimitReader(src, maxBinaryBytes+1))
	closeErr := out.Close()
	switch {
	case copyErr != nil:
		return fmt.Errorf("couldn't extract %s: %w", binary, copyErr)
	case closeErr != nil:
		return fmt.Errorf("couldn't extract %s: %w", binary, closeErr)
	case n > maxBinaryBytes:
		return fmt.Errorf("%s in %s is larger than expected", binary, archiveName)
	}
	// The umask may have taken the execute bits off
	return os.Chmod(dest, executableMode)
}

// findTarEntry moves tr to the regular file named binary.
func findTarEntry(tr *tar.Reader, archiveName, binary string) (io.Reader, error) {
	for {
		hdr, err := tr.Next()
		if errors.Is(err, io.EOF) {
			return nil, fmt.Errorf("%s has no %s", archiveName, binary)
		}
		if err != nil {
			return nil, fmt.Errorf("%s is not a valid tar.gz: %w", archiveName, err)
		}
		if hdr.Typeflag == tar.TypeReg && path.Clean(hdr.Name) == binary {
			return tr, nil
		}
	}
}

// runVersionCheck runs binary -version and wants version in what it prints.
func runVersionCheck(ctx context.Context, binary, version string) error {
	ctx, cancel := context.WithTimeout(ctx, versionCheckTimeout)
	defer cancel()
	out, err := exec.CommandContext(ctx, binary, "-version").Output()
	if err != nil {
		return fmt.Errorf("the downloaded version doesn't start on this computer: %w", err)
	}
	if !strings.Contains(string(out), version) {
		return fmt.Errorf("the downloaded file is not version %s", version)
	}
	return nil
}

// replaceExecutable puts newPath in place of exe. A rename over exe swaps it in one step (Unix);
// Windows can't replace a running executable but can rename it, so with moveAside exe moves to
// exe.old first and comes back if the new file can't take its place.
func replaceExecutable(exe, newPath string, moveAside bool) error {
	if !moveAside {
		if err := os.Rename(newPath, exe); err != nil {
			return fmt.Errorf("can't replace %s: %w", exe, osReason(err))
		}
		return nil
	}

	old := exe + replacedBinarySuffix
	if err := os.Remove(old); err != nil && !errors.Is(err, os.ErrNotExist) {
		return fmt.Errorf("can't remove the previous update's %s: %w", old, osReason(err))
	}
	if err := os.Rename(exe, old); err != nil {
		return fmt.Errorf("can't replace %s: %w", exe, osReason(err))
	}
	if err := os.Rename(newPath, exe); err != nil {
		if restoreErr := os.Rename(old, exe); restoreErr != nil {
			return fmt.Errorf("can't replace %s (%w), and the old version couldn't be put back from %s: %w",
				exe, osReason(err), old, osReason(restoreErr))
		}
		return fmt.Errorf("can't replace %s: %w", exe, osReason(err))
	}
	return nil
}

// osReason is err without the paths the os package puts in it ("open /dir/.f1telemetry-update-1:
// permission denied" becomes "permission denied"), for messages that already name the folder or file.
func osReason(err error) error {
	var pathErr *fs.PathError
	if errors.As(err, &pathErr) {
		return pathErr.Err
	}
	var linkErr *os.LinkError
	if errors.As(err, &linkErr) {
		return linkErr.Err
	}
	return err
}
