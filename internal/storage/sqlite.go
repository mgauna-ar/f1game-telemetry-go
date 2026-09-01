package storage

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/klauspost/compress/zstd"
	_ "modernc.org/sqlite"
)

var (
	zstdEncoder, _ = zstd.NewWriter(nil, zstd.WithEncoderLevel(zstd.SpeedDefault))
	zstdDecoder, _ = zstd.NewReader(nil)
)

// SanitizeFloat replaces NaN and Inf with 0.0 to ensure safe JSON serialization and database storage.
func SanitizeFloat(f float64) float64 {
	if math.IsNaN(f) || math.IsInf(f, 0) {
		return 0.0
	}
	return f
}

// CompressRaw compresses raw bytes with zstandard.
func CompressRaw(data []byte) []byte {
	return zstdEncoder.EncodeAll(data, make([]byte, 0, len(data)/4))
}

// DecompressRaw decompresses zstandard-compressed bytes.
func DecompressRaw(compressed []byte) ([]byte, error) {
	return zstdDecoder.DecodeAll(compressed, nil)
}

func compressJSON(data any) ([]byte, error) {
	raw, err := json.Marshal(data)
	if err != nil {
		return nil, err
	}
	return CompressRaw(raw), nil
}

func decompressJSON[T any](compressed []byte, out *T) error {
	decompressed, err := DecompressRaw(compressed)
	if err != nil {
		return fmt.Errorf("failed to decompress zstd data: %w", err)
	}
	if err := json.Unmarshal(decompressed, out); err != nil {
		return fmt.Errorf("failed to unmarshal decompressed json: %w", err)
	}
	return nil
}

// Compile-time check that SQLiteRepository implements Repository.
var _ Repository = (*SQLiteRepository)(nil)

// SQLiteRepository handles database operations using SQLite.
type SQLiteRepository struct {
	db *sqlx.DB
}

// NewSQLiteRepository creates a new SQLite repository and applies migrations.
func NewSQLiteRepository(dbPath string) (*SQLiteRepository, error) {
	dsn := dbPath
	if !strings.Contains(dsn, "_pragma=") && !strings.Contains(dsn, "_busy_timeout=") {
		sep := "?"
		if strings.Contains(dsn, "?") {
			sep = "&"
		}
		dsn = fmt.Sprintf("%s%s_pragma=busy_timeout(10000)&_pragma=journal_mode(WAL)&_pragma=foreign_keys(ON)&_pragma=synchronous(NORMAL)", dbPath, sep)
	}

	db, err := sqlx.Connect("sqlite", dsn)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}

	// Limit to single connection for writes to serialize concurrent access and eliminate SQLITE_BUSY lock contention
	db.SetMaxOpenConns(1)
	db.SetMaxIdleConns(1)

	// Ensure foreign keys are always enforced on this connection
	if _, err := db.Exec("PRAGMA foreign_keys=ON;"); err != nil {
		db.Close()
		return nil, fmt.Errorf("failed to enable foreign keys: %w", err)
	}

	repo := &SQLiteRepository{db: db}
	if err := Migrate(db); err != nil {
		db.Close()
		return nil, fmt.Errorf("failed to run migrations: %w", err)
	}

	return repo, nil
}

// DB returns the underlying sqlx.DB instance.
func (r *SQLiteRepository) DB() *sqlx.DB {
	return r.db
}

// SaveSession inserts a new session or ignores if the session_uid already exists.
// Updates the ID of the passed Session struct if successful.
func (r *SQLiteRepository) SaveSession(ctx context.Context, s *Session) error {
	return saveSession(ctx, r.db, s)
}

func saveSession(ctx context.Context, db sqlx.ExtContext, s *Session) error {
	query := `
		INSERT INTO sessions (session_uid, track_id, track_name, session_type, weather, weather_forecast, total_laps, ai_difficulty, session_duration, packet_format)
		VALUES (:session_uid, :track_id, :track_name, :session_type, :weather, :weather_forecast, :total_laps, :ai_difficulty, :session_duration, :packet_format)
		ON CONFLICT(session_uid) DO UPDATE SET
			track_id = excluded.track_id,
			track_name = excluded.track_name,
			session_type = excluded.session_type,
			weather = CASE WHEN sessions.weather IS NULL OR sessions.weather = '' OR sessions.weather = 'Unknown' THEN excluded.weather ELSE sessions.weather END,
			weather_forecast = CASE WHEN excluded.weather_forecast != '' THEN excluded.weather_forecast ELSE sessions.weather_forecast END,
			total_laps = CASE WHEN excluded.total_laps > 0 THEN excluded.total_laps ELSE sessions.total_laps END,
			ai_difficulty = CASE WHEN excluded.ai_difficulty > 0 THEN excluded.ai_difficulty ELSE sessions.ai_difficulty END,
			session_duration = CASE WHEN excluded.session_duration > 0 THEN excluded.session_duration ELSE sessions.session_duration END,
			packet_format = excluded.packet_format
		RETURNING id
	`
	rows, err := sqlx.NamedQueryContext(ctx, db, query, s)
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

// UpdateSessionMetadata updates the track name, session type, initial weather, weather forecast, total laps, ai difficulty, and session duration for a given session_uid.
func (r *SQLiteRepository) UpdateSessionMetadata(ctx context.Context, sessionUID string, trackID int, trackName, sessionType, weather, weatherForecast string, totalLaps, aiDifficulty, sessionDuration int) error {
	query := `
		UPDATE sessions 
		SET 
			track_id = CASE WHEN ? != -1 THEN ? ELSE track_id END,
			track_name = CASE WHEN ? != '' AND ? != 'Unknown' THEN ? ELSE track_name END,
			session_type = CASE WHEN ? != '' AND ? != 'Unknown' THEN ? ELSE session_type END,
			weather = CASE WHEN (weather IS NULL OR weather = '' OR weather = 'Unknown') AND ? != '' AND ? != 'Unknown' THEN ? ELSE weather END,
			weather_forecast = CASE WHEN ? != '' THEN ? ELSE weather_forecast END,
			total_laps = CASE WHEN ? > 0 THEN ? ELSE total_laps END,
			ai_difficulty = CASE WHEN ? > 0 THEN ? ELSE ai_difficulty END,
			session_duration = CASE WHEN ? > 0 THEN ? ELSE session_duration END
		WHERE session_uid = ?
	`
	_, err := r.db.ExecContext(ctx, query,
		trackID, trackID,
		trackName, trackName, trackName,
		sessionType, sessionType, sessionType,
		weather, weather, weather,
		weatherForecast, weatherForecast,
		totalLaps, totalLaps,
		aiDifficulty, aiDifficulty,
		sessionDuration, sessionDuration,
		sessionUID,
	)
	if err != nil {
		return fmt.Errorf("failed to update session metadata: %w", err)
	}
	return nil
}

// SaveLap inserts or updates a lap.
// If mergeMode is true (e.g. SessionHistory packets), it updates timing fields only if the new value is > 0.
// If mergeMode is false (e.g. live LapTracker), it overwrites fields with the latest lap tracker state.
func (r *SQLiteRepository) SaveLap(ctx context.Context, l *Lap, mergeMode bool) error {
	return saveLap(ctx, r.db, l, mergeMode)
}

func saveLap(ctx context.Context, db sqlx.ExtContext, l *Lap, mergeMode bool) error {
	l.FuelLoad = SanitizeFloat(l.FuelLoad)
	l.MaxSpeedKMH = SanitizeFloat(l.MaxSpeedKMH)

	DeriveSector3(l)

	var query string
	if mergeMode {
		query = `
			INSERT INTO laps (session_id, car_index, lap_number, lap_time_ms, sector1_ms, sector2_ms, sector3_ms, is_valid, tyre_compound, fuel_load, max_speed_kmh, penalties_seconds, car_position, result_status, stint, actual_compound, sector1_valid, sector2_valid, sector3_valid)
			VALUES (:session_id, :car_index, :lap_number, :lap_time_ms, :sector1_ms, :sector2_ms, :sector3_ms, :is_valid, :tyre_compound, :fuel_load, :max_speed_kmh, :penalties_seconds, :car_position, :result_status, :stint, :actual_compound, :sector1_valid, :sector2_valid, :sector3_valid)
			ON CONFLICT(session_id, car_index, lap_number) DO UPDATE SET
				lap_time_ms = CASE WHEN excluded.lap_time_ms > 0 THEN excluded.lap_time_ms ELSE laps.lap_time_ms END,
				sector1_ms = CASE WHEN excluded.sector1_ms > 0 THEN excluded.sector1_ms ELSE laps.sector1_ms END,
				sector2_ms = CASE WHEN excluded.sector2_ms > 0 THEN excluded.sector2_ms ELSE laps.sector2_ms END,
				sector3_ms = CASE WHEN excluded.sector3_ms > 0 THEN excluded.sector3_ms ELSE laps.sector3_ms END,
				is_valid = CASE 
					WHEN excluded.is_valid = 1 THEN 1 
					WHEN laps.is_valid = 1 AND laps.lap_time_ms > 0 THEN 1 
					ELSE excluded.is_valid 
				END,
				tyre_compound = CASE WHEN excluded.tyre_compound != '' THEN excluded.tyre_compound ELSE laps.tyre_compound END,
				stint = CASE WHEN excluded.stint > 0 THEN excluded.stint ELSE laps.stint END,
				car_position = CASE WHEN excluded.car_position > 0 THEN excluded.car_position ELSE laps.car_position END,
				result_status = CASE WHEN excluded.result_status > 0 THEN excluded.result_status ELSE laps.result_status END,
				penalties_seconds = CASE WHEN excluded.penalties_seconds > 0 THEN excluded.penalties_seconds ELSE laps.penalties_seconds END,
				actual_compound = CASE WHEN excluded.actual_compound != '' THEN excluded.actual_compound ELSE laps.actual_compound END,
				sector1_valid = CASE 
					WHEN excluded.sector1_valid = 1 THEN 1 
					WHEN laps.sector1_valid = 1 AND laps.sector1_ms > 0 THEN 1 
					ELSE excluded.sector1_valid 
				END,
				sector2_valid = CASE 
					WHEN excluded.sector2_valid = 1 THEN 1 
					WHEN laps.sector2_valid = 1 AND laps.sector2_ms > 0 THEN 1 
					ELSE excluded.sector2_valid 
				END,
				sector3_valid = CASE 
					WHEN excluded.sector3_valid = 1 THEN 1 
					WHEN laps.sector3_valid = 1 AND laps.sector3_ms > 0 THEN 1 
					ELSE excluded.sector3_valid 
				END
			RETURNING id
		`
	} else {
		query = `
			INSERT INTO laps (session_id, car_index, lap_number, lap_time_ms, sector1_ms, sector2_ms, sector3_ms, is_valid, tyre_compound, fuel_load, max_speed_kmh, penalties_seconds, car_position, result_status, stint, actual_compound, sector1_valid, sector2_valid, sector3_valid)
			VALUES (:session_id, :car_index, :lap_number, :lap_time_ms, :sector1_ms, :sector2_ms, :sector3_ms, :is_valid, :tyre_compound, :fuel_load, :max_speed_kmh, :penalties_seconds, :car_position, :result_status, :stint, :actual_compound, :sector1_valid, :sector2_valid, :sector3_valid)
			ON CONFLICT(session_id, car_index, lap_number) DO UPDATE SET
				lap_time_ms = CASE WHEN excluded.lap_time_ms > 0 THEN excluded.lap_time_ms ELSE laps.lap_time_ms END,
				sector1_ms = CASE WHEN excluded.sector1_ms > 0 THEN excluded.sector1_ms ELSE laps.sector1_ms END,
				sector2_ms = CASE WHEN excluded.sector2_ms > 0 THEN excluded.sector2_ms ELSE laps.sector2_ms END,
				sector3_ms = CASE WHEN excluded.sector3_ms > 0 THEN excluded.sector3_ms ELSE laps.sector3_ms END,
				is_valid = excluded.is_valid,
				tyre_compound = CASE WHEN excluded.tyre_compound != '' THEN excluded.tyre_compound ELSE laps.tyre_compound END,
				fuel_load = CASE WHEN excluded.fuel_load > 0 THEN excluded.fuel_load ELSE laps.fuel_load END,
				max_speed_kmh = CASE WHEN excluded.max_speed_kmh > laps.max_speed_kmh THEN excluded.max_speed_kmh ELSE laps.max_speed_kmh END,
				penalties_seconds = CASE WHEN excluded.penalties_seconds > 0 THEN excluded.penalties_seconds ELSE laps.penalties_seconds END,
				car_position = CASE WHEN excluded.car_position > 0 THEN excluded.car_position ELSE laps.car_position END,
				result_status = CASE WHEN excluded.result_status > 0 THEN excluded.result_status ELSE laps.result_status END,
				stint = CASE WHEN excluded.stint > 0 THEN excluded.stint ELSE laps.stint END,
				actual_compound = CASE WHEN excluded.actual_compound != '' THEN excluded.actual_compound ELSE laps.actual_compound END,
				sector1_valid = excluded.sector1_valid,
				sector2_valid = excluded.sector2_valid,
				sector3_valid = excluded.sector3_valid
			RETURNING id
		`
	}

	rows, err := sqlx.NamedQueryContext(ctx, db, query, l)
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

// SaveLapTelemetryBlob compresses and saves the telemetry samples for a given lap ID.
func (r *SQLiteRepository) SaveLapTelemetryBlob(ctx context.Context, lapID int64, samples []TelemetrySample) error {
	return saveLapTelemetryBlob(ctx, r.db, lapID, samples)
}

func saveLapTelemetryBlob(ctx context.Context, db sqlx.ExtContext, lapID int64, samples []TelemetrySample) error {
	if len(samples) == 0 || lapID <= 0 {
		return nil
	}

	compressed, err := compressJSON(samples)
	if err != nil {
		return fmt.Errorf("failed to compress lap telemetry: %w", err)
	}

	query := `
		INSERT INTO lap_telemetry (lap_id, sample_count, data)
		VALUES (?, ?, ?)
		ON CONFLICT(lap_id) DO UPDATE SET
			sample_count = excluded.sample_count,
			data = excluded.data,
			created_at = CURRENT_TIMESTAMP
	`
	_, err = db.ExecContext(ctx, query, lapID, len(samples), compressed)
	if err != nil {
		return fmt.Errorf("failed to save lap telemetry blob: %w", err)
	}
	return nil
}

// DeleteSession deletes a session and all its associated data in cascading fashion.
func (r *SQLiteRepository) DeleteSession(ctx context.Context, sessionID int64) error {
	res, err := r.db.ExecContext(ctx, `DELETE FROM sessions WHERE id = ?`, sessionID)
	if err != nil {
		return fmt.Errorf("failed to delete session: %w", err)
	}

	rowsAffected, err := res.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to check rows affected: %w", err)
	}
	if rowsAffected == 0 {
		return ErrSessionNotFound
	}

	// Fast checkpoint to consolidate WAL log and keep disk files clean (<1ms)
	_, _ = r.db.ExecContext(ctx, `PRAGMA wal_checkpoint(TRUNCATE);`)

	return nil
}

// sessionTagJoinRow is a helper struct for fetching tags joined with session IDs.
type sessionTagJoinRow struct {
	SessionID int64  `db:"session_id"`
	ID        int64  `db:"id"`
	Name      string `db:"name"`
	Color     string `db:"color"`
}

// GetSessions retrieves all valid recorded sessions with their tags, ordered by most recent first.
func (r *SQLiteRepository) GetSessions(ctx context.Context) ([]Session, error) {
	var sessions []Session
	query := `
		SELECT 
			s.id,
			s.session_uid,
			s.track_id,
			s.track_name,
			s.session_type,
			s.weather,
			s.weather_forecast,
			COALESCE(NULLIF(s.total_laps, 0), (SELECT MAX(l.lap_number) FROM laps l WHERE l.session_id = s.id), 0) AS total_laps,
			s.ai_difficulty,
			CASE 
				-- For race sessions: use winner's total race time or sum of leader's completed laps
				WHEN s.session_type LIKE '%Race%' THEN
					CASE
						WHEN EXISTS (SELECT 1 FROM participants p WHERE p.session_id = s.id AND p.total_race_time > 0)
							THEN (SELECT CAST(MAX(p.total_race_time) AS INTEGER) FROM participants p WHERE p.session_id = s.id)
						WHEN EXISTS (SELECT 1 FROM laps l WHERE l.session_id = s.id AND l.lap_time_ms > 0)
							THEN (SELECT CAST(SUM(l.lap_time_ms) / 1000 AS INTEGER) FROM laps l WHERE l.session_id = s.id AND l.lap_time_ms > 0 GROUP BY l.car_index ORDER BY SUM(l.lap_time_ms) DESC LIMIT 1)
						WHEN s.session_duration > 0 AND s.session_duration != 7200
							THEN s.session_duration
						ELSE 0
					END
				-- For non-race sessions (Qualifying, Practice, Shootouts): use scheduled session duration from packet (e.g. 18m, 12m, 60m)
				ELSE
					CASE
						WHEN s.session_duration > 0 AND s.session_duration != 7200
							THEN s.session_duration
						WHEN EXISTS (SELECT 1 FROM laps l WHERE l.session_id = s.id AND l.lap_time_ms > 0)
							THEN (SELECT CAST(SUM(l.lap_time_ms) / 1000 AS INTEGER) FROM laps l WHERE l.session_id = s.id AND l.lap_time_ms > 0 GROUP BY l.car_index ORDER BY SUM(l.lap_time_ms) DESC LIMIT 1)
						ELSE 0
					END
			END AS session_duration,
			s.packet_format,
			s.created_at
		FROM sessions s
		WHERE s.session_uid != '' AND s.session_uid != '0' AND s.session_uid != '0x0000000000000000'
		  AND (s.track_name != 'Unknown' OR EXISTS (SELECT 1 FROM laps l WHERE l.session_id = s.id))
		ORDER BY s.created_at DESC
	`
	if err := r.db.SelectContext(ctx, &sessions, query); err != nil {
		return nil, fmt.Errorf("failed to get sessions: %w", err)
	}

	for i := range sessions {
		sessions[i].Tags = []Tag{}
	}

	if len(sessions) == 0 {
		return sessions, nil
	}

	// Fetch all tags for sessions
	tagJoinQuery := `
		SELECT st.session_id, t.id, t.name, t.color
		FROM session_tags st
		JOIN tags t ON t.id = st.tag_id
		ORDER BY t.name ASC
	`
	var tagRows []sessionTagJoinRow
	if err := r.db.SelectContext(ctx, &tagRows, tagJoinQuery); err != nil {
		return sessions, nil
	}

	tagsBySession := make(map[int64][]Tag)
	for _, row := range tagRows {
		tagsBySession[row.SessionID] = append(tagsBySession[row.SessionID], Tag{
			ID:    row.ID,
			Name:  row.Name,
			Color: row.Color,
		})
	}

	for i := range sessions {
		if tags, exists := tagsBySession[sessions[i].ID]; exists {
			sessions[i].Tags = tags
		}
	}

	return sessions, nil
}

// GetAllTags retrieves all available global tags.
func (r *SQLiteRepository) GetAllTags(ctx context.Context) ([]Tag, error) {
	var tags []Tag
	query := `SELECT id, name, color, created_at FROM tags ORDER BY name ASC`
	if err := r.db.SelectContext(ctx, &tags, query); err != nil {
		return nil, fmt.Errorf("failed to get tags: %w", err)
	}
	if tags == nil {
		tags = []Tag{}
	}
	return tags, nil
}

// CreateTag inserts a new tag or returns existing if conflict.
func (r *SQLiteRepository) CreateTag(ctx context.Context, t *Tag) error {
	return createTag(ctx, r.db, t)
}

func createTag(ctx context.Context, db sqlx.ExtContext, t *Tag) error {
	query := `
		INSERT INTO tags (name, color)
		VALUES (:name, :color)
		ON CONFLICT(name) DO UPDATE SET color = excluded.color
		RETURNING id, created_at
	`
	rows, err := sqlx.NamedQueryContext(ctx, db, query, t)
	if err != nil {
		return fmt.Errorf("failed to create tag: %w", err)
	}
	defer rows.Close()

	if rows.Next() {
		if err := rows.Scan(&t.ID, &t.CreatedAt); err != nil {
			return fmt.Errorf("failed to scan tag id/created_at: %w", err)
		}
	}
	return nil
}

// UpdateTag updates an existing tag's name and color.
func (r *SQLiteRepository) UpdateTag(ctx context.Context, t *Tag) error {
	query := `UPDATE tags SET name = ?, color = ? WHERE id = ?`
	res, err := r.db.ExecContext(ctx, query, t.Name, t.Color, t.ID)
	if err != nil {
		return fmt.Errorf("failed to update tag: %w", err)
	}
	rowsAffected, err := res.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to check rows affected: %w", err)
	}
	if rowsAffected == 0 {
		return ErrTagNotFound
	}
	return nil
}

// DeleteTag deletes a tag by its ID.
func (r *SQLiteRepository) DeleteTag(ctx context.Context, tagID int64) error {
	res, err := r.db.ExecContext(ctx, `DELETE FROM tags WHERE id = ?`, tagID)
	if err != nil {
		return fmt.Errorf("failed to delete tag: %w", err)
	}

	rowsAffected, err := res.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to check rows affected: %w", err)
	}
	if rowsAffected == 0 {
		return ErrTagNotFound
	}

	return nil
}

// GetTagsBySession retrieves all tags associated with a specific session ID.
func (r *SQLiteRepository) GetTagsBySession(ctx context.Context, sessionID int64) ([]Tag, error) {
	var tags []Tag
	query := `
		SELECT t.id, t.name, t.color, t.created_at
		FROM tags t
		JOIN session_tags st ON st.tag_id = t.id
		WHERE st.session_id = ?
		ORDER BY t.name ASC
	`
	if err := r.db.SelectContext(ctx, &tags, query, sessionID); err != nil {
		return nil, fmt.Errorf("failed to get tags for session: %w", err)
	}
	if tags == nil {
		tags = []Tag{}
	}
	return tags, nil
}

// AddTagToSession links a tag to a session.
func (r *SQLiteRepository) AddTagToSession(ctx context.Context, sessionID, tagID int64) error {
	return addTagToSession(ctx, r.db, sessionID, tagID)
}

func addTagToSession(ctx context.Context, db sqlx.ExtContext, sessionID, tagID int64) error {
	query := `INSERT OR IGNORE INTO session_tags (session_id, tag_id) VALUES (?, ?)`
	if _, err := db.ExecContext(ctx, query, sessionID, tagID); err != nil {
		return fmt.Errorf("failed to link tag to session: %w", err)
	}
	return nil
}

// RemoveTagFromSession unlinks a tag from a session.
func (r *SQLiteRepository) RemoveTagFromSession(ctx context.Context, sessionID, tagID int64) error {
	query := `DELETE FROM session_tags WHERE session_id = ? AND tag_id = ?`
	if _, err := r.db.ExecContext(ctx, query, sessionID, tagID); err != nil {
		return fmt.Errorf("failed to unlink tag from session: %w", err)
	}
	return nil
}

// SetSessionTags replaces all tags for a session with the provided tag IDs.
func (r *SQLiteRepository) SetSessionTags(ctx context.Context, sessionID int64, tagIDs []int64) error {
	tx, err := r.db.BeginTxx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer func() { _ = tx.Rollback() }()

	if _, err := tx.ExecContext(ctx, `DELETE FROM session_tags WHERE session_id = ?`, sessionID); err != nil {
		return fmt.Errorf("failed to clear existing session tags: %w", err)
	}

	for _, tagID := range tagIDs {
		if _, err := tx.ExecContext(ctx, `INSERT OR IGNORE INTO session_tags (session_id, tag_id) VALUES (?, ?)`, sessionID, tagID); err != nil {
			return fmt.Errorf("failed to insert session tag: %w", err)
		}
	}

	return tx.Commit()
}

// GetLapsBySession retrieves laps for a given session, optionally filtered by carIndex.
func (r *SQLiteRepository) GetLapsBySession(ctx context.Context, sessionID int64, carIndex *int) ([]Lap, error) {
	var laps []Lap
	var query string
	var args []any

	if carIndex != nil {
		query = `
			SELECT laps.*, 
			       COALESCE(lt.sample_count, 0) AS sample_count,
			       CASE WHEN lt.lap_id IS NOT NULL AND lt.sample_count > 0 THEN 1 ELSE 0 END AS has_telemetry
			FROM laps 
			LEFT JOIN lap_telemetry lt ON lt.lap_id = laps.id
			WHERE laps.session_id = ? AND laps.car_index = ?
			  AND (laps.lap_time_ms > 0 OR laps.result_status >= 3 OR (lt.lap_id IS NOT NULL AND lt.sample_count > 10))
			ORDER BY laps.lap_number ASC
		`
		args = []any{sessionID, *carIndex}
	} else {
		query = `
			SELECT laps.*, 
			       COALESCE(lt.sample_count, 0) AS sample_count,
			       CASE WHEN lt.lap_id IS NOT NULL AND lt.sample_count > 0 THEN 1 ELSE 0 END AS has_telemetry
			FROM laps 
			LEFT JOIN lap_telemetry lt ON lt.lap_id = laps.id
			WHERE laps.session_id = ? 
			  AND (laps.lap_time_ms > 0 OR laps.result_status >= 3 OR (lt.lap_id IS NOT NULL AND lt.sample_count > 10))
			ORDER BY laps.car_index ASC, laps.lap_number ASC
		`
		args = []any{sessionID}
	}

	if err := r.db.SelectContext(ctx, &laps, query, args...); err != nil {
		return nil, fmt.Errorf("failed to get laps: %w", err)
	}

	for i := range laps {
		DeriveSector3(&laps[i])
	}

	return laps, nil
}

// GetTelemetryByLap retrieves time-series telemetry data for a specific lap.
func (r *SQLiteRepository) GetTelemetryByLap(ctx context.Context, lapID int64) ([]TelemetrySample, error) {
	query := `SELECT data FROM lap_telemetry WHERE lap_id = ?`
	var compressed []byte
	err := r.db.GetContext(ctx, &compressed, query, lapID)
	if err != nil {
		if err == sql.ErrNoRows {
			return []TelemetrySample{}, nil
		}
		return nil, fmt.Errorf("failed to get telemetry for lap %d: %w", lapID, err)
	}

	var samples []TelemetrySample
	if err := decompressJSON(compressed, &samples); err != nil {
		return nil, fmt.Errorf("failed to decode telemetry samples for lap %d: %w", lapID, err)
	}
	if samples == nil {
		samples = []TelemetrySample{}
	}
	return samples, nil
}

// DeleteTelemetryByLap deletes all telemetry samples for a given lap ID.
func (r *SQLiteRepository) DeleteTelemetryByLap(ctx context.Context, lapID int64) error {
	query := `DELETE FROM lap_telemetry WHERE lap_id = ?`
	if _, err := r.db.ExecContext(ctx, query, lapID); err != nil {
		return fmt.Errorf("failed to delete telemetry for lap %d: %w", lapID, err)
	}
	return nil
}

// GetLapByID retrieves a single lap by its ID.
func (r *SQLiteRepository) GetLapByID(ctx context.Context, lapID int64) (*Lap, error) {
	var lap Lap
	query := `
		SELECT laps.*, 
		       COALESCE(lt.sample_count, 0) AS sample_count,
		       CASE WHEN lt.lap_id IS NOT NULL AND lt.sample_count > 0 THEN 1 ELSE 0 END AS has_telemetry
		FROM laps 
		LEFT JOIN lap_telemetry lt ON lt.lap_id = laps.id
		WHERE laps.id = ?
	`
	if err := r.db.GetContext(ctx, &lap, query, lapID); err != nil {
		return nil, fmt.Errorf("failed to get lap: %w", err)
	}
	DeriveSector3(&lap)
	return &lap, nil
}

// SaveParticipants upserts participants for a given session.
func (r *SQLiteRepository) SaveParticipants(ctx context.Context, sessionID int64, participants []Participant) error {
	if len(participants) == 0 {
		return nil
	}

	tx, err := r.db.BeginTxx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer func() { _ = tx.Rollback() }()

	if err := saveParticipants(ctx, tx, sessionID, participants); err != nil {
		return err
	}

	return tx.Commit()
}

func saveParticipants(ctx context.Context, db sqlx.ExtContext, sessionID int64, participants []Participant) error {
	if len(participants) == 0 {
		return nil
	}

	query := `
		INSERT INTO participants (session_id, car_index, name, driver_id, team_id, race_number, ai_controlled, nationality, grid_position, position, points, total_race_time, penalties_time, num_penalties, result_reason, num_pit_stops, result_status)
		VALUES (:session_id, :car_index, :name, :driver_id, :team_id, :race_number, :ai_controlled, :nationality, :grid_position, :position, :points, :total_race_time, :penalties_time, :num_penalties, :result_reason, :num_pit_stops, :result_status)
		ON CONFLICT(session_id, car_index) DO UPDATE SET
			name = CASE WHEN excluded.name != '' THEN excluded.name ELSE participants.name END,
			driver_id = CASE WHEN excluded.driver_id > 0 THEN excluded.driver_id ELSE participants.driver_id END,
			team_id = CASE WHEN excluded.team_id > 0 THEN excluded.team_id ELSE participants.team_id END,
			race_number = CASE WHEN excluded.race_number > 0 THEN excluded.race_number ELSE participants.race_number END,
			ai_controlled = CASE WHEN excluded.name != '' THEN excluded.ai_controlled ELSE participants.ai_controlled END,
			nationality = CASE WHEN excluded.nationality > 0 THEN excluded.nationality ELSE participants.nationality END,
			grid_position = CASE WHEN excluded.grid_position > 0 THEN excluded.grid_position ELSE participants.grid_position END,
			position = CASE WHEN excluded.position > 0 THEN excluded.position ELSE participants.position END,
			points = CASE WHEN excluded.points > 0 THEN excluded.points ELSE participants.points END,
			total_race_time = CASE WHEN excluded.total_race_time > 0 THEN excluded.total_race_time ELSE participants.total_race_time END,
			penalties_time = CASE WHEN excluded.penalties_time > 0 THEN excluded.penalties_time ELSE participants.penalties_time END,
			num_penalties = CASE WHEN excluded.num_penalties > 0 THEN excluded.num_penalties ELSE participants.num_penalties END,
			result_reason = CASE WHEN excluded.result_reason > 0 THEN excluded.result_reason ELSE participants.result_reason END,
			num_pit_stops = CASE WHEN excluded.num_pit_stops > 0 THEN excluded.num_pit_stops ELSE participants.num_pit_stops END,
			result_status = CASE WHEN excluded.result_status > 0 THEN excluded.result_status ELSE participants.result_status END
	`

	for i := range participants {
		participants[i].SessionID = sessionID
		if _, err := sqlx.NamedExecContext(ctx, db, query, &participants[i]); err != nil {
			return fmt.Errorf("failed to save participant at index %d: %w", participants[i].CarIndex, err)
		}
	}
	return nil
}

// GetParticipantsBySession retrieves all participants for a given session.
func (r *SQLiteRepository) GetParticipantsBySession(ctx context.Context, sessionID int64) ([]Participant, error) {
	var participants []Participant
	query := `SELECT * FROM participants WHERE session_id = ? ORDER BY car_index ASC`
	if err := r.db.SelectContext(ctx, &participants, query, sessionID); err != nil {
		return nil, fmt.Errorf("failed to get participants: %w", err)
	}
	if participants == nil {
		participants = []Participant{}
	}
	return participants, nil
}

// GetSessionByID retrieves a session by its database ID.
func (r *SQLiteRepository) GetSessionByID(ctx context.Context, sessionID int64) (*Session, error) {
	var session Session
	query := `
		SELECT 
			s.id,
			s.session_uid,
			s.track_id,
			s.track_name,
			s.session_type,
			s.weather,
			s.weather_forecast,
			COALESCE(NULLIF(s.total_laps, 0), (SELECT MAX(l.lap_number) FROM laps l WHERE l.session_id = s.id), 0) AS total_laps,
			s.ai_difficulty,
			CASE 
				-- For race sessions: use winner's total race time or sum of leader's completed laps
				WHEN s.session_type LIKE '%Race%' THEN
					CASE
						WHEN EXISTS (SELECT 1 FROM participants p WHERE p.session_id = s.id AND p.total_race_time > 0)
							THEN (SELECT CAST(MAX(p.total_race_time) AS INTEGER) FROM participants p WHERE p.session_id = s.id)
						WHEN EXISTS (SELECT 1 FROM laps l WHERE l.session_id = s.id AND l.lap_time_ms > 0)
							THEN (SELECT CAST(SUM(l.lap_time_ms) / 1000 AS INTEGER) FROM laps l WHERE l.session_id = s.id AND l.lap_time_ms > 0 GROUP BY l.car_index ORDER BY SUM(l.lap_time_ms) DESC LIMIT 1)
						WHEN s.session_duration > 0 AND s.session_duration != 7200
							THEN s.session_duration
						ELSE 0
					END
				-- For non-race sessions (Qualifying, Practice, Shootouts): use scheduled session duration from packet (e.g. 18m, 12m, 60m)
				ELSE
					CASE
						WHEN s.session_duration > 0 AND s.session_duration != 7200
							THEN s.session_duration
						WHEN EXISTS (SELECT 1 FROM laps l WHERE l.session_id = s.id AND l.lap_time_ms > 0)
							THEN (SELECT CAST(SUM(l.lap_time_ms) / 1000 AS INTEGER) FROM laps l WHERE l.session_id = s.id AND l.lap_time_ms > 0 GROUP BY l.car_index ORDER BY SUM(l.lap_time_ms) DESC LIMIT 1)
						ELSE 0
					END
			END AS session_duration,
			s.packet_format,
			s.created_at
		FROM sessions s
		WHERE s.id = ?
	`
	if err := r.db.GetContext(ctx, &session, query, sessionID); err != nil {
		return nil, fmt.Errorf("failed to get session by id: %w", err)
	}
	tags, err := r.GetTagsBySession(ctx, sessionID)
	if err == nil {
		session.Tags = tags
	}
	return &session, nil
}

// ExportSession generates a fully self-contained package of a session with all its telemetry.
func (r *SQLiteRepository) ExportSession(ctx context.Context, sessionID int64) (*ExportedSessionPackage, error) {
	session, err := r.GetSessionByID(ctx, sessionID)
	if err != nil {
		return nil, err
	}

	tags, err := r.GetTagsBySession(ctx, sessionID)
	if err != nil {
		return nil, fmt.Errorf("failed to export session tags: %w", err)
	}

	participants, err := r.GetParticipantsBySession(ctx, sessionID)
	if err != nil {
		return nil, fmt.Errorf("failed to export participants: %w", err)
	}

	laps, err := r.GetLapsBySession(ctx, sessionID, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to export laps: %w", err)
	}

	lapPackages := make([]ExportedLapPackage, 0, len(laps))
	for _, lap := range laps {
		telemetry, err := r.GetTelemetryByLap(ctx, lap.ID)
		if err != nil {
			telemetry = []TelemetrySample{}
		}
		lapPackages = append(lapPackages, ExportedLapPackage{
			Lap:       lap,
			Telemetry: telemetry,
		})
	}

	return &ExportedSessionPackage{
		Version:      "1.0",
		Session:      *session,
		Tags:         tags,
		Participants: participants,
		Laps:         lapPackages,
	}, nil
}

// GetSessionByUID retrieves a session by its hex session UID. Returns nil, nil if not found.
func (r *SQLiteRepository) GetSessionByUID(ctx context.Context, sessionUID string) (*Session, error) {
	var session Session
	query := `SELECT id, session_uid, track_id, track_name, session_type, weather, weather_forecast, total_laps, ai_difficulty, session_duration, packet_format, created_at FROM sessions WHERE session_uid = ?`
	if err := r.db.GetContext(ctx, &session, query, sessionUID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get session by uid: %w", err)
	}
	tags, err := r.GetTagsBySession(ctx, session.ID)
	if err == nil {
		session.Tags = tags
	}
	return &session, nil
}

// DeleteSessions deletes multiple sessions by their IDs in a single transaction.
func (r *SQLiteRepository) DeleteSessions(ctx context.Context, sessionIDs []int64) (int64, error) {
	if len(sessionIDs) == 0 {
		return 0, nil
	}
	query, args, err := sqlx.In(`DELETE FROM sessions WHERE id IN (?)`, sessionIDs)
	if err != nil {
		return 0, fmt.Errorf("failed to build delete query: %w", err)
	}
	query = r.db.Rebind(query)
	res, err := r.db.ExecContext(ctx, query, args...)
	if err != nil {
		return 0, fmt.Errorf("failed to delete sessions: %w", err)
	}
	rowsAffected, err := res.RowsAffected()
	if err != nil {
		return 0, fmt.Errorf("failed to get rows affected: %w", err)
	}
	_, _ = r.db.ExecContext(ctx, `PRAGMA wal_checkpoint(TRUNCATE);`)
	return rowsAffected, nil
}

// AddTagToSessions links a tag to multiple sessions.
func (r *SQLiteRepository) AddTagToSessions(ctx context.Context, sessionIDs []int64, tagID int64) error {
	if len(sessionIDs) == 0 || tagID <= 0 {
		return nil
	}
	tx, err := r.db.BeginTxx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to start transaction: %w", err)
	}
	defer func() { _ = tx.Rollback() }()

	stmt, err := tx.PrepareContext(ctx, `INSERT OR IGNORE INTO session_tags (session_id, tag_id) VALUES (?, ?)`)
	if err != nil {
		return fmt.Errorf("failed to prepare statement: %w", err)
	}
	defer stmt.Close()

	for _, sID := range sessionIDs {
		if _, err := stmt.ExecContext(ctx, sID, tagID); err != nil {
			return fmt.Errorf("failed to add tag %d to session %d: %w", tagID, sID, err)
		}
	}
	return tx.Commit()
}

// ImportSession imports a session package into SQLite and returns the newly assigned session ID.
// If allowDuplicateUID is false and a session with the same session_uid already exists, it returns ErrSessionAlreadyExists.
func (r *SQLiteRepository) ImportSession(ctx context.Context, pkg *ExportedSessionPackage) (int64, error) {
	return r.ImportSessionWithOptions(ctx, pkg, false)
}

// ImportSessionWithOptions imports a session package with configurable duplicate handling in an atomic transaction.
func (r *SQLiteRepository) ImportSessionWithOptions(ctx context.Context, pkg *ExportedSessionPackage, allowDuplicateUID bool) (int64, error) {
	if pkg == nil {
		return 0, fmt.Errorf("cannot import nil session package")
	}

	sessionUID := pkg.Session.SessionUID
	if sessionUID == "" || sessionUID == "0" || sessionUID == "0x0000000000000000" {
		sessionUID = FormatSessionUID(uint64(time.Now().UnixNano()))
	} else {
		existing, err := r.GetSessionByUID(ctx, sessionUID)
		if err != nil {
			return 0, fmt.Errorf("failed to check existing session: %w", err)
		}
		if existing != nil {
			if !allowDuplicateUID {
				return existing.ID, ErrSessionAlreadyExists
			}
			// Generate a unique session_uid to prevent conflicts with existing local sessions
			sessionUID = FormatSessionUID(uint64(time.Now().UnixNano()))
		}
	}

	tx, err := r.db.BeginTxx(ctx, nil)
	if err != nil {
		return 0, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer func() { _ = tx.Rollback() }()

	newSession := &Session{
		SessionUID:      sessionUID,
		TrackID:         pkg.Session.TrackID,
		TrackName:       pkg.Session.TrackName,
		SessionType:     pkg.Session.SessionType,
		Weather:         pkg.Session.Weather,
		WeatherForecast: pkg.Session.WeatherForecast,
		TotalLaps:       pkg.Session.TotalLaps,
		AIDifficulty:    pkg.Session.AIDifficulty,
		SessionDuration: pkg.Session.SessionDuration,
		PacketFormat:    pkg.Session.PacketFormat,
		CreatedAt:       pkg.Session.CreatedAt,
	}

	if err := saveSession(ctx, tx, newSession); err != nil {
		return 0, fmt.Errorf("failed to save imported session: %w", err)
	}

	// Import and link tags
	for _, tag := range pkg.Tags {
		t := Tag{Name: tag.Name, Color: tag.Color}
		if err := createTag(ctx, tx, &t); err == nil {
			_ = addTagToSession(ctx, tx, newSession.ID, t.ID)
		}
	}

	// Import participants
	if len(pkg.Participants) > 0 {
		if err := saveParticipants(ctx, tx, newSession.ID, pkg.Participants); err != nil {
			return 0, fmt.Errorf("failed to save imported participants: %w", err)
		}
	}

	// Import laps and telemetry
	for _, lapPkg := range pkg.Laps {
		lap := lapPkg.Lap
		lap.SessionID = newSession.ID
		if err := saveLap(ctx, tx, &lap, false); err != nil {
			return 0, fmt.Errorf("failed to save imported lap %d: %w", lap.LapNumber, err)
		}
		if len(lapPkg.Telemetry) > 0 {
			if err := saveLapTelemetryBlob(ctx, tx, lap.ID, lapPkg.Telemetry); err != nil {
				return 0, fmt.Errorf("failed to save imported lap telemetry for lap %d: %w", lap.LapNumber, err)
			}
		}
	}

	if err := tx.Commit(); err != nil {
		return 0, fmt.Errorf("failed to commit imported session: %w", err)
	}

	return newSession.ID, nil
}

// Close closes the database connection.
func (r *SQLiteRepository) Close() error {
	if r.db != nil {
		_, _ = r.db.Exec("PRAGMA wal_checkpoint(TRUNCATE);")
		return r.db.Close()
	}
	return nil
}
