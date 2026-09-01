package session

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"strings"

	"github.com/mgauna/f1game-telemetry-go/internal/storage"
)

var (
	// ZstdMagicHeader represents the 4-byte standard magic header for Zstandard compressed streams (0xFD2FB528 in little-endian).
	ZstdMagicHeader = []byte{0x28, 0xB5, 0x2F, 0xFD}
	// ZipMagicHeader represents the 4-byte magic header for standard ZIP archives (PK\x03\x04).
	ZipMagicHeader = []byte{0x50, 0x4B, 0x03, 0x04}
)

// FileItem represents an in-memory file with its filename and raw byte content.
type FileItem struct {
	Name string
	Data []byte
}

// ImportDetail represents the outcome for a single imported session file.
type ImportDetail struct {
	Filename  string `json:"filename,omitempty"`
	Status    string `json:"status"` // "imported", "skipped", "failed"
	SessionID int64  `json:"session_id,omitempty"`
	Reason    string `json:"reason,omitempty"`
}

// ImportBatchResponse represents the outcome summary for batch or single session import.
type ImportBatchResponse struct {
	Status     string         `json:"status"`
	Total      int            `json:"total"`
	Imported   int            `json:"imported"`
	Skipped    int            `json:"skipped"`
	Failed     int            `json:"failed"`
	SessionIDs []int64        `json:"session_ids"`
	SessionID  int64          `json:"session_id,omitempty"`
	Details    []ImportDetail `json:"details"`
}

// ParseSessionPackage decompresses and parses an ExportedSessionPackage from raw bytes.
func ParseSessionPackage(data []byte) (*storage.ExportedSessionPackage, error) {
	if len(data) == 0 {
		return nil, fmt.Errorf("empty session payload")
	}
	if bytes.HasPrefix(data, ZstdMagicHeader) {
		decompressed, err := storage.DecompressRaw(data)
		if err != nil {
			return nil, fmt.Errorf("failed to decompress .f1session file: %w", err)
		}
		data = decompressed
	}
	var pkg storage.ExportedSessionPackage
	if err := json.Unmarshal(data, &pkg); err != nil {
		return nil, fmt.Errorf("invalid session package format: %w", err)
	}
	return &pkg, nil
}

// ExpandZipFiles expands any ZIP archives in the items slice into individual session file items.
func ExpandZipFiles(items []FileItem) []FileItem {
	var sessionFiles []FileItem
	for _, item := range items {
		if bytes.HasPrefix(item.Data, ZipMagicHeader) || strings.HasSuffix(strings.ToLower(item.Name), ".zip") {
			zr, err := zip.NewReader(bytes.NewReader(item.Data), int64(len(item.Data)))
			if err != nil {
				slog.Warn("Failed to open zip archive", "file", item.Name, "error", err)
				continue
			}
			for _, zf := range zr.File {
				if zf.FileInfo().IsDir() {
					continue
				}
				lowerName := strings.ToLower(zf.Name)
				if !strings.HasSuffix(lowerName, ".f1session") && !strings.HasSuffix(lowerName, ".json") {
					continue
				}
				rc, err := zf.Open()
				if err != nil {
					continue
				}
				zData, err := io.ReadAll(rc)
				rc.Close()
				if err == nil && len(zData) > 0 {
					sessionFiles = append(sessionFiles, FileItem{Name: zf.Name, Data: zData})
				}
			}
		} else {
			sessionFiles = append(sessionFiles, item)
		}
	}
	return sessionFiles
}

// ImportSessionFiles processes a list of session files, importing them into the repository.
func ImportSessionFiles(ctx context.Context, repo storage.Repository, files []FileItem) ImportBatchResponse {
	resp := ImportBatchResponse{
		Status:     "success",
		Total:      len(files),
		SessionIDs: make([]int64, 0),
		Details:    make([]ImportDetail, 0, len(files)),
	}

	for _, sf := range files {
		pkg, err := ParseSessionPackage(sf.Data)
		if err != nil {
			resp.Failed++
			resp.Details = append(resp.Details, ImportDetail{
				Filename: sf.Name,
				Status:   "failed",
				Reason:   err.Error(),
			})
			continue
		}

		newID, err := repo.ImportSession(ctx, pkg)
		if err != nil {
			if errors.Is(err, storage.ErrSessionAlreadyExists) {
				resp.Skipped++
				resp.Details = append(resp.Details, ImportDetail{
					Filename:  sf.Name,
					Status:    "skipped",
					SessionID: newID,
					Reason:    "Session already exists",
				})
			} else {
				resp.Failed++
				resp.Details = append(resp.Details, ImportDetail{
					Filename: sf.Name,
					Status:   "failed",
					Reason:   err.Error(),
				})
			}
			continue
		}

		resp.Imported++
		resp.SessionIDs = append(resp.SessionIDs, newID)
		resp.Details = append(resp.Details, ImportDetail{
			Filename:  sf.Name,
			Status:    "imported",
			SessionID: newID,
		})
	}

	if len(resp.SessionIDs) > 0 {
		resp.SessionID = resp.SessionIDs[0]
	}

	return resp
}
