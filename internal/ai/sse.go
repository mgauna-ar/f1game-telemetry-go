package ai

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
)

const (
	sseDataPrefix  = "data: "
	sseDoneMessage = "[DONE]"
)

// sseWriter writes the chat stream the frontend reads: text chunks, then a final [DONE].
type sseWriter struct {
	w       http.ResponseWriter
	flusher http.Flusher
}

func (s sseWriter) text(text string) {
	if text == "" {
		return
	}
	chunkJSON, _ := json.Marshal(map[string]string{"text": text, "content": text})
	fmt.Fprintf(s.w, "%s%s\n\n", sseDataPrefix, chunkJSON)
	s.flusher.Flush()
}

func (s sseWriter) done() {
	fmt.Fprintf(s.w, "%s%s\n\n", sseDataPrefix, sseDoneMessage)
	s.flusher.Flush()
}

// readSSEData calls onData with the payload of every "data:" line of an upstream SSE stream,
// until the stream ends or sends [DONE].
func readSSEData(ctx context.Context, body io.Reader, onData func(payload string)) error {
	reader := bufio.NewReader(body)
	for {
		if err := ctx.Err(); err != nil {
			return err
		}

		line, err := reader.ReadString('\n')
		if trimmed := strings.TrimSpace(line); strings.HasPrefix(trimmed, sseDataPrefix) {
			payload := strings.TrimPrefix(trimmed, sseDataPrefix)
			if payload == sseDoneMessage {
				return nil
			}
			if payload != "" {
				onData(payload)
			}
		}
		if err == io.EOF {
			return nil
		}
		if err != nil {
			return fmt.Errorf("error reading stream: %w", err)
		}
	}
}

// postStream sends a JSON request to the named API and returns the streaming response.
// A non-200 answer is read and converted to an error with parseError.
func postStream(ctx context.Context, apiName, url string, headers map[string]string, payload any, parseError func(status int, body []byte) error) (*http.Response, error) {
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
