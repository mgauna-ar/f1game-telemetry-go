package storage

import "context"

// Repository defines the contract for session telemetry persistence.
// Implementations must be safe for concurrent use.
type Repository interface {
	// Close releases database resources.
	Close() error

	// Sessions
	SaveSession(ctx context.Context, s *Session) error
	UpdateSessionMetadata(ctx context.Context, sessionUID string, trackID int, trackName, sessionType, weather, weatherForecast string, totalLaps, aiDifficulty, sessionDuration int) error
	GetSessions(ctx context.Context) ([]Session, error)
	GetSessionByID(ctx context.Context, sessionID int64) (*Session, error)
	GetSessionByUID(ctx context.Context, sessionUID string) (*Session, error)
	DeleteSession(ctx context.Context, sessionID int64) error
	DeleteSessions(ctx context.Context, sessionIDs []int64) (int64, error)
	ExportSession(ctx context.Context, sessionID int64) (*ExportedSessionPackage, error)
	ImportSession(ctx context.Context, pkg *ExportedSessionPackage) (int64, error)
	ImportSessionWithOptions(ctx context.Context, pkg *ExportedSessionPackage, allowDuplicateUID bool) (int64, error)

	// Laps & Telemetry
	SaveLap(ctx context.Context, l *Lap, mergeMode bool) error
	GetLapsBySession(ctx context.Context, sessionID int64, carIndex *int) ([]Lap, error)
	GetLapByID(ctx context.Context, lapID int64) (*Lap, error)
	SaveLapTelemetryBlob(ctx context.Context, lapID int64, samples []TelemetrySample) error
	GetTelemetryByLap(ctx context.Context, lapID int64) ([]TelemetrySample, error)
	DeleteTelemetryByLap(ctx context.Context, lapID int64) error

	// Participants
	SaveParticipants(ctx context.Context, sessionID int64, participants []Participant) error
	GetParticipantsBySession(ctx context.Context, sessionID int64) ([]Participant, error)

	// Tags & League Organization
	GetAllTags(ctx context.Context) ([]Tag, error)
	CreateTag(ctx context.Context, t *Tag) error
	UpdateTag(ctx context.Context, t *Tag) error
	DeleteTag(ctx context.Context, tagID int64) error
	GetTagsBySession(ctx context.Context, sessionID int64) ([]Tag, error)
	AddTagToSession(ctx context.Context, sessionID, tagID int64) error
	RemoveTagFromSession(ctx context.Context, sessionID, tagID int64) error
	SetSessionTags(ctx context.Context, sessionID int64, tagIDs []int64) error
	AddTagToSessions(ctx context.Context, sessionIDs []int64, tagID int64) error
}
