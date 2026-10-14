package engineer

import (
	"testing"

	"github.com/mgauna/f1game-telemetry-go/internal/packets"
)

// Each call carries the facts its phrases say: which wheel, axle or tyre, and its numbers.
func TestRules_CallsCarryTheirFacts(t *testing.T) {
	cfg := DefaultEngineerConfig()
	cfg.RainProbPct, cfg.RainHorizonMin = 50, 15
	race := &packets.PacketSessionData{SessionType: packets.SessionRace}
	damage := func(d packets.CarDamageData) *packets.PacketCarDamageData {
		return &packets.PacketCarDamageData{CarDamageData: [packets.MaxCars]packets.CarDamageData{d}}
	}
	telemetry := func(d packets.CarTelemetryData) *packets.PacketCarTelemetryData {
		return &packets.PacketCarTelemetryData{CarTelemetryData: [packets.MaxCars]packets.CarTelemetryData{d}}
	}

	tests := []struct {
		name     string
		rule     EngineerRule
		ctx      *EvaluationContext
		now      []int64 // evaluated at each of these times; the call comes on the last
		subAlert string
		want     DirectiveValues
	}{
		{
			name:     "tyre wear says the most worn tyre",
			rule:     NewTyresRule(),
			ctx:      &EvaluationContext{Damage: damage(packets.CarDamageData{TyresWear: wheels[float32](30, 20, 51.6, 40)})},
			subAlert: "tyre_wear",
			want:     DirectiveValues{Wheel: WheelRearLeft, Pct: 52},
		},
		{
			name:     "a worn out tyre says which",
			rule:     NewTyresRule(),
			ctx:      &EvaluationContext{Damage: damage(packets.CarDamageData{TyresWear: wheels[float32](20, 97, 20, 20)})},
			subAlert: "tyre_worn_out",
			want:     DirectiveValues{Wheel: WheelFrontRight, Pct: 97},
		},
		{
			name:     "blistering says the tyre and how much",
			rule:     NewTyresRule(),
			ctx:      &EvaluationContext{Damage: damage(packets.CarDamageData{TyreBlisters: wheels[uint8](0, 0, 0, 40)})},
			subAlert: "tyre_blistering",
			want:     DirectiveValues{Wheel: WheelRearRight, Pct: 40},
		},
		{
			name:     "a puncture says the tyre",
			rule:     NewTyresRule(),
			ctx:      &EvaluationContext{Telemetry: telemetry(packets.CarTelemetryData{TyresPressure: wheels[float32](23, 23, 22, 15)})},
			subAlert: "tyre_puncture",
			want:     DirectiveValues{Wheel: WheelRearRight},
		},
		{
			name:     "a pressure spike says the tyre",
			rule:     NewTyresRule(),
			ctx:      &EvaluationContext{Telemetry: telemetry(packets.CarTelemetryData{TyresPressure: wheels[float32](26, 26, 22, 22)})},
			subAlert: "tyre_pressure_high",
			want:     DirectiveValues{Wheel: WheelFrontLeft},
		},
		{
			name:     "a pressure split says the axle",
			rule:     NewTyresRule(),
			ctx:      &EvaluationContext{Telemetry: telemetry(packets.CarTelemetryData{TyresPressure: wheels[float32](23, 23, 23, 21)})},
			subAlert: "tyre_pressure_high",
			want:     DirectiveValues{Axle: AxleRear},
		},
		{
			name:     "a hot front brake says which",
			rule:     NewBrakesRule(),
			ctx:      &EvaluationContext{Telemetry: telemetry(packets.CarTelemetryData{BrakesTemperature: wheels[uint16](800, 960, 700, 700)})},
			now:      []int64{0, BrakeHotSustainMs},
			subAlert: "brake_overheat",
			want:     DirectiveValues{Wheel: WheelFrontRight},
		},
		{
			name:     "a hot rear brake says which",
			rule:     NewBrakesRule(),
			ctx:      &EvaluationContext{Telemetry: telemetry(packets.CarTelemetryData{BrakesTemperature: wheels[uint16](700, 700, 960, 800)})},
			now:      []int64{0, BrakeHotSustainMs},
			subAlert: "brake_overheat_rear",
			want:     DirectiveValues{Wheel: WheelRearLeft},
		},
		{
			name: "low battery says its charge",
			rule: NewERSRule(),
			ctx: &EvaluationContext{
				Session: race,
				Status:  &packets.PacketCarStatusData{CarStatusData: [packets.MaxCars]packets.CarStatusData{{ERSStoreEnergy: 0.118 * packets.MaxERSStoreEnergyJoules}}},
			},
			subAlert: "ers_low",
			want:     DirectiveValues{Pct: 12},
		},
		{
			name: "fuel short says by how many laps",
			rule: NewFuelRule(),
			ctx: &EvaluationContext{
				Session: race,
				LapData: &packets.PacketLapData{LapData: [packets.MaxCars]packets.LapData{{CurrentLapNum: 5}}},
				Status:  &packets.PacketCarStatusData{CarStatusData: [packets.MaxCars]packets.CarStatusData{{FuelRemainingLaps: -0.84}}},
			},
			subAlert: "fuel_deficit",
			want:     DirectiveValues{FuelDeltaLaps: -0.8},
		},
		{
			name: "rain in the forecast says the chance and when",
			rule: NewFlagsRule(),
			ctx: &EvaluationContext{
				Session: &packets.PacketSessionData{
					SessionType:               packets.SessionRace,
					NumWeatherForecastSamples: 2,
					WeatherForecastSamples: [packets.MaxWeatherForecastSamples]packets.WeatherForecastSample{
						{SessionType: packets.SessionRace, TimeOffset: 5, RainPercentage: 20},
						{SessionType: packets.SessionRace, TimeOffset: 10, RainPercentage: 60},
					},
				},
			},
			subAlert: "weather_rain",
			want:     DirectiveValues{RainPct: 60, Minutes: 10},
		},
		{
			name:     "wing damage says how much",
			rule:     NewDamageRule(),
			ctx:      &EvaluationContext{Damage: damage(packets.CarDamageData{FrontLeftWingDamage: 22, FrontRightWingDamage: 35})},
			subAlert: "wing_damage",
			want:     DirectiveValues{Pct: 35},
		},
		{
			name:     "floor damage says how much",
			rule:     NewDamageRule(),
			ctx:      &EvaluationContext{Damage: damage(packets.CarDamageData{FloorDamage: 20, DiffuserDamage: 10})},
			subAlert: "floor_damage",
			want:     DirectiveValues{Pct: 30},
		},
		{
			name:     "gearbox wear says how much",
			rule:     NewDamageRule(),
			ctx:      &EvaluationContext{Damage: damage(packets.CarDamageData{GearBoxDamage: 72})},
			subAlert: "damage_gearbox_wear",
			want:     DirectiveValues{Pct: 72},
		},
		{
			name:     "engine wear says the most worn part",
			rule:     NewDamageRule(),
			ctx:      &EvaluationContext{Damage: damage(packets.CarDamageData{EngineICEWear: 60, EngineMGUKWear: 71})},
			subAlert: "engine_wear",
			want:     DirectiveValues{Pct: 71},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tt.ctx.Config, tt.ctx.Phase = cfg, PhaseRacing
			times := tt.now
			if len(times) == 0 {
				times = []int64{0}
			}
			var dirs []Directive
			for _, now := range times {
				tt.ctx.Now = now
				dirs = tt.rule.Evaluate(tt.ctx)
			}
			d := directiveFor(dirs, tt.subAlert)
			if d == nil {
				t.Fatalf("no %s call, got %+v", tt.subAlert, dirs)
			}
			if d.Values == nil || *d.Values != tt.want {
				t.Errorf("values = %+v, want %+v", d.Values, tt.want)
			}
		})
	}
}
