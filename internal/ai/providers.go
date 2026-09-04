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
	"time"
)

var (
	shortHTTPClient     = &http.Client{Timeout: 15 * time.Second}
	streamingHTTPClient = &http.Client{} // Context-controlled cancellation from request context without artificial timeouts
)

type aiErrorClassifierInput struct {
	statusCode   int
	rawMsg       string
	statusOrType string
	errCode      string
	provider     string
}

func classifyAIError(in aiErrorClassifierInput) *AIStreamError {
	lowerRaw := strings.ToLower(in.rawMsg)
	lowerCode := strings.ToLower(in.errCode)
	upperStatus := strings.ToUpper(in.statusOrType)

	// 1. Overloaded
	if in.statusCode == http.StatusServiceUnavailable ||
		in.statusCode == http.StatusBadGateway ||
		in.statusCode == http.StatusGatewayTimeout ||
		upperStatus == "UNAVAILABLE" ||
		strings.Contains(lowerRaw, "overloaded") ||
		strings.Contains(lowerRaw, "high demand") ||
		strings.Contains(lowerRaw, "server is currently overloaded") ||
		strings.Contains(lowerRaw, "temporarily unavailable") {
		msg := "The AI model is temporarily overloaded due to high demand. Please try again shortly."
		if in.provider == "gemini" {
			msg = "The AI model is temporarily overloaded due to high demand. Please try again in a few moments or switch to another model."
		}
		return &AIStreamError{
			StatusCode: in.statusCode,
			Code:       AIErrorModelOverloaded,
			Message:    msg,
			RawMessage: in.rawMsg,
			Provider:   in.provider,
		}
	}

	// 2. Quota exceeded
	if in.statusCode == http.StatusTooManyRequests ||
		upperStatus == "RESOURCE_EXHAUSTED" ||
		lowerCode == "insufficient_quota" ||
		lowerCode == "rate_limit_exceeded" ||
		strings.ToLower(in.statusOrType) == "insufficient_quota" ||
		strings.Contains(lowerRaw, "quota") ||
		strings.Contains(lowerRaw, "resource has been exhausted") ||
		strings.Contains(lowerRaw, "rate limit") {
		msg := "API rate limit or quota exceeded for your current account tier. Please check your billing/usage details."
		if in.provider == "gemini" {
			msg = "API rate limit or quota exceeded for your current tier. Please check your usage at Google AI Studio or configure a new key."
		}
		return &AIStreamError{
			StatusCode: in.statusCode,
			Code:       AIErrorQuotaExceeded,
			Message:    msg,
			RawMessage: in.rawMsg,
			Provider:   in.provider,
		}
	}

	// 3. Invalid API key
	if in.statusCode == http.StatusUnauthorized ||
		in.statusCode == http.StatusForbidden ||
		lowerCode == "invalid_api_key" ||
		(in.statusCode == http.StatusBadRequest && (strings.Contains(lowerRaw, "api_key") || strings.Contains(lowerRaw, "api key") || strings.Contains(lowerRaw, "key not valid") || strings.Contains(lowerRaw, "invalid_argument"))) ||
		strings.Contains(lowerRaw, "incorrect api key") ||
		strings.Contains(lowerRaw, "invalid api key") ||
		strings.Contains(lowerRaw, "key not valid") {
		msg := "The provided API key is invalid or expired. Please verify your API key in Settings."
		if in.provider == "gemini" {
			msg = "The provided Gemini API key is invalid or unauthorized. Please verify your API key in Settings."
		}
		return &AIStreamError{
			StatusCode: in.statusCode,
			Code:       AIErrorInvalidAPIKey,
			Message:    msg,
			RawMessage: in.rawMsg,
			Provider:   in.provider,
		}
	}

	// 4. Model not found
	if in.statusCode == http.StatusNotFound ||
		upperStatus == "NOT_FOUND" ||
		lowerCode == "model_not_found" ||
		strings.Contains(lowerRaw, "does not exist") ||
		strings.Contains(lowerRaw, "not found") {
		msg := "The selected model is not available or unsupported for your account. Please select a different model in Settings."
		if in.provider == "gemini" {
			msg = "The selected Gemini model is not available or unsupported. Try selecting an active model from Settings."
		}
		return &AIStreamError{
			StatusCode: in.statusCode,
			Code:       AIErrorModelNotFound,
			Message:    msg,
			RawMessage: in.rawMsg,
			Provider:   in.provider,
		}
	}

	return &AIStreamError{
		StatusCode: in.statusCode,
		Code:       AIErrorGeneric,
		Message:    in.rawMsg,
		RawMessage: in.rawMsg,
		Provider:   in.provider,
	}
}

// ParseGeminiError converts a non-200 Gemini API response into a structured AIStreamError.
func ParseGeminiError(statusCode int, body []byte) *AIStreamError {
	var gErr struct {
		Error struct {
			Code    int    `json:"code"`
			Message string `json:"message"`
			Status  string `json:"status"`
		} `json:"error"`
	}
	_ = json.Unmarshal(body, &gErr)

	rawMsg := gErr.Error.Message
	if rawMsg == "" {
		rawMsg = strings.TrimSpace(string(body))
	}

	return classifyAIError(aiErrorClassifierInput{
		statusCode:   statusCode,
		rawMsg:       rawMsg,
		statusOrType: gErr.Error.Status,
		provider:     "gemini",
	})
}

// ParseOpenAIError converts a non-200 OpenAI API response into a structured AIStreamError.
func ParseOpenAIError(statusCode int, body []byte, providerName string) *AIStreamError {
	if providerName == "" {
		providerName = "openai"
	}
	var oErr struct {
		Error struct {
			Message string `json:"message"`
			Type    string `json:"type"`
			Code    string `json:"code"`
		} `json:"error"`
	}
	_ = json.Unmarshal(body, &oErr)

	rawMsg := oErr.Error.Message
	if rawMsg == "" {
		rawMsg = strings.TrimSpace(string(body))
	}

	return classifyAIError(aiErrorClassifierInput{
		statusCode:   statusCode,
		rawMsg:       rawMsg,
		statusOrType: oErr.Error.Type,
		errCode:      oErr.Error.Code,
		provider:     providerName,
	})
}

// FetchGeminiModels queries Gemini API for available active generative chat models.
func FetchGeminiModels(ctx context.Context, apiKey string) ([]AIModelItem, error) {
	url := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models?key=%s", apiKey)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, http.NoBody)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	resp, err := shortHTTPClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to query Gemini models: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, err := io.ReadAll(resp.Body)
		if err != nil {
			return nil, fmt.Errorf("failed to read Gemini error response body (status %d): %w", resp.StatusCode, err)
		}
		return nil, ParseGeminiError(resp.StatusCode, body)
	}

	var geminiResp struct {
		Models []struct {
			Name                       string   `json:"name"`
			DisplayName                string   `json:"displayName"`
			Description                string   `json:"description"`
			SupportedGenerationMethods []string `json:"supportedGenerationMethods"`
		} `json:"models"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&geminiResp); err != nil {
		return nil, fmt.Errorf("failed to parse Gemini models: %w", err)
	}

	var models []AIModelItem
	for _, m := range geminiResp.Models {
		supportsContent := false
		for _, method := range m.SupportedGenerationMethods {
			if method == "generateContent" {
				supportsContent = true
				break
			}
		}
		if supportsContent {
			cleanID := strings.TrimPrefix(m.Name, "models/")
			lowerID := strings.ToLower(cleanID)

			if !strings.HasPrefix(lowerID, "gemini-") {
				continue
			}
			if strings.Contains(lowerID, "banana") ||
				strings.Contains(lowerID, "imagen") ||
				strings.Contains(lowerID, "image") ||
				strings.Contains(lowerID, "embedding") ||
				strings.Contains(lowerID, "aqa") ||
				strings.Contains(lowerID, "tts") ||
				strings.Contains(lowerID, "audio") ||
				strings.Contains(lowerID, "robotics") ||
				strings.Contains(lowerID, "vision") {
				continue
			}

			dispName := m.DisplayName
			if dispName == "" {
				dispName = cleanID
			}
			models = append(models, AIModelItem{
				ID:          cleanID,
				DisplayName: dispName,
				Description: m.Description,
			})
		}
	}
	return models, nil
}

// FetchOpenAIModels queries OpenAI or compatible endpoints for available text models.
func FetchOpenAIModels(ctx context.Context, baseURL, apiKey string) ([]AIModelItem, error) {
	if baseURL == "" {
		baseURL = "https://api.openai.com/v1"
	}
	url := strings.TrimRight(baseURL, "/") + "/models"

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodGet, url, http.NoBody)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	if apiKey != "" {
		httpReq.Header.Set("Authorization", "Bearer "+apiKey)
	}

	resp, err := shortHTTPClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("failed to query models from %s: %w", baseURL, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, err := io.ReadAll(resp.Body)
		if err != nil {
			return nil, fmt.Errorf("failed to read OpenAI error response body (status %d): %w", resp.StatusCode, err)
		}
		return nil, ParseOpenAIError(resp.StatusCode, body, "openai")
	}

	var openAIResp struct {
		Data []struct {
			ID string `json:"id"`
		} `json:"data"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&openAIResp); err != nil {
		return nil, fmt.Errorf("failed to parse models: %w", err)
	}

	var models []AIModelItem
	for _, item := range openAIResp.Data {
		lowerID := strings.ToLower(item.ID)
		if strings.Contains(lowerID, "audio") ||
			strings.Contains(lowerID, "realtime") ||
			strings.Contains(lowerID, "tts") ||
			strings.Contains(lowerID, "whisper") ||
			strings.Contains(lowerID, "dall-e") ||
			strings.Contains(lowerID, "embedding") ||
			strings.Contains(lowerID, "moderation") ||
			strings.Contains(lowerID, "davinci") ||
			strings.Contains(lowerID, "babbage") ||
			strings.Contains(lowerID, "instruct") ||
			strings.Contains(lowerID, "canary") {
			continue
		}

		if strings.HasPrefix(item.ID, "gpt-") || strings.HasPrefix(item.ID, "o1") || strings.HasPrefix(item.ID, "o3") {
			models = append(models, AIModelItem{
				ID:          item.ID,
				DisplayName: item.ID,
			})
		}
	}
	return models, nil
}

func streamSSEResponse(ctx context.Context, body io.Reader, w http.ResponseWriter, flusher http.Flusher, extractText func(payload string) string) error {
	reader := bufio.NewReader(body)
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		line, err := reader.ReadString('\n')
		if err != nil {
			if err == io.EOF {
				break
			}
			return fmt.Errorf("error reading stream: %w", err)
		}

		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "data: ") {
			dataPayload := strings.TrimPrefix(line, "data: ")
			if dataPayload == "[DONE]" {
				break
			}
			if dataPayload == "" {
				continue
			}

			text := extractText(dataPayload)
			if text != "" {
				chunkJSON, _ := json.Marshal(map[string]string{"text": text, "content": text})
				fmt.Fprintf(w, "data: %s\n\n", chunkJSON)
				flusher.Flush()
			}
		}
	}

	fmt.Fprintf(w, "data: [DONE]\n\n")
	flusher.Flush()
	return nil
}

// StreamGemini performs streaming request to Google Gemini API with SSE.
func StreamGemini(ctx context.Context, apiKey, model, systemPrompt string, messages []AIChatMessage, w http.ResponseWriter, flusher http.Flusher) error {
	modelClean := strings.TrimPrefix(strings.TrimSpace(model), "models/")
	if modelClean == "" {
		modelClean = "gemini-flash-lite-latest"
	}
	url := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models/%s:streamGenerateContent?alt=sse&key=%s", modelClean, apiKey)

	type GeminiPart struct {
		Text string `json:"text"`
	}
	type GeminiContent struct {
		Role  string       `json:"role"`
		Parts []GeminiPart `json:"parts"`
	}
	type GeminiSystemInstruction struct {
		Parts []GeminiPart `json:"parts"`
	}
	type GeminiRequest struct {
		SystemInstruction *GeminiSystemInstruction `json:"system_instruction,omitempty"`
		Contents          []GeminiContent          `json:"contents"`
		GenerationConfig  map[string]interface{}   `json:"generationConfig,omitempty"`
	}

	contents := make([]GeminiContent, 0, len(messages))
	for _, m := range messages {
		role := "user"
		if m.Role == "assistant" {
			role = "model"
		}
		contents = append(contents, GeminiContent{
			Role: role,
			Parts: []GeminiPart{
				{Text: m.Content},
			},
		})
	}

	geminiReqBody := GeminiRequest{
		SystemInstruction: &GeminiSystemInstruction{
			Parts: []GeminiPart{{Text: systemPrompt}},
		},
		Contents: contents,
		GenerationConfig: map[string]interface{}{
			"temperature": 0.35,
		},
	}

	jsonBytes, err := json.Marshal(geminiReqBody)
	if err != nil {
		return fmt.Errorf("failed to marshal Gemini request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(jsonBytes))
	if err != nil {
		return fmt.Errorf("failed to create Gemini request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := streamingHTTPClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to connect to Gemini API: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, err := io.ReadAll(resp.Body)
		if err != nil {
			return fmt.Errorf("failed to read Gemini error response body (status %d): %w", resp.StatusCode, err)
		}
		return ParseGeminiError(resp.StatusCode, body)
	}

	return streamSSEResponse(ctx, resp.Body, w, flusher, func(dataPayload string) string {
		var geminiChunk struct {
			Candidates []struct {
				Content struct {
					Parts []struct {
						Text string `json:"text"`
					} `json:"parts"`
				} `json:"content"`
			} `json:"candidates"`
		}
		if err := json.Unmarshal([]byte(dataPayload), &geminiChunk); err == nil {
			if len(geminiChunk.Candidates) > 0 && len(geminiChunk.Candidates[0].Content.Parts) > 0 {
				return geminiChunk.Candidates[0].Content.Parts[0].Text
			}
		}
		return ""
	})
}

// StreamOpenAI performs streaming request to OpenAI or compatible API.
func StreamOpenAI(ctx context.Context, baseURL, apiKey, model, systemPrompt string, messages []AIChatMessage, w http.ResponseWriter, flusher http.Flusher) error {
	endpoint := strings.TrimRight(baseURL, "/") + "/chat/completions"

	type OpenAIMessage struct {
		Role    string `json:"role"`
		Content string `json:"content"`
	}

	isReasoningModel := strings.HasPrefix(model, "o1") || strings.HasPrefix(model, "o3")
	systemRole := "system"
	if isReasoningModel {
		systemRole = "developer"
	}

	openAIMessages := make([]OpenAIMessage, 0, 1+len(messages))
	openAIMessages = append(openAIMessages, OpenAIMessage{
		Role:    systemRole,
		Content: systemPrompt,
	})
	for _, m := range messages {
		role := m.Role
		if role == "" {
			role = "user"
		}
		openAIMessages = append(openAIMessages, OpenAIMessage{
			Role:    role,
			Content: m.Content,
		})
	}

	reqMap := map[string]interface{}{
		"model":    model,
		"messages": openAIMessages,
		"stream":   true,
	}
	if !isReasoningModel {
		reqMap["temperature"] = 0.4
	}

	jsonBytes, err := json.Marshal(reqMap)
	if err != nil {
		return fmt.Errorf("failed to marshal OpenAI request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(jsonBytes))
	if err != nil {
		return fmt.Errorf("failed to create OpenAI request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	if apiKey != "" {
		req.Header.Set("Authorization", "Bearer "+apiKey)
	}

	resp, err := streamingHTTPClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to connect to OpenAI API: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, err := io.ReadAll(resp.Body)
		if err != nil {
			return fmt.Errorf("failed to read OpenAI error response body (status %d): %w", resp.StatusCode, err)
		}
		return ParseOpenAIError(resp.StatusCode, body, "openai")
	}

	return streamSSEResponse(ctx, resp.Body, w, flusher, func(dataPayload string) string {
		var chunk struct {
			Choices []struct {
				Delta struct {
					Content string `json:"content"`
				} `json:"delta"`
			} `json:"choices"`
		}
		if err := json.Unmarshal([]byte(dataPayload), &chunk); err == nil {
			if len(chunk.Choices) > 0 {
				return chunk.Choices[0].Delta.Content
			}
		}
		return ""
	})
}
