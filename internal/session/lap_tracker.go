package session

import (
	"context"
	"log"

	"github.com/mgauna/f1game-telemetry-go/internal/packets"
	"github.com/mgauna/f1game-telemetry-go/internal/storage"
)

// LapTracker monitors a car's lap progress and buffers telemetry samples in memory for compressed persistence.
type LapTracker struct {
	repo        *storage.Repository
	batchWriter *TelemetryBatchWriter
	carIndex    int

	currentLapNum           int
	currentLap              *storage.Lap
	sampleBuffer            []storage.TelemetrySample
	lastLapDistance         float64
	lastWorldPosX           float64
	lastWorldPosY           float64
	lastWorldPosZ           float64
	lastERSDeploy           float64
	lastERSStoreEnergy      float64
	lastERSDeployMode       int
	lastActiveAeroMode      int
	lastActiveAeroAvailable int
	lastOvertakeActive      int
	currentStintNum         int
	lastTyreAge             int
	lastPitStops            int
	lastCompound            string
	stintIncrementedInLap   int
}

// NewLapTracker creates a new LapTracker.
func NewLapTracker(repo *storage.Repository, batchWriter *TelemetryBatchWriter, carIndex int) *LapTracker {
	return &LapTracker{
		repo:                  repo,
		batchWriter:           batchWriter,
		carIndex:              carIndex,
		currentStintNum:       1,
		stintIncrementedInLap: 0,
		sampleBuffer:          make([]storage.TelemetrySample, 0, packets.DefaultTelemetrySampleCapacity),
	}
}

// Reset clears the lap tracker state for a new session, flushing any in-progress lap telemetry.
func (lt *LapTracker) Reset() {
	if lt.currentLap != nil && lt.currentLap.ID > 0 && len(lt.sampleBuffer) > 0 && lt.batchWriter != nil {
		lt.batchWriter.EnqueueLap(lt.currentLap.ID, lt.sampleBuffer)
	}

	lt.currentLapNum = 0
	lt.currentLap = nil
	lt.sampleBuffer = nil
	lt.lastLapDistance = 0
	lt.lastWorldPosX = 0
	lt.lastWorldPosY = 0
	lt.lastWorldPosZ = 0
	lt.lastERSDeploy = 0
	lt.lastERSStoreEnergy = 0
	lt.lastERSDeployMode = 0
	lt.lastActiveAeroMode = 0
	lt.lastActiveAeroAvailable = 0
	lt.lastOvertakeActive = 0
	lt.currentStintNum = 1
	lt.lastTyreAge = 0
	lt.lastPitStops = 0
	lt.lastCompound = ""
	lt.stintIncrementedInLap = 0
}

// FlushCurrentLap flushes any in-memory telemetry buffer for the current active lap.
func (lt *LapTracker) FlushCurrentLap() {
	if lt.currentLap != nil && lt.currentLap.ID > 0 && len(lt.sampleBuffer) > 0 && lt.batchWriter != nil {
		lt.batchWriter.EnqueueLap(lt.currentLap.ID, lt.sampleBuffer)
		lt.sampleBuffer = nil
	}
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
	lt.lastERSStoreEnergy = float64((cs.ERSStoreEnergy / packets.MaxERSStoreEnergyJoules) * 100.0)
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

// ProcessCarTelemetry2 updates Active Aero and Boost / Overtake state for 2026 regulations.
func (lt *LapTracker) ProcessCarTelemetry2(p *packets.PacketCarTelemetry2Data) {
	if lt.carIndex >= packets.MaxCars || lt.carIndex >= len(p.CarTelemetry2Data) {
		return
	}
	t2 := p.CarTelemetry2Data[lt.carIndex]
	lt.lastActiveAeroMode = int(t2.ActiveAeroMode)
	lt.lastActiveAeroAvailable = int(t2.ActiveAeroAvailable)
	lt.lastOvertakeActive = int(t2.OvertakeActive)
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

	// Filter out truly inactive cars (ResultStatus == ResultStatusInactive) when no lap is active
	if lapData.ResultStatus == packets.ResultStatusInactive && lt.currentLap == nil {
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
	// Sanity check: F1 sessions never exceed MaxSessionLapsSanity laps
	if newLapNum <= 0 || newLapNum > packets.MaxSessionLapsSanity {
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
		lt.sampleBuffer = lt.sampleBuffer[:0]
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
		lt.sampleBuffer = lt.sampleBuffer[:0]
		lt.startNewLap(ctx, session.ID, newLapNum, lt.carIndex)
		return
	}

	// Case 5: Same lap in progress
	if lt.currentLap != nil {
		// Detect distance reset/restart during the same lap number (e.g. flashback or garage reset)
		if prevDistance > 500 && (currDistance < 100 || currDistance < prevDistance*0.3) {
			log.Printf("[LapTracker] Lap restart detected for Car %d on Lap %d (distance %.1fm -> %.1fm). Purging in-memory telemetry.", lt.carIndex, lt.currentLapNum, prevDistance, currDistance)
			lt.sampleBuffer = lt.sampleBuffer[:0]
			if lt.currentLap.ID > 0 {
				_ = lt.repo.DeleteTelemetryByLap(ctx, lt.currentLap.ID)
			}
		}

		s1 := int(lapData.Sector1TimeMSPart) + int(lapData.Sector1TimeMinutesPart)*packets.MillisPerMinute
		s2 := int(lapData.Sector2TimeMSPart) + int(lapData.Sector2TimeMinutesPart)*packets.MillisPerMinute
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

		// If car has finished session, retired, or DNF (ResultStatus >= ResultStatusFinished), finalize lap and flush telemetry
		lastLapTimeMS := int(lapData.LastLapTimeInMS)
		if resStatus >= int(packets.ResultStatusFinished) && lt.currentLap.LapTimeMS == 0 && lastLapTimeMS > 0 {
			lt.finalizeCurrentLap(ctx, lastLapTimeMS)
			return
		}

		if updated {
			_ = lt.repo.SaveLap(ctx, lt.currentLap, false)
		}

		// If car has finished or retired, flush any remaining in-memory telemetry
		if resStatus >= int(packets.ResultStatusFinished) && len(lt.sampleBuffer) > 0 {
			lt.FlushCurrentLap()
		}
	}
}

// ProcessSessionHistory updates lap history records from official game session history packet (ID 11).
func (lt *LapTracker) ProcessSessionHistory(ctx context.Context, session *storage.Session, p *packets.PacketSessionHistoryData) {
	if session == nil || p == nil {
		return
	}
	if int(p.CarIdx) != lt.carIndex {
		return
	}

	numLaps := int(p.NumLaps)
	if numLaps > packets.MaxLapHistoryEntries {
		numLaps = packets.MaxLapHistoryEntries
	}

	for i := 0; i < numLaps; i++ {
		lapData := p.LapHistoryData[i]
		lapNum := i + 1
		lapTime := int(lapData.LapTimeInMS)
		s1 := int(lapData.Sector1TimeMSPart) + int(lapData.Sector1TimeMinutesPart)*packets.MillisPerMinute
		s2 := int(lapData.Sector2TimeMSPart) + int(lapData.Sector2TimeMinutesPart)*packets.MillisPerMinute
		s3 := int(lapData.Sector3TimeMSPart) + int(lapData.Sector3TimeMinutesPart)*packets.MillisPerMinute

		if lapTime > 0 || s1 > 0 || s2 > 0 || s3 > 0 {
			isValid := (lapData.LapValidBitFlags & packets.LapValidBitFlag) != 0

			lap := &storage.Lap{
				SessionID: session.ID,
				CarIndex:  lt.carIndex,
				LapNumber: lapNum,
				LapTimeMS: lapTime,
				Sector1MS: s1,
				Sector2MS: s2,
				Sector3MS: s3,
				IsValid:   isValid,
			}
			_ = lt.repo.SaveLap(ctx, lap, true)
		}
	}
}

// ProcessTelemetry buffers a telemetry sample in memory.
func (lt *LapTracker) ProcessTelemetry(ctx context.Context, session *storage.Session, p *packets.PacketCarTelemetryData) {
	if session == nil || lt.currentLap == nil || lt.currentLap.ID == 0 {
		return
	}

	if lt.carIndex >= packets.MaxCars || lt.carIndex >= len(p.CarTelemetryData) {
		return
	}

	carData := p.CarTelemetryData[lt.carIndex]

	speedKMH := storage.SanitizeFloat(float64(carData.Speed))
	if speedKMH > lt.currentLap.MaxSpeedKMH {
		lt.currentLap.MaxSpeedKMH = speedKMH
	}

	sample := storage.TelemetrySample{
		LapDistance:         storage.SanitizeFloat(lt.lastLapDistance),
		SessionTime:         storage.SanitizeFloat(float64(p.Header.SessionTime)),
		Speed:               int(carData.Speed),
		Throttle:            storage.SanitizeFloat(float64(carData.Throttle)),
		Brake:               storage.SanitizeFloat(float64(carData.Brake)),
		Steer:               storage.SanitizeFloat(float64(carData.Steer)),
		Gear:                int(carData.Gear),
		EngineRPM:           int(carData.EngineRPM),
		DRS:                 carData.DRS == 1,
		ERSDeploy:           storage.SanitizeFloat(lt.lastERSDeploy),
		ERSStoreEnergy:      storage.SanitizeFloat(lt.lastERSStoreEnergy),
		ERSDeployMode:       lt.lastERSDeployMode,
		WorldPosX:           storage.SanitizeFloat(lt.lastWorldPosX),
		WorldPosY:           storage.SanitizeFloat(lt.lastWorldPosY),
		WorldPosZ:           storage.SanitizeFloat(lt.lastWorldPosZ),
		ActiveAeroMode:      lt.lastActiveAeroMode,
		ActiveAeroAvailable: lt.lastActiveAeroAvailable,
		OvertakeActive:      lt.lastOvertakeActive,
	}

	if lt.sampleBuffer == nil {
		lt.sampleBuffer = make([]storage.TelemetrySample, 0, packets.DefaultTelemetrySampleCapacity)
	}
	lt.sampleBuffer = append(lt.sampleBuffer, sample)
}

func (lt *LapTracker) startNewLap(ctx context.Context, sessionID int64, lapNum int, carIndex int) {
	// If there are uncommitted samples from a previous lap, flush them
	if lt.currentLap != nil && lt.currentLap.ID > 0 && len(lt.sampleBuffer) > 0 && lt.batchWriter != nil {
		lt.batchWriter.EnqueueLap(lt.currentLap.ID, lt.sampleBuffer)
	}

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
	lt.sampleBuffer = make([]storage.TelemetrySample, 0, packets.DefaultTelemetrySampleCapacity)

	if err := lt.repo.SaveLap(ctx, lt.currentLap, false); err != nil {
		log.Printf("[LapTracker] Error starting new lap: %v", err)
	}
}

func (lt *LapTracker) finalizeCurrentLap(ctx context.Context, lapTimeMS int) {
	if lt.currentLap == nil {
		return
	}

	if lapTimeMS > 0 {
		lt.currentLap.LapTimeMS = lapTimeMS
		storage.DeriveSector3(lt.currentLap)

		if err := lt.repo.SaveLap(ctx, lt.currentLap, false); err != nil {
			log.Printf("[LapTracker] Error finalizing lap: %v", err)
		}

		// Enqueue the lap's samples into the asynchronous batch writer
		if len(lt.sampleBuffer) > 0 && lt.currentLap.ID > 0 && lt.batchWriter != nil {
			lt.batchWriter.EnqueueLap(lt.currentLap.ID, lt.sampleBuffer)
			lt.sampleBuffer = nil
		}

		log.Printf("[LapTracker] Lap %d completed in %d ms (Car %d)", lt.currentLap.LapNumber, lapTimeMS, lt.carIndex)
	} else {
		log.Printf("[LapTracker] Lap %d ended without valid lap time (Car %d)", lt.currentLap.LapNumber, lt.carIndex)
	}
}
