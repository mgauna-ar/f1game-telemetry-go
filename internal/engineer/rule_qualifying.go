package engineer

import (
	"fmt"
	"math"
	"sync"

	"github.com/mgauna/f1game-telemetry-go/internal/packets"
)

// QualifyingRule manages lap invalidation, qualifying traffic, the session clock and elimination
// danger.
type QualifyingRule struct {
	mu                   sync.Mutex
	lastInvalidLapNum    int
	lastOutLapChecked    int
	lastInLapCooldownLap int
	sessionTimeCalled    bool
	elimCalled           bool
	elimLeftZone         bool // out of the danger zone since the last elimination call
	// The player's lap each car was last called on, as a car on a push lap behind or as a slow car
	// ahead (0: not called).
	behindCalled [packets.MaxCars]uint8
	aheadCalled  [packets.MaxCars]uint8
	// The push lap the player is on (0: none) and whether it was invalidated; the player's best
	// valid push lap this session; and when the lap just finished is reported (0: none due).
	pushLap        uint8
	pushLapInvalid bool
	bestLapMS      uint32
	resultDueAt    int64
}

// NewQualifyingRule creates a new QualifyingRule.
func NewQualifyingRule() *QualifyingRule {
	return &QualifyingRule{
		lastInvalidLapNum:    -1,
		lastOutLapChecked:    -1,
		lastInLapCooldownLap: -1,
	}
}

func (r *QualifyingRule) Name() string {
	return "qualifying"
}

func (r *QualifyingRule) Category() string {
	return string(DirectiveCategoryQualifying)
}

// ValidPhases includes PhasePostRace: the last lap's result comes after the chequered flag.
func (r *QualifyingRule) ValidPhases() []DrivingPhase {
	return []DrivingPhase{PhaseInGarage, PhasePitLane, PhaseOutLap, PhaseFlyingLap, PhaseInLap, PhasePostRace}
}

func (r *QualifyingRule) AlertKeys() map[string]AlertKeyConfig {
	return map[string]AlertKeyConfig{
		"qualy_invalid": {
			ValidPhases:        []DrivingPhase{PhaseOutLap, PhaseFlyingLap},
			DedupScope:         DedupScopeLap,
			BreaksRadioSilence: true,
		},
		"qualy_traffic": {
			ValidPhases:          []DrivingPhase{PhaseOutLap},
			MinLapDistancePct:    MinQualyOutLapDistancePct,
			DedupScope:           DedupScopeLap,
			MaxDelayMs:           MomentMaxDelayMs,
			SkipCategoryCooldown: true,
		},
		"qualy_traffic_ahead": {
			Category:           DirectiveCategoryQualifying,
			ValidPhases:        []DrivingPhase{PhaseFlyingLap},
			DedupScope:         DedupScopeNone,
			MaxDelayMs:         MomentMaxDelayMs,
			MinRepeatMs:        TrafficMinRepeatMs,
			BreaksRadioSilence: true,
		},
		"qualy_time": {
			ValidPhases: []DrivingPhase{PhaseInGarage, PhasePitLane, PhaseOutLap, PhaseInLap},
			DedupScope:  DedupScopePhase,
		},
		"qualy_elim": {
			ValidPhases: []DrivingPhase{PhaseInGarage, PhasePitLane, PhaseOutLap, PhaseInLap},
			DedupScope:  DedupScopePhase,
		},
		"inlap_traffic_behind": {
			Category:    DirectiveCategoryQualifying,
			ValidPhases: []DrivingPhase{PhaseOutLap, PhaseInLap},
			DedupScope:  DedupScopeNone,
			MaxDelayMs:  MomentMaxDelayMs,
			MinRepeatMs: TrafficMinRepeatMs,
		},
		"qualy_lap_result": {
			Category:             DirectiveCategoryQualifying,
			ValidPhases:          []DrivingPhase{PhaseOutLap, PhaseFlyingLap, PhaseInLap, PhasePitLane, PhaseInGarage, PhasePostRace},
			DedupScope:           DedupScopeNone,
			MaxDelayMs:           MomentMaxDelayMs,
			SkipCategoryCooldown: true,
			BreaksRadioSilence:   true,
		},
		"inlap_cooldown": {
			Category:    DirectiveCategoryCoaching,
			ValidPhases: []DrivingPhase{PhaseInLap},
			DedupScope:  DedupScopeLap,
		},
	}
}

// Reset clears the rule's state. The session clock and elimination calls are made once per
// session (a new qualifying segment is a new session), so only a session reset clears them.
func (r *QualifyingRule) Reset(scope DedupScope) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if scope == DedupScopeLap || scope == DedupScopeNone {
		r.lastInvalidLapNum = -1
		r.lastOutLapChecked = -1
		r.lastInLapCooldownLap = -1
	}
	if scope == DedupScopePhase || scope == DedupScopeNone {
		r.lastInLapCooldownLap = -1
		r.behindCalled = [packets.MaxCars]uint8{}
		r.aheadCalled = [packets.MaxCars]uint8{}
	}
	if scope == DedupScopeNone {
		r.sessionTimeCalled = false
		r.elimCalled = false
		r.elimLeftZone = false
		r.pushLap = 0
		r.pushLapInvalid = false
		r.bestLapMS = 0
		r.resultDueAt = 0
	}
}

func (r *QualifyingRule) Evaluate(ctx *EvaluationContext) []Directive {
	r.mu.Lock()
	defer r.mu.Unlock()

	var directives []Directive
	add := func(d *Directive) {
		if d != nil {
			directives = append(directives, *d)
		}
	}

	playerLap := ctx.PlayerLap()
	if ctx.Packet == nil || isPacketType[*packets.PacketSessionData](ctx.Packet) {
		add(r.evaluateSessionClock(ctx))
		add(r.evaluateElimination(ctx, playerLap))
	}
	if playerLap == nil || (ctx.Packet != nil && !isPacketType[*packets.PacketLapData](ctx.Packet)) {
		return directives
	}
	add(r.evaluateLapResult(ctx, playerLap))
	add(r.evaluateInvalidLap(ctx, playerLap))
	add(r.evaluateOutLapTraffic(ctx, playerLap))
	add(r.evaluateCooldown(ctx, playerLap))
	add(r.evaluateCarBehind(ctx, playerLap))
	add(r.evaluateTrafficAhead(ctx, playerLap))
	return directives
}

// timedSession reports whether the session is one of timed laps: qualifying or practice.
func timedSession(ctx *EvaluationContext) bool {
	return ctx.IsQualifyingSession() || ctx.IsPracticeSession()
}

// evaluateInvalidLap calls a push lap the game has invalidated, once a lap. Races have no lap to
// delete; their corner cutting is the track limits warning.
func (r *QualifyingRule) evaluateInvalidLap(ctx *EvaluationContext, playerLap *packets.LapData) *Directive {
	if ctx.IsRaceSession() || playerLap.CurrentLapInvalid != 1 || playerLap.DriverStatus != packets.DriverStatusFlyingLap {
		return nil
	}
	currentLap := int(playerLap.CurrentLapNum)
	if currentLap == r.lastInvalidLapNum {
		return nil
	}
	r.lastInvalidLapNum = currentLap
	return &Directive{
		ID:       "qualy_invalid",
		Category: DirectiveCategoryQualifying,
		SubAlert: "qualy_deleted_lap",
		Title:    "Lap Invalid",
		Message:  fmt.Sprintf("Lap %d is invalid, it won't count. Back off, recharge and set up the next push lap.", currentLap),
		Urgency:  UrgencyCritical,
	}
}

// evaluateOutLapTraffic tells the driver, once in the final sector of a qualifying out-lap,
// whether the push lap starts in traffic or in clean air: the gap to the nearest car on track ahead
// at push pace.
func (r *QualifyingRule) evaluateOutLapTraffic(ctx *EvaluationContext, playerLap *packets.LapData) *Directive {
	if !ctx.IsQualifyingSession() || ctx.Phase != PhaseOutLap || ctx.LapData == nil {
		return nil
	}
	trackLen := ctx.TrackLengthM()
	currentLap := int(playerLap.CurrentLapNum)
	inFinalSector := playerLap.Sector >= 2 || playerLap.LapDistance > trackLen*FinalSectorTrackDistanceFraction
	if !inFinalSector || r.lastOutLapChecked == currentLap {
		return nil
	}
	r.lastOutLapChecked = currentLap

	nearest := float32(-1)
	for i := range ctx.LapData.LapData {
		rival := &ctx.LapData.LapData[i]
		if i == ctx.PlayerCarIndex || !onTrack(rival) {
			continue
		}
		if gap := trackGapM(playerLap.LapDistance, rival.LapDistance, trackLen); nearest < 0 || gap < nearest {
			nearest = gap
		}
	}

	if nearest >= 0 && pushLapGapSec(nearest) < float64(ctx.Config.QualyCleanAirSec) {
		gapSec := roundTo(pushLapGapSec(nearest), 1)
		return &Directive{
			ID:       "qualy_traffic",
			Category: DirectiveCategoryQualifying,
			SubAlert: "qualy_traffic",
			Title:    "Traffic Ahead on Out-Lap",
			Message:  fmt.Sprintf("Traffic ahead before the push lap: car ahead is %.1fs away. Back off and make a gap.", gapSec),
			Urgency:  UrgencyHigh,
			Values:   &DirectiveValues{Ahead: &GapToCar{GapSec: gapSec}},
		}
	}
	return &Directive{
		ID:       "qualy_traffic",
		Category: DirectiveCategoryQualifying,
		SubAlert: "qualy_clean_air",
		Title:    "Clean Air Window",
		Message:  "Track is clear ahead. Prepare the tyres and push out of the final corner.",
		Urgency:  UrgencyLow,
	}
}

// evaluateSessionClock warns once a session when the clock drops under QualyTimeWarnSec. On a
// push lap it waits for the lap to end, so the call is made rather than lost to the lap's radio
// silence.
func (r *QualifyingRule) evaluateSessionClock(ctx *EvaluationContext) *Directive {
	s := ctx.Session
	if s == nil || r.sessionTimeCalled || ctx.Phase == PhaseFlyingLap || !timedSession(ctx) ||
		s.SessionTimeLeft == 0 || float32(s.SessionTimeLeft) > ctx.Config.QualyTimeWarnSec {
		return nil
	}
	r.sessionTimeCalled = true
	minutes := minutesLeft(s.SessionTimeLeft)
	sessionName := packets.SessionTypeName(s.SessionType)

	subAlert := "qualy_session_time"
	msg := fmt.Sprintf("Under %d minutes left in %s. Make sure you cross the line before the flag.", minutes, sessionName)
	if ctx.Phase == PhaseInGarage || ctx.Phase == PhasePitLane {
		subAlert = "qualy_session_time_garage"
		msg = fmt.Sprintf("Under %d minutes left in %s. Time to go out for the last run.", minutes, sessionName)
	}
	return &Directive{
		ID:       "qualy_time",
		Category: DirectiveCategoryQualifying,
		SubAlert: subAlert,
		Title:    "Session Time Warning",
		Message:  msg,
		Urgency:  UrgencyCritical,
		Values:   &DirectiveValues{Minutes: minutes},
	}
}

// evaluateElimination warns in the last QualyElimDangerTimeSec of Q1 and Q2 when the player sits
// on the last place through or in the drop zone: once, and once more each time they drop back
// into it. On a push lap it waits for the lap to end.
func (r *QualifyingRule) evaluateElimination(ctx *EvaluationContext, playerLap *packets.LapData) *Directive {
	s := ctx.Session
	if s == nil || !ctx.IsQualifyingSession() || ctx.Phase == PhaseFlyingLap || playerLap == nil || playerLap.CarPosition == 0 ||
		s.SessionTimeLeft == 0 || float32(s.SessionTimeLeft) > QualyElimDangerTimeSec {
		return nil
	}
	lastSafe := lastSafePosition(ctx)
	if lastSafe == 0 {
		return nil
	}
	pos := int(playerLap.CarPosition)
	if pos < lastSafe {
		if r.elimCalled {
			r.elimLeftZone = true
		}
		return nil
	}
	if r.elimCalled && !r.elimLeftZone {
		return nil
	}
	r.elimCalled = true
	r.elimLeftZone = false

	sessionName := packets.SessionTypeName(s.SessionType)
	subAlert := "qualy_elimination_danger"
	msg := fmt.Sprintf("P%d, in the drop zone with under %d minutes left in %s. We need to improve.", pos, minutesLeft(s.SessionTimeLeft), sessionName)
	if pos == lastSafe {
		subAlert = "qualy_elimination_bubble"
		msg = fmt.Sprintf("P%d, the last place through, with under %d minutes left in %s. We are at risk.", pos, minutesLeft(s.SessionTimeLeft), sessionName)
	}
	return &Directive{
		ID:       "qualy_elim",
		Category: DirectiveCategoryQualifying,
		SubAlert: subAlert,
		Title:    "Elimination Danger Zone",
		Message:  msg,
		Urgency:  UrgencyCritical,
		Values:   &DirectiveValues{Position: pos, Minutes: minutesLeft(s.SessionTimeLeft)},
	}
}

// evaluateCooldown says once per in-lap of a timed session to cool the car down, a little into the
// lap: at the line the lap result has the radio.
func (r *QualifyingRule) evaluateCooldown(ctx *EvaluationContext, playerLap *packets.LapData) *Directive {
	currentLap := int(playerLap.CurrentLapNum)
	if !timedSession(ctx) || ctx.Phase != PhaseInLap || r.lastInLapCooldownLap == currentLap ||
		playerLap.LapDistance < ctx.TrackLengthM()*InLapCooldownFromLapPct {
		return nil
	}
	r.lastInLapCooldownLap = currentLap
	return &Directive{
		ID:       "inlap_cooldown",
		Category: DirectiveCategoryCoaching,
		SubAlert: "inlap_cooldown",
		Title:    "Cool Down Car",
		Message:  "Cool-down lap. Recharge the battery, cool the brakes and tyres and bring the car home.",
		Urgency:  UrgencyLow,
	}
}

// evaluateCarBehind warns a player who isn't pushing (out-lap or in-lap of a timed session) of a
// car on a push lap closing from behind: the nearest within QualyCarBehindWarnSec, each car once
// per player lap.
func (r *QualifyingRule) evaluateCarBehind(ctx *EvaluationContext, playerLap *packets.LapData) *Directive {
	if !timedSession(ctx) || (ctx.Phase != PhaseOutLap && ctx.Phase != PhaseInLap) || ctx.LapData == nil {
		return nil
	}
	trackLen := ctx.TrackLengthM()
	best, bestGap := -1, float32(0)
	for i := range ctx.LapData.LapData {
		rival := &ctx.LapData.LapData[i]
		if i == ctx.PlayerCarIndex || rival.DriverStatus != packets.DriverStatusFlyingLap || !onTrack(rival) ||
			r.behindCalled[i] == playerLap.CurrentLapNum {
			continue
		}
		gap := trackGapM(rival.LapDistance, playerLap.LapDistance, trackLen)
		if pushLapGapSec(gap) > QualyCarBehindWarnSec {
			continue
		}
		if best < 0 || gap < bestGap {
			best, bestGap = i, gap
		}
	}
	if best < 0 {
		return nil
	}
	r.behindCalled[best] = playerLap.CurrentLapNum
	gapSec := roundTo(pushLapGapSec(bestGap), 1)
	return &Directive{
		ID:       "inlap_traffic_behind",
		Category: DirectiveCategoryQualifying,
		SubAlert: "inlap_traffic_behind",
		Title:    "Car Behind on a Push Lap",
		Message:  fmt.Sprintf("Car behind on a push lap, %.1fs back. Give way safely.", gapSec),
		Urgency:  UrgencyHigh,
		Values:   &DirectiveValues{Behind: &GapToCar{GapSec: gapSec}},
	}
}

// evaluateTrafficAhead warns a player on a push lap of a car ahead that isn't pushing and is
// slower: the nearest within QualyTrafficAheadWarnSec that they would reach before the line, each
// car once per lap.
func (r *QualifyingRule) evaluateTrafficAhead(ctx *EvaluationContext, playerLap *packets.LapData) *Directive {
	if !timedSession(ctx) || ctx.Phase != PhaseFlyingLap || ctx.LapData == nil {
		return nil
	}
	trackLen := ctx.TrackLengthM()
	lapLeft := trackLen - playerLap.LapDistance
	playerTele := ctx.PlayerTelemetry()
	best, bestGap := -1, float32(0)
	for i := range ctx.LapData.LapData {
		rival := &ctx.LapData.LapData[i]
		if i == ctx.PlayerCarIndex || rival.DriverStatus == packets.DriverStatusFlyingLap || !onTrack(rival) ||
			r.aheadCalled[i] == playerLap.CurrentLapNum {
			continue
		}
		gap := trackGapM(playerLap.LapDistance, rival.LapDistance, trackLen)
		if gap > lapLeft || pushLapGapSec(gap) > QualyTrafficAheadWarnSec {
			continue
		}
		// A car at least as fast is no traffic, for now.
		if playerTele != nil && ctx.Telemetry != nil && i < len(ctx.Telemetry.CarTelemetryData) &&
			ctx.Telemetry.CarTelemetryData[i].Speed >= playerTele.Speed {
			continue
		}
		if best < 0 || gap < bestGap {
			best, bestGap = i, gap
		}
	}
	if best < 0 {
		return nil
	}
	r.aheadCalled[best] = playerLap.CurrentLapNum
	gapSec := roundTo(pushLapGapSec(bestGap), 1)
	return &Directive{
		ID:       "qualy_traffic_ahead",
		Category: DirectiveCategoryQualifying,
		SubAlert: "qualy_traffic_ahead",
		Title:    "Slow Car Ahead",
		Message:  fmt.Sprintf("Slow car ahead, %.1fs up the road, not on a push lap.", gapSec),
		Urgency:  UrgencyHigh,
		Values:   &DirectiveValues{Ahead: &GapToCar{GapSec: gapSec}},
	}
}

// evaluateLapResult reports each valid push lap of a qualifying session QualyLapResultSettleMs
// after the line, once the positions have settled: provisional pole and the margin, or the
// position and the gap to P1, or no improvement; and whether it leaves the player at risk of
// elimination. An invalid lap has its own call (qualy_invalid) and no result.
func (r *QualifyingRule) evaluateLapResult(ctx *EvaluationContext, playerLap *packets.LapData) *Directive {
	if !ctx.IsQualifyingSession() {
		return nil
	}
	lapNum := playerLap.CurrentLapNum
	pushing := playerLap.DriverStatus == packets.DriverStatusFlyingLap
	switch {
	case r.pushLap != 0 && lapNum != r.pushLap:
		// The push lap ended at the line.
		if !r.pushLapInvalid {
			r.resultDueAt = ctx.Now + QualyLapResultSettleMs
		}
		r.pushLap = 0
	case r.pushLap != 0 && !pushing:
		// Abandoned before the line.
		r.pushLap = 0
	}
	if pushing && r.pushLap == 0 {
		r.pushLap, r.pushLapInvalid = lapNum, false
	}
	if r.pushLap != 0 && playerLap.CurrentLapInvalid == 1 {
		r.pushLapInvalid = true
	}

	if r.resultDueAt == 0 || ctx.Now < r.resultDueAt {
		return nil
	}
	r.resultDueAt = 0
	lapMS := playerLap.LastLapTimeInMS
	pos := int(playerLap.CarPosition)
	if lapMS == 0 || pos == 0 {
		return nil
	}
	improved := r.bestLapMS == 0 || lapMS < r.bestLapMS
	if improved {
		r.bestLapMS = lapMS
	}

	values := &DirectiveValues{Position: pos, Elimination: eliminationStatus(ctx, pos)}
	subAlert := "qualy_lap_no_improvement"
	msg := fmt.Sprintf("No improvement on that lap (%s), still P%d.", packets.FormatLapTimeMS(lapMS), pos)
	switch {
	case improved && pos == 1:
		subAlert = "qualy_lap_pole"
		msg = fmt.Sprintf("Provisional pole with %s.", packets.FormatLapTimeMS(lapMS))
		if p2 := bestLapAtPosition(ctx, 2); p2 > lapMS {
			values.PoleGapSec = roundTo(msToSec(p2-lapMS), 3)
			msg = fmt.Sprintf("Provisional pole with %s, %.3fs clear of P2.", packets.FormatLapTimeMS(lapMS), values.PoleGapSec)
		}
	case improved:
		subAlert = "qualy_lap_result"
		msg = fmt.Sprintf("%s puts us P%d.", packets.FormatLapTimeMS(lapMS), pos)
		if p1 := bestLapAtPosition(ctx, 1); p1 > 0 && lapMS > p1 {
			values.PoleGapSec = roundTo(msToSec(lapMS-p1), 3)
			msg = fmt.Sprintf("%s puts us P%d, %.3fs off P1.", packets.FormatLapTimeMS(lapMS), pos, values.PoleGapSec)
		}
	}
	if values.Elimination != "" {
		msg += fmt.Sprintf(" Elimination: %s.", values.Elimination)
	}
	return &Directive{
		ID:       "qualy_lap_result",
		Category: DirectiveCategoryQualifying,
		SubAlert: subAlert,
		Title:    "Lap Result",
		Message:  msg,
		Urgency:  UrgencyHigh,
		Values:   values,
	}
}

// eliminationStatus is where position pos stands against the Q1/Q2 cut line.
func eliminationStatus(ctx *EvaluationContext, pos int) EliminationStatus {
	lastSafe := lastSafePosition(ctx)
	switch {
	case lastSafe == 0 || pos < lastSafe:
		return ""
	case pos == lastSafe:
		return EliminationLastThrough
	}
	return EliminationDropZone
}

// bestLapAtPosition is the best lap of the car in position pos (other than the player) from its
// session history, or 0 while unknown.
func bestLapAtPosition(ctx *EvaluationContext, pos int) uint32 {
	if ctx.CarHistory == nil || ctx.LapData == nil {
		return 0
	}
	for i := range ctx.LapData.LapData {
		if i != ctx.PlayerCarIndex && int(ctx.LapData.LapData[i].CarPosition) == pos {
			return historyBestLapMS(ctx.CarHistory[i])
		}
	}
	return 0
}

// minutesLeft is the session time left in whole minutes, rounded up: "under N minutes".
func minutesLeft(secondsLeft uint16) int {
	return int(math.Ceil(float64(secondsLeft) / packets.SecondsPerMinute))
}

// lastSafePosition is the last place through to the next qualifying segment in Q1 and Q2, or 0 in
// a session nobody is knocked out of.
func lastSafePosition(ctx *EvaluationContext) int {
	if ctx.Session == nil {
		return 0
	}
	numCars := 0
	if ctx.Participants != nil {
		numCars = int(ctx.Participants.NumActiveCars)
	}
	q1, q2 := qualyDangerPositions(numCars)
	switch ctx.Session.SessionType {
	case packets.SessionQ1, packets.SessionSprintQ1:
		return q1
	case packets.SessionQ2, packets.SessionSprintQ2:
		return q2
	}
	return 0
}

// qualyDangerPositions returns the first Q1 and Q2 places in the elimination danger zone: the last
// place that goes through, and every place behind it. Q3 holds QualyQ3Cars cars and Q1 and Q2 each
// knock out half of the rest (5 on a 20-car grid, 6 on a 22-car one). Without a car count it uses
// the 20-car places.
func qualyDangerPositions(numCars int) (q1, q2 int) {
	if numCars <= QualyQ3Cars {
		return QualyQ1EliminationPositionThreshold, QualyQ2EliminationPositionThreshold
	}
	knockedOut := (numCars - QualyQ3Cars) / 2
	return numCars - knockedOut, QualyQ3Cars
}
