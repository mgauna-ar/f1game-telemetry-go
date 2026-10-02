//go:build windows

package desktop

import (
	"log/slog"

	"golang.org/x/sys/windows"
)

// Supported reports whether this platform has the tray.
func Supported() bool { return true }

// HasConsole reports whether the process can write to a console. The release build is a GUI
// app (-H=windowsgui) with no console; `go run` and run.bat builds have one.
func HasConsole() bool {
	h, err := windows.GetStdHandle(windows.STD_ERROR_HANDLE)
	if err != nil || h == 0 || h == windows.InvalidHandle {
		return false
	}
	t, err := windows.GetFileType(h)
	return err == nil && t != windows.FILE_TYPE_UNKNOWN
}

// ShowError shows why the app could not start in an error dialog.
func ShowError(message string) {
	showDialog(userText().StartFailed, message)
}

// showDialog shows an error dialog in front of other windows and waits for OK.
func showDialog(title, message string) {
	titlePtr, err := windows.UTF16PtrFromString(title)
	if err != nil {
		return
	}
	messagePtr, err := windows.UTF16PtrFromString(message)
	if err != nil {
		return
	}
	const style = windows.MB_OK | windows.MB_ICONERROR | windows.MB_SETFOREGROUND | windows.MB_TOPMOST
	if _, err := windows.MessageBox(0, messagePtr, titlePtr, style); err != nil {
		slog.Warn("Could not show a dialog", "title", title, "error", err)
	}
}

// userText is the tray's strings in the user's preferred Windows display language.
func userText() text {
	langs, err := windows.GetUserPreferredUILanguages(windows.MUI_LANGUAGE_NAME)
	if err != nil || len(langs) == 0 {
		return englishText
	}
	return textFor(langs[0])
}
