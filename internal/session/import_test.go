package session

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"testing"

	"github.com/mgauna/f1game-telemetry-go/internal/storage"
)

type mockSessionImporter struct {
	importedUIDs map[string]int64
	nextID       int64
	failUID      string
	dupUID       string
}

func newMockSessionImporter() *mockSessionImporter {
	return &mockSessionImporter{
		importedUIDs: make(map[string]int64),
		nextID:       100,
	}
}

func (m *mockSessionImporter) ImportSession(ctx context.Context, pkg *storage.ExportedSessionPackage) (int64, error) {
	if pkg.Session.SessionUID == m.dupUID {
		return 0, storage.ErrSessionAlreadyExists
	}
	if pkg.Session.SessionUID == m.failUID {
		return 0, errors.New("database disk full")
	}
	if _, exists := m.importedUIDs[pkg.Session.SessionUID]; exists {
		return 0, storage.ErrSessionAlreadyExists
	}
	m.nextID++
	m.importedUIDs[pkg.Session.SessionUID] = m.nextID
	return m.nextID, nil
}

func TestParseSessionPackage(t *testing.T) {
	// 1. Empty payload
	if _, err := ParseSessionPackage([]byte{}); err == nil {
		t.Errorf("expected error parsing empty payload, got nil")
	}

	// 2. Valid uncompressed JSON
	pkg := sampleExportPackage(10, "Monza", "Race")
	jsonBytes, err := json.Marshal(pkg)
	if err != nil {
		t.Fatalf("failed to marshal sample package: %v", err)
	}

	parsedJSON, err := ParseSessionPackage(jsonBytes)
	if err != nil {
		t.Fatalf("unexpected error parsing json session package: %v", err)
	}
	if parsedJSON.Session.TrackName != "Monza" {
		t.Errorf("expected track name Monza, got %s", parsedJSON.Session.TrackName)
	}

	// 3. Valid compressed Zstandard
	compressed := storage.CompressRaw(jsonBytes)
	parsedZstd, err := ParseSessionPackage(compressed)
	if err != nil {
		t.Fatalf("unexpected error parsing compressed session package: %v", err)
	}
	if parsedZstd.Session.TrackName != "Monza" {
		t.Errorf("expected track name Monza, got %s", parsedZstd.Session.TrackName)
	}

	// 4. Invalid JSON
	if _, err := ParseSessionPackage([]byte("{not valid json")); err == nil {
		t.Errorf("expected error for invalid JSON, got nil")
	}

	// 5. Corrupt Zstd (prefixed with magic header but damaged)
	corruptZstd := append([]byte{}, ZstdMagicHeader...)
	corruptZstd = append(corruptZstd, []byte("garbage corrupt compressed stream")...)
	if _, err := ParseSessionPackage(corruptZstd); err == nil {
		t.Errorf("expected error for corrupt zstd stream, got nil")
	}
}

func TestExpandZipFiles(t *testing.T) {
	// Create a mock zip archive
	var zipBuf bytes.Buffer
	zw := zip.NewWriter(&zipBuf)

	// Add a valid .f1session file
	f1, err := zw.Create("sessions/austria.f1session")
	if err != nil {
		t.Fatalf("failed to create zip entry: %v", err)
	}
	f1Data := []byte("dummy f1session data")
	_, _ = f1.Write(f1Data)

	// Add a valid .json file
	f2, err := zw.Create("silverstone.json")
	if err != nil {
		t.Fatalf("failed to create zip entry: %v", err)
	}
	f2Data := []byte("dummy json data")
	_, _ = f2.Write(f2Data)

	// Add an ignored .txt file
	f3, err := zw.Create("readme.txt")
	if err != nil {
		t.Fatalf("failed to create zip entry: %v", err)
	}
	_, _ = f3.Write([]byte("ignored text"))

	// Add a directory entry (should be ignored)
	_, _ = zw.Create("nested_dir/")
	_ = zw.Close()

	items := []FileItem{
		{Name: "direct_session.f1session", Data: []byte("direct file data")},
		{Name: "archive.zip", Data: zipBuf.Bytes()},
		{Name: "corrupt.zip", Data: []byte{0x50, 0x4B, 0x03, 0x04, 0x00, 0x00}}, // invalid zip
	}

	expanded := ExpandZipFiles(items)

	// Expect 3 total files: the direct session, the archive f1session, and the archive json.
	if len(expanded) != 3 {
		t.Fatalf("expected 3 expanded file items, got %d", len(expanded))
	}

	expectedNames := map[string]bool{
		"direct_session.f1session":   true,
		"sessions/austria.f1session": true,
		"silverstone.json":           true,
	}

	for _, item := range expanded {
		if !expectedNames[item.Name] {
			t.Errorf("unexpected file item in expanded result: %s", item.Name)
		}
	}
}

func TestImportSessionFiles(t *testing.T) {
	ctx := context.Background()
	importer := newMockSessionImporter()
	importer.dupUID = storage.FormatSessionUID(2000)
	importer.failUID = storage.FormatSessionUID(3000)

	// Package 1: Valid new session
	pkg1 := sampleExportPackage(1, "Monza", "Race")
	pkg1.Session.SessionUID = storage.FormatSessionUID(1000)
	data1, _, _ := MarshalAndCompressSessionPackage(pkg1, 1)

	// Package 2: Duplicate session
	pkg2 := sampleExportPackage(2, "Spa", "Qualifying")
	pkg2.Session.SessionUID = importer.dupUID
	data2, _, _ := MarshalAndCompressSessionPackage(pkg2, 2)

	// Package 3: Invalid data (corrupted)
	data3 := []byte("not a valid session package")

	// Package 4: Database failure
	pkg4 := sampleExportPackage(4, "Silverstone", "Race")
	pkg4.Session.SessionUID = importer.failUID
	data4, _, _ := MarshalAndCompressSessionPackage(pkg4, 4)

	files := []FileItem{
		{Name: "session1.f1session", Data: data1},
		{Name: "session2.f1session", Data: data2},
		{Name: "session3.f1session", Data: data3},
		{Name: "session4.f1session", Data: data4},
	}

	resp := ImportSessionFiles(ctx, importer, files)

	if resp.Total != 4 {
		t.Errorf("expected total 4, got %d", resp.Total)
	}
	if resp.Imported != 1 {
		t.Errorf("expected imported 1, got %d", resp.Imported)
	}
	if resp.Skipped != 1 {
		t.Errorf("expected skipped 1, got %d", resp.Skipped)
	}
	if resp.Failed != 2 {
		t.Errorf("expected failed 2, got %d", resp.Failed)
	}
	if len(resp.SessionIDs) != 1 || resp.SessionIDs[0] != 101 {
		t.Errorf("expected session ID 101, got %+v", resp.SessionIDs)
	}
	if resp.SessionID != 101 {
		t.Errorf("expected session_id to match first imported ID, got %d", resp.SessionID)
	}

	// Verify details
	if len(resp.Details) != 4 {
		t.Fatalf("expected 4 detail entries, got %d", len(resp.Details))
	}
	if resp.Details[0].Status != "imported" || resp.Details[0].SessionID != 101 {
		t.Errorf("unexpected detail for item 0: %+v", resp.Details[0])
	}
	if resp.Details[1].Status != "skipped" || resp.Details[1].Reason != "Session already exists" {
		t.Errorf("unexpected detail for item 1: %+v", resp.Details[1])
	}
	if resp.Details[2].Status != "failed" {
		t.Errorf("unexpected detail for item 2: %+v", resp.Details[2])
	}
	if resp.Details[3].Status != "failed" || resp.Details[3].Reason != "database disk full" {
		t.Errorf("unexpected detail for item 3: %+v", resp.Details[3])
	}
}
