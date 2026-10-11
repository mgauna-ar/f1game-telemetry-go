//go:build windows

package system

import (
	"fmt"
	"os"
	"os/exec"
)

// Restart starts exe with args from the same working directory; this process then exits.
func Restart(exe string, args []string) error {
	cmd := exec.Command(exe, args...)
	cmd.Env = restartEnv()
	if dir, err := os.Getwd(); err == nil {
		cmd.Dir = dir
	}
	if err := cmd.Start(); err != nil {
		return fmt.Errorf("couldn't start %s: %w", exe, err)
	}
	return cmd.Process.Release()
}
