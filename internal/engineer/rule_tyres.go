package engineer

import (
	"fmt"
	"math"
	"sync"

	"github.com/mgauna/f1game-telemetry-go/internal/packets"
)

// TyresRule manages tyre wear alerts, thermal overheating, cold tyres, and puncture bypass.
type TyresRule struct {
	mu                      sync.Mutex
	triggeredWearThresholds map[float32]bool
	lastPunctured           bool
}

// NewTyresRule creates a new TyresRule.
func NewTyresRule() *TyresRule {
	return &TyresRule{
		triggeredWearThresholds: make(map[float32]bool),
	}
}

func (r *TyresRule) Name() string {
	return "tyres"
}

func (r *TyresRule) Category() string {
	return string(DirectiveCategoryTyres)
}

func (r *TyresRule) ValidPhases() []DrivingPhase {
	return []DrivingPhase{PhaseOutLap, PhaseFormationLap, PhaseGrid, PhaseRaceStart, PhaseFlyingLap, PhaseRacing, PhaseInLap, PhaseSafetyCar}
}

func (r *TyresRule) AlertKeys() map[string]AlertKeyConfig {
	return map[string]AlertKeyConfig{
		"tyre_wear": {
			ValidPhases: []DrivingPhase{PhaseRacing, PhaseSafetyCar},
			DedupScope:  DedupScopeStint,
		},
		"tyre_puncture": {
			ValidPhases: []DrivingPhase{PhaseOutLap, PhaseFormationLap, PhaseGrid, PhaseRaceStart, PhaseFlyingLap, PhaseRacing, PhaseInLap, PhaseSafetyCar},
			DedupScope:  DedupScopeStint,
		},
		"tyre_overheat": {
			ValidPhases: []DrivingPhase{PhaseRacing},
			DedupScope:  DedupScopeStint,
		},
		"tyre_cold": {
			ValidPhases:       []DrivingPhase{PhaseOutLap, PhaseFormationLap, PhaseSafetyCar},
			MinLapDistancePct: MinOutLapDistanceCompletionPct,
			DedupScope:        DedupScopePhase,
		},
	}
}

func (r *TyresRule) Reset(scope DedupScope) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if scope == DedupScopeStint || scope == DedupScopeNone {
		r.triggeredWearThresholds = make(map[float32]bool)
		r.lastPunctured = false
	}
}

func (r *TyresRule) Evaluate(ctx *EvaluationContext) []Directive {
	r.mu.Lock()
	defer r.mu.Unlock()

	var directives []Directive

	// 1. Wear and Puncture (from CarDamageData)
	dmg := ctx.PlayerDamage()
	if dmg != nil && (ctx.Packet == nil || isPacketType[*packets.PacketCarDamageData](ctx.Packet)) {
		var maxWear float32
		for _, w := range dmg.TyresWear {
			if w > maxWear {
				maxWear = w
			}
		}

		// Critical puncture (Emergency bypass)
		if maxWear >= PunctureWearThresholdPct && !r.lastPunctured {
			r.lastPunctured = true
			directives = append(directives, Directive{
				ID:       "tyre_puncture",
				Category: DirectiveCategoryTyres,
				SubAlert: "tyre_puncture",
				Title:    "Critical Tyre Puncture",
				Message:  fmt.Sprintf("Critical tyre puncture! Wear is at %d%%. Box now, box box!", int(math.Round(float64(maxWear)))),
				Urgency:  UrgencyCritical,
			})
		} else if maxWear < PunctureWearThresholdPct {
			// Wear warning / critical thresholds
			activeThresholds := []float32{ctx.Config.TyreWearWarnPct, ctx.Config.TyreWearCritPct}
			currentTyreAge := 0
			if status := ctx.PlayerStatus(); status != nil {
				currentTyreAge = int(status.TyresAgeLaps)
			}

			for _, th := range activeThresholds {
				if th <= 0 || maxWear < th || r.triggeredWearThresholds[th] {
					continue
				}
				r.triggeredWearThresholds[th] = true
				urgency := UrgencyLow
				if maxWear >= ctx.Config.TyreWearCritPct {
					urgency = UrgencyHigh
				}
				directives = append(directives, Directive{
					ID:       "tyre_wear",
					Category: DirectiveCategoryTyres,
					SubAlert: "tyre_wear",
					Title:    "Tyre Wear Alert",
					Message:  fmt.Sprintf("Tyre wear reached %d%% (stint age: %d laps).", int(math.Round(float64(maxWear))), currentTyreAge),
					Urgency:  urgency,
					Metadata: map[string]any{
						"wear_pct":  maxWear,
						"tyre_age":  currentTyreAge,
						"threshold": th,
					},
				})
				break
			}
		}
	}

	// 2. Thermal Overheating & Cold Tires (from CarTelemetryData)
	tele := ctx.PlayerTelemetry()
	if tele != nil && (ctx.Packet == nil || isPacketType[*packets.PacketCarTelemetryData](ctx.Packet)) {
		var maxSurfTemp float32
		var rearMaxTemp float32
		for i, t := range tele.TyresSurfaceTemperature {
			val := float32(t)
			if val > maxSurfTemp {
				maxSurfTemp = val
			}
			if (i == TyreIndexRL || i == TyreIndexRR) && val > rearMaxTemp { // Rear Left / Rear Right
				rearMaxTemp = val
			}
		}

		currentTyreAge := 0
		var actualCompound, visualCompound uint8
		if status := ctx.PlayerStatus(); status != nil {
			currentTyreAge = int(status.TyresAgeLaps)
			actualCompound = status.ActualTyreCompound
			visualCompound = status.VisualTyreCompound
		}

		window := GetTyreThermalWindow(actualCompound, visualCompound)
		overheatLimit := window.MaxTemp + TyreDegradationTempMarginC
		coldLimit := window.MinTemp - TyreDegradationTempMarginC

		if rearMaxTemp >= overheatLimit {
			var advice string
			if ctx.Is2026() {
				advice = fmt.Sprintf("%s rear tyre surface temperatures are overheating at %d°C (optimal window: %d-%d°C)! Manage traction out of corners to protect the narrower rear tyres.", window.CompoundName, int(math.Round(float64(rearMaxTemp))), int(window.MinTemp), int(window.MaxTemp))
			} else {
				advice = fmt.Sprintf("%s rear tyre surface temperatures are overheating at %d°C (optimal window: %d-%d°C)! Manage traction out of corners to cool the rears.", window.CompoundName, int(math.Round(float64(rearMaxTemp))), int(window.MinTemp), int(window.MaxTemp))
			}
			directives = append(directives, Directive{
				ID:       "tyre_overheat",
				Category: DirectiveCategoryTyres,
				SubAlert: "tyre_overheat",
				Title:    "Tyre Overheating",
				Message:  advice,
				Urgency:  UrgencyMedium,
				Metadata: map[string]any{
					"compound":     window.CompoundName,
					"rear_temp_c":  rearMaxTemp,
					"limit_c":      overheatLimit,
					"window_min_c": window.MinTemp,
					"window_max_c": window.MaxTemp,
				},
			})
		} else if maxSurfTemp > 0 && maxSurfTemp <= coldLimit && currentTyreAge < ColdTyresMaxAgeLaps {
			directives = append(directives, Directive{
				ID:       "tyre_cold",
				Category: DirectiveCategoryTyres,
				SubAlert: "tyre_cold",
				Title:    "Cold Tyre Temperature",
				Message:  fmt.Sprintf("%s tyre temperatures are cold (%d°C, target window: %d-%d°C). Weave and build tyre temperature.", window.CompoundName, int(math.Round(float64(maxSurfTemp))), int(window.MinTemp), int(window.MaxTemp)),
				Urgency:  UrgencyLow,
				Metadata: map[string]any{
					"compound":     window.CompoundName,
					"max_temp_c":   maxSurfTemp,
					"limit_c":      coldLimit,
					"window_min_c": window.MinTemp,
					"window_max_c": window.MaxTemp,
				},
			})
		}
	}

	return directives
}
