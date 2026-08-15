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

// TrimTelemetryToLastLapAttempt isolates the final completed lap attempt
// from raw telemetry samples that may contain out-laps, garage resets, aborted attempts,
// or trailing wrap-around samples into the next lap.
func TrimTelemetryToLastLapAttempt(samples []storage.TelemetrySample) []storage.TelemetrySample {
	if len(samples) < 2 {
		return samples
	}

	lastStartIndex := 0

	// 1. Any sample at or before a negative distance is part of the pit/out-lap
	for i := 0; i < len(samples); i++ {
		if samples[i].LapDistance < 0.0 {
			if i+1 < len(samples) {
				lastStartIndex = i + 1
			}
		}
	}

	// 2. Scan from lastStartIndex for any mid-session resets (distance drops from >100m to lower)
	for i := lastStartIndex + 1; i < len(samples); i++ {
		prevDist := samples[i-1].LapDistance
		currDist := samples[i].LapDistance

		// Sudden drop from high distance (> 100m) to low distance (< 50m or < 0.3 * prevDist)
		if prevDist > 100 && (currDist < 50 || currDist < prevDist*0.3) {
			if len(samples)-i >= 10 {
				lastStartIndex = i
			}
		}
	}

	trimmedStart := samples[lastStartIndex:]
	if len(trimmedStart) < 2 {
		return trimmedStart
	}

	// 3. Scan for trailing wrap-around samples into the next lap at the end
	endIndex := len(trimmedStart)
	for i := 1; i < len(trimmedStart); i++ {
		prevDist := trimmedStart[i-1].LapDistance
		currDist := trimmedStart[i].LapDistance

		// If distance suddenly drops after traversing a significant part of the track (> 1000m)
		if prevDist > 1000 && (currDist < 500 || currDist < prevDist*0.3) {
			endIndex = i
			break
		}
	}

	trimmedAttempt := trimmedStart[:endIndex]
	if len(trimmedAttempt) < 2 {
		return trimmedAttempt
	}

	// 4. Advance past stationary / flat freeze samples at the start (e.g. pre-start countdown/garage teleport).
	// Find the first index where car is moving forward on track (dist > 15m), then step back to the last start-line sample.
	firstMovingIdx := -1
	for i := 0; i < len(trimmedAttempt); i++ {
		if trimmedAttempt[i].LapDistance > 15.0 {
			firstMovingIdx = i
			break
		}
	}

	actualStart := 0
	if firstMovingIdx > 0 {
		for i := firstMovingIdx - 1; i >= 0; i-- {
			if trimmedAttempt[i].LapDistance <= 5.0 && trimmedAttempt[i].LapDistance >= 0.0 {
				actualStart = i
				break
			}
		}
	}

	return trimmedAttempt[actualStart:]
}
