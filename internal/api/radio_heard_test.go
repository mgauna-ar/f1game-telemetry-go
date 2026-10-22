package api

import (
	"bytes"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/mgauna/f1game-telemetry-go/internal/engineer"
)

// TestRadioHeard checks that a dashboard's report on a proactive call lands in the app log once,
// however many dashboards report it, and that a malformed one is refused.
func TestRadioHeard(t *testing.T) {
	server, _ := setupTestServer(t)
	server.SetEngineerEngine(engineer.NewEngineerEngine(nil))

	var logged bytes.Buffer
	previous := slog.Default()
	slog.SetDefault(slog.New(slog.NewTextHandler(&logged, nil)))
	t.Cleanup(func() { slog.SetDefault(previous) })

	post := func(body string) int {
		rec := httptest.NewRecorder()
		server.router.ServeHTTP(rec, httptest.NewRequest(http.MethodPost, "/api/ai/engineer/radio-heard", strings.NewReader(body)))
		return rec.Code
	}

	report := `{"directive_id":"directive_1700000000000_inlap_traffic_behind","urgent":true,"outcome":"said",` +
		`"wait_ms":0,"start_ms":420,"synth_ms":0,"cached":true,"speech_ms":2300,"visible":false}`
	if code := post(report); code != http.StatusOK {
		t.Fatalf("report: status %d, want 200", code)
	}
	line := logged.String()
	for _, want := range []string{
		`msg="Radio call heard"`, "key=inlap_traffic_behind", "urgent=true", "outcome=said", "wait_ms=0",
		"start_ms=420", "cached=true", "speech_ms=2300", "visible=false",
	} {
		if !strings.Contains(line, want) {
			t.Errorf("log line misses %s:\n%s", want, line)
		}
	}

	// A second dashboard saying the same call doesn't count again.
	logged.Reset()
	if code := post(strings.Replace(report, `"start_ms":420`, `"start_ms":900`, 1)); code != http.StatusOK {
		t.Fatalf("second report: status %d, want 200", code)
	}
	if logged.Len() != 0 {
		t.Errorf("a second report of the same call was logged:\n%s", logged.String())
	}

	for name, body := range map[string]string{
		"unknown outcome": `{"directive_id":"directive_1_x","outcome":"maybe"}`,
		"no directive":    `{"outcome":"said"}`,
		"not JSON":        `outcome=said`,
	} {
		if code := post(body); code != http.StatusBadRequest {
			t.Errorf("%s: status %d, want 400", name, code)
		}
	}
}
