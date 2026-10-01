package settings

import (
	"context"
	"strings"
	"testing"
)

func TestComparatorNormalizeAndValidate(t *testing.T) {
	c := Comparator{RivalDriverName: "  Norris  "}
	c.Normalize()
	if c.RivalMode != RivalModeFastest || c.RivalDriverName != "Norris" {
		t.Errorf("Normalize() = %+v, want fastest and the trimmed name", c)
	}
	for _, mode := range RivalModes {
		if err := (Comparator{RivalMode: mode}).Validate(); err != nil {
			t.Errorf("Validate(%q) = %v, want nil", mode, err)
		}
	}
	invalid := []Comparator{{RivalMode: "slowest"}, {RivalMode: RivalModeDriver, RivalDriverName: strings.Repeat("x", maxRivalDriverNameLen+1)}}
	for _, c := range invalid {
		if err := c.Validate(); err == nil {
			t.Errorf("Validate(%+v) = nil, want an error", c)
		}
	}
}

func TestLoadComparatorDefaultsUntilSaved(t *testing.T) {
	store := memStore{}
	c, ok, err := LoadComparator(context.Background(), store)
	if err != nil || ok || c != DefaultComparator() {
		t.Fatalf("LoadComparator on an empty store = %+v, %v, %v; want the defaults, not saved", c, ok, err)
	}
	want := Comparator{RivalMode: RivalModeDriver, RivalDriverName: "#4"}
	if err := SaveComparator(context.Background(), store, want); err != nil {
		t.Fatalf("SaveComparator: %v", err)
	}
	if c, ok, err = LoadComparator(context.Background(), store); err != nil || !ok || c != want {
		t.Errorf("LoadComparator after a save = %+v, %v, %v; want %+v, saved", c, ok, err, want)
	}
}
