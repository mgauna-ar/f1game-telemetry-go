package session

import (
	"context"
	"log/slog"
	"sync"

	"github.com/mgauna/f1game-telemetry-go/internal/packets"
	"github.com/mgauna/f1game-telemetry-go/internal/storage"
)

// LapTracker monitors a car's lap progress and buffers telemetry samples in memory for compressed persistence.
type LapTracker struct {
	mu          sync.Mutex
	repo        storage.Repository
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
	lastFittedTyreSetIdx    int
	stintIncrementedInLap   int
}

// NewLapTracker creates a new LapTracker.
func NewLapTracker(repo storage.Repository, batchWriter *TelemetryBatchWriter, carIndex int) *LapTracker {
	return &LapTracker{
		repo:                  repo,
		batchWriter:           batchWriter,
		carIndex:              carIndex,
		currentStintNum:       1,
		lastFittedTyreSetIdx:  -1,
		stintIncrementedInLap: 0,
		sampleBuffer:          make([]storage.TelemetrySample, 0, packets.DefaultTelemetrySampleCapacity),
	}
}

// Reset clears the lap tracker state for a new session, flushing any in-progress lap telemetry.
func (lt *LapTracker) Reset() {
	lt.mu.Lock()
	defer lt.mu.Unlock()

	if lt.currentLap != nil && lt.currentLap.ID > 0 && len(lt.sampleBuffer) > 10 && lt.batchWriter != nil {
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
	lt.lastFittedTyreSetIdx = -1
	lt.stintIncrementedInLap = 0
}

// FlushCurrentLap flushes any in-memory telemetry buffer for the current active lap.
func (lt *LapTracker) FlushCurrentLap() {
	lt.mu.Lock()
	defer lt.mu.Unlock()

	if lt.currentLap != nil && lt.currentLap.ID > 0 && len(lt.sampleBuffer) > 10 && lt.batchWriter != nil {
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

// ProcessTyreSets tracks tyre set swaps (e.g. changing sets inside the garage or pit stops).
func (lt *LapTracker) ProcessTyreSets(p *packets.PacketTyreSetsData) {
	if p == nil || int(p.CarIdx) != lt.carIndex {
		return
	}
	fittedIdx := int(p.FittedIdx)
	if fittedIdx < 0 || fittedIdx >= len(p.TyreSetData) {
		return
	}

	fittedSet := p.TyreSetData[fittedIdx]
	newComp := packets.VisualTyreCompoundName(fittedSet.VisualTyreCompound)
	actualComp := packets.ActualTyreCompoundName(fittedSet.ActualTyreCompound)

	// If fitted tyre set index changed, increment stint
	if lt.lastFittedTyreSetIdx >= 0 && fittedIdx != lt.lastFittedTyreSetIdx {
		if lt.stintIncrementedInLap != lt.currentLapNum {
			lt.currentStintNum++
			lt.stintIncrementedInLap = lt.currentLapNum
			slog.Info("Stint detected via PacketTyreSets", "stint", lt.currentStintNum, "carIndex", lt.carIndex, "fittedSet", fittedIdx, "prevFittedSet", lt.lastFittedTyreSetIdx, "compound", newComp)
		}
	}
	lt.lastFittedTyreSetIdx = fittedIdx

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
		if newComp != "" {
			lt.currentLap.TyreCompound = newComp
		}
		if actualComp != "" && actualComp != "UNKNOWN" {
			lt.currentLap.ActualCompound = actualComp
		}
	}
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
	actualComp := packets.ActualTyreCompoundName(cs.ActualTyreCompound)

	// Detect tyre set change / stint increment (avoid duplicate stint increments in same lap)
	// A new stint is started when:
	// 1) Tyre age drops (e.g. from 1+ laps to 0 or fewer laps when mounting a new/fresher set)
	// 2) Visual tyre compound changes (e.g. Soft -> Medium)
	tyreAgeDropped := lt.lastTyreAge > 0 && tyreAge < lt.lastTyreAge
	compoundChanged := lt.lastCompound != "" && newComp != "" && newComp != lt.lastCompound
	tyreChanged := tyreAgeDropped || compoundChanged
	if tyreChanged && lt.stintIncrementedInLap != lt.currentLapNum {
		lt.currentStintNum++
		lt.stintIncrementedInLap = lt.currentLapNum
		slog.Info("Stint detected", "stint", lt.currentStintNum, "carIndex", lt.carIndex, "compound", newComp, "prevTyreAge", lt.lastTyreAge, "tyreAge", tyreAge)
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
		if actualComp != "" && actualComp != "UNKNOWN" {
			lt.currentLap.ActualCompound = actualComp
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

	newLapNum := int(lapData.CurrentLapNum)
	// Sanity check: F1 sessions never exceed MaxSessionLapsSanity laps
	if newLapNum <= 0 || newLapNum > packets.MaxSessionLapsSanity {
		return
	}

	currDistance := float64(lapData.LapDistance)
	prevDistance := lt.lastLapDistance
	lt.lastLapDistance = currDistance

	// Case 1: Initial lap tracker initialization (seed initial state silently without firing pit stop event)
	if lt.currentLapNum == 0 {
		lt.lastPitStops = int(lapData.NumPitStops)
		if lt.lastPitStops > 0 {
			lt.currentStintNum = lt.lastPitStops + 1
		}
		lt.stintIncrementedInLap = newLapNum
		lt.startNewLap(ctx, session.ID, newLapNum, lt.carIndex)
		return
	}

	// Pit stop detection for active ongoing laps
	pitStops := int(lapData.NumPitStops)
	if pitStops > lt.lastPitStops && lt.stintIncrementedInLap != newLapNum {
		lt.currentStintNum++
		lt.stintIncrementedInLap = newLapNum
		slog.Info("Pit stop detected", "carIndex", lt.carIndex, "stint", lt.currentStintNum, "prevPitStops", lt.lastPitStops, "pitStops", pitStops)
	}
	lt.lastPitStops = pitStops

	// Case 2: Session restarted or rewound in game (Flashback / restart session)
	if newLapNum < lt.currentLapNum {
		slog.Info("Session reset detected", "carIndex", lt.carIndex, "prevLap", lt.currentLapNum, "newLap", newLapNum)
		lt.currentLap = nil
		lt.mu.Lock()
		lt.sampleBuffer = lt.sampleBuffer[:0]
		lt.mu.Unlock()
		lt.lastPitStops = int(lapData.NumPitStops)
		if lt.lastPitStops > 0 {
			lt.currentStintNum = lt.lastPitStops + 1
		} else {
			lt.currentStintNum = 1
		}
		lt.stintIncrementedInLap = newLapNum
		lt.startNewLap(ctx, session.ID, newLapNum, lt.carIndex)
		return
	}

	// Case 3: Completed a lap (normal increment: newLapNum == lt.currentLapNum + 1)
	if newLapNum == lt.currentLapNum+1 {
		if lt.currentLap != nil && lapData.CarPosition > 0 {
			lt.currentLap.CarPosition = int(lapData.CarPosition)
		}
		lt.finalizeCurrentLap(ctx, int(lapData.LastLapTimeInMS))
		lt.startNewLap(ctx, session.ID, newLapNum, lt.carIndex)
		return
	}

	// Case 4: Unexpected jump in lap number (> +1)
	if newLapNum > lt.currentLapNum+1 {
		slog.Info("Lap jump detected, re-syncing", "carIndex", lt.carIndex, "prevLap", lt.currentLapNum, "newLap", newLapNum)
		lt.currentLap = nil
		lt.mu.Lock()
		lt.sampleBuffer = lt.sampleBuffer[:0]
		lt.mu.Unlock()
		lt.startNewLap(ctx, session.ID, newLapNum, lt.carIndex)
		return
	}

	// Case 5: Same lap in progress
	if lt.currentLap != nil {
		// Detect distance reset/restart during the same lap number (e.g. flashback or garage reset)
		if prevDistance > 500 && (currDistance < 100 || currDistance < prevDistance*0.3) {
			slog.Info("Lap restart detected", "carIndex", lt.carIndex, "lap", lt.currentLapNum, "prevDistance", prevDistance, "currDistance", currDistance)
			lt.mu.Lock()
			lt.sampleBuffer = lt.sampleBuffer[:0]
			lt.mu.Unlock()
			if lt.currentLap.ID > 0 {
				_ = lt.repo.DeleteTelemetryByLap(ctx, lt.currentLap.ID)
			}
		} else if prevDistance < 0 && currDistance >= 0 && lt.currentLapNum == 1 {
			slog.Info("Out-lap to flying lap transition detected", "carIndex", lt.carIndex, "prevDistance", prevDistance, "currDistance", currDistance)
			lt.mu.Lock()
			lt.sampleBuffer = lt.sampleBuffer[:0]
			lt.mu.Unlock()
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

		// If car has finished session on Lap 1 without a lap transition (e.g. 1-lap sprint / time trial), finalize Lap 1
		lastLapTimeMS := int(lapData.LastLapTimeInMS)
		if resStatus >= int(packets.ResultStatusFinished) && lt.currentLapNum == 1 && lt.currentLap.LapTimeMS == 0 && lastLapTimeMS > 0 {
			lt.finalizeCurrentLap(ctx, lastLapTimeMS)
			return
		}

		if updated {
			_ = lt.repo.SaveLap(ctx, lt.currentLap, false)
		}

		// If car has finished or retired, flush any remaining in-memory telemetry
		if resStatus >= int(packets.ResultStatusFinished) {
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

	numStints := int(p.NumTyreStints)
	if numStints > packets.MaxTyreStintHistoryEntries {
		numStints = packets.MaxTyreStintHistoryEntries
	}

	// Synchronize tracker's current stint number if session history reports a higher stint
	if numStints > lt.currentStintNum {
		lt.currentStintNum = numStints
	}

	for i := 0; i < numLaps; i++ {
		lapData := p.LapHistoryData[i]
		lapNum := i + 1
		lapTime := int(lapData.LapTimeInMS)
		s1 := int(lapData.Sector1TimeMSPart) + int(lapData.Sector1TimeMinutesPart)*packets.MillisPerMinute
		s2 := int(lapData.Sector2TimeMSPart) + int(lapData.Sector2TimeMinutesPart)*packets.MillisPerMinute
		s3 := int(lapData.Sector3TimeMSPart) + int(lapData.Sector3TimeMinutesPart)*packets.MillisPerMinute

		// Determine stint number, visual compound, and actual compound from TyreStintHistoryData
		stintNum := 1
		compoundName := ""
		actualCompoundName := ""
		if numStints > 0 {
			for s := 0; s < numStints; s++ {
				stintInfo := p.TyreStintHistoryData[s]
				stintStartLap := 1
				if s > 0 {
					prevEnd := int(p.TyreStintHistoryData[s-1].EndLap)
					if prevEnd > 0 && prevEnd != 255 {
						stintStartLap = prevEnd + 1
					} else {
						stintStartLap = s + 1
					}
				}
				stintEndLap := int(stintInfo.EndLap)
				if stintEndLap == 255 || stintEndLap == 0 {
					if s == numStints-1 {
						stintEndLap = packets.MaxSessionLapsSanity
					} else {
						stintEndLap = stintStartLap
					}
				}
				if lapNum >= stintStartLap && lapNum <= stintEndLap {
					stintNum = s + 1
					compoundName = packets.VisualTyreCompoundName(stintInfo.TyreVisualCompound)
					actualCompoundName = packets.ActualTyreCompoundName(stintInfo.TyreActualCompound)
					break
				}
			}
		}

		if lapTime > 0 || s1 > 0 || s2 > 0 || s3 > 0 {
			isValid := (lapData.LapValidBitFlags & packets.LapValidBitFlag) != 0
			s1Valid := (lapData.LapValidBitFlags & packets.Sector1ValidBitFlag) != 0
			s2Valid := (lapData.LapValidBitFlags & packets.Sector2ValidBitFlag) != 0
			s3Valid := (lapData.LapValidBitFlags & packets.Sector3ValidBitFlag) != 0

			// If LapValidBitFlags is 0 but the lap has a valid completed lap time,
			// it indicates unpopulated validity bitmask from Qualifying/Practice UDP packets.
			if lapData.LapValidBitFlags == 0 && lapTime > 0 {
				isValid = true
				s1Valid = s1 > 0
				s2Valid = s2 > 0
				s3Valid = s3 > 0
			}

			lap := &storage.Lap{
				SessionID:      session.ID,
				CarIndex:       lt.carIndex,
				LapNumber:      lapNum,
				LapTimeMS:      lapTime,
				Sector1MS:      s1,
				Sector2MS:      s2,
				Sector3MS:      s3,
				IsValid:        isValid,
				Stint:          stintNum,
				TyreCompound:   compoundName,
				ActualCompound: actualCompoundName,
				Sector1Valid:   s1Valid,
				Sector2Valid:   s2Valid,
				Sector3Valid:   s3Valid,
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

	speedKMH := float64(carData.Speed)
	if speedKMH > lt.currentLap.MaxSpeedKMH {
		lt.currentLap.MaxSpeedKMH = speedKMH
	}

	sample := storage.TelemetrySample{
		LapDistance:         lt.lastLapDistance,
		SessionTime:         float64(p.Header.SessionTime),
		Speed:               int(carData.Speed),
		Throttle:            float64(carData.Throttle),
		Brake:               float64(carData.Brake),
		Steer:               float64(carData.Steer),
		Gear:                int(carData.Gear),
		EngineRPM:           int(carData.EngineRPM),
		DRS:                 carData.DRS == 1,
		ERSDeploy:           lt.lastERSDeploy,
		ERSStoreEnergy:      lt.lastERSStoreEnergy,
		ERSDeployMode:       lt.lastERSDeployMode,
		WorldPosX:           lt.lastWorldPosX,
		WorldPosY:           lt.lastWorldPosY,
		WorldPosZ:           lt.lastWorldPosZ,
		ActiveAeroMode:      lt.lastActiveAeroMode,
		ActiveAeroAvailable: lt.lastActiveAeroAvailable,
		OvertakeActive:      lt.lastOvertakeActive,
	}

	lt.mu.Lock()
	if lt.sampleBuffer == nil {
		lt.sampleBuffer = make([]storage.TelemetrySample, 0, packets.DefaultTelemetrySampleCapacity)
	}
	lt.sampleBuffer = append(lt.sampleBuffer, sample)
	lt.mu.Unlock()
}

func (lt *LapTracker) startNewLap(ctx context.Context, sessionID int64, lapNum, carIndex int) {
	lt.mu.Lock()
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
	lt.mu.Unlock()

	if err := lt.repo.SaveLap(ctx, lt.currentLap, false); err != nil {
		slog.Error("Failed to start new lap", "lapNumber", lt.currentLap.LapNumber, "carIndex", lt.carIndex, "error", err)
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
			slog.Error("Failed to finalize lap", "lapNumber", lt.currentLap.LapNumber, "carIndex", lt.carIndex, "error", err)
		}

		// Enqueue the lap's samples into the asynchronous batch writer
		lt.mu.Lock()
		if len(lt.sampleBuffer) > 0 && lt.currentLap.ID > 0 && lt.batchWriter != nil {
			lt.batchWriter.EnqueueLap(lt.currentLap.ID, lt.sampleBuffer)
			lt.sampleBuffer = nil
		}
		lt.mu.Unlock()

		slog.Info("Lap completed", "lapNumber", lt.currentLap.LapNumber, "lapTimeMS", lapTimeMS, "carIndex", lt.carIndex)
	} else {
		slog.Info("Lap ended without valid lap time", "lapNumber", lt.currentLap.LapNumber, "carIndex", lt.carIndex)
	}
}
