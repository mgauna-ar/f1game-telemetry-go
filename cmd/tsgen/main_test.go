package main

import (
	"encoding/json"
	"path/filepath"
	"slices"
	"testing"

	"github.com/mgauna/f1game-telemetry-go/internal/tsgen"
)

// TestGeneratedFilesUpToDate fails when a Go wire type changed without regenerating the
// frontend types, so `go test ./...` catches it before CI does.
func TestGeneratedFilesUpToDate(t *testing.T) {
	files, err := registry().Generate()
	if err != nil {
		t.Fatalf("Generate: %v", err)
	}
	stale, extra, err := staleFiles(filepath.Join("..", "..", defaultOutDir), files)
	if err != nil {
		t.Fatal(err)
	}
	if len(stale) > 0 || len(extra) > 0 {
		t.Fatalf("generated TypeScript types are out of date (changed: %v, no longer generated: %v); run go run ./cmd/tsgen", stale, extra)
	}
}

// TestMarshalerKeys checks that each type with its own MarshalJSON writes the properties its
// registered wire type declares: every required property, and nothing that is not declared.
func TestMarshalerKeys(t *testing.T) {
	for sample, wire := range registry().Marshalers() {
		t.Run(sample.String(), func(t *testing.T) {
			data, err := json.Marshal(registry().MarshalerSample(sample))
			if err != nil {
				t.Fatalf("marshal: %v", err)
			}
			var got map[string]json.RawMessage
			if err := json.Unmarshal(data, &got); err != nil {
				t.Fatalf("%s does not marshal to a JSON object: %v", sample, err)
			}
			fields, err := tsgen.JSONFields(wire)
			if err != nil {
				t.Fatal(err)
			}
			declared := make([]string, 0, len(fields))
			for _, f := range fields {
				declared = append(declared, f.Name)
				if _, ok := got[f.Name]; !ok && !f.Optional {
					t.Errorf("required property %q of %s is missing from the JSON: %s", f.Name, wire, data)
				}
			}
			for key := range got {
				if !slices.Contains(declared, key) {
					t.Errorf("the JSON has %q, which %s does not declare: %s", key, wire, data)
				}
			}
		})
	}
}
