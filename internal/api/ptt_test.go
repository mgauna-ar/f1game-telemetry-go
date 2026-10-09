package api

import (
	"bytes"
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/mgauna/f1game-telemetry-go/internal/input"
)

// TestPTTMessagesJSON pins the push-to-talk messages on /ws/engineer, which the dashboard tells
// apart by their type.
func TestPTTMessagesJSON(t *testing.T) {
	mapping := input.Mapping{DeviceType: input.DeviceTypeKeyboard, KeyCode: 20, KeyName: "Caps Lock", DeviceName: "Keyboard"}
	const mappingJSON = `{"device_type":"keyboard","device_index":0,"button_index":0,"key_code":20,"key_name":"Caps Lock","device_name":"Keyboard"}`

	tests := []struct {
		name string
		msg  engineerMessage
		want string
	}{
		{
			name: "button event",
			msg:  newPTTEventMessage(input.Event{State: "down", Mapping: mapping, Timestamp: 1234}),
			want: `{"type":"ptt_event","state":"down","mapping":` + mappingJSON + `,"timestamp":1234}`,
		},
		{
			name: "learned",
			msg:  newPTTLearnedMessage(mapping),
			want: `{"type":"ptt_learned","mapping":` + mappingJSON + `}`,
		},
		{
			name: "learn timeout",
			msg:  newPTTLearnTimeoutMessage(),
			want: `{"type":"ptt_learn_timeout"}`,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := json.Marshal(tt.msg)
			if err != nil {
				t.Fatal(err)
			}
			if string(got) != tt.want {
				t.Errorf("got  %s\nwant %s", got, tt.want)
			}
		})
	}
}

// TestPTTTrace checks that a push-to-talk trace from the dashboard lands in the app log, and that a
// malformed one is refused.
func TestPTTTrace(t *testing.T) {
	server, _ := setupTestServer(t)

	var logged bytes.Buffer
	previous := slog.Default()
	slog.SetDefault(slog.New(slog.NewTextHandler(&logged, nil)))
	t.Cleanup(func() { slog.SetDefault(previous) })

	post := func(body string) int {
		rec := httptest.NewRecorder()
		server.router.ServeHTTP(rec, httptest.NewRequest(http.MethodPost, "/api/ai/ptt/trace", strings.NewReader(body)))
		return rec.Code
	}

	long := strings.Repeat("box ", 100)
	trace := `{"outcome":"answer_failed","held_ms":2400,"press_source":"global","release_source":"global",` +
		`"visible_at_press":false,"recognizer_started":true,` +
		`"results":3,"heard":"` + long + `","ai_error":"Quota exceeded.","calls_held":2,"total_ms":3100}`
	if code := post(trace); code != http.StatusOK {
		t.Fatalf("trace: status %d, want 200", code)
	}
	line := logged.String()
	for _, want := range []string{
		`msg="Push-to-talk transmission"`, "outcome=answer_failed", "held_ms=2400", "press_source=global",
		"release_source=global", "visible_at_press=false",
		"results=3", `ai_error="Quota exceeded."`, "calls_held=2",
	} {
		if !strings.Contains(line, want) {
			t.Errorf("log line misses %s:\n%s", want, line)
		}
	}
	if strings.Contains(line, long) {
		t.Errorf("the heard text was not shortened:\n%s", line)
	}

	for name, body := range map[string]string{
		"unknown outcome": `{"outcome":"maybe"}`,
		"not JSON":        `outcome=answered`,
	} {
		if code := post(body); code != http.StatusBadRequest {
			t.Errorf("%s: status %d, want 400", name, code)
		}
	}
}
