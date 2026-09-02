package api

import (
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
	"github.com/mgauna/f1game-telemetry-go/internal/session"
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

func parseSessionID(w http.ResponseWriter, r *http.Request) (int64, bool) {
	return parseURLID(w, r, "id", "Invalid session ID")
}

func parseURLID(w http.ResponseWriter, r *http.Request, param, errMsg string) (int64, bool) {
	idStr := chi.URLParam(r, param)
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		writeJSONError(w, errMsg, http.StatusBadRequest)
		return 0, false
	}
	return id, true
}

func (s *Server) handleGetSessions(w http.ResponseWriter, r *http.Request) {
	sessions, err := s.repo.GetSessions(r.Context())
	if err != nil {
		writeJSONError(w, "Failed to get sessions", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, sessions)
}

func (s *Server) handleDeleteSession(w http.ResponseWriter, r *http.Request) {
	sessionID, ok := parseSessionID(w, r)
	if !ok {
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
	sessionID, ok := parseSessionID(w, r)
	if !ok {
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
	sessionID, ok := parseSessionID(w, r)
	if !ok {
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
	lapID, ok := parseURLID(w, r, "id", "Invalid lap ID")
	if !ok {
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
	tagID, ok := parseURLID(w, r, "id", "Invalid tag ID")
	if !ok {
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
	tagID, ok := parseURLID(w, r, "id", "Invalid tag ID")
	if !ok {
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
	sessionID, ok := parseSessionID(w, r)
	if !ok {
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
	sessionID, ok := parseSessionID(w, r)
	if !ok {
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
	sessionID, ok := parseSessionID(w, r)
	if !ok {
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
	sessionID, ok := parseSessionID(w, r)
	if !ok {
		return
	}

	tagID, ok := parseURLID(w, r, "tagId", "Invalid tag ID")
	if !ok {
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

func (s *Server) handleExportSession(w http.ResponseWriter, r *http.Request) {
	sessionID, ok := parseSessionID(w, r)
	if !ok {
		return
	}

	pkg, err := s.repo.ExportSession(r.Context(), sessionID)
	if err != nil {
		slog.Error("Failed to export session", "sessionID", sessionID, "error", err)
		writeJSONError(w, "Failed to export session", http.StatusInternalServerError)
		return
	}

	compressed, filename, err := session.MarshalAndCompressSessionPackage(pkg, 0)
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
	exportedCount, err := session.ExportSessionBatchToZip(r.Context(), s.repo, sessionIDs, &buf)
	if err != nil {
		if exportedCount == 0 {
			writeJSONError(w, "No valid sessions found to export", http.StatusNotFound)
			return
		}
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

func parseUploadedFiles(r *http.Request) ([]session.FileItem, error) {
	var items []session.FileItem
	contentType := r.Header.Get("Content-Type")
	if strings.HasPrefix(contentType, "multipart/form-data") {
		if err := r.ParseMultipartForm(MaxImportPayloadSize); err != nil {
			return nil, fmt.Errorf("failed to parse multipart form: %w", err)
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
					items = append(items, session.FileItem{Name: fh.Filename, Data: data})
				}
			}
		}
	} else {
		data, err := io.ReadAll(r.Body)
		if err != nil {
			return nil, fmt.Errorf("failed to read request body: %w", err)
		}
		if len(data) > 0 {
			items = append(items, session.FileItem{Name: "upload.f1session", Data: data})
		}
	}
	return items, nil
}

func (s *Server) handleImportSession(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, MaxImportPayloadSize)

	items, err := parseUploadedFiles(r)
	if err != nil {
		writeJSONError(w, err.Error(), http.StatusBadRequest)
		return
	}

	if len(items) == 0 {
		writeJSONError(w, "Empty file payload", http.StatusBadRequest)
		return
	}

	sessionFiles := session.ExpandZipFiles(items)
	if len(sessionFiles) == 0 {
		writeJSONError(w, "No valid session files found in payload", http.StatusBadRequest)
		return
	}

	resp := session.ImportSessionFiles(r.Context(), s.repo, sessionFiles)

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
