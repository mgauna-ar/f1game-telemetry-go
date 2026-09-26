package engineer

import (
	"maps"
	"slices"
	"testing"
)

// dashboardEnabledCategories is the enabled_categories map the dashboard built before the server
// took over (buildEngineerConfigFromValues in frontend/src/store/useRadioSettingsStore.ts), copied
// line by line. It pins today's behaviour for EnabledCategoriesFromSwitches.
func dashboardEnabledCategories(v map[string]bool) map[string]bool {
	return map[string]bool{
		"tyre_wear":              v["tyreAlertsEnabled"] && v["subTyreWear"],
		"tyre_puncture":          v["tyreAlertsEnabled"] && v["subTyrePuncture"],
		"tyre_thermal":           v["thermalAlertsEnabled"] && v["subTyreThermal"],
		"tyre_overheat":          v["thermalAlertsEnabled"] && v["subTyreThermal"],
		"tyre_cold":              v["thermalAlertsEnabled"] && v["subTyreCold"],
		"wing_damage":            v["damageAlertsEnabled"] && v["subDamageWing"],
		"damage_wing":            v["damageAlertsEnabled"] && v["subDamageWing"],
		"floor_damage":           v["damageAlertsEnabled"] && v["subDamageFloor"],
		"damage_floor":           v["damageAlertsEnabled"] && v["subDamageFloor"],
		"engine_wear":            v["damageAlertsEnabled"] && v["subDamageEngine"],
		"damage_engine":          v["damageAlertsEnabled"] && v["subDamageEngine"],
		"mechanical_fault":       v["damageAlertsEnabled"] && v["subDamageFaults"],
		"damage_aero_fault":      v["damageAlertsEnabled"] && v["subDamageFaults"],
		"damage_ers_fault":       v["damageAlertsEnabled"] && v["subDamageFaults"],
		"damage_gearbox_wear":    v["damageAlertsEnabled"] && v["subDamageEngine"],
		"damage_ice_wear":        v["damageAlertsEnabled"] && v["subDamageEngine"],
		"damage_terminal_engine": v["damageAlertsEnabled"] && v["subDamageEngine"],
		"damage":                 v["damageAlertsEnabled"],
		"ers_low":                v["ersAlertsEnabled"] && v["subErsLow"],
		"engine_temp":            v["damageAlertsEnabled"] && v["subEngineTemp"],
		"brake_hot":              v["brakesAlertsEnabled"] && v["subBrakeTemp"],
		"brake_cold":             v["brakesAlertsEnabled"] && v["subBrakeCold"],
		"fuel_delta":             v["fuelAlertsEnabled"] && v["subFuelDelta"],
		"undercut":               v["rivalAlertsEnabled"] && v["subUndercut"],
		"pit_window":             v["pitWindowAlertsEnabled"] && v["subPitWindow"],
		"rival_defend":           v["rivalAlertsEnabled"] && v["subRivalDefend"],
		"rival_attack":           v["rivalAlertsEnabled"] && v["subRivalAttack"],
		"qualy_invalid":          v["qualyAlertsEnabled"] && v["subQualyInvalid"],
		"qualy_traffic":          v["qualyAlertsEnabled"] && v["subQualyTraffic"],
		"qualy_time":             v["qualyAlertsEnabled"] && v["subQualyTime"],
		"qualy_elim":             v["qualyAlertsEnabled"] && v["subQualyElim"],
		"flags_sc":               v["flagsPensAlertsEnabled"] && v["subSafetyCar"],
		"flags_red":              v["flagsPensAlertsEnabled"] && v["subRedFlag"],
		"flags_rain":             v["flagsPensAlertsEnabled"] && v["subRain"],
		"flags_rain_live":        v["flagsPensAlertsEnabled"] && v["subRain"],
		"track_limits":           v["flagsPensAlertsEnabled"] && v["subTrackLimits"],
		"penalties":              v["flagsPensAlertsEnabled"] && v["subPenalties"],
	}
}

func allSwitches(on bool) map[string]bool {
	m := make(map[string]bool, len(AlertSwitchKeys))
	for _, k := range AlertSwitchKeys {
		m[k] = on
	}
	return m
}

func TestEnabledCategoriesFromSwitches_MatchesDashboard(t *testing.T) {
	cases := map[string]map[string]bool{
		"all on":  allSwitches(true),
		"all off": allSwitches(false),
	}
	for _, key := range AlertSwitchKeys {
		off := allSwitches(true)
		off[key] = false
		cases[key+" off"] = off

		on := allSwitches(false)
		on[key] = true
		cases["only "+key+" on"] = on
	}
	// Each alert switch with its master switch on, everything else off.
	for _, g := range alertGates {
		sw := allSwitches(false)
		sw[g.master] = true
		if g.alert != "" {
			sw[g.alert] = true
		}
		cases["only "+g.master+"+"+g.alert+" on"] = sw
	}

	for name, switches := range cases {
		t.Run(name, func(t *testing.T) {
			got := EnabledCategoriesFromSwitches(switches)
			want := dashboardEnabledCategories(switches)
			if !maps.Equal(got, want) {
				for k := range want {
					if got[k] != want[k] {
						t.Errorf("%s: got %v, want %v", k, got[k], want[k])
					}
				}
				for k := range got {
					if _, ok := want[k]; !ok {
						t.Errorf("unexpected key %s", k)
					}
				}
			}
		})
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
