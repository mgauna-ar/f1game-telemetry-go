package engineer

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/mgauna/f1game-telemetry-go/internal/storage"
)

// SettingKeyEngineerConfig is the key used in the SQLite settings table for engineer configuration.
const SettingKeyEngineerConfig = "engineer_config"

// LoadEngineerConfig retrieves and deserializes the persisted EngineerConfig from SQLite settings.
// Returns nil, nil if no setting is stored in the database.
func LoadEngineerConfig(ctx context.Context, repo storage.Repository) (*EngineerConfig, error) {
	if repo == nil {
		return nil, nil
	}

	val, err := repo.GetSetting(ctx, SettingKeyEngineerConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to load engineer config: %w", err)
	}
	if val == "" {
		return nil, nil
	}

	var cfg EngineerConfig
	if err := json.Unmarshal([]byte(val), &cfg); err != nil {
		return nil, fmt.Errorf("failed to unmarshal engineer config JSON: %w", err)
	}

	return &cfg, nil
}

// SaveEngineerConfig serializes and persists the EngineerConfig to SQLite settings.
func SaveEngineerConfig(ctx context.Context, repo storage.Repository, cfg EngineerConfig) error {
	if repo == nil {
		return nil
	}

	data, err := json.Marshal(cfg)
	if err != nil {
		return fmt.Errorf("failed to marshal engineer config JSON: %w", err)
	}

	if err := repo.SetSetting(ctx, SettingKeyEngineerConfig, string(data)); err != nil {
		return fmt.Errorf("failed to save engineer config setting: %w", err)
	}

	return nil
}
