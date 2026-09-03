package engineer

import (
	"fmt"
	"math"

	"github.com/mgauna/f1game-telemetry-go/internal/packets"
)

// ERSRule manages low ERS battery reserve and engine radiator overheating alerts.
type ERSRule struct{}

// NewERSRule creates a new ERSRule.
func NewERSRule() *ERSRule {
	return &ERSRule{}
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

func (r *ERSRule) AlertKeys() map[string]AlertKeyConfig {
	return map[string]AlertKeyConfig{
		"ers_low": {
			ValidPhases: []DrivingPhase{PhaseFlyingLap, PhaseRacing},
			DedupScope:  DedupScopeLap,
		},
		"engine_temp": {
			ValidPhases: []DrivingPhase{PhaseOutLap, PhaseFlyingLap, PhaseRacing, PhaseInLap},
			DedupScope:  DedupScopeStint,
		},
	}
}

func (r *ERSRule) Reset(scope DedupScope) {
	// State is managed by engine deduplication & cooldowns
}

func (r *ERSRule) Evaluate(ctx *EvaluationContext) []Directive {
	var directives []Directive

	// 1. Low ERS Battery Reserve Alert (from CarStatusData)
	status := ctx.PlayerStatus()
	if status != nil && (ctx.Packet == nil || isPacketType[*packets.PacketCarStatusData](ctx.Packet)) {
		ersPct := (status.ERSStoreEnergy / packets.MaxERSStoreEnergyJoules) * 100.0
		if ersPct <= ctx.Config.ERSLowPct && (ctx.Phase == PhaseFlyingLap || ctx.IsRaceSession()) {
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
		if float32(tele.EngineTemperature) >= ctx.Config.EngineOverheatC {
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
