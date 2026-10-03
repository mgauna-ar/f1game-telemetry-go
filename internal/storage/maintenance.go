package storage

import (
	"bytes"
	"context"
	"fmt"
	"log/slog"
	"time"
)

const (
	// lapTelemetryFormatKey is the settings row UpgradeLapTelemetry sets once every lap_telemetry
	// row is in the column format, so later starts skip the walk.
	lapTelemetryFormatKey      = "lap_telemetry_format"
	lapTelemetryFormatColumnar = "columnar_v1"

	// lapTelemetryUpgradeBatch is how many rows UpgradeLapTelemetry reads, and then writes in one
	// short transaction, at a time.
	lapTelemetryUpgradeBatch = 32

	// PRAGMA auto_vacuum values: a file that keeps its free pages until VACUUM, and one that gives
	// them back with PRAGMA incremental_vacuum.
	autoVacuumNone        = 0
	autoVacuumIncremental = 2

	bytesPerMB = 1 << 20
)

// storedLapTelemetry is a lap_telemetry row's blob.
type storedLapTelemetry struct {
	LapID int64  `db:"lap_id"`
	Data  []byte `db:"data"`
}

// lapTelemetryUpgrade is a row's blob converted to the column format, with the blob it replaces.
type lapTelemetryUpgrade struct {
	lapID    int64
	old, new []byte
	samples  int
}

// UpgradeLapTelemetry converts the lap_telemetry rows saved before the column format (zstd JSON)
// to it, at most packets.RecordedTelemetryHz like new laps, and then sets lapTelemetryFormatKey.
// It runs alongside recording: rows are converted outside any transaction and written in short
// ones, and a row saved again meanwhile is left as saved. A row that doesn't decode is logged and
// left as it is. When ctx ends it stops between rows, and the next call starts over, skipping the
// rows already converted.
func (r *SQLiteRepository) UpgradeLapTelemetry(ctx context.Context) error {
	if done, err := r.lapTelemetryUpgraded(ctx); err != nil || done {
		return err
	}

	var walk struct {
		Rows  int   `db:"rows"`
		MaxID int64 `db:"max_id"`
	}
	if err := r.db.GetContext(ctx, &walk, `SELECT COUNT(*) AS rows, COALESCE(MAX(lap_id), 0) AS max_id FROM lap_telemetry`); err != nil {
		return fmt.Errorf("count lap telemetry: %w", err)
	}
	if walk.Rows > 0 {
		slog.Info("Converting saved laps to the compact telemetry format", "laps", walk.Rows)
	}

	start := time.Now()
	var walked, converted, failed int
	var before, after int64
	nextReport := 10
	for lastID := int64(0); ; {
		rows, err := r.readLapTelemetryBatch(ctx, lastID, walk.MaxID)
		if err != nil {
			return err
		}
		if len(rows) == 0 {
			break
		}
		lastID = rows[len(rows)-1].LapID
		walked += len(rows)

		upgrades, notDecoded, err := upgradeLapTelemetryRows(ctx, rows)
		if err != nil {
			return err
		}
		failed += notDecoded
		written, err := r.writeLapTelemetryUpgrades(ctx, upgrades)
		if err != nil {
			return err
		}
		for _, u := range written {
			before += int64(len(u.old))
			after += int64(len(u.new))
		}
		converted += len(written)

		if percent := walked * 100 / walk.Rows; percent >= nextReport && percent < 100 {
			slog.Info("Converting saved laps", "done", fmt.Sprintf("%d%%", percent))
			nextReport = percent/10*10 + 10
		}
	}

	if err := r.SetSetting(ctx, lapTelemetryFormatKey, lapTelemetryFormatColumnar); err != nil {
		return err
	}
	if walk.Rows > 0 {
		slog.Info("Converted saved laps to the compact telemetry format; the file shrinks at the next start",
			"laps", converted, "notDecoded", failed, "beforeMB", before/bytesPerMB, "afterMB", after/bytesPerMB,
			"took", time.Since(start).Round(time.Second))
	}
	return nil
}

func (r *SQLiteRepository) lapTelemetryUpgraded(ctx context.Context) (bool, error) {
	format, err := r.GetSetting(ctx, lapTelemetryFormatKey)
	return format == lapTelemetryFormatColumnar, err
}

// readLapTelemetryBatch reads the next lapTelemetryUpgradeBatch rows after lap afterID, up to lap
// lastID.
func (r *SQLiteRepository) readLapTelemetryBatch(ctx context.Context, afterID, lastID int64) ([]storedLapTelemetry, error) {
	var rows []storedLapTelemetry
	err := r.db.SelectContext(ctx, &rows,
		`SELECT lap_id, data FROM lap_telemetry WHERE lap_id > ? AND lap_id <= ? ORDER BY lap_id LIMIT ?`,
		afterID, lastID, lapTelemetryUpgradeBatch)
	if err != nil {
		return nil, fmt.Errorf("read lap telemetry: %w", err)
	}
	return rows, nil
}

// upgradeLapTelemetryRows converts the rows that are not in the column format yet. notDecoded
// counts the rows left as they are because they don't decode.
func upgradeLapTelemetryRows(ctx context.Context, rows []storedLapTelemetry) (upgrades []lapTelemetryUpgrade, notDecoded int, err error) {
	for _, row := range rows {
		if err := ctx.Err(); err != nil {
			return nil, 0, err
		}
		if bytes.HasPrefix(row.Data, lapTelemetryMagic) {
			continue
		}
		samples, err := decodeStoredLapTelemetry(row.Data)
		if err != nil {
			slog.Warn("Leaving a saved lap's telemetry as it is: it does not decode", "lapID", row.LapID, "error", err)
			notDecoded++
			continue
		}
		samples = ThinSamples(samples)
		upgrades = append(upgrades, lapTelemetryUpgrade{
			lapID: row.LapID, old: row.Data, new: EncodeLapTelemetry(samples), samples: len(samples),
		})
	}
	return upgrades, notDecoded, nil
}

// writeLapTelemetryUpgrades writes upgrades in one transaction. It returns the ones written: a row
// whose blob is no longer the one converted (the lap was saved again) keeps its new blob.
func (r *SQLiteRepository) writeLapTelemetryUpgrades(ctx context.Context, upgrades []lapTelemetryUpgrade) ([]lapTelemetryUpgrade, error) {
	if len(upgrades) == 0 {
		return nil, nil
	}
	tx, err := r.db.BeginTxx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("begin lap telemetry upgrade: %w", err)
	}
	defer func() { _ = tx.Rollback() }()

	var written []lapTelemetryUpgrade
	for _, u := range upgrades {
		res, err := tx.ExecContext(ctx, `UPDATE lap_telemetry SET data = ?, sample_count = ? WHERE lap_id = ? AND data = ?`,
			u.new, u.samples, u.lapID, u.old)
		if err != nil {
			return nil, fmt.Errorf("upgrade lap %d telemetry: %w", u.lapID, err)
		}
		if n, err := res.RowsAffected(); err != nil {
			return nil, fmt.Errorf("upgrade lap %d telemetry: %w", u.lapID, err)
		} else if n > 0 {
			written = append(written, u)
		}
	}
	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("commit lap telemetry upgrade: %w", err)
	}
	return written, nil
}

// ReclaimFreeSpace gives the file's free pages back to the disk. A database in incremental
// auto-vacuum mode frees them with PRAGMA incremental_vacuum. One from before that mode is rebuilt
// with VACUUM, once, after UpgradeLapTelemetry has converted its laps: the rebuild takes seconds
// and the file shrinks to the data it holds, in that mode from then on.
func (r *SQLiteRepository) ReclaimFreeSpace(ctx context.Context) error {
	var mode int
	if err := r.db.GetContext(ctx, &mode, `PRAGMA auto_vacuum`); err != nil {
		return fmt.Errorf("read auto_vacuum: %w", err)
	}
	if mode != autoVacuumNone {
		return r.freePages(ctx)
	}
	if done, err := r.lapTelemetryUpgraded(ctx); err != nil || !done {
		return err
	}

	before, err := r.fileSize(ctx)
	if err != nil {
		return err
	}
	slog.Info("Giving the space the saved laps no longer use back to the disk (once)", "sizeMB", before/bytesPerMB)
	start := time.Now()
	if err := r.vacuumIncremental(ctx); err != nil {
		return err
	}
	_, _ = r.db.ExecContext(ctx, `PRAGMA wal_checkpoint(TRUNCATE);`)
	after, err := r.fileSize(ctx)
	if err != nil {
		return err
	}
	slog.Info("Gave free space back to the disk", "beforeMB", before/bytesPerMB, "afterMB", after/bytesPerMB,
		"took", time.Since(start).Round(time.Millisecond))
	return nil
}

// vacuumIncremental rebuilds the file in incremental auto-vacuum mode. The mode is set on the
// connection that runs VACUUM rather than in the DSN: on a database already in it, setting it takes
// the write lock, which every new connection would then wait for.
func (r *SQLiteRepository) vacuumIncremental(ctx context.Context) error {
	conn, err := r.db.Connx(ctx)
	if err != nil {
		return fmt.Errorf("vacuum: %w", err)
	}
	defer conn.Close()
	if _, err := conn.ExecContext(ctx, `PRAGMA auto_vacuum = INCREMENTAL`); err != nil {
		return fmt.Errorf("set auto_vacuum: %w", err)
	}
	if _, err := conn.ExecContext(ctx, `VACUUM`); err != nil {
		return fmt.Errorf("vacuum: %w", err)
	}
	return nil
}

// freePages gives the free pages of a database in incremental auto-vacuum mode back to the disk. It
// does nothing in the other modes.
func (r *SQLiteRepository) freePages(ctx context.Context) error {
	if _, err := r.db.ExecContext(ctx, `PRAGMA incremental_vacuum`); err != nil {
		return fmt.Errorf("incremental vacuum: %w", err)
	}
	return nil
}

// fileSize is the database's size in bytes, free pages included.
func (r *SQLiteRepository) fileSize(ctx context.Context) (int64, error) {
	var size int64
	if err := r.db.GetContext(ctx, &size,
		`SELECT page_count * page_size FROM pragma_page_count(), pragma_page_size()`); err != nil {
		return 0, fmt.Errorf("read database size: %w", err)
	}
	return size, nil
}
