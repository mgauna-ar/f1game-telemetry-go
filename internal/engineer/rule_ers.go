package engineer

import (
	"fmt"
	"math"
	"sync"
	"time"

	"github.com/mgauna/f1game-telemetry-go/internal/packets"
)

// ERSRule manages low ERS battery reserve and engine radiator overheating alerts.
type ERSRule struct {
	mu                      sync.Mutex
	lastErsLowAlertLap      int
	lastEngineOverheatAlert int64
}

// NewERSRule creates a new ERSRule.
func NewERSRule() *ERSRule {
	return &ERSRule{
		lastErsLowAlertLap: -1,
	}
}

func (r *ERSRule) Name() string {
	return "ers"
}

func (r *ERSRule) Category() string {
	return string(DirectiveCategoryERS)
}

func (r *ERSRule) ValidPhases() []DrivingPhase {
	return []DrivingPhase{PhaseOutLap, PhaseFlyingLap, PhaseRacing, PhaseInLap}
}

func (r *ERSRule) DedupScope() DedupScope {
	return DedupScopeLap
}

func (r *ERSRule) Reset(scope DedupScope) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if scope == DedupScopeLap || scope == DedupScopeNone {
		r.lastErsLowAlertLap = -1
	}
	if scope == DedupScopeStint || scope == DedupScopeNone {
		r.lastEngineOverheatAlert = 0
	}
}

func (r *ERSRule) Evaluate(ctx *EvaluationContext) []Directive {
	r.mu.Lock()
	defer r.mu.Unlock()

	var directives []Directive

	currentLapNum := 1
	if pLap := ctx.PlayerLap(); pLap != nil && pLap.CurrentLapNum > 0 {
		currentLapNum = int(pLap.CurrentLapNum)
	}

	// 1. Low ERS Battery Reserve Alert (from CarStatusData)
	status := ctx.PlayerStatus()
	if status != nil && (ctx.Packet == nil || isPacketType[*packets.PacketCarStatusData](ctx.Packet)) {
		ersPct := (status.ERSStoreEnergy / packets.MaxERSStoreEnergyJoules) * 100.0
		if ersPct <= ctx.Config.ERSLowPct && currentLapNum != r.lastErsLowAlertLap && (ctx.Phase == PhaseFlyingLap || ctx.IsRaceSession()) {
			r.lastErsLowAlertLap = currentLapNum
			var ersMsg string
			if ctx.Is2026() {
				ersMsg = fmt.Sprintf("ERS battery reserve is low at %d%%! Advise driver to limit Override/Boost usage and use Lift & Coast for MGU-K regeneration on straights.", int(math.Round(float64(ersPct))))
			} else {
				ersMsg = fmt.Sprintf("ERS battery reserve is low at %d%%! Advise driver to switch deploy mode to None or Harvest on straights.", int(math.Round(float64(ersPct))))
			}
			directives = append(directives, Directive{
				ID:       "ers_low",
				Category: DirectiveCategoryERS,
				SubAlert: "ers_low",
				Title:    "Low ERS Battery",
				Message:  ersMsg,
				Urgency:  UrgencyLow,
			})
		}
	}

	// 2. Engine Core Radiator Overheating (from CarTelemetryData)
	tele := ctx.PlayerTelemetry()
	if tele != nil && (ctx.Packet == nil || isPacketType[*packets.PacketCarTelemetryData](ctx.Packet)) {
		now := ctx.Now
		if now == 0 {
			now = time.Now().UnixMilli()
		}
		if float32(tele.EngineTemperature) >= ctx.Config.EngineOverheatC && (now-r.lastEngineOverheatAlert > EngineOverheatCooldownMs) {
			r.lastEngineOverheatAlert = now
			directives = append(directives, Directive{
				ID:       "engine_temp",
				Category: DirectiveCategoryERS,
				SubAlert: "radiator_overheat",
				Title:    "Engine Radiator Overheating",
				Message:  fmt.Sprintf("Engine core water/oil temperatures are high at %d°C (limit: %d°C)!", tele.EngineTemperature, int(ctx.Config.EngineOverheatC)),
				Urgency:  UrgencyMedium,
			})
		}
	}

	return directives
}
