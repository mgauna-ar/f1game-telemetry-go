//go:build windows

package desktop

import (
	"errors"
	"fmt"
	"os"
	"syscall"
	"unsafe"

	"golang.org/x/sys/windows"
)

// The tray icon is owned by fyne.io/systray, which has no notification API. These are its
// internals (initInstance in systray_windows.go, v1.12.2): the hidden window's class and the icon
// ID. Recheck them when upgrading the library; if they change, showBalloon fails and is only logged.
const (
	systrayWindowClass = "SystrayClass"
	systrayIconID      = 100
)

const (
	nimModify            = 0x00000001
	nifInfo              = 0x00000010
	niifNone             = 0x00000000
	niifRespectQuietTime = 0x00000080
)

var (
	modUser32                    = syscall.NewLazyDLL("user32.dll")
	procFindWindowExW            = modUser32.NewProc("FindWindowExW")
	procGetWindowThreadProcessID = modUser32.NewProc("GetWindowThreadProcessId")

	modShell32            = syscall.NewLazyDLL("shell32.dll")
	procShellNotifyIconW  = modShell32.NewProc("Shell_NotifyIconW")
	errTrayWindowNotFound = errors.New("tray window not found")
)

// notifyIconData is NOTIFYICONDATAW. uTimeout and uVersion are one union field.
type notifyIconData struct {
	Size            uint32
	Wnd             windows.Handle
	ID              uint32
	Flags           uint32
	CallbackMessage uint32
	Icon            windows.Handle
	Tip             [128]uint16
	State           uint32
	StateMask       uint32
	Info            [256]uint16
	TimeoutVersion  uint32
	InfoTitle       [64]uint16
	InfoFlags       uint32
	GUIDItem        windows.GUID
	BalloonIcon     windows.Handle
}

// showBalloon shows a notification from the tray icon. Windows 10/11 show it as a toast, kept in
// the notification centre and held back during Do Not Disturb. Clicking it does nothing.
func showBalloon(title, body string) error {
	wnd, err := trayWindow()
	if err != nil {
		return err
	}
	nid := notifyIconData{
		Wnd:       wnd,
		ID:        systrayIconID,
		Flags:     nifInfo,
		InfoFlags: niifNone | niifRespectQuietTime,
	}
	nid.Size = uint32(unsafe.Sizeof(nid))
	copyUTF16(nid.InfoTitle[:], title)
	copyUTF16(nid.Info[:], body)

	if ok, _, err := procShellNotifyIconW.Call(nimModify, uintptr(unsafe.Pointer(&nid))); ok == 0 {
		return fmt.Errorf("Shell_NotifyIconW: %w", err)
	}
	return nil
}

// trayWindow finds this process's systray window (other apps using the library share its class).
func trayWindow() (windows.Handle, error) {
	class, err := windows.UTF16PtrFromString(systrayWindowClass)
	if err != nil {
		return 0, err
	}
	pid := uint32(os.Getpid())
	var wnd uintptr
	for {
		wnd, _, _ = procFindWindowExW.Call(0, wnd, uintptr(unsafe.Pointer(class)), 0)
		if wnd == 0 {
			return 0, errTrayWindowNotFound
		}
		var owner uint32
		_, _, _ = procGetWindowThreadProcessID.Call(wnd, uintptr(unsafe.Pointer(&owner)))
		if owner == pid {
			return windows.Handle(wnd), nil
		}
	}
}

// copyUTF16 writes s into dst as UTF-16, cut to fit with its terminating NUL.
func copyUTF16(dst []uint16, s string) {
	src, err := windows.UTF16FromString(s)
	if err != nil {
		return
	}
	if len(src) > len(dst) {
		src = src[:len(dst)]
		src[len(src)-1] = 0
	}
	copy(dst, src)
}
