package input

import "testing"

func TestKeyCodeForName(t *testing.T) {
	tests := []struct {
		name string
		want int
	}{
		// Names the server gives learned keys
		{"Caps Lock", VKCapsLock},
		{"Mouse 4", VKMouse4},
		{"Mouse 5", VKMouse5},
		{"Space", VKSpace},
		{"F5", VKF1 + 4},
		{"F12", VKF12},
		{"T", 'T'},
		{"Key 0x14", VKCapsLock},
		{"Key 0xE2", 0xE2},
		// Browser KeyboardEvent.key, as the dashboard stores keys learned in the browser
		{"CAPSLOCK", VKCapsLock},
		{"1", '1'},
		{"Q", 'Q'},
		{"q", 'Q'},
		{"SPACE", VKSpace},
		{" ", VKSpace},
		{"SHIFT", VKShift},
		{"CONTROL", VKControl},
		{"ALT", VKAlt},
		{"ARROWUP", VKUp},
		{"ENTER", VKEnter},
		// Browser KeyboardEvent.code, as the key dropdown stores keys
		{"KeyQ", 'Q'},
		{"KeyT", 'T'},
		{"Digit1", '1'},
		{"Space", VKSpace},
		{"CapsLock", VKCapsLock},
		{"ShiftLeft", VKLeftShift},
		{"ControlRight", VKRightControl},
		{"ArrowLeft", VKLeft},
		{"Numpad0", VKNumpad0},
		// No key, or one this table can't place
		{"", 0},
		{"None", 0},
		{"Ñ", 0},
		{"Key 0xZZ", 0},
		{"Key 0x0", 0},
		{"Key 0x100", 0},
		{"Keyboard", 0},
	}
	for _, tt := range tests {
		if got := KeyCodeForName(tt.name); got != tt.want {
			t.Errorf("KeyCodeForName(%q) = 0x%X, want 0x%X", tt.name, got, tt.want)
		}
	}
}

func TestKeyName(t *testing.T) {
	tests := []struct {
		vk   int
		want string
	}{
		{VKSpace, "Space"},
		{VKMouse4, "Mouse 4"},
		{VKMouse5, "Mouse 5"},
		{VKCapsLock, "Caps Lock"},
		{VKF1, "F1"},
		{VKF12, "F12"},
		{'T', "T"},
		{'7', "7"},
		{0xE2, "Key 0xE2"},
	}
	for _, tt := range tests {
		if got := KeyName(tt.vk); got != tt.want {
			t.Errorf("KeyName(0x%X) = %q, want %q", tt.vk, got, tt.want)
		}
	}
}

func TestKeyName_RoundTripsEveryCode(t *testing.T) {
	for vk := 1; vk <= maxVirtualKeyCode; vk++ {
		if got := KeyCodeForName(KeyName(vk)); got != vk {
			t.Errorf("KeyCodeForName(KeyName(0x%X) = %q) = 0x%X", vk, KeyName(vk), got)
		}
	}
}
