package engineer

import (
	"context"
	"path/filepath"
	"testing"

	"github.com/mgauna/f1game-telemetry-go/internal/storage"
)

func TestEngineerConfigStorage(t *testing.T) {
	dbPath := filepath.Join(t.TempDir(), "test_engineer_config.db")
	repo, err := storage.NewSQLiteRepository(dbPath)
	if err != nil {
		t.Fatalf("failed to create repo: %v", err)
	}
	defer repo.Close()

	ctx := context.Background()

	// 1. Loading when empty returns nil, nil
	cfg, err := LoadEngineerConfig(ctx, repo)
	if err != nil {
		t.Fatalf("LoadEngineerConfig failed on empty: %v", err)
	}
	if cfg != nil {
		t.Errorf("expected nil config on empty, got %v", cfg)
	}

	// 2. Save config
	sampleCfg := DefaultEngineerConfig()
	sampleCfg.TyreWearWarnPct = 48.5
	sampleCfg.ChatterCooldownMs = 30000
	sampleCfg.EnabledCategories = map[string]bool{
		"tyre_wear": true,
		"sub_qualy": false,
	}

	if err := SaveEngineerConfig(ctx, repo, sampleCfg); err != nil {
		t.Fatalf("SaveEngineerConfig failed: %v", err)
	}

	// 3. Load saved config
	loadedCfg, err := LoadEngineerConfig(ctx, repo)
	if err != nil {
		t.Fatalf("LoadEngineerConfig failed after save: %v", err)
	}
	if loadedCfg == nil {
		t.Fatal("expected non-nil config after save")
	}
	if loadedCfg.TyreWearWarnPct != 48.5 {
		t.Errorf("expected TyreWearWarnPct 48.5, got %f", loadedCfg.TyreWearWarnPct)
	}
	if loadedCfg.ChatterCooldownMs != 30000 {
		t.Errorf("expected ChatterCooldownMs 30000, got %d", loadedCfg.ChatterCooldownMs)
	}
	if !loadedCfg.EnabledCategories["tyre_wear"] || loadedCfg.EnabledCategories["sub_qualy"] {
		t.Errorf("expected EnabledCategories matching sampleCfg, got %v", loadedCfg.EnabledCategories)
	}

	// 4. Nil repo safety
	if err := SaveEngineerConfig(ctx, nil, sampleCfg); err != nil {
		t.Errorf("expected nil error on nil repo, got %v", err)
	}
	nilCfg, err := LoadEngineerConfig(ctx, nil)
	if err != nil || nilCfg != nil {
		t.Errorf("expected nil, nil on nil repo, got %v, %v", nilCfg, err)
	}
}

func TestLoadEngineerConfig_FillsFieldsMissingFromOlderSaves(t *testing.T) {
	dbPath := filepath.Join(t.TempDir(), "test_engineer_config_upgrade.db")
	repo, err := storage.NewSQLiteRepository(dbPath)
	if err != nil {
		t.Fatalf("failed to create repo: %v", err)
	}
	defer repo.Close()

	ctx := context.Background()

	// A config saved by an older version, before global_chatter_cooldown_ms and most thresholds existed.
	legacy := `{"chatter_cooldown_ms":30000,"tyre_wear_warn_pct":48,"enabled_categories":{"tyre_wear":false}}`
	if err := repo.SetSetting(ctx, SettingKeyEngineerConfig, legacy); err != nil {
		t.Fatalf("SetSetting failed: %v", err)
	}

	cfg, err := LoadEngineerConfig(ctx, repo)
	if err != nil || cfg == nil {
		t.Fatalf("LoadEngineerConfig failed: cfg=%v err=%v", cfg, err)
	}

	defaults := DefaultEngineerConfig()
	if cfg.ChatterCooldownMs != 30000 || cfg.TyreWearWarnPct != 48 {
		t.Errorf("expected saved values to be kept, got cooldown=%d tyreWarn=%f", cfg.ChatterCooldownMs, cfg.TyreWearWarnPct)
	}
	if cfg.GlobalChatterCooldownMs != defaults.GlobalChatterCooldownMs {
		t.Errorf("expected missing GlobalChatterCooldownMs to default to %d, got %d", defaults.GlobalChatterCooldownMs, cfg.GlobalChatterCooldownMs)
	}
	if cfg.BrakeOverheatC != defaults.BrakeOverheatC {
		t.Errorf("expected missing BrakeOverheatC to default to %f, got %f", defaults.BrakeOverheatC, cfg.BrakeOverheatC)
	}
	if cfg.IsAlertEnabled(string(DirectiveCategoryTyres), "tyre_wear") {
		t.Errorf("expected saved tyre_wear=false to be kept")
	}
}

func TestEngineerConfigStorage_PersistsSettingsPanelState(t *testing.T) {
	dbPath := filepath.Join(t.TempDir(), "test_engineer_config_panel.db")
	repo, err := storage.NewSQLiteRepository(dbPath)
	if err != nil {
		t.Fatalf("failed to create repo: %v", err)
	}
	defer repo.Close()

	ctx := context.Background()
	cfg := DefaultEngineerConfig()
	cfg.TriggerPreset = "minimal"
	cfg.AlertSwitches = map[string]bool{"tyreAlertsEnabled": false, "subTyrePuncture": true}

	if err := SaveEngineerConfig(ctx, repo, cfg); err != nil {
		t.Fatalf("SaveEngineerConfig failed: %v", err)
	}
	loaded, err := LoadEngineerConfig(ctx, repo)
	if err != nil || loaded == nil {
		t.Fatalf("LoadEngineerConfig failed: cfg=%v err=%v", loaded, err)
	}
	if loaded.TriggerPreset != "minimal" {
		t.Errorf("expected TriggerPreset minimal, got %q", loaded.TriggerPreset)
	}
	if loaded.AlertSwitches["tyreAlertsEnabled"] || !loaded.AlertSwitches["subTyrePuncture"] {
		t.Errorf("expected AlertSwitches to round-trip, got %v", loaded.AlertSwitches)
	}
}

func TestEngineerEngine_ConfigMapsAreNotShared(t *testing.T) {
	engine := NewEngineerEngine(nil)
	input := DefaultEngineerConfig()
	input.EnabledCategories = map[string]bool{"tyre_wear": true}
	input.AlertSwitches = map[string]bool{"tyreAlertsEnabled": true}
	engine.SetConfig(input)

	// Mutating the caller's maps or a returned copy must not change the engine's live config.
	input.EnabledCategories["tyre_wear"] = false
	got := engine.GetConfig()
	got.EnabledCategories["tyre_wear"] = false
	got.AlertSwitches["tyreAlertsEnabled"] = false

	live := engine.GetConfig()
	if !live.EnabledCategories["tyre_wear"] || !live.AlertSwitches["tyreAlertsEnabled"] {
		t.Errorf("expected engine config maps to be isolated, got %v / %v", live.EnabledCategories, live.AlertSwitches)
	}
}
