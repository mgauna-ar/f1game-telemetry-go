package api

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"sync"
	"time"

	"github.com/mgauna/f1game-telemetry-go/internal/packets"
	"github.com/mgauna/f1game-telemetry-go/internal/storage"
)

// EngineerDirectiveCategory represents categories of proactive intelligence.
type EngineerDirectiveCategory string

const (
	DirectiveCategoryPitStrategy EngineerDirectiveCategory = "pit_strategy"
	DirectiveCategoryCoaching    EngineerDirectiveCategory = "coaching"
	DirectiveCategoryWeather     EngineerDirectiveCategory = "weather"
	DirectiveCategoryTeammate    EngineerDirectiveCategory = "teammate"
)

// Urgency levels for directives
const (
	UrgencyLow      = "low"
	UrgencyMedium   = "medium"
	UrgencyHigh     = "high"
	UrgencyCritical = "critical"
)

// Analytical constants for Directive Engine
const (
	DefaultPitLaneLossSeconds    = 21.0
	CleanAirTrafficWindowSeconds = 3.0
	SectorTimeLossThresholdSec   = 0.35
	TeammateGapThresholdSec      = 2.5
	DefaultDirectiveCooldownMs   = 45_000
	WeatherRainTransitionProbPct = 60
)

// EngineerDirective represents an intelligent contextual prompt or alert generated server-side.
type EngineerDirective struct {
	ID          string                    `json:"id"`
	Type        string                    `json:"type"` // "directive"
	Category    EngineerDirectiveCategory `json:"category"`
	Title       string                    `json:"title"`
	Message     string                    `json:"message"`
	Urgency     string                    `json:"urgency"` // "low", "medium", "high", "critical"
	Timestamp   int64                     `json:"timestamp"`
	CarIndex    int                       `json:"car_index"`
	SessionTime float32                   `json:"session_time"`
	Metadata    map[string]any            `json:"metadata,omitempty"`
}

// EngineerEngine handles server-side analytical processing and broadcasts directives.
type EngineerEngine struct {
	mu             sync.RWMutex
	hub            *Hub
	repo           storage.Repository
	lastDirectives map[string]int64 // Key -> timestamp ms

	// Tracked session state
	currentSessionUID uint64
	playerCarIndex    int
	teammateCarIndex  int
	playerTeamID      int

	// Sector best times
	bestSector1MS int
	bestSector2MS int
	bestSector3MS int
	lastLapNumber int

	// Strategy tracking
	lastPittedCarIndex int
	lastWeatherAlert   int
}

// NewEngineerEngine creates a new EngineerEngine instance.
func NewEngineerEngine(hub *Hub, repo storage.Repository) *EngineerEngine {
	return &EngineerEngine{
		hub:                hub,
		repo:               repo,
		lastDirectives:     make(map[string]int64),
		teammateCarIndex:   -1,
		playerTeamID:       -1,
		lastPittedCarIndex: -1,
	}
}

// Reset clears state when a new session starts.
func (e *EngineerEngine) Reset(sessionUID uint64) {
	e.mu.Lock()
	defer e.mu.Unlock()

	e.currentSessionUID = sessionUID
	e.lastDirectives = make(map[string]int64)
	e.teammateCarIndex = -1
	e.playerTeamID = -1
	e.bestSector1MS = 0
	e.bestSector2MS = 0
	e.bestSector3MS = 0
	e.lastLapNumber = 0
	e.lastPittedCarIndex = -1
	e.lastWeatherAlert = 0
}

// ProcessPacket inspects incoming telemetry packets and evaluates proactive directives.
func (e *EngineerEngine) ProcessPacket(ctx context.Context, pkt packets.Packet) {
	if pkt == nil {
		return
	}

	header := pkt.GetHeader()
	if header.SessionUID == 0 {
		return
	}

	e.mu.Lock()
	if e.currentSessionUID != header.SessionUID {
		e.currentSessionUID = header.SessionUID
		e.lastDirectives = make(map[string]int64)
		e.teammateCarIndex = -1
		e.playerTeamID = -1
		e.bestSector1MS = 0
		e.bestSector2MS = 0
		e.bestSector3MS = 0
		e.lastLapNumber = 0
		e.lastPittedCarIndex = -1
	}
	e.playerCarIndex = int(header.PlayerCarIndex)
	e.mu.Unlock()

	switch p := pkt.(type) {
	case *packets.PacketParticipantsData:
		e.processParticipants(p)
	case *packets.PacketLapData:
		e.processLapData(header, p)
	case *packets.PacketSessionData:
		e.processSessionData(header, p)
	}
}

func (e *EngineerEngine) processParticipants(p *packets.PacketParticipantsData) {
	e.mu.Lock()
	defer e.mu.Unlock()

	playerIdx := e.playerCarIndex
	if playerIdx >= len(p.Participants) {
		return
	}

	playerTeam := int(p.Participants[playerIdx].TeamId)
	e.playerTeamID = playerTeam

	// Find teammate (same team ID, different car index)
	for i := 0; i < int(p.NumActiveCars) && i < len(p.Participants); i++ {
		if i != playerIdx && int(p.Participants[i].TeamId) == playerTeam {
			e.teammateCarIndex = i
			break
		}
	}
}

// isPlayerOnTrack returns true if the player is actively driving on track (not in garage or pit lane).
func (e *EngineerEngine) isPlayerOnTrack(playerLap *packets.LapData) bool {
	if playerLap.DriverStatus == packets.DriverStatusInGarage {
		return false
	}
	if playerLap.PitStatus == packets.PitStatusInPitArea || playerLap.PitStatus == packets.PitStatusPitting {
		return false
	}
	if playerLap.PitLaneTimerActive == 1 {
		return false
	}
	return true
}

func (e *EngineerEngine) processLapData(header packets.PacketHeader, p *packets.PacketLapData) {
	playerIdx := int(header.PlayerCarIndex)
	if playerIdx >= len(p.LapData) {
		return
	}

	playerLap := p.LapData[playerIdx]
	currentLap := int(playerLap.CurrentLapNum)

	e.mu.Lock()
	defer e.mu.Unlock()

	// Suppress on-track directives if the player is in the garage or pit lane
	onTrack := e.isPlayerOnTrack(&playerLap)

	// 1. Sector Coaching Analysis (Only when actively pushing on track)
	if onTrack && playerLap.DriverStatus != packets.DriverStatusInLap && playerLap.DriverStatus != packets.DriverStatusOutLap {
		s1 := int(playerLap.Sector1TimeMSPart)
		s2 := int(playerLap.Sector2TimeMSPart)

		if s1 > 0 && (e.bestSector1MS == 0 || s1 < e.bestSector1MS) {
			e.bestSector1MS = s1
		}
		if s2 > 0 && (e.bestSector2MS == 0 || s2 < e.bestSector2MS) {
			e.bestSector2MS = s2
		}

		// Check sector 1 loss on sector 2 entry
		if int(playerLap.Sector) == 1 && s1 > 0 && e.bestSector1MS > 0 && currentLap == e.lastLapNumber {
			deltaS1 := float64(s1-e.bestSector1MS) / 1000.0
			if deltaS1 >= SectorTimeLossThresholdSec {
				e.emitDirectiveLocked(header, EngineerDirective{
					Category:    DirectiveCategoryCoaching,
					Title:       "Sector 1 Delta",
					Message:     fmt.Sprintf("Time lost in Sector 1 (+%.2fs vs personal best). Focus on apex speed and smooth steering input.", deltaS1),
					Urgency:     UrgencyMedium,
					SessionTime: header.SessionTime,
					CarIndex:    playerIdx,
					Metadata: map[string]any{
						"sector": 1,
						"delta":  deltaS1,
					},
				}, "coaching_s1")
			}
		}

		// Check sector 2 loss on sector 3 entry
		if int(playerLap.Sector) == 2 && s2 > 0 && e.bestSector2MS > 0 && currentLap == e.lastLapNumber {
			deltaS2 := float64(s2-e.bestSector2MS) / 1000.0
			if deltaS2 >= SectorTimeLossThresholdSec {
				e.emitDirectiveLocked(header, EngineerDirective{
					Category:    DirectiveCategoryCoaching,
					Title:       "Sector 2 Delta",
					Message:     fmt.Sprintf("Time lost in Sector 2 (+%.2fs vs personal best). Prioritize corner exit traction.", deltaS2),
					Urgency:     UrgencyMedium,
					SessionTime: header.SessionTime,
					CarIndex:    playerIdx,
					Metadata: map[string]any{
						"sector": 2,
						"delta":  deltaS2,
					},
				}, "coaching_s2")
			}
		}
	}

	e.lastLapNumber = currentLap

	// 2. Teammate Context Analysis (Only if player is on track)
	if onTrack && e.teammateCarIndex >= 0 && e.teammateCarIndex < len(p.LapData) {
		teammateLap := p.LapData[e.teammateCarIndex]
		playerPos := int(playerLap.CarPosition)
		teammatePos := int(teammateLap.CarPosition)

		// If teammate is directly ahead or behind
		if playerPos > 0 && teammatePos > 0 && math.Abs(float64(playerPos-teammatePos)) == 1 {
			distDelta := float64(teammateLap.TotalDistance - playerLap.TotalDistance)
			gapSec := distDelta / 65.0 // Average race speed approximation

			if gapSec > 0 && gapSec < TeammateGapThresholdSec {
				e.emitDirectiveLocked(header, EngineerDirective{
					Category:    DirectiveCategoryTeammate,
					Title:       "Teammate Ahead",
					Message:     fmt.Sprintf("Teammate is P%d, %.1fs ahead. Pace delta is favorable. Free to race, keep it clean.", teammatePos, gapSec),
					Urgency:     UrgencyMedium,
					SessionTime: header.SessionTime,
					CarIndex:    playerIdx,
					Metadata: map[string]any{
						"teammate_pos": teammatePos,
						"gap_sec":      gapSec,
					},
				}, "teammate_ahead")
			}
		}

		// Teammate Pit Status change
		if teammateLap.PitStatus == packets.PitStatusPitting && e.lastPittedCarIndex != e.teammateCarIndex {
			e.lastPittedCarIndex = e.teammateCarIndex
			e.emitDirectiveLocked(header, EngineerDirective{
				Category:    DirectiveCategoryTeammate,
				Title:       "Teammate Pitting",
				Message:     fmt.Sprintf("Teammate in P%d is pitting now. Focus on clean in-lap.", teammatePos),
				Urgency:     UrgencyHigh,
				SessionTime: header.SessionTime,
				CarIndex:    playerIdx,
			}, "teammate_pitting")
		}
	}

	// 3. Predictive Pit Strategy (Traffic Window & Overcut / Undercut)
	if onTrack && playerLap.DriverStatus != packets.DriverStatusOutLap && playerLap.DriverStatus != packets.DriverStatusInLap && playerLap.PitStatus == packets.PitStatusNone && currentLap > 3 {
		// Calculate traffic window on potential pit stop
		playerDist := float64(playerLap.TotalDistance)
		estPitLossMeters := DefaultPitLaneLossSeconds * 65.0
		rejoinDist := playerDist - estPitLossMeters

		trafficCount := 0
		for i, rival := range p.LapData {
			if i == playerIdx || rival.TotalDistance == 0 {
				continue
			}
			rivalDist := float64(rival.TotalDistance)
			// Check if any rival is within 3.0 seconds of expected rejoin spot
			if math.Abs(rivalDist-rejoinDist) < CleanAirTrafficWindowSeconds*65.0 {
				trafficCount++
			}
		}

		if trafficCount == 0 && currentLap%5 == 0 {
			e.emitDirectiveLocked(header, EngineerDirective{
				Category:    DirectiveCategoryPitStrategy,
				Title:       "Clean Air Pit Window",
				Message:     "Pit window offers clean air on rejoin. Ideal opportunity for undercut/overcut strategy.",
				Urgency:     UrgencyLow,
				SessionTime: header.SessionTime,
				CarIndex:    playerIdx,
			}, "pit_clean_air")
		}
	}
}

func (e *EngineerEngine) processSessionData(header packets.PacketHeader, p *packets.PacketSessionData) {
	if p.GamePaused == 1 || p.NumRedFlagPeriods > 0 {
		return
	}

	e.mu.Lock()
	defer e.mu.Unlock()

	// Dynamic Weather Progression Analysis
	numSamples := int(p.NumWeatherForecastSamples)
	if numSamples > len(p.WeatherForecastSamples) {
		numSamples = len(p.WeatherForecastSamples)
	}

	for i := 0; i < numSamples; i++ {
		sample := p.WeatherForecastSamples[i]
		rainPct := int(sample.RainPercentage)
		timeOffset := int(sample.TimeOffset)

		if rainPct >= WeatherRainTransitionProbPct && timeOffset <= 10 && e.lastWeatherAlert != timeOffset {
			e.lastWeatherAlert = timeOffset
			e.emitDirectiveLocked(header, EngineerDirective{
				Category:    DirectiveCategoryWeather,
				Title:       "Weather Transition",
				Message:     fmt.Sprintf("Radar confirms %d%% rain in %d minutes. Prepare tyre strategy for crossover window.", rainPct, timeOffset),
				Urgency:     UrgencyHigh,
				SessionTime: header.SessionTime,
				CarIndex:    int(header.PlayerCarIndex),
				Metadata: map[string]any{
					"rain_pct":    rainPct,
					"time_offset": timeOffset,
				},
			}, fmt.Sprintf("weather_rain_%d", timeOffset))
			break
		}
	}
}

func (e *EngineerEngine) emitDirectiveLocked(header packets.PacketHeader, directive EngineerDirective, dedupKey string) {
	now := time.Now().UnixMilli()
	lastTime, exists := e.lastDirectives[dedupKey]
	if exists && now-lastTime < DefaultDirectiveCooldownMs {
		return
	}
	e.lastDirectives[dedupKey] = now

	directive.ID = fmt.Sprintf("directive_%d_%s", now, dedupKey)
	directive.Type = "directive"
	directive.Timestamp = now

	if e.hub != nil {
		if data, err := json.Marshal(directive); err == nil {
			e.hub.Broadcast(data)
		}
	}
}
