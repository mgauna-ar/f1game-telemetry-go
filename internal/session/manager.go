package session

import (
	"context"
	"encoding/json"
	"log/slog"
	"strings"
	"sync"

	"github.com/mgauna/f1game-telemetry-go/internal/packets"
	"github.com/mgauna/f1game-telemetry-go/internal/storage"
)

// SessionManager orchestrates the processing of F1 telemetry packets.
// It detects new sessions and routes lap and telemetry data to LapTrackers for all active cars.
type SessionManager struct {
	repo          storage.Repository
	batchWriter   *TelemetryBatchWriter
	lapTrackers   map[int]*LapTracker
	numActiveCars int

	currentSessionUID uint64
	currentSession    *storage.Session
	closeOnce         sync.Once
}

// NewSessionManager creates a new SessionManager.
func NewSessionManager(repo storage.Repository) *SessionManager {
	bw := NewTelemetryBatchWriter(repo)
	trackers := make(map[int]*LapTracker)
	for i := 0; i < packets.MaxCars; i++ {
		trackers[i] = NewLapTracker(repo, bw, i)
	}
	return &SessionManager{
		repo:          repo,
		batchWriter:   bw,
		lapTrackers:   trackers,
		numActiveCars: 0,
	}
}

// Start launches background workers for the session manager.
func (sm *SessionManager) Start(ctx context.Context) {
	if sm.batchWriter != nil {
		sm.batchWriter.Start(ctx)
	}
}

// Close gracefully flushes all remaining data and shuts down workers.
func (sm *SessionManager) Close(ctx context.Context) {
	sm.closeOnce.Do(func() {
		for _, tracker := range sm.lapTrackers {
			tracker.FlushCurrentLap()
		}
		if sm.batchWriter != nil {
			sm.batchWriter.Close(ctx)
		}
	})
}

// ProcessPacket receives a decoded packet and processes it.
func (sm *SessionManager) ProcessPacket(ctx context.Context, pkt packets.Packet) {
	header := pkt.GetHeader()

	if header.SessionUID == 0 {
		return
	}

	// 1. Session Detection
	if sm.currentSessionUID != header.SessionUID {
		sm.handleNewSession(ctx, header)
	}

	maxCars := packets.MaxCarsForFormat(header.PacketFormat)
	if maxCars <= 0 || maxCars > packets.MaxCars {
		maxCars = packets.MaxCars
	}

	// 2. Dispatch packet based on type
	switch p := pkt.(type) {
	case *packets.PacketSessionData:
		sm.updateSessionInfo(ctx, p)
	case *packets.PacketMotionData:
		for i := 0; i < maxCars; i++ {
			if tracker, ok := sm.lapTrackers[i]; ok {
				tracker.ProcessMotion(p)
			}
		}
	case *packets.PacketCarStatusData:
		for i := 0; i < maxCars; i++ {
			if tracker, ok := sm.lapTrackers[i]; ok {
				tracker.ProcessCarStatus(p)
			}
		}
	case *packets.PacketLapData:
		for i := 0; i < maxCars; i++ {
			if tracker, ok := sm.lapTrackers[i]; ok {
				tracker.ProcessLapData(ctx, sm.currentSession, p)
			}
		}
	case *packets.PacketCarTelemetryData:
		for i := 0; i < maxCars; i++ {
			if tracker, ok := sm.lapTrackers[i]; ok {
				tracker.ProcessTelemetry(ctx, sm.currentSession, p)
			}
		}
	case *packets.PacketCarTelemetry2Data:
		for i := 0; i < maxCars; i++ {
			if tracker, ok := sm.lapTrackers[i]; ok {
				tracker.ProcessCarTelemetry2(p)
			}
		}
	case *packets.PacketParticipantsData:
		sm.handleParticipantsData(ctx, p)
	case *packets.PacketSessionHistoryData:
		if tracker, ok := sm.lapTrackers[int(p.CarIdx)]; ok {
			tracker.ProcessSessionHistory(ctx, sm.currentSession, p)
		}
	case *packets.PacketTyreSetsData:
		if tracker, ok := sm.lapTrackers[int(p.CarIdx)]; ok {
			tracker.ProcessTyreSets(p)
		}
	case *packets.PacketFinalClassificationData:
		sm.handleFinalClassification(ctx, p)
	}
}

func (sm *SessionManager) handleNewSession(ctx context.Context, header packets.PacketHeader) {
	uidHex := storage.FormatSessionUID(header.SessionUID)
	slog.Info("New session detected", "sessionUID", uidHex, "rawUID", header.SessionUID, "packetFormat", header.PacketFormat)

	// Flush in-flight samples from the previous session
	if sm.batchWriter != nil {
		sm.batchWriter.Flush(ctx)
	}

	// Finalize old session's lap trackers if needed
	for _, tracker := range sm.lapTrackers {
		tracker.Reset()
	}

	sm.currentSessionUID = header.SessionUID
	sm.numActiveCars = 0

	// Create a new session in storage
	sm.currentSession = &storage.Session{
		SessionUID:      uidHex,
		PacketFormat:    int(header.PacketFormat),
		TrackID:         packets.UnknownTrackID,
		TrackName:       "Unknown",
		SessionType:     "Unknown",
		Weather:         "Unknown",
		WeatherForecast: "",
		TotalLaps:       0,
		AIDifficulty:    0,
		SessionDuration: 0,
	}

	if err := sm.repo.SaveSession(ctx, sm.currentSession); err != nil {
		slog.Error("Failed to save new session", "sessionUID", uidHex, "error", err)
	}
}

func (sm *SessionManager) updateSessionInfo(ctx context.Context, p *packets.PacketSessionData) {
	trackName := packets.TrackName(p.TrackId)
	sessionType := packets.SessionTypeName(p.SessionType)
	weatherStr := packets.WeatherName(p.Weather)
	totalLaps := int(p.TotalLaps)
	aiDifficulty := int(p.AIDifficulty)
	sessionDuration := int(p.SessionDuration)
	uidHex := storage.FormatSessionUID(p.Header.SessionUID)

	var forecastJSON string
	numSamples := int(p.NumWeatherForecastSamples)
	if numSamples > len(p.WeatherForecastSamples) {
		numSamples = len(p.WeatherForecastSamples)
	}
	if numSamples > 0 {
		samples := make([]packets.WeatherForecastSample, 0, numSamples)
		for i := 0; i < numSamples; i++ {
			samples = append(samples, p.WeatherForecastSamples[i])
		}
		if b, err := json.Marshal(samples); err == nil {
			forecastJSON = string(b)
		}
	}

	if sm.currentSession != nil && sm.currentSession.SessionUID == uidHex {
		sm.currentSession.TrackID = int(p.TrackId)
		sm.currentSession.TrackName = trackName
		sm.currentSession.SessionType = sessionType
		if sm.currentSession.Weather == "" || sm.currentSession.Weather == "Unknown" {
			sm.currentSession.Weather = weatherStr
		}
		if forecastJSON != "" {
			sm.currentSession.WeatherForecast = forecastJSON
		}
		if totalLaps > 0 {
			sm.currentSession.TotalLaps = totalLaps
		}
		if aiDifficulty > 0 {
			sm.currentSession.AIDifficulty = aiDifficulty
		}
		if sessionDuration > 0 {
			sm.currentSession.SessionDuration = sessionDuration
		}
	}

	if err := sm.repo.UpdateSessionMetadata(ctx, uidHex, int(p.TrackId), trackName, sessionType, weatherStr, forecastJSON, totalLaps, aiDifficulty, sessionDuration); err != nil {
		slog.Error("Failed to update session metadata", "sessionUID", uidHex, "error", err)
	}
}

func (sm *SessionManager) handleParticipantsData(ctx context.Context, p *packets.PacketParticipantsData) {
	if sm.currentSession == nil {
		return
	}

	maxCars := packets.MaxCarsForFormat(p.Header.PacketFormat)
	lastValid := 0
	for i := 0; i < maxCars && i < len(p.Participants); i++ {
		pd := p.Participants[i]
		if pd.NameString() != "" || pd.RaceNumber > 0 || (pd.DriverId != packets.InvalidDriverID && pd.DriverId > 0) {
			lastValid = i + 1
		}
	}

	numActive := int(p.NumActiveCars)
	if lastValid > numActive {
		numActive = lastValid
	}
	if numActive <= 0 {
		numActive = lastValid
	}
	if numActive > maxCars {
		numActive = maxCars
	}
	if sm.numActiveCars == 0 || numActive > sm.numActiveCars {
		sm.numActiveCars = numActive
	}

	saveCount := sm.numActiveCars
	if saveCount <= 0 {
		saveCount = numActive
	}
	if saveCount <= 0 || saveCount > maxCars {
		saveCount = maxCars
	}

	participants := make([]storage.Participant, 0, saveCount)
	for i := 0; i < saveCount; i++ {
		pd := p.Participants[i]
		participants = append(participants, storage.Participant{
			CarIndex:     i,
			Name:         pd.NameString(),
			DriverID:     int(pd.DriverId),
			TeamID:       int(pd.TeamId),
			RaceNumber:   int(pd.RaceNumber),
			AIControlled: pd.AIControlled == 1,
			Nationality:  int(pd.Nationality),
		})
	}

	if err := sm.repo.SaveParticipants(ctx, sm.currentSession.ID, participants); err != nil {
		slog.Error("Failed to save participants", "sessionID", sm.currentSession.ID, "error", err)
	}
}

func (sm *SessionManager) handleFinalClassification(ctx context.Context, p *packets.PacketFinalClassificationData) {
	if sm.currentSession == nil || p == nil {
		return
	}

	maxCars := packets.MaxCarsForFormat(p.Header.PacketFormat)
	if maxCars <= 0 || maxCars > packets.MaxCars {
		maxCars = packets.MaxCars
	}

	participantsToUpdate := make([]storage.Participant, 0, maxCars)

	for i := 0; i < maxCars && i < int(p.NumCars) && i < len(p.ClassificationData); i++ {
		cls := p.ClassificationData[i]
		if cls.NumLaps == 0 && cls.ResultStatus == packets.ResultStatusInactive {
			continue
		}

		participantsToUpdate = append(participantsToUpdate, storage.Participant{
			SessionID:     sm.currentSession.ID,
			CarIndex:      i,
			GridPosition:  int(cls.GridPosition),
			Position:      int(cls.Position),
			Points:        int(cls.Points),
			TotalRaceTime: cls.TotalRaceTime,
			PenaltiesTime: int(cls.PenaltiesTime),
			NumPenalties:  int(cls.NumPenalties),
			ResultReason:  int(cls.ResultReason),
			NumPitStops:   int(cls.NumPitStops),
			ResultStatus:  int(cls.ResultStatus),
		})

		numStints := int(cls.NumTyreStints)
		if numStints > packets.MaxTyreStints {
			numStints = packets.MaxTyreStints
		}

		if numStints > 0 {
			for s := 0; s < numStints; s++ {
				stintNum := s + 1
				stintStartLap := 1
				if s > 0 {
					prevEnd := int(cls.TyreStintsEndLaps[s-1])
					if prevEnd > 0 && prevEnd != 255 {
						stintStartLap = prevEnd + 1
					} else {
						stintStartLap = s + 1
					}
				}
				stintEndLap := int(cls.TyreStintsEndLaps[s])
				if stintEndLap == 255 || stintEndLap == 0 {
					if s == numStints-1 {
						stintEndLap = packets.MaxSessionLapsSanity
					} else {
						stintEndLap = stintStartLap
					}
				}
				compName := packets.VisualTyreCompoundName(cls.TyreStintsVisual[s])
				actualCompName := packets.ActualTyreCompoundName(cls.TyreStintsActual[s])

				for lapNum := stintStartLap; lapNum <= stintEndLap && lapNum <= int(cls.NumLaps); lapNum++ {
					lap := &storage.Lap{
						SessionID:        sm.currentSession.ID,
						CarIndex:         i,
						LapNumber:        lapNum,
						Stint:            stintNum,
						TyreCompound:     compName,
						ActualCompound:   actualCompName,
						ResultStatus:     int(cls.ResultStatus),
						PenaltiesSeconds: int(cls.PenaltiesTime),
					}
					_ = sm.repo.SaveLap(ctx, lap, true)
				}
			}
		}
		if isRaceSessionType(sm.currentSession.SessionType) && cls.Position == 1 && cls.TotalRaceTime > 0 {
			sm.currentSession.SessionDuration = int(cls.TotalRaceTime)
		}
	}

	if len(participantsToUpdate) > 0 {
		_ = sm.repo.SaveParticipants(ctx, sm.currentSession.ID, participantsToUpdate)
	}

	if sm.currentSession.SessionDuration > 0 {
		_ = sm.repo.UpdateSessionMetadata(ctx, sm.currentSession.SessionUID, sm.currentSession.TrackID, sm.currentSession.TrackName, sm.currentSession.SessionType, sm.currentSession.Weather, sm.currentSession.WeatherForecast, sm.currentSession.TotalLaps, sm.currentSession.AIDifficulty, sm.currentSession.SessionDuration)
	}
}

func isRaceSessionType(sessionType string) bool {
	lower := strings.ToLower(sessionType)
	if strings.Contains(lower, "qualifying") || strings.Contains(lower, "practice") || strings.Contains(lower, "shootout") || strings.Contains(lower, "time trial") {
		return false
	}
	return strings.Contains(lower, "race")
}
