package storage

import (
	"context"
	"fmt"

	"github.com/jmoiron/sqlx"
	_ "modernc.org/sqlite"
)

// Repository handles database operations using SQLite.
type Repository struct {
	db *sqlx.DB
}

// NewRepository creates a new SQLite repository and applies migrations.
func NewRepository(dbPath string) (*Repository, error) {
	db, err := sqlx.Connect("sqlite", dbPath)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}

	// Enable WAL mode for better concurrency performance
	if _, err := db.Exec("PRAGMA journal_mode=WAL"); err != nil {
		return nil, fmt.Errorf("failed to enable WAL mode: %w", err)
	}

	if err := Migrate(db); err != nil {
		return nil, fmt.Errorf("failed to migrate database: %w", err)
	}

	return &Repository{db: db}, nil
}

// SaveSession inserts a new session or ignores if the session_uid already exists.
// Updates the ID of the passed Session struct if successful.
func (r *Repository) SaveSession(ctx context.Context, s *Session) error {
	query := `
		INSERT INTO sessions (session_uid, track_id, track_name, session_type, weather, packet_format)
		VALUES (:session_uid, :track_id, :track_name, :session_type, :weather, :packet_format)
		ON CONFLICT(session_uid) DO UPDATE SET
			track_id = excluded.track_id,
			track_name = excluded.track_name,
			session_type = excluded.session_type,
			weather = excluded.weather,
			packet_format = excluded.packet_format
		RETURNING id
	`
	rows, err := r.db.NamedQueryContext(ctx, query, s)
	if err != nil {
		return fmt.Errorf("failed to save session: %w", err)
	}
	defer rows.Close()

	if rows.Next() {
		if err := rows.Scan(&s.ID); err != nil {
			return fmt.Errorf("failed to scan session id: %w", err)
		}
	}
	return nil
}

// SaveLap inserts or updates a lap.
func (r *Repository) SaveLap(ctx context.Context, l *Lap) error {
	query := `
		INSERT INTO laps (session_id, lap_number, lap_time_ms, sector1_ms, sector2_ms, sector3_ms, is_valid, tyre_compound, fuel_load, max_speed_kmh)
		VALUES (:session_id, :lap_number, :lap_time_ms, :sector1_ms, :sector2_ms, :sector3_ms, :is_valid, :tyre_compound, :fuel_load, :max_speed_kmh)
		ON CONFLICT(session_id, lap_number) DO UPDATE SET
			lap_time_ms = excluded.lap_time_ms,
			sector1_ms = excluded.sector1_ms,
			sector2_ms = excluded.sector2_ms,
			sector3_ms = excluded.sector3_ms,
			is_valid = excluded.is_valid,
			tyre_compound = excluded.tyre_compound,
			fuel_load = excluded.fuel_load,
			max_speed_kmh = excluded.max_speed_kmh
		RETURNING id
	`
	rows, err := r.db.NamedQueryContext(ctx, query, l)
	if err != nil {
		return fmt.Errorf("failed to save lap: %w", err)
	}
	defer rows.Close()

	if rows.Next() {
		if err := rows.Scan(&l.ID); err != nil {
			return fmt.Errorf("failed to scan lap id: %w", err)
		}
	}
	return nil
}

// SaveTelemetryBatch inserts a batch of telemetry samples efficiently.
func (r *Repository) SaveTelemetryBatch(ctx context.Context, samples []TelemetrySample) error {
	if len(samples) == 0 {
		return nil
	}

	query := `
		INSERT INTO telemetry_samples (
			lap_id, lap_distance, session_time, speed, throttle, brake, steer, gear, engine_rpm, drs, ers_deploy, world_pos_x, world_pos_y, world_pos_z
		) VALUES (
			:lap_id, :lap_distance, :session_time, :speed, :throttle, :brake, :steer, :gear, :engine_rpm, :drs, :ers_deploy, :world_pos_x, :world_pos_y, :world_pos_z
		)
	`
	// Use NamedExec for bulk insert. SQLX handles executing this efficiently in a single transaction if we provide it,
	// or we can explicitly wrap it in a transaction for safety and speed.
	tx, err := r.db.Beginx()
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}

	// Prepare the statement for the transaction
	stmt, err := tx.PrepareNamedContext(ctx, query)
	if err != nil {
		tx.Rollback()
		return fmt.Errorf("failed to prepare named statement: %w", err)
	}
	defer stmt.Close()

	for _, sample := range samples {
		if _, err := stmt.ExecContext(ctx, sample); err != nil {
			tx.Rollback()
			return fmt.Errorf("failed to insert telemetry sample: %w", err)
		}
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}
	return nil
}

// Close closes the database connection.
func (r *Repository) Close() error {
	return r.db.Close()
}
