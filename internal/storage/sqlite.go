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

// UpdateSessionMetadata updates the track name, session type, and dynamic weather for a given session_uid.
func (r *Repository) UpdateSessionMetadata(ctx context.Context, sessionUID uint64, trackID int, trackName, sessionType, weather string) error {
	query := `
		UPDATE sessions 
		SET 
			track_id = CASE WHEN ? != -1 THEN ? ELSE track_id END,
			track_name = CASE WHEN ? != '' AND ? != 'Unknown' THEN ? ELSE track_name END,
			session_type = CASE WHEN ? != '' AND ? != 'Unknown' THEN ? ELSE session_type END,
			weather = CASE WHEN ? != '' AND ? != 'Unknown' THEN ? ELSE weather END
		WHERE session_uid = ?
	`
	_, err := r.db.ExecContext(ctx, query,
		trackID, trackID,
		trackName, trackName, trackName,
		sessionType, sessionType, sessionType,
		weather, weather, weather,
		int64(sessionUID),
	)
	if err != nil {
		return fmt.Errorf("failed to update session metadata: %w", err)
	}
	return nil
}

// SaveLap inserts or updates a lap.
func (r *Repository) SaveLap(ctx context.Context, l *Lap) error {
	if l.Sector3MS <= 0 && l.LapTimeMS > 0 && l.Sector1MS > 0 && l.Sector2MS > 0 {
		s3 := l.LapTimeMS - (l.Sector1MS + l.Sector2MS)
		if s3 > 0 {
			l.Sector3MS = s3
		}
	}

	query := `
		INSERT INTO laps (session_id, car_index, lap_number, lap_time_ms, sector1_ms, sector2_ms, sector3_ms, is_valid, tyre_compound, fuel_load, max_speed_kmh, penalties_seconds, car_position, result_status, stint)
		VALUES (:session_id, :car_index, :lap_number, :lap_time_ms, :sector1_ms, :sector2_ms, :sector3_ms, :is_valid, :tyre_compound, :fuel_load, :max_speed_kmh, :penalties_seconds, :car_position, :result_status, :stint)
		ON CONFLICT(session_id, car_index, lap_number) DO UPDATE SET
			lap_time_ms = excluded.lap_time_ms,
			sector1_ms = excluded.sector1_ms,
			sector2_ms = excluded.sector2_ms,
			sector3_ms = excluded.sector3_ms,
			is_valid = excluded.is_valid,
			tyre_compound = excluded.tyre_compound,
			fuel_load = excluded.fuel_load,
			max_speed_kmh = CASE WHEN excluded.max_speed_kmh > laps.max_speed_kmh THEN excluded.max_speed_kmh ELSE laps.max_speed_kmh END,
			penalties_seconds = excluded.penalties_seconds,
			car_position = excluded.car_position,
			result_status = excluded.result_status,
			stint = excluded.stint
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

// SaveLapHistoryEntry updates or inserts lap timing data received from SessionHistory packet.
func (r *Repository) SaveLapHistoryEntry(ctx context.Context, l *Lap) error {
	if l.Sector3MS <= 0 && l.LapTimeMS > 0 && l.Sector1MS > 0 && l.Sector2MS > 0 {
		s3 := l.LapTimeMS - (l.Sector1MS + l.Sector2MS)
		if s3 > 0 {
			l.Sector3MS = s3
		}
	}

	query := `
		INSERT INTO laps (session_id, car_index, lap_number, lap_time_ms, sector1_ms, sector2_ms, sector3_ms, is_valid, tyre_compound, fuel_load, max_speed_kmh, penalties_seconds, car_position, result_status, stint)
		VALUES (:session_id, :car_index, :lap_number, :lap_time_ms, :sector1_ms, :sector2_ms, :sector3_ms, :is_valid, :tyre_compound, :fuel_load, :max_speed_kmh, :penalties_seconds, :car_position, :result_status, :stint)
		ON CONFLICT(session_id, car_index, lap_number) DO UPDATE SET
			lap_time_ms = CASE WHEN excluded.lap_time_ms > 0 THEN excluded.lap_time_ms ELSE laps.lap_time_ms END,
			sector1_ms = CASE WHEN excluded.sector1_ms > 0 THEN excluded.sector1_ms ELSE laps.sector1_ms END,
			sector2_ms = CASE WHEN excluded.sector2_ms > 0 THEN excluded.sector2_ms ELSE laps.sector2_ms END,
			sector3_ms = CASE WHEN excluded.sector3_ms > 0 THEN excluded.sector3_ms ELSE laps.sector3_ms END,
			is_valid = excluded.is_valid
		RETURNING id
	`
	rows, err := r.db.NamedQueryContext(ctx, query, l)
	if err != nil {
		return fmt.Errorf("failed to save lap history entry: %w", err)
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
			lap_id, lap_distance, session_time, speed, throttle, brake, steer, gear, engine_rpm, drs, ers_deploy, ers_store_energy, ers_deploy_mode, world_pos_x, world_pos_y, world_pos_z
		) VALUES (
			:lap_id, :lap_distance, :session_time, :speed, :throttle, :brake, :steer, :gear, :engine_rpm, :drs, :ers_deploy, :ers_store_energy, :ers_deploy_mode, :world_pos_x, :world_pos_y, :world_pos_z
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

// DeleteSession deletes a session and all its associated laps, telemetry samples, participants, and car setups.
func (r *Repository) DeleteSession(ctx context.Context, sessionID int64) error {
	tx, err := r.db.Beginx()
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	// 1. Delete telemetry samples for laps belonging to this session
	deleteSamplesQuery := `
		DELETE FROM telemetry_samples
		WHERE lap_id IN (SELECT id FROM laps WHERE session_id = ?)
	`
	if _, err := tx.ExecContext(ctx, deleteSamplesQuery, sessionID); err != nil {
		return fmt.Errorf("failed to delete telemetry samples: %w", err)
	}

	// 2. Delete laps for this session
	if _, err := tx.ExecContext(ctx, `DELETE FROM laps WHERE session_id = ?`, sessionID); err != nil {
		return fmt.Errorf("failed to delete laps: %w", err)
	}

	// 3. Delete participants for this session
	if _, err := tx.ExecContext(ctx, `DELETE FROM participants WHERE session_id = ?`, sessionID); err != nil {
		return fmt.Errorf("failed to delete participants: %w", err)
	}

	// 4. Delete session entry
	res, err := tx.ExecContext(ctx, `DELETE FROM sessions WHERE id = ?`, sessionID)
	if err != nil {
		return fmt.Errorf("failed to delete session: %w", err)
	}

	rowsAffected, err := res.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to check rows affected: %w", err)
	}
	if rowsAffected == 0 {
		return fmt.Errorf("session not found")
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit delete transaction: %w", err)
	}
	return nil
}

// GetSessions retrieves all valid recorded sessions, ordered by most recent first.
func (r *Repository) GetSessions(ctx context.Context) ([]Session, error) {
	var sessions []Session
	query := `
		SELECT s.* FROM sessions s
		WHERE s.session_uid != 0
		  AND (s.track_name != 'Unknown' OR EXISTS (SELECT 1 FROM laps l WHERE l.session_id = s.id))
		ORDER BY s.created_at DESC
	`
	if err := r.db.SelectContext(ctx, &sessions, query); err != nil {
		return nil, fmt.Errorf("failed to get sessions: %w", err)
	}
	return sessions, nil
}

// GetLapsBySession retrieves all laps for a given session.
func (r *Repository) GetLapsBySession(ctx context.Context, sessionID int64) ([]Lap, error) {
	var laps []Lap
	query := `
		SELECT * FROM laps 
		WHERE session_id = ? 
		  AND (lap_time_ms > 0 OR EXISTS (SELECT 1 FROM telemetry_samples WHERE lap_id = laps.id))
		ORDER BY lap_number ASC
	`
	if err := r.db.SelectContext(ctx, &laps, query, sessionID); err != nil {
		return nil, fmt.Errorf("failed to get laps: %w", err)
	}

	for i := range laps {
		if laps[i].Sector3MS <= 0 && laps[i].LapTimeMS > 0 && laps[i].Sector1MS > 0 && laps[i].Sector2MS > 0 {
			s3 := laps[i].LapTimeMS - (laps[i].Sector1MS + laps[i].Sector2MS)
			if s3 > 0 {
				laps[i].Sector3MS = s3
			}
		}
	}

	return laps, nil
}

// GetTelemetryByLap retrieves time-series telemetry data for a specific lap.
func (r *Repository) GetTelemetryByLap(ctx context.Context, lapID int64) ([]TelemetrySample, error) {
	var samples []TelemetrySample
	// Ordered by id to preserve chronological insertion sequence across restarts/laps
	query := `SELECT * FROM telemetry_samples WHERE lap_id = ? ORDER BY id ASC`
	if err := r.db.SelectContext(ctx, &samples, query, lapID); err != nil {
		return nil, fmt.Errorf("failed to get telemetry for lap: %w", err)
	}
	return samples, nil
}

// DeleteTelemetryByLap deletes all telemetry samples for a given lap ID.
func (r *Repository) DeleteTelemetryByLap(ctx context.Context, lapID int64) error {
	query := `DELETE FROM telemetry_samples WHERE lap_id = ?`
	if _, err := r.db.ExecContext(ctx, query, lapID); err != nil {
		return fmt.Errorf("failed to delete telemetry for lap %d: %w", lapID, err)
	}
	return nil
}

// GetLapByID retrieves a single lap by its ID.
func (r *Repository) GetLapByID(ctx context.Context, lapID int64) (*Lap, error) {
	var lap Lap
	query := `SELECT * FROM laps WHERE id = ?`
	if err := r.db.GetContext(ctx, &lap, query, lapID); err != nil {
		return nil, fmt.Errorf("failed to get lap: %w", err)
	}
	if lap.Sector3MS <= 0 && lap.LapTimeMS > 0 && lap.Sector1MS > 0 && lap.Sector2MS > 0 {
		s3 := lap.LapTimeMS - (lap.Sector1MS + lap.Sector2MS)
		if s3 > 0 {
			lap.Sector3MS = s3
		}
	}
	return &lap, nil
}

// SaveParticipants upserts participants for a given session.
func (r *Repository) SaveParticipants(ctx context.Context, sessionID int64, participants []Participant) error {
	if len(participants) == 0 {
		return nil
	}

	tx, err := r.db.Beginx()
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}

	query := `
		INSERT INTO participants (session_id, car_index, name, driver_id, team_id, race_number, ai_controlled, nationality)
		VALUES (:session_id, :car_index, :name, :driver_id, :team_id, :race_number, :ai_controlled, :nationality)
		ON CONFLICT(session_id, car_index) DO UPDATE SET
			name = excluded.name,
			driver_id = excluded.driver_id,
			team_id = excluded.team_id,
			race_number = excluded.race_number,
			ai_controlled = excluded.ai_controlled,
			nationality = excluded.nationality
	`

	stmt, err := tx.PrepareNamedContext(ctx, query)
	if err != nil {
		tx.Rollback()
		return fmt.Errorf("failed to prepare participants statement: %w", err)
	}
	defer stmt.Close()

	for i := range participants {
		participants[i].SessionID = sessionID
		if _, err := stmt.ExecContext(ctx, participants[i]); err != nil {
			tx.Rollback()
			return fmt.Errorf("failed to save participant at index %d: %w", participants[i].CarIndex, err)
		}
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit participants transaction: %w", err)
	}
	return nil
}

// GetParticipantsBySession retrieves all participants for a given session.
func (r *Repository) GetParticipantsBySession(ctx context.Context, sessionID int64) ([]Participant, error) {
	var participants []Participant
	query := `SELECT * FROM participants WHERE session_id = ? ORDER BY car_index ASC`
	if err := r.db.SelectContext(ctx, &participants, query, sessionID); err != nil {
		return nil, fmt.Errorf("failed to get participants: %w", err)
	}
	return participants, nil
}

// Close closes the database connection.
func (r *Repository) Close() error {
	return r.db.Close()
}
