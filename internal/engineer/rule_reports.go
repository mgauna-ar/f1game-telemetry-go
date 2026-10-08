package engineer

import (
	"fmt"
	"math"
	"strings"
	"sync"

	"github.com/mgauna/f1game-telemetry-go/internal/packets"
)

// ReportsRule makes the race's routine reports: the gaps to the cars around the player every few
// laps, and how many laps the tyres have left. Both carry their numbers (Directive.Values) for the
// dashboard to say.
type ReportsRule struct {
	mu           sync.Mutex
	gapReportLap int // the lap the last gap report was made on

	tyreCheckLap int // the lap the tyre life was last projected on
	tyreStops    int // the pit stop count the calls below are for
	tyreWarned   bool
	tyreLastSaid bool
	tyreEndSaid  bool
}

// NewReportsRule creates a new ReportsRule.
func NewReportsRule() *ReportsRule {
	return &ReportsRule{}
}

func (r *ReportsRule) Name() string {
	return "reports"
}

func (r *ReportsRule) Category() string {
	return string(DirectiveCategoryRivals)
}

func (r *ReportsRule) ValidPhases() []DrivingPhase {
	return []DrivingPhase{PhaseRacing}
}

func (r *ReportsRule) AlertKeys() map[string]AlertKeyConfig {
	return map[string]AlertKeyConfig{
		// The gap report keeps its lap: the rivals cooldown that a 2026 aero zone call starts would
		// hold it past its MaxDelayMs, and it already skips laps with a battle call.
		"gap_report": {
			Category:                DirectiveCategoryRivals,
			ValidPhases:             []DrivingPhase{PhaseRacing},
			SuppressAfterPitForLaps: PostPitSuppressionLaps,
			DedupScope:              DedupScopeNone,
			MaxDelayMs:              GapReportMaxDelayMs,
			SkipCategoryCooldown:    true,
		},
		"tyre_life": {
			Category:    DirectiveCategoryTyres,
			ValidPhases: []DrivingPhase{PhaseRacing},
			DedupScope:  DedupScopeNone,
			MaxDelayMs:  ConditionMaxDelayMs,
		},
		"tyre_life_end": {
			Category:    DirectiveCategoryTyres,
			ValidPhases: []DrivingPhase{PhaseRacing},
			DedupScope:  DedupScopeNone,
			MaxDelayMs:  ConditionMaxDelayMs,
		},
	}
}

func (r *ReportsRule) Reset(scope DedupScope) {
	r.mu.Lock()
	defer r.mu.Unlock()

	switch scope {
	case DedupScopeNone:
		r.gapReportLap, r.tyreCheckLap, r.tyreStops = 0, 0, 0
		r.resetTyreCallsLocked()
	case DedupScopeStint:
		r.resetTyreCallsLocked()
	case DedupScopePhase, DedupScopeLap:
	}
}

func (r *ReportsRule) resetTyreCallsLocked() {
	r.tyreWarned, r.tyreLastSaid, r.tyreEndSaid = false, false, false
}

func (r *ReportsRule) Evaluate(ctx *EvaluationContext) []Directive {
	r.mu.Lock()
	defer r.mu.Unlock()

	if ctx.Packet != nil && !isPacketType[*packets.PacketLapData](ctx.Packet) {
		return nil
	}
	lap := ctx.PlayerLap()
	if lap == nil || ctx.Session == nil || !ctx.IsRaceSession() || ctx.Phase != PhaseRacing || lap.CarPosition == 0 ||
		ctx.Session.SafetyCarStatus != packets.SafetyCarNone {
		return nil
	}

	// A flashback re-drives laps already reported on.
	n := int(lap.CurrentLapNum)
	if n < r.gapReportLap {
		r.gapReportLap = 0
	}
	if n < r.tyreCheckLap {
		r.tyreCheckLap = 0
	}

	var directives []Directive
	if d, ok := r.tyreLifeCall(ctx, lap); ok {
		directives = append(directives, d)
	}
	if d, ok := r.gapReport(ctx, lap); ok {
		directives = append(directives, d)
	}
	return directives
}

// gapReport says the player's position and the gaps to the cars within GapReportMaxGapSec ahead
// and behind, with how they are moving, early in every GapReportLaps-th lap. A report that can't
// be made on its lap (in-lap, out-lap, a rival call just made, the plan's "box next lap") comes on
// the next one. The last lap has its own call.
func (r *ReportsRule) gapReport(ctx *EvaluationContext, lap *packets.LapData) (Directive, bool) {
	n := int(lap.CurrentLapNum)
	every := ctx.Config.GapReportLaps
	if every <= 0 {
		every = DefaultGapReportLaps
	}
	if n < GapReportFirstLap || (r.gapReportLap > 0 && n < r.gapReportLap+every) {
		return Directive{}, false
	}
	if pct := ctx.CalculateLapDistancePct(); pct < GapReportFromLapPct || pct > GapReportToLapPct {
		return Directive{}, false
	}
	if ctx.BoxDueLap == n || isPlanHeadsUpLap(ctx, n) || isFinalLap(ctx, lap) || justPitted(ctx) || rivalCalledSince(ctx.CallLaps, n-1) {
		return Directive{}, false
	}
	r.gapReportLap = n

	values := &DirectiveValues{Position: int(lap.CarPosition)}
	if idx := carAtPosition(ctx.LapData, int(lap.CarPosition)-1); idx >= 0 {
		values.Ahead = gapToCar(ctx.PlayerLaps, idx, deltaToCarInFrontMS(*lap), true)
	}
	if idx := carAtPosition(ctx.LapData, int(lap.CarPosition)+1); idx >= 0 {
		values.Behind = gapToCar(ctx.PlayerLaps, idx, deltaToCarInFrontMS(ctx.LapData.LapData[idx]), false)
	}
	return Directive{
		ID:       "gap_report",
		Category: DirectiveCategoryRivals,
		SubAlert: "gap_report",
		Title:    "Gap Report",
		Message:  describeGapReport(values),
		Urgency:  UrgencyLow,
		Values:   values,
	}, true
}

// justPitted reports whether the player is on the laps after a pit stop, when the gaps are still
// settling.
func justPitted(ctx *EvaluationContext) bool {
	lap, status := ctx.PlayerLap(), ctx.PlayerStatus()
	return lap != nil && status != nil && lap.NumPitStops > 0 && int(status.TyresAgeLaps) <= PostPitSuppressionLaps
}

// rivalAlertKeys are the calls about a battle with the car ahead or behind; a gap report right
// after one would only repeat it.
var rivalAlertKeys = []string{"rival_defend", "rival_defend_override", "rival_attack", "rival_attack_override"}

func rivalCalledSince(callLaps map[string]int, lap int) bool {
	for _, k := range rivalAlertKeys {
		if callLaps[k] >= lap {
			return true
		}
	}
	return false
}

// gapToCar is the gap to a neighbour for the gap report, or nil when there is none or it is
// further than GapReportMaxGapSec.
func gapToCar(laps []LapRecord, carIdx int, gapMS uint32, ahead bool) *GapToCar {
	gap := msToSec(gapMS)
	if gapMS == 0 || gap > GapReportMaxGapSec {
		return nil
	}
	g := &GapToCar{GapSec: roundTo(gap, 1)}
	trend, ok := gapTrendOf(laps, carIdx, gapMS, ahead)
	switch {
	case !ok:
	case math.Abs(trend.PerLapSec) < GapTrendStableSecPerLap:
		g.Trend = GapStable
	case trend.PerLapSec < 0:
		g.Trend, g.PerLapSec = GapClosing, roundTo(-trend.PerLapSec, 1)
	default:
		g.Trend, g.PerLapSec = GapOpening, roundTo(trend.PerLapSec, 1)
	}
	return g
}

// describeGapReport writes the gap report for the server log and the AI race history.
func describeGapReport(v *DirectiveValues) string {
	parts := []string{fmt.Sprintf("P%d.", v.Position)}
	side := func(name string, g *GapToCar) {
		if g == nil {
			return
		}
		s := fmt.Sprintf("Gap %s %.1fs", name, g.GapSec)
		switch g.Trend {
		case GapClosing, GapOpening:
			s += fmt.Sprintf(", %s %.1fs a lap", g.Trend, g.PerLapSec)
		case GapStable:
			s += ", stable"
		}
		parts = append(parts, s+".")
	}
	side("ahead", v.Ahead)
	side("behind", v.Behind)
	if v.Ahead == nil && v.Behind == nil {
		parts = append(parts, fmt.Sprintf("Nobody within %.0f seconds.", GapReportMaxGapSec))
	}
	return strings.Join(parts, " ")
}

// tyreLifeCall projects the tyres' life once a lap from the stint's wear and says how many laps
// they have left when that first drops to TyreLifeWarnLaps and again at TyreLifeLastLaps, or that
// they make the end when they last the laps to go. Nothing on the last lap: the end is there.
func (r *ReportsRule) tyreLifeCall(ctx *EvaluationContext, lap *packets.LapData) (Directive, bool) {
	n := int(lap.CurrentLapNum)
	dmg := ctx.PlayerDamage()
	if n <= r.tyreCheckLap || dmg == nil || isFinalLap(ctx, lap) {
		return Directive{}, false
	}
	r.tyreCheckLap = n

	stops := int(lap.NumPitStops)
	if stops != r.tyreStops {
		r.tyreStops = stops
		r.resetTyreCallsLocked()
	}
	stint := stintLaps(ctx.PlayerLaps, stops)
	if len(stint) < TyreLifeMinStintLaps {
		return Directive{}, false
	}
	life, ok := projectTyreLife(stint, dmg.TyresWear, ctx.Config.TyreWearCritPct)
	if !ok {
		return Directive{}, false
	}
	toGo := raceLapsRemaining(ctx.Session, lap)
	wheel := wheelNames[life.Corner]

	switch {
	case toGo > 0 && life.LapsToLimit >= toGo:
		// While the game still plans a stop, "these tyres make the end" would argue with the
		// calls to box; it waits for the plan to be done.
		if r.tyreEndSaid || toGo > TyreLifeEndCallMaxLaps || planStopAhead(ctx) {
			return Directive{}, false
		}
		r.tyreEndSaid = true
		return Directive{
			ID:       "tyre_life_end",
			Category: DirectiveCategoryTyres,
			SubAlert: "tyre_life_end",
			Title:    "Tyres Make the End",
			Message:  fmt.Sprintf("These tyres make the end: %.1f laps of life on the %s for %.1f laps to go.", life.LapsToLimit, wheel, toGo),
			Urgency:  UrgencyLow,
		}, true
	case life.LapsToLimit <= TyreLifeLastLaps && !r.tyreLastSaid:
		r.tyreLastSaid, r.tyreWarned = true, true
		return tyreLifeDirective(life, wheel, UrgencyMedium), true
	case life.LapsToLimit <= TyreLifeWarnLaps && !r.tyreWarned:
		r.tyreWarned = true
		return tyreLifeDirective(life, wheel, UrgencyLow), true
	}
	return Directive{}, false
}

func tyreLifeDirective(life tyreLife, wheel, urgency string) Directive {
	laps := max(1, int(math.Round(life.LapsToLimit)))
	return Directive{
		ID:       "tyre_life",
		Category: DirectiveCategoryTyres,
		SubAlert: "tyre_life",
		Title:    "Tyre Life",
		Message:  fmt.Sprintf("About %d laps left on these tyres: the %s wears %.1f%% a lap.", laps, wheel, life.WearPerLapPct),
		Urgency:  urgency,
		Values:   &DirectiveValues{TyreLapsLeft: laps},
	}
}
