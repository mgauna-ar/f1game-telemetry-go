package analytics

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/mgauna/f1game-telemetry-go/internal/storage"
)

// summaryRace is a three-car race: Hamilton wins from P3, Leclerc (car 1) finishes P2 from pole
// and sets the fastest lap, Norris (car 2) finishes P3 from P2.
func summaryRace(playerCar *int) (*storage.Session, []storage.Participant, []storage.Lap) {
	session := &storage.Session{ID: 1, TrackName: "Monza", SessionType: "Race", PlayerCarIndex: playerCar}
	participants := []storage.Participant{
		{CarIndex: 0, Name: "Lewis Hamilton", TeamID: 0, RaceNumber: 44, GridPosition: 3, Position: 1, TotalRaceTime: 180},
		{CarIndex: 1, Name: "Charles Leclerc", TeamID: 1, RaceNumber: 16, GridPosition: 1, Position: 2, TotalRaceTime: 181},
		{CarIndex: 2, Name: "Lando Norris", TeamID: 8, RaceNumber: 4, GridPosition: 2, Position: 3, TotalRaceTime: 182, AIControlled: true},
	}
	lap := func(id int64, car, number, ms int) storage.Lap {
		return storage.Lap{ID: id, SessionID: 1, CarIndex: car, LapNumber: number, LapTimeMS: ms, IsValid: true}
	}
	laps := []storage.Lap{
		lap(1, 0, 1, 90_500), lap(2, 0, 2, 89_500),
		lap(3, 1, 1, 90_800), lap(4, 1, 2, 89_100),
		lap(5, 2, 1, 91_000),
	}
	return session, participants, laps
}

func TestComputeSessionSummary(t *testing.T) {
	session, participants, laps := summaryRace(new(1))
	summary := ComputeSessionSummary(session, participants, laps, "")

	if summary.Leader == nil || summary.Leader.DriverName != "Lewis Hamilton" || summary.Leader.RaceNumber != 44 {
		t.Errorf("leader = %+v, want Lewis Hamilton", summary.Leader)
	}
	if summary.LapsCompleted != 2 {
		t.Errorf("laps_completed = %d, want the leader's 2", summary.LapsCompleted)
	}
	if fl := summary.FastestLap; fl == nil || fl.DriverName != "Charles Leclerc" || fl.LapTimeMS != 89_100 || fl.LapID != 4 {
		t.Errorf("fastest lap = %+v, want Leclerc 89100 (lap 4)", summary.FastestLap)
	}
	p := summary.Player
	if p == nil {
		t.Fatal("player = nil, want car 1")
	}
	if p.CarIndex != 1 || p.Source != PlayerSourceRecorded || p.Position != 2 || p.GridPosition != 1 ||
		p.PositionsGained == nil || *p.PositionsGained != -1 || p.ClassifiedCars != 3 ||
		p.BestLapID != 4 || p.BestLapTimeMS != 89_100 || p.LapsCompleted != 2 || p.IsDNF || p.IsDSQ {
		t.Errorf("player = %+v (gained %v)", p, p.PositionsGained)
	}
}

func TestComputeSessionSummaryPlayer(t *testing.T) {
	tests := []struct {
		name       string
		playerCar  *int
		driverName string
		wantCar    int // -1: no player
		wantSource string
	}{
		{name: "recorded car wins over the driver name", playerCar: new(2), driverName: "Hamilton", wantCar: 2, wantSource: PlayerSourceRecorded},
		{name: "recorded car not in the classification", playerCar: new(9), driverName: "Hamilton", wantCar: -1},
		{name: "old session, partial name, any case", driverName: "  leclerc ", wantCar: 1, wantSource: PlayerSourceDriverName},
		{name: "old session, race number", driverName: "4", wantCar: 2, wantSource: PlayerSourceDriverName},
		{name: "old session, race number with #", driverName: "#44", wantCar: 0, wantSource: PlayerSourceDriverName},
		{name: "old session, first car index of several matches", driverName: "l", wantCar: 0, wantSource: PlayerSourceDriverName},
		{name: "old session, no match", driverName: "Senna", wantCar: -1},
		{name: "old session, no driver name", wantCar: -1},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			session, participants, laps := summaryRace(tt.playerCar)
			p := ComputeSessionSummary(session, participants, laps, tt.driverName).Player
			if tt.wantCar < 0 {
				if p != nil {
					t.Errorf("player = %+v, want nil", p)
				}
				return
			}
			if p == nil || p.CarIndex != tt.wantCar || p.Source != tt.wantSource {
				t.Errorf("player = %+v, want car %d from %s", p, tt.wantCar, tt.wantSource)
			}
		})
	}
}

func TestComputeSessionSummaryEmptySession(t *testing.T) {
	summary := ComputeSessionSummary(&storage.Session{ID: 1, SessionType: "Race", PlayerCarIndex: new(0)}, nil, nil, "Hamilton")
	if summary.Leader != nil || summary.FastestLap != nil || summary.Player != nil || summary.LapsCompleted != 0 {
		t.Errorf("summary = %+v, want empty", summary)
	}
}

func TestComputeSessionList(t *testing.T) {
	session, participants, laps := summaryRace(nil)
	other := storage.Session{ID: 2, TrackName: "Spa", SessionType: "Race"}
	items := ComputeSessionList(
		[]storage.Session{*session, other},
		map[int64][]storage.Participant{1: participants},
		map[int64][]storage.Lap{1: laps},
		"Norris",
	)
	if len(items) != 2 || items[0].ID != 1 || items[1].ID != 2 {
		t.Fatalf("items = %+v, want sessions 1 and 2 in order", items)
	}
	if p := items[0].Summary.Player; p == nil || p.CarIndex != 2 {
		t.Errorf("session 1 player = %+v, want Norris (car 2)", p)
	}
	if items[1].Summary.Leader != nil {
		t.Errorf("session 2 has no results, got leader %+v", items[1].Summary.Leader)
	}
}

func TestSessionListItemJSON(t *testing.T) {
	item := SessionListItem{
		Session: storage.Session{ID: 7, TrackName: "Monza", WeatherForecast: `[{"weather":1}]`, PlayerCarIndex: new(3)},
		Summary: SessionSummary{LapsCompleted: 5, Leader: &SummaryDriver{DriverName: "Lewis Hamilton"}},
	}
	data, err := json.Marshal(item)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	var got struct {
		ID              int64             `json:"id"`
		TrackName       string            `json:"track_name"`
		PlayerCarIndex  *int              `json:"player_car_index"`
		WeatherForecast []json.RawMessage `json:"weather_forecast"`
		Summary         SessionSummary    `json:"summary"`
	}
	if err := json.Unmarshal(data, &got); err != nil {
		t.Fatalf("unmarshal %s: %v", data, err)
	}
	if got.ID != 7 || got.TrackName != "Monza" || got.PlayerCarIndex == nil || *got.PlayerCarIndex != 3 {
		t.Errorf("session fields lost: %s", data)
	}
	if len(got.WeatherForecast) != 1 {
		t.Errorf("weather_forecast should stay raw JSON: %s", data)
	}
	if got.Summary.LapsCompleted != 5 || got.Summary.Leader == nil || got.Summary.Leader.DriverName != "Lewis Hamilton" {
		t.Errorf("summary lost: %s", data)
	}
	if strings.Count(string(data), `"id":`) != 1 {
		t.Errorf("expected one flat object: %s", data)
	}
}
