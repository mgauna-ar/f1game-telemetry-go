package input

import (
	"strings"
	"testing"
)

// reading is one poll of the button: whether it could be read, and whether it was pressed.
type reading struct{ ok, pressed bool }

var (
	held     = reading{ok: true, pressed: true}
	released = reading{ok: true, pressed: false}
	failed   = reading{ok: false}
)

func repeat(r reading, n int) []reading {
	out := make([]reading, n)
	for i := range out {
		out[i] = r
	}
	return out
}

func readings(parts ...[]reading) []reading {
	var out []reading
	for _, p := range parts {
		out = append(out, p...)
	}
	return out
}

func TestButtonStatePoll(t *testing.T) {
	tests := []struct {
		name  string
		polls []reading
		want  string // the events in order, e.g. "down up"
	}{
		{
			name:  "press and release",
			polls: readings(repeat(held, 10), repeat(released, releasePolls)),
			want:  "down up",
		},
		{
			name:  "a release shorter than the debounce is not one",
			polls: readings(repeat(held, 5), repeat(released, releasePolls-1), repeat(held, 5)),
			want:  "down",
		},
		{
			name:  "failed reads keep the button held",
			polls: readings(repeat(held, 3), repeat(failed, 50), repeat(held, 3), repeat(released, releasePolls)),
			want:  "down up",
		},
		{
			name:  "failed reads don't press a released button",
			polls: readings(repeat(failed, 10), repeat(released, 5)),
			want:  "",
		},
		{
			name:  "a button that can't be read for long is let go",
			polls: readings(repeat(held, 3), repeat(failed, maxFailedPolls)),
			want:  "down up",
		},
		{
			name:  "a failed read while letting go doesn't cancel the release",
			polls: readings(repeat(held, 3), repeat(released, releasePolls-1), repeat(failed, 1), repeat(released, 1)),
			want:  "down up",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var s buttonState
			var events []string
			for _, r := range tt.polls {
				if evt := s.poll(r.ok, r.pressed); evt != "" {
					events = append(events, evt)
				}
			}
			if got := strings.Join(events, " "); got != tt.want {
				t.Errorf("events = %q, want %q", got, tt.want)
			}
		})
	}
}
