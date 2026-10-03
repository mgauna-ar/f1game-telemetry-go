package storage

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math/rand/v2"
	"path/filepath"
	"strings"
	"testing"

	"github.com/jmoiron/sqlx"
)

// setupOldTestRepo opens a database created before new databases started in incremental
// auto-vacuum mode.
func setupOldTestRepo(t *testing.T) *SQLiteRepository {
	t.Helper()
	path := filepath.Join(t.TempDir(), "old.db")
	db, err := sqlx.Connect("sqlite", path+"?_pragma=journal_mode(WAL)")
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	if err := Migrate(db); err != nil {
		t.Fatalf("Migrate: %v", err)
	}
	db.Close()

	repo, err := NewSQLiteRepository(path)
	if err != nil {
		t.Fatalf("NewSQLiteRepository: %v", err)
	}
	t.Cleanup(func() { repo.Close() })
	if mode := pragmaInt(t, repo, "auto_vacuum"); mode != autoVacuumNone {
		t.Fatalf("the old database has auto_vacuum %d, want %d", mode, autoVacuumNone)
	}
	return repo
}

func pragmaInt(t *testing.T, repo *SQLiteRepository, name string) int {
	t.Helper()
	var v int
	if err := repo.db.Get(&v, "PRAGMA "+name); err != nil {
		t.Fatalf("PRAGMA %s: %v", name, err)
	}
	return v
}

// saveLaps saves n laps of session, numbered from 1, and returns their IDs.
func saveLaps(t *testing.T, repo *SQLiteRepository, session *Session, n int) []int64 {
	t.Helper()
	ids := make([]int64, n)
	for i := range ids {
		lap := &Lap{SessionID: session.ID, LapNumber: i + 1, LapTimeMS: 90000}
		if err := repo.SaveLap(context.Background(), lap, false); err != nil {
			t.Fatalf("SaveLap(%d): %v", i+1, err)
		}
		ids[i] = lap.ID
	}
	return ids
}

// oldLapBlob is samples as a lap_telemetry blob from before the column format.
func oldLapBlob(t *testing.T, samples []TelemetrySample) []byte {
	t.Helper()
	raw, err := json.Marshal(samples)
	if err != nil {
		t.Fatalf("marshal samples: %v", err)
	}
	return CompressRaw(raw)
}

// insertLapBlob stores blob as lap lapID's telemetry, as it is.
func insertLapBlob(t *testing.T, repo *SQLiteRepository, lapID int64, samples int, blob []byte) {
	t.Helper()
	if _, err := repo.db.Exec(`INSERT INTO lap_telemetry (lap_id, sample_count, data) VALUES (?, ?, ?)`,
		lapID, samples, blob); err != nil {
		t.Fatalf("insert lap %d telemetry: %v", lapID, err)
	}
}

func storedLapBlob(t *testing.T, repo *SQLiteRepository, lapID int64) (blob []byte, samples int) {
	t.Helper()
	var row struct {
		Data    []byte `db:"data"`
		Samples int    `db:"sample_count"`
	}
	if err := repo.db.Get(&row, `SELECT data, sample_count FROM lap_telemetry WHERE lap_id = ?`, lapID); err != nil {
		t.Fatalf("read lap %d telemetry: %v", lapID, err)
	}
	return row.Data, row.Samples
}

func TestUpgradeLapTelemetry(t *testing.T) {
	repo := setupTestRepo(t)
	ctx := context.Background()
	session := createTestSession(t, repo)

	// More laps than a batch: a 60 Hz lap, a 20 Hz one with jitter, one already in the column
	// format, one that doesn't decode, and short old 20 Hz laps
	ids := saveLaps(t, repo, session, lapTelemetryUpgradeBatch+8)
	sixty := feedLap(60, 30, testSessionStart, 0, 0)
	twenty := feedLap(20, 30, testSessionStart, 0.012, 0)
	current := feedLap(20, 5, testSessionStart, 0, 0)
	damaged := []byte("not a lap telemetry blob")
	short := feedLap(20, 2, testSessionStart, 0, 0)
	insertLapBlob(t, repo, ids[0], len(sixty), oldLapBlob(t, sixty))
	insertLapBlob(t, repo, ids[1], len(twenty), oldLapBlob(t, twenty))
	if err := repo.SaveLapTelemetryBlob(ctx, ids[2], current); err != nil {
		t.Fatalf("SaveLapTelemetryBlob: %v", err)
	}
	currentBlob, _ := storedLapBlob(t, repo, ids[2])
	insertLapBlob(t, repo, ids[3], 1, damaged)
	for _, id := range ids[4:] {
		insertLapBlob(t, repo, id, len(short), oldLapBlob(t, short))
	}

	cancelled, cancel := context.WithCancel(ctx)
	cancel()
	if err := repo.UpgradeLapTelemetry(cancelled); !errors.Is(err, context.Canceled) {
		t.Fatalf("UpgradeLapTelemetry(cancelled context) = %v, want context.Canceled", err)
	}
	if blob, _ := storedLapBlob(t, repo, ids[0]); bytes.HasPrefix(blob, lapTelemetryMagic) {
		t.Fatal("a cancelled upgrade converted a lap")
	}

	// A first batch converted before a restart: the next run leaves those rows as they are
	rows, err := repo.readLapTelemetryBatch(ctx, 0, ids[len(ids)-1])
	if err != nil {
		t.Fatalf("readLapTelemetryBatch: %v", err)
	}
	upgrades, notDecoded, err := upgradeLapTelemetryRows(ctx, rows)
	if err != nil || notDecoded != 1 {
		t.Fatalf("upgradeLapTelemetryRows = %d not decoded, %v; want 1, nil", notDecoded, err)
	}
	if _, err := repo.writeLapTelemetryUpgrades(ctx, upgrades); err != nil {
		t.Fatalf("writeLapTelemetryUpgrades: %v", err)
	}
	firstBatch := map[int64][]byte{}
	for _, row := range rows {
		firstBatch[row.LapID], _ = storedLapBlob(t, repo, row.LapID)
	}

	if done, _ := repo.lapTelemetryUpgraded(ctx); done {
		t.Fatal("the format key is set before the upgrade ran")
	}
	if err := repo.UpgradeLapTelemetry(ctx); err != nil {
		t.Fatalf("UpgradeLapTelemetry: %v", err)
	}
	if done, err := repo.lapTelemetryUpgraded(ctx); err != nil || !done {
		t.Fatalf("lapTelemetryUpgraded = %v, %v after the upgrade, want true", done, err)
	}

	for _, id := range ids {
		blob, count := storedLapBlob(t, repo, id)
		if want, ok := firstBatch[id]; ok && !bytes.Equal(blob, want) {
			t.Errorf("lap %d: converted again after the restart", id)
		}
		switch id {
		case ids[2]:
			if !bytes.Equal(blob, currentBlob) {
				t.Error("a lap already in the column format changed")
			}
			continue
		case ids[3]:
			if !bytes.Equal(blob, damaged) {
				t.Error("a lap that doesn't decode changed")
			}
			continue
		}
		got, err := DecodeLapTelemetry(blob)
		if err != nil {
			t.Fatalf("lap %d is not in the column format: %v", id, err)
		}
		if count != len(got) {
			t.Errorf("lap %d sample_count = %d, want its %d samples", id, count, len(got))
		}
		want := short
		switch id {
		case ids[0]:
			want = sixty
			if len(got) > len(sixty)/3+1 {
				t.Errorf("the 60 Hz lap kept %d of %d samples, want 20 Hz", len(got), len(sixty))
			}
		case ids[1]:
			want = twenty
		}
		assertSamplesWithinStep(t, got, ThinSamples(want))
	}

	// Once the key is set, a later start does nothing
	late := saveLaps(t, repo, createSessionWithUID(t, repo, 2), 1)[0]
	oldBlob := oldLapBlob(t, short)
	insertLapBlob(t, repo, late, len(short), oldBlob)
	if err := repo.UpgradeLapTelemetry(ctx); err != nil {
		t.Fatalf("UpgradeLapTelemetry again: %v", err)
	}
	if blob, _ := storedLapBlob(t, repo, late); !bytes.Equal(blob, oldBlob) {
		t.Error("the upgrade walked the laps again after it was done")
	}
}

// createSessionWithUID saves another session than createTestSession's.
func createSessionWithUID(t *testing.T, repo *SQLiteRepository, uid uint64) *Session {
	t.Helper()
	s := &Session{SessionUID: FormatSessionUID(uid), TrackID: 11, TrackName: "Monza", SessionType: "Race", PacketFormat: 2025}
	if err := repo.SaveSession(context.Background(), s); err != nil {
		t.Fatalf("SaveSession: %v", err)
	}
	return s
}

func TestUpgradeLapTelemetryKeepsLapsSavedMeanwhile(t *testing.T) {
	repo := setupTestRepo(t)
	ctx := context.Background()
	ids := saveLaps(t, repo, createTestSession(t, repo), 2)
	old := feedLap(20, 10, testSessionStart, 0, 0)
	for _, id := range ids {
		insertLapBlob(t, repo, id, len(old), oldLapBlob(t, old))
	}

	rows, err := repo.readLapTelemetryBatch(ctx, 0, ids[1])
	if err != nil {
		t.Fatalf("readLapTelemetryBatch: %v", err)
	}
	upgrades, _, err := upgradeLapTelemetryRows(ctx, rows)
	if err != nil {
		t.Fatalf("upgradeLapTelemetryRows: %v", err)
	}
	// The app records lap 2 again between the read and the write
	resaved := feedLap(20, 4, testSessionStart+100, 0, 0)
	if err := repo.SaveLapTelemetryBlob(ctx, ids[1], resaved); err != nil {
		t.Fatalf("SaveLapTelemetryBlob: %v", err)
	}

	written, err := repo.writeLapTelemetryUpgrades(ctx, upgrades)
	if err != nil {
		t.Fatalf("writeLapTelemetryUpgrades: %v", err)
	}
	if len(written) != 1 || written[0].lapID != ids[0] {
		t.Errorf("wrote %d upgrades, want only lap 1's", len(written))
	}
	got, err := repo.GetTelemetryByLap(ctx, ids[1])
	if err != nil {
		t.Fatalf("GetTelemetryByLap: %v", err)
	}
	assertSamplesWithinStep(t, got, resaved)
}

func TestReclaimFreeSpace(t *testing.T) {
	repo := setupOldTestRepo(t)
	ctx := context.Background()
	session := createTestSession(t, repo)
	ids := saveLaps(t, repo, session, 20)
	for _, id := range ids {
		samples := feedLap(60, testLapSeconds, testSessionStart, 0.004, 0)
		insertLapBlob(t, repo, id, len(samples), oldLapBlob(t, samples))
	}

	// Before the upgrade: nothing to give back yet
	pages := pragmaInt(t, repo, "page_count")
	if err := repo.ReclaimFreeSpace(ctx); err != nil {
		t.Fatalf("ReclaimFreeSpace before the upgrade: %v", err)
	}
	if mode, after := pragmaInt(t, repo, "auto_vacuum"), pragmaInt(t, repo, "page_count"); mode != autoVacuumNone || after != pages {
		t.Fatalf("before the upgrade: auto_vacuum %d and %d pages, want %d and %d", mode, after, autoVacuumNone, pages)
	}

	if err := repo.UpgradeLapTelemetry(ctx); err != nil {
		t.Fatalf("UpgradeLapTelemetry: %v", err)
	}
	if free := pragmaInt(t, repo, "freelist_count"); free < pages/2 {
		t.Fatalf("%d of %d pages free after the upgrade, want most of them", free, pages)
	}

	if err := repo.ReclaimFreeSpace(ctx); err != nil {
		t.Fatalf("ReclaimFreeSpace: %v", err)
	}
	if mode := pragmaInt(t, repo, "auto_vacuum"); mode != autoVacuumIncremental {
		t.Errorf("auto_vacuum = %d after ReclaimFreeSpace, want %d (incremental)", mode, autoVacuumIncremental)
	}
	if free, after := pragmaInt(t, repo, "freelist_count"), pragmaInt(t, repo, "page_count"); free != 0 || after > pages/4 {
		t.Errorf("%d pages, %d free after ReclaimFreeSpace, want none free and at most %d", after, free, pages/4)
	}
	if _, err := repo.GetTelemetryByLap(ctx, ids[0]); err != nil {
		t.Errorf("GetTelemetryByLap after VACUUM: %v", err)
	}

	// From then on, deleting a session shrinks the file
	pages = pragmaInt(t, repo, "page_count")
	if err := repo.DeleteSession(ctx, session.ID); err != nil {
		t.Fatalf("DeleteSession: %v", err)
	}
	if free, after := pragmaInt(t, repo, "freelist_count"), pragmaInt(t, repo, "page_count"); free != 0 || after >= pages {
		t.Errorf("%d pages, %d free after deleting the session, want none free and fewer than %d", after, free, pages)
	}
	if err := repo.ReclaimFreeSpace(ctx); err != nil {
		t.Errorf("ReclaimFreeSpace on an incremental database: %v", err)
	}
}

func TestDeletingSessionsFreesTheirPages(t *testing.T) {
	tests := []struct {
		name   string
		delete func(repo *SQLiteRepository, id int64) error
	}{
		{name: "DeleteSession", delete: func(repo *SQLiteRepository, id int64) error {
			return repo.DeleteSession(context.Background(), id)
		}},
		{name: "DeleteSessions", delete: func(repo *SQLiteRepository, id int64) error {
			_, err := repo.DeleteSessions(context.Background(), []int64{id})
			return err
		}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := setupTestRepo(t)
			if mode := pragmaInt(t, repo, "auto_vacuum"); mode != autoVacuumIncremental {
				t.Fatalf("a new database has auto_vacuum %d, want %d (incremental)", mode, autoVacuumIncremental)
			}
			rng := rand.New(rand.NewPCG(3, 4))
			kept := createSessionWithUID(t, repo, 1)
			deleted := createSessionWithUID(t, repo, 2)
			for _, s := range []*Session{kept, deleted} {
				for i, id := range saveLaps(t, repo, s, 10) {
					// Random positions, so the blobs take some pages
					samples := feedLap(20, testLapSeconds, testSessionStart+float64(i), 0.012, 0)
					for j := range samples {
						samples[j].WorldPosX = rng.Float64() * 1000
						samples[j].WorldPosZ = rng.Float64() * 1000
					}
					if err := repo.SaveLapTelemetryBlob(context.Background(), id, samples); err != nil {
						t.Fatalf("SaveLapTelemetryBlob: %v", err)
					}
				}
			}

			pages := pragmaInt(t, repo, "page_count")
			if err := tt.delete(repo, deleted.ID); err != nil {
				t.Fatalf("delete: %v", err)
			}
			free, after := pragmaInt(t, repo, "freelist_count"), pragmaInt(t, repo, "page_count")
			if free != 0 || after > pages*3/4 {
				t.Errorf("%d of %d pages left, %d free, want about half and none free", after, pages, free)
			}
		})
	}
}

func TestLapIndexes(t *testing.T) {
	repo := setupTestRepo(t)

	var indexes []string
	if err := repo.db.Select(&indexes, `SELECT name FROM pragma_index_list('laps') ORDER BY name`); err != nil {
		t.Fatalf("index list: %v", err)
	}
	if want := []string{"idx_laps_car_laptime", "sqlite_autoindex_laps_1"}; fmt.Sprint(indexes) != fmt.Sprint(want) {
		t.Errorf("laps indexes %v, want %v", indexes, want)
	}

	queries := map[string]string{
		"one lap":          `SELECT id FROM laps WHERE session_id = 1 AND car_index = 0 AND lap_number = 3`,
		"a car's laps":     `SELECT ` + lapSelectColumns + ` ` + lapFromJoin + ` WHERE laps.session_id = 1 AND ` + lapValidFilter + ` AND laps.car_index = 0 ORDER BY laps.lap_number ASC`,
		"a session's laps": `SELECT ` + lapSelectColumns + ` ` + lapFromJoin + ` WHERE laps.session_id = 1 AND ` + lapValidFilter + ` ORDER BY laps.car_index ASC, laps.lap_number ASC`,
	}
	for name, query := range queries {
		var plan []struct {
			ID      int    `db:"id"`
			Parent  int    `db:"parent"`
			NotUsed int    `db:"notused"`
			Detail  string `db:"detail"`
		}
		if err := repo.db.Select(&plan, `EXPLAIN QUERY PLAN `+query); err != nil {
			t.Fatalf("%s: EXPLAIN QUERY PLAN: %v", name, err)
		}
		steps := make([]string, 0, len(plan))
		for _, step := range plan {
			steps = append(steps, step.Detail)
		}
		joined := strings.Join(steps, "; ")
		if !strings.Contains(joined, "SEARCH laps USING") || !strings.Contains(joined, "INDEX sqlite_autoindex_laps_1 (session_id=?") || strings.Contains(joined, "TEMP B-TREE") {
			t.Errorf("%s: plan %q, want a search of the unique index without sorting", name, joined)
		}
	}
}
