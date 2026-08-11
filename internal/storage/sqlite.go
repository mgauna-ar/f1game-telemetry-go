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

// UpdateSessionMetadata updates the track name, session type, and weather for a given session_uid.
func (r *Repository) UpdateSessionMetadata(ctx context.Context, sessionUID uint64, trackID int, trackName, sessionType, weather string) error {
	query := `
		UPDATE sessions 
		SET track_id = ?, track_name = ?, session_type = ?, weather = ?
		WHERE session_uid = ? AND (track_name = 'Unknown' OR session_type = 'Unknown' OR weather = 'Unknown')
	`
	_, err := r.db.ExecContext(ctx, query, trackID, trackName, sessionType, weather, int64(sessionUID))
	if err != nil {
		return fmt.Errorf("failed to update session metadata: %w", err)
	}
	return nil
}

// SaveLap inserts or updates a lap.
func (r *Repository) SaveLap(ctx context.Context, l *Lap) error {
	query := `
		INSERT INTO laps (session_id, car_index, lap_number, lap_time_ms, sector1_ms, sector2_ms, sector3_ms, is_valid, tyre_compound, fuel_load, max_speed_kmh, penalties_seconds, car_position, result_status)
		VALUES (:session_id, :car_index, :lap_number, :lap_time_ms, :sector1_ms, :sector2_ms, :sector3_ms, :is_valid, :tyre_compound, :fuel_load, :max_speed_kmh, :penalties_seconds, :car_position, :result_status)
		ON CONFLICT(session_id, car_index, lap_number) DO UPDATE SET
			lap_time_ms = excluded.lap_time_ms,
			sector1_ms = excluded.sector1_ms,
			sector2_ms = excluded.sector2_ms,
			sector3_ms = excluded.sector3_ms,
			is_valid = excluded.is_valid,
			tyre_compound = excluded.tyre_compound,
			fuel_load = excluded.fuel_load,
			max_speed_kmh = excluded.max_speed_kmh,
			penalties_seconds = excluded.penalties_seconds,
			car_position = excluded.car_position,
			result_status = excluded.result_status
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

	// 4. Delete car setups for this session
	if _, err := tx.ExecContext(ctx, `DELETE FROM car_setups WHERE session_id = ?`, sessionID); err != nil {
		return fmt.Errorf("failed to delete car setups: %w", err)
	}

	// 5. Delete session entry
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
	return laps, nil
}

// GetTelemetryByLap retrieves time-series telemetry data for a specific lap.
func (r *Repository) GetTelemetryByLap(ctx context.Context, lapID int64) ([]TelemetrySample, error) {
	var samples []TelemetrySample
	// Ordered by session_time to ensure time-series consistency
	query := `SELECT * FROM telemetry_samples WHERE lap_id = ? ORDER BY session_time ASC`
	if err := r.db.SelectContext(ctx, &samples, query, lapID); err != nil {
		return nil, fmt.Errorf("failed to get telemetry for lap: %w", err)
	}
	return samples, nil
}

// GetLapByID retrieves a single lap by its ID.
func (r *Repository) GetLapByID(ctx context.Context, lapID int64) (*Lap, error) {
	var lap Lap
	query := `SELECT * FROM laps WHERE id = ?`
	if err := r.db.GetContext(ctx, &lap, query, lapID); err != nil {
		return nil, fmt.Errorf("failed to get lap: %w", err)
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

// SaveCarSetups upserts car setups for a given session.
func (r *Repository) SaveCarSetups(ctx context.Context, sessionID int64, setups []CarSetup) error {
	if len(setups) == 0 {
		return nil
	}

	tx, err := r.db.Beginx()
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}

	query := `
		INSERT INTO car_setups (
			session_id, car_index, front_wing, rear_wing, on_throttle, off_throttle,
			front_camber, rear_camber, front_toe, rear_toe,
			front_suspension, rear_suspension, front_anti_roll_bar, rear_anti_roll_bar,
			front_suspension_height, rear_suspension_height, brake_pressure, brake_bias,
			front_tyre_pressure, rear_tyre_pressure, ballast, fuel_load
		) VALUES (
			:session_id, :car_index, :front_wing, :rear_wing, :on_throttle, :off_throttle,
			:front_camber, :rear_camber, :front_toe, :rear_toe,
			:front_suspension, :rear_suspension, :front_anti_roll_bar, :rear_anti_roll_bar,
			:front_suspension_height, :rear_suspension_height, :brake_pressure, :brake_bias,
			:front_tyre_pressure, :rear_tyre_pressure, :ballast, :fuel_load
		) ON CONFLICT(session_id, car_index) DO UPDATE SET
			front_wing = excluded.front_wing,
			rear_wing = excluded.rear_wing,
			on_throttle = excluded.on_throttle,
			off_throttle = excluded.off_throttle,
			front_camber = excluded.front_camber,
			rear_camber = excluded.rear_camber,
			front_toe = excluded.front_toe,
			rear_toe = excluded.rear_toe,
			front_suspension = excluded.front_suspension,
			rear_suspension = excluded.rear_suspension,
			front_anti_roll_bar = excluded.front_anti_roll_bar,
			rear_anti_roll_bar = excluded.rear_anti_roll_bar,
			front_suspension_height = excluded.front_suspension_height,
			rear_suspension_height = excluded.rear_suspension_height,
			brake_pressure = excluded.brake_pressure,
			brake_bias = excluded.brake_bias,
			front_tyre_pressure = excluded.front_tyre_pressure,
			rear_tyre_pressure = excluded.rear_tyre_pressure,
			ballast = excluded.ballast,
			fuel_load = excluded.fuel_load
	`

	stmt, err := tx.PrepareNamedContext(ctx, query)
	if err != nil {
		tx.Rollback()
		return fmt.Errorf("failed to prepare car setups statement: %w", err)
	}
	defer stmt.Close()

	for i := range setups {
		setups[i].SessionID = sessionID
		if _, err := stmt.ExecContext(ctx, setups[i]); err != nil {
			tx.Rollback()
			return fmt.Errorf("failed to save car setup at index %d: %w", setups[i].CarIndex, err)
		}
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit car setups transaction: %w", err)
	}
	return nil
}

// GetCarSetupsBySession retrieves all car setups recorded for a given session.
func (r *Repository) GetCarSetupsBySession(ctx context.Context, sessionID int64) ([]CarSetup, error) {
	var setups []CarSetup
	query := `SELECT * FROM car_setups WHERE session_id = ? ORDER BY car_index ASC`
	if err := r.db.SelectContext(ctx, &setups, query, sessionID); err != nil {
		return nil, fmt.Errorf("failed to get car setups: %w", err)
	}
	return setups, nil
}

// Close closes the database connection.
func (r *Repository) Close() error {
	return r.db.Close()
}
