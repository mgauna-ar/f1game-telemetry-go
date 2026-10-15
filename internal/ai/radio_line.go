package ai

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"
	"unicode"

	"github.com/mgauna/f1game-telemetry-go/internal/locales"
)

const (
	// RadioLineTimeout is how long the AI may take to word a radio call. The dashboard says the
	// catalogue line after RADIO_LINE.CLIENT_DEADLINE_MS, a little later.
	RadioLineTimeout = 2200 * time.Millisecond
	// RadioLineCacheTTL is how long a worded line is kept for the other dashboards asking for it.
	RadioLineCacheTTL = 30 * time.Second
	// RadioLineMaxTokens caps a worded line; it is a sentence or two.
	RadioLineMaxTokens = 200
	// RadioLineMaxWords and RadioLineMaxSentences are the longest line accepted, unless the
	// catalogue line it rewords is longer (a gap report).
	RadioLineMaxWords     = 24
	RadioLineMaxSentences = 2
	// radioLineExtraWords is how many words longer than the catalogue line a line may be.
	radioLineExtraWords = 8
)

// radioLineStyle words a call fast and differently each time.
var radioLineStyle = chatStyle{quick: true, maxTokens: RadioLineMaxTokens, varied: true}

// RadioLineRequest asks for a routine radio call in fresh words (POST /api/ai/radio-line).
type RadioLineRequest struct {
	// DirectiveID is the call, as /ws/engineer sent it.
	DirectiveID string `json:"directive_id"`
	// Language and Persona are the listener's: the line is said in them.
	Language string `json:"language"`
	Persona  string `json:"persona"`
	// Baseline is the call in the dashboard's catalogue words, without the callsign: the facts the
	// line must keep, and what is said when no line comes.
	Baseline string `json:"baseline"`
}

// RadioLineResponse is the worded line, without the callsign.
type RadioLineResponse struct {
	Text string `json:"text"`
}

// RadioCallFacts is what a call says, for the AI to word it.
type RadioCallFacts struct {
	// Key is the call's alert key.
	Key string
	// Message is the engine's own English wording of the call.
	Message string
	// Values are the call's numbers and the wheel, axle or tyre it is about, as text.
	Values string
	// Situation is where the race stands: lap, position, tyres, weather.
	Situation string
	// Recent are the last lines said for this call, oldest first.
	Recent []string
}

// RadioCallSource looks up the calls the race engineer made, and remembers how each was said.
type RadioCallSource interface {
	// RadioCall returns the facts of a call the AI may word, or false when there is no such call
	// or it went stale.
	RadioCall(id string) (RadioCallFacts, bool)
	// RecordRadioLine remembers the line said for a call.
	RecordRadioLine(id, text string)
}

// RadioLineSetup is the provider and persona a radio line is worded with.
type RadioLineSetup struct {
	Provider string
	// Model is the radio model; empty means the provider's default radio model.
	Model   string
	APIKey  string
	BaseURL string
	Keys    ServerKeys
	// CustomPersonaPrompt defines the "custom" persona.
	CustomPersonaPrompt string
}

// ErrRadioCallNotFound reports a call that can't be worded: unknown, stale, or not one the AI words.
var ErrRadioCallNotFound = errors.New("no radio call to word")

// RadioLineRejectedError is a line the AI wrote that can't be said: it changed the call's facts,
// broke the radio rules or repeated itself.
type RadioLineRejectedError struct {
	Reason string
}

func (e *RadioLineRejectedError) Error() string {
	return "radio line rejected: " + e.Reason
}

// RadioLines words routine radio calls. The dashboards asking for the same call in the same
// language and persona share one provider request, and its line is kept for RadioLineCacheTTL.
type RadioLines struct {
	mu      sync.Mutex
	calls   map[string]*radioLineCall
	now     func() time.Time
	timeout time.Duration // RadioLineTimeout; tests shorten it
}

type radioLineCall struct {
	done    chan struct{}
	text    string
	err     error
	started time.Time
}

// NewRadioLines returns an empty set of radio lines.
func NewRadioLines() *RadioLines {
	return &RadioLines{calls: make(map[string]*radioLineCall), now: time.Now, timeout: RadioLineTimeout}
}

// Word returns the call in fresh words, or an error when the AI is slow, fails or writes a line
// that can't be said; the dashboard then says its catalogue line. The provider request outlives
// a caller that gives up, so the other dashboards and the radio history still get the line.
func (r *RadioLines) Word(ctx context.Context, req RadioLineRequest, calls RadioCallSource, setup RadioLineSetup) (string, error) {
	facts, ok := calls.RadioCall(req.DirectiveID)
	if !ok {
		return "", ErrRadioCallNotFound
	}

	key := req.DirectiveID + "|" + req.Language + "|" + req.Persona
	r.mu.Lock()
	now := r.now()
	for k, c := range r.calls {
		if now.Sub(c.started) > RadioLineCacheTTL {
			delete(r.calls, k)
		}
	}
	call, shared := r.calls[key]
	if !shared {
		call = &radioLineCall{done: make(chan struct{}), started: now}
		r.calls[key] = call
		go call.run(context.WithoutCancel(ctx), r.timeout, req, facts, calls, setup)
	}
	r.mu.Unlock()

	select {
	case <-call.done:
		return call.text, call.err
	case <-ctx.Done():
		return "", ctx.Err()
	}
}

// run words the call once and remembers what was said: the line, or the catalogue line.
func (c *radioLineCall) run(ctx context.Context, timeout time.Duration, req RadioLineRequest, facts RadioCallFacts, calls RadioCallSource, setup RadioLineSetup) {
	defer close(c.done)
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	start := time.Now()
	line, providerID, model, err := wordRadioLine(ctx, req, facts, setup)
	attrs := []any{"key", facts.Key, "language", req.Language, "persona", req.Persona,
		"provider", providerID, "model", model, "ms", time.Since(start).Milliseconds()}
	if err != nil {
		slog.Info("Radio line fallback", append(attrs, "error", err)...)
		calls.RecordRadioLine(req.DirectiveID, req.Baseline)
		c.err = err
		return
	}
	slog.Info("Radio line worded", append(attrs, "line", line)...)
	calls.RecordRadioLine(req.DirectiveID, line)
	c.text = line
}

// wordRadioLine asks the provider's radio model for the call in fresh words and checks the line.
func wordRadioLine(ctx context.Context, req RadioLineRequest, facts RadioCallFacts, setup RadioLineSetup) (line, providerID, model string, err error) {
	p, conn, err := resolveProvider(setup.Provider, setup.APIKey, setup.BaseURL, setup.Keys)
	if err != nil {
		return "", conn.provider, "", err
	}
	model = ResolveRadioModel(conn.provider, setup.Model)
	messages := []AIChatMessage{{Role: "user", Content: radioLineMessage(facts, req.Baseline)}}
	chat := p.newChat(conn, model, radioLinePrompt(req.Persona, req.Language, setup.CustomPersonaPrompt), messages)
	var out textCollector
	if err := runChat(ctx, conn.provider, model, chat, nil, radioLineStyle, &out); err != nil {
		return "", conn.provider, model, err
	}
	line, err = validateRadioLine(out.String(), facts, req.Baseline)
	return line, conn.provider, model, err
}

// textCollector keeps a whole answer.
type textCollector struct {
	strings.Builder
}

func (c *textCollector) text(text string) {
	c.WriteString(text)
}

// radioLinePrompt is the persona, in the listener's language, and the rules of a worded call.
func radioLinePrompt(persona, language, customPrompt string) string {
	catalog := locales.Resolve(language, "", persona)
	return catalog.PersonaPrompt(persona, customPrompt) + catalog.RadioLineDirective()
}

// radioLineMessage gives the model the call to word.
func radioLineMessage(facts RadioCallFacts, baseline string) string {
	var sb strings.Builder
	fmt.Fprintf(&sb, "CALL: %s\n", facts.Message)
	if facts.Values != "" {
		fmt.Fprintf(&sb, "FACTS: %s\n", facts.Values)
	}
	if facts.Situation != "" {
		fmt.Fprintf(&sb, "RACE (context only, don't say it): %s\n", facts.Situation)
	}
	if len(facts.Recent) > 0 {
		sb.WriteString("ALREADY SAID FOR THIS CALL (word it differently):\n")
		for _, line := range facts.Recent {
			fmt.Fprintf(&sb, "- %s\n", line)
		}
	}
	fmt.Fprintf(&sb, "SAY IT LIKE THIS, IN YOUR OWN WORDS: %s\n", baseline)
	return sb.String()
}

var (
	// radioNumber is a number as a line writes it: "5", "1.2", "1,2" (P5 and 45% included).
	radioNumber = regexp.MustCompile(`\d+(?:[.,]\d+)?`)
	// radioSentenceEnd ends a sentence, as the dashboard's speech chunker splits them; a decimal
	// point is followed by a digit, so it doesn't end one.
	radioSentenceEnd = regexp.MustCompile(`[.!?…]+["'”’)\]]*(?:\s+|$)`)
	// radioLineOpener is an acknowledgement, which a call the driver didn't ask for can't open with.
	radioLineOpener = regexp.MustCompile(`(?i)^[¡¿"'“]*\s*(copy|copied|roger|understood|received|entendido|copiado|te copio|recibido)\b`)
	// radioLineMarkup is text the speech engine would read out: placeholders and markdown.
	radioLineMarkup = regexp.MustCompile(`[{}*#\[\]_]`)
)

// validateRadioLine checks a line before it is said: one or two short sentences, no opener the
// driver didn't ask for, every number of the catalogue line kept and no other number added,
// and not a line just said for this call. It returns the line tidied: one line, no quotes.
func validateRadioLine(raw string, facts RadioCallFacts, baseline string) (string, error) {
	line := strings.Join(strings.Fields(raw), " ")
	line = strings.TrimSpace(strings.Trim(line, `"'“”«»`))
	reject := func(format string, args ...any) (string, error) {
		return "", &RadioLineRejectedError{Reason: fmt.Sprintf(format, args...)}
	}
	if line == "" {
		return reject("empty")
	}
	if radioLineMarkup.MatchString(line) {
		return reject("markup in %q", line)
	}
	if radioLineOpener.MatchString(line) {
		return reject("acknowledgement opener in %q", line)
	}
	if words, limit := len(strings.Fields(line)), max(RadioLineMaxWords, len(strings.Fields(baseline))+radioLineExtraWords); words > limit {
		return reject("%d words, at most %d", words, limit)
	}
	if sentences, limit := sentenceCount(line), max(RadioLineMaxSentences, sentenceCount(baseline)); sentences > limit {
		return reject("%d sentences, at most %d", sentences, limit)
	}

	said := numbersIn(line)
	allowed := numbersIn(facts.Message + " " + facts.Values + " " + baseline)
	for n := range said {
		if !allowed[n] {
			return reject("number %s isn't in the call", n)
		}
	}
	for n := range numbersIn(baseline) {
		if !keepsNumber(said, n) {
			return reject("number %s left out", n)
		}
	}
	for _, recent := range facts.Recent {
		if sameWords(line, recent) {
			return reject("repeats %q", recent)
		}
	}
	return line, nil
}

// numbersIn is the set of numbers in text, each written one way: a decimal comma as a point,
// no leading or trailing zeros ("1,20" and "1.2" are both "1.2").
func numbersIn(text string) map[string]bool {
	numbers := make(map[string]bool)
	for _, n := range radioNumber.FindAllString(text, -1) {
		n = strings.ReplaceAll(n, ",", ".")
		if f, err := strconv.ParseFloat(n, 64); err == nil {
			n = strconv.FormatFloat(f, 'f', -1, 64)
		}
		numbers[n] = true
	}
	return numbers
}

// keepsNumber reports whether a line saying the numbers said keeps want: it says want, or a more
// precise number that rounds to it ("1.24" keeps "1.2").
func keepsNumber(said map[string]bool, want string) bool {
	if said[want] {
		return true
	}
	decimals := 0
	if _, frac, ok := strings.Cut(want, "."); ok {
		decimals = len(frac)
	}
	for n := range said {
		if f, err := strconv.ParseFloat(n, 64); err == nil && strconv.FormatFloat(f, 'f', decimals, 64) == want {
			return true
		}
	}
	return false
}

// sentenceCount is how many sentences text has.
func sentenceCount(text string) int {
	count := 0
	for _, part := range radioSentenceEnd.Split(strings.TrimSpace(text), -1) {
		if strings.TrimSpace(part) != "" {
			count++
		}
	}
	return count
}

// sameWords reports whether two lines have the same words, whatever their case and punctuation.
func sameWords(a, b string) bool {
	return wordsOnly(a) == wordsOnly(b)
}

func wordsOnly(text string) string {
	return strings.Join(strings.FieldsFunc(strings.ToLower(text), func(r rune) bool {
		return !unicode.IsLetter(r) && !unicode.IsDigit(r)
	}), " ")
}
