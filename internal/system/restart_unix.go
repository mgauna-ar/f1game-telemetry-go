//go:build !windows

package system

import (
	"fmt"
	"syscall"
)

// Restart runs exe with args in place of this process: same process ID, terminal and working
// directory, so Ctrl+C in the terminal still stops it. It returns only on error.
func Restart(exe string, args []string) error {
	if err := syscall.Exec(exe, append([]string{exe}, args...), restartEnv()); err != nil {
		return fmt.Errorf("couldn't start %s: %w", exe, err)
	}
	return nil
}
