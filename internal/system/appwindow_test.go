package system

import (
	"errors"
	"path/filepath"
	"slices"
	"testing"
)

func TestAppBrowser(t *testing.T) {
	env := map[string]string{
		"ProgramFiles(x86)": `C:\Program Files (x86)`,
		"ProgramFiles":      `C:\Program Files`,
		"LOCALAPPDATA":      `C:\Users\me\AppData\Local`,
		"HOME":              "/Users/me",
	}
	getenv := func(k string) string { return env[k] }
	installed := func(paths ...string) func(string) bool {
		return func(p string) bool { return slices.Contains(paths, p) }
	}
	onPath := func(names ...string) func(string) (string, error) {
		return func(name string) (string, error) {
			if slices.Contains(names, name) {
				return "/usr/bin/" + name, nil
			}
			return "", errors.New("not found")
		}
	}
	edge := filepath.Join(env["ProgramFiles(x86)"], windowsAppBrowsers[0])
	userChrome := filepath.Join(env["LOCALAPPDATA"], windowsAppBrowsers[1])
	macChrome := filepath.Join(macApplications, macAppBrowsers[0])
	macBrave := filepath.Join(env["HOME"], "Applications", macAppBrowsers[3])
	macChromeExe := filepath.Join(macChrome, "Contents", "MacOS", "Google Chrome")
	macBraveExe := filepath.Join(macBrave, "Contents", "MacOS", "Brave Browser")

	tests := []struct {
		name     string
		goos     string
		exists   func(string) bool
		lookPath func(string) (string, error)
		want     string
	}{
		{name: "windows prefers Edge", goos: "windows", exists: installed(userChrome, edge), lookPath: onPath(), want: edge},
		{name: "windows per-user Chrome", goos: "windows", exists: installed(userChrome), lookPath: onPath(), want: userChrome},
		{name: "windows none", goos: "windows", exists: installed(), lookPath: onPath(), want: ""},
		{name: "mac Chrome", goos: "darwin", exists: installed(macBraveExe, macChromeExe), lookPath: onPath(), want: macChrome},
		{name: "mac Brave in home Applications", goos: "darwin", exists: installed(macBraveExe), lookPath: onPath(), want: macBrave},
		{name: "mac bundle without its program", goos: "darwin", exists: installed(macChrome), lookPath: onPath(), want: ""},
		{name: "mac Safari only", goos: "darwin", exists: installed(), lookPath: onPath(), want: ""},
		{name: "linux chromium", goos: "linux", exists: installed(), lookPath: onPath("firefox", "chromium"), want: "/usr/bin/chromium"},
		{name: "linux firefox only", goos: "linux", exists: installed(), lookPath: onPath("firefox"), want: ""},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := appBrowser(tt.goos, getenv, tt.exists, tt.lookPath); got != tt.want {
				t.Errorf("appBrowser() = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestAppWindowCommand(t *testing.T) {
	const url = "http://localhost:8080/desktop"
	const profile = "/cache/F1 Telemetry/app-window"
	tests := []struct {
		name     string
		goos     string
		browser  string
		wantName string
		wantArgs []string
	}{
		{
			name:     "windows runs the browser in its own profile",
			goos:     "windows",
			browser:  `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`,
			wantName: `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`,
			wantArgs: []string{
				"--app=http://localhost:8080/desktop",
				"--window-size=440,640",
				"--user-data-dir=/cache/F1 Telemetry/app-window",
				"--no-first-run",
				"--no-default-browser-check",
			},
		},
		{
			name:     "linux runs the browser in its own profile",
			goos:     "linux",
			browser:  "/usr/bin/chromium",
			wantName: "/usr/bin/chromium",
			wantArgs: appWindowArgs(url, 440, 640, profile),
		},
		{
			name:     "mac opens it in the user's own browser and profile",
			goos:     "darwin",
			browser:  "/Applications/Google Chrome.app",
			wantName: "open",
			wantArgs: []string{"-n", "-a", "/Applications/Google Chrome.app", "--args", "--app=http://localhost:8080/desktop"},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			name, args := appWindowCommand(tt.goos, tt.browser, url, 440, 640, profile)
			if name != tt.wantName || !slices.Equal(args, tt.wantArgs) {
				t.Errorf("appWindowCommand() = %q %q, want %q %q", name, args, tt.wantName, tt.wantArgs)
			}
		})
	}
}
