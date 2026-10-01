package packets

import "testing"

// The UDP specification orders every wheel array RL, RR, FL, FR ("Note: All wheel arrays have
// the following order"); the car setup packet names them in the same order.
func TestWheelArrayOrderFollowsTheSpec(t *testing.T) {
	got := [4]int{WheelRearLeft, WheelRearRight, WheelFrontLeft, WheelFrontRight}
	if got != [4]int{0, 1, 2, 3} {
		t.Errorf("wheel indices RL, RR, FL, FR = %v, want 0, 1, 2, 3", got)
	}
	if WheelsFrontFirst != [4]int{2, 3, 0, 1} {
		t.Errorf("WheelsFrontFirst = %v, want FL, FR, RL, RR = 2, 3, 0, 1", WheelsFrontFirst)
	}
}
