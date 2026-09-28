package api

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/mgauna/f1game-telemetry-go/internal/ai"
	"github.com/mgauna/f1game-telemetry-go/internal/analytics"
	"github.com/mgauna/f1game-telemetry-go/internal/engineer"
	"github.com/mgauna/f1game-telemetry-go/internal/storage"
)

func TestHandlersAnalytics(t *testing.T) {
	server, repo := setupTestServer(t)
	ctx := context.Background()

	session := &storage.Session{
		SessionUID:   storage.FormatSessionUID(112233),
		TrackID:      1,
		TrackName:    "Albert Park",
		SessionType:  "Race",
		PacketFormat: 2025,
		TotalLaps:    2,
	}
	if err := repo.SaveSession(ctx, session); err != nil {
		t.Fatalf("failed to save session: %v", err)
	}

	participants := []storage.Participant{
		{CarIndex: 0, Name: "Max Verstappen", RaceNumber: 1, Position: 1, TotalRaceTime: 180.0},
		{CarIndex: 1, Name: "Lewis Hamilton", RaceNumber: 44, Position: 2, TotalRaceTime: 182.0},
	}
	if err := repo.SaveParticipants(ctx, session.ID, participants); err != nil {
		t.Fatalf("failed to save participants: %v", err)
	}

	laps := []*storage.Lap{
		{SessionID: session.ID, CarIndex: 0, LapNumber: 1, LapTimeMS: 90000, TyreCompound: "SOFT", IsValid: true, Sector1MS: 30000, Sector2MS: 30000, Sector3MS: 30000, Sector1Valid: true, Sector2Valid: true, Sector3Valid: true},
		{SessionID: session.ID, CarIndex: 0, LapNumber: 2, LapTimeMS: 90000, TyreCompound: "SOFT", IsValid: true, Sector1MS: 30000, Sector2MS: 30000, Sector3MS: 30000, Sector1Valid: true, Sector2Valid: true, Sector3Valid: true},
		{SessionID: session.ID, CarIndex: 1, LapNumber: 1, LapTimeMS: 91000, TyreCompound: "MEDIUM", IsValid: true, Sector1MS: 30500, Sector2MS: 30500, Sector3MS: 30000, Sector1Valid: true, Sector2Valid: true, Sector3Valid: true},
		{SessionID: session.ID, CarIndex: 1, LapNumber: 2, LapTimeMS: 91000, TyreCompound: "MEDIUM", IsValid: true, Sector1MS: 30500, Sector2MS: 30500, Sector3MS: 30000, Sector1Valid: true, Sector2Valid: true, Sector3Valid: true},
	}
	for _, l := range laps {
		if err := repo.SaveLap(ctx, l, false); err != nil {
			t.Fatalf("failed to save lap: %v", err)
		}
	}

	t.Run("GET /api/sessions/{id}/detail", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, fmt.Sprintf("/api/sessions/%d/detail", session.ID), http.NoBody)
		rec := httptest.NewRecorder()
		server.Router().ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200 OK, got %d", rec.Code)
		}

		body := rec.Body.String()
		var resp analytics.SessionDetailResponse
		if err := json.Unmarshal([]byte(body), &resp); err != nil {
			t.Fatalf("failed to decode response: %v", err)
		}
		if len(resp.Participants) != 2 {
			t.Errorf("expected 2 participants, got %d", len(resp.Participants))
		}
		if len(resp.Laps) != len(laps) {
			t.Errorf("expected %d laps, got %d", len(laps), len(resp.Laps))
		}
		if len(resp.Classification.Standings) != 2 {
			t.Errorf("expected 2 standings, got %d", len(resp.Classification.Standings))
		}
		if len(resp.Progression.Drivers) != 2 {
			t.Errorf("expected 2 progression drivers, got %d", len(resp.Progression.Drivers))
		}
		if len(resp.Stints.Drivers) != 2 {
			t.Errorf("expected 2 stint drivers, got %d", len(resp.Stints.Drivers))
		}
		// Laps are sent once, in the top-level list; standings point at the best lap by ID.
		if got := lapObjects(body); got != len(laps) {
			t.Errorf("expected %d lap rows in the body, got %d", len(laps), got)
		}
		if best := resp.Classification.Standings[0]; best.BestLapID == 0 {
			t.Errorf("expected the leader's best_lap_id, got %+v", best)
		}
	})

	t.Run("GET /api/sessions adds each session's summary", func(t *testing.T) {
		// A second session that stored the player's car.
		mine := &storage.Session{SessionUID: storage.FormatSessionUID(445566), TrackID: 1, TrackName: "Albert Park", SessionType: "Race", PacketFormat: 2026, PlayerCarIndex: new(1)}
		if err := repo.SaveSession(ctx, mine); err != nil {
			t.Fatalf("failed to save session: %v", err)
		}
		if err := repo.SaveParticipants(ctx, mine.ID, participants); err != nil {
			t.Fatalf("failed to save participants: %v", err)
		}
		for _, l := range laps {
			lap := *l
			lap.ID = 0
			lap.SessionID = mine.ID
			if err := repo.SaveLap(ctx, &lap, false); err != nil {
				t.Fatalf("failed to save lap: %v", err)
			}
		}

		type listItem struct {
			ID             int64                    `json:"id"`
			PlayerCarIndex *int                     `json:"player_car_index"`
			Summary        analytics.SessionSummary `json:"summary"`
		}
		get := func(url string) map[int64]listItem {
			t.Helper()
			rec := httptest.NewRecorder()
			server.Router().ServeHTTP(rec, httptest.NewRequest(http.MethodGet, url, http.NoBody))
			if rec.Code != http.StatusOK {
				t.Fatalf("GET %s: expected 200 OK, got %d: %s", url, rec.Code, rec.Body.String())
			}
			var items []listItem
			if err := json.Unmarshal(rec.Body.Bytes(), &items); err != nil {
				t.Fatalf("failed to decode response: %v", err)
			}
			byID := map[int64]listItem{}
			for _, it := range items {
				byID[it.ID] = it
			}
			return byID
		}

		items := get("/api/sessions")
		old, recorded := items[session.ID], items[mine.ID]
		if old.PlayerCarIndex != nil || old.Summary.Player != nil {
			t.Errorf("old session: player_car_index %v, player %+v; want both null", old.PlayerCarIndex, old.Summary.Player)
		}
		if old.Summary.Leader == nil || old.Summary.Leader.DriverName != "Max Verstappen" || old.Summary.LapsCompleted != 2 {
			t.Errorf("old session summary = %+v, want Verstappen leading after 2 laps", old.Summary)
		}
		if fl := old.Summary.FastestLap; fl == nil || fl.LapTimeMS != 90000 {
			t.Errorf("fastest lap = %+v, want 90000", fl)
		}
		if p := recorded.Summary.Player; p == nil || p.CarIndex != 1 || p.Source != analytics.PlayerSourceRecorded || p.Position != 2 {
			t.Errorf("recorded player = %+v, want car 1 P2 from the stored car", p)
		}

		// A saved driver name no longer finds anyone: only a recorded or picked car counts.
		items = get("/api/sessions?driver=hamilton")
		if p := items[session.ID].Summary.Player; p != nil {
			t.Errorf("?driver= is ignored, got player %+v", p)
		}
	})

	t.Run("GET /api/progress returns the player's sessions at a track", func(t *testing.T) {
		get := func(url string) analytics.TrackProgressResponse {
			t.Helper()
			rec := httptest.NewRecorder()
			server.Router().ServeHTTP(rec, httptest.NewRequest(http.MethodGet, url, http.NoBody))
			if rec.Code != http.StatusOK {
				t.Fatalf("GET %s: expected 200 OK, got %d: %s", url, rec.Code, rec.Body.String())
			}
			var resp analytics.TrackProgressResponse
			if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
				t.Fatalf("failed to decode response: %v", err)
			}
			return resp
		}

		// The previous subtest added a second Albert Park session that stored the player's car.
		resp := get("/api/progress")
		if resp.Track != "Albert Park" || len(resp.Tracks) != 1 || resp.Tracks[0].Sessions != 2 {
			t.Fatalf("track = %q, tracks = %+v; want Albert Park with 2 sessions", resp.Track, resp.Tracks)
		}
		if len(resp.Sessions) != 1 || resp.UnmatchedSessions != 1 || resp.Sessions[0].Source != analytics.PlayerSourceRecorded {
			t.Errorf("before a pick: sessions %+v, unmatched %d; want the recorded one only", resp.Sessions, resp.UnmatchedSessions)
		}

		// Picking Hamilton in the old session brings it in as a chosen car.
		putPlayer(t, server, session.ID, `{"car_index":1}`, http.StatusOK)
		resp = get("/api/progress?track=Albert+Park")
		if len(resp.Sessions) != 2 || resp.UnmatchedSessions != 0 {
			t.Fatalf("after a pick: %d sessions, %d unmatched; want 2 and 0", len(resp.Sessions), resp.UnmatchedSessions)
		}
		if first := resp.Sessions[0]; first.SessionID != session.ID || first.Source != analytics.PlayerSourceChosen || first.BestLapTimeMS != 91000 ||
			first.GapToFastestMS == nil || *first.GapToFastestMS != 1000 || first.FastestDriverName != "Max Verstappen" {
			t.Errorf("oldest session = %+v, want Hamilton (chosen) 1.000s off Verstappen", first)
		}

		resp = get("/api/progress?track=Monaco")
		if resp.Track != "Monaco" || len(resp.Sessions) != 0 || len(resp.Tracks) != 1 {
			t.Errorf("unknown track: %+v, want no sessions and the track list", resp)
		}
	})

	t.Run("Analytics Error Handling - Invalid ID", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/sessions/invalid-id/detail", http.NoBody)
		rec := httptest.NewRecorder()
		server.Router().ServeHTTP(rec, req)

		if rec.Code != http.StatusBadRequest {
			t.Errorf("expected 400 Bad Request for invalid id, got %d", rec.Code)
		}
	})

	t.Run("Analytics Error Handling - Not Found", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/sessions/99999999/detail", http.NoBody)
		rec := httptest.NewRecorder()
		server.Router().ServeHTTP(rec, req)

		if rec.Code != http.StatusNotFound {
			t.Errorf("expected 404 Not Found, got %d", rec.Code)
		}
	})
}

func TestHandlersComparator(t *testing.T) {
	server, repo := setupTestServer(t)
	ctx := context.Background()

	session := &storage.Session{
		SessionUID:   storage.FormatSessionUID(334455),
		TrackID:      1,
		TrackName:    "Monza",
		SessionType:  "Race",
		PacketFormat: 2026,
	}
	_ = repo.SaveSession(ctx, session)

	lap1 := &storage.Lap{SessionID: session.ID, CarIndex: 0, LapNumber: 1, LapTimeMS: 80000}
	_ = repo.SaveLap(ctx, lap1, false)
	samples1 := []storage.TelemetrySample{
		{LapDistance: 0, SessionTime: 0, Speed: 250},
		{LapDistance: 100, SessionTime: 1.4, Speed: 260},
	}
	_ = repo.SaveLapTelemetryBlob(ctx, lap1.ID, samples1)

	lap2 := &storage.Lap{SessionID: session.ID, CarIndex: 1, LapNumber: 1, LapTimeMS: 81000}
	_ = repo.SaveLap(ctx, lap2, false)
	samples2 := []storage.TelemetrySample{
		{LapDistance: 0, SessionTime: 0, Speed: 245},
		{LapDistance: 100, SessionTime: 1.5, Speed: 255},
	}
	_ = repo.SaveLapTelemetryBlob(ctx, lap2.ID, samples2)

	t.Run("GET /api/comparator/merge with valid laps", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, fmt.Sprintf("/api/comparator/merge?lapA=%d&lapB=%d&stepMeters=50", lap1.ID, lap2.ID), http.NoBody)
		rec := httptest.NewRecorder()
		server.Router().ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200 OK, got %d", rec.Code)
		}

		var resp analytics.ComparatorResponse
		if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
			t.Fatalf("failed to decode response: %v", err)
		}
		if len(resp.Points) == 0 {
			t.Fatal("expected non-empty points")
		}
	})

	t.Run("GET /api/comparator/merge empty params", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/comparator/merge", http.NoBody)
		rec := httptest.NewRecorder()
		server.Router().ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200 OK, got %d", rec.Code)
		}
	})
}

func TestHandlersAI(t *testing.T) {
	server, _ := setupTestServer(t)

	hub := NewHub("Engineer")
	eng := engineer.NewEngineerEngine(hub)
	server.SetEngineerEngine(eng)

	t.Run("POST /api/ai/tts validation", func(t *testing.T) {
		// Empty text returns 400
		payload, _ := json.Marshal(ai.AITTSRequest{Text: ""})
		req := httptest.NewRequest(http.MethodPost, "/api/ai/tts", bytes.NewReader(payload))
		rec := httptest.NewRecorder()
		server.Router().ServeHTTP(rec, req)

		if rec.Code != http.StatusBadRequest {
			t.Errorf("expected 400 Bad Request, got %d", rec.Code)
		}
	})

	t.Run("POST /api/ai/chat validation", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/api/ai/chat", strings.NewReader("bad json"))
		rec := httptest.NewRecorder()
		server.Router().ServeHTTP(rec, req)

		if rec.Code != http.StatusBadRequest {
			t.Errorf("expected 400 Bad Request, got %d", rec.Code)
		}
	})
}

func TestComparatorMerge_Errors(t *testing.T) {
	server, _ := setupTestServer(t)

	// Lap not found returns 404
	req := httptest.NewRequest(http.MethodGet, "/api/comparator/merge?lapA=99999", http.NoBody)
	rec := httptest.NewRecorder()
	server.Router().ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Errorf("expected 404 Not Found for non-existent lapA, got %d", rec.Code)
	}

	reqB := httptest.NewRequest(http.MethodGet, "/api/comparator/merge?lapB=99999", http.NoBody)
	recB := httptest.NewRecorder()
	server.Router().ServeHTTP(recB, reqB)

	if recB.Code != http.StatusNotFound {
		t.Errorf("expected 404 Not Found for non-existent lapB, got %d", recB.Code)
	}
}

// A session with nothing recorded yet still sends empty lists, never null.
func TestSessionDetail_EmptySession(t *testing.T) {
	server, repo := setupTestServer(t)
	session := &storage.Session{SessionUID: storage.FormatSessionUID(445566), SessionType: "Race", PacketFormat: 2025}
	if err := repo.SaveSession(context.Background(), session); err != nil {
		t.Fatalf("failed to save session: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, fmt.Sprintf("/api/sessions/%d/detail", session.ID), http.NoBody)
	rec := httptest.NewRecorder()
	server.Router().ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d", rec.Code)
	}
	for _, want := range []string{`"participants":[]`, `"laps":[]`, `"standings":[]`} {
		if !strings.Contains(rec.Body.String(), want) {
			t.Errorf("expected %s in %s", want, rec.Body.String())
		}
	}
}

// putPlayer sends PUT /api/sessions/{id}/player and checks the status code.
func putPlayer(t *testing.T, server *Server, sessionID int64, body string, wantCode int) *httptest.ResponseRecorder {
	t.Helper()
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPut, fmt.Sprintf("/api/sessions/%d/player", sessionID), strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	server.Router().ServeHTTP(rec, req)
	if rec.Code != wantCode {
		t.Fatalf("PUT player %s: expected %d, got %d: %s", body, wantCode, rec.Code, rec.Body.String())
	}
	return rec
}

func TestHandlersSetPlayerCar(t *testing.T) {
	server, repo := setupTestServer(t)
	ctx := context.Background()

	session := &storage.Session{SessionUID: storage.FormatSessionUID(9001), TrackName: "Monza", SessionType: "Race", PacketFormat: 2025, PlayerCarIndex: new(0)}
	if err := repo.SaveSession(ctx, session); err != nil {
		t.Fatalf("failed to save session: %v", err)
	}
	if err := repo.SaveParticipants(ctx, session.ID, []storage.Participant{
		{CarIndex: 0, Name: "Max Verstappen", RaceNumber: 1, Position: 1},
		{CarIndex: 1, Name: "Lewis Hamilton", RaceNumber: 44, Position: 2},
	}); err != nil {
		t.Fatalf("failed to save participants: %v", err)
	}

	decode := func(rec *httptest.ResponseRecorder) storage.Session {
		t.Helper()
		var s storage.Session
		if err := json.Unmarshal(rec.Body.Bytes(), &s); err != nil {
			t.Fatalf("failed to decode session: %v", err)
		}
		return s
	}

	got := decode(putPlayer(t, server, session.ID, `{"car_index":1}`, http.StatusOK))
	if got.ID != session.ID || got.PlayerCarIndex == nil || *got.PlayerCarIndex != 1 ||
		got.PlayerCarSource == nil || *got.PlayerCarSource != storage.PlayerCarSourceUser {
		t.Errorf("after a pick: car %v, source %v; want 1, user", got.PlayerCarIndex, got.PlayerCarSource)
	}

	putPlayer(t, server, 999999, `{"car_index":1}`, http.StatusNotFound)
	putPlayer(t, server, session.ID, `{"car_index":7}`, http.StatusBadRequest)
	putPlayer(t, server, session.ID, `not json`, http.StatusBadRequest)
	if s, err := repo.GetSessionByID(ctx, session.ID); err != nil || *s.PlayerCarIndex != 1 {
		t.Errorf("a rejected pick must leave car 1, got %+v (%v)", s, err)
	}

	got = decode(putPlayer(t, server, session.ID, `{"car_index":null}`, http.StatusOK))
	if got.PlayerCarIndex != nil || got.PlayerCarSource != nil {
		t.Errorf("after null: car %v, source %v; want both null", got.PlayerCarIndex, got.PlayerCarSource)
	}
}

func TestHandlersBatchSetPlayer(t *testing.T) {
	server, repo := setupTestServer(t)
	ctx := context.Background()

	save := func(uid uint64, participants ...storage.Participant) int64 {
		t.Helper()
		s := &storage.Session{SessionUID: storage.FormatSessionUID(uid), TrackName: "Monza", SessionType: "Race", PacketFormat: 2025}
		if err := repo.SaveSession(ctx, s); err != nil {
			t.Fatalf("failed to save session: %v", err)
		}
		if err := repo.SaveParticipants(ctx, s.ID, participants); err != nil {
			t.Fatalf("failed to save participants: %v", err)
		}
		return s.ID
	}
	me := func(car int, name string) storage.Participant {
		return storage.Participant{CarIndex: car, Name: name, RaceNumber: car + 2}
	}
	matched := save(1, me(0, "Max Verstappen"), me(3, "M. Gauna"))
	missing := save(2, me(0, "Max Verstappen"))
	twice := save(3, me(0, "m. gauna"), me(1, "M. Gauna"))
	// Car 2 has no name: the game's name for its driver ID counts, as in the classification.
	byDriverID := save(4, me(0, "Max Verstappen"), storage.Participant{CarIndex: 2, DriverID: 0})

	post := func(body string, wantCode int) storage.BatchPlayerResult {
		t.Helper()
		rec := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodPost, "/api/sessions/batch-player", strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		server.Router().ServeHTTP(rec, req)
		if rec.Code != wantCode {
			t.Fatalf("POST batch-player %s: expected %d, got %d: %s", body, wantCode, rec.Code, rec.Body.String())
		}
		var res storage.BatchPlayerResult
		if wantCode == http.StatusOK {
			if err := json.Unmarshal(rec.Body.Bytes(), &res); err != nil {
				t.Fatalf("failed to decode result: %v", err)
			}
		}
		return res
	}

	res := post(fmt.Sprintf(`{"session_ids":[%d,%d,%d,999999],"driver_name":"  m. GAUNA "}`, matched, missing, twice), http.StatusOK)
	if fmt.Sprint(res.Updated) != fmt.Sprint([]int64{matched}) ||
		fmt.Sprint(res.NotFound) != fmt.Sprint([]int64{missing, 999999}) ||
		fmt.Sprint(res.Ambiguous) != fmt.Sprint([]int64{twice}) {
		t.Errorf("result = %+v; want updated [%d], not found [%d 999999], ambiguous [%d]", res, matched, missing, twice)
	}
	if s, _ := repo.GetSessionByID(ctx, matched); s.PlayerCarIndex == nil || *s.PlayerCarIndex != 3 || *s.PlayerCarSource != storage.PlayerCarSourceUser {
		t.Errorf("matched session: car %v, source %v; want 3, user", s.PlayerCarIndex, s.PlayerCarSource)
	}
	for _, id := range []int64{missing, twice} {
		if s, _ := repo.GetSessionByID(ctx, id); s.PlayerCarIndex != nil {
			t.Errorf("session %d must be left without a car, got %d", id, *s.PlayerCarIndex)
		}
	}

	name := storage.Participant{DriverID: 0}.DisplayName()
	res = post(fmt.Sprintf(`{"session_ids":[%d],"driver_name":%q}`, byDriverID, name), http.StatusOK)
	if len(res.Updated) != 1 {
		t.Errorf("a participant named by driver ID (%q): %+v, want updated", name, res)
	}

	post(`{"session_ids":[],"driver_name":"x"}`, http.StatusBadRequest)
	post(fmt.Sprintf(`{"session_ids":[%d],"driver_name":"  "}`, matched), http.StatusBadRequest)
}
