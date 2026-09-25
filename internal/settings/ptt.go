package settings

import (
	"context"
	"fmt"

	"github.com/mgauna/f1game-telemetry-go/internal/input"
)

const pttSettingsKey = "ptt_settings"

// Push-to-talk modes.
const (
	PTTModeHold   = "hold"
	PTTModeToggle = "toggle"
)

// Names the dashboard shows for push-to-talk devices, and its key name for "no key".
const (
	noKeyName          = "None"
	gamepadDeviceName  = "Controller / Wheel"
	keyboardDeviceName = "Keyboard"
)

// PTT is the push-to-talk setup: how the talk button behaves and which key or wheel button is it.
type PTT struct {
	Mode        string         `json:"mode"`
	KeyboardKey string         `json:"keyboard_key"`       // dashboard key name; "" or "None" means no key
	KeyCode     int            `json:"key_code,omitempty"` // Windows virtual-key code for the in-game hotkey
	Gamepad     *GamepadButton `json:"gamepad,omitempty"`
}

// GamepadButton is a wheel or controller button.
type GamepadButton struct {
	GamepadIndex int `json:"gamepad_index"`
	ButtonIndex  int `json:"button_index"`
}

// Validate reports settings the input manager can't use.
func (p PTT) Validate() error {
	if p.Mode != "" && p.Mode != PTTModeHold && p.Mode != PTTModeToggle {
		return fmt.Errorf("unknown push-to-talk mode %q", p.Mode)
	}
	if p.KeyCode < 0 {
		return fmt.Errorf("key code must not be negative, got %d", p.KeyCode)
	}
	if p.Gamepad != nil && (p.Gamepad.GamepadIndex < 0 || p.Gamepad.ButtonIndex < 0) {
		return fmt.Errorf("gamepad and button index must not be negative")
	}
	return nil
}

// Mappings returns the joystick and keyboard mappings for the input manager. A mapping with no
// button or key clears that slot, so applying both replaces the whole push-to-talk setup.
func (p PTT) Mappings() (joystick, keyboard input.Mapping) {
	joystick = input.Mapping{DeviceType: input.DeviceTypeJoystick, DeviceIndex: -1, ButtonIndex: -1}
	if p.Gamepad != nil {
		joystick.DeviceIndex = p.Gamepad.GamepadIndex
		joystick.ButtonIndex = p.Gamepad.ButtonIndex
		joystick.KeyName = fmt.Sprintf("Button %d", p.Gamepad.ButtonIndex+1)
		joystick.DeviceName = gamepadDeviceName
	}

	keyboard = input.Mapping{DeviceType: input.DeviceTypeKeyboard, KeyName: noKeyName, DeviceName: keyboardDeviceName}
	if p.KeyboardKey != "" && p.KeyboardKey != noKeyName {
		keyboard.KeyName = p.KeyboardKey
		keyboard.KeyCode = p.KeyCode
	}
	return joystick, keyboard
}

// MappingSetter is the part of input.Manager that Apply uses.
type MappingSetter interface {
	SetMapping(m input.Mapping)
}

// Apply sets both push-to-talk mappings on the input manager.
func (p PTT) Apply(mgr MappingSetter) {
	joystick, keyboard := p.Mappings()
	mgr.SetMapping(joystick)
	mgr.SetMapping(keyboard)
}

// LoadPTT returns the saved push-to-talk settings, and false when none were saved yet.
func LoadPTT(ctx context.Context, store Store) (PTT, bool, error) {
	var p PTT
	ok, err := load(ctx, store, pttSettingsKey, &p)
	return p, ok, err
}

// SavePTT stores the push-to-talk settings.
func SavePTT(ctx context.Context, store Store, p PTT) error {
	return save(ctx, store, pttSettingsKey, p)
}
