package desktop

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestShowRunningWindow(t *testing.T) {
	var asked []WindowRequest
	status := http.StatusAccepted
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost || r.URL.Path != windowEndpoint {
			http.NotFound(w, r)
			return
		}
		var req WindowRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		asked = append(asked, req)
		w.WriteHeader(status)
	}))
	t.Cleanup(srv.Close)

	if err := ShowRunningWindow(t.Context(), srv.URL+"/"); err != nil {
		t.Fatalf("ShowRunningWindow() = %v", err)
	}
	if len(asked) != 1 || asked[0] != (WindowRequest{Window: WindowMain}) {
		t.Errorf("asked %+v, want the main window once", asked)
	}

	// A copy without a window of its own (-no-tray), or one from before 2.0
	status = http.StatusConflict
	if err := ShowRunningWindow(t.Context(), srv.URL); err == nil {
		t.Error("ShowRunningWindow() when the running copy can't show one = nil, want an error")
	}
}
