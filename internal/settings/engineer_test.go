package settings

import (
	"context"
	"errors"
	"maps"
	"testing"

	"github.com/mgauna/f1game-telemetry-go/internal/engineer"
)

func TestLoadEngineer_DefaultsWhenNothingSaved(t *testing.T) {
	got, saved, err := LoadEngineer(context.Background(), memStore{})
	if err != nil {
		t.Fatalf("LoadEngineer: %v", err)
	}
	if saved {
		t.Error("saved = true on an empty store")
	}
	if got.Tuning != engineer.DefaultTuning() || got.Version != 0 || got.AlertSwitches != nil {
		t.Errorf("got %+v, want the defaults", got)
	}
}

func TestLoadEngineer_ReadError(t *testing.T) {
	if _, _, err := LoadEngineer(context.Background(), failingStore{}); err == nil {
		t.Fatal("expected the store error")
	}
}

func TestSaveEngineer_RoundTrip(t *testing.T) {
	ctx := context.Background()
	store := memStore{}
	e := DefaultEngineer()
	e.Version = 3
	e.TyreWearWarnPct = 48.5
	e.ChatterCooldownMs = 30000
	e.TriggerPreset = "minimal"
	e.AlertSwitches = map[string]bool{"tyreAlertsEnabled": false, "subTyrePuncture": true}

	if err := SaveEngineer(ctx, store, e); err != nil {
		t.Fatalf("SaveEngineer: %v", err)
	}
	got, saved, err := LoadEngineer(ctx, store)
	if err != nil || !saved {
		t.Fatalf("LoadEngineer: saved=%v err=%v", saved, err)
	}
	if got.Version != 3 || got.Tuning != e.Tuning || got.TriggerPreset != "minimal" || !maps.Equal(got.AlertSwitches, e.AlertSwitches) {
		t.Errorf("got %+v, want %+v", got, e)
	}
}

func TestLoadEngineer_FieldsMissingFromOlderSavesKeepDefaults(t *testing.T) {
	store := memStore{engineerSettingsKey: `{"chatter_cooldown_ms":30000,"tyre_wear_warn_pct":48,"alert_switches":{"subTyreWear":false}}`}
	got, _, err := LoadEngineer(context.Background(), store)
	if err != nil {
		t.Fatalf("LoadEngineer: %v", err)
	}
	defaults := engineer.DefaultTuning()
	if got.ChatterCooldownMs != 30000 || got.TyreWearWarnPct != 48 {
		t.Errorf("saved values lost: %+v", got.Tuning)
	}
	if got.BrakeOverheatC != defaults.BrakeOverheatC || got.RainProbPct != defaults.RainProbPct {
		t.Errorf("missing fields should keep their defaults, got %+v", got.Tuning)
	}
}

func TestLoadEngineer_MigratesSetupsWithoutAlertSwitches(t *testing.T) {
	// Saved before the panel stored its switches: only the engine's categories, both alias names.
	store := memStore{engineerSettingsKey: `{"enabled_categories":{"tyre_wear":false,"tyre_puncture":true,"tyre_thermal":false,"wing_damage":false,"flags_rain_live":false,"damage":false}}`}
	got, saved, err := LoadEngineer(context.Background(), store)
	if err != nil || !saved {
		t.Fatalf("LoadEngineer: saved=%v err=%v", saved, err)
	}
	want := map[string]bool{
		"subTyreWear":     false,
		"subTyrePuncture": true,
		"subTyreThermal":  false,
		"subDamageWing":   false,
		"subRain":         false,
	}
	if !maps.Equal(got.AlertSwitches, want) {
		t.Errorf("alert switches = %v, want %v", got.AlertSwitches, want)
	}
}

func TestLoadEngineer_DropsRetiredMasterSwitches(t *testing.T) {
	tests := []struct {
		name  string
		saved string
		want  map[string]bool
	}{
		{
			name:  "hidden masters off keep their alerts silent",
			saved: `{"alert_switches":{"thermalAlertsEnabled":false,"pitWindowAlertsEnabled":false,"subTyreThermal":true,"subTyreCold":true,"subPitWindow":true,"subTyreWear":true}}`,
			want:  map[string]bool{"subTyreThermal": false, "subTyreCold": false, "subPitWindow": false, "subTyreWear": true},
		},
		{
			name:  "hidden masters on leave their alerts as they were",
			saved: `{"alert_switches":{"thermalAlertsEnabled":true,"pitWindowAlertsEnabled":true,"subTyreThermal":false,"subTyreCold":true,"subPitWindow":true}}`,
			want:  map[string]bool{"subTyreThermal": false, "subTyreCold": true, "subPitWindow": true},
		},
		{
			name:  "unknown switches are dropped",
			saved: `{"alert_switches":{"subSomethingOld":false,"subRain":false}}`,
			want:  map[string]bool{"subRain": false},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, _, err := LoadEngineer(context.Background(), memStore{engineerSettingsKey: tt.saved})
			if err != nil {
				t.Fatalf("LoadEngineer: %v", err)
			}
			if !maps.Equal(got.AlertSwitches, tt.want) {
				t.Errorf("alert switches = %v, want %v", got.AlertSwitches, tt.want)
			}
			// The setup must still save: Apply rejects switches the panel doesn't have.
			if _, err := got.Apply(got); err != nil {
				t.Errorf("Apply after load: %v", err)
			}
		})
	}
}

func TestLoadEngineer_OldTyreTemperaturesGiveTheDefaultMargin(t *testing.T) {
	store := memStore{engineerSettingsKey: `{"tyre_overheat_c":110,"tyre_cold_c":80}`}
	got, _, err := LoadEngineer(context.Background(), store)
	if err != nil {
		t.Fatalf("LoadEngineer: %v", err)
	}
	if got.TyreTempMarginC != engineer.DefaultTuning().TyreTempMarginC {
		t.Errorf("tyre temp margin = %v, want the default", got.TyreTempMarginC)
	}
}

func TestLoadEngineer_CurrentSetupIgnoresStoredCategories(t *testing.T) {
	store := memStore{engineerSettingsKey: `{"alert_switches":{"subTyreWear":true},"enabled_categories":{"tyre_wear":false}}`}
	got, _, err := LoadEngineer(context.Background(), store)
	if err != nil {
		t.Fatalf("LoadEngineer: %v", err)
	}
	if !got.EngineConfig().EnabledCategories["tyre_wear"] {
		t.Error("the engine's categories must come from the alert switches, not the stored map")
	}
}

func TestEngineerApply(t *testing.T) {
	saved := DefaultEngineer()
	saved.Version = 4

	update := saved.Clone()
	update.TyreWearWarnPct = 55
	update.AlertSwitches = map[string]bool{"subTyreWear": false}
	next, err := saved.Apply(update)
	if err != nil {
		t.Fatalf("Apply: %v", err)
	}
	if next.Version != 5 || next.TyreWearWarnPct != 55 || next.AlertSwitches["subTyreWear"] {
		t.Errorf("next = %+v", next)
	}

	stale := update.Clone()
	stale.Version = 3
	if _, err := saved.Apply(stale); !errors.Is(err, ErrVersionConflict) {
		t.Errorf("stale version: err = %v, want ErrVersionConflict", err)
	}

	unknown := saved.Clone()
	unknown.AlertSwitches = map[string]bool{"damage_wing": false}
	if _, err := saved.Apply(unknown); err == nil || errors.Is(err, ErrVersionConflict) {
		t.Errorf("unknown switch: err = %v, want a validation error", err)
	}

	// A tab opened before the upgrade still sends the retired master switches.
	retired := saved.Clone()
	retired.AlertSwitches = map[string]bool{"thermalAlertsEnabled": false, "subTyreCold": true, "subRain": true}
	next, err = saved.Apply(retired)
	if err != nil {
		t.Fatalf("Apply with a retired switch: %v", err)
	}
	want := map[string]bool{"subTyreThermal": false, "subTyreCold": false, "subRain": true}
	if !maps.Equal(next.AlertSwitches, want) {
		t.Errorf("alert switches = %v, want %v", next.AlertSwitches, want)
	}
}

func TestEngineerClone_DoesNotShareSwitches(t *testing.T) {
	e := DefaultEngineer()
	e.AlertSwitches = map[string]bool{"subTyreWear": true}
	c := e.Clone()
	c.AlertSwitches["subTyreWear"] = false
	if !e.AlertSwitches["subTyreWear"] {
		t.Error("Clone shares the alert switch map")
	}
}

func TestEngineerEngineConfig_ServerOwnsConstantsAndCategories(t *testing.T) {
	e := DefaultEngineer()
	e.TyreWearWarnPct = 61
	e.AlertSwitches = map[string]bool{"damageAlertsEnabled": false}

	cfg := e.EngineConfig()
	defaults := engineer.DefaultEngineerConfig()
	if cfg.TyreWearWarnPct != 61 {
		t.Errorf("tuning not applied: %v", cfg.TyreWearWarnPct)
	}
	if cfg.GlobalChatterCooldownMs != defaults.GlobalChatterCooldownMs ||
		cfg.WingDamageCritPct != defaults.WingDamageCritPct ||
		cfg.QualyTimeWarnSec != defaults.QualyTimeWarnSec {
		t.Errorf("server-owned values changed: %+v", cfg)
	}
	if !maps.Equal(cfg.EnabledCategories, engineer.EnabledCategoriesFromSwitches(e.AlertSwitches)) {
		t.Errorf("enabled categories not derived from the switches: %v", cfg.EnabledCategories)
	}
	if cfg.IsAlertEnabled(string(engineer.DirectiveCategoryDamage), "damage_wing") {
		t.Error("damage alerts should be off with the damage group switch off")
	}
}
