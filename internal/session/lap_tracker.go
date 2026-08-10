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

	currentLapNum   int
	currentLap      *storage.Lap
	lastLapDistance float64
	lastWorldPosX   float64
	lastWorldPosY   float64
	lastWorldPosZ   float64
	lastERSDeploy   float64
	samples         []storage.TelemetrySample
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
	lt.lastLapDistance = 0
	lt.lastWorldPosX = 0
	lt.lastWorldPosY = 0
	lt.lastWorldPosZ = 0
	lt.lastERSDeploy = 0
	lt.samples = lt.samples[:0]
}

// ProcessMotion updates the latest 3D world position coordinates for the car.
func (lt *LapTracker) ProcessMotion(p *packets.PacketMotionData) {
	if lt.carIndex >= packets.MaxCars || lt.carIndex >= len(p.CarMotionData) {
		return
	}
	motion := p.CarMotionData[lt.carIndex]
	lt.lastWorldPosX = float64(motion.WorldPositionX)
	lt.lastWorldPosY = float64(motion.WorldPositionY)
	lt.lastWorldPosZ = float64(motion.WorldPositionZ)
}

// ProcessCarStatus updates fuel load and ERS status.
func (lt *LapTracker) ProcessCarStatus(p *packets.PacketCarStatusData) {
	if lt.carIndex >= packets.MaxCars || lt.carIndex >= len(p.CarStatusData) {
		return
	}
	cs := p.CarStatusData[lt.carIndex]
	lt.lastERSDeploy = float64(cs.ERSDeployedThisLap)

	if lt.currentLap != nil {
		lt.currentLap.FuelLoad = float64(cs.FuelInTank)
	}
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

	lt.lastLapDistance = float64(lapData.LapDistance)

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
		s1 := int(lapData.Sector1TimeMSPart) + int(lapData.Sector1TimeMinutesPart)*60000
		s2 := int(lapData.Sector2TimeMSPart) + int(lapData.Sector2TimeMinutesPart)*60000
		if s1 > 0 {
			lt.currentLap.Sector1MS = s1
		}
		if s2 > 0 {
			lt.currentLap.Sector2MS = s2
		}
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

	speedKMH := float64(carData.Speed)
	if speedKMH > lt.currentLap.MaxSpeedKMH {
		lt.currentLap.MaxSpeedKMH = speedKMH
	}

	sample := storage.TelemetrySample{
		LapID:       lt.currentLap.ID,
		LapDistance: lt.lastLapDistance,
		SessionTime: float64(p.Header.SessionTime),
		Speed:       int(carData.Speed),
		Throttle:    float64(carData.Throttle),
		Brake:       float64(carData.Brake),
		Steer:       float64(carData.Steer),
		Gear:        int(carData.Gear),
		EngineRPM:   int(carData.EngineRPM),
		DRS:         carData.DRS == 1,
		ERSDeploy:   lt.lastERSDeploy,
		WorldPosX:   lt.lastWorldPosX,
		WorldPosY:   lt.lastWorldPosY,
		WorldPosZ:   lt.lastWorldPosZ,
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

	if lapTimeMS > 0 && lt.currentLap.Sector1MS > 0 && lt.currentLap.Sector2MS > 0 {
		s3 := lapTimeMS - (lt.currentLap.Sector1MS + lt.currentLap.Sector2MS)
		if s3 > 0 {
			lt.currentLap.Sector3MS = s3
		}
	}

	if err := lt.repo.SaveLap(ctx, lt.currentLap); err != nil {
		log.Printf("[LapTracker] Error finalizing lap: %v", err)
	}

	// Flush remaining samples
	if len(lt.samples) > 0 {
		lt.repo.SaveTelemetryBatch(ctx, lt.samples)
		lt.samples = lt.samples[:0]
	}

	log.Printf("[LapTracker] Lap %d completed in %d ms (Car %d)", lt.currentLap.LapNumber, lapTimeMS, lt.carIndex)
}
