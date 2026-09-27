package analytics

import (
	"math"
	"sort"
	"strings"
	"time"

	"github.com/mgauna/f1game-telemetry-go/internal/storage"
)

// MinConsistencyLaps is how many clean laps a session needs before its consistency is given.
const MinConsistencyLaps = 3

// TrackProgressResponse is GET /api/progress: the player's sessions at one track, oldest first,
// and every track with recorded sessions for the track picker.
type TrackProgressResponse struct {
	// Track is the track shown: the one asked for, or the track of the latest session.
	Track  string          `json:"track"`
	Tracks []ProgressTrack `json:"tracks"`
	// Sessions are the track's sessions where the player was found, oldest first.
	Sessions []ProgressSession `json:"sessions"`
	// UnmatchedSessions counts the track's sessions left out because the player wasn't found in
	// them (no stored car, and no driver name or no car matching it).
	UnmatchedSessions int `json:"unmatched_sessions"`
}

// ProgressTrack is a track with recorded sessions.
type ProgressTrack struct {
	TrackName     string    `json:"track_name"`
	Sessions      int       `json:"sessions"`
	LastSessionAt time.Time `json:"last_session_at"`
}

// ProgressSession is the player's pace in one session. Lap and sector times are 0 when the
// player set none.
type ProgressSession struct {
	SessionID      int64     `json:"session_id"`
	SessionType    string    `json:"session_type"`
	PacketFormat   int       `json:"packet_format"`
	CreatedAt      time.Time `json:"created_at"`
	Source         string    `json:"source" tstype:"PlayerSource"`
	Position       int       `json:"position"`
	ClassifiedCars int       `json:"classified_cars"`
	LapsCompleted  int       `json:"laps_completed"`
	// BestLap is the player's best lap: the fastest valid lap, or the fastest completed lap when
	// none was valid (as in the classification).
	BestLapID     int64 `json:"best_lap_id"`
	BestLapNumber int   `json:"best_lap_number"`
	BestLapTimeMS int   `json:"best_lap_time_ms"`
	// BestSector1MS..3 are the player's best valid sectors of the session, on any lap.
	BestSector1MS int `json:"best_sector1_ms"`
	BestSector2MS int `json:"best_sector2_ms"`
	BestSector3MS int `json:"best_sector3_ms"`
	// FastestLap is the session's fastest lap, by anyone.
	FastestLapTimeMS  int    `json:"fastest_lap_time_ms"`
	FastestLapID      int64  `json:"fastest_lap_id"`
	FastestDriverName string `json:"fastest_driver_name"`
	// GapToFastestMS is the player's best lap minus the session's fastest: 0 when the player set
	// it, null when either is missing.
	GapToFastestMS *int `json:"gap_to_fastest_ms"`
	// ConsistencyMS is the standard deviation of the player's clean laps (see cleanLapTimes), null
	// with fewer than MinConsistencyLaps of them.
	ConsistencyMS *int `json:"consistency_ms"`
	CleanLaps     int  `json:"clean_laps"`
}

// ProgressTracks lists the tracks of the sessions, latest session first.
func ProgressTracks(sessions []storage.Session) []ProgressTrack {
	byName := map[string]*ProgressTrack{}
	var tracks []*ProgressTrack
	for i := range sessions {
		s := &sessions[i]
		t, ok := byName[s.TrackName]
		if !ok {
			t = &ProgressTrack{TrackName: s.TrackName}
			byName[s.TrackName] = t
			tracks = append(tracks, t)
		}
		t.Sessions++
		if s.CreatedAt.After(t.LastSessionAt) {
			t.LastSessionAt = s.CreatedAt
		}
	}
	sort.SliceStable(tracks, func(i, j int) bool { return tracks[i].LastSessionAt.After(tracks[j].LastSessionAt) })
	out := make([]ProgressTrack, len(tracks))
	for i, t := range tracks {
		out[i] = *t
	}
	return out
}

// ComputeTrackProgress builds the player's progress at a track from its sessions (any order) and
// their participants and laps (storage.Repository.GetSessionResults). driverName finds the player
// in sessions without a stored car, as in the session list.
func ComputeTrackProgress(sessions []storage.Session, participants map[int64][]storage.Participant, laps map[int64][]storage.Lap, driverName string) (points []ProgressSession, unmatched int) {
	points = []ProgressSession{}
	for i := range sessions {
		s := &sessions[i]
		point, ok := computeProgressSession(s, participants[s.ID], laps[s.ID], driverName)
		if !ok {
			unmatched++
			continue
		}
		points = append(points, point)
	}
	sort.SliceStable(points, func(i, j int) bool { return points[i].CreatedAt.Before(points[j].CreatedAt) })
	return points, unmatched
}

func computeProgressSession(session *storage.Session, participants []storage.Participant, laps []storage.Lap, driverName string) (ProgressSession, bool) {
	cls := ComputeSessionClassification(session, participants, laps)
	me, source := FindPlayerStanding(cls.Standings, session.PlayerCarIndex, driverName)
	if me == nil {
		return ProgressSession{}, false
	}

	point := ProgressSession{
		SessionID:        session.ID,
		SessionType:      session.SessionType,
		PacketFormat:     session.PacketFormat,
		CreatedAt:        session.CreatedAt,
		Source:           source,
		Position:         me.Position,
		ClassifiedCars:   len(cls.Standings),
		LapsCompleted:    me.LapsCompleted,
		BestLapID:        me.BestLapID,
		BestLapNumber:    me.BestLapNumber,
		BestLapTimeMS:    me.BestLapTimeMS,
		BestSector1MS:    me.BestS1MS,
		BestSector2MS:    me.BestS2MS,
		BestSector3MS:    me.BestS3MS,
		FastestLapTimeMS: cls.ActualBestLapMS,
	}
	for i := range cls.Standings {
		d := &cls.Standings[i]
		if d.BestLapTimeMS > 0 && d.BestLapTimeMS == cls.ActualBestLapMS {
			point.FastestLapID = d.BestLapID
			point.FastestDriverName = d.DriverName
			break
		}
	}
	if me.BestLapTimeMS > 0 && cls.ActualBestLapMS > 0 {
		gap := me.BestLapTimeMS - cls.ActualBestLapMS
		point.GapToFastestMS = &gap
	}

	lapsByCar, _ := GroupLapsByCar(laps)
	isRace := strings.Contains(strings.ToLower(session.SessionType), "race")
	clean := cleanLapTimes(lapsByCar[me.CarIndex], isRace)
	point.CleanLaps = len(clean)
	if len(clean) >= MinConsistencyLaps {
		sd := int(math.Round(stdDev(clean)))
		point.ConsistencyMS = &sd
	}
	return point, true
}

// cleanLapTimes are the laps consistency is measured on: the valid laps the lap pace chart keeps
// (no in or out lap, none slower than 107% of the median; see analyzeDriverLapOutliers), without
// a race's first lap, which starts from the grid.
func cleanLapTimes(driverLaps []storage.Lap, isRace bool) []float64 {
	outliers := analyzeDriverLapOutliers(driverLaps)
	var times []float64
	for _, l := range driverLaps {
		if !l.IsValid || l.LapTimeMS <= 0 || outliers[l.LapNumber].isOutlier || (isRace && l.LapNumber == 1) {
			continue
		}
		times = append(times, float64(l.LapTimeMS))
	}
	return times
}

// stdDev is the population standard deviation.
func stdDev(values []float64) float64 {
	var sum float64
	for _, v := range values {
		sum += v
	}
	mean := sum / float64(len(values))
	var sq float64
	for _, v := range values {
		sq += (v - mean) * (v - mean)
	}
	return math.Sqrt(sq / float64(len(values)))
}
