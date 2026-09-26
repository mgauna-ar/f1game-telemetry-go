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

func TestHandleGetEngineerConfigDefaults(t *testing.T) {
	server, _ := setupTestServer(t)
	engine := engineer.NewEngineerEngine(nil)
	server.SetEngineerEngine(engine)

	// Changing the live config must not change what "defaults" returns.
	custom := engineer.DefaultEngineerConfig()
	custom.BrakeOverheatC = 1100
	engine.SetConfig(custom)

	req := httptest.NewRequest(http.MethodGet, "/api/ai/engineer/config/defaults", http.NoBody)
	rec := httptest.NewRecorder()
	server.Router().ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d", rec.Code)
	}
	var cfg engineer.EngineerConfig
	if err := json.NewDecoder(rec.Body).Decode(&cfg); err != nil {
		t.Fatalf("failed to decode defaults: %v", err)
	}
	if cfg.BrakeOverheatC != engineer.BrakeOverheatDefaultC {
		t.Errorf("expected default BrakeOverheatC %v, got %v", engineer.BrakeOverheatDefaultC, cfg.BrakeOverheatC)
	}
	if cfg.UndercutGapSec != engineer.UndercutGapDefaultSec {
		t.Errorf("expected default UndercutGapSec %v, got %v", engineer.UndercutGapDefaultSec, cfg.UndercutGapSec)
	}
}

func TestHandleEngineerConfig_RoundTripsSettingsPanelState(t *testing.T) {
	server, _ := setupTestServer(t)
	server.SetEngineerEngine(engineer.NewEngineerEngine(nil))

	payload := `{"chatter_cooldown_ms": 90000, "trigger_preset": "minimal", "alert_switches": {"tyreAlertsEnabled": false, "subTyrePuncture": true}}`
	postReq := httptest.NewRequest(http.MethodPost, "/api/ai/engineer/config", strings.NewReader(payload))
	postRec := httptest.NewRecorder()
	server.Router().ServeHTTP(postRec, postReq)
	if postRec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d: %s", postRec.Code, postRec.Body.String())
	}

	getReq := httptest.NewRequest(http.MethodGet, "/api/ai/engineer/config", http.NoBody)
	getRec := httptest.NewRecorder()
	server.Router().ServeHTTP(getRec, getReq)
	var cfg engineer.EngineerConfig
	if err := json.NewDecoder(getRec.Body).Decode(&cfg); err != nil {
		t.Fatalf("failed to decode engineer config: %v", err)
	}
	if cfg.TriggerPreset != "minimal" {
		t.Errorf("expected trigger_preset minimal, got %q", cfg.TriggerPreset)
	}
	if cfg.AlertSwitches["tyreAlertsEnabled"] || !cfg.AlertSwitches["subTyrePuncture"] {
		t.Errorf("expected alert_switches to round-trip, got %v", cfg.AlertSwitches)
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
