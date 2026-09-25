package engineer

import (
	"errors"
	"fmt"

	"github.com/mgauna/f1game-telemetry-go/internal/packets"
)

// LapHistoryEntry is one of the player's completed laps as the lap history tool reports it.
type LapHistoryEntry struct {
	Lap          int        `json:"lap"`
	Time         string     `json:"time"`
	Sectors      string     `json:"sectors,omitempty"`
	Valid        bool       `json:"valid"`
	Compound     string     `json:"compound,omitempty"`
	TyreAgeLaps  int        `json:"tyre_age_laps"`
	TyreWearPct  [4]float64 `json:"tyre_wear_pct_fl_fr_rl_rr"`
	FuelKg       float64    `json:"fuel_kg"`
	Position     int        `json:"position"`
	GapAheadSec  float64    `json:"gap_to_car_ahead_s,omitempty"`
	GapBehindSec float64    `json:"gap_to_car_behind_s,omitempty"`
}

type lapHistoryResult struct {
	Laps []LapHistoryEntry `json:"laps"`
	Note string            `json:"note,omitempty"`
}

func (v *raceView) lapHistory(limit int) lapHistoryResult {
	if limit <= 0 {
		limit = DefaultLapHistoryLimit
	}
	limit = min(limit, MaxLapHistoryLimit)
	laps := v.playerLaps
	if len(laps) > limit {
		laps = laps[len(laps)-limit:]
	}
	res := lapHistoryResult{Laps: make([]LapHistoryEntry, 0, len(laps))}
	if len(laps) == 0 {
		res.Note = "no completed laps recorded yet this session"
	}
	for _, rec := range laps {
		entry := LapHistoryEntry{
			Lap:          rec.LapNumber,
			Time:         formatLapTimeMS(rec.LapTimeMS),
			Valid:        rec.Valid,
			Compound:     rec.Compound,
			TyreAgeLaps:  rec.TyreAgeLaps,
			FuelKg:       roundTo(float64(rec.FuelKg), 1),
			Position:     rec.Position,
			GapAheadSec:  msToSec(rec.GapAheadMS),
			GapBehindSec: msToSec(rec.GapBehindMS),
		}
		if rec.Sector1MS > 0 {
			entry.Sectors = fmt.Sprintf("%s / %s / %s", formatLapTimeMS(rec.Sector1MS), formatLapTimeMS(rec.Sector2MS), formatLapTimeMS(rec.Sector3MS))
		}
		for i, w := range rec.TyreWearPct {
			entry.TyreWearPct[i] = roundTo(float64(w), 1)
		}
		res.Laps = append(res.Laps, entry)
	}
	return res
}

// ForecastEntry is one weather forecast sample for the current session.
type ForecastEntry struct {
	MinutesAhead int    `json:"minutes_ahead"`
	Weather      string `json:"weather"`
	RainPct      int    `json:"rain_pct"`
	TrackTempC   int    `json:"track_temp_c"`
	AirTempC     int    `json:"air_temp_c"`
}

type weatherResult struct {
	Weather    string          `json:"weather_now"`
	TrackTempC int             `json:"track_temp_c"`
	AirTempC   int             `json:"air_temp_c"`
	Forecast   []ForecastEntry `json:"forecast"`
}

func (v *raceView) weatherForecast() weatherResult {
	res := weatherResult{
		Weather:    packets.WeatherName(v.session.Weather),
		TrackTempC: int(v.session.TrackTemperature),
		AirTempC:   int(v.session.AirTemperature),
		Forecast:   []ForecastEntry{},
	}
	for _, f := range v.forecast() {
		res.Forecast = append(res.Forecast, ForecastEntry{
			MinutesAhead: int(f.TimeOffset),
			Weather:      packets.WeatherName(f.Weather),
			RainPct:      int(f.RainPercentage),
			TrackTempC:   int(f.TrackTemperature),
			AirTempC:     int(f.AirTemperature),
		})
	}
	return res
}

// TyreSetEntry is one of the player's tyre sets for the weekend.
type TyreSetEntry struct {
	Compound       string  `json:"compound"`
	WearPct        int     `json:"wear_pct"`
	UsableLifeLaps int     `json:"usable_life_laps"`
	LapDeltaSec    float64 `json:"lap_delta_vs_fitted_s"`
	Fitted         bool    `json:"fitted,omitempty"`
	Available      bool    `json:"available"`
	RecommendedFor string  `json:"recommended_session,omitempty"`
	ActualCompound string  `json:"actual_compound,omitempty"`
	LifeSpanLaps   int     `json:"life_span_laps,omitempty"`
}

type tyreSetsResult struct {
	Sets []TyreSetEntry `json:"sets"`
}

func (v *raceView) tyreSetList() (tyreSetsResult, error) {
	if v.tyreSets == nil {
		return tyreSetsResult{}, errors.New("no tyre set data received from the game yet")
	}
	res := tyreSetsResult{Sets: []TyreSetEntry{}}
	for i, set := range v.tyreSets.TyreSetData {
		if set.VisualTyreCompound == 0 {
			continue
		}
		entry := TyreSetEntry{
			Compound:       packets.VisualTyreCompoundName(set.VisualTyreCompound),
			WearPct:        int(set.Wear),
			UsableLifeLaps: int(set.UsableLife),
			LapDeltaSec:    roundTo(float64(set.LapDeltaTime)/packets.MillisPerSecond, 3),
			Fitted:         set.Fitted == 1 || i == int(v.tyreSets.FittedIdx),
			Available:      set.Available == 1,
			LifeSpanLaps:   int(set.LifeSpan),
		}
		if actual := packets.ActualTyreCompoundName(set.ActualTyreCompound); actual != packets.CompoundNameUnknown && actual != entry.Compound {
			entry.ActualCompound = actual
		}
		if set.RecommendedSession != 0 {
			entry.RecommendedFor = packets.SessionTypeName(set.RecommendedSession)
		}
		res.Sets = append(res.Sets, entry)
	}
	return res, nil
}

// CarStatusDetail is the player's car in detail, per corner in FL, FR, RL, RR order.
type CarStatusDetail struct {
	Tyre               string         `json:"tyre,omitempty"`
	TyreWearPct        [4]float64     `json:"tyre_wear_pct,omitempty"`
	TyreSurfaceTempC   [4]int         `json:"tyre_surface_temp_c,omitempty"`
	TyreInnerTempC     [4]int         `json:"tyre_inner_temp_c,omitempty"`
	TyreWindowC        string         `json:"tyre_optimal_window_c,omitempty"`
	TyrePressurePSI    [4]float64     `json:"tyre_pressure_psi,omitempty"`
	TyreBlistersPct    [4]int         `json:"tyre_blisters_pct,omitempty"`
	BrakeTempC         [4]int         `json:"brake_temp_c,omitempty"`
	EngineTempC        int            `json:"engine_temp_c,omitempty"`
	EnginePowerPct     float64        `json:"engine_power_pct,omitempty"`
	ERSBatteryPct      float64        `json:"ers_battery_pct"`
	ERSMode            string         `json:"ers_mode,omitempty"`
	ERSDeployedMJ      float64        `json:"ers_deployed_this_lap_mj"`
	ERSHarvestedMJ     float64        `json:"ers_harvested_this_lap_mj"`
	FuelKg             float64        `json:"fuel_kg"`
	FuelMarginLaps     float64        `json:"fuel_margin_laps"`
	FuelMix            string         `json:"fuel_mix,omitempty"`
	BrakeBiasPct       int            `json:"front_brake_bias_pct,omitempty"`
	Damage             string         `json:"damage"`
	PowerUnitWearPct   map[string]int `json:"power_unit_wear_pct,omitempty"`
	OvertakeAidAllowed bool           `json:"drs_or_override_allowed"`
}

func (v *raceView) carStatus() (CarStatusDetail, error) {
	st, hasStatus := v.statusOf(v.playerIdx)
	dmg, hasDamage := v.damageOf(v.playerIdx)
	tel, hasTelemetry := v.telemetryOf(v.playerIdx)
	if !hasStatus && !hasDamage && !hasTelemetry {
		return CarStatusDetail{}, errors.New("no car data received from the game yet")
	}
	var d CarStatusDetail
	if hasStatus {
		d.Tyre = describeTyre(st)
		d.ERSBatteryPct = roundTo(float64(st.ERSStoreEnergy)/packets.MaxERSStoreEnergyJoules*percentScale, 1)
		d.ERSMode = ersModeName(st.ERSDeployMode, v.packetFormat)
		d.ERSDeployedMJ = roundTo(float64(st.ERSDeployedThisLap)/JoulesPerMegajoule, 2)
		d.ERSHarvestedMJ = roundTo(float64(st.ERSHarvestedThisLapMGUK+st.ERSHarvestedThisLapMGUH)/JoulesPerMegajoule, 2)
		d.FuelKg = roundTo(float64(st.FuelInTank), 1)
		d.FuelMarginLaps = roundTo(float64(st.FuelRemainingLaps), 1)
		d.FuelMix = fuelMixName(st.FuelMix)
		d.BrakeBiasPct = int(st.FrontBrakeBias)
		d.OvertakeAidAllowed = st.DRSAllowed == 1
	}
	if hasTelemetry {
		window := GetTyreThermalWindow(st.ActualTyreCompound, st.VisualTyreCompound)
		d.TyreWindowC = fmt.Sprintf("%.0f-%.0f", window.MinTemp, window.MaxTemp)
		for i := range wheelNames {
			d.TyreSurfaceTempC[i] = int(tel.TyresSurfaceTemperature[i])
			d.TyreInnerTempC[i] = int(tel.TyresInnerTemperature[i])
			d.TyrePressurePSI[i] = roundTo(float64(tel.TyresPressure[i]), 1)
			d.BrakeTempC[i] = int(tel.BrakesTemperature[i])
		}
		d.EngineTempC = int(tel.EngineTemperature)
		powerPct, _ := CalculateEnginePowerPct(float32(tel.EngineTemperature))
		d.EnginePowerPct = roundTo(float64(powerPct), 1)
	}
	d.Damage = "none"
	if hasDamage {
		for i := range wheelNames {
			d.TyreWearPct[i] = roundTo(float64(dmg.TyresWear[i]), 1)
			d.TyreBlistersPct[i] = int(dmg.TyreBlisters[i])
		}
		if desc := describeDamage(dmg); desc != "" {
			d.Damage = desc
		}
		d.PowerUnitWearPct = map[string]int{
			"ICE":     int(dmg.EngineICEWear),
			"MGU-K":   int(dmg.EngineMGUKWear),
			"MGU-H":   int(dmg.EngineMGUHWear),
			"ES":      int(dmg.EngineESWear),
			"CE":      int(dmg.EngineCEWear),
			"TC":      int(dmg.EngineTCWear),
			"gearbox": int(dmg.GearBoxDamage),
		}
	}
	return d, nil
}

func fuelMixName(mix uint8) string {
	switch mix {
	case packets.FuelMixLean:
		return "Lean"
	case packets.FuelMixStandard:
		return "Standard"
	case packets.FuelMixRich:
		return "Rich"
	case packets.FuelMixMax:
		return "Max"
	}
	return fmt.Sprintf("mix %d", mix)
}
