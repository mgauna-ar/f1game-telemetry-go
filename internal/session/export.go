package session

import (
	"archive/zip"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"

	"github.com/mgauna/f1game-telemetry-go/internal/storage"
)

// SanitizeFilename removes unsafe characters and replaces spaces with underscores for export filenames.
func SanitizeFilename(s string) string {
	var result []rune
	for _, r := range s {
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') || r == '-' || r == '_' {
			result = append(result, r)
		} else if r == ' ' {
			result = append(result, '_')
		}
	}
	if len(result) == 0 {
		return "session"
	}
	return string(result)
}

// MarshalAndCompressSessionPackage serializes and compresses an ExportedSessionPackage and builds its canonical filename.
func MarshalAndCompressSessionPackage(pkg *storage.ExportedSessionPackage, suffixID int64) (data []byte, filename string, err error) {
	rawJSON, err := json.Marshal(pkg)
	if err != nil {
		return nil, "", fmt.Errorf("failed to marshal session package: %w", err)
	}

	compressed := storage.CompressRaw(rawJSON)

	if suffixID > 0 {
		filename = fmt.Sprintf("%s_%s_%s_%d.f1session",
			SanitizeFilename(pkg.Session.TrackName),
			SanitizeFilename(pkg.Session.SessionType),
			pkg.Session.CreatedAt.Format("2006-01-02"),
			suffixID,
		)
	} else {
		filename = fmt.Sprintf("%s_%s_%s.f1session",
			SanitizeFilename(pkg.Session.TrackName),
			SanitizeFilename(pkg.Session.SessionType),
			pkg.Session.CreatedAt.Format("2006-01-02"),
		)
	}

	return compressed, filename, nil
}

// ExportSessionBatchToZip exports multiple sessions as a ZIP archive to the provided writer.
// Returns the number of successfully exported sessions.
func ExportSessionBatchToZip(ctx context.Context, repo storage.Repository, sessionIDs []int64, w io.Writer) (int, error) {
	zw := zip.NewWriter(w)
	exportedCount := 0

	for _, id := range sessionIDs {
		pkg, err := repo.ExportSession(ctx, id)
		if err != nil {
			slog.Warn("Failed to export session for batch", "sessionID", id, "error", err)
			continue
		}

		compressed, filename, err := MarshalAndCompressSessionPackage(pkg, id)
		if err != nil {
			slog.Warn("Failed to marshal exported package for session", "sessionID", id, "error", err)
			continue
		}

		f, err := zw.Create(filename)
		if err != nil {
			slog.Warn("Failed to create zip entry for session", "sessionID", id, "error", err)
			continue
		}

		if _, err := f.Write(compressed); err != nil {
			slog.Warn("Failed to write compressed data into zip for session", "sessionID", id, "error", err)
			continue
		}

		exportedCount++
	}

	if err := zw.Close(); err != nil {
		return exportedCount, fmt.Errorf("failed to finalize zip archive: %w", err)
	}

	return exportedCount, nil
}
