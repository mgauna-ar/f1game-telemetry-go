package engineer

import (
	"maps"
	"slices"
	"testing"
)

func allSwitches(on bool) map[string]bool {
	m := make(map[string]bool, len(AlertSwitchKeys))
	for _, k := range AlertSwitchKeys {
		m[k] = on
	}
	return m
}

func TestEnabledCategoriesFromSwitches_NeedsMasterAndAlertSwitch(t *testing.T) {
	for _, g := range alertGates {
		t.Run(g.master+"/"+g.alert, func(t *testing.T) {
			if got := EnabledCategoriesFromSwitches(allSwitches(true)); !allKeysAre(got, g.keys, true) {
				t.Errorf("all switches on: %v should be on, got %v", g.keys, got)
			}
			masterOff := allSwitches(true)
			masterOff[g.master] = false
			if got := EnabledCategoriesFromSwitches(masterOff); !allKeysAre(got, g.keys, false) {
				t.Errorf("%s off: %v should be off", g.master, g.keys)
			}
			if g.alert == "" {
				return
			}
			alertOff := allSwitches(true)
			alertOff[g.alert] = false
			if got := EnabledCategoriesFromSwitches(alertOff); !allKeysAre(got, g.keys, false) {
				t.Errorf("%s off: %v should be off", g.alert, g.keys)
			}
			only := allSwitches(false)
			only[g.master] = true
			only[g.alert] = true
			if got := EnabledCategoriesFromSwitches(only); !allKeysAre(got, g.keys, true) {
				t.Errorf("only %s and %s on: %v should be on", g.master, g.alert, g.keys)
			}
		})
	}
}

func allKeysAre(enabled map[string]bool, keys []string, want bool) bool {
	for _, k := range keys {
		if v, ok := enabled[k]; !ok || v != want {
			return false
		}
	}
	return true
}

// Every call a rule can make has exactly one switch on the panel, apart from the few that are
// always on, so nothing the engineer says can't be turned off from the dashboard.
func TestAlertGates_CoverEveryAlertKey(t *testing.T) {
	gatesOf := make(map[string][]string)
	for _, g := range alertGates {
		for _, k := range g.keys {
			gatesOf[k] = append(gatesOf[k], g.master+"/"+g.alert)
		}
	}
	engine := NewEngineerEngine(nil)
	for key, rule := range engine.alertRules {
		if slices.Contains(AlwaysOnAlertKeys, key) {
			if len(gatesOf[key]) > 0 {
				t.Errorf("%s is always on but has switches %v", key, gatesOf[key])
			}
			continue
		}
		switch n := len(gatesOf[key]); {
		case n == 0:
			t.Errorf("%s has no switch", key)
			continue
		case n > 1:
			t.Errorf("%s has %d switches: %v", key, n, gatesOf[key])
		}

		// Turning off the alert's own switch silences it in the engine.
		for _, g := range alertGates {
			if g.alert == "" || !slices.Contains(g.keys, key) {
				continue
			}
			sw := allSwitches(true)
			sw[g.alert] = false
			cfg := DefaultEngineerConfig()
			cfg.EnabledCategories = EnabledCategoriesFromSwitches(sw)
			if cfg.IsAlertEnabled(string(rule.Category), key) {
				t.Errorf("%s stays on with %s off", key, g.alert)
			}
		}
	}
	for _, k := range AlwaysOnAlertKeys {
		if _, ok := engine.alertRules[k]; !ok {
			t.Errorf("always-on key %s is no rule's alert key", k)
		}
	}
}

func TestEnabledCategoriesFromSwitches_EverySwitchMatters(t *testing.T) {
	allOn := EnabledCategoriesFromSwitches(allSwitches(true))
	for _, key := range AlertSwitchKeys {
		sw := allSwitches(true)
		sw[key] = false
		if maps.Equal(EnabledCategoriesFromSwitches(sw), allOn) {
			t.Errorf("turning %s off changes nothing", key)
		}
	}
}

func TestEnabledCategoriesFromSwitches_MissingSwitchIsOn(t *testing.T) {
	want := EnabledCategoriesFromSwitches(allSwitches(true))
	if got := EnabledCategoriesFromSwitches(nil); !maps.Equal(got, want) {
		t.Errorf("nil switches: got %v, want all on %v", got, want)
	}
	partial := map[string]bool{"subTyreWear": false}
	if EnabledCategoriesFromSwitches(partial)["tyre_wear"] {
		t.Error("tyre_wear should be off when subTyreWear is off")
	}
	if !EnabledCategoriesFromSwitches(partial)["tyre_puncture"] {
		t.Error("tyre_puncture should stay on when its switches are missing")
	}
}

func TestAlertGates_UseKnownSwitches(t *testing.T) {
	used := make(map[string]bool)
	for _, g := range alertGates {
		used[g.master] = true
		if g.alert != "" {
			used[g.alert] = true
		}
	}
	for k := range used {
		if !IsAlertSwitch(k) {
			t.Errorf("alertGates uses %q, which is not in AlertSwitchKeys", k)
		}
	}
	for _, k := range AlertSwitchKeys {
		if !used[k] {
			t.Errorf("AlertSwitchKeys has %q, which no alert gate uses", k)
		}
	}
	sorted := slices.Clone(AlertSwitchKeys)
	slices.Sort(sorted)
	if len(slices.Compact(sorted)) != len(AlertSwitchKeys) {
		t.Error("AlertSwitchKeys has duplicates")
	}
}
