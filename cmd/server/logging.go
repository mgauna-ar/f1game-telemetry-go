package main

import (
	"io"
	"log/slog"
	"os"
	"path/filepath"
)

const (
	logFileName    = "f1telemetry.log"
	oldLogFileName = "f1telemetry.old.log"
	// maxLogFileBytes is the size past which the log is moved to oldLogFileName at startup.
	maxLogFileBytes = 5 << 20
)

// logFilePath is the log file next to the database.
func logFilePath(dbPath string) string {
	return filepath.Join(filepath.Dir(dbPath), logFileName)
}

// openLogFile opens path for appending. A log already past maxLogFileBytes is first moved to
// f1telemetry.old.log (replacing the previous one), so the file never grows without bound.
func openLogFile(path string) (*os.File, error) {
	if info, err := os.Stat(path); err == nil && info.Size() > maxLogFileBytes {
		_ = os.Rename(path, filepath.Join(filepath.Dir(path), oldLogFileName))
	}
	return os.OpenFile(path, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o644)
}

// setupLogging sends the log to the console when there is one, and also to a file next to the
// database when toFile is set (the tray, or a build without a console). It returns the log file
// path ("" when none is written) and a func that closes it.
func setupLogging(dbPath string, toFile, hasConsole bool) (logPath string, closeLog func()) {
	closeLog = func() {}
	var outputs []io.Writer
	if hasConsole {
		outputs = append(outputs, os.Stderr)
	}
	if toFile {
		path := logFilePath(dbPath)
		if f, err := openLogFile(path); err != nil {
			slog.Warn("Could not open the log file", "path", path, "error", err)
		} else {
			outputs = append(outputs, f)
			logPath = path
			closeLog = func() { _ = f.Close() }
		}
	}
	if len(outputs) == 0 {
		outputs = append(outputs, io.Discard)
	}
	slog.SetDefault(slog.New(slog.NewTextHandler(io.MultiWriter(outputs...), &slog.HandlerOptions{Level: slog.LevelInfo})))
	return logPath, closeLog
}
