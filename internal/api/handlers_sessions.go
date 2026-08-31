package api

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/mgauna/f1game-telemetry-go/internal/analytics"
	"github.com/mgauna/f1game-telemetry-go/internal/storage"
)

const (
	// DefaultTagColor is the default accent color used when creating tags without a color.
	DefaultTagColor = "#06b6d4"
	// MaxImportPayloadSize is the maximum size allowed for importing session files (100 MB).
	MaxImportPayloadSize = 100 << 20
)

var (
	// ZstdMagicHeader represents the 4-byte standard magic header for Zstandard compressed streams (0xFD2FB528 in little-endian).
	ZstdMagicHeader = []byte{0x28, 0xB5, 0x2F, 0xFD}
	// ZipMagicHeader represents the 4-byte magic header for standard ZIP archives (PK\x03\x04).
	ZipMagicHeader = []byte{0x50, 0x4B, 0x03, 0x04}
)

func (s *Server) handleGetSessions(w http.ResponseWriter, r *http.Request) {
	sessions, err := s.repo.GetSessions(r.Context())
	if err != nil {
		writeJSONError(w, "Failed to get sessions", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, sessions)
}

func (s *Server) handleDeleteSession(w http.ResponseWriter, r *http.Request) {
	sessionIDStr := chi.URLParam(r, "id")
	sessionID, err := strconv.ParseInt(sessionIDStr, 10, 64)
	if err != nil {
		writeJSONError(w, "Invalid session ID", http.StatusBadRequest)
		return
	}

	if err := s.repo.DeleteSession(r.Context(), sessionID); err != nil {
		if errors.Is(err, storage.ErrSessionNotFound) {
			writeJSONError(w, "Session not found", http.StatusNotFound)
			return
		}
		slog.Error("Failed to delete session", "sessionID", sessionID, "error", err)
		writeJSONError(w, "Failed to delete session", http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "success"})
}

func (s *Server) handleGetParticipants(w http.ResponseWriter, r *http.Request) {
	sessionIDStr := chi.URLParam(r, "id")
	sessionID, err := strconv.ParseInt(sessionIDStr, 10, 64)
	if err != nil {
		writeJSONError(w, "Invalid session ID", http.StatusBadRequest)
		return
	}

	participants, err := s.repo.GetParticipantsBySession(r.Context(), sessionID)
	if err != nil {
		slog.Error("Failed to get participants", "sessionID", sessionID, "error", err)
		writeJSONError(w, "Failed to get participants", http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, participants)
}

func (s *Server) handleGetLaps(w http.ResponseWriter, r *http.Request) {
	sessionIDStr := chi.URLParam(r, "id")
	sessionID, err := strconv.ParseInt(sessionIDStr, 10, 64)
	if err != nil {
		writeJSONError(w, "Invalid session ID", http.StatusBadRequest)
		return
	}

	var carIndex *int
	if carIndexStr := r.URL.Query().Get("carIndex"); carIndexStr != "" {
		if ci, err := strconv.Atoi(carIndexStr); err == nil && ci >= 0 {
			carIndex = &ci
		}
	}

	laps, err := s.repo.GetLapsBySession(r.Context(), sessionID, carIndex)
	if err != nil {
		writeJSONError(w, "Failed to get laps", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, laps)
}

func (s *Server) handleGetTelemetry(w http.ResponseWriter, r *http.Request) {
	lapIDStr := chi.URLParam(r, "id")
	lapID, err := strconv.ParseInt(lapIDStr, 10, 64)
	if err != nil {
		writeJSONError(w, "Invalid lap ID", http.StatusBadRequest)
		return
	}

	telemetry, err := s.repo.GetTelemetryByLap(r.Context(), lapID)
	if err != nil {
		writeJSONError(w, "Failed to get telemetry", http.StatusInternalServerError)
		return
	}

	// Clean out-laps and aborted attempts to isolate the final completed lap attempt
	telemetry = analytics.TrimTelemetryToLastLapAttempt(telemetry)

	if maxPointsStr := r.URL.Query().Get("maxPoints"); maxPointsStr != "" {
		if maxPoints, err := strconv.Atoi(maxPointsStr); err == nil && maxPoints > 0 {
			telemetry = analytics.DownsampleTelemetry(telemetry, maxPoints)
		}
	}

	writeJSON(w, http.StatusOK, telemetry)
}

// Tag request payloads
type createTagRequest struct {
	Name  string `json:"name"`
	Color string `json:"color"`
}

type addSessionTagRequest struct {
	TagID int64  `json:"tag_id"`
	Name  string `json:"name"`
	Color string `json:"color"`
}

type setSessionTagsRequest struct {
	TagIDs []int64 `json:"tag_ids"`
}

func (s *Server) handleGetTags(w http.ResponseWriter, r *http.Request) {
	tags, err := s.repo.GetAllTags(r.Context())
	if err != nil {
		writeJSONError(w, "Failed to get tags", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, tags)
}

func (s *Server) handleCreateTag(w http.ResponseWriter, r *http.Request) {
	var req createTagRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSONError(w, "Invalid request payload", http.StatusBadRequest)
		return
	}

	name := strings.TrimSpace(req.Name)
	color := strings.TrimSpace(req.Color)
	if name == "" {
		writeJSONError(w, "Tag name is required", http.StatusBadRequest)
		return
	}
	if color == "" {
		color = DefaultTagColor
	}

	tag := storage.Tag{
		Name:  name,
		Color: color,
	}

	if err := s.repo.CreateTag(r.Context(), &tag); err != nil {
		slog.Error("Failed to create tag", "error", err)
		writeJSONError(w, "Failed to create tag", http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusCreated, tag)
}

func (s *Server) handleUpdateTag(w http.ResponseWriter, r *http.Request) {
	tagIDStr := chi.URLParam(r, "id")
	tagID, err := strconv.ParseInt(tagIDStr, 10, 64)
	if err != nil {
		writeJSONError(w, "Invalid tag ID", http.StatusBadRequest)
		return
	}

	var req createTagRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSONError(w, "Invalid request payload", http.StatusBadRequest)
		return
	}

	name := strings.TrimSpace(req.Name)
	color := strings.TrimSpace(req.Color)
	if name == "" {
		writeJSONError(w, "Tag name is required", http.StatusBadRequest)
		return
	}
	if color == "" {
		color = DefaultTagColor
	}

	tag := storage.Tag{
		ID:    tagID,
		Name:  name,
		Color: color,
	}

	if err := s.repo.UpdateTag(r.Context(), &tag); err != nil {
		if errors.Is(err, storage.ErrTagNotFound) {
			writeJSONError(w, "Tag not found", http.StatusNotFound)
			return
		}
		slog.Error("Failed to update tag", "tagID", tagID, "error", err)
		writeJSONError(w, "Failed to update tag", http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, tag)
}

func (s *Server) handleDeleteTag(w http.ResponseWriter, r *http.Request) {
	tagIDStr := chi.URLParam(r, "id")
	tagID, err := strconv.ParseInt(tagIDStr, 10, 64)
	if err != nil {
		writeJSONError(w, "Invalid tag ID", http.StatusBadRequest)
		return
	}

	if err := s.repo.DeleteTag(r.Context(), tagID); err != nil {
		if errors.Is(err, storage.ErrTagNotFound) {
			writeJSONError(w, "Tag not found", http.StatusNotFound)
			return
		}
		slog.Error("Failed to delete tag", "tagID", tagID, "error", err)
		writeJSONError(w, "Failed to delete tag", http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "success"})
}

func (s *Server) handleGetSessionTags(w http.ResponseWriter, r *http.Request) {
	sessionIDStr := chi.URLParam(r, "id")
	sessionID, err := strconv.ParseInt(sessionIDStr, 10, 64)
	if err != nil {
		writeJSONError(w, "Invalid session ID", http.StatusBadRequest)
		return
	}

	tags, err := s.repo.GetTagsBySession(r.Context(), sessionID)
	if err != nil {
		slog.Error("Failed to get session tags", "sessionID", sessionID, "error", err)
		writeJSONError(w, "Failed to get session tags", http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, tags)
}

func (s *Server) handleAddSessionTag(w http.ResponseWriter, r *http.Request) {
	sessionIDStr := chi.URLParam(r, "id")
	sessionID, err := strconv.ParseInt(sessionIDStr, 10, 64)
	if err != nil {
		writeJSONError(w, "Invalid session ID", http.StatusBadRequest)
		return
	}

	var req addSessionTagRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSONError(w, "Invalid request payload", http.StatusBadRequest)
		return
	}

	tagID := req.TagID
	if tagID == 0 {
		name := strings.TrimSpace(req.Name)
		if name == "" {
			writeJSONError(w, "Tag ID or Tag Name is required", http.StatusBadRequest)
			return
		}
		color := strings.TrimSpace(req.Color)
		if color == "" {
			color = DefaultTagColor
		}
		tag := storage.Tag{
			Name:  name,
			Color: color,
		}
		if err := s.repo.CreateTag(r.Context(), &tag); err != nil {
			slog.Error("Failed to create tag on demand", "error", err)
			writeJSONError(w, "Failed to create tag", http.StatusInternalServerError)
			return
		}
		tagID = tag.ID
	}

	if err := s.repo.AddTagToSession(r.Context(), sessionID, tagID); err != nil {
		slog.Error("Failed to add tag to session", "sessionID", sessionID, "tagID", tagID, "error", err)
		writeJSONError(w, "Failed to add tag to session", http.StatusInternalServerError)
		return
	}

	tags, err := s.repo.GetTagsBySession(r.Context(), sessionID)
	if err != nil {
		writeJSONError(w, "Failed to retrieve updated tags", http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, tags)
}

func (s *Server) handleSetSessionTags(w http.ResponseWriter, r *http.Request) {
	sessionIDStr := chi.URLParam(r, "id")
	sessionID, err := strconv.ParseInt(sessionIDStr, 10, 64)
	if err != nil {
		writeJSONError(w, "Invalid session ID", http.StatusBadRequest)
		return
	}

	var req setSessionTagsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSONError(w, "Invalid request payload", http.StatusBadRequest)
		return
	}

	if req.TagIDs == nil {
		req.TagIDs = []int64{}
	}

	if err := s.repo.SetSessionTags(r.Context(), sessionID, req.TagIDs); err != nil {
		slog.Error("Failed to set session tags", "sessionID", sessionID, "error", err)
		writeJSONError(w, "Failed to set session tags", http.StatusInternalServerError)
		return
	}

	tags, err := s.repo.GetTagsBySession(r.Context(), sessionID)
	if err != nil {
		writeJSONError(w, "Failed to retrieve updated tags", http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, tags)
}

func (s *Server) handleRemoveSessionTag(w http.ResponseWriter, r *http.Request) {
	sessionIDStr := chi.URLParam(r, "id")
	sessionID, err := strconv.ParseInt(sessionIDStr, 10, 64)
	if err != nil {
		writeJSONError(w, "Invalid session ID", http.StatusBadRequest)
		return
	}

	tagIDStr := chi.URLParam(r, "tagId")
	tagID, err := strconv.ParseInt(tagIDStr, 10, 64)
	if err != nil {
		writeJSONError(w, "Invalid tag ID", http.StatusBadRequest)
		return
	}

	if err := s.repo.RemoveTagFromSession(r.Context(), sessionID, tagID); err != nil {
		slog.Error("Failed to remove tag from session", "sessionID", sessionID, "tagID", tagID, "error", err)
		writeJSONError(w, "Failed to remove tag from session", http.StatusInternalServerError)
		return
	}

	tags, err := s.repo.GetTagsBySession(r.Context(), sessionID)
	if err != nil {
		writeJSONError(w, "Failed to retrieve updated tags", http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, tags)
}

func sanitizeFilename(s string) string {
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

// marshalAndCompressSessionPackage serializes and compresses an ExportedSessionPackage and builds its canonical filename.
func marshalAndCompressSessionPackage(pkg *storage.ExportedSessionPackage, suffixID int64) (data []byte, filename string, err error) {
	rawJSON, err := json.Marshal(pkg)
	if err != nil {
		return nil, "", fmt.Errorf("failed to marshal session package: %w", err)
	}

	compressed := storage.CompressRaw(rawJSON)

	if suffixID > 0 {
		filename = fmt.Sprintf("%s_%s_%s_%d.f1session",
			sanitizeFilename(pkg.Session.TrackName),
			sanitizeFilename(pkg.Session.SessionType),
			pkg.Session.CreatedAt.Format("2006-01-02"),
			suffixID,
		)
	} else {
		filename = fmt.Sprintf("%s_%s_%s.f1session",
			sanitizeFilename(pkg.Session.TrackName),
			sanitizeFilename(pkg.Session.SessionType),
			pkg.Session.CreatedAt.Format("2006-01-02"),
		)
	}

	return compressed, filename, nil
}

func (s *Server) handleExportSession(w http.ResponseWriter, r *http.Request) {
	sessionIDStr := chi.URLParam(r, "id")
	sessionID, err := strconv.ParseInt(sessionIDStr, 10, 64)
	if err != nil {
		writeJSONError(w, "Invalid session ID", http.StatusBadRequest)
		return
	}

	pkg, err := s.repo.ExportSession(r.Context(), sessionID)
	if err != nil {
		slog.Error("Failed to export session", "sessionID", sessionID, "error", err)
		writeJSONError(w, "Failed to export session", http.StatusInternalServerError)
		return
	}

	compressed, filename, err := marshalAndCompressSessionPackage(pkg, 0)
	if err != nil {
		writeJSONError(w, "Failed to encode session package", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/octet-stream")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%q", filename))
	w.Header().Set("Content-Length", strconv.Itoa(len(compressed)))
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(compressed)
}

// ExportBatchRequest defines the payload for batch session export.
type ExportBatchRequest struct {
	SessionIDs []int64 `json:"session_ids"`
}

func (s *Server) handleExportSessionBatch(w http.ResponseWriter, r *http.Request) {
	var sessionIDs []int64
	if r.Header.Get("Content-Type") == "application/json" {
		var req ExportBatchRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err == nil {
			sessionIDs = req.SessionIDs
		}
	} else if r.URL.Query().Get("ids") != "" {
		parts := strings.Split(r.URL.Query().Get("ids"), ",")
		for _, p := range parts {
			if id, err := strconv.ParseInt(strings.TrimSpace(p), 10, 64); err == nil {
				sessionIDs = append(sessionIDs, id)
			}
		}
	}

	if len(sessionIDs) == 0 {
		writeJSONError(w, "No session IDs provided for export", http.StatusBadRequest)
		return
	}

	var buf bytes.Buffer
	zw := zip.NewWriter(&buf)

	exportedCount := 0
	for _, id := range sessionIDs {
		pkg, err := s.repo.ExportSession(r.Context(), id)
		if err != nil {
			slog.Warn("Failed to export session for batch", "sessionID", id, "error", err)
			continue
		}

		compressed, filename, err := marshalAndCompressSessionPackage(pkg, id)
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
		writeJSONError(w, "Failed to finalize zip archive", http.StatusInternalServerError)
		return
	}

	if exportedCount == 0 {
		writeJSONError(w, "No valid sessions found to export", http.StatusNotFound)
		return
	}

	zipBytes := buf.Bytes()
	filename := fmt.Sprintf("f1_sessions_export_%s.zip", time.Now().Format("2006-01-02"))

	w.Header().Set("Content-Type", "application/zip")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%q", filename))
	w.Header().Set("Content-Length", strconv.Itoa(len(zipBytes)))
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(zipBytes)
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

func parseSessionPackage(data []byte) (*storage.ExportedSessionPackage, error) {
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

func (s *Server) handleImportSession(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, MaxImportPayloadSize)

	type fileItem struct {
		name string
		data []byte
	}
	var items []fileItem

	contentType := r.Header.Get("Content-Type")
	if strings.HasPrefix(contentType, "multipart/form-data") {
		if err := r.ParseMultipartForm(MaxImportPayloadSize); err != nil {
			writeJSONError(w, "Failed to parse multipart form", http.StatusBadRequest)
			return
		}
		if r.MultipartForm != nil && r.MultipartForm.File != nil {
			for _, fileHeaders := range r.MultipartForm.File {
				for _, fh := range fileHeaders {
					file, err := fh.Open()
					if err != nil {
						continue
					}
					data, err := io.ReadAll(file)
					file.Close()
					if err != nil || len(data) == 0 {
						continue
					}
					items = append(items, fileItem{name: fh.Filename, data: data})
				}
			}
		}
	} else {
		data, err := io.ReadAll(r.Body)
		if err != nil {
			writeJSONError(w, "Failed to read request body", http.StatusBadRequest)
			return
		}
		if len(data) > 0 {
			items = append(items, fileItem{name: "upload.f1session", data: data})
		}
	}

	if len(items) == 0 {
		writeJSONError(w, "Empty file payload", http.StatusBadRequest)
		return
	}

	// Expand any ZIP files into individual .f1session items
	var sessionFiles []fileItem
	for _, item := range items {
		if bytes.HasPrefix(item.data, ZipMagicHeader) || strings.HasSuffix(strings.ToLower(item.name), ".zip") {
			zr, err := zip.NewReader(bytes.NewReader(item.data), int64(len(item.data)))
			if err != nil {
				slog.Warn("Failed to open zip archive", "file", item.name, "error", err)
				continue
			}
			for _, zf := range zr.File {
				if zf.FileInfo().IsDir() {
					continue
				}
				if !strings.HasSuffix(strings.ToLower(zf.Name), ".f1session") && !strings.HasSuffix(strings.ToLower(zf.Name), ".json") {
					continue
				}
				rc, err := zf.Open()
				if err != nil {
					continue
				}
				zData, err := io.ReadAll(rc)
				rc.Close()
				if err == nil && len(zData) > 0 {
					sessionFiles = append(sessionFiles, fileItem{name: zf.Name, data: zData})
				}
			}
		} else {
			sessionFiles = append(sessionFiles, item)
		}
	}

	if len(sessionFiles) == 0 {
		writeJSONError(w, "No valid session files found in payload", http.StatusBadRequest)
		return
	}

	resp := ImportBatchResponse{
		Status:     "success",
		Total:      len(sessionFiles),
		SessionIDs: make([]int64, 0),
		Details:    make([]ImportDetail, 0, len(sessionFiles)),
	}

	for _, sf := range sessionFiles {
		pkg, err := parseSessionPackage(sf.data)
		if err != nil {
			resp.Failed++
			resp.Details = append(resp.Details, ImportDetail{
				Filename: sf.name,
				Status:   "failed",
				Reason:   err.Error(),
			})
			continue
		}

		newID, err := s.repo.ImportSession(r.Context(), pkg)
		if err != nil {
			if errors.Is(err, storage.ErrSessionAlreadyExists) {
				resp.Skipped++
				resp.Details = append(resp.Details, ImportDetail{
					Filename:  sf.name,
					Status:    "skipped",
					SessionID: newID,
					Reason:    "Session already exists",
				})
			} else {
				resp.Failed++
				resp.Details = append(resp.Details, ImportDetail{
					Filename: sf.name,
					Status:   "failed",
					Reason:   err.Error(),
				})
			}
			continue
		}

		resp.Imported++
		resp.SessionIDs = append(resp.SessionIDs, newID)
		resp.Details = append(resp.Details, ImportDetail{
			Filename:  sf.name,
			Status:    "imported",
			SessionID: newID,
		})
	}

	if len(resp.SessionIDs) > 0 {
		resp.SessionID = resp.SessionIDs[0]
	}

	statusCode := http.StatusOK
	if resp.Total == 1 && resp.Imported == 1 {
		statusCode = http.StatusCreated
	} else if resp.Imported == 0 && resp.Skipped == 0 {
		statusCode = http.StatusBadRequest
	}
	writeJSON(w, statusCode, resp)
}

// BatchDeleteRequest defines payload for deleting multiple sessions.
type BatchDeleteRequest struct {
	SessionIDs []int64 `json:"session_ids"`
}

func (s *Server) handleBatchDeleteSessions(w http.ResponseWriter, r *http.Request) {
	var req BatchDeleteRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSONError(w, "Invalid request payload", http.StatusBadRequest)
		return
	}

	if len(req.SessionIDs) == 0 {
		writeJSONError(w, "No session IDs specified for deletion", http.StatusBadRequest)
		return
	}

	deletedCount, err := s.repo.DeleteSessions(r.Context(), req.SessionIDs)
	if err != nil {
		slog.Error("Failed to delete sessions batch", "error", err)
		writeJSONError(w, "Failed to delete sessions", http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"status":        "success",
		"deleted_count": deletedCount,
	})
}

// BatchTagsRequest defines payload for assigning a tag to multiple sessions.
type BatchTagsRequest struct {
	SessionIDs []int64 `json:"session_ids"`
	TagID      int64   `json:"tag_id"`
}

func (s *Server) handleBatchAssignTags(w http.ResponseWriter, r *http.Request) {
	var req BatchTagsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSONError(w, "Invalid request payload", http.StatusBadRequest)
		return
	}

	if len(req.SessionIDs) == 0 || req.TagID <= 0 {
		writeJSONError(w, "Session IDs and valid Tag ID are required", http.StatusBadRequest)
		return
	}

	if err := s.repo.AddTagToSessions(r.Context(), req.SessionIDs, req.TagID); err != nil {
		slog.Error("Failed to assign tags to sessions", "tagID", req.TagID, "error", err)
		writeJSONError(w, "Failed to assign tags to sessions", http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"status": "success",
	})
}
