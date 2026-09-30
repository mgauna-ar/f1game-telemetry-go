package session

import "github.com/mgauna/f1game-telemetry-go/internal/packets"

// LiveSnapshot is the consolidated 10Hz live state sent on /ws. It carries only the fields the
// dashboard reads, one entry per active car (ActiveCarCount), and only the filled weather forecast
// samples. Field names and types match the packet structs they are copied from. A live view that
// needs another packet field adds it here first. The engineer engine and session recording read
// the raw packets, not this.
type LiveSnapshot struct {
	Header         packets.PacketHeader `json:"Header"`
	Session        *LiveSession         `json:"Session,omitempty"`
	Participants   []LiveParticipant    `json:"Participants,omitempty"`
	LapData        []LiveLapData        `json:"LapData,omitempty"`
	CarTelemetry   []LiveCarTelemetry   `json:"CarTelemetry,omitempty"`
	CarTelemetry2  []LiveCarTelemetry2  `json:"CarTelemetry2,omitempty"`
	CarStatus      []LiveCarStatus      `json:"CarStatus,omitempty"`
	CarDamage      []LiveCarDamage      `json:"CarDamage,omitempty"`
	Events         []FeedEvent          `json:"Events,omitempty"`
	ActiveCarCount int                  `json:"ActiveCarCount,omitempty"`
	// GapAheadTrend and GapBehindTrend are the race engineer's gap trends to the player's
	// neighbours (see LiveGapTrend); omitted until two lap ends with the same car there.
	GapAheadTrend  *LiveGapTrend `json:"GapAheadTrend,omitempty"`
	GapBehindTrend *LiveGapTrend `json:"GapBehindTrend,omitempty"`
	// LapTimes is each car's completed-lap timing from the session history packets, by car
	// index like LapData; omitted until the first history packet of the session.
	LapTimes []LiveLapTimes `json:"LapTimes,omitempty"`
}

// LiveLapTimes is a car's completed-lap timing, from its session history packet. LapData's
// sector times belong to the lap in progress; these belong to finished laps. Zero means not set yet.
type LiveLapTimes struct {
	// LastSectorsMS are the sector times of the car's last completed lap.
	LastSectorsMS [3]uint32 `json:"LastSectorsMS"`
	// BestSectorsMS are the car's best time in each sector this session.
	BestSectorsMS [3]uint32 `json:"BestSectorsMS"`
	// BestLapTimeInMS is the car's best lap this session as the game counts it (valid laps only).
	BestLapTimeInMS uint32 `json:"BestLapTimeInMS"`
}

// LiveGapTrend is how the gap between the player and a neighbour changed per lap over the last
// lap ends while the same car was there, as the race engineer measures it.
type LiveGapTrend struct {
	// CarIndex is the neighbour's car index.
	CarIndex uint8 `json:"CarIndex"`
	// ChangePerLapMS is the gap's change per lap: positive when it grew, negative when it shrank.
	ChangePerLapMS int32 `json:"ChangePerLapMS"`
	// Laps is how many laps the change was measured over.
	Laps uint8 `json:"Laps"`
}

// LiveSession is the part of packets.PacketSessionData the live views read.
type LiveSession struct {
	Weather                uint8                           `json:"Weather"`
	TrackTemperature       int8                            `json:"TrackTemperature"`
	AirTemperature         int8                            `json:"AirTemperature"`
	TotalLaps              uint8                           `json:"TotalLaps"`
	SessionType            uint8                           `json:"SessionType"`
	TrackId                int8                            `json:"TrackId"`
	TrackLength            uint16                          `json:"TrackLength"`
	SessionTimeLeft        uint16                          `json:"SessionTimeLeft"`
	SafetyCarStatus        uint8                           `json:"SafetyCarStatus"`
	NumRedFlagPeriods      uint8                           `json:"NumRedFlagPeriods"`
	PitStopWindowIdealLap  uint8                           `json:"PitStopWindowIdealLap"`
	PitStopWindowLatestLap uint8                           `json:"PitStopWindowLatestLap"`
	PitStopRejoinPosition  uint8                           `json:"PitStopRejoinPosition"`
	WeatherForecastSamples []packets.WeatherForecastSample `json:"WeatherForecastSamples"`
}

// LiveParticipant is the part of packets.ParticipantData the live views read.
type LiveParticipant struct {
	AIControlled uint8  `json:"AIControlled"`
	DriverId     uint16 `json:"DriverId"`
	TeamId       uint16 `json:"TeamId"`
	RaceNumber   uint8  `json:"RaceNumber"`
	Name         string `json:"Name"`
}

// LiveLapData is the part of packets.LapData the live views read.
type LiveLapData struct {
	LastLapTimeInMS              uint32  `json:"LastLapTimeInMS"`
	CurrentLapTimeInMS           uint32  `json:"CurrentLapTimeInMS"`
	Sector1TimeMSPart            uint16  `json:"Sector1TimeMSPart"`
	Sector2TimeMSPart            uint16  `json:"Sector2TimeMSPart"`
	DeltaToCarInFrontMSPart      uint16  `json:"DeltaToCarInFrontMSPart"`
	DeltaToCarInFrontMinutesPart uint8   `json:"DeltaToCarInFrontMinutesPart"`
	DeltaToRaceLeaderMSPart      uint16  `json:"DeltaToRaceLeaderMSPart"`
	DeltaToRaceLeaderMinutesPart uint8   `json:"DeltaToRaceLeaderMinutesPart"`
	LapDistance                  float32 `json:"LapDistance"`
	CarPosition                  uint8   `json:"CarPosition"`
	CurrentLapNum                uint8   `json:"CurrentLapNum"`
	PitStatus                    uint8   `json:"PitStatus"`
	NumPitStops                  uint8   `json:"NumPitStops"`
	CurrentLapInvalid            uint8   `json:"CurrentLapInvalid"`
	Penalties                    uint8   `json:"Penalties"`
	TotalWarnings                uint8   `json:"TotalWarnings"`
	CornerCuttingWarnings        uint8   `json:"CornerCuttingWarnings"`
	NumUnservedDriveThroughPens  uint8   `json:"NumUnservedDriveThroughPens"`
	NumUnservedStopGoPens        uint8   `json:"NumUnservedStopGoPens"`
	GridPosition                 uint8   `json:"GridPosition"`
	DriverStatus                 uint8   `json:"DriverStatus"`
	ResultStatus                 uint8   `json:"ResultStatus"`
	PitLaneTimeInLaneInMS        uint16  `json:"PitLaneTimeInLaneInMS"`
	PitStopTimerInMS             uint16  `json:"PitStopTimerInMS"`
	SpeedTrapFastestSpeed        float32 `json:"SpeedTrapFastestSpeed"`
	SpeedTrapFastestLap          uint8   `json:"SpeedTrapFastestLap"`
}

// LiveCarTelemetry is the part of packets.CarTelemetryData the live views read.
type LiveCarTelemetry struct {
	Speed                   uint16    `json:"Speed"`
	BrakesTemperature       [4]uint16 `json:"BrakesTemperature"`
	TyresSurfaceTemperature [4]uint8  `json:"TyresSurfaceTemperature"`
	TyresInnerTemperature   [4]uint8  `json:"TyresInnerTemperature"`
	EngineTemperature       uint16    `json:"EngineTemperature"`
}

// LiveCarTelemetry2 is the part of packets.CarTelemetry2Data (2026 only) the live views read.
type LiveCarTelemetry2 struct {
	ActiveAeroMode uint8 `json:"ActiveAeroMode"`
	OvertakeActive uint8 `json:"OvertakeActive"`
}

// LiveCarStatus is the part of packets.CarStatusData the live views read.
type LiveCarStatus struct {
	FuelInTank         float32 `json:"FuelInTank"`
	FuelRemainingLaps  float32 `json:"FuelRemainingLaps"`
	ActualTyreCompound uint8   `json:"ActualTyreCompound"`
	VisualTyreCompound uint8   `json:"VisualTyreCompound"`
	TyresAgeLaps       uint8   `json:"TyresAgeLaps"`
	ERSStoreEnergy     float32 `json:"ERSStoreEnergy"`
	ERSDeployMode      uint8   `json:"ERSDeployMode"`
	VehicleFIAFlags    int8    `json:"VehicleFIAFlags"`
	DRSAllowed         uint8   `json:"DRSAllowed"`
}

// LiveCarDamage is the part of packets.CarDamageData the live views read.
type LiveCarDamage struct {
	TyresWear            [4]float32 `json:"TyresWear"`
	FrontLeftWingDamage  uint8      `json:"FrontLeftWingDamage"`
	FrontRightWingDamage uint8      `json:"FrontRightWingDamage"`
	FloorDamage          uint8      `json:"FloorDamage"`
	DiffuserDamage       uint8      `json:"DiffuserDamage"`
}

func newLiveSession(p *packets.PacketSessionData) *LiveSession {
	if p == nil {
		return nil
	}
	numSamples := min(int(p.NumWeatherForecastSamples), packets.MaxWeatherForecastSamples)
	return &LiveSession{
		Weather:                p.Weather,
		TrackTemperature:       p.TrackTemperature,
		AirTemperature:         p.AirTemperature,
		TotalLaps:              p.TotalLaps,
		SessionType:            p.SessionType,
		TrackId:                p.TrackId,
		TrackLength:            p.TrackLength,
		SessionTimeLeft:        p.SessionTimeLeft,
		SafetyCarStatus:        p.SafetyCarStatus,
		NumRedFlagPeriods:      p.NumRedFlagPeriods,
		PitStopWindowIdealLap:  p.PitStopWindowIdealLap,
		PitStopWindowLatestLap: p.PitStopWindowLatestLap,
		PitStopRejoinPosition:  p.PitStopRejoinPosition,
		WeatherForecastSamples: append([]packets.WeatherForecastSample{}, p.WeatherForecastSamples[:numSamples]...),
	}
}

// liveCars converts the first n car slots of a packet.
func liveCars[T, D any](cars *[packets.MaxCars]T, n int, conv func(*T) D) []D {
	n = min(max(n, 0), packets.MaxCars)
	out := make([]D, n)
	for i := range out {
		out[i] = conv(&cars[i])
	}
	return out
}

func toLiveParticipant(p *packets.ParticipantData) LiveParticipant {
	return LiveParticipant{
		AIControlled: p.AIControlled,
		DriverId:     p.DriverId,
		TeamId:       p.TeamId,
		RaceNumber:   p.RaceNumber,
		Name:         p.NameString(),
	}
}

func toLiveLapData(l *packets.LapData) LiveLapData {
	return LiveLapData{
		LastLapTimeInMS:              l.LastLapTimeInMS,
		CurrentLapTimeInMS:           l.CurrentLapTimeInMS,
		Sector1TimeMSPart:            l.Sector1TimeMSPart,
		Sector2TimeMSPart:            l.Sector2TimeMSPart,
		DeltaToCarInFrontMSPart:      l.DeltaToCarInFrontMSPart,
		DeltaToCarInFrontMinutesPart: l.DeltaToCarInFrontMinutesPart,
		DeltaToRaceLeaderMSPart:      l.DeltaToRaceLeaderMSPart,
		DeltaToRaceLeaderMinutesPart: l.DeltaToRaceLeaderMinutesPart,
		LapDistance:                  l.LapDistance,
		CarPosition:                  l.CarPosition,
		CurrentLapNum:                l.CurrentLapNum,
		PitStatus:                    l.PitStatus,
		NumPitStops:                  l.NumPitStops,
		CurrentLapInvalid:            l.CurrentLapInvalid,
		Penalties:                    l.Penalties,
		TotalWarnings:                l.TotalWarnings,
		CornerCuttingWarnings:        l.CornerCuttingWarnings,
		NumUnservedDriveThroughPens:  l.NumUnservedDriveThroughPens,
		NumUnservedStopGoPens:        l.NumUnservedStopGoPens,
		GridPosition:                 l.GridPosition,
		DriverStatus:                 l.DriverStatus,
		ResultStatus:                 l.ResultStatus,
		PitLaneTimeInLaneInMS:        l.PitLaneTimeInLaneInMS,
		PitStopTimerInMS:             l.PitStopTimerInMS,
		SpeedTrapFastestSpeed:        l.SpeedTrapFastestSpeed,
		SpeedTrapFastestLap:          l.SpeedTrapFastestLap,
	}
}

func toLiveCarTelemetry(t *packets.CarTelemetryData) LiveCarTelemetry {
	return LiveCarTelemetry{
		Speed:                   t.Speed,
		BrakesTemperature:       t.BrakesTemperature,
		TyresSurfaceTemperature: t.TyresSurfaceTemperature,
		TyresInnerTemperature:   t.TyresInnerTemperature,
		EngineTemperature:       t.EngineTemperature,
	}
}

func toLiveCarTelemetry2(t *packets.CarTelemetry2Data) LiveCarTelemetry2 {
	return LiveCarTelemetry2{
		ActiveAeroMode: t.ActiveAeroMode,
		OvertakeActive: t.OvertakeActive,
	}
}

func toLiveCarStatus(s *packets.CarStatusData) LiveCarStatus {
	return LiveCarStatus{
		FuelInTank:         s.FuelInTank,
		FuelRemainingLaps:  s.FuelRemainingLaps,
		ActualTyreCompound: s.ActualTyreCompound,
		VisualTyreCompound: s.VisualTyreCompound,
		TyresAgeLaps:       s.TyresAgeLaps,
		ERSStoreEnergy:     s.ERSStoreEnergy,
		ERSDeployMode:      s.ERSDeployMode,
		VehicleFIAFlags:    s.VehicleFIAFlags,
		DRSAllowed:         s.DRSAllowed,
	}
}

func toLiveCarDamage(d *packets.CarDamageData) LiveCarDamage {
	return LiveCarDamage{
		TyresWear:            d.TyresWear,
		FrontLeftWingDamage:  d.FrontLeftWingDamage,
		FrontRightWingDamage: d.FrontRightWingDamage,
		FloorDamage:          d.FloorDamage,
		DiffuserDamage:       d.DiffuserDamage,
	}
}

// toLiveLapTimes reads a car's completed-lap timing from its session history packet.
func toLiveLapTimes(h *packets.PacketSessionHistoryData) LiveLapTimes {
	var out LiveLapTimes
	if h == nil {
		return out
	}
	if last, ok := h.LastCompletedLap(); ok {
		out.LastSectorsMS = last.SectorsMS()
	}
	if lap, ok := h.Lap(int(h.BestLapTimeLapNum)); ok {
		out.BestLapTimeInMS = lap.LapTimeInMS
	}
	for i, lapNum := range [3]uint8{h.BestSector1LapNum, h.BestSector2LapNum, h.BestSector3LapNum} {
		if lap, ok := h.Lap(int(lapNum)); ok {
			out.BestSectorsMS[i] = lap.SectorsMS()[i]
		}
	}
	return out
}
