package settings

import (
	"context"
	"reflect"
	"testing"
)

func TestLoadDesktopDefaultsUntilSaved(t *testing.T) {
	store := memStore{}
	d, err := LoadDesktop(context.Background(), store)
	if err != nil || !reflect.DeepEqual(d, DefaultDesktop()) || !d.ShowWindowAtStart {
		t.Fatalf("LoadDesktop on an empty store = %+v, %v; want the window shown at start", d, err)
	}
	want := Desktop{
		ShowWindowAtStart: false,
		Windows:           map[string]WindowBounds{"main": {X: -1500, Y: 40, Width: 1280, Height: 800, Maximised: true}},
	}
	if err := SaveDesktop(context.Background(), store, want); err != nil {
		t.Fatalf("SaveDesktop: %v", err)
	}
	if d, err = LoadDesktop(context.Background(), store); err != nil || !reflect.DeepEqual(d, want) {
		t.Errorf("LoadDesktop after a save = %+v, %v; want %+v", d, err, want)
	}
}
