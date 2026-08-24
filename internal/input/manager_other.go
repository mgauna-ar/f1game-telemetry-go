//go:build !windows

package input

import (
	"context"
	"errors"
)

// NonWindowsManager provides a safe fallback for non-Windows platforms.
type NonWindowsManager struct {
	*BaseManager
}

// NewManager creates a stub input manager for non-Windows platforms.
func NewManager() Manager {
	return &NonWindowsManager{
		BaseManager: NewBaseManager(),
	}
}

// IsActive returns false since native background polling is only enabled on Windows.
func (m *NonWindowsManager) IsActive() bool {
	return false
}

// Start is a no-op on non-Windows platforms.
func (m *NonWindowsManager) Start(ctx context.Context) {}

// Stop is a no-op on non-Windows platforms.
func (m *NonWindowsManager) Stop() {}

// StartLearning returns an error or dummy channel on non-Windows platforms.
func (m *NonWindowsManager) StartLearning(ctx context.Context) (<-chan Mapping, error) {
	return nil, errors.New("native global input learning is only available on Windows")
}
