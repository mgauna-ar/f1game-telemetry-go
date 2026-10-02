package engineer

import (
	"fmt"
	"math"

	"github.com/mgauna/f1game-telemetry-go/internal/ai"
	"github.com/mgauna/f1game-telemetry-go/internal/packets"
)

// raceView is a copy of the engine state the live race context reads. It is taken under the
// engine lock and queried without it: decoded packets are replaced on arrival, never mutated.
type raceView struct {
	playerIdx    int
	teammateIdx  int
	packetFormat uint16
	phase        DrivingPhase
	config       EngineerConfig
	session      *packets.PacketSessionData
	lapData      *packets.PacketLapData
	telemetry    *packets.PacketCarTelemetryData
	status       *packets.PacketCarStatusData
	damage       *packets.PacketCarDamageData
	tyreSets     *packets.PacketTyreSetsData
	participants *packets.PacketParticipantsData
	carHistory   [packets.MaxCars]*packets.PacketSessionHistoryData
	playerLaps   []LapRecord
	events       []RaceEventRecord
	radioCalls   []RadioCallRecord
}

// liveView returns a view of the current session, or false when there is no fresh telemetry.
func (e *EngineerEngine) liveView() (*raceView, bool) {
	e.mu.RLock()
	defer e.mu.RUnlock()

	if e.latestSession == nil || e.latestLapData == nil ||
		e.playerCarIndex < 0 || e.playerCarIndex >= packets.MaxCars ||
		e.nowMs()-e.lastPacketAt > LiveRaceContextMaxAgeMs {
		return nil, false
	}

	return &raceView{
		playerIdx:    e.playerCarIndex,
		teammateIdx:  e.teammateCarIndex,
		packetFormat: e.packetFormat,
		phase:        e.currentPhase,
		config:       e.config,
		session:      e.latestSession,
		lapData:      e.latestLapData,
		telemetry:    e.latestTelemetry,
		status:       e.latestStatus,
		damage:       e.latestDamage,
		tyreSets:     e.latestTyreSets,
		participants: e.latestParticipant,
		carHistory:   e.history.carHistory,
		playerLaps:   append([]LapRecord(nil), e.history.playerLaps...),
		events:       append([]RaceEventRecord(nil), e.history.events...),
		radioCalls:   append([]RadioCallRecord(nil), e.history.radioCalls...),
	}, true
}

// LiveBriefing builds the live race briefing for the AI race engineer prompt.
// It implements ai.LiveRaceSource.
func (e *EngineerEngine) LiveBriefing() (ai.LiveBriefing, bool) {
	v, ok := e.liveView()
	if !ok {
		return ai.LiveBriefing{}, false
	}
	return ai.LiveBriefing{
		Summary:        v.summaryText(),
		TrackName:      packets.TrackName(v.session.TrackId),
		SessionType:    packets.SessionTypeName(v.session.SessionType),
		PacketFormat:   v.packetFormat,
		DrivingPhase:   string(v.phase),
		IncidentStatus: v.incidentStatus(),
	}, true
}

// RaceContextSnapshot is the structured live race picture, served for inspection and debugging.
type RaceContextSnapshot struct {
	Available bool              `json:"available"`
	Summary   string            `json:"summary,omitempty"`
	Session   *SessionSummary   `json:"session,omitempty"`
	You       *CarSummary       `json:"you,omitempty"`
	CarAhead  *CarSummary       `json:"car_ahead,omitempty"`
	CarBehind *CarSummary       `json:"car_behind,omitempty"`
	Strategy  *StrategySummary  `json:"strategy,omitempty"`
	Events    []RaceEventRecord `json:"recent_events,omitempty"`
	Calls     []RadioCallRecord `json:"recent_pit_wall_calls,omitempty"`
}

// RaceContext returns the structured live race picture the AI race engineer sees.
func (e *EngineerEngine) RaceContext() RaceContextSnapshot {
	v, ok := e.liveView()
	if !ok {
		return RaceContextSnapshot{Available: false}
	}
	session := v.sessionSummary()
	strategy := v.strategySummary()
	snap := RaceContextSnapshot{
		Available: true,
		Summary:   v.summaryText(),
		Session:   &session,
		Strategy:  &strategy,
		Events:    v.events,
		Calls:     v.radioCalls,
	}
	if you, ok := v.carSummary(v.playerIdx); ok {
		snap.You = &you
	}
	if idx := v.neighbourIdx(-1); idx >= 0 {
		if car, ok := v.carSummary(idx); ok {
			snap.CarAhead = &car
		}
	}
	if idx := v.neighbourIdx(1); idx >= 0 {
		if car, ok := v.carSummary(idx); ok {
			snap.CarBehind = &car
		}
	}
	return snap
}

// SessionSummary describes the session state.
type SessionSummary struct {
	Track          string  `json:"track"`
	SessionType    string  `json:"session_type"`
	Phase          string  `json:"phase"`
	Lap            int     `json:"lap"`
	TotalLaps      int     `json:"total_laps,omitempty"`
	LapsRemaining  float64 `json:"laps_remaining,omitempty"`
	TimeLeft       string  `json:"time_left,omitempty"`
	TrackStatus    string  `json:"track_status"`
	Weather        string  `json:"weather"`
	TrackTempC     int     `json:"track_temp_c"`
	AirTempC       int     `json:"air_temp_c"`
	PitWindowIdeal int     `json:"pit_window_ideal_lap,omitempty"`
	PitWindowLast  int     `json:"pit_window_latest_lap,omitempty"`
}

// CarSummary describes one car: where it runs, its pace and its tyres.
type CarSummary struct {
	Position       int     `json:"position"`
	Name           string  `json:"name"`
	Team           string  `json:"team"`
	IsYou          bool    `json:"is_you,omitempty"`
	IsTeammate     bool    `json:"is_teammate,omitempty"`
	RelativeToYou  string  `json:"relative_to_you,omitempty"`
	GapToLeaderSec float64 `json:"gap_to_leader_s,omitempty"`
	IntervalSec    float64 `json:"interval_to_car_ahead_s,omitempty"`
	Lap            int     `json:"lap"`
	LastLap        string  `json:"last_lap,omitempty"`
	BestLap        string  `json:"best_lap,omitempty"`
	Tyre           string  `json:"tyre,omitempty"`
	PitStops       int     `json:"pit_stops"`
	Status         string  `json:"status"`
	PenaltiesSec   int     `json:"penalties_s,omitempty"`
	GridPosition   int     `json:"grid_position,omitempty"`

	gapToLeaderMS uint32
	lastLapMS     uint32
	bestLapMS     uint32
}

// StrategySummary gathers the computed numbers a race engineer plans around.
type StrategySummary struct {
	LapsRemaining     float64 `json:"laps_remaining,omitempty"`
	StintLaps         int     `json:"current_stint_laps"`
	TyreWearPerLapPct float64 `json:"tyre_wear_per_lap_pct,omitempty"`
	WorstTyre         string  `json:"worst_tyre,omitempty"`
	LapsToWearLimit   float64 `json:"laps_to_wear_limit,omitempty"`
	WearLimitPct      float64 `json:"wear_limit_pct"`
	FuelKg            float64 `json:"fuel_kg"`
	FuelMarginLaps    float64 `json:"fuel_margin_laps"`
	FuelBurnPerLapKg  float64 `json:"fuel_burn_per_lap_kg,omitempty"`
	FuelTargetPerLap  float64 `json:"fuel_target_per_lap_kg,omitempty"`
	PitWindowIdealLap int     `json:"pit_window_ideal_lap,omitempty"`
	PitWindowLastLap  int     `json:"pit_window_latest_lap,omitempty"`
	RejoinPosition    int     `json:"rejoin_position_if_pitting_now,omitempty"`
	PitLaneLossSec    float64 `json:"estimated_pit_lane_loss_s"`
	RecentPace        string  `json:"recent_pace,omitempty"`
	LastVsBestSec     float64 `json:"last_lap_vs_best_s,omitempty"`
	GapAheadTrend     string  `json:"gap_ahead_trend,omitempty"`
	GapBehindTrend    string  `json:"gap_behind_trend,omitempty"`
}

func (v *raceView) isRace() bool       { return packets.IsRaceSession(v.session.SessionType) }
func (v *raceView) isQualifying() bool { return packets.IsQualifyingSession(v.session.SessionType) }

func (v *raceView) playerLap() packets.LapData { return v.lapData.LapData[v.playerIdx] }

func (v *raceView) statusOf(idx int) (packets.CarStatusData, bool) {
	if v.status == nil || idx < 0 || idx >= len(v.status.CarStatusData) {
		return packets.CarStatusData{}, false
	}
	return v.status.CarStatusData[idx], true
}

func (v *raceView) damageOf(idx int) (packets.CarDamageData, bool) {
	if v.damage == nil || idx < 0 || idx >= len(v.damage.CarDamageData) {
		return packets.CarDamageData{}, false
	}
	return v.damage.CarDamageData[idx], true
}

func (v *raceView) telemetryOf(idx int) (packets.CarTelemetryData, bool) {
	if v.telemetry == nil || idx < 0 || idx >= len(v.telemetry.CarTelemetryData) {
		return packets.CarTelemetryData{}, false
	}
	return v.telemetry.CarTelemetryData[idx], true
}

func (v *raceView) teamName(idx int) string {
	if v.participants == nil || idx < 0 || idx >= len(v.participants.Participants) {
		return ""
	}
	return packets.TeamName(v.participants.Participants[idx].TeamId)
}

// neighbourIdx returns the car offset positions from the player (-1 ahead, +1 behind), or -1.
func (v *raceView) neighbourIdx(offset int) int {
	return carAtPosition(v.lapData, int(v.playerLap().CarPosition)+offset)
}

func (v *raceView) bestLapMS(idx int) uint32 {
	if idx >= 0 && idx < len(v.carHistory) {
		if t := historyBestLapMS(v.carHistory[idx]); t > 0 {
			return t
		}
	}
	if idx == v.playerIdx {
		var best uint32
		for _, rec := range v.playerLaps {
			if rec.Valid && rec.LapTimeMS > 0 && (best == 0 || rec.LapTimeMS < best) {
				best = rec.LapTimeMS
			}
		}
		return best
	}
	return 0
}

// historyBestLapMS is a car's best lap time from its session history, or 0 while unknown.
func historyBestLapMS(h *packets.PacketSessionHistoryData) uint32 {
	if h == nil || h.BestLapTimeLapNum == 0 || int(h.BestLapTimeLapNum) > len(h.LapHistoryData) {
		return 0
	}
	return h.LapHistoryData[h.BestLapTimeLapNum-1].LapTimeInMS
}

func (v *raceView) carSummary(idx int) (CarSummary, bool) {
	if idx < 0 || idx >= len(v.lapData.LapData) {
		return CarSummary{}, false
	}
	l := v.lapData.LapData[idx]
	car := CarSummary{
		Position:      int(l.CarPosition),
		Name:          participantName(v.participants, idx),
		Team:          v.teamName(idx),
		IsYou:         idx == v.playerIdx,
		IsTeammate:    idx == v.teammateIdx && idx != v.playerIdx,
		Lap:           int(l.CurrentLapNum),
		PitStops:      int(l.NumPitStops),
		Status:        carRunStatus(l),
		PenaltiesSec:  int(l.Penalties),
		gapToLeaderMS: deltaToLeaderMS(l),
		lastLapMS:     l.LastLapTimeInMS,
		bestLapMS:     v.bestLapMS(idx),
	}
	if l.LastLapTimeInMS > 0 {
		car.LastLap = packets.FormatLapTimeMS(l.LastLapTimeInMS)
	}
	if car.bestLapMS > 0 {
		car.BestLap = packets.FormatLapTimeMS(car.bestLapMS)
	}
	if st, ok := v.statusOf(idx); ok {
		car.Tyre = describeTyre(st)
	}
	if v.isRace() {
		car.GridPosition = int(l.GridPosition)
		car.GapToLeaderSec = msToSec(car.gapToLeaderMS)
		car.IntervalSec = msToSec(deltaToCarInFrontMS(l))
	}
	if !car.IsYou {
		car.RelativeToYou = v.relativeToPlayer(idx, car)
	}
	return car, true
}

// relativeToPlayer phrases where a car is relative to the player: on track in a race,
// on best lap time otherwise.
func (v *raceView) relativeToPlayer(idx int, car CarSummary) string {
	player := v.playerLap()
	if v.isRace() {
		delta := int64(car.gapToLeaderMS) - int64(deltaToLeaderMS(player))
		gap := msToSec(uint32(absInt64(delta)))
		if car.Position < int(player.CarPosition) {
			return fmt.Sprintf("%.3fs ahead of you", gap)
		}
		return fmt.Sprintf("%.3fs behind you", gap)
	}
	playerBest := v.bestLapMS(v.playerIdx)
	if car.bestLapMS == 0 || playerBest == 0 {
		return ""
	}
	delta := int64(car.bestLapMS) - int64(playerBest)
	if delta < 0 {
		return fmt.Sprintf("best lap %.3fs faster than yours", msToSec(uint32(-delta)))
	}
	return fmt.Sprintf("best lap %.3fs slower than yours", msToSec(uint32(delta)))
}

func (v *raceView) sessionSummary() SessionSummary {
	s := v.session
	player := v.playerLap()
	sum := SessionSummary{
		Track:       packets.TrackName(s.TrackId),
		SessionType: packets.SessionTypeName(s.SessionType),
		Phase:       string(v.phase),
		Lap:         int(player.CurrentLapNum),
		TrackStatus: trackStatus(s),
		Weather:     packets.WeatherName(s.Weather),
		TrackTempC:  int(s.TrackTemperature),
		AirTempC:    int(s.AirTemperature),
	}
	if v.isRace() && s.TotalLaps > 0 {
		sum.TotalLaps = int(s.TotalLaps)
		sum.LapsRemaining = v.lapsRemaining()
	}
	if s.SessionTimeLeft > 0 && !v.isRace() {
		sum.TimeLeft = formatClock(int(s.SessionTimeLeft))
	}
	if v.isRace() {
		sum.PitWindowIdeal = int(s.PitStopWindowIdealLap)
		sum.PitWindowLast = int(s.PitStopWindowLatestLap)
	}
	return sum
}

func (v *raceView) lapsRemaining() float64 {
	player := v.playerLap()
	return raceLapsRemaining(v.session, &player)
}

// raceLapsRemaining is how many laps the player has left to the flag, counting the part of the
// current lap still to drive; 0 when the race length isn't known.
func raceLapsRemaining(session *packets.PacketSessionData, player *packets.LapData) float64 {
	if session == nil || player == nil || session.TotalLaps == 0 || player.CurrentLapNum == 0 {
		return 0
	}
	remaining := float64(int(session.TotalLaps)-int(player.CurrentLapNum)+1) - float64(CalculateLapDistanceFraction(session, player))
	return math.Max(0, roundTo(remaining, 1))
}

func (v *raceView) incidentStatus() string {
	switch {
	case v.session.NumRedFlagPeriods > 0 && v.phase == PhaseRedFlag:
		return "red_flag"
	case v.session.SafetyCarStatus == packets.SafetyCarFull:
		return "safety_car"
	case v.session.SafetyCarStatus == packets.SafetyCarVirtual:
		return "vsc"
	}
	return "clear"
}

// currentStintLaps returns the player's completed laps on the current set of tyres.
func (v *raceView) currentStintLaps() []LapRecord {
	return stintLaps(v.playerLaps, int(v.playerLap().NumPitStops))
}

// stintLaps returns the completed laps driven after the given number of pit stops: the laps on
// the current set of tyres when stops is the player's pit stop count.
func stintLaps(laps []LapRecord, stops int) []LapRecord {
	var stint []LapRecord
	for _, rec := range laps {
		if rec.PitStops == stops {
			stint = append(stint, rec)
		}
	}
	return stint
}

func (v *raceView) strategySummary() StrategySummary {
	s := v.session
	player := v.playerLap()
	strat := StrategySummary{
		WearLimitPct:   float64(v.config.TyreWearCritPct),
		PitLaneLossSec: DefaultPitLaneLossSeconds,
	}
	if st, ok := v.statusOf(v.playerIdx); ok {
		strat.StintLaps = int(st.TyresAgeLaps)
		strat.FuelKg = roundTo(float64(st.FuelInTank), 1)
		strat.FuelMarginLaps = roundTo(float64(st.FuelRemainingLaps), 1)
	}
	if v.isRace() {
		strat.LapsRemaining = v.lapsRemaining()
		strat.PitWindowIdealLap = int(s.PitStopWindowIdealLap)
		strat.PitWindowLastLap = int(s.PitStopWindowLatestLap)
		strat.RejoinPosition = int(s.PitStopRejoinPosition)
	}

	stint := v.currentStintLaps()
	v.applyTyreTrend(&strat, stint)
	v.applyFuelTrend(&strat)
	v.applyPace(&strat)

	if ahead := v.neighbourIdx(-1); ahead >= 0 {
		strat.GapAheadTrend = gapTrend(v.playerLaps, ahead, deltaToCarInFrontMS(player), true)
	}
	if behind := v.neighbourIdx(1); behind >= 0 {
		strat.GapBehindTrend = gapTrend(v.playerLaps, behind, deltaToCarInFrontMS(v.lapData.LapData[behind]), false)
	}
	return strat
}

// applyTyreTrend measures wear per lap over the current stint and projects laps to the wear limit.
func (v *raceView) applyTyreTrend(strat *StrategySummary, stint []LapRecord) {
	dmg, ok := v.damageOf(v.playerIdx)
	if !ok {
		return
	}
	if life, ok := projectTyreLife(stint, dmg.TyresWear, v.config.TyreWearCritPct); ok {
		strat.TyreWearPerLapPct = roundTo(life.WearPerLapPct, 2)
		strat.WorstTyre = wheelNames[life.Corner]
		strat.LapsToWearLimit = roundTo(life.LapsToLimit, 1)
	}
}

// tyreLife is how many laps the tyres have left: the tyre that reaches the wear limit first, at
// the rate it wore over the stint.
type tyreLife struct {
	Corner        int     // wheel index, as in the packets' wheel arrays
	WearPerLapPct float64 // that tyre's wear per lap over the stint
	LapsToLimit   float64 // laps until it reaches the wear limit; 0 once it has
}

// projectTyreLife projects the tyres' laps to limitPct of wear from the stint's lap ends and their
// wear now. False until two lap ends, or while no tyre is wearing.
func projectTyreLife(stint []LapRecord, wear [4]float32, limitPct float32) (tyreLife, bool) {
	if len(stint) < 2 {
		return tyreLife{}, false
	}
	first, last := stint[0], stint[len(stint)-1]
	laps := last.LapNumber - first.LapNumber
	if laps <= 0 {
		return tyreLife{}, false
	}
	best := tyreLife{LapsToLimit: math.Inf(1)}
	for corner := range wear {
		rate := float64(last.TyreWearPct[corner]-first.TyreWearPct[corner]) / float64(laps)
		if rate <= 0 {
			continue
		}
		if toLimit := (float64(limitPct) - float64(wear[corner])) / rate; toLimit < best.LapsToLimit {
			best = tyreLife{Corner: corner, WearPerLapPct: rate, LapsToLimit: toLimit}
		}
	}
	if math.IsInf(best.LapsToLimit, 1) {
		return tyreLife{}, false
	}
	best.LapsToLimit = math.Max(0, best.LapsToLimit)
	return best, true
}

// applyFuelTrend averages recent fuel burn and the burn needed to reach the flag.
func (v *raceView) applyFuelTrend(strat *StrategySummary) {
	laps := v.playerLaps
	if len(laps) > FuelTrendLaps+1 {
		laps = laps[len(laps)-FuelTrendLaps-1:]
	}
	if len(laps) >= 2 {
		first, last := laps[0], laps[len(laps)-1]
		if n := last.LapNumber - first.LapNumber; n > 0 && first.FuelKg > last.FuelKg {
			strat.FuelBurnPerLapKg = roundTo(float64(first.FuelKg-last.FuelKg)/float64(n), 2)
		}
	}
	if strat.LapsRemaining > 0 && strat.FuelKg > 0 {
		strat.FuelTargetPerLap = roundTo(strat.FuelKg/strat.LapsRemaining, 2)
	}
}

func (v *raceView) applyPace(strat *StrategySummary) {
	var recent []uint32
	for i := len(v.playerLaps) - 1; i >= 0 && len(recent) < RecentPaceLaps; i-- {
		if rec := v.playerLaps[i]; rec.Valid && rec.LapTimeMS > 0 {
			recent = append(recent, rec.LapTimeMS)
		}
	}
	if len(recent) > 0 {
		var sum uint32
		for _, t := range recent {
			sum += t
		}
		strat.RecentPace = fmt.Sprintf("%s average over the last %d valid laps", packets.FormatLapTimeMS(sum/uint32(len(recent))), len(recent))
	}
	last := v.playerLap().LastLapTimeInMS
	if best := v.bestLapMS(v.playerIdx); best > 0 && last > 0 {
		strat.LastVsBestSec = roundTo(msToSec(last)-msToSec(best), 3)
	}
}

// GapTrend is how the gap to the car ahead or behind changed over the last lap ends while the
// same car was there.
type GapTrend struct {
	// CarIdx is the neighbour's car index.
	CarIdx int
	// PerLapSec is the gap's change per lap: positive when it grew, negative when it shrank.
	PerLapSec float64
	// Laps is how many laps the change was measured over.
	Laps int
}

// gapTrendOf measures how the gap to a neighbour changed over the last few lap ends while the
// same car was there. False until two lap ends with that car, or when there is no current gap.
func gapTrendOf(laps []LapRecord, carIdx int, currentGapMS uint32, ahead bool) (GapTrend, bool) {
	var samples []LapRecord
	for i := len(laps) - 1; i >= 0 && len(samples) <= GapTrendLaps; i-- {
		rec := laps[i]
		matches := (ahead && rec.CarAheadIdx == carIdx) || (!ahead && rec.CarBehindIdx == carIdx)
		if !matches {
			break
		}
		samples = append(samples, rec)
	}
	if len(samples) < 2 || currentGapMS == 0 {
		return GapTrend{}, false
	}
	newest, oldest := samples[0], samples[len(samples)-1]
	gapOf := func(r LapRecord) float64 {
		if ahead {
			return msToSec(r.GapAheadMS)
		}
		return msToSec(r.GapBehindMS)
	}
	span := newest.LapNumber - oldest.LapNumber
	if span <= 0 {
		return GapTrend{}, false
	}
	return GapTrend{CarIdx: carIdx, PerLapSec: (gapOf(newest) - gapOf(oldest)) / float64(span), Laps: span}, true
}

// gapTrend describes the gap trend to a neighbour for the AI race engineer. For the car ahead a
// shrinking gap means the player is closing in.
func gapTrend(laps []LapRecord, carIdx int, currentGapMS uint32, ahead bool) string {
	trend, ok := gapTrendOf(laps, carIdx, currentGapMS, ahead)
	if !ok {
		return ""
	}
	perLap := trend.PerLapSec
	switch {
	case math.Abs(perLap) < GapTrendStableSecPerLap:
		return fmt.Sprintf("gap stable over the last %d laps", trend.Laps)
	case perLap < 0 && ahead:
		return fmt.Sprintf("you are closing %.2fs per lap", -perLap)
	case perLap < 0:
		return fmt.Sprintf("they are closing %.2fs per lap", -perLap)
	case ahead:
		return fmt.Sprintf("they are pulling away %.2fs per lap", perLap)
	default:
		return fmt.Sprintf("you are pulling away %.2fs per lap", perLap)
	}
}

// GapTrends measures the gap trends to the cars ahead of and behind the player, the same numbers
// the AI race engineer describes. Each is nil when it can't be measured yet.
func (e *EngineerEngine) GapTrends() (ahead, behind *GapTrend) {
	e.mu.RLock()
	defer e.mu.RUnlock()
	lapData := e.latestLapData
	if lapData == nil || e.playerCarIndex < 0 || e.playerCarIndex >= len(lapData.LapData) {
		return nil, nil
	}
	player := lapData.LapData[e.playerCarIndex]
	if idx := carAtPosition(lapData, int(player.CarPosition)-1); idx >= 0 {
		if t, ok := gapTrendOf(e.history.playerLaps, idx, deltaToCarInFrontMS(player), true); ok {
			ahead = &t
		}
	}
	if idx := carAtPosition(lapData, int(player.CarPosition)+1); idx >= 0 {
		if t, ok := gapTrendOf(e.history.playerLaps, idx, deltaToCarInFrontMS(lapData.LapData[idx]), false); ok {
			behind = &t
		}
	}
	return ahead, behind
}

// forecast returns the weather forecast samples for the current session, soonest first.
func (v *raceView) forecast() []packets.WeatherForecastSample {
	return sessionForecast(v.session)
}

// wheelNames names the wheels by their index in the packets' wheel arrays (RL, RR, FL, FR).
var wheelNames = [4]string{
	packets.WheelRearLeft:   "RL",
	packets.WheelRearRight:  "RR",
	packets.WheelFrontLeft:  "FL",
	packets.WheelFrontRight: "FR",
}

// wheelLongNames are wheelNames spelled out, for radio messages.
var wheelLongNames = [4]string{
	packets.WheelRearLeft:   "Rear Left",
	packets.WheelRearRight:  "Rear Right",
	packets.WheelFrontLeft:  "Front Left",
	packets.WheelFrontRight: "Front Right",
}

// frontFirst reorders a packet wheel array to FL, FR, RL, RR for the AI's text and tools.
func frontFirst[T any](wheels [4]T) [4]T {
	var out [4]T
	for i, w := range packets.WheelsFrontFirst {
		out[i] = wheels[w]
	}
	return out
}

// Car run status labels.
const (
	carStatusOnTrack = "on track"
)

func carRunStatus(l packets.LapData) string {
	switch l.ResultStatus {
	case packets.ResultStatusDNF, packets.ResultStatusRetired:
		return "retired"
	case packets.ResultStatusDSQ:
		return "disqualified"
	case packets.ResultStatusFinished:
		return "finished"
	}
	switch l.PitStatus {
	case packets.PitStatusPitting:
		return "in the pit lane"
	case packets.PitStatusInPitArea:
		return "in the pit box"
	}
	switch l.DriverStatus {
	case packets.DriverStatusInGarage:
		return "in the garage"
	case packets.DriverStatusOutLap:
		return "on an out lap"
	case packets.DriverStatusInLap:
		return "on an in lap"
	case packets.DriverStatusFlyingLap:
		return "on a flying lap"
	}
	return carStatusOnTrack
}

func trackStatus(s *packets.PacketSessionData) string {
	switch s.SafetyCarStatus {
	case packets.SafetyCarFull:
		return "Safety Car"
	case packets.SafetyCarVirtual:
		return "Virtual Safety Car"
	case packets.SafetyCarFormationLap:
		return "Formation lap"
	}
	return "Green"
}

const percentScale = 100.0

func msToSec(ms uint32) float64 {
	return float64(ms) / packets.MillisPerSecond
}

func absInt64(x int64) int64 {
	if x < 0 {
		return -x
	}
	return x
}

func roundTo(x float64, decimals int) float64 {
	p := math.Pow(10, float64(decimals))
	return math.Round(x*p) / p
}

func formatClock(seconds int) string {
	return fmt.Sprintf("%d:%02d", seconds/packets.SecondsPerMinute, seconds%packets.SecondsPerMinute)
}

func orNone(s string) string {
	if s == "" {
		return "none yet"
	}
	return s
}
