package storage

import "time"

// Tag represents a category or league tag for organizing sessions.
type Tag struct {
	ID        int64     `db:"id" json:"id"`
	Name      string    `db:"name" json:"name"`
	Color     string    `db:"color" json:"color"`
	CreatedAt time.Time `db:"created_at" json:"created_at"`
}

// Session represents a racing session.
type Session struct {
	ID              int64     `db:"id" json:"id"`
	SessionUID      int64     `db:"session_uid" json:"session_uid"`
	TrackID         int       `db:"track_id" json:"track_id"`
	TrackName       string    `db:"track_name" json:"track_name"`
	SessionType     string    `db:"session_type" json:"session_type"`
	Weather         string    `db:"weather" json:"weather"`
	TotalLaps       int       `db:"total_laps" json:"total_laps"`
	AIDifficulty    int       `db:"ai_difficulty" json:"ai_difficulty"`
	SessionDuration int       `db:"session_duration" json:"session_duration"`
	PacketFormat    int       `db:"packet_format" json:"packet_format"`
	CreatedAt       time.Time `db:"created_at" json:"created_at"`
	Tags            []Tag     `db:"-" json:"tags"`
}

// DeriveSector3 calculates sector 3 time from lap time and sector 1/2 if missing.
func DeriveSector3(lap *Lap) {
	if lap == nil {
		return
	}
	if lap.Sector3MS <= 0 && lap.LapTimeMS > 0 && lap.Sector1MS > 0 && lap.Sector2MS > 0 {
		s3 := lap.LapTimeMS - (lap.Sector1MS + lap.Sector2MS)
		if s3 > 0 {
			lap.Sector3MS = s3
		}
	}
}

// Lap represents a single lap for a session.
type Lap struct {
	ID               int64     `db:"id" json:"id"`
	SessionID        int64     `db:"session_id" json:"session_id"`
	CarIndex         int       `db:"car_index" json:"car_index"`
	LapNumber        int       `db:"lap_number" json:"lap_number"`
	LapTimeMS        int       `db:"lap_time_ms" json:"lap_time_ms"`
	Sector1MS        int       `db:"sector1_ms" json:"sector1_ms"`
	Sector2MS        int       `db:"sector2_ms" json:"sector2_ms"`
	Sector3MS        int       `db:"sector3_ms" json:"sector3_ms"`
	IsValid          bool      `db:"is_valid" json:"is_valid"`
	TyreCompound     string    `db:"tyre_compound" json:"tyre_compound"`
	FuelLoad         float64   `db:"fuel_load" json:"fuel_load"`
	MaxSpeedKMH      float64   `db:"max_speed_kmh" json:"max_speed_kmh"`
	PenaltiesSeconds int       `db:"penalties_seconds" json:"penalties_seconds"`
	CarPosition      int       `db:"car_position" json:"car_position"`
	ResultStatus     int       `db:"result_status" json:"result_status"`
	Stint            int       `db:"stint" json:"stint"`
	CreatedAt        time.Time `db:"created_at" json:"created_at"`
	HasTelemetry     bool      `db:"has_telemetry" json:"has_telemetry"`
	SampleCount      int       `db:"sample_count" json:"sample_count"`
}

// TelemetrySample represents a single telemetry snapshot within a lap.
type TelemetrySample struct {
	LapDistance         float64 `json:"lap_distance"`
	SessionTime         float64 `json:"session_time"`
	Speed               int     `json:"speed"`
	Throttle            float64 `json:"throttle"`
	Brake               float64 `json:"brake"`
	Steer               float64 `json:"steer"`
	Gear                int     `json:"gear"`
	EngineRPM           int     `json:"engine_rpm"`
	DRS                 bool    `json:"drs"`
	ERSDeploy           float64 `json:"ers_deploy"`
	ERSStoreEnergy      float64 `json:"ers_store_energy"`
	ERSDeployMode       int     `json:"ers_deploy_mode"`
	WorldPosX           float64 `json:"world_pos_x"`
	WorldPosY           float64 `json:"world_pos_y"`
	WorldPosZ           float64 `json:"world_pos_z"`
	ActiveAeroMode      int     `json:"active_aero_mode,omitempty"`
	ActiveAeroAvailable int     `json:"active_aero_available,omitempty"`
	OvertakeActive      int     `json:"overtake_active,omitempty"`
}

// Participant represents a driver/participant in a session.
type Participant struct {
	ID           int64     `db:"id" json:"id"`
	SessionID    int64     `db:"session_id" json:"session_id"`
	CarIndex     int       `db:"car_index" json:"car_index"`
	Name         string    `db:"name" json:"name"`
	DriverID     int       `db:"driver_id" json:"driver_id"`
	TeamID       int       `db:"team_id" json:"team_id"`
	RaceNumber   int       `db:"race_number" json:"race_number"`
	AIControlled bool      `db:"ai_controlled" json:"ai_controlled"`
	Nationality  int       `db:"nationality" json:"nationality"`
	CreatedAt    time.Time `db:"created_at" json:"created_at"`
}

// LapTelemetryBlob represents the compressed telemetry payload for a single lap.
type LapTelemetryBlob struct {
	LapID       int64     `db:"lap_id" json:"lap_id"`
	SampleCount int       `db:"sample_count" json:"sample_count"`
	Data        []byte    `db:"data" json:"-"`
	CreatedAt   time.Time `db:"created_at" json:"created_at"`
}

// ExportedLapPackage represents a lap and its telemetry samples for export/import.
type ExportedLapPackage struct {
	Lap       Lap               `json:"lap"`
	Telemetry []TelemetrySample `json:"telemetry,omitempty"`
}

// ExportedSessionPackage represents a fully self-contained exported session.
type ExportedSessionPackage struct {
	Version      string               `json:"version"`
	Session      Session              `json:"session"`
	Tags         []Tag                `json:"tags"`
	Participants []Participant        `json:"participants"`
	Laps         []ExportedLapPackage `json:"laps"`
}
