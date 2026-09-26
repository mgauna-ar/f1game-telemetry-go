package engineer

// AlertSwitchKeys lists the switches of the dashboard's radio settings panel: one master switch
// per alert group, then one switch per alert. The dashboard saves them as alert_switches, and the
// server turns them into the engine's EnabledCategories (EnabledCategoriesFromSwitches). The
// generated EngineerAlertSwitch union lets tsc check the panel's list against this one.
var AlertSwitchKeys = []string{
	"tyreAlertsEnabled",
	"thermalAlertsEnabled",
	"damageAlertsEnabled",
	"ersAlertsEnabled",
	"brakesAlertsEnabled",
	"fuelAlertsEnabled",
	"rivalAlertsEnabled",
	"pitWindowAlertsEnabled",
	"qualyAlertsEnabled",
	"flagsPensAlertsEnabled",
	"subTyreWear",
	"subTyrePuncture",
	"subTyreThermal",
	"subTyreCold",
	"subDamageWing",
	"subDamageFloor",
	"subDamageEngine",
	"subDamageFaults",
	"subErsLow",
	"subEngineTemp",
	"subBrakeTemp",
	"subBrakeCold",
	"subFuelDelta",
	"subUndercut",
	"subPitWindow",
	"subRivalDefend",
	"subRivalAttack",
	"subQualyTraffic",
	"subQualyInvalid",
	"subQualyTime",
	"subQualyElim",
	"subSafetyCar",
	"subRedFlag",
	"subRain",
	"subTrackLimits",
	"subPenalties",
}

// alertGate is one panel switch pair and the engine keys (categories, alert keys, directive IDs
// and sub-alerts) it turns off. A key is on only while its master switch and its alert switch are
// both on. Some alerts go by two names in the engine; both are listed here, once.
type alertGate struct {
	master string
	alert  string // empty: the master switch alone controls the keys
	keys   []string
}

var alertGates = []alertGate{
	{"tyreAlertsEnabled", "subTyreWear", []string{"tyre_wear"}},
	{"tyreAlertsEnabled", "subTyrePuncture", []string{"tyre_puncture"}},
	{"thermalAlertsEnabled", "subTyreThermal", []string{"tyre_thermal", "tyre_overheat"}},
	{"thermalAlertsEnabled", "subTyreCold", []string{"tyre_cold"}},
	{"damageAlertsEnabled", "", []string{"damage"}},
	{"damageAlertsEnabled", "subDamageWing", []string{"wing_damage", "damage_wing"}},
	{"damageAlertsEnabled", "subDamageFloor", []string{"floor_damage", "damage_floor"}},
	{"damageAlertsEnabled", "subDamageEngine", []string{"engine_wear", "damage_engine", "damage_gearbox_wear", "damage_ice_wear", "damage_terminal_engine"}},
	{"damageAlertsEnabled", "subDamageFaults", []string{"mechanical_fault", "damage_aero_fault", "damage_ers_fault"}},
	{"damageAlertsEnabled", "subEngineTemp", []string{"engine_temp"}},
	{"ersAlertsEnabled", "subErsLow", []string{"ers_low"}},
	{"brakesAlertsEnabled", "subBrakeTemp", []string{"brake_hot"}},
	{"brakesAlertsEnabled", "subBrakeCold", []string{"brake_cold"}},
	{"fuelAlertsEnabled", "subFuelDelta", []string{"fuel_delta"}},
	{"rivalAlertsEnabled", "subUndercut", []string{"undercut"}},
	{"rivalAlertsEnabled", "subRivalDefend", []string{"rival_defend"}},
	{"rivalAlertsEnabled", "subRivalAttack", []string{"rival_attack"}},
	{"pitWindowAlertsEnabled", "subPitWindow", []string{"pit_window"}},
	{"qualyAlertsEnabled", "subQualyInvalid", []string{"qualy_invalid"}},
	{"qualyAlertsEnabled", "subQualyTraffic", []string{"qualy_traffic"}},
	{"qualyAlertsEnabled", "subQualyTime", []string{"qualy_time"}},
	{"qualyAlertsEnabled", "subQualyElim", []string{"qualy_elim"}},
	{"flagsPensAlertsEnabled", "subSafetyCar", []string{"flags_sc"}},
	{"flagsPensAlertsEnabled", "subRedFlag", []string{"flags_red"}},
	{"flagsPensAlertsEnabled", "subRain", []string{"flags_rain", "flags_rain_live"}},
	{"flagsPensAlertsEnabled", "subTrackLimits", []string{"track_limits"}},
	{"flagsPensAlertsEnabled", "subPenalties", []string{"penalties"}},
}

// IsAlertSwitch reports whether key is one of AlertSwitchKeys.
func IsAlertSwitch(key string) bool {
	for _, k := range AlertSwitchKeys {
		if k == key {
			return true
		}
	}
	return false
}

// EnabledCategoriesFromSwitches turns the dashboard's alert switches into the engine's
// EnabledCategories. A switch missing from switches counts as on.
func EnabledCategoriesFromSwitches(switches map[string]bool) map[string]bool {
	on := func(key string) bool {
		if key == "" {
			return true
		}
		v, ok := switches[key]
		return !ok || v
	}
	enabled := make(map[string]bool)
	for _, g := range alertGates {
		for _, k := range g.keys {
			enabled[k] = on(g.master) && on(g.alert)
		}
	}
	return enabled
}
