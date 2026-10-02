//go:build windows

package desktop

import (
	"errors"
	"os"
	"path/filepath"
	"strings"

	"golang.org/x/sys/windows"
	"golang.org/x/sys/windows/registry"
)

const (
	// runKeyPath is where Windows looks for programs to start when the user signs in.
	runKeyPath = `Software\Microsoft\Windows\CurrentVersion\Run`
	// runValueName is this app's entry under runKeyPath.
	runValueName = appName
)

// autostartCommand is the command line that starts exe with args.
func autostartCommand(exe string, args []string) string {
	return windows.ComposeCommandLine(append([]string{exe}, args...))
}

// commandRunsExe reports whether a Run entry's command line starts exe, so moving the app to
// another folder unticks "Start with Windows" until it is ticked again from the new place.
func commandRunsExe(command, exe string) bool {
	args, err := windows.DecomposeCommandLine(command)
	if err != nil || len(args) == 0 {
		return false
	}
	return strings.EqualFold(filepath.Clean(args[0]), filepath.Clean(exe))
}

// canAutostart reports whether exe can be started at sign-in: a `go run` build lives in a
// temporary folder that is gone by then.
func canAutostart(exe string) bool {
	tmp := filepath.Clean(os.TempDir()) + string(filepath.Separator)
	return !strings.HasPrefix(strings.ToLower(filepath.Clean(exe)), strings.ToLower(tmp))
}

// autostartEnabled reports whether this user's Run entry starts exe.
func autostartEnabled(exe string) bool {
	key, err := registry.OpenKey(registry.CURRENT_USER, runKeyPath, registry.QUERY_VALUE)
	if err != nil {
		return false
	}
	defer key.Close()
	command, _, err := key.GetStringValue(runValueName)
	return err == nil && commandRunsExe(command, exe)
}

// setAutostart adds (or replaces) this user's Run entry starting exe with args, or removes it.
func setAutostart(enable bool, exe string, args []string) error {
	key, _, err := registry.CreateKey(registry.CURRENT_USER, runKeyPath, registry.SET_VALUE)
	if err != nil {
		return err
	}
	defer key.Close()
	if enable {
		return key.SetStringValue(runValueName, autostartCommand(exe, args))
	}
	if err := key.DeleteValue(runValueName); err != nil && !errors.Is(err, registry.ErrNotExist) {
		return err
	}
	return nil
}
