package api

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"time"
)

// AIChatMessage represents a message in the conversation.
type AIChatMessage struct {
	Role    string `json:"role"` // "user", "assistant", or "system"
	Content string `json:"content"`
}

// TelemetryAnalysisContext represents the driving telemetry context sent to the AI.
type TelemetryAnalysisContext struct {
	TrackName         string  `json:"track_name"`
	SessionType       string  `json:"session_type"`
	LapAName          string  `json:"lap_a_name"`
	LapBName          string  `json:"lap_b_name"`
	LapATimeFormatted string  `json:"lap_a_time_formatted"`
	LapBTimeFormatted string  `json:"lap_b_time_formatted"`
	TimeDeltaSeconds  float64 `json:"time_delta_seconds"` // Negative if A is faster, positive if B is faster
	FasterLap         string  `json:"faster_lap"`         // "Lap A" or "Lap B"

	LapACompound string `json:"lap_a_compound"`
	LapBCompound string `json:"lap_b_compound"`

	LapAS1Formatted string `json:"lap_a_s1_formatted"`
	LapBS1Formatted string `json:"lap_b_s1_formatted"`
	LapAS2Formatted string `json:"lap_a_s2_formatted"`
	LapBS2Formatted string `json:"lap_b_s2_formatted"`
	LapAS3Formatted string `json:"lap_a_s3_formatted"`
	LapBS3Formatted string `json:"lap_b_s3_formatted"`

	TopSpeedA float64 `json:"top_speed_a"`
	TopSpeedB float64 `json:"top_speed_b"`

	ERSAUsedPercent float64 `json:"ers_a_used_percent"`
	ERSBUsedPercent float64 `json:"ers_b_used_percent"`

	// Specific telemetry summary insights
	BrakingSummary   string `json:"braking_summary,omitempty"`
	ApexSpeedSummary string `json:"apex_speed_summary,omitempty"`
	ThrottleSummary  string `json:"throttle_summary,omitempty"`
	ERSDRSSummary    string `json:"ers_drs_summary,omitempty"`

	// Zoomed section info if user is zoomed in
	ZoomedRange *ZoomedRangeInfo `json:"zoomed_range,omitempty"`
}

// ZoomedRangeInfo holds details of a specific track segment currently focused in the UI.
type ZoomedRangeInfo struct {
	StartDistanceMeters float64 `json:"start_distance_meters"`
	EndDistanceMeters   float64 `json:"end_distance_meters"`
	Description         string  `json:"description,omitempty"`
	DeltaInSegment      float64 `json:"delta_in_segment"`
	SpeedDiffAtApex     float64 `json:"speed_diff_at_apex"`
	BrakingDiffMeters   float64 `json:"braking_diff_meters"`
}

// AIChatRequest represents the incoming chat request from the frontend.
type AIChatRequest struct {
	Provider string                    `json:"provider"` // "gemini", "openai", or "custom"
	APIKey   string                    `json:"api_key,omitempty"`
	BaseURL  string                    `json:"base_url,omitempty"`
	Model    string                    `json:"model,omitempty"`
	Messages []AIChatMessage           `json:"messages"`
	Context  *TelemetryAnalysisContext `json:"context,omitempty"`
}

// AIConfigStatusResponse informs the frontend about backend default configuration.
type AIConfigStatusResponse struct {
	HasGeminiEnvKey bool   `json:"has_gemini_env_key"`
	HasOpenAIEnvKey bool   `json:"has_openai_env_key"`
	DefaultProvider string `json:"default_provider"`
	DefaultModel    string `json:"default_model"`
}

// AIFetchModelsRequest represents a request to query available models from a provider.
type AIFetchModelsRequest struct {
	Provider string `json:"provider"`
	APIKey   string `json:"api_key,omitempty"`
	BaseURL  string `json:"base_url,omitempty"`
}

// AIModelItem represents a model in the returned list.
type AIModelItem struct {
	ID          string `json:"id"`
	DisplayName string `json:"display_name"`
	Description string `json:"description,omitempty"`
}

// AIFetchModelsResponse is the list of available models.
type AIFetchModelsResponse struct {
	Models []AIModelItem `json:"models"`
}

// handleAIConfigStatus returns the status of server-configured AI keys.
func (s *Server) handleAIConfigStatus(w http.ResponseWriter, r *http.Request) {
	geminiKey := strings.TrimSpace(os.Getenv("GEMINI_API_KEY"))
	openaiKey := strings.TrimSpace(os.Getenv("OPENAI_API_KEY"))

	defaultProvider := "gemini"
	defaultModel := "gemini-flash-lite-latest"

	if geminiKey == "" && openaiKey != "" {
		defaultProvider = "openai"
		defaultModel = "gpt-4o-mini"
	}

	if envModel := os.Getenv("LLM_MODEL"); envModel != "" {
		defaultModel = envModel
	}
	if envProvider := os.Getenv("LLM_PROVIDER"); envProvider != "" {
		defaultProvider = envProvider
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(AIConfigStatusResponse{
		HasGeminiEnvKey: geminiKey != "",
		HasOpenAIEnvKey: openaiKey != "",
		DefaultProvider: defaultProvider,
		DefaultModel:    defaultModel,
	})
}

// handleAIFetchModels queries the provider API for available active text-generation models.
func (s *Server) handleAIFetchModels(w http.ResponseWriter, r *http.Request) {
	var req AIFetchModelsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, fmt.Sprintf("Invalid payload: %v", err), http.StatusBadRequest)
		return
	}

	provider := strings.ToLower(strings.TrimSpace(req.Provider))
	if provider == "" {
		provider = "gemini"
	}

	apiKey := strings.TrimSpace(req.APIKey)
	if apiKey == "" {
		if provider == "gemini" {
			apiKey = strings.TrimSpace(os.Getenv("GEMINI_API_KEY"))
		} else {
			apiKey = strings.TrimSpace(os.Getenv("OPENAI_API_KEY"))
		}
	}

	if apiKey == "" && provider != "custom" {
		http.Error(w, fmt.Sprintf("No API Key configured for %s", provider), http.StatusUnauthorized)
		return
	}

	client := &http.Client{Timeout: 15 * time.Second}
	var models []AIModelItem

	if provider == "gemini" {
		url := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models?key=%s", apiKey)
		resp, err := client.Get(url)
		if err != nil {
			http.Error(w, fmt.Sprintf("Failed to query Gemini models: %v", err), http.StatusInternalServerError)
			return
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			body, _ := io.ReadAll(resp.Body)
			http.Error(w, fmt.Sprintf("Gemini API error (status %d): %s", resp.StatusCode, string(body)), resp.StatusCode)
			return
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
			http.Error(w, fmt.Sprintf("Failed to parse Gemini models: %v", err), http.StatusInternalServerError)
			return
		}

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

				// Strict filtering: must be a gemini text/chat model and NOT an image/banana/embedding/toy model
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
	} else {
		baseURL := req.BaseURL
		if baseURL == "" {
			baseURL = "https://api.openai.com/v1"
		}
		url := strings.TrimRight(baseURL, "/") + "/models"
		httpReq, err := http.NewRequestWithContext(r.Context(), http.MethodGet, url, nil)
		if err != nil {
			http.Error(w, fmt.Sprintf("Failed to create request: %v", err), http.StatusInternalServerError)
			return
		}
		if apiKey != "" {
			httpReq.Header.Set("Authorization", "Bearer "+apiKey)
		}

		resp, err := client.Do(httpReq)
		if err != nil {
			http.Error(w, fmt.Sprintf("Failed to query models from %s: %v", baseURL, err), http.StatusInternalServerError)
			return
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			body, _ := io.ReadAll(resp.Body)
			http.Error(w, fmt.Sprintf("API error (status %d): %s", resp.StatusCode, string(body)), resp.StatusCode)
			return
		}

		var openAIResp struct {
			Data []struct {
				ID string `json:"id"`
			} `json:"data"`
		}

		if err := json.NewDecoder(resp.Body).Decode(&openAIResp); err != nil {
			http.Error(w, fmt.Sprintf("Failed to parse models: %v", err), http.StatusInternalServerError)
			return
		}

		for _, item := range openAIResp.Data {
			lowerID := strings.ToLower(item.ID)
			if strings.Contains(lowerID, "audio") ||
				strings.Contains(lowerID, "realtime") ||
				strings.Contains(lowerID, "tts") ||
				strings.Contains(lowerID, "whisper") ||
				strings.Contains(lowerID, "dall-e") ||
				strings.Contains(lowerID, "embedding") ||
				strings.Contains(lowerID, "moderation") {
				continue
			}

			if strings.HasPrefix(item.ID, "gpt-") || strings.HasPrefix(item.ID, "o1") || strings.HasPrefix(item.ID, "o3") || provider == "custom" {
				models = append(models, AIModelItem{
					ID:          item.ID,
					DisplayName: item.ID,
				})
			}
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(AIFetchModelsResponse{Models: models})
}

// handleAIChat handles streaming LLM chat requests for Lap Comparator telemetry analysis.
func (s *Server) handleAIChat(w http.ResponseWriter, r *http.Request) {
	var req AIChatRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, fmt.Sprintf("Invalid request payload: %v", err), http.StatusBadRequest)
		return
	}

	// Resolve Provider and API Key
	provider := strings.ToLower(strings.TrimSpace(req.Provider))
	if provider == "" {
		provider = "gemini"
	}

	apiKey := strings.TrimSpace(req.APIKey)
	if apiKey == "" {
		if provider == "gemini" {
			apiKey = strings.TrimSpace(os.Getenv("GEMINI_API_KEY"))
		} else {
			apiKey = strings.TrimSpace(os.Getenv("OPENAI_API_KEY"))
		}
	}

	if apiKey == "" && provider != "custom" {
		http.Error(w, fmt.Sprintf("No API Key provided for %s. Please configure it in settings or set the environment variable.", provider), http.StatusUnauthorized)
		return
	}

	// Model fallback defaults
	model := strings.TrimSpace(req.Model)
	if model == "" {
		if provider == "gemini" {
			model = "gemini-flash-lite-latest"
		} else {
			model = "gpt-4o-mini"
		}
	}

	// Setup SSE streaming headers
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "Streaming unsupported", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	systemPrompt := buildSystemPrompt(req.Context)

	var streamErr error
	if provider == "gemini" {
		streamErr = streamGemini(r.Context(), apiKey, model, systemPrompt, req.Messages, w, flusher)
	} else {
		// OpenAI or OpenAI-compatible custom endpoint
		baseURL := req.BaseURL
		if baseURL == "" {
			baseURL = "https://api.openai.com/v1"
		}
		streamErr = streamOpenAI(r.Context(), baseURL, apiKey, model, systemPrompt, req.Messages, w, flusher)
	}

	if streamErr != nil {
		log.Printf("[AI Chat] Error during streaming: %v", streamErr)
		// Send error event over SSE
		errPayload, _ := json.Marshal(map[string]string{"error": streamErr.Error()})
		fmt.Fprintf(w, "event: error\ndata: %s\n\n", string(errPayload))
		flusher.Flush()
	}
}

// buildSystemPrompt constructs a rich system prompt tailored for an elite F1 Race Engineer.
func buildSystemPrompt(telemetryCtx *TelemetryAnalysisContext) string {
	var sb strings.Builder

	sb.WriteString("You are the personal F1 Race Engineer and exclusive telemetry analyst for the DRIVER OF LAP A (the primary selected driver).\n")
	sb.WriteString("Your role is to speak directly to your driver (Lap A) over the team radio to analyze their performance, diagnose where lap time was gained or lost, and provide clear, highly technical coaching advice to beat Lap B (the comparison / benchmark lap).\n\n")

	sb.WriteString("CORE COACHING & ROLE RULES:\n")
	sb.WriteString("1. ALWAYS ADDRESS YOUR DRIVER (LAP A) IN THE SECOND PERSON: Use 'you', 'your lap', 'you are braking', 'your traction', always referring to the driver of Lap A.\n")
	sb.WriteString("2. LAP B IS STRICTLY THE BENCHMARK / RIVAL: Refer to Lap B as 'the benchmark', 'Lap B', or by driver B's name. NEVER give improvement advice to driver B or act as their engineer.\n")
	sb.WriteString("3. IF YOUR DRIVER (LAP A) IS SLOWER: Explain specifically where they are losing time (e.g. 'You are braking 15m too early compared to Lap B into Turn 1', 'You lose 0.15s on traction out of the hairpin') and give actionable instructions to recover that delta.\n")
	sb.WriteString("4. IF YOUR DRIVER (LAP A) IS FASTER: Congratulate them on the lap, highlight where they built the advantage over Lap B, and if there are any specific corners where Lap B was stronger, mention them as opportunities to gain even more time.\n")
	sb.WriteString("5. COMMUNICATION STYLE & LANGUAGE: Communicate strictly in English with a professional, sharp, direct F1 team radio tone. Use structured Markdown (bold keywords, bullet points).\n")
	sb.WriteString("6. DO NOT MENTION CAR SETUPS: Setups of other cars are unavailable. Focus 100% on driving technique, braking points, minimum corner apex speed, exit traction, and ERS/DRS deployment.\n\n")

	if telemetryCtx != nil {
		sb.WriteString("### COMPARATIVE TELEMETRY DATA:\n")
		sb.WriteString(fmt.Sprintf("- Track: %s | Session: %s\n", telemetryCtx.TrackName, telemetryCtx.SessionType))
		sb.WriteString(fmt.Sprintf("- YOUR DRIVER (Lap A): %s (%s) - Compound: %s\n", telemetryCtx.LapAName, telemetryCtx.LapATimeFormatted, telemetryCtx.LapACompound))
		sb.WriteString(fmt.Sprintf("- BENCHMARK / RIVAL (Lap B): %s (%s) - Compound: %s\n", telemetryCtx.LapBName, telemetryCtx.LapBTimeFormatted, telemetryCtx.LapBCompound))
		sb.WriteString(fmt.Sprintf("- Total Time Delta: %.3f s (Faster: %s)\n", telemetryCtx.TimeDeltaSeconds, telemetryCtx.FasterLap))

		sb.WriteString("- Sector Times:\n")
		sb.WriteString(fmt.Sprintf("  * Sector 1: Your time (%s) vs Benchmark (%s)\n", telemetryCtx.LapAS1Formatted, telemetryCtx.LapBS1Formatted))
		sb.WriteString(fmt.Sprintf("  * Sector 2: Your time (%s) vs Benchmark (%s)\n", telemetryCtx.LapAS2Formatted, telemetryCtx.LapBS2Formatted))
		sb.WriteString(fmt.Sprintf("  * Sector 3: Your time (%s) vs Benchmark (%s)\n", telemetryCtx.LapAS3Formatted, telemetryCtx.LapBS3Formatted))

		sb.WriteString(fmt.Sprintf("- Top Speed (Speed Trap): Your speed = %.1f km/h | Benchmark = %.1f km/h\n", telemetryCtx.TopSpeedA, telemetryCtx.TopSpeedB))
		sb.WriteString(fmt.Sprintf("- Cumulative ERS Deployment: Your usage = %.1f%% | Benchmark = %.1f%%\n", telemetryCtx.ERSAUsedPercent, telemetryCtx.ERSBUsedPercent))

		if telemetryCtx.BrakingSummary != "" {
			sb.WriteString(fmt.Sprintf("- Braking Analysis: %s\n", telemetryCtx.BrakingSummary))
		}
		if telemetryCtx.ApexSpeedSummary != "" {
			sb.WriteString(fmt.Sprintf("- Corner Apex Speed: %s\n", telemetryCtx.ApexSpeedSummary))
		}
		if telemetryCtx.ThrottleSummary != "" {
			sb.WriteString(fmt.Sprintf("- Traction & Acceleration: %s\n", telemetryCtx.ThrottleSummary))
		}
		if telemetryCtx.ERSDRSSummary != "" {
			sb.WriteString(fmt.Sprintf("- ERS & DRS: %s\n", telemetryCtx.ERSDRSSummary))
		}

		if telemetryCtx.ZoomedRange != nil {
			zr := telemetryCtx.ZoomedRange
			sb.WriteString(fmt.Sprintf("\n### ZOOMED SECTOR FOCUSED BY DRIVER (%.0fm - %.0fm):\n", zr.StartDistanceMeters, zr.EndDistanceMeters))
			if zr.Description != "" {
				sb.WriteString(fmt.Sprintf("- Description: %s\n", zr.Description))
			}
			sb.WriteString(fmt.Sprintf("- Delta in this segment: %.3fs\n", zr.DeltaInSegment))
			sb.WriteString(fmt.Sprintf("- Apex speed delta in corner: %.1f km/h\n", zr.SpeedDiffAtApex))
			sb.WriteString(fmt.Sprintf("- Braking point difference: %.1f meters\n", zr.BrakingDiffMeters))
		}
	} else {
		sb.WriteString("Currently, two laps are not selected in the comparator. If the user asks, kindly remind them to select Lap A and Lap B to analyze telemetry.\n")
	}

	return sb.String()
}

// streamGemini performs streaming request to Google Gemini API with SSE.
func streamGemini(ctx context.Context, apiKey, model, systemPrompt string, messages []AIChatMessage, w http.ResponseWriter, flusher http.Flusher) error {
	modelClean := strings.TrimPrefix(strings.TrimSpace(model), "models/")
	if modelClean == "" {
		modelClean = "gemini-2.5-flash"
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

	var contents []GeminiContent
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
			"temperature": 0.4,
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

	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to connect to Gemini API: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("Gemini API error (status %d): %s", resp.StatusCode, string(body))
	}

	reader := bufio.NewReader(resp.Body)
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
			return fmt.Errorf("error reading Gemini stream: %w", err)
		}

		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "data: ") {
			dataPayload := strings.TrimPrefix(line, "data: ")
			if dataPayload == "" {
				continue
			}

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
					text := geminiChunk.Candidates[0].Content.Parts[0].Text
					if text != "" {
						chunkJson, _ := json.Marshal(map[string]string{"text": text})
						fmt.Fprintf(w, "data: %s\n\n", chunkJson)
						flusher.Flush()
					}
				}
			}
		}
	}

	fmt.Fprintf(w, "data: [DONE]\n\n")
	flusher.Flush()
	return nil
}

// streamOpenAI performs streaming request to OpenAI or compatible API.
func streamOpenAI(ctx context.Context, baseURL, apiKey, model, systemPrompt string, messages []AIChatMessage, w http.ResponseWriter, flusher http.Flusher) error {
	endpoint := strings.TrimRight(baseURL, "/") + "/chat/completions"

	type OpenAIMessage struct {
		Role    string `json:"role"`
		Content string `json:"content"`
	}
	type OpenAIRequest struct {
		Model       string          `json:"model"`
		Messages    []OpenAIMessage `json:"messages"`
		Stream      bool            `json:"stream"`
		Temperature float64         `json:"temperature"`
	}

	openAIMessages := []OpenAIMessage{
		{Role: "system", Content: systemPrompt},
	}
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

	reqBody := OpenAIRequest{
		Model:       model,
		Messages:    openAIMessages,
		Stream:      true,
		Temperature: 0.4,
	}

	jsonBytes, err := json.Marshal(reqBody)
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

	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to connect to OpenAI API: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("OpenAI API error (status %d): %s", resp.StatusCode, string(body))
	}

	reader := bufio.NewReader(resp.Body)
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
			return fmt.Errorf("error reading OpenAI stream: %w", err)
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

			var chunk struct {
				Choices []struct {
					Delta struct {
						Content string `json:"content"`
					} `json:"delta"`
				} `json:"choices"`
			}

			if err := json.Unmarshal([]byte(dataPayload), &chunk); err == nil {
				if len(chunk.Choices) > 0 {
					text := chunk.Choices[0].Delta.Content
					if text != "" {
						chunkJson, _ := json.Marshal(map[string]string{"text": text})
						fmt.Fprintf(w, "data: %s\n\n", chunkJson)
						flusher.Flush()
					}
				}
			}
		}
	}

	fmt.Fprintf(w, "data: [DONE]\n\n")
	flusher.Flush()
	return nil
}
