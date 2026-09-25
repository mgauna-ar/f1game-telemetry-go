package ai

import (
	"bufio"
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
