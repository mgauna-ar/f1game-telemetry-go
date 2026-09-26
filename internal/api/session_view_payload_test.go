package api

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"strconv"
	"strings"
	"sync/atomic"
	"testing"

	"github.com/mgauna/f1game-telemetry-go/internal/storage"
)

// countingRepository counts the session, participant and lap reads the handlers make.
type countingRepository struct {
	storage.Repository
	reads atomic.Int64
}

func (c *countingRepository) GetSessionByID(ctx context.Context, sessionID int64) (*storage.Session, error) {
	c.reads.Add(1)
	return c.Repository.GetSessionByID(ctx, sessionID)
}

func (c *countingRepository) GetParticipantsBySession(ctx context.Context, sessionID int64) ([]storage.Participant, error) {
	c.reads.Add(1)
	return c.Repository.GetParticipantsBySession(ctx, sessionID)
}

func (c *countingRepository) GetLapsBySession(ctx context.Context, sessionID int64, carIndex *int) ([]storage.Lap, error) {
	c.reads.Add(1)
	return c.Repository.GetLapsBySession(ctx, sessionID, carIndex)
}

const (
	payloadRaceCars = 22
	payloadRaceLaps = 58
)

// seedPayloadRace stores a full synthetic race: 22 cars, 58 laps each, two pit stops.
func seedPayloadRace(t *testing.T, repo storage.Repository) int64 {
	t.Helper()
	ctx := context.Background()
	session := &storage.Session{
		SessionUID:   storage.FormatSessionUID(20260926),
		TrackID:      0,
		TrackName:    "Melbourne",
		SessionType:  "Race",
		PacketFormat: 2025,
		TotalLaps:    payloadRaceLaps,
	}
	if err := repo.SaveSession(ctx, session); err != nil {
		t.Fatalf("save session: %v", err)
	}

	participants := make([]storage.Participant, payloadRaceCars)
	for car := range payloadRaceCars {
		participants[car] = storage.Participant{
			CarIndex: car, Name: fmt.Sprintf("Driver %d", car+1), DriverID: car, TeamID: car / 2,
			RaceNumber: car + 1, GridPosition: car + 1, Position: car + 1, NumPitStops: 2,
			TotalRaceTime: float64(payloadRaceLaps*81 + car), ResultStatus: 3,
		}
	}
	if err := repo.SaveParticipants(ctx, session.ID, participants); err != nil {
		t.Fatalf("save participants: %v", err)
	}

	for car := range payloadRaceCars {
		for lap := 1; lap <= payloadRaceLaps; lap++ {
			compound, stint := "Soft", 1
			switch {
			case lap > 40:
				compound, stint = "Hard", 3
			case lap > 18:
				compound, stint = "Medium", 2
			}
			s1 := 26000 + car*20 + lap%7*15
			s2 := 28000 + car*25 + lap%5*20
			s3 := 27000 + car*15 + lap%3*10
			l := &storage.Lap{
				SessionID: session.ID, CarIndex: car, LapNumber: lap, LapTimeMS: s1 + s2 + s3,
				Sector1MS: s1, Sector2MS: s2, Sector3MS: s3, IsValid: lap%11 != 0,
				Sector1Valid: true, Sector2Valid: true, Sector3Valid: true,
				TyreCompound: compound, ActualCompound: "C" + strconv.Itoa(stint+2), Stint: stint,
				FuelLoad: 100 - float64(lap)*1.6, MaxSpeedKMH: 318 + float64(car%9), CarPosition: car + 1,
				ResultStatus: 2,
			}
			if err := repo.SaveLap(ctx, l, false); err != nil {
				t.Fatalf("save lap: %v", err)
			}
		}
	}
	return session.ID
}

// payloadRequest replays one GET and returns the body.
func payloadRequest(t *testing.T, server *Server, path string) string {
	t.Helper()
	req := httptest.NewRequest(http.MethodGet, path, http.NoBody)
	rec := httptest.NewRecorder()
	server.Router().ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("GET %s: status %d: %s", path, rec.Code, rec.Body.String())
	}
	return rec.Body.String()
}

// lapObjects counts the lap rows serialized in a JSON body (every storage.Lap has one lap_time_ms key).
func lapObjects(body string) int {
	return strings.Count(body, `"lap_time_ms":`)
}

// sessionDataReadsPerRequest is the most reads one request may make: the session, its participants
// and its laps.
const sessionDataReadsPerRequest = 3

type payloadFlow struct {
	name  string
	paths []string
}

// measureSessionView replays the requests a Session History view and the comparator make for one
// session, logs the bytes, lap rows and repository reads of each, and checks that each flow sends
// every lap once and reads the session's data once.
func measureSessionView(t *testing.T, server *Server, repo *countingRepository, sessionID int64, lapCount int) {
	t.Helper()
	flows := []payloadFlow{
		{name: "Session History view", paths: []string{fmt.Sprintf("/api/sessions/%d/detail", sessionID)}},
		// Only when the session isn't already in the client cache (sessionDataCache.ts): both slots
		// on one session share this load, and a session opened in Session History needs none.
		{name: "Comparator session load", paths: []string{
			fmt.Sprintf("/api/sessions/%d/participants", sessionID),
			fmt.Sprintf("/api/sessions/%d/laps", sessionID),
		}},
	}
	t.Logf("session %d: %d laps", sessionID, lapCount)
	for _, flow := range flows {
		repo.reads.Store(0)
		totalBytes, totalLaps := 0, 0
		for _, path := range flow.paths {
			body := payloadRequest(t, server, path)
			totalBytes += len(body)
			totalLaps += lapObjects(body)
			t.Logf("  %-45s %9d bytes  %5d lap rows", path, len(body), lapObjects(body))
		}
		reads := repo.reads.Load()
		t.Logf("  %s: %d requests, %d bytes, %d lap rows (%.2f× the laps), %d repository reads",
			flow.name, len(flow.paths), totalBytes, totalLaps, float64(totalLaps)/float64(lapCount), reads)
		if totalLaps != lapCount {
			t.Errorf("%s: sent %d lap rows, want each of the %d laps once", flow.name, totalLaps, lapCount)
		}
		if maxReads := int64(len(flow.paths) * sessionDataReadsPerRequest); reads > maxReads {
			t.Errorf("%s: %d repository reads, want at most %d", flow.name, reads, maxReads)
		}
	}
}

// TestSessionViewPayloadSize measures what opening a session costs. Run with -v for the numbers.
// Set F1_PAYLOAD_DB (a copy of a database; opening it runs migrations) and F1_PAYLOAD_SESSION to
// measure a recorded session instead of the synthetic race.
func TestSessionViewPayloadSize(t *testing.T) {
	var repo *countingRepository
	var sessionID int64
	if dbPath := os.Getenv("F1_PAYLOAD_DB"); dbPath != "" {
		recorded, err := storage.NewSQLiteRepository(dbPath)
		if err != nil {
			t.Fatalf("open %s: %v", dbPath, err)
		}
		t.Cleanup(func() { recorded.Close() })
		id, err := strconv.ParseInt(os.Getenv("F1_PAYLOAD_SESSION"), 10, 64)
		if err != nil {
			t.Fatalf("F1_PAYLOAD_SESSION: %v", err)
		}
		repo, sessionID = &countingRepository{Repository: recorded}, id
	} else {
		_, base := setupTestServer(t)
		sessionID = seedPayloadRace(t, base)
		repo = &countingRepository{Repository: base}
	}
	server := NewServer(repo, NewHub("Telemetry"), NewHub("Engineer"), ServerConfig{})

	laps, err := repo.Repository.GetLapsBySession(context.Background(), sessionID, nil)
	if err != nil {
		t.Fatalf("laps: %v", err)
	}
	measureSessionView(t, server, repo, sessionID, len(laps))
}
