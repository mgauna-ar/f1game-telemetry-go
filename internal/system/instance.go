package system

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"time"
)

// instanceProbeTimeout bounds the request asking whether the app already answers on a port.
const instanceProbeTimeout = time.Second

// FindRunningInstance asks baseURL (e.g. "http://localhost:8080") for its version and reports
// whether this app is the one answering, so a second launch can open the running copy instead
// of failing because the port is taken.
func FindRunningInstance(ctx context.Context, baseURL string) (AppVersion, bool) {
	ctx, cancel := context.WithTimeout(ctx, instanceProbeTimeout)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, strings.TrimSuffix(baseURL, "/")+"/api/system/version", http.NoBody)
	if err != nil {
		return AppVersion{}, false
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return AppVersion{}, false
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return AppVersion{}, false
	}
	var ver AppVersion
	if err := json.NewDecoder(resp.Body).Decode(&ver); err != nil || ver.Version == "" {
		return AppVersion{}, false
	}
	return ver, true
}
