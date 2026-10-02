//go:build windows

package desktop

import (
	"os"
	"path/filepath"
	"testing"
)

func TestAutostartCommandRoundTrip(t *testing.T) {
	exe := `C:\Users\Max Driver\Apps\F1 Telemetry\f1telemetry.exe`
	command := autostartCommand(exe, []string{`-db=C:\Users\Max Driver\Apps\F1 Telemetry\f1telemetry.db`})

	if !commandRunsExe(command, exe) {
		t.Errorf("command %q should run %q", command, exe)
	}
	if !commandRunsExe(command, `c:\users\max driver\apps\f1 telemetry\F1TELEMETRY.EXE`) {
		t.Error("paths differing only in case should match")
	}
	if commandRunsExe(command, `C:\Other\f1telemetry.exe`) {
		t.Error("a command for another copy of the app should not match")
	}
	if commandRunsExe("", exe) {
		t.Error("an empty command should not match")
	}
}

func TestCanAutostart(t *testing.T) {
	if canAutostart(filepath.Join(os.TempDir(), "go-build123", "exe", "server.exe")) {
		t.Error("a go run build in the temp folder should not be offered")
	}
	if !canAutostart(`C:\Apps\F1 Telemetry\f1telemetry.exe`) {
		t.Error("an installed executable should be offered")
	}
}
