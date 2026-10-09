package input

// Push-to-talk button events.
const (
	stateDown = "down"
	stateUp   = "up"
)

const (
	// releasePolls is how many polls in a row the button must read released before it counts as
	// let go (60 ms at the 20 ms poll), so a one-poll glitch while the driver holds it isn't a release.
	releasePolls = 3
	// maxFailedPolls is how long a button that can't be read keeps its last state (2 s) before it
	// counts as let go, so an unplugged wheel doesn't keep the radio open.
	maxFailedPolls = 100
)

// buttonState turns polls of the push-to-talk button into presses and releases. A press counts at
// once. A release counts only after the button reads released for releasePolls polls in a row. A
// poll that couldn't read the button keeps the last state: with a game in front, the wheel can
// fail to read for a moment while the driver still holds the button.
type buttonState struct {
	down bool
	// released counts the polls in a row the held button read released.
	released int
	// failed counts the polls in a row the button couldn't be read.
	failed int
}

// poll takes one reading of the button (ok is false when it couldn't be read) and returns
// stateDown or stateUp when the button went down or was let go, or "" when nothing changed.
func (s *buttonState) poll(ok, pressed bool) string {
	if !ok {
		s.failed++
		if s.down && s.failed >= maxFailedPolls {
			s.down, s.released = false, 0
			return stateUp
		}
		return ""
	}
	s.failed = 0

	if pressed {
		s.released = 0
		if !s.down {
			s.down = true
			return stateDown
		}
		return ""
	}
	if !s.down {
		return ""
	}
	s.released++
	if s.released < releasePolls {
		return ""
	}
	s.down, s.released = false, 0
	return stateUp
}
