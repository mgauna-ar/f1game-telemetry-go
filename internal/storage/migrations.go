package storage

import (
	"fmt"

	"github.com/jmoiron/sqlx"
)

// Migration represents a single versioned schema migration.
type Migration struct {
	Version int
	Name    string
	SQL     string
}

var migrations = []Migration{
	{
		Version: 1,
		Name:    "baseline_schema",
		SQL: `
CREATE TABLE IF NOT EXISTS sessions (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    session_uid      TEXT UNIQUE NOT NULL,
    track_id         INTEGER NOT NULL,
    track_name       TEXT NOT NULL,
    session_type     TEXT NOT NULL,
    weather          TEXT,
    weather_forecast TEXT DEFAULT '',
    total_laps       INTEGER DEFAULT 0,
    ai_difficulty    INTEGER DEFAULT 0,
    session_duration INTEGER DEFAULT 0,
    packet_format    INTEGER NOT NULL,
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
    grid_position   INTEGER DEFAULT 0,
    position        INTEGER DEFAULT 0,
    points          INTEGER DEFAULT 0,
    total_race_time REAL DEFAULT 0,
    penalties_time  INTEGER DEFAULT 0,
    num_penalties   INTEGER DEFAULT 0,
    result_reason   INTEGER DEFAULT 0,
    num_pit_stops   INTEGER DEFAULT 0,
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
    sector1_valid     BOOLEAN DEFAULT 1,
    sector2_valid     BOOLEAN DEFAULT 1,
    sector3_valid     BOOLEAN DEFAULT 1,
    tyre_compound     TEXT,
    actual_compound   TEXT DEFAULT '',
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

CREATE INDEX IF NOT EXISTS idx_laps_session_car ON laps(session_id, car_index);
CREATE INDEX IF NOT EXISTS idx_laps_car_laptime ON laps(session_id, car_index, lap_time_ms);
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
`,
	},
	{
		Version: 2,
		Name:    "heal_ai_controlled_participants",
		SQL: `
UPDATE participants SET ai_controlled = 1 WHERE driver_id > 0 AND driver_id != 255;
`,
	},
	{
		Version: 3,
		Name:    "add_result_status_to_participants",
		SQL: `
ALTER TABLE participants ADD COLUMN result_status INTEGER DEFAULT 0;
UPDATE participants
SET result_status = (
    SELECT l.result_status
    FROM laps l
    WHERE l.session_id = participants.session_id
      AND l.car_index = participants.car_index
      AND l.result_status > 0
    ORDER BY l.lap_number DESC
    LIMIT 1
)
WHERE EXISTS (
    SELECT 1 FROM laps l
    WHERE l.session_id = participants.session_id
      AND l.car_index = participants.car_index
      AND l.result_status > 0
);
`,
	},
}

// Migrate runs all pending migrations in version order.
func Migrate(db *sqlx.DB) error {
	initVersionTable := `
	CREATE TABLE IF NOT EXISTS schema_version (
		version    INTEGER PRIMARY KEY,
		name       TEXT NOT NULL,
		applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);`
	if _, err := db.Exec(initVersionTable); err != nil {
		return fmt.Errorf("failed to initialize schema_version table: %w", err)
	}

	var currentVersion int
	err := db.Get(&currentVersion, "SELECT COALESCE(MAX(version), 0) FROM schema_version")
	if err != nil {
		return fmt.Errorf("failed to query schema_version: %w", err)
	}

	for _, m := range migrations {
		if m.Version <= currentVersion {
			continue
		}

		tx, err := db.Beginx()
		if err != nil {
			return fmt.Errorf("failed to begin transaction for migration %d (%s): %w", m.Version, m.Name, err)
		}

		if _, err := tx.Exec(m.SQL); err != nil {
			_ = tx.Rollback()
			return fmt.Errorf("failed to execute migration %d (%s): %w", m.Version, m.Name, err)
		}

		if _, err := tx.Exec("INSERT INTO schema_version (version, name) VALUES (?, ?)", m.Version, m.Name); err != nil {
			_ = tx.Rollback()
			return fmt.Errorf("failed to record schema_version %d (%s): %w", m.Version, m.Name, err)
		}

		if err := tx.Commit(); err != nil {
			return fmt.Errorf("failed to commit migration %d (%s): %w", m.Version, m.Name, err)
		}
	}

	return nil
}
