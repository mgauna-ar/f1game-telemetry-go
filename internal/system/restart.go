package system

import "os"

// UpdatedEnv is set to "1" for the app Restart starts after an update. It is an environment
// variable rather than a flag so a version that doesn't know it still starts.
const UpdatedEnv = "F1T_UPDATED"

// restartEnv is this process's environment plus UpdatedEnv.
func restartEnv() []string {
	return append(os.Environ(), UpdatedEnv+"=1")
}
