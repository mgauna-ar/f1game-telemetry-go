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
