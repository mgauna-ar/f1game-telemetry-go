package engineer

import (
	"fmt"
	"math"
	"sync"

	"github.com/mgauna/f1game-telemetry-go/internal/packets"
)

// DamageRule manages front wing, floor/diffuser, engine components, and mechanical fault alerts.
type DamageRule struct {
	mu                   sync.Mutex
	lastWingDamageAlert  float32
	lastFloorDamageAlert bool
	lastEngineWearAlert  bool
	lastDrsFaultAlert    bool
	lastErsFaultAlert    bool
}

// NewDamageRule creates a new DamageRule.
func NewDamageRule() *DamageRule {
	return &DamageRule{}
}

func (r *DamageRule) Name() string {
	return "damage"
}

func (r *DamageRule) Category() string {
	return string(DirectiveCategoryDamage)
}

func (r *DamageRule) ValidPhases() []DrivingPhase {
	return []DrivingPhase{PhaseOutLap, PhaseFormationLap, PhaseGrid, PhaseRaceStart, PhaseFlyingLap, PhaseRacing, PhaseInLap, PhaseSafetyCar}
}

func (r *DamageRule) AlertKeys() map[string]AlertKeyConfig {
	return map[string]AlertKeyConfig{
		"damage_wing": {
			ValidPhases: []DrivingPhase{PhaseOutLap, PhaseFormationLap, PhaseGrid, PhaseRaceStart, PhaseFlyingLap, PhaseRacing, PhaseInLap, PhaseSafetyCar},
			DedupScope:  DedupScopeStint,
		},
		"damage_floor": {
			ValidPhases: []DrivingPhase{PhaseOutLap, PhaseFormationLap, PhaseGrid, PhaseRaceStart, PhaseFlyingLap, PhaseRacing, PhaseInLap, PhaseSafetyCar},
			DedupScope:  DedupScopeStint,
		},
		"damage_engine": {
			ValidPhases: []DrivingPhase{PhaseOutLap, PhaseFormationLap, PhaseFlyingLap, PhaseRacing, PhaseInLap, PhaseSafetyCar},
			DedupScope:  DedupScopeStint,
		},
		"damage_faults": {
			ValidPhases: []DrivingPhase{PhaseOutLap, PhaseFormationLap, PhaseFlyingLap, PhaseRacing, PhaseInLap, PhaseSafetyCar},
			DedupScope:  DedupScopeStint,
		},
	}
}

func (r *DamageRule) Reset(scope DedupScope) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if scope == DedupScopeStint || scope == DedupScopeNone {
		r.lastWingDamageAlert = 0
		r.lastFloorDamageAlert = false
		r.lastEngineWearAlert = false
		r.lastDrsFaultAlert = false
		r.lastErsFaultAlert = false
	}
}

func (r *DamageRule) Evaluate(ctx *EvaluationContext) []Directive {
	r.mu.Lock()
	defer r.mu.Unlock()

	if ctx.Packet != nil && !isPacketType[*packets.PacketCarDamageData](ctx.Packet) {
		return nil
	}

	dmg := ctx.PlayerDamage()
	if dmg == nil {
		return nil
	}

	var directives []Directive

	// 1. Front Wing Damage
	maxWing := float32(dmg.FrontLeftWingDamage)
	if float32(dmg.FrontRightWingDamage) > maxWing {
		maxWing = float32(dmg.FrontRightWingDamage)
	}

	if maxWing >= ctx.Config.WingDamageCritPct && r.lastWingDamageAlert < ctx.Config.WingDamageCritPct {
		r.lastWingDamageAlert = maxWing
		directives = append(directives, Directive{
			ID:       "damage_wing",
			Category: DirectiveCategoryDamage,
			SubAlert: "wing_damage",
			Title:    "Critical Wing Damage",
			Message:  fmt.Sprintf("Severe front wing damage detected (%d%% loss)! Massive aero loss on front axle. Order driver to box for front wing replacement.", int(math.Round(float64(maxWing)))),
			Urgency:  UrgencyCritical,
		})
	} else if maxWing >= ctx.Config.WingDamageWarnPct && r.lastWingDamageAlert < ctx.Config.WingDamageWarnPct {
		r.lastWingDamageAlert = maxWing
		directives = append(directives, Directive{
			ID:       "damage_wing",
			Category: DirectiveCategoryDamage,
			SubAlert: "wing_damage",
			Title:    "Front Wing Damage",
			Message:  fmt.Sprintf("Front wing endplate/flap damage detected (%d%%). Expect understeer in medium-to-high speed corners.", int(math.Round(float64(maxWing)))),
			Urgency:  UrgencyMedium,
		})
	}

	// 2. Floor & Diffuser Damage
	floorDiffDamage := float32(dmg.FloorDamage + dmg.DiffuserDamage)
	if floorDiffDamage >= ctx.Config.FloorDamageWarnPct && !r.lastFloorDamageAlert {
		r.lastFloorDamageAlert = true
		directives = append(directives, Directive{
			ID:       "damage_floor",
			Category: DirectiveCategoryDamage,
			SubAlert: "floor_damage",
			Title:    "Floor Aero Damage",
			Message:  fmt.Sprintf("Underfloor/diffuser aerodynamic damage confirmed (%d%%). Downforce levels and high-speed stability are compromised.", int(math.Round(float64(floorDiffDamage)))),
			Urgency:  UrgencyMedium,
		})
	}

	// 3. Internal Engine / Gearbox Component Wear
	maxEngineWear := float32(dmg.EngineICEWear)
	if float32(dmg.EngineMGUKWear) > maxEngineWear {
		maxEngineWear = float32(dmg.EngineMGUKWear)
	}
	if float32(dmg.EngineTCWear) > maxEngineWear {
		maxEngineWear = float32(dmg.EngineTCWear)
	}
	if float32(dmg.GearBoxDamage) > maxEngineWear {
		maxEngineWear = float32(dmg.GearBoxDamage)
	}

	if maxEngineWear >= ctx.Config.EngineWearWarnPct && !r.lastEngineWearAlert {
		r.lastEngineWearAlert = true
		directives = append(directives, Directive{
			ID:       "damage_engine",
			Category: DirectiveCategoryDamage,
			SubAlert: "engine_wear",
			Title:    "Engine Component Wear",
			Message:  fmt.Sprintf("Power unit / gearbox component wear reached %d%%!", int(math.Round(float64(maxEngineWear)))),
			Urgency:  UrgencyMedium,
		})
	}

	// 4. Mechanical Faults (DRS / Active Aero / ERS)
	if dmg.DRSFault == 1 && !r.lastDrsFaultAlert {
		r.lastDrsFaultAlert = true
		var faultMsg string
		if ctx.Is2026() {
			faultMsg = "Active Aero flap fault detected! Straight mode / aerodynamic wing adjustment unavailable."
		} else {
			faultMsg = "DRS flap fault detected! Rear wing flap cannot deploy."
		}
		directives = append(directives, Directive{
			ID:       "damage_faults",
			Category: DirectiveCategoryDamage,
			SubAlert: "aero_fault",
			Title:    "Aero Flap Fault",
			Message:  faultMsg,
			Urgency:  UrgencyCritical,
		})
	}

	if dmg.ERSFault == 1 && !r.lastErsFaultAlert {
		r.lastErsFaultAlert = true
		directives = append(directives, Directive{
			ID:       "damage_faults",
			Category: DirectiveCategoryDamage,
			SubAlert: "ers_fault",
			Title:    "Hybrid ERS Fault",
			Message:  "Hybrid ERS deployment failure detected on power unit! Electric boost offline.",
			Urgency:  UrgencyCritical,
		})
	}

	return directives
}
