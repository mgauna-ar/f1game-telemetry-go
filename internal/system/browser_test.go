package system

import (
	"net"
	"path/filepath"
	"slices"
	"testing"
)

func TestDashboardBrowser(t *testing.T) {
	env := map[string]string{
		"ProgramFiles(x86)": `C:\Program Files (x86)`,
		"ProgramFiles":      `C:\Program Files`,
		"LOCALAPPDATA":      `C:\Users\me\AppData\Local`,
	}
	getenv := func(k string) string { return env[k] }
	installed := func(paths ...string) func(string) bool {
		return func(p string) bool { return slices.Contains(paths, p) }
	}
	chrome := filepath.Join(env["ProgramFiles"], windowsChrome)
	userChrome := filepath.Join(env["LOCALAPPDATA"], windowsChrome)
	edge := filepath.Join(env["ProgramFiles(x86)"], windowsAppBrowsers[0])

	tests := []struct {
		name   string
		goos   string
		exists func(string) bool
		want   string
	}{
		{name: "windows Chrome over Edge", goos: "windows", exists: installed(edge, chrome), want: chrome},
		{name: "windows per-user Chrome", goos: "windows", exists: installed(edge, userChrome), want: userChrome},
		{name: "windows without Chrome uses the default browser", goos: "windows", exists: installed(edge), want: ""},
		{name: "mac uses the default browser", goos: "darwin", exists: installed(chrome), want: ""},
		{name: "linux uses the default browser", goos: "linux", exists: installed(chrome), want: ""},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := dashboardBrowser(tt.goos, getenv, tt.exists); got != tt.want {
				t.Errorf("dashboardBrowser() = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestGetLocalIP(t *testing.T) {
	ip := GetLocalIP()
	if ip == "" {
		t.Fatalf("expected non-empty IP string")
	}

	parsed := net.ParseIP(ip)
	if parsed == nil {
		t.Fatalf("expected valid IP address, got %q", ip)
	}
}
