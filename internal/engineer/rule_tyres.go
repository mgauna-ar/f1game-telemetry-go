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
	lastCrossoverCompound   uint8
	lastCrossoverTarget     string
	tyreSetAdvisoryFired    bool
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
		"tyre_crossover": {
			ValidPhases: []DrivingPhase{PhaseRacing, PhaseSafetyCar},
			DedupScope:  DedupScopeStint,
		},
		"tyre_crossover_wet": {
			ValidPhases: []DrivingPhase{PhaseRacing, PhaseSafetyCar},
			DedupScope:  DedupScopeStint,
		},
		"tyre_crossover_inter": {
			ValidPhases: []DrivingPhase{PhaseRacing, PhaseSafetyCar},
			DedupScope:  DedupScopeStint,
		},
		"tyre_set_advisory": {
			Category:    DirectiveCategoryPitStrategy,
			ValidPhases: []DrivingPhase{PhaseRacing},
			DedupScope:  DedupScopeStint,
		},
	}
}

func (r *TyresRule) Reset(scope DedupScope) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if scope == DedupScopeStint || scope == DedupScopeNone {
		r.triggeredWearThresholds = make(map[float32]bool)
		r.lastPunctured = false
		r.lastCrossoverCompound = 0
		r.lastCrossoverTarget = ""
		r.tyreSetAdvisoryFired = false
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

		playerLap := ctx.PlayerLap()
		isNeutralized := ctx.Phase == PhaseSafetyCar ||
			(ctx.Session != nil && ctx.Session.SafetyCarStatus != packets.SafetyCarNone) ||
			(playerLap != nil && playerLap.SafetyCarDelta != 0)

		if rearMaxTemp >= overheatLimit && !isNeutralized {
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

	// 3. Tyre Crossover Strategy (Rain vs Slicks, Inters vs Full Wets)
	if ctx.Session != nil && ctx.IsRaceSession() && (ctx.Phase == PhaseRacing || ctx.Phase == PhaseSafetyCar) {
		status := ctx.PlayerStatus()
		if status != nil {
			visualCompound := status.VisualTyreCompound
			isSlick := visualCompound == packets.CompoundSoft || visualCompound == packets.CompoundMedium || visualCompound == packets.CompoundHard
			isInter := visualCompound == packets.CompoundInter
			isWet := visualCompound == packets.CompoundWet
			currentWeather := ctx.Session.Weather
			stintLaps := int(status.TyresAgeLaps)

			rainPct := uint8(0)
			if ctx.Session.NumWeatherForecastSamples > 0 {
				rainPct = ctx.Session.WeatherForecastSamples[0].RainPercentage
			}

			switch {
			case isSlick && (currentWeather >= packets.WeatherLightRain || rainPct >= WeatherRainTransitionProbPct) && r.lastCrossoverTarget != "INTER":
				// Case A: Slicks on wet track -> Urgent pit call for Intermediates
				r.lastCrossoverTarget = "INTER"
				directives = append(directives, Directive{
					ID:       "tyre_crossover",
					Category: DirectiveCategoryTyres,
					SubAlert: "tyre_crossover",
					Title:    "Tyre Crossover (Box for Inters)",
					Message:  "Track conditions are too wet for slick tyres! Box now, box box for Intermediates.",
					Urgency:  UrgencyCritical,
					Metadata: map[string]any{
						"current_compound": packets.VisualTyreCompoundName(visualCompound),
						"weather":          currentWeather,
						"target_compound":  "INTERMEDIATE",
					},
				})
			case isInter && (currentWeather >= packets.WeatherHeavyRain || rainPct >= WeatherHeavyRainWetThreshold) && r.lastCrossoverTarget != "WET":
				// Case B: Inters on heavy standing water -> Aquaplaning risk, box for Full Wets
				r.lastCrossoverTarget = "WET"
				directives = append(directives, Directive{
					ID:       "tyre_crossover_wet",
					Category: DirectiveCategoryTyres,
					SubAlert: "tyre_crossover_wet",
					Title:    "Tyre Crossover (Box for Full Wets)",
					Message:  "Track is saturated with standing water, aquaplaning risk! Box this lap for Full Wets.",
					Urgency:  UrgencyCritical,
					Metadata: map[string]any{
						"current_compound": "INTERMEDIATE",
						"weather":          currentWeather,
						"target_compound":  "WET",
					},
				})
			case isWet && (currentWeather <= packets.WeatherLightRain && rainPct <= WeatherLightRainInterThreshold) && stintLaps >= TyreCrossoverMinStintLaps && r.lastCrossoverTarget != "INTER_DRYING":
				// Case C: Full Wets on drying/easing rain -> Inters are much faster
				r.lastCrossoverTarget = "INTER_DRYING"
				directives = append(directives, Directive{
					ID:       "tyre_crossover_inter",
					Category: DirectiveCategoryTyres,
					SubAlert: "tyre_crossover_inter",
					Title:    "Tyre Crossover (Box for Inters)",
					Message:  "Rain has eased up and standing water is clearing. Intermediate tyre is much faster now, box for Inters.",
					Urgency:  UrgencyHigh,
					Metadata: map[string]any{
						"current_compound": "WET",
						"weather":          currentWeather,
						"target_compound":  "INTERMEDIATE",
					},
				})
			case (isInter || isWet) && currentWeather <= packets.WeatherLightCloud && stintLaps >= TyreCrossoverMinStintLaps && r.lastCrossoverTarget != "SLICKS":
				// Case D: Wet tyres on drying track -> Crossover approaching for Slicks
				r.lastCrossoverTarget = "SLICKS"
				directives = append(directives, Directive{
					ID:       "tyre_crossover",
					Category: DirectiveCategoryTyres,
					SubAlert: "tyre_crossover",
					Title:    "Tyre Crossover (Box for Slicks)",
					Message:  "Track is drying out, crossover window is approaching. Prepare to box for slicks.",
					Urgency:  UrgencyMedium,
					Metadata: map[string]any{
						"current_compound": packets.VisualTyreCompoundName(visualCompound),
						"weather":          currentWeather,
						"target_compound":  "SLICKS",
					},
				})
			}
		}
	}

	// 4. Tyre Set Allocation Advisory approaching pit window
	if ctx.Session != nil && ctx.IsRaceSession() && ctx.Phase == PhaseRacing && !r.tyreSetAdvisoryFired {
		idealLap := int(ctx.Session.PitStopWindowIdealLap)
		playerLap := ctx.PlayerLap()
		currentLapNum := 1
		if playerLap != nil && playerLap.CurrentLapNum > 0 {
			currentLapNum = int(playerLap.CurrentLapNum)
		}
		if idealLap > 0 && currentLapNum >= idealLap-1 && currentLapNum <= idealLap {
			tyreSets := ctx.PlayerTyreSets()
			if tyreSets != nil {
				r.tyreSetAdvisoryFired = true
				var freshHard, freshMedium, freshSoft int
				for i := 0; i < int(packets.MaxTyreSets); i++ {
					ts := tyreSets.TyreSetData[i]
					if ts.Available == 1 && ts.Wear == 0 {
						switch ts.VisualTyreCompound {
						case packets.CompoundHard:
							freshHard++
						case packets.CompoundMedium:
							freshMedium++
						case packets.CompoundSoft:
							freshSoft++
						}
					}
				}

				var advMsg, targetCompound string
				switch {
				case freshHard > 0:
					targetCompound = "HARD"
					advMsg = "Pit window approaching. Fresh set of Hard tyres ready in the box."
				case freshMedium > 0:
					targetCompound = "MEDIUM"
					advMsg = "Pit window approaching. Fresh set of Medium tyres ready in the box."
				case freshSoft > 0:
					targetCompound = "SOFT"
					advMsg = "Pit window approaching. Fresh set of Soft tyres ready in the box."
				default:
					targetCompound = "SCRUBBED"
					advMsg = "Pit window approaching. Scrubbed set prepared in the pit box."
				}

				directives = append(directives, Directive{
					ID:       "tyre_set_advisory",
					Category: DirectiveCategoryPitStrategy,
					SubAlert: "tyre_set_advisory",
					Title:    "Tyre Set Advisory",
					Message:  advMsg,
					Urgency:  UrgencyLow,
					Metadata: map[string]any{
						"target_compound": targetCompound,
						"fresh_hards":     freshHard,
						"fresh_mediums":   freshMedium,
						"fresh_softs":     freshSoft,
					},
				})
			}
		}
	}

	return directives
}
