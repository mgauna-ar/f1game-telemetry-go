package engineer

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"strconv"
	"strings"

	"github.com/mgauna/f1game-telemetry-go/internal/ai"
	"github.com/mgauna/f1game-telemetry-go/internal/packets"
)

// Race data tools the AI race engineer can call mid-conversation.
const (
	ToolGetStandings       = "get_standings"
	ToolGetDriver          = "get_driver"
	ToolGetLapHistory      = "get_lap_history"
	ToolGetWeatherForecast = "get_weather_forecast"
	ToolGetTyreSets        = "get_tyre_sets"
	ToolGetCarStatus       = "get_car_status"
	ToolGetStrategy        = "get_strategy"
	ToolGetRaceEvents      = "get_race_events"
)

// errNoLiveTelemetry is what the model hears when it calls a tool without a live session.
var errNoLiveTelemetry = errors.New("no live telemetry from the game right now")

// RaceTools returns the live race data lookups the AI race engineer can call.
func (e *EngineerEngine) RaceTools() ai.ToolExecutor {
	return raceTools{engine: e}
}

type raceTools struct {
	engine *EngineerEngine
}

func (raceTools) Definitions() []ai.ToolDefinition {
	return []ai.ToolDefinition{
		{
			Name:        ToolGetStandings,
			Description: "Full running order of every car: position, name, team, gap to you and to the leader (race) or best lap (practice and qualifying), last lap, current tyre and age, pit stops, penalties and whether the car is on track, in the pits or retired.",
		},
		{
			Name:        ToolGetDriver,
			Description: "Everything about one driver: position, gaps, recent lap and sector times, best lap, tyre stints so far, pit stops and penalties.",
			Parameters: map[string]any{
				"type": "object",
				"properties": map[string]any{
					"driver": map[string]any{
						"type":        "string",
						"description": "Driver name or surname, team name, race number, or a position such as 'P3'.",
					},
				},
				"required": []string{"driver"},
			},
		},
		{
			Name:        ToolGetLapHistory,
			Description: "Your own completed laps, newest last: lap and sector times, validity, tyre compound and age, tyre wear per corner, fuel, position and the gaps to the cars ahead and behind at the end of each lap.",
			Parameters: map[string]any{
				"type": "object",
				"properties": map[string]any{
					"laps": map[string]any{
						"type":        "integer",
						"description": fmt.Sprintf("How many recent laps to return (default %d, at most %d).", DefaultLapHistoryLimit, MaxLapHistoryLimit),
					},
				},
			},
		},
		{
			Name:        ToolGetWeatherForecast,
			Description: "Current weather and temperatures, and every forecast sample for this session: minutes ahead, weather, rain probability, track and air temperature.",
		},
		{
			Name:        ToolGetTyreSets,
			Description: "Your tyre sets for the weekend: compound, wear, usable life, lap time delta against the fitted set, and which are still available.",
		},
		{
			Name:        ToolGetCarStatus,
			Description: "Your car in detail: tyre wear, surface and inner temperatures, pressures and blisters; brake temperatures; engine temperature and power; ERS battery, mode and energy this lap; fuel, fuel mix and margin; all damage and power unit wear.",
		},
		{
			Name:        ToolGetStrategy,
			Description: "Strategy numbers: laps remaining, stint length, tyre wear per lap and laps to the wear limit, fuel burn against the target, pit window, rejoin position if pitting now, pit lane loss, recent pace and gap trends.",
		},
		{
			Name:        ToolGetRaceEvents,
			Description: "Race events recorded this session (pit stops, penalties, retirements, safety cars, fastest laps, overtakes involving you) and the calls the pit wall already made.",
		},
	}
}

func (t raceTools) Execute(_ context.Context, name string, args json.RawMessage) (any, error) {
	v, ok := t.engine.liveView()
	if !ok {
		return nil, errNoLiveTelemetry
	}
	switch name {
	case ToolGetStandings:
		return v.standings(), nil
	case ToolGetDriver:
		var in struct {
			Driver string `json:"driver"`
		}
		if err := json.Unmarshal(args, &in); err != nil || strings.TrimSpace(in.Driver) == "" {
			return nil, errors.New("pass the driver to look up, e.g. {\"driver\": \"Norris\"}")
		}
		return v.driverLookup(in.Driver)
	case ToolGetLapHistory:
		var in struct {
			Laps int `json:"laps"`
		}
		_ = json.Unmarshal(args, &in)
		return v.lapHistory(in.Laps), nil
	case ToolGetWeatherForecast:
		return v.weatherForecast(), nil
	case ToolGetTyreSets:
		return v.tyreSetList()
	case ToolGetCarStatus:
		return v.carStatus()
	case ToolGetStrategy:
		return struct {
			Session  SessionSummary  `json:"session"`
			Strategy StrategySummary `json:"strategy"`
		}{v.sessionSummary(), v.strategySummary()}, nil
	case ToolGetRaceEvents:
		return struct {
			Events []RaceEventRecord `json:"race_events"`
			Calls  []RadioCallRecord `json:"pit_wall_calls"`
		}{orEmpty(v.events), orEmpty(v.radioCalls)}, nil
	}
	return nil, fmt.Errorf("unknown tool %q", name)
}

func orEmpty[T any](items []T) []T {
	if items == nil {
		return []T{}
	}
	return items
}

// classifiedOrder returns every car that took part, sorted by position.
func (v *raceView) classifiedOrder() []int {
	var order []int
	for i := range v.lapData.LapData {
		l := v.lapData.LapData[i]
		if l.CarPosition > 0 && (l.ResultStatus >= packets.ResultStatusActive || i == v.playerIdx) {
			order = append(order, i)
		}
	}
	sort.Slice(order, func(a, b int) bool {
		return v.lapData.LapData[order[a]].CarPosition < v.lapData.LapData[order[b]].CarPosition
	})
	return order
}

type standingsResult struct {
	Session   string       `json:"session"`
	Lap       int          `json:"lap"`
	TotalLaps int          `json:"total_laps,omitempty"`
	Cars      []CarSummary `json:"cars"`
}

func (v *raceView) standings() standingsResult {
	res := standingsResult{
		Session: packets.SessionTypeName(v.session.SessionType),
		Lap:     int(v.playerLap().CurrentLapNum),
		Cars:    []CarSummary{},
	}
	if v.isRace() {
		res.TotalLaps = int(v.session.TotalLaps)
	}
	for _, idx := range v.classifiedOrder() {
		if car, ok := v.carSummary(idx); ok {
			res.Cars = append(res.Cars, car)
		}
	}
	return res
}

// DriverDetail is what the driver lookup tool reports for one car.
type DriverDetail struct {
	CarSummary
	RaceNumber int           `json:"race_number,omitempty"`
	BestLapNum int           `json:"best_lap_number,omitempty"`
	RecentLaps []DriverLap   `json:"recent_laps,omitempty"`
	TyreStints []DriverStint `json:"tyre_stints,omitempty"`
}

// DriverLap is one completed lap from a car's session history.
type DriverLap struct {
	Lap     int    `json:"lap"`
	Time    string `json:"time"`
	Sectors string `json:"sectors,omitempty"`
	Valid   bool   `json:"valid"`
}

// DriverStint is one tyre stint from a car's session history.
type DriverStint struct {
	Compound string `json:"compound"`
	EndLap   int    `json:"end_lap,omitempty"`
	Current  bool   `json:"current,omitempty"`
}

type driverLookupResult struct {
	Matches []DriverDetail `json:"matches"`
}

// driverLookup finds cars by position ("P3"), race number, name or team.
func (v *raceView) driverLookup(query string) (driverLookupResult, error) {
	idxs := v.findDrivers(query)
	if len(idxs) == 0 {
		names := make([]string, 0, len(v.lapData.LapData))
		for _, idx := range v.classifiedOrder() {
			names = append(names, fmt.Sprintf("P%d %s", v.lapData.LapData[idx].CarPosition, participantName(v.participants, idx)))
		}
		return driverLookupResult{}, fmt.Errorf("no driver matches %q; the field is: %s", query, strings.Join(names, ", "))
	}
	res := driverLookupResult{}
	for _, idx := range idxs {
		if detail, ok := v.driverDetail(idx); ok {
			res.Matches = append(res.Matches, detail)
		}
	}
	return res, nil
}

func (v *raceView) findDrivers(query string) []int {
	q := strings.ToLower(strings.TrimSpace(query))
	if pos, ok := parsePosition(q); ok {
		if idx := v.carAtAnyPosition(pos); idx >= 0 {
			return []int{idx}
		}
		return nil
	}
	order := v.classifiedOrder()
	if num, err := strconv.Atoi(strings.TrimPrefix(q, "#")); err == nil {
		for _, idx := range order {
			if v.participants != nil && int(v.participants.Participants[idx].RaceNumber) == num {
				return []int{idx}
			}
		}
		return nil
	}
	var byName, byTeam []int
	for _, idx := range order {
		if strings.Contains(strings.ToLower(participantName(v.participants, idx)), q) {
			byName = append(byName, idx)
		} else if team := strings.ToLower(v.teamName(idx)); team != "" && strings.Contains(team, q) {
			byTeam = append(byTeam, idx)
		}
	}
	if len(byName) > 0 {
		return byName
	}
	return byTeam
}

// carAtAnyPosition finds a car at a position whether or not it is still running.
func (v *raceView) carAtAnyPosition(pos int) int {
	for _, idx := range v.classifiedOrder() {
		if int(v.lapData.LapData[idx].CarPosition) == pos {
			return idx
		}
	}
	return -1
}

// parsePosition reads "p3", "position 3" or "3rd" as a position.
func parsePosition(q string) (int, bool) {
	switch {
	case strings.HasPrefix(q, "position"):
		q = strings.TrimPrefix(q, "position")
	case strings.HasPrefix(q, "p"):
		q = strings.TrimPrefix(q, "p")
	case strings.HasSuffix(q, "st"), strings.HasSuffix(q, "nd"), strings.HasSuffix(q, "rd"), strings.HasSuffix(q, "th"):
		q = q[:len(q)-2]
	default:
		return 0, false
	}
	n, err := strconv.Atoi(strings.TrimSpace(q))
	return n, err == nil && n > 0
}

func (v *raceView) driverDetail(idx int) (DriverDetail, bool) {
	car, ok := v.carSummary(idx)
	if !ok {
		return DriverDetail{}, false
	}
	detail := DriverDetail{CarSummary: car}
	if v.participants != nil {
		detail.RaceNumber = int(v.participants.Participants[idx].RaceNumber)
	}
	h := v.carHistory[idx]
	if h == nil {
		return detail, true
	}
	detail.BestLapNum = int(h.BestLapTimeLapNum)
	completed := min(int(h.NumLaps), len(h.LapHistoryData))
	for lap := max(1, completed-DriverToolRecentLaps+1); lap <= completed; lap++ {
		entry := h.LapHistoryData[lap-1]
		if entry.LapTimeInMS == 0 {
			continue
		}
		detail.RecentLaps = append(detail.RecentLaps, DriverLap{
			Lap:  lap,
			Time: formatLapTimeMS(entry.LapTimeInMS),
			Sectors: fmt.Sprintf("%s / %s / %s",
				formatLapTimeMS(splitTimeMS(entry.Sector1TimeMinutesPart, entry.Sector1TimeMSPart)),
				formatLapTimeMS(splitTimeMS(entry.Sector2TimeMinutesPart, entry.Sector2TimeMSPart)),
				formatLapTimeMS(splitTimeMS(entry.Sector3TimeMinutesPart, entry.Sector3TimeMSPart))),
			Valid: entry.LapValidBitFlags&packets.LapValidBitFlag != 0,
		})
	}
	stints := min(int(h.NumTyreStints), len(h.TyreStintHistoryData))
	for i := 0; i < stints; i++ {
		s := h.TyreStintHistoryData[i]
		stint := DriverStint{Compound: packets.VisualTyreCompoundName(s.TyreVisualCompound)}
		if s.EndLap == packets.ActiveStintEndLap {
			stint.Current = true
		} else {
			stint.EndLap = int(s.EndLap)
		}
		detail.TyreStints = append(detail.TyreStints, stint)
	}
	return detail, true
}
