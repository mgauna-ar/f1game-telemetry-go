package ai

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"sync"
	"testing"
	"time"
)

// fakeRadioCalls is a radio history with one wordable call.
type fakeRadioCalls struct {
	mu    sync.Mutex
	facts map[string]RadioCallFacts
	said  map[string]string
}

func newFakeRadioCalls() *fakeRadioCalls {
	return &fakeRadioCalls{
		facts: map[string]RadioCallFacts{"call_1": {
			Key:       "tyre_wear",
			Message:   "Front left tyre wear at 45%",
			Values:    "front left; 45%",
			Situation: "Race, lap 12 of 30, P5, Medium (8 laps), Clear",
			Recent:    []string{"Front left at 45 percent, look after it."},
		}},
		said: make(map[string]string),
	}
}

func (f *fakeRadioCalls) RadioCall(id string) (RadioCallFacts, bool) {
	f.mu.Lock()
	defer f.mu.Unlock()
	facts, ok := f.facts[id]
	return facts, ok
}

func (f *fakeRadioCalls) RecordRadioLine(id, text string) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.said[id] = text
}

func (f *fakeRadioCalls) lineSaid(id string) string {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.said[id]
}

func openAILine(text string) func(w http.ResponseWriter) {
	return sseReply(`{"choices":[{"delta":{"content":"`+text+`"}}]}`, `[DONE]`)
}

const tyreWearBaseline = "Front left wear is 45%, manage it."

func tyreWearRequest() RadioLineRequest {
	return RadioLineRequest{DirectiveID: "call_1", Language: "en", Persona: "bono", Baseline: tyreWearBaseline}
}

func customSetup(url string) RadioLineSetup {
	return RadioLineSetup{Provider: ProviderCustom, Model: "local-radio", BaseURL: url}
}

func TestRadioLines_WordsTheCallWithTheRadioModel(t *testing.T) {
	up, url := startUpstream(t, openAILine("Front left is at 45 percent now, ease off on the exits."))
	calls := newFakeRadioCalls()

	line, err := NewRadioLines().Word(context.Background(), tyreWearRequest(), calls, customSetup(url))
	if err != nil {
		t.Fatalf("Word: %v", err)
	}
	if line != "Front left is at 45 percent now, ease off on the exits." {
		t.Errorf("line = %q", line)
	}
	if got := calls.lineSaid("call_1"); got != line {
		t.Errorf("recorded %q, want the line", got)
	}

	reqs := up.requests()
	if len(reqs) != 1 {
		t.Fatalf("%d provider requests, want 1", len(reqs))
	}
	body := reqs[0]
	if body["model"] != "local-radio" || body["temperature"] != openAIVariedTemperature || body["max_tokens"] != float64(RadioLineMaxTokens) {
		t.Errorf("model %v, temperature %v, max_tokens %v: want the radio model, varied and capped", body["model"], body["temperature"], body["max_tokens"])
	}
	if body["tools"] != nil {
		t.Error("a radio line is worded without tools")
	}
	system := jsonString(t, body, "messages", 0, "content")
	user := jsonString(t, body, "messages", 1, "content")
	for _, want := range []string{"Bonnington", "WORDING A RADIO CALL", "Keep every number"} {
		if !strings.Contains(system, want) {
			t.Errorf("system prompt lacks %q:\n%s", want, system)
		}
	}
	for _, want := range []string{"CALL: Front left tyre wear at 45%", "FACTS: front left; 45%", "lap 12 of 30", "word it differently", "- Front left at 45 percent, look after it.", "SAY IT LIKE THIS, IN YOUR OWN WORDS: " + tyreWearBaseline} {
		if !strings.Contains(user, want) {
			t.Errorf("message lacks %q:\n%s", want, user)
		}
	}
}

func TestRadioLines_SpanishUsesTheSpanishRules(t *testing.T) {
	up, url := startUpstream(t, openAILine("Delantera izquierda al 45%, cuidala en las salidas."))
	req := tyreWearRequest()
	req.Language, req.Persona, req.Baseline = "es", "colapinto", "La delantera izquierda está al 45%, cuidala."

	if _, err := NewRadioLines().Word(context.Background(), req, newFakeRadioCalls(), customSetup(url)); err != nil {
		t.Fatalf("Word: %v", err)
	}
	system := jsonString(t, up.requests()[0], "messages", 0, "content")
	for _, want := range []string{"Colapinto", "CÓMO DECIR UNA LLAMADA DE RADIO", "rioplatense, de vos"} {
		if !strings.Contains(system, want) {
			t.Errorf("system prompt lacks %q:\n%s", want, system)
		}
	}
}

func TestRadioLines_ShareOneRequestPerCallLanguageAndPersona(t *testing.T) {
	release := make(chan struct{})
	up, url := startUpstream(t, func(w http.ResponseWriter) {
		<-release
		openAILine("Front left at 45%, easy on the exits.")(w)
	})
	lines := NewRadioLines()
	calls := newFakeRadioCalls()

	var wg sync.WaitGroup
	results := make([]string, 3)
	for i := range results {
		wg.Go(func() {
			line, err := lines.Word(context.Background(), tyreWearRequest(), calls, customSetup(url))
			if err != nil {
				t.Errorf("caller %d: %v", i, err)
			}
			results[i] = line
		})
	}
	time.Sleep(50 * time.Millisecond)
	close(release)
	wg.Wait()

	if n := len(up.requests()); n != 1 {
		t.Errorf("%d provider requests for three dashboards, want 1", n)
	}
	for i, line := range results {
		if line != "Front left at 45%, easy on the exits." {
			t.Errorf("caller %d got %q", i, line)
		}
	}

	// Another language is its own line.
	es := tyreWearRequest()
	es.Language, es.Baseline = "es", "Delantera izquierda al 45%."
	if _, err := lines.Word(context.Background(), es, calls, customSetup(url)); err != nil || len(up.requests()) != 2 {
		t.Errorf("Spanish: err %v, %d requests; want a request of its own", err, len(up.requests()))
	}
}

func TestRadioLines_OutliveACallerThatGivesUp(t *testing.T) {
	release := make(chan struct{})
	up, url := startUpstream(t, func(w http.ResponseWriter) {
		<-release
		openAILine("Front left at 45%, easy on the exits.")(w)
	})
	lines := NewRadioLines()
	calls := newFakeRadioCalls()

	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan error)
	go func() {
		_, err := lines.Word(ctx, tyreWearRequest(), calls, customSetup(url))
		done <- err
	}()
	time.Sleep(50 * time.Millisecond)
	cancel()
	if err := <-done; !errors.Is(err, context.Canceled) {
		t.Fatalf("cancelled caller: err %v", err)
	}
	close(release)

	// The request carries on: the next dashboard gets its line without asking again.
	line, err := lines.Word(context.Background(), tyreWearRequest(), calls, customSetup(url))
	if err != nil || line != "Front left at 45%, easy on the exits." {
		t.Fatalf("second caller: %q, %v", line, err)
	}
	if n := len(up.requests()); n != 1 {
		t.Errorf("%d provider requests, want 1", n)
	}
	if calls.lineSaid("call_1") != line {
		t.Errorf("recorded %q", calls.lineSaid("call_1"))
	}
}

func TestRadioLines_KeepALineForRadioLineCacheTTL(t *testing.T) {
	up, url := startUpstream(t, openAILine("Front left at 45%, easy on the exits."))
	lines := NewRadioLines()
	now := time.Unix(1000, 0)
	lines.now = func() time.Time { return now }
	calls := newFakeRadioCalls()

	for range 2 {
		if _, err := lines.Word(context.Background(), tyreWearRequest(), calls, customSetup(url)); err != nil {
			t.Fatal(err)
		}
	}
	now = now.Add(RadioLineCacheTTL + time.Second)
	if _, err := lines.Word(context.Background(), tyreWearRequest(), calls, customSetup(url)); err != nil {
		t.Fatal(err)
	}
	if n := len(up.requests()); n != 2 {
		t.Errorf("%d provider requests, want 2: one kept, one after it expired", n)
	}
}

func TestRadioLines_FallBackToTheBaseline(t *testing.T) {
	cases := []struct {
		name  string
		reply func(w http.ResponseWriter)
		check func(t *testing.T, err error)
	}{
		{"invented number", openAILine("Front left at 45%, you have 3 laps."), func(t *testing.T, err error) {
			var rejected *RadioLineRejectedError
			if !errors.As(err, &rejected) || !strings.Contains(rejected.Reason, "number 3") {
				t.Errorf("err %v, want the invented number rejected", err)
			}
		}},
		{"provider error", errorReply(http.StatusTooManyRequests, `{"error":{"message":"slow down"}}`), func(t *testing.T, err error) {
			var aiErr *AIStreamError
			if !errors.As(err, &aiErr) || aiErr.StatusCode != http.StatusTooManyRequests {
				t.Errorf("err %v, want the provider's error", err)
			}
		}},
		{"too slow", func(w http.ResponseWriter) {
			time.Sleep(300 * time.Millisecond)
			openAILine("Front left at 45%.")(w)
		}, func(t *testing.T, err error) {
			if !errors.Is(err, context.DeadlineExceeded) {
				t.Errorf("err %v, want the timeout", err)
			}
		}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			_, url := startUpstream(t, tc.reply)
			lines := NewRadioLines()
			lines.timeout = 100 * time.Millisecond
			calls := newFakeRadioCalls()

			_, err := lines.Word(context.Background(), tyreWearRequest(), calls, customSetup(url))
			tc.check(t, err)
			if got := calls.lineSaid("call_1"); got != tyreWearBaseline {
				t.Errorf("recorded %q, want the baseline the dashboard says instead", got)
			}
		})
	}
}

func TestRadioLines_UnknownCall(t *testing.T) {
	up, url := startUpstream(t, openAILine("anything"))
	req := tyreWearRequest()
	req.DirectiveID = "call_9"

	if _, err := NewRadioLines().Word(context.Background(), req, newFakeRadioCalls(), customSetup(url)); !errors.Is(err, ErrRadioCallNotFound) {
		t.Errorf("err %v, want ErrRadioCallNotFound", err)
	}
	if len(up.requests()) != 0 {
		t.Error("an unknown call reached the provider")
	}
}

func TestValidateRadioLine(t *testing.T) {
	facts := RadioCallFacts{
		Message: "Gap to Norris ahead 1.24 s, closing 0.3 s a lap",
		Values:  "position P5; car ahead 1.2 s, closing 0.3 s a lap",
		Recent:  []string{"P5, Norris 1.2 up the road, you're taking 0.3 a lap."},
	}
	baseline := "P5. Car ahead is 1.2, coming back 0.3 a lap."
	cases := []struct {
		name, line, want, reason string
	}{
		{"fresh words", "You're P5, 1.2 to the car ahead and taking 0.3 a lap.", "You're P5, 1.2 to the car ahead and taking 0.3 a lap.", ""},
		{"tidied", "  \"P5 now.\nGap ahead 1.2, closing 0.3 a lap.\"  ", "P5 now. Gap ahead 1.2, closing 0.3 a lap.", ""},
		{"decimal comma and the message's own precision", "P5, a 1,24 del de adelante y le sacás 0,3 por vuelta.", "P5, a 1,24 del de adelante y le sacás 0,3 por vuelta.", ""},
		{"invented number", "P5, 1.2 ahead, 0.3 a lap, 4 laps to catch him.", "", "number 4"},
		{"number left out", "P5, closing on the car ahead by 0.3 a lap.", "", "number 1.2 left out"},
		{"number as a word", "Fifth, 1.2 ahead, 0.3 a lap.", "", "number 5 left out"},
		{"opener", "Copy, P5, 1.2 ahead and 0.3 a lap.", "", "acknowledgement"},
		{"Spanish opener", "¡Entendido! P5, 1,2 adelante, 0,3 por vuelta.", "", "acknowledgement"},
		{"placeholder", "{driver}, P5, 1.2 ahead, 0.3 a lap.", "", "markup"},
		{"too many sentences", "P5. Ahead 1.2. Closing 0.3. Keep going. Push now.", "", "5 sentences"},
		{"too long", "P5 " + strings.Repeat("and keep going ", 8) + "1.2 0.3.", "", "words"},
		{"repeats a recent line", "P5, Norris 1.2 up the road; you're taking 0.3 a lap!", "", "repeats"},
		{"empty", " \"\" ", "", "empty"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, err := validateRadioLine(tc.line, facts, baseline)
			if tc.reason == "" {
				if err != nil || got != tc.want {
					t.Errorf("got %q, %v; want %q", got, err, tc.want)
				}
				return
			}
			var rejected *RadioLineRejectedError
			if !errors.As(err, &rejected) || !strings.Contains(rejected.Reason, tc.reason) {
				t.Errorf("got %q, %v; want rejected for %q", got, err, tc.reason)
			}
		})
	}
}

func TestValidateRadioLine_LongerForALongCatalogueLine(t *testing.T) {
	baseline := "Gap report. You're P7. The car ahead is 2.1 and the gap is coming down 0.2 a lap. Behind you it's 1.4 and holding steady."
	line := "Quick update: P7, 2.1 to the car ahead and you're taking 0.2 a lap out of him, with 1.4 back to the car behind and that one holding steady for now."
	if _, err := validateRadioLine(line, RadioCallFacts{}, baseline); err != nil {
		t.Errorf("a line as long as a four-sentence report: %v", err)
	}
}
