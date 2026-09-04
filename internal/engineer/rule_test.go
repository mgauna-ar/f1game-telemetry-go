package engineer

import (
	"math"
	"strings"
	"testing"

	"github.com/mgauna/f1game-telemetry-go/internal/packets"
)

func TestTyresRule_Unit(t *testing.T) {
	rule := NewTyresRule()

	if rule.Name() != "tyres" {
		t.Fatalf("expected Name()=tyres, got %s", rule.Name())
	}
	if rule.Category() != string(DirectiveCategoryTyres) {
		t.Fatalf("expected Category()=tyres, got %s", rule.Category())
	}
	if rule.AlertKeys()["tyre_wear"].DedupScope != DedupScopeStint {
		t.Fatalf("expected DedupScope=stint for tyre_wear, got %s", rule.AlertKeys()["tyre_wear"].DedupScope)
	}

	cfg := DefaultEngineerConfig()

	// 1. Wear Warning at 42%
	damagePkt := &packets.PacketCarDamageData{
		CarDamageData: [packets.MaxCars]packets.CarDamageData{
			{TyresWear: [4]float32{42.0, 38.0, 30.0, 25.0}},
		},
	}
	ctx1 := &EvaluationContext{
		Damage:         damagePkt,
		Config:         cfg,
		PlayerCarIndex: 0,
		Phase:          PhaseRacing,
	}

	dirs := rule.Evaluate(ctx1)
	if len(dirs) != 1 {
		t.Fatalf("expected 1 directive, got %d", len(dirs))
	}
	if dirs[0].SubAlert != "tyre_wear" || dirs[0].Urgency != UrgencyLow {
		t.Fatalf("expected tyre_wear low urgency, got %s / %s", dirs[0].SubAlert, dirs[0].Urgency)
	}

	// 2. Evaluate again with same wear: should be deduplicated inside rule's triggeredWearThresholds
	dirsRepeat := rule.Evaluate(ctx1)
	if len(dirsRepeat) != 0 {
		t.Fatalf("expected 0 directives for repeated wear, got %d", len(dirsRepeat))
	}

	// 3. Stint Reset: wear warning at 42% should trigger again
	rule.Reset(DedupScopeStint)
	dirsAfterReset := rule.Evaluate(ctx1)
	if len(dirsAfterReset) != 1 {
		t.Fatalf("expected 1 directive after stint reset, got %d", len(dirsAfterReset))
	}

	// 4. Critical Puncture emergency bypass (>= 95%)
	puncturePkt := &packets.PacketCarDamageData{
		CarDamageData: [packets.MaxCars]packets.CarDamageData{
			{TyresWear: [4]float32{96.0, 20.0, 20.0, 20.0}},
		},
	}
	ctxPuncture := &EvaluationContext{
		Damage:         puncturePkt,
		Config:         cfg,
		PlayerCarIndex: 0,
		Phase:          PhaseRacing,
	}
	dirsPuncture := rule.Evaluate(ctxPuncture)
	if len(dirsPuncture) != 1 || dirsPuncture[0].SubAlert != "tyre_puncture" || dirsPuncture[0].Urgency != UrgencyCritical {
		t.Fatalf("expected tyre_puncture critical directive, got %+v", dirsPuncture)
	}

	// 5. Compound-Specific Thermal Overheating (C4 vs C1)
	telemetryPkt := &packets.PacketCarTelemetryData{
		CarTelemetryData: [packets.MaxCars]packets.CarTelemetryData{
			{
				TyresSurfaceTemperature: [4]uint8{100, 100, 112, 111}, // Rears at 112°C
			},
		},
	}

	// On C4 (Soft, window: 75-95°C, limit: 100°C), 112°C triggers overheat
	ctxOverheatC4 := &EvaluationContext{
		Telemetry: telemetryPkt,
		Status: &packets.PacketCarStatusData{
			CarStatusData: [packets.MaxCars]packets.CarStatusData{
				{ActualTyreCompound: packets.ActualCompoundC4},
			},
		},
		Config:         cfg,
		PlayerCarIndex: 0,
		Phase:          PhaseRacing,
	}
	dirsC4 := rule.Evaluate(ctxOverheatC4)
	if len(dirsC4) != 1 || dirsC4[0].SubAlert != "tyre_overheat" {
		t.Fatalf("expected tyre_overheat for C4 at 112°C, got %+v", dirsC4)
	}

	rule.Reset(DedupScopeNone)

	// On C1 (Hard, window: 95-115°C, limit: 120°C), 112°C is within acceptable operating range
	ctxOverheatC1 := &EvaluationContext{
		Telemetry: telemetryPkt,
		Status: &packets.PacketCarStatusData{
			CarStatusData: [packets.MaxCars]packets.CarStatusData{
				{ActualTyreCompound: packets.ActualCompoundC1},
			},
		},
		Config:         cfg,
		PlayerCarIndex: 0,
		Phase:          PhaseRacing,
	}
	dirsC1 := rule.Evaluate(ctxOverheatC1)
	if len(dirsC1) != 0 {
		t.Fatalf("expected no overheat for C1 at 112°C (window 95-115°C), got %+v", dirsC1)
	}
}

func TestDamageRule_Unit(t *testing.T) {
	rule := NewDamageRule()

	if rule.Name() != "damage" {
		t.Fatalf("expected Name()=damage, got %s", rule.Name())
	}
	if rule.Category() != string(DirectiveCategoryDamage) {
		t.Fatalf("expected Category()=damage, got %s", rule.Category())
	}

	cfg := DefaultEngineerConfig()

	// 1. Front Wing Warning (25%)
	dmgPkt := &packets.PacketCarDamageData{
		CarDamageData: [packets.MaxCars]packets.CarDamageData{
			{FrontLeftWingDamage: 25},
		},
	}
	ctxWing := &EvaluationContext{
		Damage:         dmgPkt,
		Config:         cfg,
		PlayerCarIndex: 0,
		Phase:          PhaseRacing,
	}

	dirs := rule.Evaluate(ctxWing)
	if len(dirs) != 1 || dirs[0].SubAlert != "wing_damage" || dirs[0].Urgency != UrgencyMedium {
		t.Fatalf("expected wing_damage medium urgency, got %+v", dirs)
	}

	// 2. Critical Wing Damage (45%)
	dmgPktCrit := &packets.PacketCarDamageData{
		CarDamageData: [packets.MaxCars]packets.CarDamageData{
			{FrontLeftWingDamage: 45},
		},
	}
	ctxWingCrit := &EvaluationContext{
		Damage:         dmgPktCrit,
		Config:         cfg,
		PlayerCarIndex: 0,
		Phase:          PhaseRacing,
	}
	dirsCrit := rule.Evaluate(ctxWingCrit)
	if len(dirsCrit) != 1 || dirsCrit[0].SubAlert != "wing_damage" || dirsCrit[0].Urgency != UrgencyCritical {
		t.Fatalf("expected wing_damage critical urgency, got %+v", dirsCrit)
	}

	// 3. Floor & Diffuser Damage
	rule.Reset(DedupScopeStint)
	dmgPktFloor := &packets.PacketCarDamageData{
		CarDamageData: [packets.MaxCars]packets.CarDamageData{
			{FloorDamage: 15, DiffuserDamage: 12}, // 27% > 25% threshold
		},
	}
	ctxFloor := &EvaluationContext{
		Damage:         dmgPktFloor,
		Config:         cfg,
		PlayerCarIndex: 0,
		Phase:          PhaseRacing,
	}
	dirsFloor := rule.Evaluate(ctxFloor)
	if len(dirsFloor) != 1 || dirsFloor[0].SubAlert != "floor_damage" {
		t.Fatalf("expected floor_damage directive, got %+v", dirsFloor)
	}

	// 4. Mechanical Faults (Active Aero & ERS)
	dmgPktFaults := &packets.PacketCarDamageData{
		CarDamageData: [packets.MaxCars]packets.CarDamageData{
			{DRSFault: 1, ERSFault: 1},
		},
	}
	ctxFaults := &EvaluationContext{
		Damage:         dmgPktFaults,
		Config:         cfg,
		PlayerCarIndex: 0,
		PacketFormat:   packets.PacketFormat2026,
		Phase:          PhaseRacing,
	}
	dirsFaults := rule.Evaluate(ctxFaults)
	if len(dirsFaults) != 2 {
		t.Fatalf("expected 2 fault directives, got %d", len(dirsFaults))
	}

	// 5. Terminal Engine Failure (EngineBlown / EngineSeized)
	rule.Reset(DedupScopeStint)
	dmgPktBlown := &packets.PacketCarDamageData{
		CarDamageData: [packets.MaxCars]packets.CarDamageData{
			{EngineBlown: 1},
		},
	}
	ctxBlown := &EvaluationContext{
		Damage:         dmgPktBlown,
		Config:         cfg,
		PlayerCarIndex: 0,
		Phase:          PhaseRacing,
	}
	dirsBlown := rule.Evaluate(ctxBlown)
	if len(dirsBlown) != 1 || dirsBlown[0].SubAlert != "terminal_engine" || dirsBlown[0].Urgency != UrgencyCritical {
		t.Fatalf("expected terminal_engine critical directive, got %+v", dirsBlown)
	}
}

func TestFlagsRule_Unit(t *testing.T) {
	rule := NewFlagsRule()

	if rule.Name() != "flags" {
		t.Fatalf("expected Name()=flags, got %s", rule.Name())
	}
	if rule.Category() != string(DirectiveCategoryFlags) {
		t.Fatalf("expected Category()=flags, got %s", rule.Category())
	}

	cfg := DefaultEngineerConfig()

	// 1. Safety Car & Red Flag
	sessionPkt := &packets.PacketSessionData{
		SessionType:       packets.SessionRace,
		SafetyCarStatus:   packets.SafetyCarFull,
		NumRedFlagPeriods: 1,
	}
	ctxSC := &EvaluationContext{
		Session:        sessionPkt,
		Config:         cfg,
		PlayerCarIndex: 0,
		Phase:          PhaseSafetyCar,
	}
	dirsSC := rule.Evaluate(ctxSC)
	if len(dirsSC) != 2 {
		t.Fatalf("expected 2 directives (SC + Red Flag), got %d: %+v", len(dirsSC), dirsSC)
	}

	// 2. Weather Radar Horizon Alert
	sessionPktWeather := &packets.PacketSessionData{
		SessionType:               packets.SessionRace,
		SafetyCarStatus:           packets.SafetyCarFull,
		NumWeatherForecastSamples: 1,
		WeatherForecastSamples: [packets.MaxWeatherForecastSamples]packets.WeatherForecastSample{
			{TimeOffset: 3, RainPercentage: 70},
		},
	}
	ctxWeather := &EvaluationContext{
		Session:        sessionPktWeather,
		Config:         cfg,
		PlayerCarIndex: 0,
		Phase:          PhaseRacing,
	}
	dirsWeather := rule.Evaluate(ctxWeather)
	if len(dirsWeather) != 1 || dirsWeather[0].SubAlert != "weather_rain" {
		t.Fatalf("expected weather_rain directive, got %+v", dirsWeather)
	}

	// 3. Safety Car Ending / Green Flag
	sessionPktClear := &packets.PacketSessionData{
		SessionType:     packets.SessionRace,
		SafetyCarStatus: packets.SafetyCarNone,
	}
	ctxClear := &EvaluationContext{
		Session:        sessionPktClear,
		Config:         cfg,
		PlayerCarIndex: 0,
		Phase:          PhaseRacing,
	}
	dirsClear := rule.Evaluate(ctxClear)
	if len(dirsClear) != 1 || dirsClear[0].SubAlert != "flags_green" {
		t.Fatalf("expected flags_green directive, got %+v", dirsClear)
	}

	// 4. Safety Car Returning Event (SC In This Lap)
	var scData packets.SafetyCarEventData
	scData.SafetyCarType = packets.SafetyCarFull
	scData.EventType = packets.SafetyCarEventReturning
	var scPayload [12]byte
	copy(scPayload[:], []byte{scData.SafetyCarType, scData.EventType})
	scEvtPkt := &packets.PacketEventData{
		EventStringCode: [4]uint8{'S', 'C', 'A', 'R'},
		EventDetails:    packets.EventDataDetails{Data: scPayload},
	}
	ctxSCEvt := &EvaluationContext{
		Session:        sessionPkt,
		Packet:         scEvtPkt,
		Config:         cfg,
		PlayerCarIndex: 0,
		Phase:          PhaseSafetyCar,
	}
	dirsSCEvt := rule.Evaluate(ctxSCEvt)
	if len(dirsSCEvt) != 1 || dirsSCEvt[0].SubAlert != "flags_sc_in" {
		t.Fatalf("expected flags_sc_in directive, got %+v", dirsSCEvt)
	}

	// 5. Blue Flag & Yellow Flag from CarStatus
	ctxBlueFlag := &EvaluationContext{
		Session: sessionPktClear,
		Status: &packets.PacketCarStatusData{
			CarStatusData: [packets.MaxCars]packets.CarStatusData{
				{VehicleFIAFlags: packets.VehicleFIAFlagBlue},
			},
		},
		Config:         cfg,
		PlayerCarIndex: 0,
		Phase:          PhaseRacing,
	}
	dirsBlue := rule.Evaluate(ctxBlueFlag)
	if len(dirsBlue) != 1 || dirsBlue[0].SubAlert != "flags_blue" {
		t.Fatalf("expected flags_blue directive, got %+v", dirsBlue)
	}

	ctxYellowFlag := &EvaluationContext{
		Session: sessionPktClear,
		Status: &packets.PacketCarStatusData{
			CarStatusData: [packets.MaxCars]packets.CarStatusData{
				{VehicleFIAFlags: packets.VehicleFIAFlagYellow},
			},
		},
		Config:         cfg,
		PlayerCarIndex: 0,
		Phase:          PhaseRacing,
	}
	dirsYellow := rule.Evaluate(ctxYellowFlag)
	if len(dirsYellow) != 1 || dirsYellow[0].SubAlert != "flags_yellow" {
		t.Fatalf("expected flags_yellow directive, got %+v", dirsYellow)
	}

	// 6. Penalty Priority: when Penalties > 0, penalty supersedes track limits warning
	lapPktWithPenalty := &packets.PacketLapData{
		LapData: [packets.MaxCars]packets.LapData{
			{CornerCuttingWarnings: 3, Penalties: 10},
		},
	}
	ctxLapPenalty := &EvaluationContext{
		LapData:        lapPktWithPenalty,
		Config:         cfg,
		PlayerCarIndex: 0,
		Phase:          PhaseRacing,
	}
	dirsLapPenalty := rule.Evaluate(ctxLapPenalty)
	if len(dirsLapPenalty) != 1 || dirsLapPenalty[0].SubAlert != "penalties_incurred" {
		t.Fatalf("expected penalty to supersede track limits warning, got %+v", dirsLapPenalty)
	}

	// 7. Track Limits warning fires when no penalty is incurred
	rule.Reset(DedupScopeNone)
	lapPktWarningOnly := &packets.PacketLapData{
		LapData: [packets.MaxCars]packets.LapData{
			{CornerCuttingWarnings: 3, Penalties: 0},
		},
	}
	ctxLapWarn := &EvaluationContext{
		LapData:        lapPktWarningOnly,
		Config:         cfg,
		PlayerCarIndex: 0,
		Phase:          PhaseRacing,
	}
	dirsLapWarn := rule.Evaluate(ctxLapWarn)
	if len(dirsLapWarn) != 1 || dirsLapWarn[0].SubAlert != "track_limits_warnings" {
		t.Fatalf("expected track limits warning directive, got %+v", dirsLapWarn)
	}

	// 7. Wrong Way warning (DrivingWrongWay == 1 in 2026 telemetry)
	rule.Reset(DedupScopeNone)
	ctxWrongWay := &EvaluationContext{
		Telemetry2: &packets.PacketCarTelemetry2Data{
			CarTelemetry2Data: [packets.MaxCars]packets.CarTelemetry2Data{
				{DrivingWrongWay: 1},
			},
		},
		Config:         cfg,
		PlayerCarIndex: 0,
		PacketFormat:   packets.PacketFormat2026,
		Phase:          PhaseRacing,
	}
	dirsWrongWay := rule.Evaluate(ctxWrongWay)
	if len(dirsWrongWay) != 1 || dirsWrongWay[0].SubAlert != "wrong_way" || dirsWrongWay[0].Urgency != UrgencyCritical {
		t.Fatalf("expected wrong_way critical directive, got %+v", dirsWrongWay)
	}
}

func TestERSRuleAndBrakesRule_Unit(t *testing.T) {
	ersRule := NewERSRule()
	brakesRule := NewBrakesRule()
	cfg := DefaultEngineerConfig()

	// 1. Low ERS
	statusPkt := &packets.PacketCarStatusData{
		CarStatusData: [packets.MaxCars]packets.CarStatusData{
			{ERSStoreEnergy: 400_000.0}, // 10% <= 15%
		},
	}
	ctxERS := &EvaluationContext{
		Status:         statusPkt,
		Session:        &packets.PacketSessionData{SessionType: packets.SessionRace},
		Config:         cfg,
		PlayerCarIndex: 0,
		Phase:          PhaseRacing,
		PacketFormat:   packets.PacketFormat2026,
	}
	dirsERS := ersRule.Evaluate(ctxERS)
	if len(dirsERS) != 1 || dirsERS[0].SubAlert != "ers_low" {
		t.Fatalf("expected ers_low directive, got %+v", dirsERS)
	}

	// 2. Brake Overheat
	telePkt := &packets.PacketCarTelemetryData{
		CarTelemetryData: [packets.MaxCars]packets.CarTelemetryData{
			{BrakesTemperature: [4]uint16{960, 920, 800, 800}},
		},
	}
	ctxBrakes := &EvaluationContext{
		Telemetry:      telePkt,
		Config:         cfg,
		PlayerCarIndex: 0,
		Phase:          PhaseRacing,
	}
	dirsBrakes := brakesRule.Evaluate(ctxBrakes)
	if len(dirsBrakes) != 1 || dirsBrakes[0].SubAlert != "brake_overheat" {
		t.Fatalf("expected brake_overheat directive, got %+v", dirsBrakes)
	}
}

func TestEngineerRules_AlertKeys(t *testing.T) {
	rules := []EngineerRule{
		NewTyresRule(),
		NewDamageRule(),
		NewERSRule(),
		NewBrakesRule(),
		NewFuelRule(),
		NewRivalsRule(),
		NewCoachingRule(),
		NewQualifyingRule(),
		NewFlagsRule(),
		NewTeammateRule(),
		NewTrafficRule(),
	}

	for _, rule := range rules {
		keys := rule.AlertKeys()
		if len(keys) == 0 {
			t.Errorf("rule %q defined 0 alert keys", rule.Name())
		}
		for k, cfg := range keys {
			if len(cfg.ValidPhases) == 0 {
				t.Errorf("rule %q key %q has no valid phases", rule.Name(), k)
			}
		}
	}
}

func TestFuelRule_TableDriven(t *testing.T) {
	cfg := DefaultEngineerConfig()

	tests := []struct {
		name         string
		ctx          *EvaluationContext
		wantAlerts   int
		wantSubAlert string
		wantUrgency  string
	}{
		{
			name: "fuel target deficit triggers alert on lap > MinFuelAlertLapNum",
			ctx: &EvaluationContext{
				Status: &packets.PacketCarStatusData{
					CarStatusData: [packets.MaxCars]packets.CarStatusData{
						{FuelRemainingLaps: -0.8},
					},
				},
				LapData: &packets.PacketLapData{
					LapData: [packets.MaxCars]packets.LapData{
						{CurrentLapNum: 4},
					},
				},
				Config:         cfg,
				PlayerCarIndex: 0,
				Phase:          PhaseRacing,
				Session: &packets.PacketSessionData{
					SessionType: packets.SessionRace,
				},
			},
			wantAlerts:   1,
			wantSubAlert: "fuel_deficit",
			wantUrgency:  UrgencyMedium,
		},
		{
			name: "early lap fuel deficit suppressed by lap guard",
			ctx: &EvaluationContext{
				Status: &packets.PacketCarStatusData{
					CarStatusData: [packets.MaxCars]packets.CarStatusData{
						{FuelRemainingLaps: -0.8},
					},
				},
				LapData: &packets.PacketLapData{
					LapData: [packets.MaxCars]packets.LapData{
						{CurrentLapNum: 2}, // <= MinFuelAlertLapNum (3)
					},
				},
				Config:         cfg,
				PlayerCarIndex: 0,
				Phase:          PhaseRacing,
				Session: &packets.PacketSessionData{
					SessionType: packets.SessionRace,
				},
			},
			wantAlerts: 0,
		},
		{
			name: "practice session fuel deficit suppressed",
			ctx: &EvaluationContext{
				Status: &packets.PacketCarStatusData{
					CarStatusData: [packets.MaxCars]packets.CarStatusData{
						{FuelRemainingLaps: -0.8},
					},
				},
				LapData: &packets.PacketLapData{
					LapData: [packets.MaxCars]packets.LapData{
						{CurrentLapNum: 5},
					},
				},
				Config:         cfg,
				PlayerCarIndex: 0,
				Phase:          PhaseRacing,
				Session: &packets.PacketSessionData{
					SessionType: packets.SessionP1,
				},
			},
			wantAlerts: 0,
		},
		{
			name: "pit stop window open alert on ideal lap",
			ctx: &EvaluationContext{
				LapData: &packets.PacketLapData{
					LapData: [packets.MaxCars]packets.LapData{
						{CurrentLapNum: 12, CarPosition: 3},
					},
				},
				Config:         cfg,
				PlayerCarIndex: 0,
				Phase:          PhaseRacing,
				Session: &packets.PacketSessionData{
					SessionType:           packets.SessionRace,
					PitStopWindowIdealLap: 12,
					PitStopRejoinPosition: 6,
					SafetyCarStatus:       packets.SafetyCarNone,
				},
			},
			wantAlerts:   1,
			wantSubAlert: "pit_window_open",
			wantUrgency:  UrgencyLow,
		},
		{
			name: "pit stop window close alert on latest lap",
			ctx: &EvaluationContext{
				LapData: &packets.PacketLapData{
					LapData: [packets.MaxCars]packets.LapData{
						{CurrentLapNum: 16, CarPosition: 3},
					},
				},
				Config:         cfg,
				PlayerCarIndex: 0,
				Phase:          PhaseRacing,
				Session: &packets.PacketSessionData{
					SessionType:            packets.SessionRace,
					PitStopWindowLatestLap: 16,
					SafetyCarStatus:        packets.SafetyCarNone,
				},
			},
			wantAlerts:   1,
			wantSubAlert: "pit_window_close",
			wantUrgency:  UrgencyHigh,
		},
		{
			name: "pit stop window suppressed under safety car",
			ctx: &EvaluationContext{
				LapData: &packets.PacketLapData{
					LapData: [packets.MaxCars]packets.LapData{
						{CurrentLapNum: 12, CarPosition: 3},
					},
				},
				Config:         cfg,
				PlayerCarIndex: 0,
				Phase:          PhaseSafetyCar,
				Session: &packets.PacketSessionData{
					SessionType:           packets.SessionRace,
					PitStopWindowIdealLap: 12,
					SafetyCarStatus:       packets.SafetyCarFull,
				},
			},
			wantAlerts: 0,
		},
		{
			name: "undercut threat from trailing rival pitting",
			ctx: &EvaluationContext{
				LapData: &packets.PacketLapData{
					LapData: [packets.MaxCars]packets.LapData{
						{CarPosition: 2, TotalDistance: 5000.0, CurrentLapNum: 10},
						{CarPosition: 3, TotalDistance: 4950.0, PitStatus: packets.PitStatusPitting, CurrentLapNum: 10},
					},
				},
				Config:         cfg,
				PlayerCarIndex: 0,
				Phase:          PhaseRacing,
				Session: &packets.PacketSessionData{
					SessionType:     packets.SessionRace,
					SafetyCarStatus: packets.SafetyCarNone,
				},
			},
			wantAlerts:   1,
			wantSubAlert: "undercut_window",
			wantUrgency:  UrgencyCritical,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rule := NewFuelRule()
			dirs := rule.Evaluate(tt.ctx)
			if len(dirs) != tt.wantAlerts {
				t.Fatalf("expected %d directives, got %d (%+v)", tt.wantAlerts, len(dirs), dirs)
			}
			if tt.wantAlerts > 0 {
				if dirs[0].SubAlert != tt.wantSubAlert {
					t.Errorf("expected SubAlert=%s, got %s", tt.wantSubAlert, dirs[0].SubAlert)
				}
				if dirs[0].Urgency != tt.wantUrgency {
					t.Errorf("expected Urgency=%s, got %s", tt.wantUrgency, dirs[0].Urgency)
				}
			}
		})
	}

	t.Run("fuel rule lap dedup and reset", func(t *testing.T) {
		rule := NewFuelRule()
		ctx := &EvaluationContext{
			Status: &packets.PacketCarStatusData{
				CarStatusData: [packets.MaxCars]packets.CarStatusData{
					{FuelRemainingLaps: -1.0},
				},
			},
			LapData: &packets.PacketLapData{
				LapData: [packets.MaxCars]packets.LapData{
					{CurrentLapNum: 5},
				},
			},
			Config:         cfg,
			PlayerCarIndex: 0,
			Phase:          PhaseRacing,
			Session: &packets.PacketSessionData{
				SessionType: packets.SessionRace,
			},
		}

		dirs1 := rule.Evaluate(ctx)
		if len(dirs1) != 1 {
			t.Fatalf("expected 1 directive on first evaluation, got %d", len(dirs1))
		}

		dirs2 := rule.Evaluate(ctx)
		if len(dirs2) != 0 {
			t.Fatalf("expected 0 directives on repeated evaluation on same lap, got %d", len(dirs2))
		}

		rule.Reset(DedupScopeLap)
		dirs3 := rule.Evaluate(ctx)
		if len(dirs3) != 1 {
			t.Fatalf("expected 1 directive after Reset(DedupScopeLap), got %d", len(dirs3))
		}
	})
}

func TestRivalsRule_TableDriven(t *testing.T) {
	cfg := DefaultEngineerConfig()

	t.Run("defend 2025 DRS threat with compound context", func(t *testing.T) {
		rule := NewRivalsRule()
		ctx := &EvaluationContext{
			LapData: &packets.PacketLapData{
				LapData: [packets.MaxCars]packets.LapData{
					{CarPosition: 3, TotalDistance: 2000.0},
					{CarPosition: 4, TotalDistance: 1960.0},
				},
			},
			Status: &packets.PacketCarStatusData{
				CarStatusData: [packets.MaxCars]packets.CarStatusData{
					{ActualTyreCompound: 16, TyresAgeLaps: 10},
					{ActualTyreCompound: 18, TyresAgeLaps: 2},
				},
			},
			Damage: &packets.PacketCarDamageData{
				CarDamageData: [packets.MaxCars]packets.CarDamageData{
					{},
					{FrontLeftWingDamage: 25},
				},
			},
			Config:         cfg,
			PlayerCarIndex: 0,
			Phase:          PhaseRacing,
			PacketFormat:   packets.PacketFormat2025,
			Session: &packets.PacketSessionData{
				SessionType:     packets.SessionRace,
				SafetyCarStatus: packets.SafetyCarNone,
			},
		}

		dirs := rule.Evaluate(ctx)
		if len(dirs) != 1 {
			t.Fatalf("expected 1 directive, got %d", len(dirs))
		}
		if dirs[0].SubAlert != "rival_defend" {
			t.Errorf("expected rival_defend, got %s", dirs[0].SubAlert)
		}
		if !strings.Contains(dirs[0].Message, "DRS threat") {
			t.Errorf("expected 2025 message to mention DRS threat: %s", dirs[0].Message)
		}
		if !strings.Contains(dirs[0].Message, "MEDIUM tyres") {
			t.Errorf("expected message to mention rival tyres: %s", dirs[0].Message)
		}
		if !strings.Contains(dirs[0].Message, "front wing damage") {
			t.Errorf("expected message to note rival front wing damage: %s", dirs[0].Message)
		}
	})

	t.Run("defend 2026 Override/Boost threat", func(t *testing.T) {
		rule := NewRivalsRule()
		ctx := &EvaluationContext{
			LapData: &packets.PacketLapData{
				LapData: [packets.MaxCars]packets.LapData{
					{CarPosition: 2, TotalDistance: 2000.0},
					{CarPosition: 3, TotalDistance: 1960.0},
				},
			},
			Config:         cfg,
			PlayerCarIndex: 0,
			Phase:          PhaseRacing,
			PacketFormat:   packets.PacketFormat2026,
			Session: &packets.PacketSessionData{
				SessionType:     packets.SessionRace,
				SafetyCarStatus: packets.SafetyCarNone,
			},
		}

		dirs := rule.Evaluate(ctx)
		if len(dirs) != 1 {
			t.Fatalf("expected 1 directive, got %d", len(dirs))
		}
		if !strings.Contains(dirs[0].Message, "Override/Boost attack threat") {
			t.Errorf("expected 2026 message to mention Override/Boost attack threat: %s", dirs[0].Message)
		}
	})

	t.Run("attack 2026 with Boost available", func(t *testing.T) {
		rule := NewRivalsRule()
		ctx := &EvaluationContext{
			LapData: &packets.PacketLapData{
				LapData: [packets.MaxCars]packets.LapData{
					{CarPosition: 2, TotalDistance: 2000.0},
					{CarPosition: 1, TotalDistance: 2050.0},
				},
			},
			Telemetry2: &packets.PacketCarTelemetry2Data{
				CarTelemetry2Data: [packets.MaxCars]packets.CarTelemetry2Data{
					{OvertakeAvailable: 1},
				},
			},
			Config:         cfg,
			PlayerCarIndex: 0,
			Phase:          PhaseRacing,
			PacketFormat:   packets.PacketFormat2026,
			Session: &packets.PacketSessionData{
				SessionType:     packets.SessionRace,
				SafetyCarStatus: packets.SafetyCarNone,
			},
		}

		dirs := rule.Evaluate(ctx)
		if len(dirs) != 1 {
			t.Fatalf("expected 1 directive, got %d", len(dirs))
		}
		if dirs[0].SubAlert != "rival_attack_override" {
			t.Errorf("expected rival_attack_override, got %s", dirs[0].SubAlert)
		}
		if !strings.Contains(dirs[0].Message, "Override Boost is available!") {
			t.Errorf("expected message to mention Override Boost is available: %s", dirs[0].Message)
		}
		if !strings.Contains(dirs[0].Message, "Straight Mode and Boost deployment") {
			t.Errorf("expected message to mention Straight Mode and Boost: %s", dirs[0].Message)
		}
	})

	t.Run("suppressed during Safety Car or non-racing phase", func(t *testing.T) {
		rule := NewRivalsRule()
		ctx := &EvaluationContext{
			LapData: &packets.PacketLapData{
				LapData: [packets.MaxCars]packets.LapData{
					{CarPosition: 2, TotalDistance: 2000.0},
					{CarPosition: 3, TotalDistance: 1980.0},
				},
			},
			Config:         cfg,
			PlayerCarIndex: 0,
			Phase:          PhaseSafetyCar,
			Session: &packets.PacketSessionData{
				SessionType:     packets.SessionRace,
				SafetyCarStatus: packets.SafetyCarFull,
			},
		}
		if dirs := rule.Evaluate(ctx); len(dirs) != 0 {
			t.Errorf("expected 0 directives under Safety Car, got %d", len(dirs))
		}
	})

	t.Run("defend using exact milliseconds delta from packet", func(t *testing.T) {
		rule := NewRivalsRule()
		ctx := &EvaluationContext{
			LapData: &packets.PacketLapData{
				LapData: [packets.MaxCars]packets.LapData{
					{CarPosition: 2, TotalDistance: 2000.0},
					{CarPosition: 3, TotalDistance: 1900.0, DeltaToCarInFrontMSPart: 750, DeltaToCarInFrontMinutesPart: 0},
				},
			},
			Config:         cfg,
			PlayerCarIndex: 0,
			Phase:          PhaseRacing,
			PacketFormat:   packets.PacketFormat2025,
			Session: &packets.PacketSessionData{
				SessionType:     packets.SessionRace,
				SafetyCarStatus: packets.SafetyCarNone,
			},
		}
		dirs := rule.Evaluate(ctx)
		if len(dirs) != 1 {
			t.Fatalf("expected 1 directive, got %d", len(dirs))
		}
		if !strings.Contains(dirs[0].Message, "0.8s gap") {
			t.Errorf("expected 0.8s gap formatted from 750ms exact delta, got: %s", dirs[0].Message)
		}
	})
}

func TestCoachingRule_TableDriven(t *testing.T) {
	cfg := DefaultEngineerConfig()
	rule := NewCoachingRule()

	sessionPkt := &packets.PacketSessionData{SessionType: packets.SessionRace}

	// Lap 1, Sector 0: establish baseline S1 = 25000ms
	ctxLap1S0 := &EvaluationContext{
		LapData: &packets.PacketLapData{
			LapData: [packets.MaxCars]packets.LapData{
				{
					CurrentLapNum:     1,
					Sector:            0,
					Sector1TimeMSPart: 25000,
					DriverStatus:      packets.DriverStatusFlyingLap,
					PitStatus:         packets.PitStatusNone,
				},
			},
		},
		Session:        sessionPkt,
		Config:         cfg,
		PlayerCarIndex: 0,
		Phase:          PhaseRacing,
	}
	rule.Evaluate(ctxLap1S0)
	if rule.GetBestSector1MS() != 25000 {
		t.Fatalf("expected best S1 to be 25000, got %d", rule.GetBestSector1MS())
	}

	// Lap 1, Sector 1: establish baseline S2 = 27000ms
	ctxLap1S1 := &EvaluationContext{
		LapData: &packets.PacketLapData{
			LapData: [packets.MaxCars]packets.LapData{
				{
					CurrentLapNum:     1,
					Sector:            1,
					Sector1TimeMSPart: 25000,
					Sector2TimeMSPart: 27000,
					DriverStatus:      packets.DriverStatusFlyingLap,
					PitStatus:         packets.PitStatusNone,
				},
			},
		},
		Session:        sessionPkt,
		Config:         cfg,
		PlayerCarIndex: 0,
		Phase:          PhaseRacing,
	}
	rule.Evaluate(ctxLap1S1)

	// Lap 2, Sector 1: S1 time was 25500ms (+0.50s delta vs 25000ms >= 0.35s threshold)
	ctxLap2S1 := &EvaluationContext{
		LapData: &packets.PacketLapData{
			LapData: [packets.MaxCars]packets.LapData{
				{
					CurrentLapNum:     2,
					Sector:            1,
					Sector1TimeMSPart: 25500,
					DriverStatus:      packets.DriverStatusFlyingLap,
					PitStatus:         packets.PitStatusNone,
				},
			},
		},
		Session:        sessionPkt,
		Config:         cfg,
		PlayerCarIndex: 0,
		Phase:          PhaseRacing,
	}
	rule.Evaluate(ctxLap2S1)
	dirsS1 := rule.Evaluate(ctxLap2S1)
	if len(dirsS1) != 1 || dirsS1[0].SubAlert != "sector_delta" || dirsS1[0].ID != "coaching_s1" {
		t.Fatalf("expected coaching_s1 directive, got %+v", dirsS1)
	}

	// Lap 2, Sector 2: S2 time was 27600ms (+0.60s delta vs 27000ms >= 0.35s threshold)
	ctxLap2S2 := &EvaluationContext{
		LapData: &packets.PacketLapData{
			LapData: [packets.MaxCars]packets.LapData{
				{
					CurrentLapNum:     2,
					Sector:            2,
					Sector1TimeMSPart: 25500,
					Sector2TimeMSPart: 27600,
					DriverStatus:      packets.DriverStatusFlyingLap,
					PitStatus:         packets.PitStatusNone,
				},
			},
		},
		Session:        sessionPkt,
		Config:         cfg,
		PlayerCarIndex: 0,
		Phase:          PhaseRacing,
	}
	dirsS2 := rule.Evaluate(ctxLap2S2)
	if len(dirsS2) != 1 || dirsS2[0].SubAlert != "sector_delta" || dirsS2[0].ID != "coaching_s2" {
		t.Fatalf("expected coaching_s2 directive, got %+v", dirsS2)
	}

	// Reset clears baseline
	rule.Reset(DedupScopeNone)
	if rule.GetBestSector1MS() != 0 {
		t.Errorf("expected best S1 to be 0 after reset, got %d", rule.GetBestSector1MS())
	}
}

func TestQualifyingRule_TableDriven(t *testing.T) {
	cfg := DefaultEngineerConfig()

	t.Run("lap invalidation on track limits", func(t *testing.T) {
		rule := NewQualifyingRule()
		ctx := &EvaluationContext{
			LapData: &packets.PacketLapData{
				LapData: [packets.MaxCars]packets.LapData{
					{CurrentLapNum: 3, CurrentLapInvalid: 1, DriverStatus: packets.DriverStatusFlyingLap},
				},
			},
			Config:         cfg,
			PlayerCarIndex: 0,
			Phase:          PhaseFlyingLap,
			Session: &packets.PacketSessionData{
				SessionType: packets.SessionQ1,
			},
		}
		dirs := rule.Evaluate(ctx)
		if len(dirs) != 1 || dirs[0].SubAlert != "qualy_deleted_lap" {
			t.Fatalf("expected qualy_deleted_lap directive, got %+v", dirs)
		}
		dirsRepeat := rule.Evaluate(ctx)
		if len(dirsRepeat) != 0 {
			t.Fatalf("expected 0 directives for repeated invalidation on same lap, got %d", len(dirsRepeat))
		}
	})

	t.Run("out-lap traffic ahead in final sector", func(t *testing.T) {
		rule := NewQualifyingRule()
		ctxTraffic := &EvaluationContext{
			LapData: &packets.PacketLapData{
				LapData: [packets.MaxCars]packets.LapData{
					{CurrentLapNum: 1, DriverStatus: packets.DriverStatusOutLap, Sector: 2, TotalDistance: 5000.0},
					{TotalDistance: 5080.0},
				},
			},
			Config:         cfg,
			PlayerCarIndex: 0,
			Phase:          PhaseOutLap,
			Session: &packets.PacketSessionData{
				SessionType: packets.SessionQ2,
			},
		}
		dirs := rule.Evaluate(ctxTraffic)
		if len(dirs) != 1 || dirs[0].SubAlert != "qualy_traffic" || dirs[0].Urgency != UrgencyCritical {
			t.Fatalf("expected critical qualy_traffic directive, got %+v", dirs)
		}

		rule.Reset(DedupScopeLap)
		ctxClean := &EvaluationContext{
			LapData: &packets.PacketLapData{
				LapData: [packets.MaxCars]packets.LapData{
					{CurrentLapNum: 1, DriverStatus: packets.DriverStatusOutLap, Sector: 2, TotalDistance: 5000.0},
					{TotalDistance: 5350.0},
				},
			},
			Config:         cfg,
			PlayerCarIndex: 0,
			Phase:          PhaseOutLap,
			Session: &packets.PacketSessionData{
				SessionType: packets.SessionQ2,
			},
		}
		dirsClean := rule.Evaluate(ctxClean)
		if len(dirsClean) != 1 || dirsClean[0].SubAlert != "qualy_clean_air" || dirsClean[0].Urgency != UrgencyLow {
			t.Fatalf("expected low urgency qualy_clean_air directive, got %+v", dirsClean)
		}
	})

	t.Run("session clock countdown warning", func(t *testing.T) {
		rule := NewQualifyingRule()
		ctx := &EvaluationContext{
			Session: &packets.PacketSessionData{
				SessionType:     packets.SessionQ3,
				SessionTimeLeft: 120,
			},
			Config:         cfg,
			PlayerCarIndex: 0,
			Phase:          PhaseInGarage,
		}
		dirs := rule.Evaluate(ctx)
		if len(dirs) != 1 || dirs[0].SubAlert != "qualy_session_time" {
			t.Fatalf("expected qualy_session_time directive, got %+v", dirs)
		}
	})

	t.Run("elimination danger zone in Q1", func(t *testing.T) {
		rule := NewQualifyingRule()
		ctx := &EvaluationContext{
			LapData: &packets.PacketLapData{
				LapData: [packets.MaxCars]packets.LapData{
					{CarPosition: 17},
				},
			},
			Session: &packets.PacketSessionData{
				SessionType:     packets.SessionQ1,
				SessionTimeLeft: 240,
			},
			Config:         cfg,
			PlayerCarIndex: 0,
			Phase:          PhaseFlyingLap,
		}
		dirs := rule.Evaluate(ctx)
		if len(dirs) != 1 || dirs[0].SubAlert != "qualy_elimination_danger" {
			t.Fatalf("expected qualy_elimination_danger directive, got %+v", dirs)
		}
	})

	t.Run("in-lap cooldown and fast car behind traffic", func(t *testing.T) {
		rule := NewQualifyingRule()
		ctx := &EvaluationContext{
			LapData: &packets.PacketLapData{
				LapData: [packets.MaxCars]packets.LapData{
					{CurrentLapNum: 3, DriverStatus: packets.DriverStatusInLap, TotalDistance: 10000.0},
					{CurrentLapNum: 3, DriverStatus: packets.DriverStatusFlyingLap, TotalDistance: 9850.0}, // 150m behind on flying lap
				},
			},
			Session: &packets.PacketSessionData{
				SessionType: packets.SessionQ2,
			},
			Config:         cfg,
			PlayerCarIndex: 0,
			Phase:          PhaseInLap,
		}
		dirs := rule.Evaluate(ctx)
		if len(dirs) != 2 {
			t.Fatalf("expected 2 directives (inlap_cooldown and inlap_traffic_behind), got %d: %+v", len(dirs), dirs)
		}
		if dirs[0].SubAlert != "inlap_cooldown" {
			t.Errorf("expected first directive to be inlap_cooldown, got %s", dirs[0].SubAlert)
		}
		if dirs[1].SubAlert != "inlap_traffic_behind" {
			t.Errorf("expected second directive to be inlap_traffic_behind, got %s", dirs[1].SubAlert)
		}
	})
}

func TestTeammateRule_TableDriven(t *testing.T) {
	cfg := DefaultEngineerConfig()

	t.Run("teammate pitting alert", func(t *testing.T) {
		rule := NewTeammateRule()
		ctx := &EvaluationContext{
			LapData: &packets.PacketLapData{
				LapData: [packets.MaxCars]packets.LapData{
					{CurrentLapNum: 10, TotalDistance: 5000.0, DriverStatus: packets.DriverStatusOnTrack},
					{CurrentLapNum: 10, TotalDistance: 4800.0, PitStatus: packets.PitStatusPitting, DriverStatus: packets.DriverStatusOnTrack},
				},
			},
			Config:           cfg,
			PlayerCarIndex:   0,
			TeammateCarIndex: 1,
			Phase:            PhaseRacing,
		}
		dirs := rule.Evaluate(ctx)
		if len(dirs) != 1 || dirs[0].SubAlert != "teammate_pitting" {
			t.Fatalf("expected teammate_pitting directive, got %+v", dirs)
		}
	})

	t.Run("teammate ahead proximity alert", func(t *testing.T) {
		rule := NewTeammateRule()
		ctx := &EvaluationContext{
			LapData: &packets.PacketLapData{
				LapData: [packets.MaxCars]packets.LapData{
					{CurrentLapNum: 8, TotalDistance: 3000.0, DriverStatus: packets.DriverStatusOnTrack},
					{CurrentLapNum: 8, TotalDistance: 3090.0, DriverStatus: packets.DriverStatusOnTrack},
				},
			},
			Config:           cfg,
			PlayerCarIndex:   0,
			TeammateCarIndex: 1,
			Phase:            PhaseRacing,
		}
		dirs := rule.Evaluate(ctx)
		if len(dirs) != 1 || dirs[0].SubAlert != "teammate_proximity" {
			t.Fatalf("expected teammate_proximity directive, got %+v", dirs)
		}
	})

	t.Run("teammate double-stack alert when both cars pitting", func(t *testing.T) {
		rule := NewTeammateRule()
		ctx := &EvaluationContext{
			LapData: &packets.PacketLapData{
				LapData: [packets.MaxCars]packets.LapData{
					{CurrentLapNum: 15, PitStatus: packets.PitStatusPitting, DriverStatus: packets.DriverStatusOnTrack},
					{CurrentLapNum: 15, PitStatus: packets.PitStatusInPitArea, DriverStatus: packets.DriverStatusOnTrack},
				},
			},
			Config:           cfg,
			PlayerCarIndex:   0,
			TeammateCarIndex: 1,
			Phase:            PhasePitLane,
		}
		dirs := rule.Evaluate(ctx)
		if len(dirs) != 1 || dirs[0].SubAlert != "teammate_doublestack" {
			t.Fatalf("expected teammate_doublestack directive, got %+v", dirs)
		}
	})

	t.Run("suppressed when player or teammate in garage", func(t *testing.T) {
		rule := NewTeammateRule()
		ctx := &EvaluationContext{
			LapData: &packets.PacketLapData{
				LapData: [packets.MaxCars]packets.LapData{
					{CurrentLapNum: 1, DriverStatus: packets.DriverStatusInGarage},
					{CurrentLapNum: 1, PitStatus: packets.PitStatusPitting},
				},
			},
			Config:           cfg,
			PlayerCarIndex:   0,
			TeammateCarIndex: 1,
			Phase:            PhaseInGarage,
		}
		dirs := rule.Evaluate(ctx)
		if len(dirs) != 0 {
			t.Fatalf("expected 0 directives when in garage, got %d", len(dirs))
		}
	})
}

func TestTrafficRule_TableDriven(t *testing.T) {
	cfg := DefaultEngineerConfig()

	t.Run("clean air pit rejoin opportunity on modulo lap", func(t *testing.T) {
		rule := NewTrafficRule()
		ctx := &EvaluationContext{
			LapData: &packets.PacketLapData{
				LapData: [packets.MaxCars]packets.LapData{
					{CurrentLapNum: 5, TotalDistance: 10000.0},
					{CurrentLapNum: 5, TotalDistance: 5000.0},
				},
			},
			Config:         cfg,
			PlayerCarIndex: 0,
			Phase:          PhaseRacing,
			Session: &packets.PacketSessionData{
				SessionType:     packets.SessionRace,
				SafetyCarStatus: packets.SafetyCarNone,
				TrackLength:     5000,
			},
		}

		dirs := rule.Evaluate(ctx)
		if len(dirs) != 1 || dirs[0].SubAlert != "pit_clean_air" {
			t.Fatalf("expected pit_clean_air directive, got %+v", dirs)
		}
	})

	t.Run("traffic on rejoin suppresses clean air alert", func(t *testing.T) {
		rule := NewTrafficRule()
		ctx := &EvaluationContext{
			LapData: &packets.PacketLapData{
				LapData: [packets.MaxCars]packets.LapData{
					{CurrentLapNum: 5, TotalDistance: 10000.0},
					{CurrentLapNum: 5, TotalDistance: 8650.0},
				},
			},
			Config:         cfg,
			PlayerCarIndex: 0,
			Phase:          PhaseRacing,
			Session: &packets.PacketSessionData{
				SessionType:     packets.SessionRace,
				SafetyCarStatus: packets.SafetyCarNone,
				TrackLength:     5000,
			},
		}

		dirs := rule.Evaluate(ctx)
		if len(dirs) != 0 {
			t.Fatalf("expected 0 directives when rejoin is blocked by traffic, got %d", len(dirs))
		}
	})

	t.Run("non-periodic lap produces no alert", func(t *testing.T) {
		rule := NewTrafficRule()
		ctx := &EvaluationContext{
			LapData: &packets.PacketLapData{
				LapData: [packets.MaxCars]packets.LapData{
					{CurrentLapNum: 4, TotalDistance: 10000.0},
				},
			},
			Config:         cfg,
			PlayerCarIndex: 0,
			Phase:          PhaseRacing,
			Session: &packets.PacketSessionData{
				SessionType:     packets.SessionRace,
				SafetyCarStatus: packets.SafetyCarNone,
				TrackLength:     5000,
			},
		}
		if dirs := rule.Evaluate(ctx); len(dirs) != 0 {
			t.Fatalf("expected 0 directives on non-periodic lap, got %d", len(dirs))
		}
	})

	t.Run("already pitted driver suppresses clean air alert", func(t *testing.T) {
		rule := NewTrafficRule()
		ctx := &EvaluationContext{
			LapData: &packets.PacketLapData{
				LapData: [packets.MaxCars]packets.LapData{
					{CurrentLapNum: 10, TotalDistance: 20000.0, NumPitStops: 1},
				},
			},
			Config:         cfg,
			PlayerCarIndex: 0,
			Phase:          PhaseRacing,
			Session: &packets.PacketSessionData{
				SessionType:     packets.SessionRace,
				SafetyCarStatus: packets.SafetyCarNone,
				TrackLength:     5000,
				TotalLaps:       53,
			},
		}
		if dirs := rule.Evaluate(ctx); len(dirs) != 0 {
			t.Fatalf("expected 0 directives when driver already completed pit stop, got %d", len(dirs))
		}
	})

	t.Run("late race lap suppresses clean air alert", func(t *testing.T) {
		rule := NewTrafficRule()
		ctx := &EvaluationContext{
			LapData: &packets.PacketLapData{
				LapData: [packets.MaxCars]packets.LapData{
					{CurrentLapNum: 50, TotalDistance: 100000.0, NumPitStops: 0},
				},
			},
			Config:         cfg,
			PlayerCarIndex: 0,
			Phase:          PhaseRacing,
			Session: &packets.PacketSessionData{
				SessionType:     packets.SessionRace,
				SafetyCarStatus: packets.SafetyCarNone,
				TrackLength:     5000,
				TotalLaps:       53,
			},
		}
		if dirs := rule.Evaluate(ctx); len(dirs) != 0 {
			t.Fatalf("expected 0 directives on lap 50 of 53, got %d", len(dirs))
		}
	})
}

func TestERSRule_YearAware(t *testing.T) {
	rule := NewERSRule()
	cfg := DefaultEngineerConfig()

	ctx2025 := &EvaluationContext{
		Status: &packets.PacketCarStatusData{
			CarStatusData: [packets.MaxCars]packets.CarStatusData{
				{ERSStoreEnergy: 300_000.0},
			},
		},
		Config:         cfg,
		PlayerCarIndex: 0,
		Phase:          PhaseRacing,
		PacketFormat:   packets.PacketFormat2025,
		Session: &packets.PacketSessionData{
			SessionType: packets.SessionRace,
		},
	}
	dirs2025 := rule.Evaluate(ctx2025)
	if len(dirs2025) != 1 || !strings.Contains(dirs2025[0].Message, "None or Harvest") {
		t.Fatalf("expected 2025 ERS message to mention None or Harvest: %+v", dirs2025)
	}

	ctx2026 := &EvaluationContext{
		Status: &packets.PacketCarStatusData{
			CarStatusData: [packets.MaxCars]packets.CarStatusData{
				{ERSStoreEnergy: 300_000.0},
			},
		},
		Config:         cfg,
		PlayerCarIndex: 0,
		Phase:          PhaseRacing,
		PacketFormat:   packets.PacketFormat2026,
		Session: &packets.PacketSessionData{
			SessionType: packets.SessionRace,
		},
	}
	dirs2026 := rule.Evaluate(ctx2026)
	if len(dirs2026) != 1 || !strings.Contains(dirs2026[0].Message, "MGU-K regeneration") {
		t.Fatalf("expected 2026 ERS message to mention MGU-K regeneration: %+v", dirs2026)
	}

	ctxEngineOverheat := &EvaluationContext{
		Telemetry: &packets.PacketCarTelemetryData{
			CarTelemetryData: [packets.MaxCars]packets.CarTelemetryData{
				{EngineTemperature: 130},
			},
		},
		Config:         cfg,
		PlayerCarIndex: 0,
		Phase:          PhaseRacing,
	}
	dirsEngine := rule.Evaluate(ctxEngineOverheat)
	if len(dirsEngine) != 1 || dirsEngine[0].SubAlert != "radiator_overheat" {
		t.Fatalf("expected radiator_overheat directive, got %+v", dirsEngine)
	}
}

func TestBrakesRule_FadeAndCold(t *testing.T) {
	rule := NewBrakesRule()
	cfg := DefaultEngineerConfig()

	ctxFade := &EvaluationContext{
		Telemetry: &packets.PacketCarTelemetryData{
			CarTelemetryData: [packets.MaxCars]packets.CarTelemetryData{
				{BrakesTemperature: [4]uint16{950, 910, 800, 800}},
			},
		},
		Config:         cfg,
		PlayerCarIndex: 0,
		Phase:          PhaseRacing,
	}
	dirsFade := rule.Evaluate(ctxFade)
	if len(dirsFade) != 1 || dirsFade[0].SubAlert != "brake_overheat" {
		t.Fatalf("expected brake_overheat directive, got %+v", dirsFade)
	}

	ctxCold := &EvaluationContext{
		Telemetry: &packets.PacketCarTelemetryData{
			CarTelemetryData: [packets.MaxCars]packets.CarTelemetryData{
				{BrakesTemperature: [4]uint16{80, 85, 70, 75}},
			},
		},
		Config:         cfg,
		PlayerCarIndex: 0,
		Phase:          PhaseFormationLap,
	}
	dirsCold := rule.Evaluate(ctxCold)
	if len(dirsCold) != 1 || dirsCold[0].SubAlert != "brake_cold" {
		t.Fatalf("expected brake_cold directive, got %+v", dirsCold)
	}

	// 3. Front Brake Bias Imbalance (Front 850°C, Rear 400°C => delta 450°C >= 400°C)
	rule.Reset(DedupScopeStint)
	ctxBias := &EvaluationContext{
		Telemetry: &packets.PacketCarTelemetryData{
			CarTelemetryData: [packets.MaxCars]packets.CarTelemetryData{
				{BrakesTemperature: [4]uint16{850, 850, 400, 400}},
			},
		},
		Config:         cfg,
		PlayerCarIndex: 0,
		Phase:          PhaseRacing,
	}
	dirsBias := rule.Evaluate(ctxBias)
	var foundBias bool
	for _, d := range dirsBias {
		if d.SubAlert == "brake_bias" {
			foundBias = true
			if !strings.Contains(d.Message, "Move brake bias rearward") {
				t.Fatalf("expected rearward bias suggestion, got %s", d.Message)
			}
		}
	}
	if !foundBias {
		t.Fatalf("expected brake_bias directive, got %+v", dirsBias)
	}
}

func TestTyresRule_ColdAndSuppression(t *testing.T) {
	rule := NewTyresRule()
	cfg := DefaultEngineerConfig()

	ctxCold := &EvaluationContext{
		Telemetry: &packets.PacketCarTelemetryData{
			CarTelemetryData: [packets.MaxCars]packets.CarTelemetryData{
				{TyresSurfaceTemperature: [4]uint8{60, 65, 55, 58}},
			},
		},
		Status: &packets.PacketCarStatusData{
			CarStatusData: [packets.MaxCars]packets.CarStatusData{
				{TyresAgeLaps: 0},
			},
		},
		Config:         cfg,
		PlayerCarIndex: 0,
		Phase:          PhaseFormationLap,
	}
	dirs := rule.Evaluate(ctxCold)
	if len(dirs) != 1 || dirs[0].SubAlert != "tyre_cold" {
		t.Fatalf("expected tyre_cold directive, got %+v", dirs)
	}
}

func TestDamageRule_EngineWear(t *testing.T) {
	rule := NewDamageRule()
	cfg := DefaultEngineerConfig()

	ctxICE := &EvaluationContext{
		Damage: &packets.PacketCarDamageData{
			CarDamageData: [packets.MaxCars]packets.CarDamageData{
				{EngineICEWear: 72},
			},
		},
		Config:         cfg,
		PlayerCarIndex: 0,
		Phase:          PhaseRacing,
	}
	dirs := rule.Evaluate(ctxICE)
	if len(dirs) != 1 || dirs[0].SubAlert != "engine_wear" {
		t.Fatalf("expected engine_wear directive, got %+v", dirs)
	}
}

func TestFlagsRule_VSCAndPenalties(t *testing.T) {
	rule := NewFlagsRule()
	cfg := DefaultEngineerConfig()

	ctxVSC := &EvaluationContext{
		Session: &packets.PacketSessionData{
			SessionType:     packets.SessionRace,
			SafetyCarStatus: packets.SafetyCarVirtual,
		},
		Config:         cfg,
		PlayerCarIndex: 0,
		Phase:          PhaseSafetyCar,
	}
	dirsVSC := rule.Evaluate(ctxVSC)
	if len(dirsVSC) != 1 || dirsVSC[0].SubAlert != "vsc" {
		t.Fatalf("expected vsc directive, got %+v", dirsVSC)
	}

	ctxDriveThrough := &EvaluationContext{
		LapData: &packets.PacketLapData{
			LapData: [packets.MaxCars]packets.LapData{
				{NumUnservedDriveThroughPens: 1},
			},
		},
		Config:         cfg,
		PlayerCarIndex: 0,
		Phase:          PhaseRacing,
	}
	dirsPnl := rule.Evaluate(ctxDriveThrough)
	if len(dirsPnl) != 1 || dirsPnl[0].SubAlert != "penalties_incurred" || !strings.Contains(dirsPnl[0].Message, "Drive-through penalty") {
		t.Fatalf("expected drive-through penalty directive, got %+v", dirsPnl)
	}
}

func TestTyreThermalWindows_Lookup(t *testing.T) {
	// Actual compound tests
	wC1 := GetTyreThermalWindow(packets.ActualCompoundC1, 0)
	if wC1.CompoundName != "C1" || wC1.MinTemp != 95.0 || wC1.MaxTemp != 115.0 {
		t.Fatalf("unexpected window for C1: %+v", wC1)
	}

	wC5 := GetTyreThermalWindow(packets.ActualCompoundC5, 0)
	if wC5.CompoundName != "C5" || wC5.MinTemp != 75.0 || wC5.MaxTemp != 85.0 {
		t.Fatalf("unexpected window for C5: %+v", wC5)
	}

	wInter := GetTyreThermalWindow(packets.CompoundInter, 0)
	if wInter.CompoundName != "INTERMEDIATE" || wInter.MinTemp != 55.0 || wInter.MaxTemp != 75.0 {
		t.Fatalf("unexpected window for Inter: %+v", wInter)
	}

	wWet := GetTyreThermalWindow(packets.CompoundWet, 0)
	if wWet.CompoundName != "WET" || wWet.MinTemp != 55.0 || wWet.MaxTemp != 65.0 {
		t.Fatalf("unexpected window for Wet: %+v", wWet)
	}

	// Visual compound fallback tests (Soft -> C4, Medium -> C3, Hard -> C2)
	wSoft := GetTyreThermalWindow(0, packets.CompoundSoft)
	if wSoft.CompoundName != "C4" || wSoft.MinTemp != 75.0 || wSoft.MaxTemp != 95.0 {
		t.Fatalf("unexpected window for visual Soft (expected C4): %+v", wSoft)
	}

	wMed := GetTyreThermalWindow(0, packets.CompoundMedium)
	if wMed.CompoundName != "C3" || wMed.MinTemp != 85.0 || wMed.MaxTemp != 95.0 {
		t.Fatalf("unexpected window for visual Medium (expected C3): %+v", wMed)
	}

	wHard := GetTyreThermalWindow(0, packets.CompoundHard)
	if wHard.CompoundName != "C2" || wHard.MinTemp != 85.0 || wHard.MaxTemp != 115.0 {
		t.Fatalf("unexpected window for visual Hard (expected C2): %+v", wHard)
	}
}

func TestCalculateEnginePowerPct(t *testing.T) {
	tests := []struct {
		tempC            float32
		expectedPower    float32
		expectedLossDiff float32
	}{
		{tempC: 50.0, expectedPower: 96.0, expectedLossDiff: 4.0},
		{tempC: 65.0, expectedPower: 96.0, expectedLossDiff: 4.0},
		{tempC: 95.0, expectedPower: 99.0, expectedLossDiff: 1.0},
		{tempC: 105.0, expectedPower: 99.7, expectedLossDiff: 0.3},
		{tempC: 115.0, expectedPower: 100.0, expectedLossDiff: 0.0},
		{tempC: 120.0, expectedPower: 100.0, expectedLossDiff: 0.0},
		{tempC: 125.0, expectedPower: 100.0, expectedLossDiff: 0.0},
		{tempC: 135.0, expectedPower: 98.5, expectedLossDiff: 1.5},
		{tempC: 140.0, expectedPower: 96.25, expectedLossDiff: 3.75}, // Linear interpolation between 135 and 145
		{tempC: 145.0, expectedPower: 94.0, expectedLossDiff: 6.0},
		{tempC: 175.0, expectedPower: 85.0, expectedLossDiff: 15.0},
		{tempC: 190.0, expectedPower: 85.0, expectedLossDiff: 15.0}, // Beyond max curve step
	}

	for _, tc := range tests {
		power, loss := CalculateEnginePowerPct(tc.tempC)
		if math.Abs(float64(power-tc.expectedPower)) > 0.05 {
			t.Errorf("at %.1f°C expected power %.2f, got %.2f", tc.tempC, tc.expectedPower, power)
		}
		if math.Abs(float64(loss-tc.expectedLossDiff)) > 0.05 {
			t.Errorf("at %.1f°C expected loss %.2f, got %.2f", tc.tempC, tc.expectedLossDiff, loss)
		}
	}
}

func TestERSRule_EngineThermalDerateStages(t *testing.T) {
	rule := NewERSRule()
	cfg := DefaultEngineerConfig()

	// 1. Stage Warning: 135°C (1.5% loss, UrgencyMedium)
	ctxWarn := &EvaluationContext{
		Telemetry: &packets.PacketCarTelemetryData{
			CarTelemetryData: [packets.MaxCars]packets.CarTelemetryData{
				{EngineTemperature: 135},
			},
		},
		Config:         cfg,
		PlayerCarIndex: 0,
		Phase:          PhaseRacing,
	}
	dirsWarn := rule.Evaluate(ctxWarn)
	if len(dirsWarn) != 1 || dirsWarn[0].SubAlert != "radiator_overheat" || dirsWarn[0].Urgency != UrgencyMedium {
		t.Fatalf("expected warning radiator_overheat at 135°C, got %+v", dirsWarn)
	}
	if !strings.Contains(dirsWarn[0].Message, "1.5%") || !strings.Contains(dirsWarn[0].Message, "Lift & Coast") {
		t.Errorf("expected warning message to mention 1.5%% power loss and Lift & Coast: %s", dirsWarn[0].Message)
	}

	// 2. Stage Critical: 145°C (6.0% loss, UrgencyHigh)
	ctxCrit := &EvaluationContext{
		Telemetry: &packets.PacketCarTelemetryData{
			CarTelemetryData: [packets.MaxCars]packets.CarTelemetryData{
				{EngineTemperature: 145},
			},
		},
		Config:         cfg,
		PlayerCarIndex: 0,
		Phase:          PhaseRacing,
	}
	dirsCrit := rule.Evaluate(ctxCrit)
	if len(dirsCrit) != 1 || dirsCrit[0].SubAlert != "radiator_overheat" || dirsCrit[0].Urgency != UrgencyHigh {
		t.Fatalf("expected critical radiator_overheat at 145°C, got %+v", dirsCrit)
	}
	if !strings.Contains(dirsCrit[0].Message, "6.0%") || !strings.Contains(dirsCrit[0].Message, "thermal derate") {
		t.Errorf("expected critical message to mention 6.0%% power loss and thermal derate: %s", dirsCrit[0].Message)
	}
}

func TestCoachingRule_NeutralizationAndCeilingShields(t *testing.T) {
	rule := NewCoachingRule()
	cfg := DefaultEngineerConfig()
	sessionRace := &packets.PacketSessionData{
		SessionType:     packets.SessionRace,
		SafetyCarStatus: packets.SafetyCarNone,
		TrackLength:     5000,
	}

	// 1. Establish PB S1 = 28000ms on Lap 2
	ctxLap2PB := &EvaluationContext{
		LapData: &packets.PacketLapData{
			LapData: [packets.MaxCars]packets.LapData{
				{CurrentLapNum: 2, Sector: 1, Sector1TimeMSPart: 28000, DriverStatus: packets.DriverStatusOnTrack, PitStatus: packets.PitStatusNone},
			},
		},
		Session:        sessionRace,
		Config:         cfg,
		PlayerCarIndex: 0,
		Phase:          PhaseRacing,
	}
	rule.Evaluate(ctxLap2PB)

	// 2. Delta loss under Full Safety Car: Lap 3, S1 = 45000ms (+17.0s) -> MUST BE SUPPRESSED
	sessionSC := &packets.PacketSessionData{
		SessionType:     packets.SessionRace,
		SafetyCarStatus: packets.SafetyCarFull,
		TrackLength:     5000,
	}
	ctxLap3SC := &EvaluationContext{
		LapData: &packets.PacketLapData{
			LapData: [packets.MaxCars]packets.LapData{
				{CurrentLapNum: 3, Sector: 1, Sector1TimeMSPart: 45000, DriverStatus: packets.DriverStatusOnTrack, PitStatus: packets.PitStatusNone},
			},
		},
		Session:        sessionSC,
		Config:         cfg,
		PlayerCarIndex: 0,
		Phase:          PhaseSafetyCar,
	}
	rule.Evaluate(ctxLap3SC)
	dirsSC := rule.Evaluate(ctxLap3SC)
	if len(dirsSC) != 0 {
		t.Fatalf("expected sector coaching to be suppressed under Full Safety Car, got %+v", dirsSC)
	}

	// 3. Delta loss under SafetyCarDelta active (VSC): Lap 3, S1 = 44000ms -> MUST BE SUPPRESSED
	ctxLap3VSC := &EvaluationContext{
		LapData: &packets.PacketLapData{
			LapData: [packets.MaxCars]packets.LapData{
				{CurrentLapNum: 3, Sector: 1, Sector1TimeMSPart: 44000, SafetyCarDelta: 1.25, DriverStatus: packets.DriverStatusOnTrack, PitStatus: packets.PitStatusNone},
			},
		},
		Session:        sessionRace,
		Config:         cfg,
		PlayerCarIndex: 0,
		Phase:          PhaseRacing,
	}
	dirsVSC := rule.Evaluate(ctxLap3VSC)
	if len(dirsVSC) != 0 {
		t.Fatalf("expected sector coaching to be suppressed when SafetyCarDelta is active, got %+v", dirsVSC)
	}

	// 4. Restart Lap Cooldown: Lap 3 ends SC, green flag returns on Lap 3 S2 -> Lap 3 S2 MUST BE SUPPRESSED
	ctxLap3Restart := &EvaluationContext{
		LapData: &packets.PacketLapData{
			LapData: [packets.MaxCars]packets.LapData{
				{CurrentLapNum: 3, Sector: 2, Sector1TimeMSPart: 28000, Sector2TimeMSPart: 31000, DriverStatus: packets.DriverStatusOnTrack, PitStatus: packets.PitStatusNone},
			},
		},
		Session:        sessionRace,
		Config:         cfg,
		PlayerCarIndex: 0,
		Phase:          PhaseRacing,
	}
	dirsRestart := rule.Evaluate(ctxLap3Restart)
	if len(dirsRestart) != 0 {
		t.Fatalf("expected sector coaching to be suppressed on restart lap cooldown, got %+v", dirsRestart)
	}

	// 5. Yellow Flag suppression: Lap 4 S1 driver encounters local yellow flag (VehicleFIAFlags == 3)
	ctxLap4Yellow := &EvaluationContext{
		LapData: &packets.PacketLapData{
			LapData: [packets.MaxCars]packets.LapData{
				{CurrentLapNum: 4, Sector: 1, Sector1TimeMSPart: 29500, DriverStatus: packets.DriverStatusOnTrack, PitStatus: packets.PitStatusNone},
			},
		},
		Status: &packets.PacketCarStatusData{
			CarStatusData: [packets.MaxCars]packets.CarStatusData{
				{VehicleFIAFlags: 3}, // Yellow flag
			},
		},
		Session:        sessionRace,
		Config:         cfg,
		PlayerCarIndex: 0,
		Phase:          PhaseRacing,
	}
	rule.Evaluate(ctxLap4Yellow)
	dirsYellow := rule.Evaluate(ctxLap4Yellow)
	if len(dirsYellow) != 0 {
		t.Fatalf("expected sector coaching to be suppressed under local yellow flag, got %+v", dirsYellow)
	}

	// 6. Non-driving delta loss ceiling (>3.0s spin / gravel trap): Lap 5 S1 = 32000ms (+4.0s loss)
	ctxLap5Spin := &EvaluationContext{
		LapData: &packets.PacketLapData{
			LapData: [packets.MaxCars]packets.LapData{
				{CurrentLapNum: 5, Sector: 1, Sector1TimeMSPart: 32000, DriverStatus: packets.DriverStatusOnTrack, PitStatus: packets.PitStatusNone},
			},
		},
		Session:        sessionRace,
		Config:         cfg,
		PlayerCarIndex: 0,
		Phase:          PhaseRacing,
	}
	rule.Evaluate(ctxLap5Spin)
	dirsSpin := rule.Evaluate(ctxLap5Spin)
	if len(dirsSpin) != 0 {
		t.Fatalf("expected delta loss > 3.0s to be filtered out as incident/spin, got %+v", dirsSpin)
	}

	// 7. Clean Green Flag driving mistake within threshold: Lap 6 S1 = 28600ms (+0.60s loss)
	ctxLap6Mistake := &EvaluationContext{
		LapData: &packets.PacketLapData{
			LapData: [packets.MaxCars]packets.LapData{
				{CurrentLapNum: 6, Sector: 1, Sector1TimeMSPart: 28600, DriverStatus: packets.DriverStatusOnTrack, PitStatus: packets.PitStatusNone},
			},
		},
		Session:        sessionRace,
		Config:         cfg,
		PlayerCarIndex: 0,
		Phase:          PhaseRacing,
	}
	rule.Evaluate(ctxLap6Mistake)
	dirsMistake := rule.Evaluate(ctxLap6Mistake)
	if len(dirsMistake) != 1 || dirsMistake[0].SubAlert != "sector_delta" {
		t.Fatalf("expected clean coaching_s1 directive for 0.60s delta loss, got %+v", dirsMistake)
	}
}

func TestERSRule_PushLapAndNeutralizationShields(t *testing.T) {
	rule := NewERSRule()
	cfg := DefaultEngineerConfig()
	sessionRace := &packets.PacketSessionData{
		SessionType:     packets.SessionRace,
		SafetyCarStatus: packets.SafetyCarNone,
		TrackLength:     5000,
	}

	// 1. Push Deploy Mode: Hotlap (mode 2) with low battery (10%) -> MUST BE SUPPRESSED
	ctxHotlap := &EvaluationContext{
		Status: &packets.PacketCarStatusData{
			CarStatusData: [packets.MaxCars]packets.CarStatusData{
				{ERSStoreEnergy: 400_000.0, ERSDeployMode: 2}, // Hotlap mode
			},
		},
		Session:        sessionRace,
		Config:         cfg,
		PlayerCarIndex: 0,
		Phase:          PhaseRacing,
	}
	dirsHotlap := rule.Evaluate(ctxHotlap)
	if len(dirsHotlap) != 0 {
		t.Fatalf("expected ers_low to be suppressed in Hotlap deploy mode, got %+v", dirsHotlap)
	}

	// 2. Push Deploy Mode: Overtake (mode 3) with low battery (10%) -> MUST BE SUPPRESSED
	ctxOvertake := &EvaluationContext{
		Status: &packets.PacketCarStatusData{
			CarStatusData: [packets.MaxCars]packets.CarStatusData{
				{ERSStoreEnergy: 400_000.0, ERSDeployMode: 3}, // Overtake mode
			},
		},
		Session:        sessionRace,
		Config:         cfg,
		PlayerCarIndex: 0,
		Phase:          PhaseRacing,
	}
	dirsOvertake := rule.Evaluate(ctxOvertake)
	if len(dirsOvertake) != 0 {
		t.Fatalf("expected ers_low to be suppressed in Overtake deploy mode, got %+v", dirsOvertake)
	}

	// 3. Final Sector / Finish Line Shield: LapDistance = 4600m / 5000m (92% distance) -> MUST BE SUPPRESSED
	ctxFinishLine := &EvaluationContext{
		Status: &packets.PacketCarStatusData{
			CarStatusData: [packets.MaxCars]packets.CarStatusData{
				{ERSStoreEnergy: 400_000.0, ERSDeployMode: 1}, // Medium mode
			},
		},
		LapData: &packets.PacketLapData{
			LapData: [packets.MaxCars]packets.LapData{
				{LapDistance: 4600.0},
			},
		},
		Session:        sessionRace,
		Config:         cfg,
		PlayerCarIndex: 0,
		Phase:          PhaseRacing,
	}
	dirsFinishLine := rule.Evaluate(ctxFinishLine)
	if len(dirsFinishLine) != 0 {
		t.Fatalf("expected ers_low to be suppressed in final sector / finish line run, got %+v", dirsFinishLine)
	}

	// 4. Neutralization Shield: Virtual Safety Car active -> MUST BE SUPPRESSED
	sessionVSC := &packets.PacketSessionData{
		SessionType:     packets.SessionRace,
		SafetyCarStatus: packets.SafetyCarVirtual,
		TrackLength:     5000,
	}
	ctxVSC := &EvaluationContext{
		Status: &packets.PacketCarStatusData{
			CarStatusData: [packets.MaxCars]packets.CarStatusData{
				{ERSStoreEnergy: 400_000.0, ERSDeployMode: 1},
			},
		},
		LapData: &packets.PacketLapData{
			LapData: [packets.MaxCars]packets.LapData{
				{LapDistance: 2000.0},
			},
		},
		Session:        sessionVSC,
		Config:         cfg,
		PlayerCarIndex: 0,
		Phase:          PhaseSafetyCar,
	}
	dirsVSC := rule.Evaluate(ctxVSC)
	if len(dirsVSC) != 0 {
		t.Fatalf("expected ers_low to be suppressed under VSC, got %+v", dirsVSC)
	}

	// 5. Unconfirmed Session: Session == nil -> MUST BE SUPPRESSED
	ctxNoSession := &EvaluationContext{
		Status: &packets.PacketCarStatusData{
			CarStatusData: [packets.MaxCars]packets.CarStatusData{
				{ERSStoreEnergy: 400_000.0, ERSDeployMode: 1},
			},
		},
		Session:        nil,
		Config:         cfg,
		PlayerCarIndex: 0,
		Phase:          PhaseRacing,
	}
	dirsNoSession := rule.Evaluate(ctxNoSession)
	if len(dirsNoSession) != 0 {
		t.Fatalf("expected ers_low to be suppressed when Session is nil (unconfirmed session), got %+v", dirsNoSession)
	}

	// 6. Normal Racing Lap mid-lap: 2000m / 5000m (40%), deploy mode 1 -> MUST EMIT
	ctxNormal := &EvaluationContext{
		Status: &packets.PacketCarStatusData{
			CarStatusData: [packets.MaxCars]packets.CarStatusData{
				{ERSStoreEnergy: 400_000.0, ERSDeployMode: 1},
			},
		},
		LapData: &packets.PacketLapData{
			LapData: [packets.MaxCars]packets.LapData{
				{LapDistance: 2000.0},
			},
		},
		Session:        sessionRace,
		Config:         cfg,
		PlayerCarIndex: 0,
		Phase:          PhaseRacing,
	}
	dirsNormal := rule.Evaluate(ctxNormal)
	if len(dirsNormal) != 1 || dirsNormal[0].SubAlert != "ers_low" {
		t.Fatalf("expected ers_low directive in mid-lap racing conditions, got %+v", dirsNormal)
	}
}

func TestNeutralizationShields_TeammateFuelRivalsTyres(t *testing.T) {
	sessionSC := &packets.PacketSessionData{
		SessionType:     packets.SessionRace,
		SafetyCarStatus: packets.SafetyCarFull,
		TrackLength:     5000,
	}

	// 1. Teammate Ahead Proximity suppressed under SC
	teammateRule := NewTeammateRule()
	ctxTeammateSC := &EvaluationContext{
		LapData: &packets.PacketLapData{
			LapData: [packets.MaxCars]packets.LapData{
				{CurrentLapNum: 5, TotalDistance: 5000, DriverStatus: packets.DriverStatusOnTrack},
				{CurrentLapNum: 5, TotalDistance: 5050, DriverStatus: packets.DriverStatusOnTrack}, // teammate 50m ahead
			},
		},
		Session:          sessionSC,
		PlayerCarIndex:   0,
		TeammateCarIndex: 1,
		Phase:            PhaseSafetyCar,
	}
	dirsTeammate := teammateRule.Evaluate(ctxTeammateSC)
	if len(dirsTeammate) != 0 {
		t.Fatalf("expected teammate proximity alert to be suppressed under Safety Car queue, got %+v", dirsTeammate)
	}

	// Teammate Pitting alert MUST STILL FIRE under SC
	ctxTeammatePitSC := &EvaluationContext{
		LapData: &packets.PacketLapData{
			LapData: [packets.MaxCars]packets.LapData{
				{CurrentLapNum: 5, TotalDistance: 5000, DriverStatus: packets.DriverStatusOnTrack},
				{CurrentLapNum: 5, TotalDistance: 5050, DriverStatus: packets.DriverStatusOnTrack, PitStatus: packets.PitStatusPitting},
			},
		},
		Session:          sessionSC,
		PlayerCarIndex:   0,
		TeammateCarIndex: 1,
		Phase:            PhaseSafetyCar,
	}
	dirsTeammatePit := teammateRule.Evaluate(ctxTeammatePitSC)
	if len(dirsTeammatePit) != 1 || dirsTeammatePit[0].SubAlert != "teammate_pitting" {
		t.Fatalf("expected teammate_pitting to emit even under Safety Car, got %+v", dirsTeammatePit)
	}

	// 2. Fuel Delta suppressed under SC
	fuelRule := NewFuelRule()
	cfg := DefaultEngineerConfig()
	ctxFuelSC := &EvaluationContext{
		Status: &packets.PacketCarStatusData{
			CarStatusData: [packets.MaxCars]packets.CarStatusData{
				{FuelRemainingLaps: -1.5},
			},
		},
		LapData: &packets.PacketLapData{
			LapData: [packets.MaxCars]packets.LapData{
				{CurrentLapNum: 5, DriverStatus: packets.DriverStatusOnTrack},
			},
		},
		Session:        sessionSC,
		Config:         cfg,
		PlayerCarIndex: 0,
		Phase:          PhaseSafetyCar,
	}
	dirsFuel := fuelRule.Evaluate(ctxFuelSC)
	if len(dirsFuel) != 0 {
		t.Fatalf("expected fuel delta alert to be suppressed under Safety Car, got %+v", dirsFuel)
	}

	// 3. Tyre Overheat suppressed under SC
	tyresRule := NewTyresRule()
	ctxTyresSC := &EvaluationContext{
		Telemetry: &packets.PacketCarTelemetryData{
			CarTelemetryData: [packets.MaxCars]packets.CarTelemetryData{
				{TyresSurfaceTemperature: [4]uint8{120, 120, 125, 125}},
			},
		},
		Status: &packets.PacketCarStatusData{
			CarStatusData: [packets.MaxCars]packets.CarStatusData{
				{ActualTyreCompound: packets.ActualCompoundC3, VisualTyreCompound: packets.CompoundMedium},
			},
		},
		LapData: &packets.PacketLapData{
			LapData: [packets.MaxCars]packets.LapData{
				{CurrentLapNum: 5, DriverStatus: packets.DriverStatusOnTrack},
			},
		},
		Session:        sessionSC,
		Config:         cfg,
		PlayerCarIndex: 0,
		Phase:          PhaseSafetyCar,
	}
	dirsTyres := tyresRule.Evaluate(ctxTyresSC)
	for _, d := range dirsTyres {
		if d.SubAlert == "tyre_overheat" {
			t.Fatalf("expected tyre_overheat alert to be suppressed under Safety Car, got %+v", dirsTyres)
		}
	}
}
