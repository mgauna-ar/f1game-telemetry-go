package storage

import (
	"fmt"
	"github.com/jmoiron/sqlx"
)

const schema = `
CREATE TABLE IF NOT EXISTS sessions (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    session_uid   INTEGER UNIQUE NOT NULL,
    track_id      INTEGER NOT NULL,
    track_name    TEXT NOT NULL,
    session_type  TEXT NOT NULL,
    weather       TEXT,
    packet_format INTEGER NOT NULL,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS participants (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id      INTEGER REFERENCES sessions(id),
    car_index       INTEGER NOT NULL,
    name            TEXT,
    driver_id       INTEGER,
    team_id         INTEGER,
    race_number     INTEGER,
    ai_controlled   BOOLEAN,
    nationality     INTEGER,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(session_id, car_index)
);

CREATE TABLE IF NOT EXISTS laps (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id        INTEGER REFERENCES sessions(id),
    car_index         INTEGER NOT NULL DEFAULT 0,
    lap_number        INTEGER NOT NULL,
    lap_time_ms       INTEGER,
    sector1_ms        INTEGER,
    sector2_ms        INTEGER,
    sector3_ms        INTEGER,
    is_valid          BOOLEAN DEFAULT 1,
    tyre_compound     TEXT,
    fuel_load         REAL,
    max_speed_kmh     REAL,
    penalties_seconds INTEGER DEFAULT 0,
    car_position      INTEGER DEFAULT 0,
    result_status     INTEGER DEFAULT 0,
    stint             INTEGER DEFAULT 1,
    created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(session_id, car_index, lap_number)
);

CREATE TABLE IF NOT EXISTS telemetry_samples (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    lap_id          INTEGER REFERENCES laps(id),
    lap_distance    REAL NOT NULL,
    session_time    REAL NOT NULL,
    speed           INTEGER,
    throttle        REAL,
    brake           REAL,
    steer           REAL,
    gear            INTEGER,
    engine_rpm      INTEGER,
    drs             BOOLEAN,
    ers_deploy      REAL,
    ers_store_energy REAL,
    ers_deploy_mode INTEGER,
    world_pos_x     REAL,
    world_pos_y     REAL,
    world_pos_z     REAL
);

CREATE INDEX IF NOT EXISTS idx_samples_lap ON telemetry_samples(lap_id);
CREATE INDEX IF NOT EXISTS idx_samples_distance ON telemetry_samples(lap_id, lap_distance);
CREATE INDEX IF NOT EXISTS idx_laps_session ON laps(session_id);
CREATE INDEX IF NOT EXISTS idx_participants_session ON participants(session_id);
`

// Migrate runs the schema migrations to ensure the database is up to date.
func Migrate(db *sqlx.DB) error {
	_, err := db.Exec(schema)
	if err != nil {
		return fmt.Errorf("failed to execute migrations: %w", err)
	}

	// Add missing columns dynamically if upgrading an existing DB file
	_, _ = db.Exec("ALTER TABLE laps ADD COLUMN penalties_seconds INTEGER DEFAULT 0")
	_, _ = db.Exec("ALTER TABLE laps ADD COLUMN car_position INTEGER DEFAULT 0")
	_, _ = db.Exec("ALTER TABLE laps ADD COLUMN result_status INTEGER DEFAULT 0")
	_, _ = db.Exec("ALTER TABLE laps ADD COLUMN stint INTEGER DEFAULT 1")

	// Correct legacy session_type entries saved due to previous enum offset bug
	_, _ = db.Exec("UPDATE sessions SET session_type = 'Race' WHERE session_type = 'Sprint Qualifying 1'")

	return nil
}
