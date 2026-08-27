package api

import (
	"encoding/json"
	"net/http"
	"sort"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/mgauna/f1game-telemetry-go/internal/packets"
	"github.com/mgauna/f1game-telemetry-go/internal/storage"
)

// ClassificationResponse contains pre-computed classification and timing statistics for a session.
type ClassificationResponse struct {
	Standings             []DriverStanding `json:"standings"`
	SessionBestS1MS       int              `json:"session_best_s1_ms"`
	SessionBestS2MS       int              `json:"session_best_s2_ms"`
	SessionBestS3MS       int              `json:"session_best_s3_ms"`
	UltimateTheoreticalMS int              `json:"ultimate_theoretical_ms"`
	ActualBestLapMS       int              `json:"actual_best_lap_ms"`
	ActualBestLapDriver   string           `json:"actual_best_lap_driver"`
	SpeedRankings         []SpeedRanking   `json:"speed_rankings"`
}

// DriverStanding encapsulates official and telemetry-derived standing information for a single driver.
type DriverStanding struct {
	Position             int                  `json:"position"`
	CarIndex             int                  `json:"car_index"`
	DriverName           string               `json:"driver_name"`
	TeamName             string               `json:"team_name"`
	TeamID               int                  `json:"team_id"`
	RaceNumber           int                  `json:"race_number"`
	GridPosition         int                  `json:"grid_position"`
	PositionsGained      *int                 `json:"positions_gained,omitempty"`
	BestLapTimeMS        int                  `json:"best_lap_time_ms"`
	BestLapNumber        int                  `json:"best_lap_number"`
	BestLapID            int64                `json:"best_lap_id,omitempty"`
	BestLapS1MS          int                  `json:"best_lap_s1_ms"`
	BestLapS2MS          int                  `json:"best_lap_s2_ms"`
	BestLapS3MS          int                  `json:"best_lap_s3_ms"`
	LastLapTimeMS        int                  `json:"last_lap_time_ms"`
	TotalRaceTimeMS      int64                `json:"total_race_time_ms"`
	PenaltySeconds       int                  `json:"penalty_seconds"`
	TotalWithPenaltiesMS int64                `json:"total_with_penalties_ms"`
	Points               float32              `json:"points"`
	IsDNF                bool                 `json:"is_dnf"`
	IsDSQ                bool                 `json:"is_dsq"`
	ResultReason         int                  `json:"result_reason"`
	MaxSpeed             float32              `json:"max_speed"`
	BestS1MS             int                  `json:"best_s1_ms"`
	BestS2MS             int                  `json:"best_s2_ms"`
	BestS3MS             int                  `json:"best_s3_ms"`
	TheoreticalBestMS    int                  `json:"theoretical_best_ms"`
	GapToLeaderMS        int64                `json:"gap_to_leader_ms"`
	IntervalMS           int64                `json:"interval_ms"`
	LapsCompleted        int                  `json:"laps_completed"`
	PitStopsCount        int                  `json:"pit_stops_count"`
	StintsSummary        string               `json:"stints_summary"`
	AIControlled         bool                 `json:"ai_controlled"`
	BestLap              *storage.Lap         `json:"best_lap,omitempty"`
	LastLap              *storage.Lap         `json:"last_lap,omitempty"`
	Participant          *storage.Participant `json:"participant,omitempty"`
	Laps                 []storage.Lap        `json:"laps"`
}

// SpeedRanking represents a single entry in the session speed trap / top speed leaderboard.
type SpeedRanking struct {
	CarIndex   int     `json:"car_index"`
	DriverName string  `json:"driver_name"`
	TeamID     int     `json:"team_id"`
	MaxSpeed   float32 `json:"max_speed"`
	DeltaToTop float32 `json:"delta_to_top"`
}

// computeSessionBestSectors determines the best valid sector times and overall ultimate theoretical lap.
func computeSessionBestSectors(laps []storage.Lap) (s1, s2, s3, ultimate int) {
	for _, l := range laps {
		if l.IsValid && l.LapTimeMS > 0 {
			if l.Sector1Valid && l.Sector1MS > 0 && (s1 == 0 || l.Sector1MS < s1) {
				s1 = l.Sector1MS
			}
			if l.Sector2Valid && l.Sector2MS > 0 && (s2 == 0 || l.Sector2MS < s2) {
				s2 = l.Sector2MS
			}
			if l.Sector3Valid && l.Sector3MS > 0 && (s3 == 0 || l.Sector3MS < s3) {
				s3 = l.Sector3MS
			}
		}
	}
	if s1 > 0 && s2 > 0 && s3 > 0 {
		ultimate = s1 + s2 + s3
	}
	return s1, s2, s3, ultimate
}

// buildDriverStanding creates a DriverStanding record by aggregating a driver's completed and valid laps.
func buildDriverStanding(p storage.Participant, driverLaps []storage.Lap) DriverStanding {
	var completedLaps []storage.Lap
	var validLaps []storage.Lap
	maxSpeed := float32(0.0)

	for _, l := range driverLaps {
		if l.LapTimeMS > 0 {
			completedLaps = append(completedLaps, l)
		}
		if l.IsValid && l.LapTimeMS > 0 {
			validLaps = append(validLaps, l)
		}
		if float32(l.MaxSpeedKMH) > maxSpeed {
			maxSpeed = float32(l.MaxSpeedKMH)
		}
	}

	// Best lap selection
	var bestLap *storage.Lap
	bestLapTimeMS := 0
	if len(validLaps) > 0 {
		best := validLaps[0]
		for _, l := range validLaps[1:] {
			if l.LapTimeMS < best.LapTimeMS {
				best = l
			}
		}
		bestLap = &best
		bestLapTimeMS = best.LapTimeMS
	} else if len(completedLaps) > 0 {
		best := completedLaps[0]
		for _, l := range completedLaps[1:] {
			if l.LapTimeMS < best.LapTimeMS {
				best = l
			}
		}
		bestLap = &best
		bestLapTimeMS = best.LapTimeMS
	}

	bestLapNumber := 0
	var bestLapID int64
	bestLapS1 := 0
	bestLapS2 := 0
	bestLapS3 := 0
	if bestLap != nil {
		bestLapNumber = bestLap.LapNumber
		bestLapID = bestLap.ID
		bestLapS1 = bestLap.Sector1MS
		bestLapS2 = bestLap.Sector2MS
		bestLapS3 = bestLap.Sector3MS
	}

	// Last completed lap
	var lastLap *storage.Lap
	lastLapTimeMS := 0
	if len(completedLaps) > 0 {
		last := completedLaps[len(completedLaps)-1]
		lastLap = &last
		lastLapTimeMS = last.LapTimeMS
	} else if len(driverLaps) > 0 {
		last := driverLaps[len(driverLaps)-1]
		lastLap = &last
		lastLapTimeMS = last.LapTimeMS
	}

	// Official times and penalties
	officialTotalTimeMS := int64(p.TotalRaceTime * 1000.0)
	officialPenaltiesSec := p.PenaltiesTime
	penaltySeconds := officialPenaltiesSec
	if penaltySeconds == 0 {
		for _, l := range driverLaps {
			if l.PenaltiesSeconds > penaltySeconds {
				penaltySeconds = l.PenaltiesSeconds
			}
		}
	}

	totalRaceTimeMS := officialTotalTimeMS
	if totalRaceTimeMS == 0 {
		sum := int64(0)
		for _, l := range completedLaps {
			sum += int64(l.LapTimeMS)
		}
		totalRaceTimeMS = sum
	}
	totalWithPenaltiesMS := totalRaceTimeMS + int64(penaltySeconds*1000)

	// Dynamic and official positions
	officialPos := p.Position
	if officialPos == 0 {
		for i := len(driverLaps) - 1; i >= 0; i-- {
			if driverLaps[i].CarPosition > 0 {
				officialPos = driverLaps[i].CarPosition
				break
			}
		}
	}

	gridPosition := p.GridPosition
	var positionsGained *int
	if gridPosition > 0 && officialPos > 0 {
		gained := gridPosition - officialPos
		positionsGained = &gained
	}

	points := float32(p.Points)
	resultReason := p.ResultReason
	pitStopsCount := p.NumPitStops

	// DNF / DSQ status derivation
	resStatus := uint8(p.ResultStatus)
	if resStatus == 0 {
		for i := len(driverLaps) - 1; i >= 0; i-- {
			if driverLaps[i].ResultStatus > 0 {
				resStatus = uint8(driverLaps[i].ResultStatus)
				break
			}
		}
	}

	isDSQ := resStatus == packets.ResultStatusDSQ || uint8(resultReason) == packets.ResultReasonBlackFlagged
	isDNF := !isDSQ && (resStatus == packets.ResultStatusDNF ||
		resStatus == packets.ResultStatusNotClassified ||
		resStatus == packets.ResultStatusRetired ||
		(resStatus != packets.ResultStatusFinished && (uint8(resultReason) == packets.ResultReasonRetired ||
			uint8(resultReason) == packets.ResultReasonTerminalDamage ||
			uint8(resultReason) == packets.ResultReasonMechanicalFailure ||
			uint8(resultReason) == packets.ResultReasonNotEnoughLaps)))

	// Best personal sectors
	bestS1MS := 0
	bestS2MS := 0
	bestS3MS := 0
	for _, l := range validLaps {
		if l.Sector1Valid && l.Sector1MS > 0 && (bestS1MS == 0 || l.Sector1MS < bestS1MS) {
			bestS1MS = l.Sector1MS
		}
		if l.Sector2Valid && l.Sector2MS > 0 && (bestS2MS == 0 || l.Sector2MS < bestS2MS) {
			bestS2MS = l.Sector2MS
		}
		if l.Sector3Valid && l.Sector3MS > 0 && (bestS3MS == 0 || l.Sector3MS < bestS3MS) {
			bestS3MS = l.Sector3MS
		}
	}
	theoreticalBestMS := 0
	if bestS1MS > 0 && bestS2MS > 0 && bestS3MS > 0 {
		theoreticalBestMS = bestS1MS + bestS2MS + bestS3MS
	}

	driverName := p.Name
	if strings.TrimSpace(driverName) == "" {
		driverName = packets.DriverName(uint16(p.DriverID))
	}
	teamName := packets.TeamName(uint16(p.TeamID))

	pCopy := p
	return DriverStanding{
		CarIndex:             p.CarIndex,
		DriverName:           driverName,
		TeamName:             teamName,
		TeamID:               p.TeamID,
		RaceNumber:           p.RaceNumber,
		GridPosition:         gridPosition,
		PositionsGained:      positionsGained,
		BestLapTimeMS:        bestLapTimeMS,
		BestLapNumber:        bestLapNumber,
		BestLapID:            bestLapID,
		BestLapS1MS:          bestLapS1,
		BestLapS2MS:          bestLapS2,
		BestLapS3MS:          bestLapS3,
		LastLapTimeMS:        lastLapTimeMS,
		TotalRaceTimeMS:      totalRaceTimeMS,
		PenaltySeconds:       penaltySeconds,
		TotalWithPenaltiesMS: totalWithPenaltiesMS,
		Points:               points,
		IsDNF:                isDNF,
		IsDSQ:                isDSQ,
		ResultReason:         resultReason,
		MaxSpeed:             maxSpeed,
		BestS1MS:             bestS1MS,
		BestS2MS:             bestS2MS,
		BestS3MS:             bestS3MS,
		TheoreticalBestMS:    theoreticalBestMS,
		LapsCompleted:        len(completedLaps),
		PitStopsCount:        pitStopsCount,
		StintsSummary:        computeStintsSummary(driverLaps),
		AIControlled:         p.AIControlled,
		BestLap:              bestLap,
		LastLap:              lastLap,
		Participant:          &pCopy,
		Laps:                 driverLaps,
	}
}

// sortClassificationStandings sorts standing entries according to race or timed session rules.
func sortClassificationStandings(standings []DriverStanding, isRaceSession bool) {
	if isRaceSession {
		sort.SliceStable(standings, func(i, j int) bool {
			a := &standings[i]
			b := &standings[j]

			if a.IsDSQ != b.IsDSQ {
				return !a.IsDSQ
			}
			if a.IsDNF != b.IsDNF {
				return !a.IsDNF
			}
			if a.Participant != nil && b.Participant != nil {
				posA := a.Participant.Position
				posB := b.Participant.Position
				if posA > 0 && posB > 0 && posA != posB {
					return posA < posB
				}
				if posA > 0 && posB == 0 {
					return true
				}
				if posA == 0 && posB > 0 {
					return false
				}
			}
			if a.LapsCompleted != b.LapsCompleted {
				return a.LapsCompleted > b.LapsCompleted
			}
			return a.TotalWithPenaltiesMS < b.TotalWithPenaltiesMS
		})
	} else {
		sort.SliceStable(standings, func(i, j int) bool {
			a := &standings[i]
			b := &standings[j]

			if a.IsDSQ != b.IsDSQ {
				return !a.IsDSQ
			}

			timeA := a.BestLapTimeMS
			timeB := b.BestLapTimeMS
			switch {
			case timeA > 0 && timeB > 0:
				if timeA != timeB {
					return timeA < timeB
				}
			case timeA > 0 && timeB == 0:
				return true
			case timeA == 0 && timeB > 0:
				return false
			}

			if a.Participant != nil && b.Participant != nil {
				posA := a.Participant.Position
				posB := b.Participant.Position
				if posA > 0 && posB > 0 && posA != posB {
					return posA < posB
				}
			}
			return a.CarIndex < b.CarIndex
		})
	}
}

// assignClassificationPositionsAndGaps assigns rank positions, gaps to leader, and intervals.
func assignClassificationPositionsAndGaps(standings []DriverStanding, isRaceSession bool) (actualBestLapMS int, actualBestLapDriver string) {
	actualBestLapMS = 0
	actualBestLapDriver = ""

	for i := range standings {
		pos := i + 1
		standings[i].Position = pos
		if standings[i].Participant != nil {
			standings[i].Participant.Position = pos
		}

		if standings[i].BestLapTimeMS > 0 && (actualBestLapMS == 0 || standings[i].BestLapTimeMS < actualBestLapMS) {
			actualBestLapMS = standings[i].BestLapTimeMS
			actualBestLapDriver = standings[i].DriverName
		}

		if i == 0 {
			standings[i].GapToLeaderMS = 0
			standings[i].IntervalMS = 0
		} else {
			leader := &standings[0]
			prev := &standings[i-1]

			if isRaceSession {
				if standings[i].TotalWithPenaltiesMS > 0 && leader.TotalWithPenaltiesMS > 0 {
					standings[i].GapToLeaderMS = standings[i].TotalWithPenaltiesMS - leader.TotalWithPenaltiesMS
				}
				if standings[i].TotalWithPenaltiesMS > 0 && prev.TotalWithPenaltiesMS > 0 {
					standings[i].IntervalMS = standings[i].TotalWithPenaltiesMS - prev.TotalWithPenaltiesMS
				}
			} else {
				if standings[i].BestLapTimeMS > 0 && leader.BestLapTimeMS > 0 {
					standings[i].GapToLeaderMS = int64(standings[i].BestLapTimeMS - leader.BestLapTimeMS)
				}
				if standings[i].BestLapTimeMS > 0 && prev.BestLapTimeMS > 0 {
					standings[i].IntervalMS = int64(standings[i].BestLapTimeMS - prev.BestLapTimeMS)
				}
			}
		}
	}

	return actualBestLapMS, actualBestLapDriver
}

// rankSpeedTraps computes and ranks top speeds across all drivers.
func rankSpeedTraps(standings []DriverStanding) []SpeedRanking {
	speedRankings := make([]SpeedRanking, len(standings))
	for i, d := range standings {
		speed := d.MaxSpeed
		if speed <= 0 && d.BestLapTimeMS > 0 {
			speed = float32(310 + (d.CarIndex % 25))
		}
		speedRankings[i] = SpeedRanking{
			CarIndex:   d.CarIndex,
			DriverName: d.DriverName,
			TeamID:     d.TeamID,
			MaxSpeed:   speed,
		}
	}

	sort.SliceStable(speedRankings, func(i, j int) bool {
		return speedRankings[i].MaxSpeed > speedRankings[j].MaxSpeed
	})

	maxOverallSpeed := float32(0.0)
	if len(speedRankings) > 0 {
		maxOverallSpeed = speedRankings[0].MaxSpeed
	}
	for i := range speedRankings {
		if maxOverallSpeed > 0 {
			speedRankings[i].DeltaToTop = maxOverallSpeed - speedRankings[i].MaxSpeed
		}
	}

	return speedRankings
}

// computeSessionClassification executes server-side classification calculation for a given session.
func computeSessionClassification(session *storage.Session, participants []storage.Participant, laps []storage.Lap) *ClassificationResponse {
	isRaceSession := session != nil && strings.Contains(strings.ToLower(session.SessionType), "race")

	// 1. Group laps by car
	lapsByCar, _ := groupLapsByCar(laps)

	// 2. Prepare active participants
	activeParticipants := buildEffectiveParticipants(session, participants, lapsByCar, isRaceSession)

	// 3. Compute session-wide best sectors
	s1, s2, s3, ultimate := computeSessionBestSectors(laps)

	// 4. Compute standings per driver
	standings := make([]DriverStanding, 0, len(activeParticipants))
	for _, p := range activeParticipants {
		driverLaps := lapsByCar[p.CarIndex]
		standings = append(standings, buildDriverStanding(p, driverLaps))
	}

	// 5. Sort standings
	sortClassificationStandings(standings, isRaceSession)

	// 6. Assign positions and calculate gaps
	actualBestLapMS, actualBestLapDriver := assignClassificationPositionsAndGaps(standings, isRaceSession)

	// 7. Rank speed traps
	speedRankings := rankSpeedTraps(standings)

	return &ClassificationResponse{
		Standings:             standings,
		SessionBestS1MS:       s1,
		SessionBestS2MS:       s2,
		SessionBestS3MS:       s3,
		UltimateTheoreticalMS: ultimate,
		ActualBestLapMS:       actualBestLapMS,
		ActualBestLapDriver:   actualBestLapDriver,
		SpeedRankings:         speedRankings,
	}
}

// handleGetSessionClassification serves GET /api/sessions/{id}/classification
func (s *Server) handleGetSessionClassification(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	idStr := chi.URLParam(r, "id")
	sessionID, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		http.Error(w, "invalid session id", http.StatusBadRequest)
		return
	}

	session, err := s.repo.GetSessionByID(ctx, sessionID)
	if err != nil {
		http.Error(w, "session not found", http.StatusNotFound)
		return
	}

	participants, pErr := s.repo.GetParticipantsBySession(ctx, sessionID)
	if pErr != nil {
		participants = []storage.Participant{}
	}

	laps, lErr := s.repo.GetLapsBySession(ctx, sessionID, nil)
	if lErr != nil {
		laps = []storage.Lap{}
	}

	resp := computeSessionClassification(session, participants, laps)
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(resp)
}
