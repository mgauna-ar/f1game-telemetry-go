package analytics

import (
	"container/list"
	"context"
	"database/sql"
	"errors"
	"fmt"
	"math"
	"sort"
	"sync"

	"github.com/mgauna/f1game-telemetry-go/internal/packets"
	"github.com/mgauna/f1game-telemetry-go/internal/storage"
)

// Comparator constants
const (
	DefaultComparatorStepMeters     = 5.0
	MinComparatorStepMeters         = 1.0
	MaxComparatorStepMeters         = 100.0
	ComparatorCacheCapacity         = 128
	MinTurnDistSpacing              = 70.0
	TurnApexSearchRadiusMax         = 8
	TurnCurvatureThreshold          = 0.0025
	TurnEntryOffsetMeters           = 35.0
	TurnExitOffsetMeters            = 35.0
	MinPointsForTurnDetection       = 20
	TurnLookaroundWindow            = 4
	wrapAroundMinPrevDistanceMeters = 500.0
	wrapAroundMaxNextDistanceMeters = 100.0
)

// ComparatorResponse encapsulates merged telemetry, detected track turns, and lap metadata.
type ComparatorResponse struct {
	Points []MergedTelemetryPoint `json:"points"`
	Turns  []TrackTurn            `json:"turns"`
	LapA   *ComparatorLapMeta     `json:"lap_a,omitempty"`
	LapB   *ComparatorLapMeta     `json:"lap_b,omitempty"`
}

// MergedTelemetryPoint represents a single resampled point along the track lap distance.
type MergedTelemetryPoint struct {
	LapDistance    float64  `json:"lap_distance"`
	TimeDelta      *float64 `json:"time_delta"`
	TimeA          *float64 `json:"timeA"`
	TimeB          *float64 `json:"timeB"`
	SpeedA         *float64 `json:"speedA"`
	SpeedB         *float64 `json:"speedB"`
	SpeedDelta     *float64 `json:"speed_delta"`
	ThrottleA      *float64 `json:"throttleA"`
	ThrottleB      *float64 `json:"throttleB"`
	BrakeA         *float64 `json:"brakeA"`
	BrakeB         *float64 `json:"brakeB"`
	SteerA         *float64 `json:"steerA"`
	SteerB         *float64 `json:"steerB"`
	GearA          *float64 `json:"gearA"`
	GearB          *float64 `json:"gearB"`
	ERSBatteryA    *float64 `json:"ersBatteryA"`
	ERSBatteryB    *float64 `json:"ersBatteryB"`
	ERSDeployModeA *float64 `json:"ersDeployModeA"`
	ERSDeployModeB *float64 `json:"ersDeployModeB"`
	ActiveAeroA    *float64 `json:"activeAeroA,omitempty"`
	ActiveAeroB    *float64 `json:"activeAeroB,omitempty"`
	BoostActiveA   *float64 `json:"boostActiveA,omitempty"`
	BoostActiveB   *float64 `json:"boostActiveB,omitempty"`
	WorldX         *float64 `json:"worldX,omitempty"`
	WorldZ         *float64 `json:"worldZ,omitempty"`
}

// TrackTurn represents a detected corner apex and normal vector on the track.
type TrackTurn struct {
	TurnNumber    int      `json:"turnNumber"`
	Name          string   `json:"name"`
	Distance      float64  `json:"distance"`
	EntryDistance float64  `json:"entryDistance"`
	ExitDistance  float64  `json:"exitDistance"`
	WorldX        float64  `json:"worldX"`
	WorldZ        float64  `json:"worldZ"`
	NormalX       float64  `json:"normalX"`
	NormalZ       float64  `json:"normalZ"`
	SpeedA        *float64 `json:"speedA,omitempty"`
	SpeedB        *float64 `json:"speedB,omitempty"`
}

// ComparatorLapMeta contains high-level info about a compared lap slot.
type ComparatorLapMeta struct {
	LapID     int64  `json:"lap_id"`
	LapTimeMS int    `json:"lap_time_ms"`
	Driver    string `json:"driver"`
	Compound  string `json:"compound"`
	TyreAge   int    `json:"tyre_age"`
}

type comparatorCacheEntry struct {
	key      string
	response *ComparatorResponse
}

// ComparatorLRUCache provides thread-safe in-memory caching for merged comparator results.
type ComparatorLRUCache struct {
	capacity int
	mu       sync.RWMutex
	items    map[string]*list.Element
	order    *list.List
}

// NewComparatorLRUCache creates an LRU cache with the specified item capacity.
func NewComparatorLRUCache(capacity int) *ComparatorLRUCache {
	if capacity <= 0 {
		capacity = ComparatorCacheCapacity
	}
	return &ComparatorLRUCache{
		capacity: capacity,
		items:    make(map[string]*list.Element),
		order:    list.New(),
	}
}

// Get retrieves an item from the cache and marks it as most recently used.
func (c *ComparatorLRUCache) Get(key string) (*ComparatorResponse, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if elem, found := c.items[key]; found {
		c.order.MoveToFront(elem)
		if entry, ok := elem.Value.(*comparatorCacheEntry); ok {
			return entry.response, true
		}
	}
	return nil, false
}

// Put inserts or updates an item in the cache, evicting the least recently used if full.
func (c *ComparatorLRUCache) Put(key string, response *ComparatorResponse) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if elem, found := c.items[key]; found {
		c.order.MoveToFront(elem)
		if entry, ok := elem.Value.(*comparatorCacheEntry); ok {
			entry.response = response
		}
		return
	}

	if c.order.Len() >= c.capacity {
		oldest := c.order.Back()
		if oldest != nil {
			c.order.Remove(oldest)
			if entry, ok := oldest.Value.(*comparatorCacheEntry); ok {
				delete(c.items, entry.key)
			}
		}
	}

	elem := c.order.PushFront(&comparatorCacheEntry{key: key, response: response})
	c.items[key] = elem
}

// Clear empties all entries from the cache.
func (c *ComparatorLRUCache) Clear() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.items = make(map[string]*list.Element)
	c.order.Init()
}

// NormalizeTelemetrySeries normalizes raw telemetry samples for comparison:
// - Filters non-finite and negative distance samples.
// - Chronologically sorts by session_time.
// - Filters isolated distance spikes.
// - Isolates the contiguous lap attempt from start line to finish line.
// - Deduplicates monotonic distances.
// - Zero-calibrates start line crossing (t=0.000s at d=0.0m).
// - Harmonizes elapsed time with official lap duration when expectedLapTimeMs > 0.
// - Optionally scales distances if targetTrackLength > 0.
// filterInvalidSamples removes non-finite values, negative distances, and initial dropouts.
func filterInvalidSamples(samples []storage.TelemetrySample) []storage.TelemetrySample {
	validSamples := make([]storage.TelemetrySample, 0, len(samples))
	for _, s := range samples {
		if math.IsNaN(s.SessionTime) || math.IsInf(s.SessionTime, 0) ||
			math.IsNaN(s.LapDistance) || math.IsInf(s.LapDistance, 0) ||
			s.LapDistance < 0 {
			continue
		}
		// Filter out isolated uninitialized distance dropouts
		if s.LapDistance <= 0.05 && s.Speed > 30 && s.SessionTime > 5.0 {
			continue
		}
		validSamples = append(validSamples, s)
	}
	return validSamples
}

// sortBySessionTime sorts samples chronologically by session time.
func sortBySessionTime(samples []storage.TelemetrySample) []storage.TelemetrySample {
	sorted := make([]storage.TelemetrySample, len(samples))
	copy(sorted, samples)
	sort.SliceStable(sorted, func(i, j int) bool {
		return sorted[i].SessionTime < sorted[j].SessionTime
	})
	return sorted
}

// removeDistanceSpikes filters isolated 1-sample telemetry glitches where distance jumps and snaps back.
func removeDistanceSpikes(samples []storage.TelemetrySample) []storage.TelemetrySample {
	cleaned := make([]storage.TelemetrySample, 0, len(samples))
	for i := 0; i < len(samples); i++ {
		if i > 0 && i+1 < len(samples) {
			prevD := samples[i-1].LapDistance
			currD := samples[i].LapDistance
			nextD := samples[i+1].LapDistance
			if currD-prevD > 250 && nextD < currD-150 && nextD >= prevD-20 {
				continue
			}
		}
		cleaned = append(cleaned, samples[i])
	}
	return cleaned
}

// isolateLapAttempt isolates the contiguous lap attempt starting near 0m and progressing towards the finish.
func isolateLapAttempt(samples []storage.TelemetrySample) []storage.TelemetrySample {
	if len(samples) == 0 {
		return []storage.TelemetrySample{}
	}
	startIdx := 0
	for i := 0; i < len(samples); i++ {
		if i > 0 && samples[i-1].LapDistance > wrapAroundMinPrevDistanceMeters && samples[i].LapDistance < wrapAroundMaxNextDistanceMeters {
			startIdx = i
		}
	}
	movingSamples := samples[startIdx:]
	for i := 1; i < len(movingSamples); i++ {
		if movingSamples[i-1].LapDistance > wrapAroundMinPrevDistanceMeters && movingSamples[i].LapDistance < wrapAroundMaxNextDistanceMeters {
			movingSamples = movingSamples[:i]
			break
		}
	}
	return movingSamples
}

// deduplicateMonotonic ensures strictly monotonic distance progression across samples.
func deduplicateMonotonic(samples []storage.TelemetrySample) []storage.TelemetrySample {
	if len(samples) == 0 {
		return []storage.TelemetrySample{}
	}
	deduped := []storage.TelemetrySample{samples[0]}
	for i := 1; i < len(samples); i++ {
		curr := samples[i]
		prev := deduped[len(deduped)-1]
		currDist := curr.LapDistance
		prevDist := prev.LapDistance

		if currDist-prevDist > 250 && i+1 < len(samples) {
			nextDist := samples[i+1].LapDistance
			if nextDist < currDist-150 && nextDist >= prevDist {
				continue
			}
		}

		if currDist > prevDist {
			deduped = append(deduped, curr)
		}
	}
	return deduped
}

// calibrateStartLine anchors the start line at t=0, d=0 and reconciles duration with official lap time.
func calibrateStartLine(samples []storage.TelemetrySample, expectedLapTimeMs int, targetTrackLength float64) []storage.TelemetrySample {
	if len(samples) == 0 {
		return []storage.TelemetrySample{}
	}

	firstSample := samples[0]
	firstDist := firstSample.LapDistance
	firstTime := firstSample.SessionTime
	firstSpeed := float64(firstSample.Speed)

	startTime := firstTime
	if firstDist > 0 {
		speedMS := firstSpeed * packets.KmhToMps
		if speedMS < 10.0 {
			speedMS = 10.0
		}
		timeOffsetToZero := firstDist / speedMS
		startTime = firstTime - timeOffsetToZero
	}

	lastSample := samples[len(samples)-1]
	lastDist := lastSample.LapDistance
	lastTimeElapsed := lastSample.SessionTime - startTime
	lastSpeed := float64(lastSample.Speed)

	endDist := lastDist
	if targetTrackLength > 0 && targetTrackLength > lastDist {
		endDist = targetTrackLength
	}

	rawTotalDuration := lastTimeElapsed
	if endDist > lastDist {
		lastSpeedMS := lastSpeed * packets.KmhToMps
		if lastSpeedMS < 10.0 {
			lastSpeedMS = 10.0
		}
		rawTotalDuration += (endDist - lastDist) / lastSpeedMS
	}

	timeScale := 1.0
	if expectedLapTimeMs > 0 && rawTotalDuration > 0 {
		officialDuration := float64(expectedLapTimeMs) / packets.MillisPerSecond
		ratio := officialDuration / rawTotalDuration
		if ratio >= 0.85 && ratio <= 1.15 {
			timeScale = ratio
		}
	}

	result := make([]storage.TelemetrySample, 0, len(samples)+2)

	if firstDist > 0.05 {
		synthStart := firstSample
		synthStart.LapDistance = 0.0
		synthStart.SessionTime = 0.0
		result = append(result, synthStart)
	}

	for _, s := range samples {
		dist := s.LapDistance
		elapsed := math.Max(0, (s.SessionTime-startTime)*timeScale)
		resSample := s
		resSample.LapDistance = math.Round(dist*10) / 10
		resSample.SessionTime = math.Round(elapsed*packets.MillisPerSecond) / packets.MillisPerSecond
		result = append(result, resSample)
	}

	if expectedLapTimeMs > 0 {
		officialDuration := float64(expectedLapTimeMs) / packets.MillisPerSecond
		synthEnd := lastSample
		synthEnd.LapDistance = math.Round(endDist*10) / 10
		synthEnd.SessionTime = math.Round(officialDuration*packets.MillisPerSecond) / packets.MillisPerSecond
		if len(result) > 0 && result[len(result)-1].LapDistance < synthEnd.LapDistance {
			result = append(result, synthEnd)
		} else if len(result) > 0 {
			result[len(result)-1].SessionTime = synthEnd.SessionTime
		}
	}

	return result
}

// scaleToTrackLength scales lap sample distances if targetTrackLength differs significantly.
func scaleToTrackLength(samples []storage.TelemetrySample, targetTrackLength float64) []storage.TelemetrySample {
	if targetTrackLength <= 0 || len(samples) == 0 {
		return samples
	}
	currentEnd := samples[len(samples)-1].LapDistance
	if currentEnd > 0 && math.Abs(currentEnd-targetTrackLength) > 100 {
		scale := targetTrackLength / currentEnd
		for i := range samples {
			samples[i].LapDistance = math.Round(samples[i].LapDistance*scale*10) / 10
		}
	}
	return samples
}

// NormalizeTelemetrySeries conditions and aligns raw telemetry samples for accurate spatial comparison.
// - Filters NaN/Inf numbers and telemetry spikes.
// - Sorts chronologically.
// - Isolates single flying lap.
// - Guarantees strictly monotonic lap distances.
// - Calibrates zero-distance start line.
// - Harmonizes elapsed time with official lap duration when expectedLapTimeMs > 0.
// - Optionally scales distances if targetTrackLength > 0.
func NormalizeTelemetrySeries(samples []storage.TelemetrySample, expectedLapTimeMs int, targetTrackLength float64) []storage.TelemetrySample {
	if len(samples) == 0 {
		return []storage.TelemetrySample{}
	}

	result := filterInvalidSamples(samples)
	if len(result) == 0 {
		return []storage.TelemetrySample{}
	}

	result = sortBySessionTime(result)
	result = removeDistanceSpikes(result)
	if len(result) == 0 {
		return []storage.TelemetrySample{}
	}

	result = isolateLapAttempt(result)
	if len(result) == 0 {
		return []storage.TelemetrySample{}
	}

	result = deduplicateMonotonic(result)
	if len(result) == 0 {
		return []storage.TelemetrySample{}
	}

	result = calibrateStartLine(result, expectedLapTimeMs, targetTrackLength)
	result = scaleToTrackLength(result, targetTrackLength)
	return result
}

func getSampleField(s *storage.TelemetrySample, field string) float64 {
	switch field {
	case "session_time":
		return s.SessionTime
	case "speed":
		return float64(s.Speed)
	case "throttle":
		return s.Throttle
	case "brake":
		return s.Brake
	case "steer":
		return s.Steer
	case "gear":
		return float64(s.Gear)
	case "ers_store_energy":
		return s.ERSStoreEnergy
	case "ers_deploy_mode":
		return float64(s.ERSDeployMode)
	case "active_aero_mode":
		return float64(s.ActiveAeroMode)
	case "overtake_active":
		return float64(s.OvertakeActive)
	case "world_pos_x":
		return s.WorldPosX
	case "world_pos_z":
		return s.WorldPosZ
	default:
		return 0
	}
}

// interpolateAtDistance performs binary search and linear interpolation across sample points at distance d.
func interpolateAtDistance(samples []storage.TelemetrySample, field string, d, rangeEnd float64) *float64 {
	n := len(samples)
	if n == 0 {
		return nil
	}

	firstDist := samples[0].LapDistance
	lastDist := samples[n-1].LapDistance

	// Clamping at start (before first recorded point)
	if d <= firstDist {
		if field == "session_time" {
			zero := 0.0
			return &zero
		}
		val := getSampleField(&samples[0], field)
		if math.IsNaN(val) || math.IsInf(val, 0) {
			val = 0
		}
		return &val
	}

	// Clamping at finish line (beyond last recorded point)
	if d >= lastDist {
		isNearFinish := rangeEnd <= 0 || (rangeEnd-lastDist <= 250) || (lastDist >= rangeEnd*0.85)
		if isNearFinish || d-lastDist <= 100 {
			val := getSampleField(&samples[n-1], field)
			if math.IsNaN(val) || math.IsInf(val, 0) {
				val = 0
			}
			return &val
		}
		// Incomplete / aborted lap
		return nil
	}

	low := 0
	high := n - 1

	for low <= high {
		mid := (low + high) / 2
		if samples[mid].LapDistance == d {
			val := getSampleField(&samples[mid], field)
			if math.IsNaN(val) || math.IsInf(val, 0) {
				val = 0
			}
			return &val
		}
		if samples[mid].LapDistance < d {
			low = mid + 1
		} else {
			high = mid - 1
		}
	}

	idx1 := high
	if idx1 < 0 {
		idx1 = 0
	}
	idx2 := low
	if idx2 >= n {
		idx2 = n - 1
	}

	if idx1 == idx2 {
		val := getSampleField(&samples[idx1], field)
		if math.IsNaN(val) || math.IsInf(val, 0) {
			val = 0
		}
		return &val
	}

	d1 := samples[idx1].LapDistance
	d2 := samples[idx2].LapDistance
	v1 := getSampleField(&samples[idx1], field)
	v2 := getSampleField(&samples[idx2], field)

	if math.IsNaN(v1) || math.IsInf(v1, 0) {
		v1 = 0
	}
	if math.IsNaN(v2) || math.IsInf(v2, 0) {
		v2 = 0
	}

	if d2 == d1 {
		return &v1
	}

	factor := (d - d1) / (d2 - d1)
	interpolated := v1 + factor*(v2-v1)
	if math.IsNaN(interpolated) || math.IsInf(interpolated, 0) {
		interpolated = v1
	}
	return &interpolated
}

func roundPtr(v *float64, decimals int) *float64 {
	if v == nil {
		return nil
	}
	pow := math.Pow10(decimals)
	rounded := math.Round(*v*pow) / pow
	return &rounded
}

// CalculateMergedComparison merges two raw telemetry series onto a uniform distance grid and computes channel deltas.
func CalculateMergedComparison(
	rawA, rawB []storage.TelemetrySample,
	stepMeters float64,
	targetTrackLength float64,
	lapTimeMsA, lapTimeMsB int,
) []MergedTelemetryPoint {
	if stepMeters <= 0 {
		stepMeters = DefaultComparatorStepMeters
	}

	normA := NormalizeTelemetrySeries(rawA, lapTimeMsA, targetTrackLength)
	normB := NormalizeTelemetrySeries(rawB, lapTimeMsB, targetTrackLength)

	if len(normA) == 0 && len(normB) == 0 {
		return []MergedTelemetryPoint{}
	}

	endA := 0.0
	if len(normA) > 0 {
		endA = normA[len(normA)-1].LapDistance
	}
	endB := 0.0
	if len(normB) > 0 {
		endB = normB[len(normB)-1].LapDistance
	}

	rangeStart := 0.0
	var rangeEnd float64
	switch {
	case targetTrackLength > 0:
		rangeEnd = targetTrackLength
	case len(normA) > 0 && len(normB) > 0:
		rangeEnd = math.Max(endA, endB)
	case len(normA) > 0:
		rangeEnd = endA
	default:
		rangeEnd = endB
	}

	if rangeEnd <= rangeStart {
		return []MergedTelemetryPoint{}
	}

	var gridDistances []float64
	for dist := rangeStart; dist <= rangeEnd; dist += stepMeters {
		gridDistances = append(gridDistances, math.Round(dist*10)/10)
	}
	if len(gridDistances) == 0 || gridDistances[len(gridDistances)-1] < rangeEnd {
		gridDistances = append(gridDistances, math.Round(rangeEnd*10)/10)
	}

	result := make([]MergedTelemetryPoint, 0, len(gridDistances))

	for _, dist := range gridDistances {
		var timeA, timeB *float64
		if len(normA) > 0 {
			timeA = interpolateAtDistance(normA, "session_time", dist, rangeEnd)
		}
		if len(normB) > 0 {
			timeB = interpolateAtDistance(normB, "session_time", dist, rangeEnd)
		}

		var timeDelta *float64
		if timeA != nil && timeB != nil && !math.IsNaN(*timeA) && !math.IsNaN(*timeB) {
			td := math.Round((*timeA-*timeB)*1000) / 1000
			timeDelta = &td
		}

		var speedA, speedB *float64
		if len(normA) > 0 {
			speedA = interpolateAtDistance(normA, "speed", dist, rangeEnd)
		}
		if len(normB) > 0 {
			speedB = interpolateAtDistance(normB, "speed", dist, rangeEnd)
		}

		var speedDelta *float64
		if speedA != nil && speedB != nil && !math.IsNaN(*speedA) && !math.IsNaN(*speedB) {
			sd := math.Round(*speedA) - math.Round(*speedB)
			speedDelta = &sd
		}

		var throttleA, throttleB *float64
		if len(normA) > 0 {
			throttleA = interpolateAtDistance(normA, "throttle", dist, rangeEnd)
		}
		if len(normB) > 0 {
			throttleB = interpolateAtDistance(normB, "throttle", dist, rangeEnd)
		}

		var brakeA, brakeB *float64
		if len(normA) > 0 {
			brakeA = interpolateAtDistance(normA, "brake", dist, rangeEnd)
		}
		if len(normB) > 0 {
			brakeB = interpolateAtDistance(normB, "brake", dist, rangeEnd)
		}

		var steerA, steerB *float64
		if len(normA) > 0 {
			steerA = interpolateAtDistance(normA, "steer", dist, rangeEnd)
		}
		if len(normB) > 0 {
			steerB = interpolateAtDistance(normB, "steer", dist, rangeEnd)
		}

		var gearA, gearB *float64
		if len(normA) > 0 {
			gearA = interpolateAtDistance(normA, "gear", dist, rangeEnd)
		}
		if len(normB) > 0 {
			gearB = interpolateAtDistance(normB, "gear", dist, rangeEnd)
		}

		var ersBatteryA, ersBatteryB *float64
		if len(normA) > 0 {
			ersBatteryA = interpolateAtDistance(normA, "ers_store_energy", dist, rangeEnd)
		}
		if len(normB) > 0 {
			ersBatteryB = interpolateAtDistance(normB, "ers_store_energy", dist, rangeEnd)
		}

		var ersDeployModeA, ersDeployModeB *float64
		if len(normA) > 0 {
			ersDeployModeA = interpolateAtDistance(normA, "ers_deploy_mode", dist, rangeEnd)
		}
		if len(normB) > 0 {
			ersDeployModeB = interpolateAtDistance(normB, "ers_deploy_mode", dist, rangeEnd)
		}

		var activeAeroA, activeAeroB *float64
		if len(normA) > 0 {
			activeAeroA = interpolateAtDistance(normA, "active_aero_mode", dist, rangeEnd)
		}
		if len(normB) > 0 {
			activeAeroB = interpolateAtDistance(normB, "active_aero_mode", dist, rangeEnd)
		}

		var boostActiveA, boostActiveB *float64
		if len(normA) > 0 {
			boostActiveA = interpolateAtDistance(normA, "overtake_active", dist, rangeEnd)
		}
		if len(normB) > 0 {
			boostActiveB = interpolateAtDistance(normB, "overtake_active", dist, rangeEnd)
		}

		hasRawA := len(normA) > 0 && dist >= normA[0].LapDistance
		hasRawB := len(normB) > 0 && dist >= normB[0].LapDistance

		var worldX, worldZ *float64
		switch {
		case hasRawA:
			worldX = interpolateAtDistance(normA, "world_pos_x", dist, rangeEnd)
			worldZ = interpolateAtDistance(normA, "world_pos_z", dist, rangeEnd)
		case hasRawB:
			worldX = interpolateAtDistance(normB, "world_pos_x", dist, rangeEnd)
			worldZ = interpolateAtDistance(normB, "world_pos_z", dist, rangeEnd)
		case len(normA) > 0:
			worldX = interpolateAtDistance(normA, "world_pos_x", dist, rangeEnd)
			worldZ = interpolateAtDistance(normA, "world_pos_z", dist, rangeEnd)
		case len(normB) > 0:
			worldX = interpolateAtDistance(normB, "world_pos_x", dist, rangeEnd)
			worldZ = interpolateAtDistance(normB, "world_pos_z", dist, rangeEnd)
		}

		result = append(result, MergedTelemetryPoint{
			LapDistance:    dist,
			TimeDelta:      timeDelta,
			TimeA:          roundPtr(timeA, 3),
			TimeB:          roundPtr(timeB, 3),
			SpeedA:         roundPtr(speedA, 0),
			SpeedB:         roundPtr(speedB, 0),
			SpeedDelta:     speedDelta,
			ThrottleA:      roundPtr(throttleA, 2),
			ThrottleB:      roundPtr(throttleB, 2),
			BrakeA:         roundPtr(brakeA, 2),
			BrakeB:         roundPtr(brakeB, 2),
			SteerA:         roundPtr(steerA, 2),
			SteerB:         roundPtr(steerB, 2),
			GearA:          roundPtr(gearA, 0),
			GearB:          roundPtr(gearB, 0),
			ERSBatteryA:    roundPtr(ersBatteryA, 1),
			ERSBatteryB:    roundPtr(ersBatteryB, 1),
			ERSDeployModeA: roundPtr(ersDeployModeA, 0),
			ERSDeployModeB: roundPtr(ersDeployModeB, 0),
			ActiveAeroA:    roundPtr(activeAeroA, 0),
			ActiveAeroB:    roundPtr(activeAeroB, 0),
			BoostActiveA:   roundPtr(boostActiveA, 0),
			BoostActiveB:   roundPtr(boostActiveB, 0),
			WorldX:         roundPtr(worldX, 2),
			WorldZ:         roundPtr(worldZ, 2),
		})
	}

	// Calibrate initial delta at 0m to 0.000s
	var firstValidDelta *float64
	for _, pt := range result {
		if pt.TimeDelta != nil && !math.IsNaN(*pt.TimeDelta) {
			firstValidDelta = pt.TimeDelta
			break
		}
	}
	if firstValidDelta != nil && math.Abs(*firstValidDelta) > 0.0001 {
		offset := *firstValidDelta
		for i := range result {
			if result[i].TimeDelta != nil {
				td := math.Round((*result[i].TimeDelta-offset)*1000) / 1000
				result[i].TimeDelta = &td
			}
		}
	}

	return result
}

// DetectTrackTurns detects corner apexes and outward normal vectors along a track trajectory.
func DetectTrackTurns(points []MergedTelemetryPoint) []TrackTurn {
	valid := make([]MergedTelemetryPoint, 0, len(points))
	for _, p := range points {
		if p.WorldX != nil && p.WorldZ != nil && (*p.WorldX != 0 || *p.WorldZ != 0) {
			valid = append(valid, p)
		}
	}

	if len(valid) < MinPointsForTurnDetection {
		return []TrackTurn{}
	}

	turns := make([]TrackTurn, 0)
	w := TurnLookaroundWindow
	n := len(valid)

	// 1. Calculate heading angles along trajectory
	headings := make([]float64, n)
	for i := 0; i < n; i++ {
		p1Idx := i - w
		if p1Idx < 0 {
			p1Idx = 0
		}
		p2Idx := i + w
		if p2Idx >= n {
			p2Idx = n - 1
		}
		p1 := valid[p1Idx]
		p2 := valid[p2Idx]
		dx := *p2.WorldX - *p1.WorldX
		dz := *p2.WorldZ - *p1.WorldZ
		headings[i] = math.Atan2(dz, dx)
	}

	// 2. Calculate angular change rate (curvature)
	curvatures := make([]float64, n)
	for i := 1; i < n-1; i++ {
		diff := headings[i+1] - headings[i-1]
		for diff > math.Pi {
			diff -= 2 * math.Pi
		}
		for diff < -math.Pi {
			diff += 2 * math.Pi
		}
		distStep := math.Max(1, valid[i+1].LapDistance-valid[i-1].LapDistance)
		curvatures[i] = math.Abs(diff) / distStep
	}

	// 3. Smooth curvatures with rolling average
	smoothed := make([]float64, n)
	smoothW := TurnLookaroundWindow
	for i := 0; i < n; i++ {
		sum := 0.0
		count := 0
		start := i - smoothW
		if start < 0 {
			start = 0
		}
		end := i + smoothW
		if end >= n {
			end = n - 1
		}
		for j := start; j <= end; j++ {
			sum += curvatures[j]
			count++
		}
		if count > 0 {
			smoothed[i] = sum / float64(count)
		}
	}

	// 4. Find local peaks in curvature that correspond to turns
	lastTurnDist := -999.0

	for i := smoothW; i < n-smoothW; i++ {
		cur := smoothed[i]
		dist := valid[i].LapDistance

		if cur > TurnCurvatureThreshold &&
			cur >= smoothed[i-1] &&
			cur >= smoothed[i+1] &&
			dist-lastTurnDist >= MinTurnDistSpacing {

			// Find local speed minimum in a radius around this peak
			apexIdx := i
			minSpeed := 999.0
			searchRadius := n / 20
			if searchRadius > TurnApexSearchRadiusMax {
				searchRadius = TurnApexSearchRadiusMax
			}

			startK := i - searchRadius
			if startK < 0 {
				startK = 0
			}
			endK := i + searchRadius
			if endK >= n {
				endK = n - 1
			}

			for k := startK; k <= endK; k++ {
				spd := 999.0
				if valid[k].SpeedA != nil {
					spd = *valid[k].SpeedA
				} else if valid[k].SpeedB != nil {
					spd = *valid[k].SpeedB
				}
				if spd < minSpeed {
					minSpeed = spd
					apexIdx = k
				}
			}

			apexPt := valid[apexIdx]

			// Calculate outward normal vector for apex
			prevIdx := apexIdx - 3
			if prevIdx < 0 {
				prevIdx = 0
			}
			nextIdx := apexIdx + 3
			if nextIdx >= n {
				nextIdx = n - 1
			}

			pPrev := valid[prevIdx]
			pNext := valid[nextIdx]
			v1x := *apexPt.WorldX - *pPrev.WorldX
			v1z := *apexPt.WorldZ - *pPrev.WorldZ
			v2x := *pNext.WorldX - *apexPt.WorldX
			v2z := *pNext.WorldZ - *apexPt.WorldZ

			ax := v2x - v1x
			az := v2z - v1z
			aLen := math.Hypot(ax, az)

			normX := 0.0
			normZ := 0.0
			if aLen > 0.0001 {
				normX = -ax / aLen
				normZ = -az / aLen
			} else {
				tx := *pNext.WorldX - *pPrev.WorldX
				tz := *pNext.WorldZ - *pPrev.WorldZ
				tLen := math.Hypot(tx, tz)
				if tLen == 0 {
					tLen = 1
				}
				normX = -tz / tLen
				normZ = tx / tLen
			}

			turnNum := len(turns) + 1
			apexDist := math.Round(apexPt.LapDistance)
			turns = append(turns, TrackTurn{
				TurnNumber:    turnNum,
				Name:          fmt.Sprintf("T%d", turnNum),
				Distance:      apexDist,
				EntryDistance: math.Max(0, apexDist-TurnEntryOffsetMeters),
				ExitDistance:  apexDist + TurnExitOffsetMeters,
				WorldX:        *apexPt.WorldX,
				WorldZ:        *apexPt.WorldZ,
				NormalX:       normX,
				NormalZ:       normZ,
				SpeedA:        apexPt.SpeedA,
				SpeedB:        apexPt.SpeedB,
			})

			lastTurnDist = apexPt.LapDistance
			if apexIdx+3 > i {
				i = apexIdx + 3
			}
		}
	}

	return turns
}

// LapNotFoundError indicates that a requested lap ID was not found in the database.
type LapNotFoundError struct {
	LapID int64
	Label string // "A" or "B"
}

func (e *LapNotFoundError) Error() string {
	return fmt.Sprintf("Lap %s (%d) not found", e.Label, e.LapID)
}

func fetchLapMetaAndSamples(ctx context.Context, repo storage.Repository, lapID int64, label string) (*ComparatorLapMeta, []storage.TelemetrySample, int, error) {
	lap, err := repo.GetLapByID(ctx, lapID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil, 0, &LapNotFoundError{LapID: lapID, Label: label}
		}
		return nil, nil, 0, fmt.Errorf("failed to get lap %s (%d): %w", label, lapID, err)
	}

	driverName := fmt.Sprintf("Lap #%d", lap.LapNumber)
	participants, pErr := repo.GetParticipantsBySession(ctx, lap.SessionID)
	if pErr != nil {
		return nil, nil, 0, fmt.Errorf("failed to get participants for lap %s (%d): %w", label, lapID, pErr)
	}
	for _, p := range participants {
		if p.CarIndex == lap.CarIndex {
			driverName = fmt.Sprintf("#%d %s", p.RaceNumber, p.Name)
			break
		}
	}

	meta := &ComparatorLapMeta{
		LapID:     lap.ID,
		LapTimeMS: lap.LapTimeMS,
		Driver:    driverName,
		Compound:  lap.TyreCompound,
		TyreAge:   lap.Stint,
	}

	samples, sErr := repo.GetTelemetryByLap(ctx, lapID)
	if sErr != nil {
		return nil, nil, 0, fmt.Errorf("failed to get telemetry for lap %s (%d): %w", label, lapID, sErr)
	}

	var raw []storage.TelemetrySample
	if len(samples) > 0 {
		raw = TrimTelemetryToLastLapAttempt(samples)
	}

	return meta, raw, lap.LapTimeMS, nil
}

// MergeLapComparison orchestrates fetching lap data, telemetry samples, and merging them along track distance.
func MergeLapComparison(ctx context.Context, repo storage.Repository, lapAID, lapBID int64, stepMeters, targetTrackLength float64) (*ComparatorResponse, error) {
	if lapAID <= 0 && lapBID <= 0 {
		return &ComparatorResponse{
			Points: []MergedTelemetryPoint{},
			Turns:  []TrackTurn{},
		}, nil
	}

	var rawA, rawB []storage.TelemetrySample
	var lapTimeMsA, lapTimeMsB int
	var metaA, metaB *ComparatorLapMeta

	if lapAID > 0 {
		var err error
		metaA, rawA, lapTimeMsA, err = fetchLapMetaAndSamples(ctx, repo, lapAID, "A")
		if err != nil {
			return nil, err
		}
	}

	if lapBID > 0 {
		var err error
		metaB, rawB, lapTimeMsB, err = fetchLapMetaAndSamples(ctx, repo, lapBID, "B")
		if err != nil {
			return nil, err
		}
	}

	points := CalculateMergedComparison(rawA, rawB, stepMeters, targetTrackLength, lapTimeMsA, lapTimeMsB)
	turns := DetectTrackTurns(points)

	return &ComparatorResponse{
		Points: points,
		Turns:  turns,
		LapA:   metaA,
		LapB:   metaB,
	}, nil
}
