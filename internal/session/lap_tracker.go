package session

import (
	"context"
	"log"

	"github.com/mgauna/f1game-telemetry-go/internal/packets"
	"github.com/mgauna/f1game-telemetry-go/internal/storage"
)

// LapTracker monitors a car's lap progress and streams telemetry samples to the batch writer.
type LapTracker struct {
	repo        *storage.Repository
	batchWriter *TelemetryBatchWriter
	carIndex    int

	currentLapNum         int
	currentLap            *storage.Lap
	lastLapDistance       float64
	lastWorldPosX         float64
	lastWorldPosY         float64
	lastWorldPosZ         float64
	lastERSDeploy         float64
	lastERSStoreEnergy    float64
	lastERSDeployMode     int
	currentStintNum       int
	lastTyreAge           int
	lastPitStops          int
	lastCompound          string
	stintIncrementedInLap int
}

// NewLapTracker creates a new LapTracker.
func NewLapTracker(repo *storage.Repository, batchWriter *TelemetryBatchWriter, carIndex int) *LapTracker {
	return &LapTracker{
		repo:                  repo,
		batchWriter:           batchWriter,
		carIndex:              carIndex,
		currentStintNum:       1,
		stintIncrementedInLap: 0,
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
	lt.lastERSStoreEnergy = 0
	lt.lastERSDeployMode = 0
	lt.currentStintNum = 1
	lt.lastTyreAge = 0
	lt.lastPitStops = 0
	lt.lastCompound = ""
	lt.stintIncrementedInLap = 0
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

// ProcessCarStatus updates fuel load, ERS status, tyre compounds, and stint tracking.
func (lt *LapTracker) ProcessCarStatus(p *packets.PacketCarStatusData) {
	if lt.carIndex >= packets.MaxCars || lt.carIndex >= len(p.CarStatusData) {
		return
	}
	cs := p.CarStatusData[lt.carIndex]
	lt.lastERSDeploy = float64(cs.ERSDeployedThisLap)
	lt.lastERSStoreEnergy = float64((cs.ERSStoreEnergy / 4000000.0) * 100.0)
	lt.lastERSDeployMode = int(cs.ERSDeployMode)

	tyreAge := int(cs.TyresAgeLaps)
	newComp := packets.VisualTyreCompoundName(cs.VisualTyreCompound)

	// Detect tyre set change / stint increment (avoid duplicate stint increments in same lap)
	tyreChanged := (lt.lastTyreAge > 1 && tyreAge <= 1) || (lt.lastCompound != "" && newComp != "" && newComp != lt.lastCompound)
	if tyreChanged && lt.stintIncrementedInLap != lt.currentLapNum {
		lt.currentStintNum++
		lt.stintIncrementedInLap = lt.currentLapNum
		log.Printf("[LapTracker] Stint %d detected for Car %d (Compound: %s, Tyre Age: %d)", lt.currentStintNum, lt.carIndex, newComp, tyreAge)
	}

	lt.lastTyreAge = tyreAge
	if newComp != "" {
		lt.lastCompound = newComp
	}

	if lt.currentLap != nil {
		if lt.currentStintNum <= 0 {
			lt.currentStintNum = 1
		}
		if lt.currentLap.Stint < lt.currentStintNum {
			lt.currentLap.Stint = lt.currentStintNum
		}
		lt.currentLap.FuelLoad = float64(cs.FuelInTank)
		if newComp != "" {
			lt.currentLap.TyreCompound = newComp
		}
	}
}

// ProcessLapData processes the LapData packet to detect lap transitions.
func (lt *LapTracker) ProcessLapData(ctx context.Context, session *storage.Session, p *packets.PacketLapData) {
	if session == nil {
		return
	}

	if lt.carIndex >= packets.MaxCars || lt.carIndex >= len(p.LapData) {
		return
	}

	lapData := p.LapData[lt.carIndex]

	// Filter out inactive cars if ResultStatus is available (2 = Active, 3 = Finished)
	if lapData.ResultStatus != 0 && lapData.ResultStatus != 2 && lapData.ResultStatus != 3 {
		return
	}

	// Pit stop detection
	pitStops := int(lapData.NumPitStops)
	if lt.lastPitStops > 0 && pitStops > lt.lastPitStops && lt.stintIncrementedInLap != lt.currentLapNum {
		lt.currentStintNum++
		lt.stintIncrementedInLap = lt.currentLapNum
		log.Printf("[LapTracker] Pit stop detected for Car %d (Stint %d, pit stops %d -> %d)", lt.carIndex, lt.currentStintNum, lt.lastPitStops, pitStops)
	}
	lt.lastPitStops = pitStops

	newLapNum := int(lapData.CurrentLapNum)
	// Sanity check: F1 sessions never exceed 120 laps
	if newLapNum <= 0 || newLapNum > 120 {
		return
	}

	currDistance := float64(lapData.LapDistance)
	prevDistance := lt.lastLapDistance
	lt.lastLapDistance = currDistance

	// Case 1: Initial lap tracker initialization
	if lt.currentLapNum == 0 {
		lt.startNewLap(ctx, session.ID, newLapNum, lt.carIndex)
		return
	}

	// Case 2: Session restarted or rewound in game (Flashback / restart session)
	if newLapNum < lt.currentLapNum {
		log.Printf("[LapTracker] Session reset detected for Car %d (Lap %d -> Lap %d)", lt.carIndex, lt.currentLapNum, newLapNum)
		lt.currentLap = nil
		lt.startNewLap(ctx, session.ID, newLapNum, lt.carIndex)
		return
	}

	// Case 3: Completed a lap (normal increment: newLapNum == lt.currentLapNum + 1)
	if newLapNum == lt.currentLapNum+1 {
		lt.finalizeCurrentLap(ctx, int(lapData.LastLapTimeInMS))
		lt.startNewLap(ctx, session.ID, newLapNum, lt.carIndex)
		return
	}

	// Case 4: Unexpected jump in lap number (> +1)
	if newLapNum > lt.currentLapNum+1 {
		log.Printf("[LapTracker] Lap jump detected for Car %d (Lap %d -> Lap %d), re-syncing", lt.carIndex, lt.currentLapNum, newLapNum)
		lt.currentLap = nil
		lt.startNewLap(ctx, session.ID, newLapNum, lt.carIndex)
		return
	}

	// Case 5: Same lap in progress
	if lt.currentLap != nil {
		// Detect distance reset/restart during the same lap number (e.g. flashback or garage reset)
		if prevDistance > 500 && (currDistance < 100 || currDistance < prevDistance*0.3) {
			log.Printf("[LapTracker] Lap restart detected for Car %d on Lap %d (distance %.1fm -> %.1fm). Purging obsolete telemetry.", lt.carIndex, lt.currentLapNum, prevDistance, currDistance)
			if lt.currentLap.ID > 0 {
				_ = lt.repo.DeleteTelemetryByLap(ctx, lt.currentLap.ID)
			}
		}

		s1 := int(lapData.Sector1TimeMSPart) + int(lapData.Sector1TimeMinutesPart)*60000
		s2 := int(lapData.Sector2TimeMSPart) + int(lapData.Sector2TimeMinutesPart)*60000
		isValid := lapData.CurrentLapInvalid == 0
		penalties := int(lapData.Penalties)
		pos := int(lapData.CarPosition)
		resStatus := int(lapData.ResultStatus)

		updated := false
		if s1 > 0 && lt.currentLap.Sector1MS != s1 {
			lt.currentLap.Sector1MS = s1
			updated = true
		}
		if s2 > 0 && lt.currentLap.Sector2MS != s2 {
			lt.currentLap.Sector2MS = s2
			updated = true
		}
		if lt.currentLap.IsValid != isValid {
			lt.currentLap.IsValid = isValid
			updated = true
		}
		if penalties > 0 && lt.currentLap.PenaltiesSeconds != penalties {
			lt.currentLap.PenaltiesSeconds = penalties
			updated = true
		}
		if pos > 0 && lt.currentLap.CarPosition != pos {
			lt.currentLap.CarPosition = pos
			updated = true
		}
		if resStatus > 0 && lt.currentLap.ResultStatus != resStatus {
			lt.currentLap.ResultStatus = resStatus
			updated = true
		}

		// If car has finished single lap session (ResultStatus == 3 on Lap 1), update lap time
		lastLapTimeMS := int(lapData.LastLapTimeInMS)
		if resStatus == 3 && lt.currentLapNum == 1 && lt.currentLap.LapTimeMS == 0 && lastLapTimeMS > 0 {
			lt.currentLap.LapTimeMS = lastLapTimeMS
			if s1 > 0 && s2 > 0 && lt.currentLap.Sector3MS == 0 {
				s3 := lastLapTimeMS - (s1 + s2)
				if s3 > 0 {
					lt.currentLap.Sector3MS = s3
				}
			}
			updated = true
		}

		if updated {
			_ = lt.repo.SaveLap(ctx, lt.currentLap)
		}
	}
}

// ProcessTelemetry streams a telemetry sample to the asynchronous batch writer.
func (lt *LapTracker) ProcessTelemetry(ctx context.Context, session *storage.Session, p *packets.PacketCarTelemetryData) {
	if session == nil || lt.currentLap == nil || lt.currentLap.ID == 0 {
		return
	}

	if lt.carIndex >= packets.MaxCars || lt.carIndex >= len(p.CarTelemetryData) {
		return
	}

	carData := p.CarTelemetryData[lt.carIndex]

	speedKMH := float64(carData.Speed)
	if speedKMH > lt.currentLap.MaxSpeedKMH {
		lt.currentLap.MaxSpeedKMH = speedKMH
	}

	sample := storage.TelemetrySample{
		LapID:          lt.currentLap.ID,
		LapDistance:    lt.lastLapDistance,
		SessionTime:    float64(p.Header.SessionTime),
		Speed:          int(carData.Speed),
		Throttle:       float64(carData.Throttle),
		Brake:          float64(carData.Brake),
		Steer:          float64(carData.Steer),
		Gear:           int(carData.Gear),
		EngineRPM:      int(carData.EngineRPM),
		DRS:            carData.DRS == 1,
		ERSDeploy:      lt.lastERSDeploy,
		ERSStoreEnergy: lt.lastERSStoreEnergy,
		ERSDeployMode:  lt.lastERSDeployMode,
		WorldPosX:      lt.lastWorldPosX,
		WorldPosY:      lt.lastWorldPosY,
		WorldPosZ:      lt.lastWorldPosZ,
	}

	if lt.batchWriter != nil {
		lt.batchWriter.Enqueue(sample)
	}
}

func (lt *LapTracker) startNewLap(ctx context.Context, sessionID int64, lapNum int, carIndex int) {
	lt.currentLapNum = lapNum
	stint := lt.currentStintNum
	if stint <= 0 {
		stint = 1
	}
	lt.currentLap = &storage.Lap{
		SessionID: sessionID,
		LapNumber: lapNum,
		CarIndex:  carIndex,
		IsValid:   true,
		Stint:     stint,
	}

	if err := lt.repo.SaveLap(ctx, lt.currentLap); err != nil {
		log.Printf("[LapTracker] Error starting new lap: %v", err)
	} else if lt.currentLap.ID > 0 {
		// Clean any previous aborted/stale run telemetry for this lap record
		_ = lt.repo.DeleteTelemetryByLap(ctx, lt.currentLap.ID)
	}
}

func (lt *LapTracker) finalizeCurrentLap(ctx context.Context, lapTimeMS int) {
	if lt.currentLap == nil {
		return
	}

	if lapTimeMS > 0 {
		lt.currentLap.LapTimeMS = lapTimeMS

		if lt.currentLap.Sector1MS > 0 && lt.currentLap.Sector2MS > 0 {
			s3 := lapTimeMS - (lt.currentLap.Sector1MS + lt.currentLap.Sector2MS)
			if s3 > 0 {
				lt.currentLap.Sector3MS = s3
			}
		}

		if err := lt.repo.SaveLap(ctx, lt.currentLap); err != nil {
			log.Printf("[LapTracker] Error finalizing lap: %v", err)
		}

		log.Printf("[LapTracker] Lap %d completed in %d ms (Car %d)", lt.currentLap.LapNumber, lapTimeMS, lt.carIndex)
	} else {
		log.Printf("[LapTracker] Lap %d ended without valid lap time (Car %d)", lt.currentLap.LapNumber, lt.carIndex)
	}
}
