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
	defaultModel := "gemini-1.5-flash"

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

	resp := AIConfigStatusResponse{
		HasGeminiEnvKey: geminiKey != "",
		HasOpenAIEnvKey: openaiKey != "",
		DefaultProvider: defaultProvider,
		DefaultModel:    defaultModel,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

// handleAIFetchModels queries the provider's API directly to get live available models for the given API key.
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
			model = "gemini-1.5-flash"
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

	sb.WriteString("Eres el Ingeniero de Pista de F1 (Race Engineer) personal y analista de telemetría exclusivo del PILOTO DE LA VUELTA A (el primer piloto seleccionado).\n")
	sb.WriteString("Tu función es hablarle directamente a tu piloto (Vuelta A) por la radio del equipo para analizar su rendimiento, diagnosticar sus pérdidas/ganancias de tiempo y darle recomendaciones de pilotaje claras y técnicas para batir a la Vuelta B (vuelta de comparación/rival).\n\n")

	sb.WriteString("REGLAS FUNDAMENTALES DE ENFOQUE Y ASIGNACIÓN:\n")
	sb.WriteString("1. DIRÍGETE SIEMPRE EN SEGUNDA PERSONA A TU PILOTO (VUELTA A): Usa 'tú', 'tu tiempo', 'estás frenando', 'tu tracción', refiriéndote siempre al piloto de la Vuelta A.\n")
	sb.WriteString("2. LA VUELTA B ES SIEMPRE LA REFERENCIA / RIVAL: Refiérete a la Vuelta B como 'el rival', 'Vuelta B' o por el nombre del piloto B. NUNCA le des consejos de mejora al piloto de la Vuelta B ni asumas el rol de su ingeniero.\n")
	sb.WriteString("3. SI TU PILOTO (VUELTA A) ES MÁS LENTO: Explícale exactamente dónde pierde tiempo (ej. 'Frenas 15m antes que Vuelta B en la curva 1', 'Pierdes 0.15s en la tracción de la horquilla') y dale la instrucción precisa para recortar esa diferencia.\n")
	sb.WriteString("4. SI TU PILOTO (VUELTA A) ES MÁS RÁPIDO: Felicítalo por la vuelta, destaca dónde sacó la ventaja a la Vuelta B, y si existe alguna curva puntual donde Vuelta B fue mejor, indícaselo como oportunidad para ganar aún más tiempo.\n")
	sb.WriteString("5. COMUNICACIÓN Y FORMATO: Comunícate en español con tono profesional, directo y conciso de radio de F1. Usa Markdown estructurado (negritas, listas cortas).\n")
	sb.WriteString("6. NO INVENTES NI MENCIONES SETUPS DEL COCHE: Los setups de otros pilotos no están disponibles. Concéntrate 100% en la técnica de conducción, puntos de frenada, velocidad de ápice en curva, tracción y uso de ERS/DRS.\n\n")

	if telemetryCtx != nil {
		sb.WriteString("### DATOS DE TELEMETRÍA DE LA COMPARATIVA:\n")
		sb.WriteString(fmt.Sprintf("- Circuito: %s | Sesión: %s\n", telemetryCtx.TrackName, telemetryCtx.SessionType))
		sb.WriteString(fmt.Sprintf("- TU PILOTO (Vuelta A): %s (%s) - Neumático: %s\n", telemetryCtx.LapAName, telemetryCtx.LapATimeFormatted, telemetryCtx.LapACompound))
		sb.WriteString(fmt.Sprintf("- RIVAL / REFERENCIA (Vuelta B): %s (%s) - Neumático: %s\n", telemetryCtx.LapBName, telemetryCtx.LapBTimeFormatted, telemetryCtx.LapBCompound))
		sb.WriteString(fmt.Sprintf("- Delta Total: %.3f s (Más rápida: %s)\n", telemetryCtx.TimeDeltaSeconds, telemetryCtx.FasterLap))

		sb.WriteString("- Sectores:\n")
		sb.WriteString(fmt.Sprintf("  * Sector 1: Tu tiempo (%s) vs Rival (%s)\n", telemetryCtx.LapAS1Formatted, telemetryCtx.LapBS1Formatted))
		sb.WriteString(fmt.Sprintf("  * Sector 2: Tu tiempo (%s) vs Rival (%s)\n", telemetryCtx.LapAS2Formatted, telemetryCtx.LapBS2Formatted))
		sb.WriteString(fmt.Sprintf("  * Sector 3: Tu tiempo (%s) vs Rival (%s)\n", telemetryCtx.LapAS3Formatted, telemetryCtx.LapBS3Formatted))

		sb.WriteString(fmt.Sprintf("- Velocidad Máxima: Tu velocidad = %.1f km/h | Rival = %.1f km/h\n", telemetryCtx.TopSpeedA, telemetryCtx.TopSpeedB))
		sb.WriteString(fmt.Sprintf("- Despliegue ERS acumulado: Tu uso = %.1f%% | Rival = %.1f%%\n", telemetryCtx.ERSAUsedPercent, telemetryCtx.ERSBUsedPercent))

		if telemetryCtx.BrakingSummary != "" {
			sb.WriteString(fmt.Sprintf("- Análisis de Frenada: %s\n", telemetryCtx.BrakingSummary))
		}
		if telemetryCtx.ApexSpeedSummary != "" {
			sb.WriteString(fmt.Sprintf("- Velocidad en Curvas / Ápice: %s\n", telemetryCtx.ApexSpeedSummary))
		}
		if telemetryCtx.ThrottleSummary != "" {
			sb.WriteString(fmt.Sprintf("- Tracción y Aceleración: %s\n", telemetryCtx.ThrottleSummary))
		}
		if telemetryCtx.ERSDRSSummary != "" {
			sb.WriteString(fmt.Sprintf("- ERS y DRS: %s\n", telemetryCtx.ERSDRSSummary))
		}

		if telemetryCtx.ZoomedRange != nil {
			zr := telemetryCtx.ZoomedRange
			sb.WriteString(fmt.Sprintf("\n### TRAMO EN ZOOM SELECCIONADO POR EL PILOTO (%.0fm - %.0fm):\n", zr.StartDistanceMeters, zr.EndDistanceMeters))
			if zr.Description != "" {
				sb.WriteString(fmt.Sprintf("- Descripción: %s\n", zr.Description))
			}
			sb.WriteString(fmt.Sprintf("- Delta en este tramo: %.3fs\n", zr.DeltaInSegment))
			sb.WriteString(fmt.Sprintf("- Diferencia de velocidad mínima en curva: %.1f km/h\n", zr.SpeedDiffAtApex))
			sb.WriteString(fmt.Sprintf("- Diferencia en punto de frenada: %.1f metros\n", zr.BrakingDiffMeters))
		}
	} else {
		sb.WriteString("Actualmente no hay dos vueltas seleccionadas en el comparador. Si el usuario pregunta, indícale amablemente que seleccione una Vuelta A y una Vuelta B para poder analizar su telemetría.\n")
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
