package engineer

import (
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
	if rule.DedupScope() != DedupScopeStint {
		t.Fatalf("expected DedupScope()=stint, got %s", rule.DedupScope())
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

	// 5. Thermal Overheating 2026 vs 2025
	telemetryPkt := &packets.PacketCarTelemetryData{
		CarTelemetryData: [packets.MaxCars]packets.CarTelemetryData{
			{
				TyresSurfaceTemperature: [4]uint8{100, 100, 112, 111},
			},
		},
	}
	ctxOverheat2026 := &EvaluationContext{
		Telemetry:      telemetryPkt,
		Config:         cfg,
		PlayerCarIndex: 0,
		PacketFormat:   packets.PacketFormat2026,
		Phase:          PhaseRacing,
	}
	dirs2026 := rule.Evaluate(ctxOverheat2026)
	if len(dirs2026) != 1 || dirs2026[0].SubAlert != "tyre_overheat" {
		t.Fatalf("expected tyre_overheat for 2026 at 112°C, got %+v", dirs2026)
	}

	ctxOverheat2025 := &EvaluationContext{
		Telemetry:      telemetryPkt,
		Config:         cfg,
		PlayerCarIndex: 0,
		PacketFormat:   packets.PacketFormat2025,
		Phase:          PhaseRacing,
	}
	dirs2025 := rule.Evaluate(ctxOverheat2025)
	if len(dirs2025) != 0 {
		t.Fatalf("expected no overheat for 2025 at 112°C, got %+v", dirs2025)
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

	// 3. Track Limits & Penalties
	lapPkt := &packets.PacketLapData{
		LapData: [packets.MaxCars]packets.LapData{
			{CornerCuttingWarnings: 3, Penalties: 10},
		},
	}
	ctxLap := &EvaluationContext{
		LapData:        lapPkt,
		Config:         cfg,
		PlayerCarIndex: 0,
		Phase:          PhaseRacing,
	}
	dirsLap := rule.Evaluate(ctxLap)
	if len(dirsLap) != 2 {
		t.Fatalf("expected 2 directives (track limits + penalties), got %d: %+v", len(dirsLap), dirsLap)
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
