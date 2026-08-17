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
    session_id      INTEGER REFERENCES sessions(id) ON DELETE CASCADE,
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
    session_id        INTEGER REFERENCES sessions(id) ON DELETE CASCADE,
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

CREATE TABLE IF NOT EXISTS lap_telemetry (
    lap_id        INTEGER PRIMARY KEY REFERENCES laps(id) ON DELETE CASCADE,
    sample_count  INTEGER NOT NULL,
    data          BLOB NOT NULL,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_laps_session ON laps(session_id);
CREATE INDEX IF NOT EXISTS idx_participants_session ON participants(session_id);

CREATE TABLE IF NOT EXISTS tags (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT UNIQUE NOT NULL COLLATE NOCASE,
    color      TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS session_tags (
    session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    tag_id     INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (session_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_session_tags_session ON session_tags(session_id);
CREATE INDEX IF NOT EXISTS idx_session_tags_tag ON session_tags(tag_id);
`

// Migrate runs the base schema creation to ensure the database is initialized.
func Migrate(db *sqlx.DB) error {
	_, err := db.Exec(schema)
	if err != nil {
		return fmt.Errorf("failed to execute schema: %w", err)
	}
	return nil
}
