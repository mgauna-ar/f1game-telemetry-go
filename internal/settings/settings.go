// Package settings keeps the dashboard's user settings in the database, so every device that opens
// the dashboard (the PC, a tablet on the same network) shares one copy. Each section is a single
// JSON document in the settings table.
package settings

import (
	"context"
	"encoding/json"
	"fmt"
)

// Store is the key-value table the settings live in. storage.Repository satisfies it.
type Store interface {
	GetSetting(ctx context.Context, key string) (string, error)
	SetSetting(ctx context.Context, key, value string) error
}

// load decodes the section saved under key into dst. It reports false when the section was never saved.
func load(ctx context.Context, store Store, key string, dst any) (bool, error) {
	raw, err := store.GetSetting(ctx, key)
	if err != nil {
		return false, fmt.Errorf("read %s: %w", key, err)
	}
	if raw == "" {
		return false, nil
	}
	if err := json.Unmarshal([]byte(raw), dst); err != nil {
		return false, fmt.Errorf("decode %s: %w", key, err)
	}
	return true, nil
}

// save encodes v and stores it under key.
func save(ctx context.Context, store Store, key string, v any) error {
	data, err := json.Marshal(v)
	if err != nil {
		return fmt.Errorf("encode %s: %w", key, err)
	}
	if err := store.SetSetting(ctx, key, string(data)); err != nil {
		return fmt.Errorf("write %s: %w", key, err)
	}
	return nil
}
