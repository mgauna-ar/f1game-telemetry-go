package main

import (
	"context"
	"database/sql"
	"flag"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/mgauna/f1game-telemetry-go/internal/storage"
	_ "modernc.org/sqlite"
)

func main() {
	homeDir, _ := os.UserHomeDir()
	defaultSrc := filepath.Join(homeDir, "Downloads", "f1telemetry.db")

	srcFlag := flag.String("src", defaultSrc, "Path to the legacy/source f1telemetry.db")
	dstFlag := flag.String("dst", "./f1telemetry.db", "Path to the new destination f1telemetry.db")
	flag.Parse()

	srcPath := *srcFlag
	if strings.HasPrefix(srcPath, "~/") {
		srcPath = filepath.Join(homeDir, srcPath[2:])
	}
	dstPath := *dstFlag

	fmt.Println("==========================================================")
	fmt.Println("🏎️  F1 Telemetry Database Migration Tool (Legacy -> Zstd)")
	fmt.Println("==========================================================")
	fmt.Printf("Source DB:      %s\n", srcPath)
	fmt.Printf("Destination DB: %s\n", dstPath)
	fmt.Println("----------------------------------------------------------")

	srcInfo, err := os.Stat(srcPath)
	if err != nil {
		log.Fatalf("❌ Source database file not found: %v", err)
	}
	srcSizeMB := float64(srcInfo.Size()) / (1024 * 1024)
	fmt.Printf("📦 Source DB Size: %.2f MB (%.2f GB)\n\n", srcSizeMB, srcSizeMB/1024)

	// Clean up existing destination db files if present
	_ = os.Remove(dstPath)
	_ = os.Remove(dstPath + "-wal")
	_ = os.Remove(dstPath + "-shm")

	// Open source db in read-only mode
	srcDB, err := sql.Open("sqlite", fmt.Sprintf("file:%s?mode=ro", srcPath))
	if err != nil {
		log.Fatalf("❌ Failed to open source DB: %v", err)
	}
	defer srcDB.Close()

	ctx := context.Background()

	// Initialize destination database repository (creates new schema automatically)
	dstRepo, err := storage.NewRepository(dstPath)
	if err != nil {
		log.Fatalf("❌ Failed to initialize destination repository: %v", err)
	}
	defer dstRepo.Close()

	startTime := time.Now()

	// 1. Migrate Tags
	var tagCount int
	tagRows, err := srcDB.QueryContext(ctx, `SELECT id, name, color, created_at FROM tags`)
	if err == nil {
		defer tagRows.Close()
		for tagRows.Next() {
			var id int64
			var name, color string
			var createdAt time.Time
			if err := tagRows.Scan(&id, &name, &color, &createdAt); err == nil {
				_, _ = dstRepo.DB().ExecContext(ctx,
					`INSERT OR IGNORE INTO tags (id, name, color, created_at) VALUES (?, ?, ?, ?)`,
					id, name, color, createdAt,
				)
				tagCount++
			}
		}
	}
	fmt.Printf("✓ Migrated %d custom tags\n", tagCount)

	// 2. Migrate Sessions
	var sessionCount int
	sessionRows, err := srcDB.QueryContext(ctx,
		`SELECT id, session_uid, track_id, track_name, session_type, weather, packet_format, created_at FROM sessions ORDER BY id ASC`)
	if err != nil {
		log.Fatalf("❌ Failed to query sessions from source: %v", err)
	}
	defer sessionRows.Close()

	for sessionRows.Next() {
		var s storage.Session
		if err := sessionRows.Scan(&s.ID, &s.SessionUID, &s.TrackID, &s.TrackName, &s.SessionType, &s.Weather, &s.PacketFormat, &s.CreatedAt); err != nil {
			log.Printf("⚠️ Warning scanning session: %v", err)
			continue
		}
		_, err := dstRepo.DB().ExecContext(ctx,
			`INSERT OR IGNORE INTO sessions (id, session_uid, track_id, track_name, session_type, weather, packet_format, created_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			s.ID, s.SessionUID, s.TrackID, s.TrackName, s.SessionType, s.Weather, s.PacketFormat, s.CreatedAt,
		)
		if err != nil {
			log.Printf("⚠️ Warning inserting session %d: %v", s.ID, err)
		} else {
			sessionCount++
		}
	}
	fmt.Printf("✓ Migrated %d sessions\n", sessionCount)

	// 3. Migrate Session Tags
	var sessionTagCount int
	stRows, err := srcDB.QueryContext(ctx, `SELECT session_id, tag_id FROM session_tags`)
	if err == nil {
		defer stRows.Close()
		for stRows.Next() {
			var sessionID, tagID int64
			if err := stRows.Scan(&sessionID, &tagID); err == nil {
				_, _ = dstRepo.DB().ExecContext(ctx,
					`INSERT OR IGNORE INTO session_tags (session_id, tag_id) VALUES (?, ?)`,
					sessionID, tagID,
				)
				sessionTagCount++
			}
		}
	}
	fmt.Printf("✓ Migrated %d session tag associations\n", sessionTagCount)

	// 4. Migrate Participants
	var participantCount int
	pRows, err := srcDB.QueryContext(ctx,
		`SELECT id, session_id, car_index, name, driver_id, team_id, race_number, ai_controlled, nationality, created_at 
		 FROM participants ORDER BY id ASC`)
	if err == nil {
		defer pRows.Close()
		for pRows.Next() {
			var p storage.Participant
			if err := pRows.Scan(&p.ID, &p.SessionID, &p.CarIndex, &p.Name, &p.DriverID, &p.TeamID, &p.RaceNumber, &p.AIControlled, &p.Nationality, &p.CreatedAt); err == nil {
				_, _ = dstRepo.DB().ExecContext(ctx,
					`INSERT OR IGNORE INTO participants (id, session_id, car_index, name, driver_id, team_id, race_number, ai_controlled, nationality, created_at)
					 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
					p.ID, p.SessionID, p.CarIndex, p.Name, p.DriverID, p.TeamID, p.RaceNumber, p.AIControlled, p.Nationality, p.CreatedAt,
				)
				participantCount++
			}
		}
	}
	fmt.Printf("✓ Migrated %d participants\n", participantCount)

	// 5. Migrate Laps with dynamic column detection
	lapCols := getTableColumns(ctx, srcDB, "laps")
	hasStint := lapCols["stint"]
	hasSector3 := lapCols["sector3_ms"]
	hasPenalties := lapCols["penalties_seconds"]
	hasCarPos := lapCols["car_position"]
	hasResultStatus := lapCols["result_status"]

	var lapCount int
	var lapIDs []int64

	queryLaps := `SELECT id, session_id, car_index, lap_number, lap_time_ms, sector1_ms, sector2_ms, is_valid, tyre_compound, fuel_load, max_speed_kmh, created_at`
	if hasSector3 {
		queryLaps += `, sector3_ms`
	} else {
		queryLaps += `, 0 as sector3_ms`
	}
	if hasPenalties {
		queryLaps += `, penalties_seconds`
	} else {
		queryLaps += `, 0 as penalties_seconds`
	}
	if hasCarPos {
		queryLaps += `, car_position`
	} else {
		queryLaps += `, 0 as car_position`
	}
	if hasResultStatus {
		queryLaps += `, result_status`
	} else {
		queryLaps += `, 0 as result_status`
	}
	if hasStint {
		queryLaps += `, stint`
	} else {
		queryLaps += `, 0 as stint`
	}
	queryLaps += ` FROM laps ORDER BY id ASC`

	lRows, err := srcDB.QueryContext(ctx, queryLaps)
	if err != nil {
		log.Fatalf("❌ Failed to query laps from source: %v", err)
	}
	defer lRows.Close()

	for lRows.Next() {
		var l storage.Lap
		if err := lRows.Scan(
			&l.ID, &l.SessionID, &l.CarIndex, &l.LapNumber, &l.LapTimeMS, &l.Sector1MS, &l.Sector2MS,
			&l.IsValid, &l.TyreCompound, &l.FuelLoad, &l.MaxSpeedKMH, &l.CreatedAt,
			&l.Sector3MS, &l.PenaltiesSeconds, &l.CarPosition, &l.ResultStatus, &l.Stint,
		); err == nil {
			_, err := dstRepo.DB().ExecContext(ctx,
				`INSERT OR IGNORE INTO laps (id, session_id, car_index, lap_number, lap_time_ms, sector1_ms, sector2_ms, sector3_ms, is_valid, tyre_compound, fuel_load, max_speed_kmh, penalties_seconds, car_position, result_status, stint, created_at)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				l.ID, l.SessionID, l.CarIndex, l.LapNumber, l.LapTimeMS, l.Sector1MS, l.Sector2MS, l.Sector3MS, l.IsValid, l.TyreCompound, l.FuelLoad, l.MaxSpeedKMH, l.PenaltiesSeconds, l.CarPosition, l.ResultStatus, l.Stint, l.CreatedAt,
			)
			if err == nil {
				lapCount++
				lapIDs = append(lapIDs, l.ID)
			}
		} else {
			log.Printf("⚠️ Error scanning lap: %v", err)
		}
	}
	fmt.Printf("✓ Migrated %d laps\n\n", lapCount)

	// 6. Check for legacy telemetry_samples table and compress per lap
	var totalSamplesMigrated int
	var lapsWithTelemetry int

	var hasTelemetrySamples bool
	var checkTable string
	_ = srcDB.QueryRowContext(ctx, `SELECT name FROM sqlite_master WHERE type='table' AND name='telemetry_samples'`).Scan(&checkTable)
	if checkTable == "telemetry_samples" {
		hasTelemetrySamples = true
	}

	if hasTelemetrySamples {
		tsCols := getTableColumns(ctx, srcDB, "telemetry_samples")
		hasERSStore := tsCols["ers_store_energy"]
		hasERSMode := tsCols["ers_deploy_mode"]
		hasWorldX := tsCols["world_pos_x"]
		hasWorldY := tsCols["world_pos_y"]
		hasWorldZ := tsCols["world_pos_z"]

		fmt.Printf("🔄 Compressing and migrating telemetry samples from %d laps into Zstd BLOBs...\n", len(lapIDs))

		sampleQuery := `SELECT id, lap_id, lap_distance, session_time, speed, throttle, brake, steer, gear, engine_rpm, drs, ers_deploy`
		if hasERSStore {
			sampleQuery += `, ers_store_energy`
		} else {
			sampleQuery += `, 0.0 as ers_store_energy`
		}
		if hasERSMode {
			sampleQuery += `, ers_deploy_mode`
		} else {
			sampleQuery += `, 0 as ers_deploy_mode`
		}
		if hasWorldX {
			sampleQuery += `, world_pos_x`
		} else {
			sampleQuery += `, 0.0 as world_pos_x`
		}
		if hasWorldY {
			sampleQuery += `, world_pos_y`
		} else {
			sampleQuery += `, 0.0 as world_pos_y`
		}
		if hasWorldZ {
			sampleQuery += `, world_pos_z`
		} else {
			sampleQuery += `, 0.0 as world_pos_z`
		}
		sampleQuery += ` FROM telemetry_samples WHERE lap_id = ? ORDER BY session_time ASC, lap_distance ASC, id ASC`

		sampleStmt, err := srcDB.PrepareContext(ctx, sampleQuery)
		if err != nil {
			log.Fatalf("❌ Failed to prepare sample query: %v", err)
		}
		defer sampleStmt.Close()

		for idx, lapID := range lapIDs {
			rows, err := sampleStmt.QueryContext(ctx, lapID)
			if err != nil {
				continue
			}

			var samples []storage.TelemetrySample
			for rows.Next() {
				var s storage.TelemetrySample
				if err := rows.Scan(
					&s.ID, &s.LapID, &s.LapDistance, &s.SessionTime, &s.Speed, &s.Throttle, &s.Brake, &s.Steer,
					&s.Gear, &s.EngineRPM, &s.DRS, &s.ERSDeploy, &s.ERSStoreEnergy, &s.ERSDeployMode,
					&s.WorldPosX, &s.WorldPosY, &s.WorldPosZ,
				); err == nil {
					samples = append(samples, s)
				}
			}
			rows.Close()

			if len(samples) > 0 {
				if err := dstRepo.SaveLapTelemetryBlob(ctx, lapID, samples); err != nil {
					log.Printf("⚠️ Error saving compressed telemetry for Lap %d: %v", lapID, err)
				} else {
					totalSamplesMigrated += len(samples)
					lapsWithTelemetry++
				}
			}

			if (idx+1)%25 == 0 || idx+1 == len(lapIDs) {
				fmt.Printf("   [%d/%d laps processed] %d samples compressed...\n", idx+1, len(lapIDs), totalSamplesMigrated)
			}
		}
	}

	// 7. Check if source also has existing lap_telemetry BLOBs
	var checkLapBlobTable string
	_ = srcDB.QueryRowContext(ctx, `SELECT name FROM sqlite_master WHERE type='table' AND name='lap_telemetry'`).Scan(&checkLapBlobTable)
	if checkLapBlobTable == "lap_telemetry" {
		blobRows, err := srcDB.QueryContext(ctx, `SELECT lap_id, sample_count, data, created_at FROM lap_telemetry`)
		if err == nil {
			defer blobRows.Close()
			var directBlobs int
			for blobRows.Next() {
				var lapID int64
				var sampleCount int
				var data []byte
				var createdAt time.Time
				if err := blobRows.Scan(&lapID, &sampleCount, &data, &createdAt); err == nil {
					_, _ = dstRepo.DB().ExecContext(ctx,
						`INSERT OR REPLACE INTO lap_telemetry (lap_id, sample_count, data, created_at) VALUES (?, ?, ?, ?)`,
						lapID, sampleCount, data, createdAt,
					)
					directBlobs++
				}
			}
			if directBlobs > 0 {
				fmt.Printf("✓ Copied %d existing Zstd BLOBs directly\n", directBlobs)
			}
		}
	}

	// Checkpoint WAL and optimize SQLite storage
	_, _ = dstRepo.DB().ExecContext(ctx, `PRAGMA wal_checkpoint(TRUNCATE);`)
	_, _ = dstRepo.DB().ExecContext(ctx, `VACUUM;`)

	dstInfo, err := os.Stat(dstPath)
	var dstSizeMB float64
	if err == nil {
		dstSizeMB = float64(dstInfo.Size()) / (1024 * 1024)
	}

	savingsPercent := 0.0
	if srcSizeMB > 0 {
		savingsPercent = (1.0 - (dstSizeMB / srcSizeMB)) * 100.0
	}

	duration := time.Since(startTime)

	fmt.Println("\n==========================================================")
	fmt.Println("🎉 Migration Complete!")
	fmt.Println("==========================================================")
	fmt.Printf("⏱️  Time Elapsed:           %s\n", duration.Round(time.Millisecond))
	fmt.Printf("🏎️  Total Sessions:         %d\n", sessionCount)
	fmt.Printf("🏁 Total Laps:             %d\n", lapCount)
	fmt.Printf("📊 Telemetry Samples:      %d (across %d laps)\n", totalSamplesMigrated, lapsWithTelemetry)
	fmt.Printf("💾 Original Size:          %.2f MB (%.2f GB)\n", srcSizeMB, srcSizeMB/1024)
	fmt.Printf("⚡ New Compressed Size:    %.2f MB\n", dstSizeMB)
	fmt.Printf("🚀 Storage Reduction:      %.1f%% SAVINGS\n", savingsPercent)
	fmt.Println("==========================================================")
}

func getTableColumns(ctx context.Context, db *sql.DB, tableName string) map[string]bool {
	cols := make(map[string]bool)
	rows, err := db.QueryContext(ctx, fmt.Sprintf("PRAGMA table_info(%s)", tableName))
	if err != nil {
		return cols
	}
	defer rows.Close()

	for rows.Next() {
		var cid int
		var name, ctype string
		var notnull, pk int
		var dfltValue any
		if err := rows.Scan(&cid, &name, &ctype, &notnull, &dfltValue, &pk); err == nil {
			cols[name] = true
		}
	}
	return cols
}
