package api

import (
	"math"

	"github.com/mgauna/f1game-telemetry-go/internal/storage"
)

// DownsampleTelemetry uses Largest-Triangle-Three-Buckets (LTTB) algorithm
// to downsample telemetry samples to targetThreshold points while preserving visual shapes.
func DownsampleTelemetry(data []storage.TelemetrySample, targetThreshold int) []storage.TelemetrySample {
	dataLen := len(data)
	if targetThreshold >= dataLen || targetThreshold <= 2 {
		return data
	}

	sampled := make([]storage.TelemetrySample, 0, targetThreshold)

	// Always add the first point
	sampled = append(sampled, data[0])

	// Bucket size for the intermediate points
	every := float64(dataLen-2) / float64(targetThreshold-2)

	a := 0 // Index of the last selected point

	for i := 0; i < targetThreshold-2; i++ {
		// Calculate point average for next bucket (bucket b)
		avgX := 0.0
		avgY := 0.0
		avgRangeStart := int(math.Floor(float64(i+1)*every)) + 1
		avgRangeEnd := int(math.Floor(float64(i+2)*every)) + 1
		if avgRangeEnd > dataLen {
			avgRangeEnd = dataLen
		}

		avgRangeLength := float64(avgRangeEnd - avgRangeStart)
		if avgRangeLength > 0 {
			for ; avgRangeStart < avgRangeEnd; avgRangeStart++ {
				avgX += data[avgRangeStart].LapDistance
				avgY += float64(data[avgRangeStart].Speed)
			}
			avgX /= avgRangeLength
			avgY /= avgRangeLength
		}

		// Get the range for current bucket
		rangeOffs := int(math.Floor(float64(i)*every)) + 1
		rangeTo := int(math.Floor(float64(i+1)*every)) + 1

		// Point a
		pointAX := data[a].LapDistance
		pointAY := float64(data[a].Speed)

		maxArea := -1.0
		nextA := rangeOffs

		for ; rangeOffs < rangeTo; rangeOffs++ {
			// Calculate triangle area over three points
			area := math.Abs(
				(pointAX-avgX)*(float64(data[rangeOffs].Speed)-pointAY)-
					(pointAX-data[rangeOffs].LapDistance)*(avgY-pointAY),
			) * 0.5

			if area > maxArea {
				maxArea = area
				nextA = rangeOffs
			}
		}

		sampled = append(sampled, data[nextA])
		a = nextA // This point is the next a
	}

	// Always add the last point
	sampled = append(sampled, data[dataLen-1])

	return sampled
}

type lapSegment struct {
	startIdx int
	endIdx   int
	minDist  float64
	maxDist  float64
	span     float64
}

// TrimTelemetryToLastLapAttempt isolates the true completed lap attempt
// from raw telemetry samples that may contain out-laps, garage resets, aborted attempts,
// or trailing wrap-around samples into the next lap / cooldown.
func TrimTelemetryToLastLapAttempt(samples []storage.TelemetrySample) []storage.TelemetrySample {
	if len(samples) < 2 {
		return samples
	}

	// 1. Filter out negative distances and uninitialized distance dropouts (e.g. speed > 30 km/h with distance ~0)
	filtered := make([]storage.TelemetrySample, 0, len(samples))
	for _, s := range samples {
		// Drop pit lane / negative distance samples
		if s.LapDistance < 0.0 {
			continue
		}
		// Drop uninitialized distance dropouts where car is traveling at speed on track
		if s.LapDistance <= 0.05 && s.Speed > 30 && s.SessionTime > 5.0 {
			continue
		}
		filtered = append(filtered, s)
	}

	if len(filtered) < 2 {
		return samples
	}

	// 2. Partition filtered samples into contiguous monotonically progressing segments
	var segments []lapSegment
	segStart := 0

	for i := 1; i < len(filtered); i++ {
		prevDist := filtered[i-1].LapDistance
		currDist := filtered[i].LapDistance
		prevTime := filtered[i-1].SessionTime
		currTime := filtered[i].SessionTime

		// Check if curr is an isolated dropout/glitch (surrounding points continue monotonic trend)
		if (prevDist-currDist > 200 || currDist < prevDist*0.35) && i+1 < len(filtered) {
			nextDist := filtered[i+1].LapDistance
			if nextDist >= prevDist-50.0 {
				// curr is just an isolated glitch drop, skip it
				continue
			}
		}

		// Reset condition: persistent sudden drop in distance or time reversal
		isDrop := (prevDist > 100 && (currDist < 50 || currDist < prevDist*0.35)) || (prevDist-currDist > 500) || (currTime < prevTime)

		if isDrop {
			if i > segStart {
				minD := filtered[segStart].LapDistance
				maxD := filtered[segStart].LapDistance
				for k := segStart; k < i; k++ {
					if filtered[k].LapDistance < minD {
						minD = filtered[k].LapDistance
					}
					if filtered[k].LapDistance > maxD {
						maxD = filtered[k].LapDistance
					}
				}
				segments = append(segments, lapSegment{
					startIdx: segStart,
					endIdx:   i,
					minDist:  minD,
					maxDist:  maxD,
					span:     maxD - minD,
				})
			}
			segStart = i
		}
	}

	// Add final segment
	if segStart < len(filtered) {
		minD := filtered[segStart].LapDistance
		maxD := filtered[segStart].LapDistance
		for k := segStart; k < len(filtered); k++ {
			if filtered[k].LapDistance < minD {
				minD = filtered[k].LapDistance
			}
			if filtered[k].LapDistance > maxD {
				maxD = filtered[k].LapDistance
			}
		}
		segments = append(segments, lapSegment{
			startIdx: segStart,
			endIdx:   len(filtered),
			minDist:  minD,
			maxDist:  maxD,
			span:     maxD - minD,
		})
	}

	if len(segments) == 0 {
		return filtered
	}

	// 3. Select the best segment representing the completed lap attempt
	// Find the maximum span across all segments
	var maxSpan float64
	for _, seg := range segments {
		if seg.span > maxSpan {
			maxSpan = seg.span
		}
	}

	// Pick the last segment that achieved at least 70% of maxSpan (or >1000m)
	bestSegIdx := -1
	for idx := len(segments) - 1; idx >= 0; idx-- {
		seg := segments[idx]
		if seg.span >= maxSpan*0.7 && (seg.span > 1000 || seg.span == maxSpan) {
			bestSegIdx = idx
			break
		}
	}
	if bestSegIdx == -1 {
		// Fallback: pick segment with largest span
		for idx, seg := range segments {
			if seg.span == maxSpan {
				bestSegIdx = idx
				break
			}
		}
	}

	selected := filtered[segments[bestSegIdx].startIdx:segments[bestSegIdx].endIdx]
	if len(selected) < 2 {
		return selected
	}

	// 4. Advance past stationary / flat freeze samples at the start
	minDist := segments[bestSegIdx].minDist
	firstMovingIdx := -1
	for i := 0; i < len(selected); i++ {
		if selected[i].LapDistance > minDist+15.0 || selected[i].Speed > 10 {
			firstMovingIdx = i
			break
		}
	}

	actualStart := 0
	if firstMovingIdx > 0 {
		for i := firstMovingIdx - 1; i >= 0; i-- {
			if selected[i].LapDistance <= minDist+5.0 {
				actualStart = i
				break
			}
		}
	}

	return selected[actualStart:]
}
