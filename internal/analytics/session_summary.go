package analytics

import (
	"bytes"
	"encoding/json"

	"github.com/mgauna/f1game-telemetry-go/internal/storage"
)

// How a session's player car was found.
const (
	// PlayerSourceRecorded: the game's recorded player car (storage.PlayerCarSourceGame).
	PlayerSourceRecorded = "recorded"
	// PlayerSourceChosen: the player picked their car in the dashboard (storage.PlayerCarSourceUser).
	PlayerSourceChosen = "chosen"
)

// PlayerSources lists every PlayerSource; it builds the PlayerSource union for the frontend.
var PlayerSources = []string{PlayerSourceRecorded, PlayerSourceChosen}

// SessionListItem is one row of GET /api/sessions: the session and a summary of its result.
type SessionListItem struct {
	storage.Session
	Summary SessionSummary `json:"summary"`
}

// MarshalJSON writes the session's own JSON (see storage.Session.MarshalJSON, which the
// embedding would otherwise promote and so drop the summary) with the summary added.
func (i SessionListItem) MarshalJSON() ([]byte, error) {
	session, err := json.Marshal(i.Session)
	if err != nil {
		return nil, err
	}
	summary, err := json.Marshal(struct {
		Summary SessionSummary `json:"summary"`
	}{i.Summary})
	if err != nil {
		return nil, err
	}
	session = bytes.TrimSuffix(session, []byte("}"))
	return append(append(session, ','), summary[1:]...), nil
}

// SessionSummary is what the session list shows about a session's result. Every pointer is null
// when the session has no classification to take it from.
type SessionSummary struct {
	// LapsCompleted is how many laps the leader completed.
	LapsCompleted int `json:"laps_completed"`
	// Leader is P1 of the classification: the winner of a race, pole of a qualifying session.
	Leader *SummaryDriver `json:"leader"`
	// FastestLap is the session's fastest lap.
	FastestLap *SummaryLap `json:"fastest_lap"`
	// Player is the player's result: null when the session has no player car (recorded or picked).
	Player *PlayerResult `json:"player"`
}

// SummaryDriver names a driver of the classification.
type SummaryDriver struct {
	CarIndex   int    `json:"car_index"`
	DriverName string `json:"driver_name"`
	TeamID     int    `json:"team_id"`
	RaceNumber int    `json:"race_number"`
}

// SummaryLap is a driver's best lap.
type SummaryLap struct {
	SummaryDriver
	LapID     int64 `json:"lap_id"`
	LapTimeMS int   `json:"lap_time_ms"`
}

// PlayerResult is the player's line of the classification.
type PlayerResult struct {
	SummaryDriver
	Source          string `json:"source" tstype:"PlayerSource"`
	Position        int    `json:"position"`
	GridPosition    int    `json:"grid_position"`
	PositionsGained *int   `json:"positions_gained"`
	ClassifiedCars  int    `json:"classified_cars"`
	BestLapID       int64  `json:"best_lap_id"`
	BestLapTimeMS   int    `json:"best_lap_time_ms"`
	LapsCompleted   int    `json:"laps_completed"`
	IsDNF           bool   `json:"is_dnf"`
	IsDSQ           bool   `json:"is_dsq"`
}

// FindPlayerStanding returns the standing of the session's player car (recorded by the game or
// picked by the player) and how it was found. It returns nil when the session has no player car
// or the car is not in the classification.
func FindPlayerStanding(standings []DriverStanding, session *storage.Session) (standing *DriverStanding, source string) {
	if session == nil || session.PlayerCarIndex == nil {
		return nil, ""
	}
	source = PlayerSourceRecorded
	if session.PlayerCarSource != nil && *session.PlayerCarSource == storage.PlayerCarSourceUser {
		source = PlayerSourceChosen
	}
	for i := range standings {
		if standings[i].CarIndex == *session.PlayerCarIndex {
			return &standings[i], source
		}
	}
	return nil, ""
}

func summaryDriver(d *DriverStanding) SummaryDriver {
	return SummaryDriver{CarIndex: d.CarIndex, DriverName: d.DriverName, TeamID: d.TeamID, RaceNumber: d.RaceNumber}
}

// ComputeSessionSummary summarizes a session's classification for the session list.
func ComputeSessionSummary(session *storage.Session, participants []storage.Participant, laps []storage.Lap) SessionSummary {
	cls := ComputeSessionClassification(session, participants, laps)
	summary := SessionSummary{}
	if len(cls.Standings) == 0 {
		return summary
	}

	leader := &cls.Standings[0]
	leaderDriver := summaryDriver(leader)
	summary.Leader = &leaderDriver
	summary.LapsCompleted = leader.LapsCompleted

	for i := range cls.Standings {
		d := &cls.Standings[i]
		if d.BestLapTimeMS > 0 && d.BestLapTimeMS == cls.ActualBestLapMS {
			summary.FastestLap = &SummaryLap{SummaryDriver: summaryDriver(d), LapID: d.BestLapID, LapTimeMS: d.BestLapTimeMS}
			break
		}
	}

	if me, source := FindPlayerStanding(cls.Standings, session); me != nil {
		summary.Player = &PlayerResult{
			SummaryDriver:   summaryDriver(me),
			Source:          source,
			Position:        me.Position,
			GridPosition:    me.GridPosition,
			PositionsGained: me.PositionsGained,
			ClassifiedCars:  len(cls.Standings),
			BestLapID:       me.BestLapID,
			BestLapTimeMS:   me.BestLapTimeMS,
			LapsCompleted:   me.LapsCompleted,
			IsDNF:           me.IsDNF,
			IsDSQ:           me.IsDSQ,
		}
	}
	return summary
}

// ComputeSessionList adds a result summary to each session, from the participants and laps of
// every session loaded at once (storage.Repository.GetSessionResults).
func ComputeSessionList(sessions []storage.Session, participants map[int64][]storage.Participant, laps map[int64][]storage.Lap) []SessionListItem {
	items := make([]SessionListItem, len(sessions))
	for i := range sessions {
		s := &sessions[i]
		items[i] = SessionListItem{Session: *s, Summary: ComputeSessionSummary(s, participants[s.ID], laps[s.ID])}
	}
	return items
}
