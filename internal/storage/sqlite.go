package storage

import (
	"context"
	"database/sql"
	"encoding/json"
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

// Repository handles database operations using SQLite.
type Repository struct {
	db *sqlx.DB
}

// NewRepository creates a new SQLite repository and applies migrations.
func NewRepository(dbPath string) (*Repository, error) {
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

	repo := &Repository{db: db}
	if err := Migrate(db); err != nil {
		db.Close()
		return nil, fmt.Errorf("failed to run migrations: %w", err)
	}

	return repo, nil
}

// DB returns the underlying sqlx.DB instance.
func (r *Repository) DB() *sqlx.DB {
	return r.db
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
	l.FuelLoad = SanitizeFloat(l.FuelLoad)
	l.MaxSpeedKMH = SanitizeFloat(l.MaxSpeedKMH)

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
	l.FuelLoad = SanitizeFloat(l.FuelLoad)
	l.MaxSpeedKMH = SanitizeFloat(l.MaxSpeedKMH)

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

// SaveLapTelemetryBlob compresses and saves the telemetry samples for a given lap ID.
func (r *Repository) SaveLapTelemetryBlob(ctx context.Context, lapID int64, samples []TelemetrySample) error {
	if len(samples) == 0 || lapID <= 0 {
		return nil
	}

	for i := range samples {
		samples[i].LapDistance = SanitizeFloat(samples[i].LapDistance)
		samples[i].SessionTime = SanitizeFloat(samples[i].SessionTime)
		samples[i].Throttle = SanitizeFloat(samples[i].Throttle)
		samples[i].Brake = SanitizeFloat(samples[i].Brake)
		samples[i].Steer = SanitizeFloat(samples[i].Steer)
		samples[i].ERSDeploy = SanitizeFloat(samples[i].ERSDeploy)
		samples[i].ERSStoreEnergy = SanitizeFloat(samples[i].ERSStoreEnergy)
		samples[i].WorldPosX = SanitizeFloat(samples[i].WorldPosX)
		samples[i].WorldPosY = SanitizeFloat(samples[i].WorldPosY)
		samples[i].WorldPosZ = SanitizeFloat(samples[i].WorldPosZ)
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
	_, err = r.db.ExecContext(ctx, query, lapID, len(samples), compressed)
	if err != nil {
		return fmt.Errorf("failed to save lap telemetry blob: %w", err)
	}
	return nil
}

// DeleteSession deletes a session and all its associated data in cascading fashion.
func (r *Repository) DeleteSession(ctx context.Context, sessionID int64) error {
	res, err := r.db.ExecContext(ctx, `DELETE FROM sessions WHERE id = ?`, sessionID)
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
func (r *Repository) GetAllTags(ctx context.Context) ([]Tag, error) {
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
func (r *Repository) CreateTag(ctx context.Context, t *Tag) error {
	query := `
		INSERT INTO tags (name, color)
		VALUES (:name, :color)
		ON CONFLICT(name) DO UPDATE SET color = excluded.color
		RETURNING id, created_at
	`
	rows, err := r.db.NamedQueryContext(ctx, query, t)
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
func (r *Repository) UpdateTag(ctx context.Context, t *Tag) error {
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
		return fmt.Errorf("tag not found")
	}
	return nil
}

// DeleteTag deletes a tag by its ID.
func (r *Repository) DeleteTag(ctx context.Context, tagID int64) error {
	res, err := r.db.ExecContext(ctx, `DELETE FROM tags WHERE id = ?`, tagID)
	if err != nil {
		return fmt.Errorf("failed to delete tag: %w", err)
	}

	rowsAffected, err := res.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to check rows affected: %w", err)
	}
	if rowsAffected == 0 {
		return fmt.Errorf("tag not found")
	}

	return nil
}

// GetTagsBySession retrieves all tags associated with a specific session ID.
func (r *Repository) GetTagsBySession(ctx context.Context, sessionID int64) ([]Tag, error) {
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
func (r *Repository) AddTagToSession(ctx context.Context, sessionID int64, tagID int64) error {
	query := `INSERT OR IGNORE INTO session_tags (session_id, tag_id) VALUES (?, ?)`
	if _, err := r.db.ExecContext(ctx, query, sessionID, tagID); err != nil {
		return fmt.Errorf("failed to link tag to session: %w", err)
	}
	return nil
}

// RemoveTagFromSession unlinks a tag from a session.
func (r *Repository) RemoveTagFromSession(ctx context.Context, sessionID int64, tagID int64) error {
	query := `DELETE FROM session_tags WHERE session_id = ? AND tag_id = ?`
	if _, err := r.db.ExecContext(ctx, query, sessionID, tagID); err != nil {
		return fmt.Errorf("failed to unlink tag from session: %w", err)
	}
	return nil
}

// SetSessionTags replaces all tags for a session with the provided tag IDs.
func (r *Repository) SetSessionTags(ctx context.Context, sessionID int64, tagIDs []int64) error {
	tx, err := r.db.Beginx()
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

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

// GetLapsBySession retrieves all laps for a given session.
func (r *Repository) GetLapsBySession(ctx context.Context, sessionID int64) ([]Lap, error) {
	var laps []Lap
	query := `
		SELECT * FROM laps 
		WHERE session_id = ? 
		  AND (lap_time_ms > 0 OR EXISTS (SELECT 1 FROM lap_telemetry WHERE lap_id = laps.id))
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
func (r *Repository) DeleteTelemetryByLap(ctx context.Context, lapID int64) error {
	query := `DELETE FROM lap_telemetry WHERE lap_id = ?`
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

// GetSessionByID retrieves a session by its database ID.
func (r *Repository) GetSessionByID(ctx context.Context, sessionID int64) (*Session, error) {
	var session Session
	query := `SELECT * FROM sessions WHERE id = ?`
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
func (r *Repository) ExportSession(ctx context.Context, sessionID int64) (*ExportedSessionPackage, error) {
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

	laps, err := r.GetLapsBySession(ctx, sessionID)
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

// ImportSession imports a session package into SQLite and returns the newly assigned session ID.
func (r *Repository) ImportSession(ctx context.Context, pkg *ExportedSessionPackage) (int64, error) {
	if pkg == nil {
		return 0, fmt.Errorf("cannot import nil session package")
	}

	// Generate a unique session_uid to prevent conflicts with existing local sessions
	sessionUID := pkg.Session.SessionUID
	if sessionUID == 0 {
		sessionUID = time.Now().UnixNano()
	}

	newSession := &Session{
		SessionUID:   sessionUID,
		TrackID:      pkg.Session.TrackID,
		TrackName:    pkg.Session.TrackName,
		SessionType:  pkg.Session.SessionType,
		Weather:      pkg.Session.Weather,
		PacketFormat: pkg.Session.PacketFormat,
		CreatedAt:    pkg.Session.CreatedAt,
	}

	if err := r.SaveSession(ctx, newSession); err != nil {
		return 0, fmt.Errorf("failed to save imported session: %w", err)
	}

	// Import and link tags
	for _, tag := range pkg.Tags {
		t := Tag{Name: tag.Name, Color: tag.Color}
		if err := r.CreateTag(ctx, &t); err == nil {
			_ = r.AddTagToSession(ctx, newSession.ID, t.ID)
		}
	}

	// Import participants
	if len(pkg.Participants) > 0 {
		if err := r.SaveParticipants(ctx, newSession.ID, pkg.Participants); err != nil {
			return 0, fmt.Errorf("failed to save imported participants: %w", err)
		}
	}

	// Import laps and telemetry
	for _, lapPkg := range pkg.Laps {
		lap := lapPkg.Lap
		lap.SessionID = newSession.ID
		if err := r.SaveLap(ctx, &lap); err != nil {
			return 0, fmt.Errorf("failed to save imported lap %d: %w", lap.LapNumber, err)
		}
		if len(lapPkg.Telemetry) > 0 {
			if err := r.SaveLapTelemetryBlob(ctx, lap.ID, lapPkg.Telemetry); err != nil {
				return 0, fmt.Errorf("failed to save imported lap telemetry for lap %d: %w", lap.LapNumber, err)
			}
		}
	}

	return newSession.ID, nil
}

// Close closes the database connection.
func (r *Repository) Close() error {
	return r.db.Close()
}
