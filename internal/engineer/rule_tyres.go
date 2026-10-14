package engineer

import (
	"fmt"
	"log/slog"
	"math"
	"sync"

	"github.com/mgauna/f1game-telemetry-go/internal/packets"
)

// TyresRule manages tyre wear alerts, thermal overheating, cold tyres, punctures and the wet/dry
// crossover.
type TyresRule struct {
	mu                      sync.Mutex
	triggeredWearThresholds map[float32]bool
	wornOutCalled           bool
	lastCrossoverTarget     string
	tyreSetAdvisoryFired    bool
	blisterAlertFired       [4]bool
	pressureAlertFired      bool

	// Puncture check: the damage of the last PunctureWindowMs, and per tyre whether a puncture was
	// called (with its damage then) and whether a damage jump or a pressure split was logged.
	damageSamples    []tyreDamageSample
	punctured        [4]bool
	punctureDamage   [4]uint8
	damageJumpLog    [4]bool
	pressureSplitLog [2]bool

	// How long it has been raining, raining hard, not raining hard and dry: the crossover waits
	// for the weather to hold.
	rain, heavyRain, notHeavyRain, dry conditionSpell
}

// tyreDamageSample is one damage packet's tyre damage, for the puncture check.
type tyreDamageSample struct {
	at     int64
	damage [4]uint8
}

// axleWheels are the tyres of each axle, front then rear, for the pressure checks.
var axleWheels = [2][2]int{
	{packets.WheelFrontLeft, packets.WheelFrontRight},
	{packets.WheelRearLeft, packets.WheelRearRight},
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
			ValidPhases:     []DrivingPhase{PhaseRacing, PhaseSafetyCar},
			DedupScope:      DedupScopeStint,
			MaxDelayMs:      ConditionMaxDelayMs,
			OutlastsSilence: true,
		},
		"tyre_puncture": {
			ValidPhases: []DrivingPhase{PhaseOutLap, PhaseFormationLap, PhaseGrid, PhaseRaceStart, PhaseFlyingLap, PhaseRacing, PhaseInLap, PhaseSafetyCar},
			DedupScope:  DedupScopeStint,
		},
		"tyre_worn_out": {
			ValidPhases: []DrivingPhase{PhaseRacing, PhaseSafetyCar},
			DedupScope:  DedupScopeStint,
		},
		"tyre_overheat": {
			ValidPhases:     []DrivingPhase{PhaseRacing},
			DedupScope:      DedupScopeStint,
			MaxDelayMs:      ConditionMaxDelayMs,
			OutlastsSilence: true,
		},
		"tyre_cold": {
			ValidPhases:        []DrivingPhase{PhaseOutLap, PhaseFormationLap, PhaseSafetyCar},
			MinLapDistancePct:  MinOutLapDistanceCompletionPct,
			DedupScope:         DedupScopePhase,
			MaxDelayMs:         ConditionMaxDelayMs,
			WaitsForSCToSettle: true,
		},
		"tyre_crossover": {
			ValidPhases: []DrivingPhase{PhaseRacing, PhaseSafetyCar},
			DedupScope:  DedupScopeStint,
			MaxDelayMs:  ConditionMaxDelayMs,
		},
		"tyre_crossover_slicks": {
			ValidPhases: []DrivingPhase{PhaseRacing, PhaseSafetyCar},
			DedupScope:  DedupScopeStint,
			MaxDelayMs:  ConditionMaxDelayMs,
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
			MaxDelayMs:  ConditionMaxDelayMs,
		},
		"tyre_blistering": {
			ValidPhases:     []DrivingPhase{PhaseRacing},
			DedupScope:      DedupScopeStint,
			MaxDelayMs:      ConditionMaxDelayMs,
			OutlastsSilence: true,
		},
		"tyre_pressure_high": {
			ValidPhases:     []DrivingPhase{PhaseRacing},
			DedupScope:      DedupScopeStint,
			MaxDelayMs:      ConditionMaxDelayMs,
			OutlastsSilence: true,
		},
	}
}

func (r *TyresRule) Reset(scope DedupScope) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if scope == DedupScopeStint || scope == DedupScopeNone {
		r.triggeredWearThresholds = make(map[float32]bool)
		r.wornOutCalled = false
		r.lastCrossoverTarget = ""
		r.tyreSetAdvisoryFired = false
		r.blisterAlertFired = [4]bool{}
		r.pressureAlertFired = false
		r.damageSamples = nil
		r.punctured = [4]bool{}
		r.punctureDamage = [4]uint8{}
		r.damageJumpLog = [4]bool{}
		r.pressureSplitLog = [2]bool{}
	}
	if scope == DedupScopeNone {
		r.rain, r.heavyRain, r.notHeavyRain, r.dry = conditionSpell{}, conditionSpell{}, conditionSpell{}, conditionSpell{}
	}
}

func (r *TyresRule) Evaluate(ctx *EvaluationContext) []Directive {
	r.mu.Lock()
	defer r.mu.Unlock()

	var directives []Directive

	// 1. Wear and punctures (from CarDamageData)
	dmg := ctx.PlayerDamage()
	if dmg != nil && (ctx.Packet == nil || isPacketType[*packets.PacketCarDamageData](ctx.Packet)) {
		var maxWear float32
		wornWheel := 0
		for i, w := range dmg.TyresWear {
			if w > maxWear {
				maxWear, wornWheel = w, i
			}
		}
		wear := &DirectiveValues{Wheel: wheelAt[wornWheel], Pct: int(math.Round(float64(maxWear)))}

		directives = append(directives, r.damagePunctures(ctx, dmg)...)

		switch {
		case maxWear >= TyreWornOutPct && !r.wornOutCalled:
			r.wornOutCalled = true
			directives = append(directives, Directive{
				ID:       "tyre_worn_out",
				Category: DirectiveCategoryTyres,
				SubAlert: "tyre_worn_out",
				Title:    "Tyre Worn Out",
				Message:  fmt.Sprintf("Tyre wear is at %d%%, the tyre is finished. Box now.", int(math.Round(float64(maxWear)))),
				Urgency:  UrgencyCritical,
				BoxCall:  BoxCallInstruction,
				Values:   wear,
			})
		case maxWear < TyreWornOutPct:
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
				subAlert := "tyre_wear"
				if maxWear >= ctx.Config.TyreWearCritPct {
					urgency = UrgencyHigh
					subAlert = "tyre_wear_critical"
				}
				directives = append(directives, Directive{
					ID:       "tyre_wear",
					Category: DirectiveCategoryTyres,
					SubAlert: subAlert,
					Title:    "Tyre Wear Alert",
					Message:  fmt.Sprintf("Tyre wear reached %d%% (stint age: %d laps).", int(math.Round(float64(maxWear))), currentTyreAge),
					Urgency:  urgency,
					Values:   wear,
				})
				break
			}
		}

		// Tyre Blistering Detection
		if ctx.Phase == PhaseRacing {
			for wIdx, blister := range dmg.TyreBlisters {
				if blister >= TyreBlisterWarnPct && !r.blisterAlertFired[wIdx] {
					r.blisterAlertFired[wIdx] = true
					directives = append(directives, Directive{
						ID:       "tyre_blistering",
						Category: DirectiveCategoryTyres,
						SubAlert: "tyre_blistering",
						Title:    "Tyre Blistering Detected",
						Message:  fmt.Sprintf("Tyre blistering detected on the %s tyre (%d%% blister)! Back off lateral loads and avoid aggressive curb strikes.", wheelLongNames[wIdx], blister),
						Urgency:  UrgencyMedium,
						Values:   &DirectiveValues{Wheel: wheelAt[wIdx], Pct: int(blister)},
					})
					break
				}
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
			if (i == packets.WheelRearLeft || i == packets.WheelRearRight) && val > rearMaxTemp {
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

		directives = append(directives, r.pressurePunctures(tele)...)

		window := GetTyreThermalWindow(actualCompound, visualCompound)
		overheatLimit := window.MaxTemp + ctx.Config.TyreTempMarginC
		coldLimit := window.MinTemp - ctx.Config.TyreTempMarginC

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
			})
		} else if maxSurfTemp > 0 && maxSurfTemp <= coldLimit && currentTyreAge < ColdTyresMaxAgeLaps {
			directives = append(directives, Directive{
				ID:       "tyre_cold",
				Category: DirectiveCategoryTyres,
				SubAlert: "tyre_cold",
				Title:    "Cold Tyre Temperature",
				Message:  fmt.Sprintf("%s tyre temperatures are cold (%d°C, target window: %d-%d°C). Weave and build tyre temperature.", window.CompoundName, int(math.Round(float64(maxSurfTemp))), int(window.MinTemp), int(window.MaxTemp)),
				Urgency:  UrgencyLow,
			})
		}

		// Tyre Pressure Spikes & Imbalance
		if ctx.Phase == PhaseRacing && !r.pressureAlertFired {
			flPress := tele.TyresPressure[packets.WheelFrontLeft]
			frPress := tele.TyresPressure[packets.WheelFrontRight]
			rlPress := tele.TyresPressure[packets.WheelRearLeft]
			rrPress := tele.TyresPressure[packets.WheelRearRight]

			var maxPress float32
			maxPressWheel := -1
			switch {
			case flPress >= TyrePressureMaxFrontPSI:
				maxPress, maxPressWheel = flPress, packets.WheelFrontLeft
			case frPress >= TyrePressureMaxFrontPSI:
				maxPress, maxPressWheel = frPress, packets.WheelFrontRight
			case rlPress >= TyrePressureMaxRearPSI:
				maxPress, maxPressWheel = rlPress, packets.WheelRearLeft
			case rrPress >= TyrePressureMaxRearPSI:
				maxPress, maxPressWheel = rrPress, packets.WheelRearRight
			}

			if maxPressWheel >= 0 {
				r.pressureAlertFired = true
				directives = append(directives, Directive{
					ID:       "tyre_pressure_high",
					Category: DirectiveCategoryTyres,
					SubAlert: "tyre_pressure_high",
					Title:    "High Tyre Pressure",
					Message:  fmt.Sprintf("%s tyre pressure is spiking (%.1f PSI)! Manage corner entry scrub to prevent crowning the contact patch.", wheelLongNames[maxPressWheel], maxPress),
					Urgency:  UrgencyMedium,
					Values:   &DirectiveValues{Wheel: wheelAt[maxPressWheel]},
				})
			} else {
				frontDiff := float32(math.Abs(float64(flPress - frPress)))
				rearDiff := float32(math.Abs(float64(rlPress - rrPress)))
				if frontDiff >= TyrePressureAsymmetryDeltaPSI {
					r.pressureAlertFired = true
					directives = append(directives, Directive{
						ID:       "tyre_pressure_high",
						Category: DirectiveCategoryTyres,
						SubAlert: "tyre_pressure_high",
						Title:    "Tyre Pressure Imbalance",
						Message:  fmt.Sprintf("Front axle tyre pressure disparity is high (%.1f vs %.1f PSI). Balance cornering load.", flPress, frPress),
						Urgency:  UrgencyLow,
						Values:   &DirectiveValues{Axle: AxleFront},
					})
				} else if rearDiff >= TyrePressureAsymmetryDeltaPSI {
					r.pressureAlertFired = true
					directives = append(directives, Directive{
						ID:       "tyre_pressure_high",
						Category: DirectiveCategoryTyres,
						SubAlert: "tyre_pressure_high",
						Title:    "Tyre Pressure Imbalance",
						Message:  fmt.Sprintf("Rear axle tyre pressure disparity is high (%.1f vs %.1f PSI). Balance traction load.", rlPress, rrPress),
						Urgency:  UrgencyLow,
						Values:   &DirectiveValues{Axle: AxleRear},
					})
				}
			}
		}
	}

	// 3. Wet/dry crossover: slicks, inters and wets for the weather on track.
	directives = append(directives, r.crossover(ctx)...)

	// 4. Tyre Set Allocation Advisory approaching pit window. The plan's "box next lap" heads-up
	// (pit_window) already says the stop is coming, so this is only said without it.
	if ctx.Session != nil && ctx.IsRaceSession() && ctx.Phase == PhaseRacing && !r.tyreSetAdvisoryFired &&
		!ctx.Config.IsAlertEnabled(string(DirectiveCategoryPitStrategy), "pit_window") {
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

				var advMsg string
				var values *DirectiveValues
				switch {
				case freshHard > 0:
					advMsg, values = "Pit window approaching. Fresh set of Hard tyres ready in the box.", &DirectiveValues{Compound: TyreHard}
				case freshMedium > 0:
					advMsg, values = "Pit window approaching. Fresh set of Medium tyres ready in the box.", &DirectiveValues{Compound: TyreMedium}
				case freshSoft > 0:
					advMsg, values = "Pit window approaching. Fresh set of Soft tyres ready in the box.", &DirectiveValues{Compound: TyreSoft}
				default:
					advMsg = "Pit window approaching. Scrubbed set prepared in the pit box."
				}

				directives = append(directives, Directive{
					ID:       "tyre_set_advisory",
					Category: DirectiveCategoryPitStrategy,
					SubAlert: "tyre_set_advisory",
					Title:    "Tyre Set Advisory",
					Message:  advMsg,
					Urgency:  UrgencyLow,
					Values:   values,
				})
			}
		}
	}

	return directives
}

// damagePunctures calls a puncture on a tyre whose damage jumped by PunctureDamageJumpPct within
// PunctureWindowMs. Wear only grows slowly; a jump like that is a cut tyre. A tyre whose damage
// went back down (a flashback) can be called again.
func (r *TyresRule) damagePunctures(ctx *EvaluationContext, dmg *packets.CarDamageData) []Directive {
	now := ctx.Now
	kept := r.damageSamples[:0]
	for _, smp := range r.damageSamples {
		if now-smp.at <= PunctureWindowMs {
			kept = append(kept, smp)
		}
	}
	kept = append(kept, tyreDamageSample{at: now, damage: dmg.TyresDamage})
	r.damageSamples = kept

	var directives []Directive
	for w := range dmg.TyresDamage {
		current := dmg.TyresDamage[w]
		if r.punctured[w] && float32(current)+PunctureDamageJumpPct <= float32(r.punctureDamage[w]) {
			r.punctured[w] = false
		}
		lowest := current
		for _, smp := range r.damageSamples {
			lowest = min(lowest, smp.damage[w])
		}
		jump := float32(current - lowest)
		if jump >= PunctureLogDamageJumpPct && !r.damageJumpLog[w] {
			r.damageJumpLog[w] = true
			slog.Info("Tyre damage jumped", "wheel", wheelLongNames[w], "from_pct", lowest, "to_pct", current, "within_ms", PunctureWindowMs)
		}
		if jump < PunctureDamageJumpPct || r.punctured[w] {
			continue
		}
		r.punctured[w] = true
		r.punctureDamage[w] = current
		slog.Info("Puncture called from tyre damage", "wheel", wheelLongNames[w], "from_pct", lowest, "to_pct", current)
		directives = append(directives, punctureDirective(w, fmt.Sprintf("tyre damage jumped to %d%%", current)))
	}
	return directives
}

// pressurePunctures calls a puncture on a tyre whose pressure fell PuncturePressureDropPSI below
// the other tyre on its axle. A split half that big is logged once a stint.
func (r *TyresRule) pressurePunctures(tele *packets.CarTelemetryData) []Directive {
	var directives []Directive
	for axle, wheels := range axleWheels {
		a, b := tele.TyresPressure[wheels[0]], tele.TyresPressure[wheels[1]]
		low, high := wheels[0], wheels[1]
		if a > b {
			low, high = high, low
		}
		split := tele.TyresPressure[high] - tele.TyresPressure[low]
		if split >= PuncturePressureDropPSI/2 && !r.pressureSplitLog[axle] {
			r.pressureSplitLog[axle] = true
			slog.Info("Tyre pressure split", "low_wheel", wheelLongNames[low], "low_psi", tele.TyresPressure[low], "high_psi", tele.TyresPressure[high])
		}
		if split < PuncturePressureDropPSI || r.punctured[low] || tele.TyresPressure[low] <= 0 {
			continue
		}
		r.punctured[low] = true
		slog.Info("Puncture called from tyre pressure", "wheel", wheelLongNames[low], "psi", tele.TyresPressure[low], "other_psi", tele.TyresPressure[high])
		directives = append(directives, punctureDirective(low, fmt.Sprintf("pressure down to %.1f PSI", tele.TyresPressure[low])))
	}
	return directives
}

func punctureDirective(wheel int, evidence string) Directive {
	return Directive{
		ID:       "tyre_puncture",
		Category: DirectiveCategoryTyres,
		SubAlert: "tyre_puncture",
		Title:    "Puncture",
		Message:  fmt.Sprintf("Puncture on the %s tyre (%s). Box now.", wheelLongNames[wheel], evidence),
		Urgency:  UrgencyCritical,
		BoxCall:  BoxCallInstruction,
		Values:   &DirectiveValues{Wheel: wheelAt[wheel]},
	}
}

// crossover calls the tyre change the weather asks for, in a race, once the weather has held
// and the forecast's next sample doesn't say it is about to turn back:
//   - slicks in rain: box for inters (at once in heavy rain);
//   - inters in heavy rain: box for wets;
//   - wets once the rain eases: box for inters;
//   - inters or wets on a dry track: the slicks are an option.
//
// Forecast rain alone is the rain warning's (weather_rain), not a tyre change.
func (r *TyresRule) crossover(ctx *EvaluationContext) []Directive {
	if ctx.Session == nil {
		return nil
	}
	now := ctx.Now
	weather := ctx.Session.Weather
	r.rain.update(weather >= packets.WeatherLightRain, now)
	r.heavyRain.update(weather >= packets.WeatherHeavyRain, now)
	r.notHeavyRain.update(weather < packets.WeatherHeavyRain, now)
	r.dry.update(weather < packets.WeatherLightRain, now)

	status := ctx.PlayerStatus()
	if status == nil || !ctx.IsRaceSession() || (ctx.Phase != PhaseRacing && ctx.Phase != PhaseSafetyCar) {
		return nil
	}
	compound := status.VisualTyreCompound
	isSlick := compound == packets.CompoundSoft || compound == packets.CompoundMedium || compound == packets.CompoundHard
	isInter := compound == packets.CompoundInter
	isWet := compound == packets.CompoundWet
	settled := int(status.TyresAgeLaps) >= TyreCrossoverMinStintLaps

	// What the forecast says comes next; with no sample, the weather on track decides alone.
	nextWet, nextHeavy, nextEasing, nextDry := true, true, true, true
	if next, ok := nextForecastSample(ctx.Session); ok {
		nextWet = next.Weather >= packets.WeatherLightRain || next.RainPercentage >= WeatherRainTransitionProbPct
		nextHeavy = next.Weather >= packets.WeatherHeavyRain || next.RainPercentage >= WeatherHeavyRainWetThreshold
		nextEasing = !nextHeavy
		nextDry = next.Weather < packets.WeatherLightRain && next.RainPercentage <= WeatherLightRainInterThreshold
	}

	switch {
	case isSlick && r.lastCrossoverTarget != "INTER" &&
		(weather >= packets.WeatherHeavyRain || (r.rain.heldFor(now, CrossoverRainConfirmMs) && nextWet)):
		r.lastCrossoverTarget = "INTER"
		urgency := UrgencyHigh
		if weather >= packets.WeatherHeavyRain {
			urgency = UrgencyCritical
		}
		return []Directive{{
			ID:       "tyre_crossover",
			Category: DirectiveCategoryTyres,
			SubAlert: "tyre_crossover",
			Title:    "Tyre Crossover (Box for Inters)",
			Message:  "It's raining and the forecast keeps it wet: too wet for slicks. Box for Intermediates.",
			Urgency:  urgency,
			BoxCall:  BoxCallInstruction,
			Values:   &DirectiveValues{Compound: TyreInter},
		}}
	case isInter && r.lastCrossoverTarget != "WET" &&
		(weather >= packets.WeatherStorm || (r.heavyRain.heldFor(now, CrossoverRainConfirmMs) && nextHeavy)):
		r.lastCrossoverTarget = "WET"
		return []Directive{{
			ID:       "tyre_crossover_wet",
			Category: DirectiveCategoryTyres,
			SubAlert: "tyre_crossover_wet",
			Title:    "Tyre Crossover (Box for Full Wets)",
			Message:  "Heavy rain is holding, standing water and aquaplaning risk. Box for Full Wets.",
			Urgency:  UrgencyCritical,
			BoxCall:  BoxCallInstruction,
			Values:   &DirectiveValues{Compound: TyreWet},
		}}
	case isWet && settled && r.lastCrossoverTarget != "INTER_DRYING" &&
		r.notHeavyRain.heldFor(now, CrossoverRainConfirmMs) && nextEasing:
		r.lastCrossoverTarget = "INTER_DRYING"
		return []Directive{{
			ID:       "tyre_crossover_inter",
			Category: DirectiveCategoryTyres,
			SubAlert: "tyre_crossover_inter",
			Title:    "Tyre Crossover (Box for Inters)",
			Message:  "The rain has eased and the standing water is clearing. Intermediates are faster now, box for Inters.",
			Urgency:  UrgencyHigh,
			BoxCall:  BoxCallInstruction,
			Values:   &DirectiveValues{Compound: TyreInter},
		}}
	case (isInter || isWet) && settled && r.lastCrossoverTarget != "SLICKS" &&
		r.dry.heldFor(now, CrossoverDryConfirmMs) && nextDry:
		r.lastCrossoverTarget = "SLICKS"
		return []Directive{{
			ID:       "tyre_crossover_slicks",
			Category: DirectiveCategoryTyres,
			SubAlert: "tyre_crossover_slicks",
			Title:    "Tyre Crossover (Slicks)",
			Message:  "The rain has stopped and the track is drying. Slicks are an option when you're ready.",
			Urgency:  UrgencyMedium,
			BoxCall:  BoxCallOption,
		}}
	}
	return nil
}

// nextForecastSample is the session's soonest forecast sample after now.
func nextForecastSample(session *packets.PacketSessionData) (packets.WeatherForecastSample, bool) {
	for _, smp := range sessionForecast(session) {
		if smp.TimeOffset > 0 {
			return smp, true
		}
	}
	return packets.WeatherForecastSample{}, false
}
