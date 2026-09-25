package ai

import (
	"net/http"
	"strings"
)

// statusOverloaded is the status Anthropic's API answers with when it is overloaded.
const statusOverloaded = 529

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
		in.statusCode == statusOverloaded ||
		in.statusCode == http.StatusBadGateway ||
		in.statusCode == http.StatusGatewayTimeout ||
		upperStatus == "UNAVAILABLE" ||
		strings.Contains(lowerRaw, "overloaded") ||
		strings.Contains(lowerRaw, "high demand") ||
		strings.Contains(lowerRaw, "server is currently overloaded") ||
		strings.Contains(lowerRaw, "temporarily unavailable") {
		msg := "The AI model is temporarily overloaded due to high demand. Please try again shortly."
		if in.provider == ProviderGemini {
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
		in.statusCode == http.StatusPaymentRequired ||
		upperStatus == "RESOURCE_EXHAUSTED" ||
		lowerCode == "insufficient_quota" ||
		lowerCode == "rate_limit_exceeded" ||
		strings.ToLower(in.statusOrType) == "insufficient_quota" ||
		strings.Contains(lowerRaw, "quota") ||
		strings.Contains(lowerRaw, "resource has been exhausted") ||
		strings.Contains(lowerRaw, "credit balance") ||
		strings.Contains(lowerRaw, "rate limit") {
		msg := "API rate limit or quota exceeded for your current account tier. Please check your billing/usage details."
		if in.provider == ProviderGemini {
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
		if in.provider == ProviderGemini {
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
		if in.provider == ProviderGemini {
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
