package main

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLogFilePath(t *testing.T) {
	dir := t.TempDir()
	if got, want := logFilePath(filepath.Join(dir, "f1telemetry.db")), filepath.Join(dir, logFileName); got != want {
		t.Errorf("logFilePath() = %q, want %q", got, want)
	}
}

func TestOpenLogFile(t *testing.T) {
	t.Run("appends to a small log", func(t *testing.T) {
		path := filepath.Join(t.TempDir(), logFileName)
		if err := os.WriteFile(path, []byte("earlier run\n"), 0o644); err != nil {
			t.Fatal(err)
		}
		writeLog(t, path, "this run\n")

		if got := readFile(t, path); got != "earlier run\nthis run\n" {
			t.Errorf("log = %q, want both runs", got)
		}
	})

	t.Run("moves a large log aside", func(t *testing.T) {
		dir := t.TempDir()
		path := filepath.Join(dir, logFileName)
		big := make([]byte, maxLogFileBytes+1)
		if err := os.WriteFile(path, big, 0o644); err != nil {
			t.Fatal(err)
		}
		writeLog(t, path, "this run\n")

		if got := readFile(t, path); got != "this run\n" {
			t.Errorf("log = %q, want only this run", got)
		}
		info, err := os.Stat(filepath.Join(dir, oldLogFileName))
		if err != nil {
			t.Fatalf("old log missing: %v", err)
		}
		if info.Size() != int64(len(big)) {
			t.Errorf("old log size = %d, want %d", info.Size(), len(big))
		}
	})
}

func writeLog(t *testing.T, path, text string) {
	t.Helper()
	f, err := openLogFile(path)
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()
	if _, err := f.WriteString(text); err != nil {
		t.Fatal(err)
	}
}

func readFile(t *testing.T, path string) string {
	t.Helper()
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	return string(data)
}
