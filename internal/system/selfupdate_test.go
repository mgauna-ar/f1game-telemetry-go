package system

import (
	"archive/tar"
	"archive/zip"
	"bytes"
	"compress/gzip"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"runtime"
	"slices"
	"strings"
	"testing"
)

const testTag = "v9.9.9"

func zipArchive(t *testing.T, entries map[string]string) []byte {
	t.Helper()
	var buf bytes.Buffer
	zw := zip.NewWriter(&buf)
	for name, body := range entries {
		w, err := zw.Create(name)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := w.Write([]byte(body)); err != nil {
			t.Fatal(err)
		}
	}
	if err := zw.Close(); err != nil {
		t.Fatal(err)
	}
	return buf.Bytes()
}

func tarGzArchive(t *testing.T, entries map[string]string) []byte {
	t.Helper()
	var buf bytes.Buffer
	gz := gzip.NewWriter(&buf)
	tw := tar.NewWriter(gz)
	for name, body := range entries {
		if err := tw.WriteHeader(&tar.Header{Name: name, Mode: 0o755, Size: int64(len(body)), Typeflag: tar.TypeReg}); err != nil {
			t.Fatal(err)
		}
		if _, err := tw.Write([]byte(body)); err != nil {
			t.Fatal(err)
		}
	}
	if err := tw.Close(); err != nil {
		t.Fatal(err)
	}
	if err := gz.Close(); err != nil {
		t.Fatal(err)
	}
	return buf.Bytes()
}

func sha256Hex(data []byte) string {
	sum := sha256.Sum256(data)
	return hex.EncodeToString(sum[:])
}

// fakeRelease serves files at /releases/download/<tag>/<name> and points the updater at it.
func fakeRelease(t *testing.T, files map[string][]byte) *UpdateCheckResponse {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, ok := files[filepath.Base(r.URL.Path)]
		if !ok {
			http.NotFound(w, r)
			return
		}
		_, _ = w.Write(body)
	}))
	t.Cleanup(srv.Close)

	prevPrefix, prevCheck := releaseDownloadPrefix, checkBinaryVersion
	releaseDownloadPrefix = srv.URL + "/releases/download/"
	checkBinaryVersion = func(context.Context, string, string) error { return nil }
	t.Cleanup(func() { releaseDownloadPrefix, checkBinaryVersion = prevPrefix, prevCheck })

	rel := &UpdateCheckResponse{UpdateAvailable: true, LatestVersion: testTag}
	for name := range files {
		rel.Assets = append(rel.Assets, ReleaseAssetInfo{Name: name, DownloadURL: releaseDownloadPrefix + testTag + "/" + name})
	}
	return rel
}

// installedExe is a stand-in for the running executable in its own folder.
func installedExe(t *testing.T) string {
	t.Helper()
	exe := filepath.Join(t.TempDir(), binaryName(runtime.GOOS))
	if err := os.WriteFile(exe, []byte("old"), executableMode); err != nil {
		t.Fatal(err)
	}
	return exe
}

func folderFiles(t *testing.T, dir string) []string {
	t.Helper()
	entries, err := os.ReadDir(dir)
	if err != nil {
		t.Fatal(err)
	}
	names := make([]string, 0, len(entries))
	for _, e := range entries {
		names = append(names, e.Name())
	}
	return names
}

func TestReleaseArchive(t *testing.T) {
	rel := &UpdateCheckResponse{LatestVersion: "v1.7.0", Assets: []ReleaseAssetInfo{
		{Name: "f1telemetry_v1.7.0_windows_amd64.zip"},
		{Name: "f1telemetry_v1.7.0_darwin_arm64.zip"},
		{Name: "f1telemetry_v1.7.0_linux_amd64.tar.gz"},
		{Name: "checksums.txt"},
	}}
	tests := []struct {
		goos, goarch, want, wantErr string
	}{
		{goos: "windows", goarch: "amd64", want: "f1telemetry_v1.7.0_windows_amd64.zip"},
		{goos: "darwin", goarch: "arm64", want: "f1telemetry_v1.7.0_darwin_arm64.zip"},
		{goos: "linux", goarch: "amd64", want: "f1telemetry_v1.7.0_linux_amd64.tar.gz"},
		{goos: "darwin", goarch: "amd64", wantErr: "no download for darwin/amd64"},
	}
	for _, tt := range tests {
		t.Run(tt.goos+"/"+tt.goarch, func(t *testing.T) {
			archive, sums, err := releaseArchive(rel, tt.goos, tt.goarch)
			if tt.wantErr != "" {
				if err == nil || !strings.Contains(err.Error(), tt.wantErr) {
					t.Fatalf("releaseArchive() error = %v, want %q", err, tt.wantErr)
				}
				return
			}
			if err != nil || archive.Name != tt.want || sums.Name != checksumsAssetName {
				t.Errorf("releaseArchive() = %q, %q, %v; want %q and the checksums", archive.Name, sums.Name, err, tt.want)
			}
		})
	}

	noSums := &UpdateCheckResponse{LatestVersion: "v1.7.0", Assets: rel.Assets[:3]}
	if _, _, err := releaseArchive(noSums, "linux", "amd64"); err == nil || !strings.Contains(err.Error(), checksumsAssetName) {
		t.Errorf("releaseArchive() without checksums error = %v, want one naming %s", err, checksumsAssetName)
	}
}

func TestChecksumFor(t *testing.T) {
	sum := sha256Hex([]byte("archive"))
	tests := []struct {
		name, sums, file, want, wantErr string
	}{
		{name: "sha256sum line", sums: sum + "  a.zip\n" + sha256Hex([]byte("b")) + "  b.zip\n", file: "a.zip", want: sum},
		{name: "binary mode marker and upper case", sums: strings.ToUpper(sum) + " *a.zip", file: "a.zip", want: sum},
		{name: "missing", sums: sum + "  b.zip\n", file: "a.zip", wantErr: "no checksum for a.zip"},
		{name: "malformed", sums: "abc  a.zip\n", file: "a.zip", wantErr: "malformed checksum"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := checksumFor([]byte(tt.sums), tt.file)
			if tt.wantErr != "" {
				if err == nil || !strings.Contains(err.Error(), tt.wantErr) {
					t.Fatalf("checksumFor() error = %v, want %q", err, tt.wantErr)
				}
				return
			}
			if err != nil || got != tt.want {
				t.Errorf("checksumFor() = %q, %v; want %q", got, err, tt.want)
			}
		})
	}
}

func TestInstallRelease(t *testing.T) {
	base := fmt.Sprintf("f1telemetry_%s_%s_%s", testTag, runtime.GOOS, runtime.GOARCH)
	binary := binaryName(runtime.GOOS)
	tests := []struct {
		name    string
		archive string
		body    []byte
	}{
		{name: "zip", archive: base + zipExt, body: zipArchive(t, map[string]string{binary: "new", "README.md": "x"})},
		{name: "tar.gz", archive: base + tarGzExt, body: tarGzArchive(t, map[string]string{binary: "new", "README.md": "x"})},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rel := fakeRelease(t, map[string][]byte{
				tt.archive:         tt.body,
				checksumsAssetName: []byte(sha256Hex(tt.body) + "  " + tt.archive + "\n"),
			})
			var checked string
			checkBinaryVersion = func(_ context.Context, path, version string) error {
				checked = version
				if data, err := os.ReadFile(path); err != nil || string(data) != "new" {
					t.Errorf("version check ran on %q (%v), want the extracted binary", data, err)
				}
				return nil
			}
			exe := installedExe(t)

			if err := InstallRelease(t.Context(), rel, exe); err != nil {
				t.Fatalf("InstallRelease() error = %v", err)
			}
			if data, err := os.ReadFile(exe); err != nil || string(data) != "new" {
				t.Errorf("executable = %q, %v; want the new version", data, err)
			}
			if checked != testTag {
				t.Errorf("version checked = %q, want %q", checked, testTag)
			}
			if runtime.GOOS != "windows" {
				if info, err := os.Stat(exe); err != nil || info.Mode().Perm()&0o111 == 0 {
					t.Errorf("executable mode = %v, %v; want it executable", info.Mode(), err)
				}
			}
			if err := RemoveReplacedExecutable(exe); err != nil {
				t.Fatalf("RemoveReplacedExecutable() error = %v", err)
			}
			if files := folderFiles(t, filepath.Dir(exe)); !slices.Equal(files, []string{binary}) {
				t.Errorf("folder holds %q, want only the executable", files)
			}
		})
	}
}

func TestInstallReleaseLeavesExecutableOnError(t *testing.T) {
	archiveName := fmt.Sprintf("f1telemetry_%s_%s_%s%s", testTag, runtime.GOOS, runtime.GOARCH, zipExt)
	good := zipArchive(t, map[string]string{binaryName(runtime.GOOS): "new"})

	tests := []struct {
		name    string
		archive []byte
		// sums is the checksums file; nil means the archive's right sum
		sums        []byte
		versionErr  error
		foreignURL  bool
		archiveGone bool
		wantErr     string
	}{
		{
			name:    "checksum mismatch",
			archive: good,
			sums:    []byte(sha256Hex([]byte("other")) + "  " + archiveName),
			wantErr: "doesn't match its checksum",
		},
		{
			name:    "binary missing from the archive",
			archive: zipArchive(t, map[string]string{"other": "x"}),
			wantErr: "has no " + binaryName(runtime.GOOS),
		},
		{
			name:       "new version doesn't run",
			archive:    good,
			versionErr: errors.New("exec format error"),
			wantErr:    "exec format error",
		},
		{
			name:       "download from elsewhere",
			archive:    good,
			foreignURL: true,
			wantErr:    "refusing to download",
		},
		{
			name:        "archive missing on the server",
			archive:     good,
			archiveGone: true,
			wantErr:     "GitHub answered 404",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			sums := tt.sums
			if sums == nil {
				sums = []byte(sha256Hex(tt.archive) + "  " + archiveName + "\n")
			}
			rel := fakeRelease(t, map[string][]byte{archiveName: tt.archive, checksumsAssetName: sums})
			if tt.versionErr != nil {
				checkBinaryVersion = func(context.Context, string, string) error { return tt.versionErr }
			}
			for i := range rel.Assets {
				switch {
				case rel.Assets[i].Name != archiveName:
				case tt.foreignURL:
					rel.Assets[i].DownloadURL = "https://example.com/" + archiveName
				case tt.archiveGone:
					rel.Assets[i].DownloadURL += ".gone"
				}
			}
			exe := installedExe(t)

			err := InstallRelease(t.Context(), rel, exe)
			if err == nil || !strings.Contains(err.Error(), tt.wantErr) {
				t.Fatalf("InstallRelease() error = %v, want %q", err, tt.wantErr)
			}
			if data, readErr := os.ReadFile(exe); readErr != nil || string(data) != "old" {
				t.Errorf("executable = %q, %v; want it untouched", data, readErr)
			}
			if files := folderFiles(t, filepath.Dir(exe)); !slices.Equal(files, []string{binaryName(runtime.GOOS)}) {
				t.Errorf("folder holds %q, want only the executable", files)
			}
		})
	}
}

func TestDownloadToLimit(t *testing.T) {
	rel := fakeRelease(t, map[string][]byte{"big.zip": bytes.Repeat([]byte("x"), 100)})
	var buf bytes.Buffer
	if _, err := downloadTo(t.Context(), rel.Assets[0], &buf, 10); err == nil || !strings.Contains(err.Error(), "larger than expected") {
		t.Errorf("downloadTo() over the limit error = %v, want it refused", err)
	}
}

func TestReplaceExecutable(t *testing.T) {
	tests := []struct {
		name      string
		moveAside bool
		noNewFile bool
		want      string
		wantOld   bool
		wantErr   bool
	}{
		{name: "rename over", want: "new"},
		{name: "move aside (Windows)", moveAside: true, want: "new", wantOld: true},
		{name: "move aside puts the old one back", moveAside: true, noNewFile: true, want: "old", wantErr: true},
		{name: "rename over without a new file", noNewFile: true, want: "old", wantErr: true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			exe := installedExe(t)
			newPath := exe + newBinarySuffix
			if !tt.noNewFile {
				if err := os.WriteFile(newPath, []byte("new"), executableMode); err != nil {
					t.Fatal(err)
				}
			}

			err := replaceExecutable(exe, newPath, tt.moveAside)
			if (err != nil) != tt.wantErr {
				t.Fatalf("replaceExecutable() error = %v, want error %v", err, tt.wantErr)
			}
			if data, readErr := os.ReadFile(exe); readErr != nil || string(data) != tt.want {
				t.Errorf("executable = %q, %v; want %q", data, readErr, tt.want)
			}
			old, oldErr := os.ReadFile(exe + replacedBinarySuffix)
			if tt.wantOld != (oldErr == nil) || (tt.wantOld && string(old) != "old") {
				t.Errorf("%s = %q, %v; want it there: %v", replacedBinarySuffix, old, oldErr, tt.wantOld)
			}
		})
	}
}

func TestRemoveReplacedExecutable(t *testing.T) {
	exe := installedExe(t)
	if err := RemoveReplacedExecutable(exe); err != nil {
		t.Errorf("RemoveReplacedExecutable() with nothing to remove error = %v", err)
	}
	if err := os.WriteFile(exe+replacedBinarySuffix, []byte("old"), executableMode); err != nil {
		t.Fatal(err)
	}
	if err := RemoveReplacedExecutable(exe); err != nil {
		t.Fatalf("RemoveReplacedExecutable() error = %v", err)
	}
	if _, err := os.Stat(exe + replacedBinarySuffix); !errors.Is(err, os.ErrNotExist) {
		t.Errorf("%s still there: %v", replacedBinarySuffix, err)
	}
}

func TestRunVersionCheck(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("uses a shell script as the binary")
	}
	binary := filepath.Join(t.TempDir(), "f1telemetry")
	script := "#!/bin/sh\necho 'F1 Telemetry Analyzer " + testTag + " (commit: abc1234, built: 2026-10-11)'\n"
	if err := os.WriteFile(binary, []byte(script), executableMode); err != nil {
		t.Fatal(err)
	}

	if err := runVersionCheck(t.Context(), binary, testTag); err != nil {
		t.Errorf("runVersionCheck(%s) error = %v", testTag, err)
	}
	if err := runVersionCheck(t.Context(), binary, "v9.9.8"); err == nil {
		t.Error("runVersionCheck() of another version succeeded")
	}
	if err := runVersionCheck(t.Context(), binary+"-missing", testTag); err == nil {
		t.Error("runVersionCheck() of a missing binary succeeded")
	}
}

// TestInstallReleaseReadOnlyFolder is an app in a folder it can't write to, such as /usr/local/bin.
func TestInstallReleaseReadOnlyFolder(t *testing.T) {
	if runtime.GOOS == "windows" || os.Geteuid() == 0 {
		t.Skip("needs a folder this user can't write to")
	}
	archiveName := fmt.Sprintf("f1telemetry_%s_%s_%s%s", testTag, runtime.GOOS, runtime.GOARCH, zipExt)
	archive := zipArchive(t, map[string]string{binaryName(runtime.GOOS): "new"})
	rel := fakeRelease(t, map[string][]byte{
		archiveName:        archive,
		checksumsAssetName: []byte(sha256Hex(archive) + "  " + archiveName),
	})
	exe := installedExe(t)
	dir := filepath.Dir(exe)
	if err := os.Chmod(dir, 0o555); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = os.Chmod(dir, 0o755) })

	err := InstallRelease(t.Context(), rel, exe)
	realDir, _ := filepath.EvalSymlinks(dir)
	if want := "can't write to " + realDir + ": permission denied"; err == nil || err.Error() != want {
		t.Fatalf("InstallRelease() error = %v, want %q", err, want)
	}
	if !errors.Is(err, os.ErrPermission) {
		t.Errorf("InstallRelease() error = %v, want it to be os.ErrPermission", err)
	}
	if data, readErr := os.ReadFile(exe); readErr != nil || string(data) != "old" {
		t.Errorf("executable = %q, %v; want it untouched", data, readErr)
	}
}
