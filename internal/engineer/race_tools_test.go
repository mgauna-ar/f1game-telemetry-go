package engineer

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"testing"

	"github.com/mgauna/f1game-telemetry-go/internal/packets"
)

func callTool(t *testing.T, f *raceFixture, name, args string) (any, error) {
	t.Helper()
	return f.engine.RaceTools().Execute(context.Background(), name, json.RawMessage(args))
}

func mustCallTool(t *testing.T, f *raceFixture, name, args string) any {
	t.Helper()
	res, err := callTool(t, f, name, args)
	if err != nil {
		t.Fatalf("%s(%s) failed: %v", name, args, err)
	}
	return res
}

func toolResult[T any](t *testing.T, f *raceFixture, name, args string) T {
	t.Helper()
	res, ok := mustCallTool(t, f, name, args).(T)
	if !ok {
		t.Fatalf("%s returned an unexpected result type", name)
	}
	return res
}

func TestRaceTools_Definitions(t *testing.T) {
	defs := (raceTools{}).Definitions()
	want := []string{ToolGetStandings, ToolGetDriver, ToolGetLapHistory, ToolGetWeatherForecast, ToolGetTyreSets, ToolGetCarStatus, ToolGetStrategy, ToolGetRaceEvents}
	if len(defs) != len(want) {
		t.Fatalf("expected %d tools, got %d", len(want), len(defs))
	}
	for i, d := range defs {
		if d.Name != want[i] || d.Description == "" {
			t.Errorf("tool %d: expected %s with a description, got %+v", i, want[i], d)
		}
		if d.Parameters != nil {
			if _, err := json.Marshal(d.Parameters); err != nil {
				t.Errorf("%s parameters do not marshal: %v", d.Name, err)
			}
		}
	}
}

func TestRaceTools_WithoutLiveTelemetry(t *testing.T) {
	engine := newTestEngineerEngine(&mockBroadcaster{})
	_, err := engine.RaceTools().Execute(context.Background(), ToolGetStandings, json.RawMessage("{}"))
	if !errors.Is(err, errNoLiveTelemetry) {
		t.Fatalf("expected the no-telemetry error, got %v", err)
	}
}

func TestRaceTools_Standings(t *testing.T) {
	f := runRaceLaps(t)
	res := toolResult[standingsResult](t, f, ToolGetStandings, "{}")

	order := make([]string, 0, len(res.Cars))
	for _, car := range res.Cars {
		order = append(order, car.Name)
	}
	if strings.Join(order, ", ") != "Max Verstappen, Charles Leclerc, Matias Gauna, Lando Norris" {
		t.Fatalf("unexpected running order: %v", order)
	}
	if !res.Cars[2].IsYou || res.Cars[3].PitStops != 1 || res.Cars[3].RelativeToYou != "0.800s behind you" {
		t.Fatalf("unexpected standings detail: %+v", res.Cars)
	}
	if res.Lap != 5 || res.TotalLaps != 20 {
		t.Fatalf("expected lap 5 of 20, got %d of %d", res.Lap, res.TotalLaps)
	}
}

func TestRaceTools_DriverLookup(t *testing.T) {
	f := runRaceLaps(t)
	history := &packets.PacketSessionHistoryData{Header: f.header, CarIdx: fxNorris, NumLaps: 3, NumTyreStints: 2, BestLapTimeLapNum: 2}
	history.LapHistoryData[0] = packets.LapHistoryData{LapTimeInMS: 92100, Sector1TimeMSPart: 30100, Sector2TimeMSPart: 31000, Sector3TimeMSPart: 31000, LapValidBitFlags: packets.LapValidBitFlag}
	history.LapHistoryData[1] = packets.LapHistoryData{LapTimeInMS: 91500, Sector1TimeMSPart: 30000, Sector2TimeMSPart: 30500, Sector3TimeMSPart: 31000, LapValidBitFlags: packets.LapValidBitFlag}
	history.LapHistoryData[2] = packets.LapHistoryData{LapTimeInMS: 95000, Sector1TimeMSPart: 30000, Sector2TimeMSPart: 30000, Sector3TimeMSPart: 35000}
	history.TyreStintHistoryData[0] = packets.TyreStintHistoryData{EndLap: 3, TyreVisualCompound: packets.CompoundSoft}
	history.TyreStintHistoryData[1] = packets.TyreStintHistoryData{EndLap: packets.ActiveStintEndLap, TyreVisualCompound: packets.CompoundHard}
	f.send(history)

	cases := []struct {
		query string
		want  string
	}{
		{"Norris", "Lando Norris"},
		{"lando norris", "Lando Norris"},
		{"P2", "Charles Leclerc"},
		{"position 1", "Max Verstappen"},
		{"3rd", "Matias Gauna"},
		{"Ferrari", "Charles Leclerc"},
	}
	for _, tc := range cases {
		res := toolResult[driverLookupResult](t, f, ToolGetDriver, `{"driver":"`+tc.query+`"}`)
		if len(res.Matches) != 1 || res.Matches[0].Name != tc.want {
			t.Errorf("%q: expected %s, got %+v", tc.query, tc.want, res.Matches)
		}
	}

	norris := toolResult[driverLookupResult](t, f, ToolGetDriver, `{"driver":"Norris"}`).Matches[0]
	if len(norris.RecentLaps) != 3 || norris.RecentLaps[1].Time != "1:31.500" || norris.RecentLaps[1].Sectors != "30.000 / 30.500 / 31.000" || norris.RecentLaps[2].Valid {
		t.Fatalf("unexpected recent laps: %+v", norris.RecentLaps)
	}
	if len(norris.TyreStints) != 2 || norris.TyreStints[0].EndLap != 3 || !norris.TyreStints[1].Current || norris.BestLap != "1:31.500" {
		t.Fatalf("unexpected stints or best lap: %+v", norris)
	}

	_, err := callTool(t, f, ToolGetDriver, `{"driver":"Hamilton"}`)
	if err == nil || !strings.Contains(err.Error(), "P1 Max Verstappen") {
		t.Fatalf("expected an unknown driver to list the field, got %v", err)
	}
	if _, err := callTool(t, f, ToolGetDriver, `{}`); err == nil {
		t.Fatalf("expected an error without a driver")
	}
}

func TestParsePosition(t *testing.T) {
	cases := map[string]int{"p3": 3, "p 12": 12, "position 7": 7, "1st": 1, "22nd": 22, "3rd": 3, "4th": 4}
	for in, want := range cases {
		if got, ok := parsePosition(in); !ok || got != want {
			t.Errorf("parsePosition(%q) = %d, %v; want %d", in, got, ok, want)
		}
	}
	for _, in := range []string{"piastri", "perez", "smith", "norris", "p0"} {
		if _, ok := parsePosition(in); ok {
			t.Errorf("parsePosition(%q) should not be a position", in)
		}
	}
}

func TestRaceTools_LapHistory(t *testing.T) {
	f := runRaceLaps(t)

	all := toolResult[lapHistoryResult](t, f, ToolGetLapHistory, `{}`)
	if len(all.Laps) != 4 {
		t.Fatalf("expected the 4 completed laps, got %d", len(all.Laps))
	}
	last2 := toolResult[lapHistoryResult](t, f, ToolGetLapHistory, `{"laps":2}`)
	if len(last2.Laps) != 2 || last2.Laps[0].Lap != 3 || last2.Laps[1].Lap != 4 {
		t.Fatalf("expected laps 3 and 4, got %+v", last2.Laps)
	}
	lap := last2.Laps[1]
	if lap.TyreWearPct[1] != 18 || lap.FuelKg != 33.6 || lap.Position != 3 || lap.GapAheadSec != 1.1 || lap.Compound == "" {
		t.Fatalf("unexpected lap detail: %+v", lap)
	}

	fresh := newRaceFixture(t)
	fresh.send(fresh.lapData(1, 0, 1500, 0))
	if res := toolResult[lapHistoryResult](t, fresh, ToolGetLapHistory, `{"laps":50}`); len(res.Laps) != 0 || res.Note == "" {
		t.Fatalf("expected an empty history with a note, got %+v", res)
	}
}

func TestRaceTools_WeatherForecast(t *testing.T) {
	f := runRaceLaps(t)
	res := toolResult[weatherResult](t, f, ToolGetWeatherForecast, `{}`)
	if res.Weather != "Overcast" || len(res.Forecast) != 2 || res.Forecast[0].MinutesAhead != 5 || res.Forecast[1].RainPct != 70 {
		t.Fatalf("unexpected forecast: %+v", res)
	}
}

func TestRaceTools_TyreSets(t *testing.T) {
	f := runRaceLaps(t)
	if _, err := callTool(t, f, ToolGetTyreSets, `{}`); err == nil {
		t.Fatalf("expected an error before tyre set data arrives")
	}

	sets := &packets.PacketTyreSetsData{Header: f.header, CarIdx: fxPlayer, FittedIdx: 0}
	sets.TyreSetData[0] = packets.TyreSetData{VisualTyreCompound: packets.CompoundMedium, ActualTyreCompound: packets.ActualCompoundC3, Wear: 18, Available: 1, UsableLife: 14, Fitted: 1}
	sets.TyreSetData[1] = packets.TyreSetData{VisualTyreCompound: packets.CompoundHard, ActualTyreCompound: packets.ActualCompoundC2, Available: 1, UsableLife: 30, LapDeltaTime: 450}
	sets.TyreSetData[2] = packets.TyreSetData{VisualTyreCompound: packets.CompoundSoft, Wear: 40, Available: 0}
	f.send(sets)

	res := toolResult[tyreSetsResult](t, f, ToolGetTyreSets, `{}`)
	if len(res.Sets) != 3 || !res.Sets[0].Fitted || res.Sets[1].LapDeltaSec != 0.45 || res.Sets[2].Available {
		t.Fatalf("unexpected tyre sets: %+v", res.Sets)
	}
}

func TestRaceTools_CarStatus(t *testing.T) {
	f := runRaceLaps(t)
	res := toolResult[CarStatusDetail](t, f, ToolGetCarStatus, `{}`)
	if res.ERSBatteryPct != 50 || res.FuelKg != 33.6 || res.TyreWearPct[1] != 18 || res.Damage != "none" || res.ERSMode != "Medium" {
		t.Fatalf("unexpected car status: %+v", res)
	}
}

func TestRaceTools_StrategyAndEvents(t *testing.T) {
	f := runRaceLaps(t)
	if _, err := callTool(t, f, ToolGetStrategy, `{}`); err != nil {
		t.Fatalf("strategy failed: %v", err)
	}
	b, _ := json.Marshal(mustCallTool(t, f, ToolGetRaceEvents, `{}`))
	if !strings.Contains(string(b), "Lando Norris pitted (stop 1)") || !strings.Contains(string(b), `"pit_wall_calls":[`) {
		t.Fatalf("unexpected race events: %s", b)
	}
	if _, err := callTool(t, f, "get_everything", `{}`); err == nil {
		t.Fatalf("expected an unknown tool to fail")
	}
}
