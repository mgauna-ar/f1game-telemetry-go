package engineer

// AlertSwitchKeys lists the switches of the dashboard's radio settings panel: one master switch
// per panel section, then one switch per alert. The dashboard saves them as alert_switches, and the
// server turns them into the engine's EnabledCategories (EnabledCategoriesFromSwitches). The
// generated EngineerAlertSwitch union lets tsc check the panel's list against this one.
var AlertSwitchKeys = []string{
	"tyreAlertsEnabled",
	"damageAlertsEnabled",
	"ersAlertsEnabled",
	"brakesAlertsEnabled",
	"fuelAlertsEnabled",
	"rivalAlertsEnabled",
	"pitAlertsEnabled",
	"coachingAlertsEnabled",
	"teammateAlertsEnabled",
	"qualyAlertsEnabled",
	"flagsPensAlertsEnabled",
	"subTyreWear",
	"subTyrePuncture",
	"subTyreThermal",
	"subTyreCold",
	"subTyreCondition",
	"subTyreCrossover",
	"subDamageWing",
	"subDamageFloor",
	"subDamageEngine",
	"subDamageFaults",
	"subEngineTemp",
	"subErsLow",
	"subErsClipping",
	"subAeroZones",
	"subBrakeTemp",
	"subBrakeCold",
	"subBrakeBias",
	"subFuelDelta",
	"subFuelMix",
	"subUndercut",
	"subRivalDefend",
	"subRivalAttack",
	"subPitWindow",
	"subPitWindowClose",
	"subPitCleanAir",
	"subTyreSet",
	"subPitLane",
	"subSectorDelta",
	"subStartProcedure",
	"subInlapCooldown",
	"subTeammateAhead",
	"subTeammatePit",
	"subQualyTraffic",
	"subQualyInvalid",
	"subQualyTime",
	"subQualyElim",
	"subSafetyCar",
	"subRedFlag",
	"subRain",
	"subTrackLimits",
	"subPenalties",
	"subFlags",
	"subRaceEvents",
}

// AlwaysOnAlertKeys are the calls no switch turns off: driving the wrong way, and the chequered
// flag.
var AlwaysOnAlertKeys = []string{"warning_wrong_way", "race_finish"}

// alertGate is one panel switch pair and the engine keys (categories, alert keys, directive IDs
// and sub-alerts) it turns off. A key is on only while its master switch and its alert switch are
// both on. The master is the switch of the panel section the alert is drawn in. Some alerts go by
// two names in the engine; both are listed here, once.
type alertGate struct {
	master string
	alert  string // empty: the master switch alone controls the keys
	keys   []string
}

var alertGates = []alertGate{
	{"tyreAlertsEnabled", "subTyreWear", []string{"tyre_wear"}},
	{"tyreAlertsEnabled", "subTyrePuncture", []string{"tyre_puncture"}},
	{"tyreAlertsEnabled", "subTyreThermal", []string{"tyre_thermal", "tyre_overheat"}},
	{"tyreAlertsEnabled", "subTyreCold", []string{"tyre_cold"}},
	{"tyreAlertsEnabled", "subTyreCondition", []string{"tyre_blistering", "tyre_pressure_high"}},
	{"tyreAlertsEnabled", "subTyreCrossover", []string{"tyre_crossover", "tyre_crossover_inter", "tyre_crossover_wet"}},
	{"damageAlertsEnabled", "", []string{"damage"}},
	{"damageAlertsEnabled", "subDamageWing", []string{"wing_damage", "damage_wing"}},
	{"damageAlertsEnabled", "subDamageFloor", []string{"floor_damage", "damage_floor"}},
	{"damageAlertsEnabled", "subDamageEngine", []string{"engine_wear", "damage_engine", "damage_gearbox_wear", "damage_ice_wear", "damage_terminal_engine"}},
	{"damageAlertsEnabled", "subDamageFaults", []string{"mechanical_fault", "damage_aero_fault", "damage_ers_fault"}},
	{"damageAlertsEnabled", "subEngineTemp", []string{"engine_temp"}},
	{"ersAlertsEnabled", "subErsLow", []string{"ers_low"}},
	{"ersAlertsEnabled", "subErsClipping", []string{"ers_clipping"}},
	{"ersAlertsEnabled", "subAeroZones", []string{"aero_straight_anticipation", "overtake_boost_anticipation"}},
	{"brakesAlertsEnabled", "subBrakeTemp", []string{"brake_hot"}},
	{"brakesAlertsEnabled", "subBrakeCold", []string{"brake_cold"}},
	{"brakesAlertsEnabled", "subBrakeBias", []string{"brake_bias", "brake_bias_ok"}},
	{"fuelAlertsEnabled", "subFuelDelta", []string{"fuel_delta"}},
	{"fuelAlertsEnabled", "subFuelMix", []string{"fuel_mix_neutralized", "fuel_mix_restart"}},
	{"rivalAlertsEnabled", "subUndercut", []string{"undercut"}},
	{"rivalAlertsEnabled", "subRivalDefend", []string{"rival_defend", "rival_defend_override"}},
	{"rivalAlertsEnabled", "subRivalAttack", []string{"rival_attack", "rival_attack_override"}},
	{"pitAlertsEnabled", "subPitWindow", []string{"pit_window"}},
	{"pitAlertsEnabled", "subPitWindowClose", []string{"pit_window_close"}},
	{"pitAlertsEnabled", "subPitCleanAir", []string{"pit_clean_air"}},
	{"pitAlertsEnabled", "subTyreSet", []string{"tyre_set_advisory"}},
	{"pitAlertsEnabled", "subPitLane", []string{"pit_limiter_exit", "pit_limiter_overspeed", "pit_serve_penalty", "pit_stop_duration"}},
	{"coachingAlertsEnabled", "subSectorDelta", []string{"coaching_s1", "coaching_s2", "coaching_s3"}},
	{"coachingAlertsEnabled", "subStartProcedure", []string{"formation_lap_start", "grid_approach", "start_reaction_time"}},
	{"coachingAlertsEnabled", "subInlapCooldown", []string{"inlap_cooldown"}},
	{"teammateAlertsEnabled", "subTeammateAhead", []string{"teammate_ahead"}},
	{"teammateAlertsEnabled", "subTeammatePit", []string{"teammate_pitting", "teammate_doublestack"}},
	{"qualyAlertsEnabled", "subQualyInvalid", []string{"qualy_invalid"}},
	{"qualyAlertsEnabled", "subQualyTraffic", []string{"qualy_traffic", "inlap_traffic_behind"}},
	{"qualyAlertsEnabled", "subQualyTime", []string{"qualy_time"}},
	{"qualyAlertsEnabled", "subQualyElim", []string{"qualy_elim"}},
	{"flagsPensAlertsEnabled", "subSafetyCar", []string{"flags_sc"}},
	{"flagsPensAlertsEnabled", "subRedFlag", []string{"flags_red"}},
	{"flagsPensAlertsEnabled", "subRain", []string{"flags_rain", "flags_rain_live"}},
	{"flagsPensAlertsEnabled", "subTrackLimits", []string{"track_limits"}},
	{"flagsPensAlertsEnabled", "subPenalties", []string{"penalties"}},
	{"flagsPensAlertsEnabled", "subFlags", []string{"flags_blue", "flags_yellow", "flags_green", "flags_sc_in", "flags_drs_enabled", "flags_drs_disabled"}},
	{"flagsPensAlertsEnabled", "subRaceEvents", []string{"car_collision", "car_retirement", "race_fastest_lap"}},
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
