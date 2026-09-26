package settings

import (
	"context"
	"errors"
	"fmt"
	"maps"

	"github.com/mgauna/f1game-telemetry-go/internal/engineer"
)

// engineerSettingsKey is the settings row the race engineer setup has always been saved under.
const engineerSettingsKey = "engineer_config"

// ErrVersionConflict means the engineer settings were saved from another device after the client
// loaded them. The client reloads them instead of overwriting the newer copy.
var ErrVersionConflict = errors.New("the race engineer settings were changed on another device")

// Engineer is the race engineer setup the driver picks in the radio settings panel: radio spacing,
// alert thresholds, the trigger preset and every alert switch. The server turns it into the
// engine's config (EngineConfig); the values only the server sets never appear here.
type Engineer struct {
	// Version goes up by one on every save. A save must carry the version it was based on.
	Version int64 `json:"version"`
	engineer.Tuning
	TriggerPreset string `json:"trigger_preset"`
	// AlertSwitches holds the panel's switches, keyed by engineer.AlertSwitchKeys. A missing
	// switch counts as on.
	AlertSwitches map[string]bool `json:"alert_switches,omitempty"`
}

// DefaultEngineer returns the built-in race engineer setup: default thresholds, every alert on.
func DefaultEngineer() Engineer {
	return Engineer{Tuning: engineer.DefaultTuning()}
}

// Clone returns a copy that shares no map with e. A save decodes the request on top of a clone of
// the saved setup, so fields the request leaves out keep their value.
func (e Engineer) Clone() Engineer {
	e.AlertSwitches = maps.Clone(e.AlertSwitches)
	return e
}

// EngineConfig is the config the engine runs with for this setup. The server-owned values
// (global radio spacing, critical wing damage, qualifying time warning) always come from
// engineer.DefaultEngineerConfig, and the enabled categories from the alert switches.
func (e Engineer) EngineConfig() engineer.EngineerConfig {
	cfg := engineer.DefaultEngineerConfig()
	cfg.Tuning = e.Tuning
	cfg.EnabledCategories = engineer.EnabledCategoriesFromSwitches(e.AlertSwitches)
	return cfg
}

// Apply checks an update against the saved setup e and returns the setup to save: the update with
// the next version. It fails with ErrVersionConflict when the update was based on another version.
func (e Engineer) Apply(update Engineer) (Engineer, error) {
	if update.Version != e.Version {
		return Engineer{}, ErrVersionConflict
	}
	for key := range update.AlertSwitches {
		if !engineer.IsAlertSwitch(key) {
			return Engineer{}, fmt.Errorf("unknown alert switch %q", key)
		}
	}
	next := update.Clone()
	next.Version = e.Version + 1
	return next, nil
}

// LoadEngineer returns the saved race engineer setup on top of the defaults, so fields added after
// it was saved keep their default value. It reports false when none was saved yet.
func LoadEngineer(ctx context.Context, store Store) (Engineer, bool, error) {
	// Setups saved before the panel stored its switches only have the engine's enabled categories.
	var doc struct {
		Engineer
		EnabledCategories map[string]bool `json:"enabled_categories"`
	}
	doc.Engineer = DefaultEngineer()
	ok, err := load(ctx, store, engineerSettingsKey, &doc)
	if err != nil || !ok {
		return DefaultEngineer(), false, err
	}
	if doc.AlertSwitches == nil && doc.EnabledCategories != nil {
		doc.AlertSwitches = alertSwitchesFromLegacyCategories(doc.EnabledCategories)
	}
	return doc.Engineer, true, nil
}

// SaveEngineer stores the race engineer setup.
func SaveEngineer(ctx context.Context, store Store, e Engineer) error {
	return save(ctx, store, engineerSettingsKey, e)
}

// alertSwitchesFromLegacyCategories restores the alert switches of a setup saved before they were
// stored. Those setups only kept "group switch AND alert switch" per engine key, so the group
// switches can't be recovered; only the alert switches are.
func alertSwitchesFromLegacyCategories(ec map[string]bool) map[string]bool {
	switches := make(map[string]bool)
	// Each switch reads the first of its engine keys that was saved.
	legacyKeys := []struct {
		alertSwitch string
		keys        []string
	}{
		{"subTyreWear", []string{"tyre_wear"}},
		{"subTyrePuncture", []string{"tyre_puncture"}},
		{"subTyreThermal", []string{"tyre_overheat", "tyre_thermal"}},
		{"subTyreCold", []string{"tyre_cold"}},
		{"subDamageWing", []string{"damage_wing", "wing_damage"}},
		{"subDamageFloor", []string{"damage_floor", "floor_damage"}},
		{"subDamageEngine", []string{"damage_engine", "engine_wear"}},
		{"subDamageFaults", []string{"damage_aero_fault", "mechanical_fault"}},
		{"subErsLow", []string{"ers_low"}},
		{"subEngineTemp", []string{"engine_temp"}},
		{"subBrakeTemp", []string{"brake_hot"}},
		{"subBrakeCold", []string{"brake_cold"}},
		{"subFuelDelta", []string{"fuel_delta"}},
		{"subUndercut", []string{"undercut"}},
		{"subPitWindow", []string{"pit_window"}},
		{"subRivalDefend", []string{"rival_defend"}},
		{"subRivalAttack", []string{"rival_attack"}},
		{"subQualyInvalid", []string{"qualy_invalid"}},
		{"subQualyTraffic", []string{"qualy_traffic"}},
		{"subQualyTime", []string{"qualy_time"}},
		{"subQualyElim", []string{"qualy_elim"}},
		{"subSafetyCar", []string{"flags_sc"}},
		{"subRedFlag", []string{"flags_red"}},
		{"subRain", []string{"flags_rain", "flags_rain_live"}},
		{"subTrackLimits", []string{"track_limits"}},
		{"subPenalties", []string{"penalties"}},
	}
	for _, l := range legacyKeys {
		for _, k := range l.keys {
			if v, ok := ec[k]; ok {
				switches[l.alertSwitch] = v
				break
			}
		}
	}
	return switches
}
