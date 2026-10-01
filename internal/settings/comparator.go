package settings

import (
	"context"
	"fmt"
	"slices"
	"strings"
)

const comparatorSettingsKey = "comparator_settings"

// Who the lap comparator's slot B picks by default.
const (
	RivalModeFastest  = "fastest"
	RivalModeTeammate = "teammate"
	RivalModeDriver   = "driver"
)

// RivalModes lists every rival mode, for the generated ComparatorRivalMode union.
var RivalModes = []string{RivalModeFastest, RivalModeTeammate, RivalModeDriver}

// maxRivalDriverNameLen caps the saved rival name; driver names in the game are far shorter.
const maxRivalDriverNameLen = 64

// Comparator is how the lap comparator picks its default laps: slot B takes the fastest lap, your
// teammate's or a named driver's (matched by part of the name or the race number).
type Comparator struct {
	RivalMode       string `json:"rival_mode" tstype:"ComparatorRivalMode"`
	RivalDriverName string `json:"rival_driver_name"`
}

// DefaultComparator is the setup before anything was saved.
func DefaultComparator() Comparator {
	return Comparator{RivalMode: RivalModeFastest}
}

// Normalize trims the rival name and fills an empty mode with the default.
func (c *Comparator) Normalize() {
	c.RivalDriverName = strings.TrimSpace(c.RivalDriverName)
	if c.RivalMode == "" {
		c.RivalMode = RivalModeFastest
	}
}

// Validate reports a mode the comparator doesn't know or a name too long to be a driver's.
func (c Comparator) Validate() error {
	if !slices.Contains(RivalModes, c.RivalMode) {
		return fmt.Errorf("unknown rival mode %q", c.RivalMode)
	}
	if len(c.RivalDriverName) > maxRivalDriverNameLen {
		return fmt.Errorf("rival driver name must be at most %d bytes", maxRivalDriverNameLen)
	}
	return nil
}

// LoadComparator returns the saved comparator settings (the defaults when none were saved), and
// whether they were saved.
func LoadComparator(ctx context.Context, store Store) (Comparator, bool, error) {
	c := DefaultComparator()
	ok, err := load(ctx, store, comparatorSettingsKey, &c)
	return c, ok, err
}

// SaveComparator stores the comparator settings.
func SaveComparator(ctx context.Context, store Store, c Comparator) error {
	return save(ctx, store, comparatorSettingsKey, c)
}
