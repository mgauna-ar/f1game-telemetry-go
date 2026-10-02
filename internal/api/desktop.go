package api

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/mgauna/f1game-telemetry-go/internal/desktop"
)

// DesktopApp is the app on the PC it runs on (desktop.App): its small window's settings, starting
// at sign-in, and quitting.
type DesktopApp interface {
	State(ctx context.Context) (desktop.DesktopState, error)
	Update(ctx context.Context, u desktop.DesktopUpdate) (desktop.DesktopState, error)
	OpenDashboard() error
	Quit()
}

// SetDesktopApp attaches the desktop app behind /api/desktop. Call it before serving.
func (s *Server) SetDesktopApp(app DesktopApp) {
	s.desktopApp = app
}

// setupDesktopRoutes adds /api/desktop, for the app window (the /desktop page). Only the PC the
// app runs on may use it: a phone or tablet on the network can't quit the app or change how it starts.
func (s *Server) setupDesktopRoutes(r chi.Router) {
	r.Group(func(r chi.Router) {
		r.Use(loopbackOnly, s.requireDesktopApp)
		r.Get("/desktop", s.handleGetDesktop)
		r.Put("/desktop", s.handlePutDesktop)
		r.Post("/desktop/open-dashboard", s.handleDesktopOpenDashboard)
		r.Post("/desktop/quit", s.handleDesktopQuit)
	})
}

// loopbackOnly answers 403 to requests that don't come from this PC.
func loopbackOnly(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		host, _, err := net.SplitHostPort(r.RemoteAddr)
		if ip := net.ParseIP(host); err != nil || ip == nil || !ip.IsLoopback() {
			writeJSONError(w, "only available on the PC the app runs on", http.StatusForbidden)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (s *Server) requireDesktopApp(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if s.desktopApp == nil {
			writeJSONError(w, "desktop app not available", http.StatusNotFound)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (s *Server) handleGetDesktop(w http.ResponseWriter, r *http.Request) {
	state, err := s.desktopApp.State(r.Context())
	if err != nil {
		slog.Error("Failed to read the desktop settings", "error", err)
		writeJSONError(w, "failed to read the desktop settings", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, state)
}

func (s *Server) handlePutDesktop(w http.ResponseWriter, r *http.Request) {
	var update desktop.DesktopUpdate
	if err := json.NewDecoder(r.Body).Decode(&update); err != nil {
		writeJSONError(w, fmt.Sprintf("invalid desktop settings payload: %v", err), http.StatusBadRequest)
		return
	}
	state, err := s.desktopApp.Update(r.Context(), update)
	switch {
	case errors.Is(err, desktop.ErrStartWithOSUnavailable):
		writeJSONError(w, err.Error(), http.StatusBadRequest)
	case err != nil:
		slog.Error("Failed to save the desktop settings", "error", err)
		writeJSONError(w, fmt.Sprintf("failed to save the desktop settings: %v", err), http.StatusInternalServerError)
	default:
		writeJSON(w, http.StatusOK, state)
	}
}

func (s *Server) handleDesktopOpenDashboard(w http.ResponseWriter, r *http.Request) {
	if err := s.desktopApp.OpenDashboard(); err != nil {
		slog.Warn("Could not open the dashboard", "error", err)
		writeJSONError(w, "could not open the browser", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, StatusResponse{Status: StatusSuccess})
}

// handleDesktopQuit answers first, then stops the app; the graceful shutdown lets this response finish.
func (s *Server) handleDesktopQuit(w http.ResponseWriter, r *http.Request) {
	slog.Info("Quit requested from the app window")
	writeJSON(w, http.StatusAccepted, StatusResponse{Status: StatusSuccess})
	go s.desktopApp.Quit()
}
