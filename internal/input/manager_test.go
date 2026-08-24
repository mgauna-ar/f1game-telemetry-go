package input

import (
	"testing"
	"time"
)

func TestBaseManager_SetAndGetMapping(t *testing.T) {
	bm := NewBaseManager()

	initial := bm.GetMapping()
	if initial.DeviceType != DeviceTypeKeyboard || initial.KeyName != "Space" {
		t.Errorf("Expected initial mapping to be Space, got %+v", initial)
	}

	custom := Mapping{
		DeviceType:  DeviceTypeJoystick,
		DeviceIndex: 0,
		ButtonIndex: 4,
		KeyName:     "Button 5",
		DeviceName:  "Fanatec CSL DD",
	}

	bm.SetMapping(custom)
	got := bm.GetMapping()
	if got.DeviceType != custom.DeviceType || got.DeviceName != custom.DeviceName || got.ButtonIndex != custom.ButtonIndex {
		t.Errorf("Expected custom mapping %+v, got %+v", custom, got)
	}
}

func TestBaseManager_EmitEvent(t *testing.T) {
	bm := NewBaseManager()

	bm.EmitEvent("down")

	select {
	case evt := <-bm.Events():
		if evt.State != "down" {
			t.Errorf("Expected event state down, got %s", evt.State)
		}
		if evt.Mapping.KeyName != "Space" {
			t.Errorf("Expected mapping Space, got %s", evt.Mapping.KeyName)
		}
		if evt.Timestamp <= 0 {
			t.Errorf("Expected non-zero timestamp, got %d", evt.Timestamp)
		}
	case <-time.After(100 * time.Millisecond):
		t.Fatal("Timeout waiting for event on channel")
	}
}

func TestNewManager_Instantiate(t *testing.T) {
	mgr := NewManager()
	if mgr == nil {
		t.Fatal("Expected non-nil manager instance")
	}
	m := mgr.GetMapping()
	if m.KeyName == "" {
		t.Error("Expected default key name to be populated")
	}
}
