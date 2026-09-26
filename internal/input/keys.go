package input

import (
	"fmt"
	"strconv"
	"strings"
)

// Windows virtual-key codes for the keys push-to-talk can use.
const (
	VKMouse3       = 0x04
	VKMouse4       = 0x05 // VK_XBUTTON1
	VKMouse5       = 0x06 // VK_XBUTTON2
	VKBackspace    = 0x08
	VKTab          = 0x09
	VKEnter        = 0x0D
	VKShift        = 0x10
	VKControl      = 0x11
	VKAlt          = 0x12 // VK_MENU
	VKPause        = 0x13
	VKCapsLock     = 0x14 // VK_CAPITAL
	VKEscape       = 0x1B
	VKSpace        = 0x20
	VKPageUp       = 0x21
	VKPageDown     = 0x22
	VKEnd          = 0x23
	VKHome         = 0x24
	VKLeft         = 0x25
	VKUp           = 0x26
	VKRight        = 0x27
	VKDown         = 0x28
	VKInsert       = 0x2D
	VKDelete       = 0x2E
	VKNumpad0      = 0x60
	VKF1           = 0x70
	VKF12          = 0x7B
	VKF24          = 0x87
	VKLeftShift    = 0xA0
	VKRightShift   = 0xA1
	VKLeftControl  = 0xA2
	VKRightControl = 0xA3
	VKLeftAlt      = 0xA4
	VKRightAlt     = 0xA5

	// maxVirtualKeyCode is the highest Windows virtual-key code.
	maxVirtualKeyCode = 0xFE

	numpadKeyCount = 10
	// hexKeyNamePrefix starts the name of a key without a friendlier one, e.g. "Key 0xE2".
	hexKeyNamePrefix = "Key 0x"
)

// namedKeys are the display names of keys with one, followed by other spellings of them, such as
// the browser's KeyboardEvent.key and KeyboardEvent.code values.
var namedKeys = []struct {
	vk      int
	name    string
	aliases []string
}{
	{VKMouse3, "Mouse 3", nil},
	{VKMouse4, "Mouse 4", []string{"XButton1"}},
	{VKMouse5, "Mouse 5", []string{"XButton2"}},
	{VKBackspace, "Backspace", nil},
	{VKTab, "Tab", nil},
	{VKEnter, "Enter", []string{"Return"}},
	{VKShift, "Shift", nil},
	{VKControl, "Ctrl", []string{"Control"}},
	{VKAlt, "Alt", nil},
	{VKPause, "Pause", nil},
	{VKCapsLock, "Caps Lock", nil},
	{VKEscape, "Esc", []string{"Escape"}},
	{VKSpace, "Space", []string{"Spacebar"}},
	{VKPageUp, "Page Up", nil},
	{VKPageDown, "Page Down", nil},
	{VKEnd, "End", nil},
	{VKHome, "Home", nil},
	{VKLeft, "Left", []string{"ArrowLeft"}},
	{VKUp, "Up", []string{"ArrowUp"}},
	{VKRight, "Right", []string{"ArrowRight"}},
	{VKDown, "Down", []string{"ArrowDown"}},
	{VKInsert, "Insert", nil},
	{VKDelete, "Delete", nil},
	{VKLeftShift, "Left Shift", []string{"ShiftLeft"}},
	{VKRightShift, "Right Shift", []string{"ShiftRight"}},
	{VKLeftControl, "Left Ctrl", []string{"ControlLeft"}},
	{VKRightControl, "Right Ctrl", []string{"ControlRight"}},
	{VKLeftAlt, "Left Alt", []string{"AltLeft"}},
	{VKRightAlt, "Right Alt", []string{"AltRight", "AltGraph"}},
}

var (
	keyNames = make(map[int]string)
	keyCodes = make(map[string]int)
)

func init() {
	add := func(vk int, name string, aliases ...string) {
		keyNames[vk] = name
		keyCodes[normalizeKeyName(name)] = vk
		for _, a := range aliases {
			keyCodes[normalizeKeyName(a)] = vk
		}
	}
	for _, k := range namedKeys {
		add(k.vk, k.name, k.aliases...)
	}
	for c := 'A'; c <= 'Z'; c++ {
		add(int(c), string(c), "Key"+string(c))
	}
	for c := '0'; c <= '9'; c++ {
		add(int(c), string(c), "Digit"+string(c))
	}
	for i := range numpadKeyCount {
		add(VKNumpad0+i, fmt.Sprintf("Numpad %d", i))
	}
	for vk := VKF1; vk <= VKF24; vk++ {
		add(vk, fmt.Sprintf("F%d", vk-VKF1+1))
	}
}

// normalizeKeyName makes key names comparable: "Caps Lock", "CAPSLOCK" and "CapsLock" all match.
func normalizeKeyName(name string) string {
	return strings.ToLower(strings.ReplaceAll(name, " ", ""))
}

// KeyName returns the display name of a Windows virtual-key code. KeyCodeForName reads it back.
func KeyName(vk int) string {
	if name, ok := keyNames[vk]; ok {
		return name
	}
	return fmt.Sprintf("%s%X", hexKeyNamePrefix, vk)
}

// KeyCodeForName returns the Windows virtual-key code for a key name, ignoring case and spaces. It
// reads the names KeyName gives and the browser's KeyboardEvent key and code values, and returns 0
// for "None" and for keys it doesn't know.
func KeyCodeForName(name string) int {
	if name != "" && strings.TrimSpace(name) == "" {
		return VKSpace // KeyboardEvent.key for the space bar is " "
	}
	normalized := normalizeKeyName(name)
	if vk, ok := keyCodes[normalized]; ok {
		return vk
	}
	if hex, ok := strings.CutPrefix(normalized, normalizeKeyName(hexKeyNamePrefix)); ok {
		if vk, err := strconv.ParseUint(hex, 16, 16); err == nil && vk > 0 && vk <= maxVirtualKeyCode {
			return int(vk)
		}
	}
	return 0
}
