package analytics

import (
	sessionfeed "github.com/mgauna/f1game-telemetry-go/internal/session"
	"github.com/mgauna/f1game-telemetry-go/internal/storage"
)

// SessionDetailResponse is everything the Session History view shows for one session, built from a
// single load of its participants and laps. Participants and laps are sent once here; the
// classification and stints refer to them by car_index and lap ID instead of embedding them.
type SessionDetailResponse struct {
	Participants   []storage.Participant  `json:"participants"`
	Laps           []storage.Lap          `json:"laps"`
	Classification ClassificationResponse `json:"classification"`
	Progression    ProgressionResponse    `json:"progression"`
	Stints         StintsResponse         `json:"stints"`
	// Events are the session's race-control feed rows in order, each with the leader's lap
	// (raceLap). Sessions recorded before the feed was stored have none.
	Events []sessionfeed.FeedEvent `json:"events"`
}

// ComputeSessionDetail builds the classification, progression and stints of a session from one
// load of its data, and adds its stored race-control feed rows.
func ComputeSessionDetail(session *storage.Session, participants []storage.Participant, laps []storage.Lap, events []sessionfeed.FeedEvent) *SessionDetailResponse {
	if participants == nil {
		participants = []storage.Participant{}
	}
	if laps == nil {
		laps = []storage.Lap{}
	}
	if events == nil {
		events = []sessionfeed.FeedEvent{}
	}
	return &SessionDetailResponse{
		Participants:   participants,
		Laps:           laps,
		Classification: *ComputeSessionClassification(session, participants, laps),
		Progression:    *ComputeSessionProgression(session, participants, laps),
		Stints:         *ComputeSessionStints(session, participants, laps, RaceControlPeriods(events)),
		Events:         events,
	}
}
