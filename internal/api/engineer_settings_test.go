package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/mgauna/f1game-telemetry-go/internal/engineer"
	"github.com/mgauna/f1game-telemetry-go/internal/settings"
)

func decodeEngineerSettings(t *testing.T, rec *httptest.ResponseRecorder) EngineerSettingsResponse {
	t.Helper()
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body %s", rec.Code, rec.Body.String())
	}
	var resp EngineerSettingsResponse
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("decode engineer settings: %v", err)
	}
	return resp
}

// putFromClient sends a settings PUT the way a dashboard tab does, with its client id.
func putFromClient(t *testing.T, s *Server, path, body, clientID string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(http.MethodPut, path, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	if clientID != "" {
		req.Header.Set(DashboardClientHeader, clientID)
	}
	rec := httptest.NewRecorder()
	s.Router().ServeHTTP(rec, req)
	return rec
}

// takeEngineerMessages drains what the API layer queued on the engineer hub. The test hub isn't
// running, so broadcasts stay in its channel.
func takeEngineerMessages(t *testing.T, s *Server) []SettingsChangedMessage {
	t.Helper()
	var msgs []SettingsChangedMessage
	for {
		select {
		case raw := <-s.engineerHub.broadcast:
			var msg SettingsChangedMessage
			if err := json.Unmarshal(raw, &msg); err != nil {
				t.Fatalf("decode engineer message %s: %v", raw, err)
			}
			msgs = append(msgs, msg)
		default:
			return msgs
		}
	}
}

func TestEngineerSettings_GetDefaultsBeforeFirstSave(t *testing.T) {
	s, _ := newSettingsTestServer(t, ServerConfig{})
	resp := decodeEngineerSettings(t, doJSON(t, s, http.MethodGet, "/api/settings/engineer", nil))
	if resp.Saved || resp.Version != 0 || resp.Tuning != engineer.DefaultTuning() {
		t.Errorf("got %+v, want unsaved defaults", resp)
	}
}

func TestEngineerSettings_PutSavesAppliesAndBroadcasts(t *testing.T) {
	s, _ := newSettingsTestServer(t, ServerConfig{})
	eng := engineer.NewEngineerEngine(nil)
	s.SetEngineerEngine(eng)

	body := `{"version":0,"chatter_cooldown_ms":25000,"trigger_preset":"minimal","alert_switches":{"damageAlertsEnabled":true,"subDamageWing":false}}`
	resp := decodeEngineerSettings(t, putFromClient(t, s, "/api/settings/engineer", body, "tab-a"))
	if !resp.Saved || resp.Version != 1 || resp.ChatterCooldownMs != 25000 || resp.TriggerPreset != "minimal" {
		t.Errorf("PUT response = %+v", resp)
	}

	// The engine runs with the derived categories and the server's own constants.
	cfg := eng.GetConfig()
	if cfg.ChatterCooldownMs != 25000 {
		t.Errorf("engine cooldown = %d, want 25000", cfg.ChatterCooldownMs)
	}
	if cfg.GlobalChatterCooldownMs != engineer.GlobalRadioChatterCooldownMs ||
		cfg.WingDamageCritPct != engineer.CriticalWingDamageThresholdPct ||
		cfg.QualyTimeWarnSec != engineer.QualyTimeWarnDefaultSec {
		t.Errorf("server-owned values changed: %+v", cfg)
	}
	if cfg.IsAlertEnabled("damage", "damage_wing") || cfg.IsAlertEnabled("damage", "wing_damage") {
		t.Error("both wing damage names should be off")
	}
	if !cfg.IsAlertEnabled("damage", "damage_floor") {
		t.Error("floor damage should stay on")
	}

	msgs := takeEngineerMessages(t, s)
	want := SettingsChangedMessage{Type: "settings_changed", Section: settings.SectionEngineer, Source: "tab-a", Version: 1}
	if len(msgs) != 1 || msgs[0] != want {
		t.Errorf("broadcasts = %+v, want [%+v]", msgs, want)
	}

	// The saved setup survives a restart.
	got := decodeEngineerSettings(t, doJSON(t, s, http.MethodGet, "/api/settings/engineer", nil))
	if !got.Saved || got.Version != 1 || got.AlertSwitches["subDamageWing"] {
		t.Errorf("GET after PUT = %+v", got)
	}
	eng2 := engineer.NewEngineerEngine(nil)
	s.SetEngineerEngine(eng2)
	if eng2.GetConfig().ChatterCooldownMs != 25000 || eng2.GetConfig().IsAlertEnabled("damage", "damage_wing") {
		t.Errorf("restored engine config = %+v", eng2.GetConfig())
	}
}

func TestEngineerSettings_PutKeepsFieldsTheRequestLeavesOut(t *testing.T) {
	s, _ := newSettingsTestServer(t, ServerConfig{})
	putFromClient(t, s, "/api/settings/engineer", `{"version":0,"tyre_wear_warn_pct":55,"trigger_preset":"coaching"}`, "")
	resp := decodeEngineerSettings(t, putFromClient(t, s, "/api/settings/engineer", `{"version":1,"ers_low_pct":22}`, ""))
	if resp.TyreWearWarnPct != 55 || resp.ERSLowPct != 22 || resp.TriggerPreset != "coaching" || resp.Version != 2 {
		t.Errorf("got %+v", resp)
	}
}

func TestEngineerSettings_StaleVersionConflicts(t *testing.T) {
	s, _ := newSettingsTestServer(t, ServerConfig{})
	eng := engineer.NewEngineerEngine(nil)
	s.SetEngineerEngine(eng)

	putFromClient(t, s, "/api/settings/engineer", `{"version":0,"chatter_cooldown_ms":25000}`, "tab-a")
	takeEngineerMessages(t, s)

	// Tab B still has version 0.
	rec := putFromClient(t, s, "/api/settings/engineer", `{"version":0,"chatter_cooldown_ms":90000}`, "tab-b")
	if rec.Code != http.StatusConflict {
		t.Fatalf("status = %d, want 409; body %s", rec.Code, rec.Body.String())
	}
	var errResp ErrorResponse
	if err := json.NewDecoder(rec.Body).Decode(&errResp); err != nil || errResp.Code != ErrorCodeSettingsConflict {
		t.Errorf("error body = %+v (%v), want code %s", errResp, err, ErrorCodeSettingsConflict)
	}
	if eng.GetConfig().ChatterCooldownMs != 25000 {
		t.Errorf("a rejected save changed the engine: %d", eng.GetConfig().ChatterCooldownMs)
	}
	if msgs := takeEngineerMessages(t, s); len(msgs) != 0 {
		t.Errorf("a rejected save broadcast %+v", msgs)
	}
}

func TestEngineerSettings_PutRejectsBadInput(t *testing.T) {
	s, _ := newSettingsTestServer(t, ServerConfig{})
	for name, body := range map[string]string{
		"bad json":       `{`,
		"unknown switch": `{"version":0,"alert_switches":{"damage_wing":false}}`,
	} {
		t.Run(name, func(t *testing.T) {
			if rec := putFromClient(t, s, "/api/settings/engineer", body, ""); rec.Code != http.StatusBadRequest {
				t.Errorf("status = %d, want 400; body %s", rec.Code, rec.Body.String())
			}
		})
	}
}

func TestEngineerSettings_PutStorageFailure(t *testing.T) {
	s, repo := newSettingsTestServer(t, ServerConfig{})
	_ = repo.Close()
	if rec := putFromClient(t, s, "/api/settings/engineer", `{"version":0}`, ""); rec.Code != http.StatusInternalServerError {
		t.Errorf("status = %d, want 500", rec.Code)
	}
}

func TestEngineerSettings_Defaults(t *testing.T) {
	s, _ := newSettingsTestServer(t, ServerConfig{})
	putFromClient(t, s, "/api/settings/engineer", `{"version":0,"brake_overheat_c":1100}`, "")

	rec := doJSON(t, s, http.MethodGet, "/api/settings/engineer/defaults", nil)
	var got settings.Engineer
	if err := json.NewDecoder(rec.Body).Decode(&got); err != nil {
		t.Fatalf("decode defaults: %v", err)
	}
	if got.Tuning != engineer.DefaultTuning() {
		t.Errorf("defaults = %+v, want the built-in tuning", got.Tuning)
	}
}

func TestSettingsPuts_BroadcastSettingsChanged(t *testing.T) {
	s, _ := newSettingsTestServer(t, ServerConfig{})
	longID := strings.Repeat("x", maxDashboardClientIDLen+10)
	cases := []struct {
		path, body, section, clientID, wantSource string
	}{
		{"/api/settings/ai", `{"provider":"openai"}`, settings.SectionAI, "tab-a", "tab-a"},
		{"/api/settings/voice", `{"persona":"standard"}`, settings.SectionVoice, " tab-b ", "tab-b"},
		{"/api/settings/ptt", `{"mode":"hold","keyboard_key":"Space"}`, settings.SectionPTT, "", ""},
		{"/api/settings/engineer", `{"version":0}`, settings.SectionEngineer, longID, longID[:maxDashboardClientIDLen]},
	}
	for _, tc := range cases {
		t.Run(tc.section, func(t *testing.T) {
			if rec := putFromClient(t, s, tc.path, tc.body, tc.clientID); rec.Code != http.StatusOK {
				t.Fatalf("status = %d, body %s", rec.Code, rec.Body.String())
			}
			msgs := takeEngineerMessages(t, s)
			if len(msgs) != 1 || msgs[0].Type != "settings_changed" || msgs[0].Section != tc.section || msgs[0].Source != tc.wantSource {
				t.Errorf("broadcasts = %+v, want one settings_changed for %s from %q", msgs, tc.section, tc.wantSource)
			}
		})
	}
}

func TestOldEngineerConfigRoutesAreGone(t *testing.T) {
	s, _ := newSettingsTestServer(t, ServerConfig{})
	for _, tc := range []struct{ method, path string }{
		{http.MethodGet, "/api/ai/engineer/config"},
		{http.MethodPost, "/api/ai/engineer/config"},
		{http.MethodGet, "/api/ai/engineer/config/defaults"},
	} {
		rec := doJSON(t, s, tc.method, tc.path, nil)
		if rec.Code == http.StatusOK {
			t.Errorf("%s %s still answers 200", tc.method, tc.path)
		}
	}
}
