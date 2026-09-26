package analytics

import (
	"context"
	"fmt"
	"math"
	"strings"

	"github.com/mgauna/f1game-telemetry-go/internal/ai"
	"github.com/mgauna/f1game-telemetry-go/internal/packets"
	"github.com/mgauna/f1game-telemetry-go/internal/storage"
)

// AI chat context constants.
const (
	// DebriefMaxDrivers is how many classified drivers the session debrief lists.
	DebriefMaxDrivers = 10
	// HeavyBrakingPct is the brake pressure (%) where a braking zone starts.
	HeavyBrakingPct = 40.0
	// BrakingZoneMinPeakPct is the peak brake pressure (%) a zone needs to count as heavy braking.
	BrakingZoneMinPeakPct = 50.0
	// BrakingZoneExamples is how many braking zones the comparison describes.
	BrakingZoneExamples = 5
	// TurnLabelMaxDistanceMeters is how close a detected turn must be to name a braking zone after it.
	TurnLabelMaxDistanceMeters = 130.0
)

// ChatContextSource builds AI chat context for recorded sessions and laps from the repository.
// It implements ai.RecordedRaceSource.
type ChatContextSource struct {
	repo  storage.Repository
	cache *ComparatorLRUCache
}

// NewChatContextSource returns a source reading repo; merged lap comparisons go through cache,
// which may be nil.
func NewChatContextSource(repo storage.Repository, cache *ComparatorLRUCache) *ChatContextSource {
	return &ChatContextSource{repo: repo, cache: cache}
}

// SessionDebrief summarizes a recorded session's classification for the debrief chat.
func (s *ChatContextSource) SessionDebrief(ctx context.Context, sessionID int64) (ai.SessionDebrief, error) {
	session, err := s.repo.GetSessionByID(ctx, sessionID)
	if err != nil {
		return ai.SessionDebrief{}, err
	}
	participants, err := s.repo.GetParticipantsBySession(ctx, sessionID)
	if err != nil {
		return ai.SessionDebrief{}, fmt.Errorf("failed to get participants for session %d: %w", sessionID, err)
	}
	laps, err := s.repo.GetLapsBySession(ctx, sessionID, nil)
	if err != nil {
		return ai.SessionDebrief{}, fmt.Errorf("failed to get laps for session %d: %w", sessionID, err)
	}
	return BuildSessionDebrief(session, ComputeSessionClassification(session, participants, laps)), nil
}

// LapComparison merges two laps the way the Lap Comparator charts do and analyzes them.
func (s *ChatContextSource) LapComparison(ctx context.Context, lapAID, lapBID int64, zoom *ai.ChatZoomRange) (*ai.LapComparison, error) {
	merged, err := MergeLapComparisonCached(ctx, s.repo, s.cache, lapAID, lapBID, DefaultComparatorStepMeters, 0)
	if err != nil {
		return nil, err
	}
	in := LapComparisonInput{Merged: merged, Zoom: zoom}
	if in.LapA, in.SessionA, err = s.lapWithSession(ctx, lapAID); err != nil {
		return nil, err
	}
	if in.LapB, in.SessionB, err = s.lapWithSession(ctx, lapBID); err != nil {
		return nil, err
	}
	return BuildLapComparison(in), nil
}

func (s *ChatContextSource) lapWithSession(ctx context.Context, lapID int64) (*storage.Lap, *storage.Session, error) {
	lap, err := s.repo.GetLapByID(ctx, lapID)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to get lap %d: %w", lapID, err)
	}
	session, err := s.repo.GetSessionByID(ctx, lap.SessionID)
	if err != nil {
		return nil, nil, err
	}
	return lap, session, nil
}

// BuildSessionDebrief writes the session classification summary the debrief chat reads.
func BuildSessionDebrief(session *storage.Session, cls *ClassificationResponse) ai.SessionDebrief {
	var sb strings.Builder
	standings := cls.Standings

	sb.WriteString("SESSION CLASSIFICATION & METRICS:\n")
	fmt.Fprintf(&sb, "- Circuit: %s\n", session.TrackName)
	fmt.Fprintf(&sb, "- Session Type: %s\n", session.SessionType)
	fmt.Fprintf(&sb, "- League / Category Tags: %s\n", tagNames(session.Tags))
	fmt.Fprintf(&sb, "- Weather: %s\n", orDefault(session.Weather, "Clear"))
	fmt.Fprintf(&sb, "- Total Drivers in Session: %d\n", len(standings))
	winner := "N/A"
	if len(standings) > 0 {
		winner = fmt.Sprintf("%s (#%d)", standings[0].DriverName, standings[0].RaceNumber)
	}
	fmt.Fprintf(&sb, "- Session Winner / P1: %s\n", winner)
	fastest := "N/A"
	if cls.ActualBestLapMS > 0 {
		fastest = fmt.Sprintf("%s (%s)", cls.ActualBestLapDriver, lapTimeText(cls.ActualBestLapMS))
	}
	fmt.Fprintf(&sb, "- Fastest Lap of Session: %s\n", fastest)
	fmt.Fprintf(&sb, "- Session Record Sectors: S1: %s | S2: %s | S3: %s\n",
		sectorText(cls.SessionBestS1MS), sectorText(cls.SessionBestS2MS), sectorText(cls.SessionBestS3MS))
	theoretical := "N/A"
	if cls.UltimateTheoreticalMS > 0 {
		theoretical = lapTimeText(cls.UltimateTheoreticalMS)
	}
	fmt.Fprintf(&sb, "- Theoretical Best Lap of Session: %s\n", theoretical)

	sb.WriteString("\nOFFICIAL DRIVER CLASSIFICATION & STINT BREAKDOWN:\n")
	for i := range standings {
		if i == DebriefMaxDrivers {
			break
		}
		writeDebriefStanding(&sb, &standings[i])
	}
	return ai.SessionDebrief{Summary: sb.String()}
}

func writeDebriefStanding(sb *strings.Builder, d *DriverStanding) {
	gap := "-"
	switch {
	case d.Position == 1:
		gap = "WINNER / LEADER"
	case d.GapToLeaderMS > 0:
		gap = fmt.Sprintf("+%.3fs", float64(d.GapToLeaderMS)/packets.MillisPerSecond)
	}
	driver := "(HUMAN PLAYER)"
	if d.AIControlled {
		driver = "(AI)"
	}
	status := "Finished"
	switch {
	case d.IsDSQ:
		status = "DSQ"
	case d.IsDNF:
		status = "DNF"
	}
	fmt.Fprintf(sb, "- P%d: %s (#%d) %s | Total Time/Gap: %s | Best Lap: %s | S1: %s, S2: %s, S3: %s | Max Speed: %.1f km/h | Stints: %s | Laps: %d | Status: %s\n",
		d.Position, d.DriverName, d.RaceNumber, driver, gap, lapTimeText(d.BestLapTimeMS),
		sectorText(d.BestS1MS), sectorText(d.BestS2MS), sectorText(d.BestS3MS),
		d.MaxSpeed, orDefault(d.StintsSummary, "No stint data"), d.LapsCompleted, status)
}

// LapComparisonInput is what BuildLapComparison analyzes: the merged telemetry of two laps,
// the laps and their sessions, and the zoomed segment if any.
type LapComparisonInput struct {
	Merged             *ComparatorResponse
	LapA, LapB         *storage.Lap
	SessionA, SessionB *storage.Session
	Zoom               *ai.ChatZoomRange
}

// brakingZone is a stretch of heavy braking by either car.
type brakingZone struct {
	startDist        float64
	peakA, peakB     float64
	minSpeedA        float64
	minSpeedB        float64
	hasMinA, hasMinB bool
}

// BuildLapComparison describes where lap A gains or loses against lap B: speeds, ERS use,
// braking zones and the zoomed segment. It returns nil when there is no merged telemetry.
func BuildLapComparison(in LapComparisonInput) *ai.LapComparison {
	if in.Merged == nil || len(in.Merged.Points) == 0 || in.LapA == nil || in.LapB == nil {
		return nil
	}
	points := in.Merged.Points
	turns := in.Merged.Turns
	nameA := lapDriver(in.Merged.LapA, in.LapA)
	nameB := lapDriver(in.Merged.LapB, in.LapB)

	c := &ai.LapComparison{
		LapAName:         fmt.Sprintf("%s (Lap %d)", nameA, in.LapA.LapNumber),
		LapBName:         fmt.Sprintf("%s (Lap %d)", nameB, in.LapB.LapNumber),
		LapATime:         lapTimeText(in.LapA.LapTimeMS),
		LapBTime:         lapTimeText(in.LapB.LapTimeMS),
		TimeDeltaSeconds: float64(in.LapA.LapTimeMS-in.LapB.LapTimeMS) / packets.MillisPerSecond,
		CompoundA:        orDefault(in.LapA.TyreCompound, "Unknown"),
		CompoundB:        orDefault(in.LapB.TyreCompound, "Unknown"),
		SectorsA:         lapSectors(in.LapA),
		SectorsB:         lapSectors(in.LapB),
	}
	if c.TimeDeltaSeconds < 0 {
		c.FasterLap = fmt.Sprintf("Lap A (%s)", nameA)
	} else {
		c.FasterLap = fmt.Sprintf("Lap B (%s)", nameB)
	}
	applySessions(c, in.SessionA, in.SessionB)

	var ersA, ersB int
	for _, p := range points {
		c.TopSpeedA = math.Max(c.TopSpeedA, valueOr(p.SpeedA, 0))
		c.TopSpeedB = math.Max(c.TopSpeedB, valueOr(p.SpeedB, 0))
		if valueOr(p.ERSDeployModeA, 0) > 0 {
			ersA++
		}
		if valueOr(p.ERSDeployModeB, 0) > 0 {
			ersB++
		}
	}
	c.ERSUsedPctA = float64(ersA) / float64(len(points)) * percentScale
	c.ERSUsedPctB = float64(ersB) / float64(len(points)) * percentScale

	c.BrakingSummary, c.ApexSpeedSummary = describeBrakingZones(findBrakingZones(points), turns)
	c.ThrottleSummary = fmt.Sprintf("Top speed reached: A=%.1f km/h vs B=%.1f km/h. Top speed delta: %.1f km/h.", c.TopSpeedA, c.TopSpeedB, c.TopSpeedA-c.TopSpeedB)
	c.ERSDRSSummary = fmt.Sprintf("Active ERS deployment: A=%.1f%% vs B=%.1f%% of lap distance.", c.ERSUsedPctA, c.ERSUsedPctB)
	c.Zoom = describeZoom(points, turns, in.Zoom)
	return c
}

const percentScale = 100.0

func applySessions(c *ai.LapComparison, a, b *storage.Session) {
	c.TrackName = "F1 Circuit"
	c.SessionTypeA = "Session"
	if a != nil {
		c.TrackName = orDefault(a.TrackName, c.TrackName)
		c.SessionTypeA = orDefault(a.SessionType, c.SessionTypeA)
		c.WeatherA = a.Weather
	}
	c.SessionTypeB = c.SessionTypeA
	if b != nil {
		c.SessionTypeB = orDefault(b.SessionType, c.SessionTypeB)
		c.WeatherB = b.Weather
	}
	c.CrossSession = c.SessionTypeA != c.SessionTypeB ||
		(c.WeatherA != "" && c.WeatherB != "" && c.WeatherA != c.WeatherB)
}

// findBrakingZones finds the stretches where either car brakes hard, with each car's peak
// brake pressure and minimum speed in them.
func findBrakingZones(points []MergedTelemetryPoint) []brakingZone {
	var zones []brakingZone
	var zone *brakingZone
	closeZone := func() {
		if zone != nil && (zone.peakA > BrakingZoneMinPeakPct || zone.peakB > BrakingZoneMinPeakPct) {
			zones = append(zones, *zone)
		}
		zone = nil
	}
	for _, p := range points {
		brakeA, brakeB := brakePct(p.BrakeA), brakePct(p.BrakeB)
		if brakeA <= HeavyBrakingPct && brakeB <= HeavyBrakingPct {
			closeZone()
			continue
		}
		if zone == nil {
			zone = &brakingZone{startDist: p.LapDistance}
		}
		zone.peakA = math.Max(zone.peakA, brakeA)
		zone.peakB = math.Max(zone.peakB, brakeB)
		if p.SpeedA != nil && (!zone.hasMinA || *p.SpeedA < zone.minSpeedA) {
			zone.minSpeedA, zone.hasMinA = *p.SpeedA, true
		}
		if p.SpeedB != nil && (!zone.hasMinB || *p.SpeedB < zone.minSpeedB) {
			zone.minSpeedB, zone.hasMinB = *p.SpeedB, true
		}
	}
	closeZone()
	return zones
}

func describeBrakingZones(zones []brakingZone, turns []TrackTurn) (braking, apex string) {
	if len(zones) == 0 {
		return "", ""
	}
	examples := zones[:min(len(zones), BrakingZoneExamples)]
	brakeParts := make([]string, 0, len(examples))
	var apexParts []string
	for _, z := range examples {
		label := turnLabel(z.startDist, turns)
		brakeParts = append(brakeParts, fmt.Sprintf("%s (Peak: A=%.0f%% vs B=%.0f%%)", label, z.peakA, z.peakB))
		if z.hasMinA && z.hasMinB && z.minSpeedA > 0 && z.minSpeedB > 0 {
			apexParts = append(apexParts, fmt.Sprintf("At %s: min speed A=%.0f km/h vs B=%.0f km/h", label, z.minSpeedA, z.minSpeedB))
		}
	}
	braking = fmt.Sprintf("Detected %d heavy braking zones. Examples at: %s", len(zones), strings.Join(brakeParts, ", "))
	return braking, strings.Join(apexParts, "; ")
}

// turnLabel names a lap distance after the closest detected turn, if one is near enough.
func turnLabel(dist float64, turns []TrackTurn) string {
	meters := math.Round(dist)
	best := TurnLabelMaxDistanceMeters
	name := ""
	for _, t := range turns {
		if diff := math.Abs(t.Distance - meters); diff < best {
			best, name = diff, t.Name
		}
	}
	if name == "" {
		return fmt.Sprintf("%.0fm", meters)
	}
	return fmt.Sprintf("%s (~%.0fm)", name, meters)
}

// describeZoom measures the zoomed segment: time gained or lost in it, the apex speed
// difference and where each car starts braking.
func describeZoom(points []MergedTelemetryPoint, turns []TrackTurn, zoom *ai.ChatZoomRange) *ai.ZoomedRangeInfo {
	if zoom == nil || zoom.EndMeters <= zoom.StartMeters {
		return nil
	}
	var inZoom []MergedTelemetryPoint
	for _, p := range points {
		if p.LapDistance >= zoom.StartMeters && p.LapDistance <= zoom.EndMeters {
			inZoom = append(inZoom, p)
		}
	}
	if len(inZoom) == 0 {
		return nil
	}

	first, last := inZoom[0], inZoom[len(inZoom)-1]
	startDelta, _ := timeGap(first)
	endDelta, ok := timeGap(last)
	if !ok {
		endDelta = startDelta
	}

	info := &ai.ZoomedRangeInfo{
		StartDistanceMeters: math.Round(zoom.StartMeters),
		EndDistanceMeters:   math.Round(zoom.EndMeters),
		DeltaInSegment:      endDelta - startDelta,
	}

	minA, minB := math.Inf(1), math.Inf(1)
	brakeA, brakeB := math.NaN(), math.NaN()
	for _, p := range inZoom {
		if p.SpeedA != nil {
			minA = math.Min(minA, *p.SpeedA)
		}
		if p.SpeedB != nil {
			minB = math.Min(minB, *p.SpeedB)
		}
		if math.IsNaN(brakeA) && brakePct(p.BrakeA) > HeavyBrakingPct {
			brakeA = p.LapDistance
		}
		if math.IsNaN(brakeB) && brakePct(p.BrakeB) > HeavyBrakingPct {
			brakeB = p.LapDistance
		}
	}
	if !math.IsInf(minA, 1) && !math.IsInf(minB, 1) {
		info.SpeedDiffAtApex = minA - minB
	}
	if !math.IsNaN(brakeA) && !math.IsNaN(brakeB) {
		info.BrakingDiffMeters = brakeA - brakeB
		info.HasBrakingDiff = true
	}

	var names []string
	for _, t := range turns {
		if t.Distance >= zoom.StartMeters && t.Distance <= zoom.EndMeters {
			names = append(names, t.Name)
		}
	}
	if len(names) > 0 {
		info.Description = fmt.Sprintf("Sector with %s (%.0fm to %.0fm)", strings.Join(names, ", "), info.StartDistanceMeters, info.EndDistanceMeters)
	} else {
		info.Description = fmt.Sprintf("Specific sector from %.0fm to %.0fm", info.StartDistanceMeters, info.EndDistanceMeters)
	}
	return info
}

// timeGap is lap A's elapsed time minus lap B's at a point, when both are known.
func timeGap(p MergedTelemetryPoint) (float64, bool) {
	if p.TimeA == nil || p.TimeB == nil {
		return 0, false
	}
	return *p.TimeA - *p.TimeB, true
}

func lapDriver(meta *ComparatorLapMeta, lap *storage.Lap) string {
	if meta != nil && meta.Driver != "" {
		return meta.Driver
	}
	return fmt.Sprintf("Car %d", lap.CarIndex)
}

func lapSectors(l *storage.Lap) [3]string {
	return [3]string{sectorText(l.Sector1MS), sectorText(l.Sector2MS), sectorText(l.Sector3MS)}
}

func lapTimeText(ms int) string {
	if ms <= 0 {
		return packets.NoLapTime
	}
	return packets.FormatLapTimeMS(uint32(ms))
}

func sectorText(ms int) string {
	if ms <= 0 {
		return "-"
	}
	return fmt.Sprintf("%.3fs", float64(ms)/packets.MillisPerSecond)
}

func tagNames(tags []storage.Tag) string {
	if len(tags) == 0 {
		return "None"
	}
	names := make([]string, len(tags))
	for i, t := range tags {
		names[i] = t.Name
	}
	return strings.Join(names, ", ")
}

// brakePct converts a merged brake input (0..1) to percent.
func brakePct(v *float64) float64 {
	return valueOr(v, 0) * percentScale
}

func valueOr(v *float64, fallback float64) float64 {
	if v == nil {
		return fallback
	}
	return *v
}

func orDefault(s, fallback string) string {
	if strings.TrimSpace(s) == "" {
		return fallback
	}
	return s
}
