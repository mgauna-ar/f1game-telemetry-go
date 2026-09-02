package session

import (
	"archive/zip"
	"bytes"
	"context"
	"errors"
	"io"
	"testing"
	"time"

	"github.com/mgauna/f1game-telemetry-go/internal/storage"
)

type mockSessionExporter struct {
	packages map[int64]*storage.ExportedSessionPackage
	errs     map[int64]error
}

func (m *mockSessionExporter) ExportSession(ctx context.Context, sessionID int64) (*storage.ExportedSessionPackage, error) {
	if err, ok := m.errs[sessionID]; ok {
		return nil, err
	}
	if pkg, ok := m.packages[sessionID]; ok {
		return pkg, nil
	}
	return nil, errors.New("session not found")
}

func sampleExportPackage(id int64, track, sessionType string) *storage.ExportedSessionPackage {
	return &storage.ExportedSessionPackage{
		Version: "1.0.0",
		Session: storage.Session{
			ID:          id,
			SessionUID:  storage.FormatSessionUID(uint64(id * 1000)),
			TrackName:   track,
			SessionType: sessionType,
			CreatedAt:   time.Date(2026, 9, 2, 12, 0, 0, 0, time.UTC),
		},
		Participants: []storage.Participant{
			{CarIndex: 0, Name: "Verstappen"},
		},
	}
}

func TestSanitizeFilename(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"Silverstone Circuit", "Silverstone_Circuit"},
		{"Spa-Francorchamps 2026!", "Spa-Francorchamps_2026"},
		{"Red_Bull_Ring", "Red_Bull_Ring"},
		{"!@#$%^&*()", "session"},
		{"", "session"},
		{"  Monza  ", "__Monza__"},
	}

	for _, tt := range tests {
		got := SanitizeFilename(tt.input)
		if got != tt.expected {
			t.Errorf("SanitizeFilename(%q) = %q; want %q", tt.input, got, tt.expected)
		}
	}
}

func TestMarshalAndCompressSessionPackage(t *testing.T) {
	pkg := sampleExportPackage(42, "Silverstone", "Race")

	// 1. With Suffix ID
	compressedWithSuffix, filenameWithSuffix, err := MarshalAndCompressSessionPackage(pkg, 42)
	if err != nil {
		t.Fatalf("unexpected error marshaling with suffix: %v", err)
	}
	if !bytes.HasPrefix(compressedWithSuffix, ZstdMagicHeader) {
		t.Errorf("expected compressed data to start with Zstd magic header")
	}
	expectedFilenameWithSuffix := "Silverstone_Race_2026-09-02_42.f1session"
	if filenameWithSuffix != expectedFilenameWithSuffix {
		t.Errorf("filename with suffix = %q; want %q", filenameWithSuffix, expectedFilenameWithSuffix)
	}

	// Verify decompression integrity
	decompressed, err := ParseSessionPackage(compressedWithSuffix)
	if err != nil {
		t.Fatalf("failed to parse compressed package: %v", err)
	}
	if decompressed.Session.TrackName != "Silverstone" || decompressed.Session.ID != 42 {
		t.Errorf("decompressed session data mismatch: %+v", decompressed.Session)
	}

	// 2. Without Suffix ID (0)
	_, filenameNoSuffix, err := MarshalAndCompressSessionPackage(pkg, 0)
	if err != nil {
		t.Fatalf("unexpected error marshaling without suffix: %v", err)
	}
	expectedFilenameNoSuffix := "Silverstone_Race_2026-09-02.f1session"
	if filenameNoSuffix != expectedFilenameNoSuffix {
		t.Errorf("filename without suffix = %q; want %q", filenameNoSuffix, expectedFilenameNoSuffix)
	}
}

func TestExportSessionBatchToZip(t *testing.T) {
	ctx := context.Background()
	exporter := &mockSessionExporter{
		packages: map[int64]*storage.ExportedSessionPackage{
			1: sampleExportPackage(1, "Monza", "Race"),
			2: sampleExportPackage(2, "Spa", "Qualifying"),
			3: sampleExportPackage(3, "Monaco", "Practice"),
		},
		errs: map[int64]error{
			2: errors.New("db error reading session 2"),
		},
	}

	var buf bytes.Buffer
	count, err := ExportSessionBatchToZip(ctx, exporter, []int64{1, 2, 3}, &buf)
	if err != nil {
		t.Fatalf("unexpected error exporting zip: %v", err)
	}
	if count != 2 {
		t.Errorf("expected 2 successfully exported sessions, got %d", count)
	}

	zr, err := zip.NewReader(bytes.NewReader(buf.Bytes()), int64(buf.Len()))
	if err != nil {
		t.Fatalf("failed to read generated zip: %v", err)
	}
	if len(zr.File) != 2 {
		t.Fatalf("expected 2 zip entries, got %d", len(zr.File))
	}

	for _, f := range zr.File {
		rc, err := f.Open()
		if err != nil {
			t.Fatalf("failed to open zip entry %s: %v", f.Name, err)
		}
		entryBytes, err := io.ReadAll(rc)
		rc.Close()
		if err != nil {
			t.Fatalf("failed to read zip entry %s: %v", f.Name, err)
		}
		parsed, err := ParseSessionPackage(entryBytes)
		if err != nil {
			t.Fatalf("failed to parse session package from zip entry %s: %v", f.Name, err)
		}
		if parsed.Session.TrackName != "Monza" && parsed.Session.TrackName != "Monaco" {
			t.Errorf("unexpected track name %s in zip entry", parsed.Session.TrackName)
		}
	}
}
