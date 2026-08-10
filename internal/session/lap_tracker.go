package session

import (
	"context"
	"log"

	"github.com/mgauna/f1game-telemetry-go/internal/packets"
	"github.com/mgauna/f1game-telemetry-go/internal/storage"
)

// LapTracker monitors a car's lap progress and collects telemetry samples.
type LapTracker struct {
	repo     *storage.Repository
	carIndex int

	currentLapNum int
	currentLap    *storage.Lap
	samples       []storage.TelemetrySample
}

// NewLapTracker creates a new LapTracker.
func NewLapTracker(repo *storage.Repository, carIndex int) *LapTracker {
	return &LapTracker{
		repo:     repo,
		carIndex: carIndex,
		samples:  make([]storage.TelemetrySample, 0, 10000), // preallocate capacity
	}
}

// Reset clears the lap tracker state for a new session.
func (lt *LapTracker) Reset() {
	lt.currentLapNum = 0
	lt.currentLap = nil
	lt.samples = lt.samples[:0]
}

// ProcessLapData processes the LapData packet to detect lap changes.
func (lt *LapTracker) ProcessLapData(ctx context.Context, session *storage.Session, p *packets.PacketLapData) {
	if session == nil {
		return
	}

	if lt.carIndex >= packets.MaxCars || lt.carIndex >= len(p.LapData) {
		return // invalid index
	}

	lapData := p.LapData[lt.carIndex]
	if lapData.CurrentLapNum == 0 {
		return
	}

	if lt.currentLapNum == 0 {
		lt.startNewLap(ctx, session.ID, int(lapData.CurrentLapNum), lt.carIndex)
		return
	}

	// Lap boundary detection
	if int(lapData.CurrentLapNum) > lt.currentLapNum {
		lt.finalizeCurrentLap(ctx, int(lapData.LastLapTimeInMS))
		lt.startNewLap(ctx, session.ID, int(lapData.CurrentLapNum), lt.carIndex)
	} else if lt.currentLap != nil {
		// Update current lap state (sectors, validity)
		lt.currentLap.Sector1MS = int(lapData.Sector1TimeMSPart)
		lt.currentLap.Sector2MS = int(lapData.Sector2TimeMSPart)
		lt.currentLap.IsValid = lapData.CurrentLapInvalid == 0

		// Periodic save to keep DB updated
		lt.repo.SaveLap(ctx, lt.currentLap)
	}
}

// ProcessTelemetry adds a telemetry sample to the current lap.
func (lt *LapTracker) ProcessTelemetry(ctx context.Context, session *storage.Session, p *packets.PacketCarTelemetryData) {
	if session == nil || lt.currentLap == nil || lt.currentLap.ID == 0 {
		return
	}

	if lt.carIndex >= packets.MaxCars || lt.carIndex >= len(p.CarTelemetryData) {
		return // invalid index
	}

	carData := p.CarTelemetryData[lt.carIndex]

	sample := storage.TelemetrySample{
		LapID:       lt.currentLap.ID,
		LapDistance: 0,
		SessionTime: float64(p.Header.SessionTime),
		Speed:       int(carData.Speed),
		Throttle:    float64(carData.Throttle),
		Brake:       float64(carData.Brake),
		Steer:       float64(carData.Steer),
		Gear:        int(carData.Gear),
		EngineRPM:   int(carData.EngineRPM),
		DRS:         carData.DRS == 1,
		ERSDeploy:   0,
		WorldPosX:   0,
		WorldPosY:   0,
		WorldPosZ:   0,
	}

	lt.samples = append(lt.samples, sample)

	// Batch insert if we have enough samples
	if len(lt.samples) >= 600 { // 10 seconds at 60Hz
		err := lt.repo.SaveTelemetryBatch(ctx, lt.samples)
		if err != nil {
			log.Printf("[LapTracker] Error saving telemetry batch for car %d: %v", lt.carIndex, err)
		}
		lt.samples = lt.samples[:0] // keep capacity
	}
}

func (lt *LapTracker) startNewLap(ctx context.Context, sessionID int64, lapNum int, carIndex int) {
	lt.currentLapNum = lapNum
	lt.currentLap = &storage.Lap{
		SessionID: sessionID,
		LapNumber: lapNum,
		CarIndex:  carIndex,
		IsValid:   true,
	}

	if err := lt.repo.SaveLap(ctx, lt.currentLap); err != nil {
		log.Printf("[LapTracker] Error starting new lap: %v", err)
	}
}

func (lt *LapTracker) finalizeCurrentLap(ctx context.Context, lapTimeMS int) {
	if lt.currentLap == nil {
		return
	}

	lt.currentLap.LapTimeMS = lapTimeMS

	if err := lt.repo.SaveLap(ctx, lt.currentLap); err != nil {
		log.Printf("[LapTracker] Error finalizing lap: %v", err)
	}

	// Flush remaining samples
	if len(lt.samples) > 0 {
		lt.repo.SaveTelemetryBatch(ctx, lt.samples)
		lt.samples = lt.samples[:0]
	}

	log.Printf("[LapTracker] Lap %d completed in %d ms", lt.currentLap.LapNumber, lapTimeMS)
}
