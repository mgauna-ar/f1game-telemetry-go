package storage

import "time"

// Session represents a racing session.
type Session struct {
	ID           int64     `db:"id"`
	SessionUID   uint64    `db:"session_uid"`
	TrackID      int       `db:"track_id"`
	TrackName    string    `db:"track_name"`
	SessionType  string    `db:"session_type"`
	Weather      string    `db:"weather"`
	PacketFormat int       `db:"packet_format"`
	CreatedAt    time.Time `db:"created_at"`
}

// Lap represents a single lap for a session.
type Lap struct {
	ID           int64     `db:"id"`
	SessionID    int64     `db:"session_id"`
	LapNumber    int       `db:"lap_number"`
	LapTimeMS    int       `db:"lap_time_ms"`
	Sector1MS    int       `db:"sector1_ms"`
	Sector2MS    int       `db:"sector2_ms"`
	Sector3MS    int       `db:"sector3_ms"`
	IsValid      bool      `db:"is_valid"`
	TyreCompound string    `db:"tyre_compound"`
	FuelLoad     float64   `db:"fuel_load"`
	MaxSpeedKMH  float64   `db:"max_speed_kmh"`
	CreatedAt    time.Time `db:"created_at"`
}

// TelemetrySample represents a single telemetry snapshot within a lap.
type TelemetrySample struct {
	ID          int64   `db:"id"`
	LapID       int64   `db:"lap_id"`
	LapDistance float64 `db:"lap_distance"`
	SessionTime float64 `db:"session_time"`
	Speed       int     `db:"speed"`
	Throttle    float64 `db:"throttle"`
	Brake       float64 `db:"brake"`
	Steer       float64 `db:"steer"`
	Gear        int     `db:"gear"`
	EngineRPM   int     `db:"engine_rpm"`
	DRS         bool    `db:"drs"`
	ERSDeploy   float64 `db:"ers_deploy"`
	WorldPosX   float64 `db:"world_pos_x"`
	WorldPosY   float64 `db:"world_pos_y"`
	WorldPosZ   float64 `db:"world_pos_z"`
}
