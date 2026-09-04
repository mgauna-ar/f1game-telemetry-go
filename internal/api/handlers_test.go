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

	t.Run("GET /api/sessions/{id}/classification", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, fmt.Sprintf("/api/sessions/%d/classification", session.ID), http.NoBody)
		rec := httptest.NewRecorder()
		server.Router().ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200 OK, got %d", rec.Code)
		}

		var resp analytics.ClassificationResponse
		if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
			t.Fatalf("failed to decode response: %v", err)
		}
		if len(resp.Standings) != 2 {
			t.Errorf("expected 2 standings, got %d", len(resp.Standings))
		}
	})

	t.Run("GET /api/sessions/{id}/progression", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, fmt.Sprintf("/api/sessions/%d/progression", session.ID), http.NoBody)
		rec := httptest.NewRecorder()
		server.Router().ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200 OK, got %d", rec.Code)
		}

		var resp analytics.ProgressionResponse
		if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
			t.Fatalf("failed to decode response: %v", err)
		}
		if len(resp.Drivers) != 2 {
			t.Errorf("expected 2 drivers, got %d", len(resp.Drivers))
		}
	})

	t.Run("GET /api/sessions/{id}/stints", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, fmt.Sprintf("/api/sessions/%d/stints", session.ID), http.NoBody)
		rec := httptest.NewRecorder()
		server.Router().ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200 OK, got %d", rec.Code)
		}

		var resp analytics.StintsResponse
		if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
			t.Fatalf("failed to decode response: %v", err)
		}
		if len(resp.Drivers) != 2 {
			t.Errorf("expected 2 drivers, got %d", len(resp.Drivers))
		}
	})

	t.Run("Analytics Error Handling - Invalid ID", func(t *testing.T) {
		endpoints := []string{"classification", "progression", "stints"}
		for _, ep := range endpoints {
			req := httptest.NewRequest(http.MethodGet, fmt.Sprintf("/api/sessions/invalid-id/%s", ep), http.NoBody)
			rec := httptest.NewRecorder()
			server.Router().ServeHTTP(rec, req)

			if rec.Code != http.StatusBadRequest {
				t.Errorf("%s: expected 400 Bad Request for invalid id, got %d", ep, rec.Code)
			}
		}
	})

	t.Run("Analytics Error Handling - Not Found", func(t *testing.T) {
		endpoints := []string{"classification", "progression", "stints"}
		for _, ep := range endpoints {
			req := httptest.NewRequest(http.MethodGet, fmt.Sprintf("/api/sessions/99999999/%s", ep), http.NoBody)
			rec := httptest.NewRecorder()
			server.Router().ServeHTTP(rec, req)

			if rec.Code != http.StatusNotFound {
				t.Errorf("%s: expected 404 Not Found, got %d", ep, rec.Code)
			}
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

	t.Run("GET /api/ai/config-status", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/ai/config-status", http.NoBody)
		rec := httptest.NewRecorder()
		server.Router().ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200 OK, got %d", rec.Code)
		}
		var cfg ai.AIConfigStatusResponse
		_ = json.NewDecoder(rec.Body).Decode(&cfg)
		if cfg.DefaultProvider != "gemini" {
			t.Errorf("expected default provider gemini, got %s", cfg.DefaultProvider)
		}
	})

	t.Run("GET & POST /api/ai/engineer/config", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/ai/engineer/config", http.NoBody)
		rec := httptest.NewRecorder()
		server.Router().ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200 OK, got %d", rec.Code)
		}

		var cfg engineer.EngineerConfig
		if err := json.NewDecoder(rec.Body).Decode(&cfg); err != nil {
			t.Fatalf("failed to decode engineer config: %v", err)
		}

		// Update config
		cfg.ChatterCooldownMs = 30000
		cfgBytes, _ := json.Marshal(cfg)
		postReq := httptest.NewRequest(http.MethodPost, "/api/ai/engineer/config", bytes.NewReader(cfgBytes))
		postRec := httptest.NewRecorder()
		server.Router().ServeHTTP(postRec, postReq)

		if postRec.Code != http.StatusOK {
			t.Fatalf("expected 200 OK, got %d", postRec.Code)
		}

		// Verify update in engine
		if eng.GetConfig().ChatterCooldownMs != 30000 {
			t.Errorf("expected chatter cooldown 30000, got %d", eng.GetConfig().ChatterCooldownMs)
		}

		// Verify persistence in SQLite across server/engine restart
		eng2 := engineer.NewEngineerEngine(hub)
		server.SetEngineerEngine(eng2)
		if eng2.GetConfig().ChatterCooldownMs != 30000 {
			t.Errorf("expected restored chatter cooldown 30000, got %d", eng2.GetConfig().ChatterCooldownMs)
		}
	})

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

	t.Run("POST /api/ai/engineer/config database failure returns 500", func(t *testing.T) {
		failServer, failRepo := setupTestServer(t)
		_ = failRepo.Close() // close underlying db to force storage failure

		cfg := engineer.DefaultEngineerConfig()
		cfgBytes, _ := json.Marshal(cfg)
		postReq := httptest.NewRequest(http.MethodPost, "/api/ai/engineer/config", bytes.NewReader(cfgBytes))
		postRec := httptest.NewRecorder()
		failServer.Router().ServeHTTP(postRec, postReq)

		if postRec.Code != http.StatusInternalServerError {
			t.Errorf("expected 500 Internal Server Error when repo fails, got %d", postRec.Code)
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

func TestSessionAnalytics_NotFound(t *testing.T) {
	server, _ := setupTestServer(t)

	endpoints := []string{
		"/api/sessions/99999/classification",
		"/api/sessions/99999/progression",
		"/api/sessions/99999/stints",
	}

	for _, ep := range endpoints {
		req := httptest.NewRequest(http.MethodGet, ep, http.NoBody)
		rec := httptest.NewRecorder()
		server.Router().ServeHTTP(rec, req)

		if rec.Code != http.StatusNotFound {
			t.Errorf("expected 404 Not Found for %s, got %d", ep, rec.Code)
		}
	}
}

func TestHandleSetEngineerConfig_GlobalChatterCooldownAndAlertKeys(t *testing.T) {
	server, _ := setupTestServer(t)
	engine := engineer.NewEngineerEngine(nil)
	server.SetEngineerEngine(engine)

	// Partial config omitting global_chatter_cooldown_ms but setting damage_wing to false
	payload := `{"chatter_cooldown_ms": 25000, "enabled_categories": {"damage_wing": false}}`
	req := httptest.NewRequest(http.MethodPost, "/api/ai/engineer/config", strings.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	server.Router().ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d: %s", rec.Code, rec.Body.String())
	}

	engineCfg := server.engineerEngine.GetConfig()
	if engineCfg.GlobalChatterCooldownMs != engineer.GlobalRadioChatterCooldownMs {
		t.Errorf("expected GlobalChatterCooldownMs to be %d, got %d", engineer.GlobalRadioChatterCooldownMs, engineCfg.GlobalChatterCooldownMs)
	}

	if engineCfg.IsAlertEnabled("damage", "damage_wing") {
		t.Errorf("expected damage_wing alert to be disabled")
	}
}
