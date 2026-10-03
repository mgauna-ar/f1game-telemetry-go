package storage

import (
	"bytes"
	"encoding/binary"
	"encoding/json"
	"errors"
	"math"
	"reflect"
	"strings"
	"testing"
)

// steps is each float field's fixed-point step, in the codec's units.
var steps = map[string]float64{
	"LapDistance":    1.0 / centimeters,
	"SessionTime":    1.0 / milliseconds,
	"Throttle":       1.0 / inputSteps,
	"Brake":          1.0 / inputSteps,
	"Steer":          1.0 / inputSteps,
	"ERSDeploy":      1.0 / joules,
	"ERSStoreEnergy": 1.0 / percentSteps,
	"WorldPosX":      1.0 / centimeters,
	"WorldPosY":      1.0 / centimeters,
	"WorldPosZ":      1.0 / centimeters,
}

// assertSamplesWithinStep fails unless got has want's samples, with each float field within half
// its step and every other field equal. NaN and Inf must come back as 0.
func assertSamplesWithinStep(t *testing.T, got, want []TelemetrySample) {
	t.Helper()
	if len(got) != len(want) {
		t.Fatalf("decoded %d samples, want %d", len(got), len(want))
	}
	for i := range want {
		g, w := reflect.ValueOf(got[i]), reflect.ValueOf(want[i])
		for f := range w.NumField() {
			name := w.Type().Field(f).Name
			if step, ok := steps[name]; ok {
				gv, wv := g.Field(f).Float(), SanitizeFloat(w.Field(f).Float())
				if math.Abs(gv-wv) > step/2+1e-9 {
					t.Errorf("sample %d %s = %v, want %v ± %v", i, name, gv, wv, step/2)
				}
			} else if !g.Field(f).Equal(w.Field(f)) {
				t.Errorf("sample %d %s = %v, want %v", i, name, g.Field(f), w.Field(f))
			}
		}
	}
}

// blobWithPayload builds a format 1 blob around a raw column payload.
func blobWithPayload(payload []byte) []byte {
	return zstdEncoder.EncodeAll(payload, append(bytes.Clone(lapTelemetryMagic), lapTelemetryFormatV1))
}

func TestLapTelemetryRoundTrip(t *testing.T) {
	tests := []struct {
		name    string
		samples []TelemetrySample
	}{
		{name: "empty lap", samples: []TelemetrySample{}},
		{name: "game values", samples: []TelemetrySample{
			{LapDistance: float64(float32(12.3456)), SessionTime: float64(float32(1834.2512)), Speed: 287,
				Throttle: float64(float32(0.4101930260658264)), Brake: float64(float32(0.0123)), Steer: float64(float32(-0.7349)),
				Gear: 7, EngineRPM: 11234, DRS: true, ERSDeploy: float64(float32(1234567.8)), ERSStoreEnergy: float64(float32(56.789)),
				ERSDeployMode: 2, WorldPosX: float64(float32(-412.987)), WorldPosY: float64(float32(3.0049)), WorldPosZ: float64(float32(1022.3333)),
				ActiveAeroMode: 1, ActiveAeroAvailable: 1, OvertakeActive: 1},
			{LapDistance: float64(float32(27.0101)), SessionTime: float64(float32(1834.3009)), Speed: 289,
				Throttle: 1, Steer: float64(float32(-0.7001)), Gear: 7, EngineRPM: 11301,
				ERSDeploy: float64(float32(1236001.2)), ERSStoreEnergy: float64(float32(56.702)), ERSDeployMode: 2,
				WorldPosX: float64(float32(-410.5)), WorldPosY: float64(float32(3.01)), WorldPosZ: float64(float32(1024.04))},
		}},
		{name: "extremes", samples: []TelemetrySample{
			{LapDistance: -0.004, SessionTime: 0, Gear: -1, Steer: -1, WorldPosX: -10_000, WorldPosZ: 10_000},
			{LapDistance: 7004.99, SessionTime: 7199.9996, Speed: 372, Gear: 8, EngineRPM: 15000, Steer: 1,
				Throttle: 1, Brake: 1, ERSDeploy: 4_000_000, ERSStoreEnergy: 100, WorldPosX: 10_000, WorldPosZ: -10_000},
			{LapDistance: 0, SessionTime: 7200.0004, Gear: 0},
		}},
		{name: "NaN and Inf", samples: []TelemetrySample{
			{LapDistance: math.NaN(), SessionTime: math.Inf(1), Throttle: math.Inf(-1), WorldPosY: math.NaN(), Speed: 100},
			{LapDistance: 10, SessionTime: 20, Speed: 101},
		}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			blob := EncodeLapTelemetry(tt.samples)
			if !bytes.HasPrefix(blob, append(bytes.Clone(lapTelemetryMagic), lapTelemetryFormatV1)) {
				t.Fatalf("blob starts with %q, want the magic and format 1", blob[:min(len(blob), 5)])
			}
			got, err := DecodeLapTelemetry(blob)
			if err != nil {
				t.Fatalf("DecodeLapTelemetry: %v", err)
			}
			if got == nil {
				t.Fatal("decoded nil, want an empty slice for an empty lap")
			}
			assertSamplesWithinStep(t, got, tt.samples)

			// Decoded values are on the steps already, so encoding them again changes nothing
			if again := EncodeLapTelemetry(got); !bytes.Equal(again, blob) {
				t.Error("encoding the decoded samples gave another blob")
			}
		})
	}
}

func TestLapTelemetryChannelsCoverEverySampleField(t *testing.T) {
	// Every field gets its own whole value, which every step keeps exactly: a field without a
	// channel, or two channels on one field, comes back wrong.
	var want TelemetrySample
	v := reflect.ValueOf(&want).Elem()
	for f := range v.NumField() {
		switch field := v.Field(f); field.Kind() {
		case reflect.Float64:
			field.SetFloat(float64(f + 1))
		case reflect.Int:
			field.SetInt(int64(f + 1))
		case reflect.Bool:
			field.SetBool(true)
		default:
			t.Fatalf("TelemetrySample.%s is a %s: give it a channel kind", v.Type().Field(f).Name, field.Kind())
		}
	}

	got, err := DecodeLapTelemetry(EncodeLapTelemetry([]TelemetrySample{want}))
	if err != nil {
		t.Fatalf("DecodeLapTelemetry: %v", err)
	}
	if got[0] != want {
		t.Fatalf("decoded %+v, want %+v", got[0], want)
	}
}

func TestDecodeLapTelemetryRejectsBadBlobs(t *testing.T) {
	// One sample, every value two bytes long
	good := binary.AppendUvarint(nil, 1)
	for range lapTelemetryChannelsV1 {
		good = binary.AppendVarint(good, 1000)
	}
	if _, err := DecodeLapTelemetry(blobWithPayload(good)); err != nil {
		t.Fatalf("the well-formed payload fails: %v", err)
	}

	format2 := EncodeLapTelemetry([]TelemetrySample{{Speed: 1}})
	format2[len(lapTelemetryMagic)] = 2

	tests := []struct {
		name    string
		blob    []byte
		wantErr string
	}{
		{name: "empty", blob: nil, wantErr: "unknown lap telemetry format"},
		{name: "only the magic", blob: []byte("F1TS"), wantErr: "unknown lap telemetry format"},
		{name: "old JSON blob", blob: CompressRaw([]byte(`[{"speed":1}]`)), wantErr: "unknown lap telemetry format"},
		{name: "unknown format", blob: format2, wantErr: "unknown lap telemetry format 2"},
		{name: "damaged zstd", blob: append(append(bytes.Clone(lapTelemetryMagic), lapTelemetryFormatV1), "not zstd"...), wantErr: "lap telemetry: "},
		{name: "no sample count", blob: blobWithPayload(nil), wantErr: "no sample count"},
		{name: "count too large for the data", blob: blobWithPayload(append(binary.AppendUvarint(nil, 1<<40), good[1:]...)), wantErr: "samples don't fit"},
		{name: "last channel cut short", blob: blobWithPayload(good[:len(good)-1]), wantErr: "channel 17 ends at sample 0 of 1"},
		{name: "bytes after the last channel", blob: blobWithPayload(append(bytes.Clone(good), 0)), wantErr: "1 bytes after the last channel"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			samples, err := DecodeLapTelemetry(tt.blob)
			if err == nil {
				t.Fatalf("decoded %d samples, want an error", len(samples))
			}
			if !strings.Contains(err.Error(), tt.wantErr) {
				t.Errorf("error %q, want it to contain %q", err, tt.wantErr)
			}
			if wantFormat := strings.Contains(tt.wantErr, "format"); errors.Is(err, ErrLapTelemetryFormat) != wantFormat {
				t.Errorf("errors.Is(%v, ErrLapTelemetryFormat) = %v, want %v", err, !wantFormat, wantFormat)
			}
		})
	}
}

func TestDecodeStoredLapTelemetryReadsOldJSONBlobs(t *testing.T) {
	samples := feedLap(20, 2, 100, 0, 0)
	samples[3].Throttle = 0.4101930260658264
	raw, err := json.Marshal(samples)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	old := CompressRaw(raw)

	got, err := decodeStoredLapTelemetry(old)
	if err != nil {
		t.Fatalf("decodeStoredLapTelemetry(old blob): %v", err)
	}
	if !reflect.DeepEqual(got, samples) {
		t.Error("the old blob's samples came back changed")
	}

	exported, err := exportLapTelemetry(old)
	if err != nil {
		t.Fatalf("exportLapTelemetry(old blob): %v", err)
	}
	decoded, err := DecodeLapTelemetry(exported)
	if err != nil {
		t.Fatalf("the exported old blob is not in the current format: %v", err)
	}
	assertSamplesWithinStep(t, decoded, samples)

	if _, err := decodeStoredLapTelemetry([]byte("corrupted_zstd_data")); err == nil {
		t.Error("decoded a blob in neither format")
	}
}

func TestExportLapTelemetryKeepsCurrentBlobs(t *testing.T) {
	blob := EncodeLapTelemetry(feedLap(20, 2, 100, 0, 0))
	exported, err := exportLapTelemetry(blob)
	if err != nil {
		t.Fatalf("exportLapTelemetry: %v", err)
	}
	if !bytes.Equal(exported, blob) {
		t.Error("a blob in the current format was not exported as it is")
	}

	damaged := bytes.Clone(blob[:len(blob)-3])
	if _, err := exportLapTelemetry(damaged); err == nil {
		t.Error("exported a damaged blob")
	}
}
