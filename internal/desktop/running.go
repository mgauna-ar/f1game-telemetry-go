package desktop

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"
)

const (
	// windowEndpoint is the running copy's POST /api/desktop/window.
	windowEndpoint = "/api/desktop/window"
	// showRunningTimeout bounds asking the running copy to show its window.
	showRunningTimeout = 2 * time.Second
)

// ShowRunningWindow asks the copy of the app answering at baseURL (e.g. "http://localhost:8080")
// to bring its window up: starting the app again on Windows shows the one already running.
func ShowRunningWindow(ctx context.Context, baseURL string) error {
	body, err := json.Marshal(WindowRequest{Window: WindowMain})
	if err != nil {
		return err
	}
	ctx, cancel := context.WithTimeout(ctx, showRunningTimeout)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, strings.TrimSuffix(baseURL, "/")+windowEndpoint, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")

	// Windows lets only the app in front bring a window to the front: this launch is, so it hands
	// that on to the running copy.
	allowSetForeground()
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusAccepted {
		return fmt.Errorf("it answered %s", resp.Status)
	}
	return nil
}
