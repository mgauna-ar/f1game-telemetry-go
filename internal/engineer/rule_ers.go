package engineer

import (
	"fmt"
	"math"

	"github.com/mgauna/f1game-telemetry-go/internal/packets"
)

// ERSRule manages low ERS battery reserve, ERS clipping and engine temperature alerts.
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
	return []DrivingPhase{PhaseOutLap, PhaseFlyingLap, PhaseRacing, PhaseInLap, PhaseSafetyCar}
}

// engineTempPhases are where the engine temperature calls are made: on track, the Safety Car
// included (a slow car runs hot).
var engineTempPhases = []DrivingPhase{PhaseOutLap, PhaseFlyingLap, PhaseRacing, PhaseInLap, PhaseSafetyCar}

func (r *ERSRule) AlertKeys() map[string]AlertKeyConfig {
	return map[string]AlertKeyConfig{
		"ers_low": {
			ValidPhases: []DrivingPhase{PhaseRacing},
			DedupScope:  DedupScopeLap,
			MaxDelayMs:  ConditionMaxDelayMs,
		},
		"ers_clipping": {
			ValidPhases: []DrivingPhase{PhaseRacing},
			DedupScope:  DedupScopeLap,
			MaxDelayMs:  MomentMaxDelayMs,
		},
		// Each step of the engine temperature is its own call, so the climb to the next one is said.
		"engine_temp": {
			ValidPhases: engineTempPhases,
			DedupScope:  DedupScopeStint,
			MaxDelayMs:  ConditionMaxDelayMs,
			MinRepeatMs: EngineTempMinRepeatMs,
		},
		"engine_temp_high": {
			ValidPhases: engineTempPhases,
			DedupScope:  DedupScopeStint,
			MaxDelayMs:  ConditionMaxDelayMs,
			MinRepeatMs: EngineTempMinRepeatMs,
		},
		"engine_temp_critical": {
			ValidPhases: engineTempPhases,
			DedupScope:  DedupScopeStint,
			MaxDelayMs:  ConditionMaxDelayMs,
			MinRepeatMs: EngineTempMinRepeatMs,
		},
	}
}

func (r *ERSRule) Reset(scope DedupScope) {
	// State is managed by engine deduplication & cooldowns
}

func (r *ERSRule) Evaluate(ctx *EvaluationContext) []Directive {
	var directives []Directive

	// 1. Low ERS Battery Reserve Alert & Clipping (from CarStatusData)
	status := ctx.PlayerStatus()
	if status != nil && (ctx.Packet == nil || isPacketType[*packets.PacketCarStatusData](ctx.Packet)) {
		ersPct := (status.ERSStoreEnergy / packets.MaxERSStoreEnergyJoules) * 100.0
		playerLap := ctx.PlayerLap()

		// Neutralization Shield: do not warn for low ERS under SC/VSC
		isNeutralized := ctx.Phase == PhaseSafetyCar ||
			(ctx.Session != nil && ctx.Session.SafetyCarStatus != packets.SafetyCarNone) ||
			(playerLap != nil && playerLap.SafetyCarDelta != 0)

		// Push Lap / Deploy Mode Shield: intentional drain in Hotlap or Overtake mode
		isPushMode := status.ERSDeployMode == packets.ERSDeployModeHotlap || status.ERSDeployMode == packets.ERSDeployModeOvertake

		// Final Sector / Finish Line Shield: intentional depletion on main straight
		lapFraction := CalculateLapDistanceFraction(ctx.Session, playerLap)
		isFinalSector := lapFraction >= ERSPushLapDistanceFraction

		if ersPct <= ctx.Config.ERSLowPct && ctx.IsRaceSession() && ctx.Phase == PhaseRacing &&
			!isNeutralized && !isPushMode && !isFinalSector {
			var ersMsg string
			if ctx.Is2026() {
				ersMsg = fmt.Sprintf("ERS battery reserve is low at %d%%! Use Lift & Coast for MGU-K regeneration on straights.", int(math.Round(float64(ersPct))))
			} else {
				ersMsg = fmt.Sprintf("ERS battery reserve is low at %d%%! Switch deploy mode to None or Harvest on straights.", int(math.Round(float64(ersPct))))
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

		// 1b. Per-Lap ERS Energy Clipping / Derate (Approaching 4.0MJ per-lap quota)
		if status.ERSDeployedThisLap >= ERSClippingThresholdJoules && ctx.IsRaceSession() && ctx.Phase == PhaseRacing &&
			!isNeutralized && lapFraction < ERSClippingMaxDistanceFraction {
			directives = append(directives, Directive{
				ID:       "ers_clipping",
				Category: DirectiveCategoryERS,
				SubAlert: "ers_clipping",
				Title:    "ERS Deployment Clipping",
				Message:  "Clipping, clipping! Per-lap ERS deployment limit reached. Battery boost is depleted until the line.",
				Urgency:  UrgencyMedium,
			})
		}
	}

	// 2. Engine temperature (from CarTelemetryData): the driver's limit, then two steps above it.
	tele := ctx.PlayerTelemetry()
	if tele != nil && (ctx.Packet == nil || isPacketType[*packets.PacketCarTelemetryData](ctx.Packet)) {
		engTemp := float32(tele.EngineTemperature)
		switch {
		case engTemp >= max(EnginePowerCritTempC, ctx.Config.EngineOverheatC):
			directives = append(directives, Directive{
				ID:       "engine_temp_critical",
				Category: DirectiveCategoryERS,
				SubAlert: "radiator_overheat_critical",
				Title:    "Critical Engine Temperature",
				Message:  fmt.Sprintf("Critical engine temperature, %d°C! Lift and coast and get out of the tow to cool it now.", tele.EngineTemperature),
				Urgency:  UrgencyHigh,
			})
		case engTemp >= max(EnginePowerWarnTempC, ctx.Config.EngineOverheatC):
			directives = append(directives, Directive{
				ID:       "engine_temp_high",
				Category: DirectiveCategoryERS,
				SubAlert: "radiator_overheat_high",
				Title:    "Engine Temperature Rising",
				Message:  fmt.Sprintf("Engine temperature still climbing, %d°C. Lift and coast into the braking zones and find clean air.", tele.EngineTemperature),
				Urgency:  UrgencyMedium,
			})
		case engTemp >= ctx.Config.EngineOverheatC:
			directives = append(directives, Directive{
				ID:       "engine_temp",
				Category: DirectiveCategoryERS,
				SubAlert: "radiator_overheat",
				Title:    "Engine Temperature High",
				Message:  fmt.Sprintf("Engine temperature is high at %d°C (limit: %d°C). Some lift and coast to cool it.", tele.EngineTemperature, int(ctx.Config.EngineOverheatC)),
				Urgency:  UrgencyMedium,
			})
		}
	}

	return directives
}
