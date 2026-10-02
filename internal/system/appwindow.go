package system

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
)

// appWindowProfileDir is the browser profile app windows run in, under the user's cache folder.
var appWindowProfileDir = filepath.Join("F1 Telemetry", "app-window")

// Browsers that can open a page as an app window (--app), most likely to be installed first.
var (
	// windowsAppBrowsers are relative to %ProgramFiles(x86)%, %ProgramFiles% and %LOCALAPPDATA%.
	// Edge comes with every Windows 10/11.
	windowsAppBrowsers = []string{
		filepath.Join("Microsoft", "Edge", "Application", "msedge.exe"),
		filepath.Join("Google", "Chrome", "Application", "chrome.exe"),
	}
	windowsProgramDirs = []string{"ProgramFiles(x86)", "ProgramFiles", "LOCALAPPDATA"}

	// macApplications is where macOS apps are installed for every user; ~/Applications is checked too.
	macApplications = "/Applications"

	// macAppBrowsers are relative to /Applications and ~/Applications.
	macAppBrowsers = []string{
		filepath.Join("Google Chrome.app", "Contents", "MacOS", "Google Chrome"),
		filepath.Join("Microsoft Edge.app", "Contents", "MacOS", "Microsoft Edge"),
		filepath.Join("Chromium.app", "Contents", "MacOS", "Chromium"),
		filepath.Join("Brave Browser.app", "Contents", "MacOS", "Brave Browser"),
	}

	// linuxAppBrowsers are looked up on PATH.
	linuxAppBrowsers = []string{
		"google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "microsoft-edge", "brave-browser",
	}
)

// OpenAppWindow opens url in a small window of its own: a Chromium-based browser (Edge, Chrome,
// Chromium, Brave) in app mode, which has no tabs or address bar, in a separate profile so the
// size applies and it stays apart from the user's browsing. Without such a browser the page opens
// in the default browser instead.
func OpenAppWindow(url string, width, height int) error {
	browser := appBrowser(runtime.GOOS, os.Getenv, fileExists, exec.LookPath)
	if browser == "" {
		return OpenPath(url)
	}
	cmd := exec.Command(browser, appWindowArgs(url, width, height, appWindowProfile())...)
	if err := cmd.Start(); err != nil {
		return fmt.Errorf("failed to open the app window with %s: %w", browser, err)
	}
	go func() { _ = cmd.Wait() }()
	return nil
}

// appBrowser is the first browser on this OS that can open an app window, or "" when none is.
func appBrowser(goos string, getenv func(string) string, exists func(string) bool, lookPath func(string) (string, error)) string {
	switch goos {
	case "windows":
		for _, browser := range windowsAppBrowsers {
			for _, dir := range windowsProgramDirs {
				if base := getenv(dir); base != "" && exists(filepath.Join(base, browser)) {
					return filepath.Join(base, browser)
				}
			}
		}
	case "darwin":
		dirs := []string{macApplications}
		if home := getenv("HOME"); home != "" {
			dirs = append(dirs, filepath.Join(home, "Applications"))
		}
		for _, browser := range macAppBrowsers {
			for _, dir := range dirs {
				if path := filepath.Join(dir, browser); exists(path) {
					return path
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

func fileExists(path string) bool {
	info, err := os.Stat(path)
	return err == nil && !info.IsDir()
}
