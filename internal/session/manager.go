package session

import (
	"context"
	"log"

	"github.com/mgauna/f1game-telemetry-go/internal/packets"
	"github.com/mgauna/f1game-telemetry-go/internal/storage"
)

// SessionManager orchestrates the processing of F1 telemetry packets.
// It detects new sessions and routes lap and telemetry data to LapTrackers for all active cars.
type SessionManager struct {
	repo          *storage.Repository
	lapTrackers   map[int]*LapTracker
	numActiveCars int

	currentSessionUID uint64
	currentSession    *storage.Session
}

// NewSessionManager creates a new SessionManager.
func NewSessionManager(repo *storage.Repository) *SessionManager {
	trackers := make(map[int]*LapTracker)
	for i := 0; i < packets.MaxCars; i++ {
		trackers[i] = NewLapTracker(repo, i)
	}
	return &SessionManager{
		repo:          repo,
		lapTrackers:   trackers,
		numActiveCars: packets.MaxCars,
	}
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

	maxCars := sm.numActiveCars
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
	case *packets.PacketParticipantsData:
		sm.handleParticipantsData(ctx, p)
	case *packets.PacketCarSetupData:
		sm.handleCarSetupData(ctx, p)
	}
}

func (sm *SessionManager) handleCarSetupData(ctx context.Context, p *packets.PacketCarSetupData) {
	if sm.currentSession == nil {
		return
	}

	maxCars := sm.numActiveCars
	if maxCars <= 0 || maxCars > packets.MaxCars {
		maxCars = packets.MaxCars
	}

	setups := make([]storage.CarSetup, 0, maxCars)
	for i := 0; i < maxCars; i++ {
		cs := p.CarSetupData[i]
		setups = append(setups, storage.CarSetup{
			CarIndex:              i,
			FrontWing:             int(cs.FrontWing),
			RearWing:              int(cs.RearWing),
			OnThrottle:            int(cs.OnThrottle),
			OffThrottle:           int(cs.OffThrottle),
			FrontCamber:           float64(cs.FrontCamber),
			RearCamber:            float64(cs.RearCamber),
			FrontToe:              float64(cs.FrontToe),
			RearToe:               float64(cs.RearToe),
			FrontSuspension:       int(cs.FrontSuspension),
			RearSuspension:        int(cs.RearSuspension),
			FrontAntiRollBar:      int(cs.FrontAntiRollBar),
			RearAntiRollBar:       int(cs.RearAntiRollBar),
			FrontSuspensionHeight: int(cs.FrontSuspensionHeight),
			RearSuspensionHeight:  int(cs.RearSuspensionHeight),
			BrakePressure:         int(cs.BrakePressure),
			BrakeBias:             int(cs.BrakeBias),
			FrontTyrePressure:     float64(cs.FrontLeftTyrePressure),
			RearTyrePressure:      float64(cs.RearLeftTyrePressure),
			Ballast:               int(cs.Ballast),
			FuelLoad:              float64(cs.FuelLoad),
		})
	}

	if err := sm.repo.SaveCarSetups(ctx, sm.currentSession.ID, setups); err != nil {
		log.Printf("[Session] Error saving car setups: %v", err)
	}
}

func (sm *SessionManager) handleNewSession(ctx context.Context, header packets.PacketHeader) {
	log.Printf("[Session] New session detected: %d", header.SessionUID)

	// Finalize old session's lap trackers if needed
	for _, tracker := range sm.lapTrackers {
		tracker.Reset()
	}

	sm.currentSessionUID = header.SessionUID

	// Create a new session in storage
	sm.currentSession = &storage.Session{
		SessionUID:   int64(header.SessionUID),
		PacketFormat: int(header.PacketFormat),
		TrackID:      -1,
		TrackName:    "Unknown",
		SessionType:  "Unknown",
		Weather:      "Unknown",
	}

	if err := sm.repo.SaveSession(ctx, sm.currentSession); err != nil {
		log.Printf("[Session] Error saving new session: %v", err)
	}
}

func (sm *SessionManager) updateSessionInfo(ctx context.Context, p *packets.PacketSessionData) {
	if sm.currentSession == nil || uint64(sm.currentSession.SessionUID) != p.Header.SessionUID {
		return
	}

	updated := false
	weatherStr := packets.WeatherName(p.Weather)
	if sm.currentSession.TrackID != int(p.TrackId) || sm.currentSession.SessionType == "Unknown" || sm.currentSession.Weather != weatherStr {
		sm.currentSession.TrackID = int(p.TrackId)
		sm.currentSession.TrackName = packets.TrackName(p.TrackId)
		sm.currentSession.SessionType = packets.SessionTypeName(p.SessionType)
		sm.currentSession.Weather = weatherStr
		updated = true
	}

	if updated {
		if err := sm.repo.SaveSession(ctx, sm.currentSession); err != nil {
			log.Printf("[Session] Error updating session info: %v", err)
		}
	}
}

func (sm *SessionManager) handleParticipantsData(ctx context.Context, p *packets.PacketParticipantsData) {
	if sm.currentSession == nil {
		return
	}

	numActive := int(p.NumActiveCars)
	if numActive <= 0 || numActive > packets.MaxCars {
		numActive = packets.MaxCars
	}
	sm.numActiveCars = numActive

	participants := make([]storage.Participant, 0, numActive)
	for i := 0; i < numActive; i++ {
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
		log.Printf("[Session] Error saving participants: %v", err)
	}
}
