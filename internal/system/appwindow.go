package system

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
)

// appWindowProfileDir is the browser profile app windows run in on Windows and Linux, under the
// user's cache folder.
var appWindowProfileDir = filepath.Join("F1 Telemetry", "app-window")

// Browsers that can open a page as an app window (--app), most likely to be installed first.
var (
	// windowsChrome is Chrome's program, relative to one of windowsProgramDirs.
	windowsChrome = filepath.Join("Google", "Chrome", "Application", "chrome.exe")

	// windowsAppBrowsers are relative to %ProgramFiles(x86)%, %ProgramFiles% and %LOCALAPPDATA%.
	// Edge comes with every Windows 10/11.
	windowsAppBrowsers = []string{
		filepath.Join("Microsoft", "Edge", "Application", "msedge.exe"),
		windowsChrome,
	}
	windowsProgramDirs = []string{"ProgramFiles(x86)", "ProgramFiles", "LOCALAPPDATA"}

	// macApplications is where macOS apps are installed for every user; ~/Applications is checked too.
	macApplications = "/Applications"

	// macAppBrowsers are app bundles in /Applications and ~/Applications.
	macAppBrowsers = []string{"Google Chrome.app", "Microsoft Edge.app", "Chromium.app", "Brave Browser.app"}

	// linuxAppBrowsers are looked up on PATH.
	linuxAppBrowsers = []string{
		"google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "microsoft-edge", "brave-browser",
	}
)

// OpenAppWindow opens url in a small window of its own: a Chromium-based browser (Edge, Chrome,
// Chromium, Brave) in app mode, which has no tabs or address bar. Without such a browser the page
// opens in the default browser instead.
//
// On Windows and Linux the window runs in a separate profile, so the size applies and it stays apart
// from the user's browsing. On macOS it opens in the user's own browser and profile: a second
// instance of the browser would share its bundle id, so macOS would send it the links clicked in
// other apps and the Dock icon's clicks, signed out of everything, even after the window closes.
// There the page sizes the window itself (frontend/src/desktop/useFitWindowToContent.ts).
func OpenAppWindow(url string, width, height int) error {
	browser := appBrowser(runtime.GOOS, os.Getenv, fileExists, exec.LookPath)
	if browser == "" {
		return OpenPath(url)
	}
	name, args := appWindowCommand(runtime.GOOS, browser, url, width, height, appWindowProfile())
	cmd := exec.Command(name, args...)
	if err := cmd.Start(); err != nil {
		return fmt.Errorf("failed to open the app window with %s: %w", browser, err)
	}
	go func() { _ = cmd.Wait() }()
	return nil
}

// appBrowser is the first browser on this OS that can open an app window, or "" when none is: its
// executable, or on macOS its app bundle.
func appBrowser(goos string, getenv func(string) string, exists func(string) bool, lookPath func(string) (string, error)) string {
	switch goos {
	case "windows":
		return findWindowsProgram(windowsAppBrowsers, getenv, exists)
	case "darwin":
		dirs := []string{macApplications}
		if home := getenv("HOME"); home != "" {
			dirs = append(dirs, filepath.Join(home, "Applications"))
		}
		for _, browser := range macAppBrowsers {
			for _, dir := range dirs {
				if bundle := filepath.Join(dir, browser); exists(macBundleExecutable(bundle)) {
					return bundle
				}
			}
		}
	default:
		for _, name := range linuxAppBrowsers {
			if path, err := lookPath(name); err == nil {
				return path
			}
		}
	}
	return ""
}

// findWindowsProgram is the first of programs installed in one of windowsProgramDirs, as its full
// path, or "" when none is. Each program is relative to those folders.
func findWindowsProgram(programs []string, getenv func(string) string, exists func(string) bool) string {
	for _, program := range programs {
		for _, dir := range windowsProgramDirs {
			if base := getenv(dir); base != "" && exists(filepath.Join(base, program)) {
				return filepath.Join(base, program)
			}
		}
	}
	return ""
}

// appWindowCommand is the program and arguments that open url as an app window with browser.
//
// On macOS, open launches the browser through Launch Services rather than as a child of this
// process, so a Ctrl+C in the app's terminal doesn't quit it, and -n passes the arguments even when
// the browser is running: the new process hands them to the running one and exits. Only --app is
// passed there: when the browser isn't running yet, the switches it starts with apply to all of
// the user's windows until it quits (--window-size would size every one of them).
func appWindowCommand(goos, browser, url string, width, height int, profile string) (name string, args []string) {
	if goos == "darwin" {
		return "open", []string{"-n", "-a", browser, "--args", "--app=" + url}
	}
	return browser, appWindowArgs(url, width, height, profile)
}

// appWindowArgs opens url as a width x height app window in its own profile, skipping the
// first-run and default-browser prompts a fresh profile would show.
func appWindowArgs(url string, width, height int, profile string) []string {
	return []string{
		"--app=" + url,
		fmt.Sprintf("--window-size=%d,%d", width, height),
		"--user-data-dir=" + profile,
		"--no-first-run",
		"--no-default-browser-check",
	}
}

// appWindowProfile is the app windows' browser profile folder.
func appWindowProfile() string {
	base, err := os.UserCacheDir()
	if err != nil {
		base = os.TempDir()
	}
	return filepath.Join(base, appWindowProfileDir)
}

// macBundleExecutable is the program inside a macOS app bundle, e.g.
// "Google Chrome.app/Contents/MacOS/Google Chrome".
func macBundleExecutable(bundle string) string {
	return filepath.Join(bundle, "Contents", "MacOS", strings.TrimSuffix(filepath.Base(bundle), ".app"))
}

func fileExists(path string) bool {
	info, err := os.Stat(path)
	return err == nil && !info.IsDir()
}
