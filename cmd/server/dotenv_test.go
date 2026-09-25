package main

import (
	"os"
	"path/filepath"
	"testing"
)

func TestParseDotEnvLine(t *testing.T) {
	tests := []struct {
		name      string
		line      string
		wantKey   string
		wantValue string
		wantOK    bool
	}{
		{name: "plain", line: "F1T_HTTP_ADDR=:8080", wantKey: "F1T_HTTP_ADDR", wantValue: ":8080", wantOK: true},
		{name: "inline comment", line: "F1T_UDP_ADDR=0.0.0.0:20777      # UDP listener", wantKey: "F1T_UDP_ADDR", wantValue: "0.0.0.0:20777", wantOK: true},
		{name: "empty with comment", line: "GEMINI_API_KEY=                 # Google key", wantKey: "GEMINI_API_KEY", wantValue: "", wantOK: true},
		{name: "double quoted", line: `GEMINI_API_KEY="abc # not a comment"`, wantKey: "GEMINI_API_KEY", wantValue: "abc # not a comment", wantOK: true},
		{name: "single quoted with comment", line: "F1T_DB_PATH='C:\\data\\f1.db' # db", wantKey: "F1T_DB_PATH", wantValue: `C:\data\f1.db`, wantOK: true},
		{name: "export prefix", line: "export OPENAI_API_KEY=sk-123", wantKey: "OPENAI_API_KEY", wantValue: "sk-123", wantOK: true},
		{name: "hash inside value", line: "OPENAI_API_KEY=sk#123", wantKey: "OPENAI_API_KEY", wantValue: "sk#123", wantOK: true},
		{name: "comment line", line: "# F1T_NO_BROWSER=true", wantOK: false},
		{name: "blank line", line: "   ", wantOK: false},
		{name: "no equals", line: "JUSTTEXT", wantOK: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			key, value, ok := parseDotEnvLine(tt.line)
			if ok != tt.wantOK || key != tt.wantKey || value != tt.wantValue {
				t.Errorf("parseDotEnvLine(%q) = (%q, %q, %v), want (%q, %q, %v)",
					tt.line, key, value, ok, tt.wantKey, tt.wantValue, tt.wantOK)
			}
		})
	}
}

func TestLoadDotEnv(t *testing.T) {
	dir := t.TempDir()
	first := filepath.Join(dir, "first.env")
	second := filepath.Join(dir, "second.env")
	writeFile(t, first, "F1T_TEST_FROM_FILE=file\nF1T_TEST_ALREADY_SET=file\nF1T_TEST_EMPTY=   # unset\n")
	writeFile(t, second, "F1T_TEST_FROM_FILE=second\nF1T_TEST_ONLY_SECOND=second\n")

	t.Setenv("F1T_TEST_ALREADY_SET", "env")
	for _, key := range []string{"F1T_TEST_FROM_FILE", "F1T_TEST_EMPTY", "F1T_TEST_ONLY_SECOND"} {
		t.Setenv(key, "")
		_ = os.Unsetenv(key)
	}

	loaded := loadDotEnv(first, filepath.Join(dir, "missing.env"), second)

	if len(loaded) != 2 || loaded[0] != first || loaded[1] != second {
		t.Errorf("expected both existing files to be reported, got %v", loaded)
	}
	if got := os.Getenv("F1T_TEST_FROM_FILE"); got != "file" {
		t.Errorf("expected the first file to win, got %q", got)
	}
	if got := os.Getenv("F1T_TEST_ALREADY_SET"); got != "env" {
		t.Errorf("expected the real environment to win, got %q", got)
	}
	if _, exists := os.LookupEnv("F1T_TEST_EMPTY"); exists {
		t.Errorf("expected empty values to be skipped")
	}
	if got := os.Getenv("F1T_TEST_ONLY_SECOND"); got != "second" {
		t.Errorf("expected values from the second file to be loaded, got %q", got)
	}
}

func writeFile(t *testing.T, path, content string) {
	t.Helper()
	if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
		t.Fatalf("failed to write %s: %v", path, err)
	}
}
