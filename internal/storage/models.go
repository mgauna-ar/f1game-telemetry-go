package storage

import "time"

// Session represents a racing session.
type Session struct {
	ID           int64     `db:"id" json:"id"`
	SessionUID   uint64    `db:"session_uid" json:"session_uid"`
	TrackID      int       `db:"track_id" json:"track_id"`
	TrackName    string    `db:"track_name" json:"track_name"`
	SessionType  string    `db:"session_type" json:"session_type"`
	Weather      string    `db:"weather" json:"weather"`
	PacketFormat int       `db:"packet_format" json:"packet_format"`
	CreatedAt    time.Time `db:"created_at" json:"created_at"`
}

// Lap represents a single lap for a session.
type Lap struct {
	ID           int64     `db:"id" json:"id"`
	SessionID    int64     `db:"session_id" json:"session_id"`
	CarIndex     int       `db:"car_index" json:"car_index"`
	LapNumber    int       `db:"lap_number" json:"lap_number"`
	LapTimeMS    int       `db:"lap_time_ms" json:"lap_time_ms"`
	Sector1MS    int       `db:"sector1_ms" json:"sector1_ms"`
	Sector2MS    int       `db:"sector2_ms" json:"sector2_ms"`
	Sector3MS    int       `db:"sector3_ms" json:"sector3_ms"`
	IsValid      bool      `db:"is_valid" json:"is_valid"`
	TyreCompound string    `db:"tyre_compound" json:"tyre_compound"`
	FuelLoad     float64   `db:"fuel_load" json:"fuel_load"`
	MaxSpeedKMH  float64   `db:"max_speed_kmh" json:"max_speed_kmh"`
	CreatedAt    time.Time `db:"created_at" json:"created_at"`
}

// TelemetrySample represents a single telemetry snapshot within a lap.
type TelemetrySample struct {
	ID          int64   `db:"id" json:"id"`
	LapID       int64   `db:"lap_id" json:"lap_id"`
	LapDistance float64 `db:"lap_distance" json:"lap_distance"`
	SessionTime float64 `db:"session_time" json:"session_time"`
	Speed       int     `db:"speed" json:"speed"`
	Throttle    float64 `db:"throttle" json:"throttle"`
	Brake       float64 `db:"brake" json:"brake"`
	Steer       float64 `db:"steer" json:"steer"`
	Gear        int     `db:"gear" json:"gear"`
	EngineRPM   int     `db:"engine_rpm" json:"engine_rpm"`
	DRS         bool    `db:"drs" json:"drs"`
	ERSDeploy   float64 `db:"ers_deploy" json:"ers_deploy"`
	WorldPosX   float64 `db:"world_pos_x" json:"world_pos_x"`
	WorldPosY   float64 `db:"world_pos_y" json:"world_pos_y"`
	WorldPosZ   float64 `db:"world_pos_z" json:"world_pos_z"`
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
