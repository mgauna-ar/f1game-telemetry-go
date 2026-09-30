// Command tsgen writes the frontend's wire types (frontend/src/types/generated) from the Go
// types the server sends as JSON. Run it from the repository root after changing one of them:
//
//	go run ./cmd/tsgen
//
// With -check it writes nothing and fails when the generated files are out of date (CI runs it).
package main

import (
	"bytes"
	"errors"
	"flag"
	"fmt"
	"maps"
	"os"
	"path/filepath"
	"slices"
	"strings"

	"github.com/mgauna/f1game-telemetry-go/internal/ai"
	"github.com/mgauna/f1game-telemetry-go/internal/analytics"
	"github.com/mgauna/f1game-telemetry-go/internal/api"
	"github.com/mgauna/f1game-telemetry-go/internal/engineer"
	"github.com/mgauna/f1game-telemetry-go/internal/packets"
	"github.com/mgauna/f1game-telemetry-go/internal/session"
	"github.com/mgauna/f1game-telemetry-go/internal/settings"
	"github.com/mgauna/f1game-telemetry-go/internal/storage"
	"github.com/mgauna/f1game-telemetry-go/internal/system"
	"github.com/mgauna/f1game-telemetry-go/internal/tsgen"
)

// defaultOutDir is the generated types folder, relative to the repository root.
const defaultOutDir = "frontend/src/types/generated"

// registry lists every Go type the frontend reads, grouped by area. The types they reference
// are generated too.
func registry() *tsgen.Generator {
	g := tsgen.New()

	// Types with their own MarshalJSON: a sample value that writes the optional properties, and
	// the type whose fields describe the JSON. TestMarshalerKeys checks one against the other.
	g.Marshaler(storage.Session{PlayerCarIndex: new(int), PlayerCarSource: new(string)}, storage.Session{}) // weather_forecast is raw JSON (tstype tag)
	g.Marshaler(packets.PacketHeader{SessionUID: 1}, packets.PacketHeader{})                                // SessionUID is hex (tstype tag)
	// the session's JSON with the summary added
	g.Marshaler(analytics.SessionListItem{Session: storage.Session{PlayerCarIndex: new(int), PlayerCarSource: new(string)}}, analytics.SessionListItem{})

	// Sessions, laps, participants and tags.
	g.Add(
		storage.Session{},
		storage.Lap{},
		storage.Participant{},
		storage.Tag{},
		packets.WeatherForecastSample{},
	)
	g.TypeAlias("storage", "PlayerCarSource", stringUnion(storage.PlayerCarSources))

	// Picking the player's car: PUT /api/sessions/{id}/player and POST /api/sessions/batch-player.
	g.Add(
		api.SetPlayerCarRequest{},
		api.BatchPlayerRequest{},
		storage.BatchPlayerResult{},
	)

	// GET /api/sessions: each session with a summary of its result and the player's line.
	g.Add(analytics.SessionListItem{})
	g.TypeAlias("analytics", "PlayerSource", stringUnion(analytics.PlayerSources))

	// GET /api/progress: the player's sessions at a track.
	g.Add(analytics.TrackProgressResponse{})

	// Session detail: classification, progression and stints plus the session's participants and laps.
	g.Add(analytics.SessionDetailResponse{})
	g.TypeAlias("analytics", "ProgressionRow",
		"{ lapNumber: number; [key: string]: number | string | boolean | null | undefined }")
	g.TypeAlias("analytics", "DegradationRow",
		"{ tyreAge: number; [key: string]: number | string | undefined }")

	// Settings shared by every device, including the race engineer setup.
	g.Add(
		api.AISettingsResponse{},
		settings.AIUpdate{},
		api.VoiceSettingsResponse{},
		api.PTTSettingsResponse{},
		api.PTTConfigResponse{},
		api.EngineerSettingsResponse{},
		settings.Engineer{},
	)
	// The radio settings panel's switch names; the server derives the engine's categories from them.
	g.TypeAlias("engineer", "EngineerAlertSwitch", stringUnion(engineer.AlertSwitchKeys))

	// The other REST responses.
	g.Add(
		api.ErrorResponse{},
		api.StatusResponse{},
		api.BatchDeleteResponse{},
		session.ImportBatchResponse{},
		analytics.ComparatorResponse{},
		ai.AIFetchModelsResponse{},
		ai.AIErrorPayload{},
		ai.AIChatRequest{},
		system.AppVersion{},
		system.UpdateCheckResponse{},
		system.TelemetryEndpoint{},
		api.SystemStatus{},
		api.LiveCarLaps{},
	)

	// An AI chat request names what it is about; the server builds the prompt data.
	g.TypeAlias("ai", "ChatContextMode", stringUnion(ai.ChatContextModes))

	// Messages on /ws/engineer, told apart by their type.
	g.Add(
		engineer.EngineerDirective{},
		api.PTTEventMessage{},
		api.PTTLearnedMessage{},
		api.PTTLearnTimeoutMessage{},
		api.SettingsChangedMessage{},
	)
	g.Union("api", "EngineerSocketMessage",
		engineer.EngineerDirective{},
		api.PTTEventMessage{},
		api.PTTLearnedMessage{},
		api.PTTLearnTimeoutMessage{},
		api.SettingsChangedMessage{},
	)
	g.TypeAlias("api", "SettingsSection", stringUnion(settings.Sections))
	// A directive carries its alert key, not text; the dashboard picks the words from it.
	g.TypeAlias("engineer", "EngineerAlertKey", stringUnion(engineer.RadioAlertKeys))
	g.TypeAlias("engineer", "EngineerDirectiveCategory", stringUnion(directiveCategories()))
	g.TypeAlias("engineer", "EngineerUrgency", stringUnion(engineer.Urgencies))

	// The 10Hz live snapshot on /ws: the slim per-car and session DTOs, and the race feed rows
	// the server adds to it (event codes and parameters, no text).
	g.Add(
		session.LiveSnapshot{},
	)
	g.TypeAlias("session", "FeedEventCode", stringUnion(session.FeedEventCodes))
	g.TypeAlias("session", "FeedEventType", stringUnion(session.FeedEventTypes))
	g.TypeAlias("session", "FeedSeverity", stringUnion(session.FeedSeverities))

	return g
}

func directiveCategories() []string {
	values := make([]string, len(engineer.DirectiveCategories))
	for i, c := range engineer.DirectiveCategories {
		values[i] = string(c)
	}
	return values
}

// stringUnion writes a TypeScript union of string literals, e.g. 'a' | 'b'.
func stringUnion(values []string) string {
	quoted := make([]string, len(values))
	for i, v := range values {
		quoted[i] = "'" + v + "'"
	}
	return strings.Join(quoted, " | ")
}

func main() {
	out := flag.String("out", defaultOutDir, "folder to write the generated TypeScript files to")
	check := flag.Bool("check", false, "fail if the generated files are out of date instead of writing them")
	flag.Parse()

	if err := run(*out, *check); err != nil {
		fmt.Fprintln(os.Stderr, "tsgen:", err)
		os.Exit(1)
	}
}

func run(dir string, check bool) error {
	files, err := registry().Generate()
	if err != nil {
		return err
	}
	stale, extra, err := staleFiles(dir, files)
	if err != nil {
		return err
	}
	if check {
		if len(stale)+len(extra) > 0 {
			return fmt.Errorf("generated TypeScript wire types in %s are out of date (%s); run go run ./cmd/tsgen",
				dir, strings.Join(slices.Concat(stale, extra), ", "))
		}
		return nil
	}
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return err
	}
	for _, name := range stale {
		if err := os.WriteFile(filepath.Join(dir, name), files[name], 0o644); err != nil {
			return err
		}
	}
	for _, name := range extra {
		if err := os.Remove(filepath.Join(dir, name)); err != nil {
			return err
		}
	}
	return nil
}

// staleFiles returns the generated files whose content on disk differs or is missing, and the
// .ts files in dir the generator no longer writes.
func staleFiles(dir string, files map[string][]byte) (stale, extra []string, err error) {
	for _, name := range slices.Sorted(maps.Keys(files)) {
		current, err := os.ReadFile(filepath.Join(dir, name))
		if err != nil && !errors.Is(err, os.ErrNotExist) {
			return nil, nil, err
		}
		if !bytes.Equal(current, files[name]) {
			stale = append(stale, name)
		}
	}
	entries, err := os.ReadDir(dir)
	if err != nil && !errors.Is(err, os.ErrNotExist) {
		return nil, nil, err
	}
	for _, e := range entries {
		if _, ok := files[e.Name()]; !ok && strings.HasSuffix(e.Name(), ".ts") {
			extra = append(extra, e.Name())
		}
	}
	return stale, extra, nil
}
