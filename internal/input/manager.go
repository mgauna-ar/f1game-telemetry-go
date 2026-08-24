package input

import (
	"context"
	"sync"
	"time"
)

// DeviceType represents the type of input device.
type DeviceType string

const (
	DeviceTypeJoystick DeviceType = "joystick"
	DeviceTypeKeyboard DeviceType = "keyboard"
	DeviceTypeNone     DeviceType = "none"
)

// Mapping defines the target button or key to monitor.
type Mapping struct {
	DeviceType  DeviceType `json:"device_type"`
	DeviceIndex int        `json:"device_index"` // Joystick ID (0-15)
	ButtonIndex int        `json:"button_index"` // Button ID (0-31)
	KeyCode     int        `json:"key_code"`     // Virtual Key Code (e.g. 0x20 for Space)
	KeyName     string     `json:"key_name"`     // Display name (e.g. "Space", "F12")
	DeviceName  string     `json:"device_name"`  // e.g. "Fanatec CSL DD", "Logitech G29", "Keyboard"
}

// Event represents a state transition for the monitored PTT button/key.
type Event struct {
	State     string  `json:"state"` // "down" or "up"
	Mapping   Mapping `json:"mapping"`
	Timestamp int64   `json:"timestamp"`
}

// Manager is the interface for global OS input monitoring.
type Manager interface {
	Start(ctx context.Context)
	Stop()
	GetMapping() Mapping
	SetMapping(m Mapping)
	StartLearning(ctx context.Context) (<-chan Mapping, error)
	CancelLearning()
	Events() <-chan Event
	IsActive() bool
}

// BaseManager provides shared storage and state management for platform implementations.
type BaseManager struct {
	mu           sync.RWMutex
	currentMap   Mapping
	isDown       bool
	isLearning   bool
	learnChan    chan Mapping
	eventChan    chan Event
	pollInterval time.Duration
}

// NewBaseManager initializes a BaseManager.
func NewBaseManager() *BaseManager {
	return &BaseManager{
		currentMap: Mapping{
			DeviceType: DeviceTypeKeyboard,
			KeyCode:    0x20, // VK_SPACE
			KeyName:    "Space",
			DeviceName: "Keyboard",
		},
		eventChan:    make(chan Event, 64),
		pollInterval: 20 * time.Millisecond, // 50Hz polling
	}
}

// GetMapping returns the active mapping.
func (b *BaseManager) GetMapping() Mapping {
	b.mu.RLock()
	defer b.mu.RUnlock()
	return b.currentMap
}

// SetMapping updates the active mapping.
func (b *BaseManager) SetMapping(m Mapping) {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.currentMap = m
	b.isDown = false // Reset state on mapping change
}

// Events returns the channel for PTT state transitions.
func (b *BaseManager) Events() <-chan Event {
	return b.eventChan
}

// EmitEvent safely pushes an event to the event channel without blocking.
func (b *BaseManager) EmitEvent(state string) {
	b.mu.RLock()
	m := b.currentMap
	b.mu.RUnlock()

	evt := Event{
		State:     state,
		Mapping:   m,
		Timestamp: time.Now().UnixMilli(),
	}

	select {
	case b.eventChan <- evt:
	default:
		// Drop if buffer is full to prevent deadlock
	}
}

// CancelLearning cancels any active learning session.
func (b *BaseManager) CancelLearning() {
	b.mu.Lock()
	defer b.mu.Unlock()
	if b.isLearning && b.learnChan != nil {
		close(b.learnChan)
		b.learnChan = nil
		b.isLearning = false
	}
}
