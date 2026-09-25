package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

var (
	shortHTTPClient     = &http.Client{Timeout: 15 * time.Second}
	streamingHTTPClient = &http.Client{} // Context-controlled cancellation from request context without artificial timeouts
)

// errorParser converts a provider's non-200 answer into an error.
type errorParser func(status int, body []byte) error

// postStream sends a JSON request to the named API and returns the streaming response.
// A non-200 answer is read and converted to an error with parseError.
func postStream(ctx context.Context, apiName, url string, headers map[string]string, payload any, parseError errorParser) (*http.Response, error) {
	jsonBytes, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal %s request: %w", apiName, err)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(jsonBytes))
	if err != nil {
		return nil, fmt.Errorf("failed to create %s request: %w", apiName, err)
	}
	req.Header.Set("Content-Type", "application/json")
	for k, v := range headers {
		req.Header.Set(k, v)
	}

	resp, err := streamingHTTPClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to %s API: %w", apiName, err)
	}
	if resp.StatusCode != http.StatusOK {
		defer resp.Body.Close()
		body, err := io.ReadAll(resp.Body)
		if err != nil {
			return nil, fmt.Errorf("failed to read %s error response body (status %d): %w", apiName, resp.StatusCode, err)
		}
		return nil, parseError(resp.StatusCode, body)
	}
	return resp, nil
}

// getJSON sends a GET request to the named API and decodes the JSON answer into out.
// A non-200 answer is read and converted to an error with parseError.
func getJSON(ctx context.Context, apiName, url string, headers map[string]string, out any, parseError errorParser) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, http.NoBody)
	if err != nil {
		return fmt.Errorf("failed to create %s request: %w", apiName, err)
	}
	for k, v := range headers {
		req.Header.Set(k, v)
	}

	resp, err := shortHTTPClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to query %s API: %w", apiName, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, err := io.ReadAll(resp.Body)
		if err != nil {
			return fmt.Errorf("failed to read %s error response body (status %d): %w", apiName, resp.StatusCode, err)
		}
		return parseError(resp.StatusCode, body)
	}
	if err := json.NewDecoder(resp.Body).Decode(out); err != nil {
		return fmt.Errorf("failed to parse %s response: %w", apiName, err)
	}
	return nil
}
