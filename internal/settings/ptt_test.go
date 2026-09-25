package settings

import (
	"context"
	"testing"

	"github.com/mgauna/f1game-telemetry-go/internal/input"
)

type recordingManager struct {
	set []input.Mapping
}

func (m *recordingManager) SetMapping(mapping input.Mapping) { m.set = append(m.set, mapping) }

func TestPTTApply_SetsBothSlots(t *testing.T) {
	ptt := PTT{Mode: PTTModeToggle, KeyboardKey: "F12", KeyCode: 0x7B, Gamepad: &GamepadButton{GamepadIndex: 1, ButtonIndex: 4}}
	mgr := &recordingManager{}
	ptt.Apply(mgr)

	if len(mgr.set) != 2 {
		t.Fatalf("SetMapping called %d times, want 2", len(mgr.set))
	}
	joy, key := mgr.set[0], mgr.set[1]
	if joy.DeviceType != input.DeviceTypeJoystick || joy.DeviceIndex != 1 || joy.ButtonIndex != 4 || joy.KeyName != "Button 5" {
		t.Errorf("joystick mapping = %+v", joy)
	}
	if key.DeviceType != input.DeviceTypeKeyboard || key.KeyCode != 0x7B || key.KeyName != "F12" {
		t.Errorf("keyboard mapping = %+v", key)
	}
}

func TestPTTApply_ClearsUnsetSlotsOnARealManager(t *testing.T) {
	mgr := input.NewBaseManager()
	PTT{KeyboardKey: "T", KeyCode: 0x54, Gamepad: &GamepadButton{GamepadIndex: 0, ButtonIndex: 2}}.Apply(mgr)
	if got := mgr.GetMapping(); got.DeviceType != input.DeviceTypeJoystick {
		t.Fatalf("with a wheel button saved, the primary mapping = %+v, want the joystick", got)
	}

	PTT{KeyboardKey: "T", KeyCode: 0x54}.Apply(mgr)
	if got := mgr.GetMapping(); got.DeviceType != input.DeviceTypeKeyboard || got.KeyCode != 0x54 {
		t.Fatalf("after removing the wheel button, mapping = %+v, want the T key", got)
	}

	PTT{KeyboardKey: "None"}.Apply(mgr)
	if got := mgr.GetMapping(); got.DeviceType != input.DeviceTypeNone {
		t.Fatalf("with nothing saved, mapping = %+v, want none", got)
	}
}

func TestPTTValidate(t *testing.T) {
	valid := []PTT{{}, {Mode: PTTModeHold}, {Mode: PTTModeToggle, KeyboardKey: "Space", KeyCode: 0x20}, {Gamepad: &GamepadButton{}}}
	for _, p := range valid {
		if err := p.Validate(); err != nil {
			t.Errorf("Validate(%+v) = %v, want nil", p, err)
		}
	}
	invalid := []PTT{{Mode: "shout"}, {KeyCode: -1}, {Gamepad: &GamepadButton{GamepadIndex: -1}}, {Gamepad: &GamepadButton{ButtonIndex: -1}}}
	for _, p := range invalid {
		if err := p.Validate(); err == nil {
			t.Errorf("Validate(%+v) = nil, want an error", p)
		}
	}
}

func TestLoadSavePTTAndVoice(t *testing.T) {
	ctx := context.Background()
	store := memStore{}

	if _, ok, _ := LoadPTT(ctx, store); ok {
		t.Error("LoadPTT on an empty store must report not saved")
	}
	if _, ok, _ := LoadVoice(ctx, store); ok {
		t.Error("LoadVoice on an empty store must report not saved")
	}

	ptt := PTT{Mode: PTTModeToggle, KeyboardKey: "F12", KeyCode: 0x7B, Gamepad: &GamepadButton{GamepadIndex: 0, ButtonIndex: 3}}
	voice := Voice{Persona: "colapinto", Language: "es", DriverCallsign: "Mati", SpeechRate: 10, SpeechPitch: -5}
	if err := SavePTT(ctx, store, ptt); err != nil {
		t.Fatalf("SavePTT: %v", err)
	}
	if err := SaveVoice(ctx, store, voice); err != nil {
		t.Fatalf("SaveVoice: %v", err)
	}

	gotPTT, ok, err := LoadPTT(ctx, store)
	if err != nil || !ok || gotPTT.Mode != ptt.Mode || gotPTT.KeyCode != ptt.KeyCode || gotPTT.Gamepad == nil || *gotPTT.Gamepad != *ptt.Gamepad {
		t.Errorf("LoadPTT = %+v ok %v err %v, want %+v", gotPTT, ok, err, ptt)
	}
	gotVoice, ok, err := LoadVoice(ctx, store)
	if err != nil || !ok || gotVoice != voice {
		t.Errorf("LoadVoice = %+v ok %v err %v, want %+v", gotVoice, ok, err, voice)
	}
}
