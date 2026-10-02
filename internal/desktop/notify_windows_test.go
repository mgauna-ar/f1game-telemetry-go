//go:build windows

package desktop

import (
	"strings"
	"testing"
	"unsafe"

	"golang.org/x/sys/windows"
)

// TestNotifyIconDataLayout checks the struct is the size Windows expects for NOTIFYICONDATAW
// with the GUID and balloon icon members (Vista and later).
func TestNotifyIconDataLayout(t *testing.T) {
	want := map[uintptr]uintptr{8: 976, 4: 956}[unsafe.Sizeof(uintptr(0))]
	if got := unsafe.Sizeof(notifyIconData{}); got != want {
		t.Errorf("sizeof(notifyIconData) = %d, want %d", got, want)
	}
}

func TestCopyUTF16(t *testing.T) {
	short := make([]uint16, 64)
	copyUTF16(short, "F1 Telemetry")
	if got := windows.UTF16ToString(short); got != "F1 Telemetry" {
		t.Errorf("copyUTF16() = %q", got)
	}

	tiny := make([]uint16, 5)
	copyUTF16(tiny, strings.Repeat("x", 20))
	if tiny[len(tiny)-1] != 0 || windows.UTF16ToString(tiny) != "xxxx" {
		t.Errorf("long text should be cut with a NUL, got %q", windows.UTF16ToString(tiny))
	}
}
