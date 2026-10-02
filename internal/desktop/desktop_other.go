//go:build !windows

package desktop

// Supported reports whether this platform has the tray.
func Supported() bool { return false }

// HasConsole reports whether the process can write to a console.
func HasConsole() bool { return true }

// ShowError shows message in an error dialog.
func ShowError(string) {}

// RunTray shows the tray until Quit is called, then runs onExit.
func RunTray(_ Options, onExit func()) { onExit() }

// Quit closes the tray, making RunTray return.
func Quit() {}
