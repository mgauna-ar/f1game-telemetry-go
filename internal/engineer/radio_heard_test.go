package engineer

import (
	"bytes"
	"log/slog"
	"strings"
	"testing"
)

func TestAlertKeyOfDirectiveID(t *testing.T) {
	tests := map[string]string{
		"directive_1700000000000_inlap_traffic_behind": "inlap_traffic_behind",
		"directive_5_qualy_traffic":                    "qualy_traffic",
		"directive_5":                                  "",
		"something_else":                               "",
		"":                                             "",
	}
	for id, want := range tests {
		if got := alertKeyOfDirectiveID(id); got != want {
			t.Errorf("alertKeyOfDirectiveID(%q) = %q, want %q", id, got, want)
		}
	}
}

// TestRecordRadioHeard_NamesTheCallItSaid checks that a report names the alert the driver heard
// (the call's sub_alert) while the call is still in the radio history, and the alert key from its
// ID once it isn't.
func TestRecordRadioHeard_NamesTheCallItSaid(t *testing.T) {
	var logged bytes.Buffer
	previous := slog.Default()
	slog.SetDefault(slog.New(slog.NewTextHandler(&logged, nil)))
	t.Cleanup(func() { slog.SetDefault(previous) })

	e := NewEngineerEngine(nil)
	e.recordRadioCallLocked(Directive{ID: "directive_5_qualy_traffic", SubAlert: "qualy_clean_air", Urgency: UrgencyLow})

	e.RecordRadioHeard(RadioHeard{DirectiveID: "directive_5_qualy_traffic", Outcome: "said"})
	if !strings.Contains(logged.String(), "key=qualy_clean_air") {
		t.Errorf("a call in the history is logged by its sub_alert:\n%s", logged.String())
	}

	logged.Reset()
	e.RecordRadioHeard(RadioHeard{DirectiveID: "directive_6_inlap_traffic_behind", Outcome: "stale"})
	if line := logged.String(); !strings.Contains(line, "key=inlap_traffic_behind") || !strings.Contains(line, "outcome=stale") {
		t.Errorf("a call no longer in the history is logged by the key in its ID:\n%s", line)
	}
}
