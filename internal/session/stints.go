package session

import "github.com/mgauna/f1game-telemetry-go/internal/packets"

// StintInput represents raw telemetry data for a tyre stint.
type StintInput struct {
	EndLap         uint8
	VisualCompound uint8
	ActualCompound uint8
}

// StintInfo represents a normalized, calculated tyre stint with lap boundaries and compound names.
type StintInfo struct {
	StintNumber    int
	StartLap       int
	EndLap         int
	VisualCompound string
	ActualCompound string
}

// DeriveStints calculates the lap boundaries and compound names for each stint in inputs.
func DeriveStints(inputs []StintInput) []StintInfo {
	numStints := len(inputs)
	if numStints == 0 {
		return nil
	}

	stints := make([]StintInfo, numStints)
	for s := 0; s < numStints; s++ {
		stintStartLap := 1
		if s > 0 {
			prevEnd := int(inputs[s-1].EndLap)
			if prevEnd > 0 && prevEnd != 255 {
				stintStartLap = prevEnd + 1
			} else {
				stintStartLap = s + 1
			}
		}
		stintEndLap := int(inputs[s].EndLap)
		if stintEndLap == 255 || stintEndLap == 0 {
			if s == numStints-1 {
				stintEndLap = packets.MaxSessionLapsSanity
			} else {
				stintEndLap = stintStartLap
			}
		}

		stints[s] = StintInfo{
			StintNumber:    s + 1,
			StartLap:       stintStartLap,
			EndLap:         stintEndLap,
			VisualCompound: packets.VisualTyreCompoundName(inputs[s].VisualCompound),
			ActualCompound: packets.ActualTyreCompoundName(inputs[s].ActualCompound),
		}
	}
	return stints
}

// FindStintForLap finds the matching stint for a given lap number.
// If no stint matches, it returns default stint 1 with empty compound names.
func FindStintForLap(stints []StintInfo, lapNum int) (stintNum int, visualCompound, actualCompound string) {
	for _, s := range stints {
		if lapNum >= s.StartLap && lapNum <= s.EndLap {
			return s.StintNumber, s.VisualCompound, s.ActualCompound
		}
	}
	return 1, "", ""
}
