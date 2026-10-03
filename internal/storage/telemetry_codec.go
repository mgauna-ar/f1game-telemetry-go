package storage

import (
	"bytes"
	"encoding/binary"
	"encoding/json"
	"errors"
	"fmt"
	"math"
)

// A lap telemetry blob (lap_telemetry.data, and a lap's telemetry in a .f1session file) holds one
// column per TelemetrySample field: lapTelemetryMagic, a format byte, then zstd of the sample count
// (uvarint) and each channel's values in turn, as varint deltas of fixed-point integers. Columns of
// small deltas take about 7 times less space than the zstd JSON array that blobs held before.

const (
	// lapTelemetryFormatV1 is the format blobs are written in: lapTelemetryChannelsV1. A new channel
	// means a new format, which DecodeLapTelemetry learns to read alongside this one.
	lapTelemetryFormatV1 byte = 1

	// Fixed-point steps per unit. Each is finer than the comparator's output, which rounds times
	// to 1 ms, pedals and steering to 0.01, the ERS store to 0.1 % and positions to 1 cm.
	centimeters  = 100  // lap distance and world positions, in metres
	milliseconds = 1000 // session time, in seconds
	inputSteps   = 1000 // throttle and brake (0..1) and steering (-1..1)
	joules       = 1    // ERS deployed this lap, in joules
	percentSteps = 100  // ERS store, in percent

	// maxFixedPoint bounds a scaled value, so a garbage float can't overflow int64.
	maxFixedPoint = 1 << 53
)

// lapTelemetryMagic starts every blob in the column format. The JSON blobs written before it are
// zstd frames, which start with zstd's magic number instead.
var lapTelemetryMagic = []byte("F1TS")

// ErrLapTelemetryFormat marks a blob that is not in a lap telemetry format this version reads.
var ErrLapTelemetryFormat = errors.New("unknown lap telemetry format")

// lapTelemetryChannel is one column of a blob: a sample's field as a fixed-point integer, and how
// to set the field back from one.
type lapTelemetryChannel struct {
	get func(*TelemetrySample) int64
	set func(*TelemetrySample, int64)
}

func floatChannel(field func(*TelemetrySample) *float64, steps float64) lapTelemetryChannel {
	return lapTelemetryChannel{
		get: func(s *TelemetrySample) int64 { return toFixedPoint(*field(s), steps) },
		set: func(s *TelemetrySample, v int64) { *field(s) = float64(v) / steps },
	}
}

func intChannel(field func(*TelemetrySample) *int) lapTelemetryChannel {
	return lapTelemetryChannel{
		get: func(s *TelemetrySample) int64 { return int64(*field(s)) },
		set: func(s *TelemetrySample, v int64) { *field(s) = int(v) },
	}
}

func boolChannel(field func(*TelemetrySample) *bool) lapTelemetryChannel {
	return lapTelemetryChannel{
		get: func(s *TelemetrySample) int64 {
			if *field(s) {
				return 1
			}
			return 0
		},
		set: func(s *TelemetrySample, v int64) { *field(s) = v != 0 },
	}
}

// toFixedPoint scales v to whole steps. NaN and Inf become 0, as TelemetrySample.MarshalJSON
// writes them.
func toFixedPoint(v, steps float64) int64 {
	scaled := math.Round(SanitizeFloat(v) * steps)
	return int64(math.Max(-maxFixedPoint, math.Min(maxFixedPoint, scaled)))
}

// lapTelemetryChannelsV1 is format 1's channel list, in blob order. Stored blobs depend on it:
// never change it, add a format instead.
var lapTelemetryChannelsV1 = []lapTelemetryChannel{
	floatChannel(func(s *TelemetrySample) *float64 { return &s.LapDistance }, centimeters),
	floatChannel(func(s *TelemetrySample) *float64 { return &s.SessionTime }, milliseconds),
	intChannel(func(s *TelemetrySample) *int { return &s.Speed }),
	floatChannel(func(s *TelemetrySample) *float64 { return &s.Throttle }, inputSteps),
	floatChannel(func(s *TelemetrySample) *float64 { return &s.Brake }, inputSteps),
	floatChannel(func(s *TelemetrySample) *float64 { return &s.Steer }, inputSteps),
	intChannel(func(s *TelemetrySample) *int { return &s.Gear }),
	intChannel(func(s *TelemetrySample) *int { return &s.EngineRPM }),
	boolChannel(func(s *TelemetrySample) *bool { return &s.DRS }),
	floatChannel(func(s *TelemetrySample) *float64 { return &s.ERSDeploy }, joules),
	floatChannel(func(s *TelemetrySample) *float64 { return &s.ERSStoreEnergy }, percentSteps),
	intChannel(func(s *TelemetrySample) *int { return &s.ERSDeployMode }),
	floatChannel(func(s *TelemetrySample) *float64 { return &s.WorldPosX }, centimeters),
	floatChannel(func(s *TelemetrySample) *float64 { return &s.WorldPosY }, centimeters),
	floatChannel(func(s *TelemetrySample) *float64 { return &s.WorldPosZ }, centimeters),
	intChannel(func(s *TelemetrySample) *int { return &s.ActiveAeroMode }),
	intChannel(func(s *TelemetrySample) *int { return &s.ActiveAeroAvailable }),
	intChannel(func(s *TelemetrySample) *int { return &s.OvertakeActive }),
}

// EncodeLapTelemetry encodes a lap's samples as a blob in the current format. Values are rounded
// to their channel's step.
func EncodeLapTelemetry(samples []TelemetrySample) []byte {
	channels := lapTelemetryChannelsV1
	payload := make([]byte, 0, binary.MaxVarintLen64+len(samples)*len(channels)*2)
	payload = binary.AppendUvarint(payload, uint64(len(samples)))
	for _, ch := range channels {
		var prev int64
		for i := range samples {
			v := ch.get(&samples[i])
			payload = binary.AppendVarint(payload, v-prev)
			prev = v
		}
	}

	blob := make([]byte, 0, len(lapTelemetryMagic)+1+len(payload)/3)
	blob = append(blob, lapTelemetryMagic...)
	blob = append(blob, lapTelemetryFormatV1)
	return zstdEncoder.EncodeAll(payload, blob)
}

// DecodeLapTelemetry decodes a blob written by EncodeLapTelemetry. A blob in another format, or a
// damaged one, is an error.
func DecodeLapTelemetry(blob []byte) ([]TelemetrySample, error) {
	header := len(lapTelemetryMagic) + 1
	if len(blob) < header || !bytes.HasPrefix(blob, lapTelemetryMagic) {
		return nil, ErrLapTelemetryFormat
	}
	if format := blob[header-1]; format != lapTelemetryFormatV1 {
		return nil, fmt.Errorf("%w %d", ErrLapTelemetryFormat, format)
	}
	payload, err := DecompressRaw(blob[header:])
	if err != nil {
		return nil, fmt.Errorf("lap telemetry: %w", err)
	}
	return decodeLapTelemetryColumns(payload, lapTelemetryChannelsV1)
}

func decodeLapTelemetryColumns(payload []byte, channels []lapTelemetryChannel) ([]TelemetrySample, error) {
	count, n := binary.Uvarint(payload)
	if n <= 0 {
		return nil, errors.New("lap telemetry: no sample count")
	}
	payload = payload[n:]
	// Every value takes at least a byte.
	if count > uint64(len(payload)/len(channels)) {
		return nil, fmt.Errorf("lap telemetry: %d samples don't fit in %d bytes", count, len(payload))
	}

	samples := make([]TelemetrySample, count)
	for c, ch := range channels {
		var v int64
		for i := range samples {
			delta, n := binary.Varint(payload)
			if n <= 0 {
				return nil, fmt.Errorf("lap telemetry: channel %d ends at sample %d of %d", c, i, count)
			}
			payload = payload[n:]
			v += delta
			ch.set(&samples[i], v)
		}
	}
	if len(payload) > 0 {
		return nil, fmt.Errorf("lap telemetry: %d bytes after the last channel", len(payload))
	}
	return samples, nil
}

// decodeStoredLapTelemetry decodes a lap_telemetry blob: the column format, or the zstd JSON array
// that blobs were written as before it.
func decodeStoredLapTelemetry(blob []byte) ([]TelemetrySample, error) {
	if bytes.HasPrefix(blob, lapTelemetryMagic) {
		return DecodeLapTelemetry(blob)
	}
	raw, err := DecompressRaw(blob)
	if err != nil {
		return nil, fmt.Errorf("lap telemetry: %w", err)
	}
	var samples []TelemetrySample
	if err := json.Unmarshal(raw, &samples); err != nil {
		return nil, fmt.Errorf("lap telemetry: %w", err)
	}
	return samples, nil
}

// exportLapTelemetry returns a lap_telemetry blob in the current format for a .f1session file,
// once it is known to decode. A blob in the old JSON format is encoded again.
func exportLapTelemetry(blob []byte) ([]byte, error) {
	samples, err := decodeStoredLapTelemetry(blob)
	if err != nil {
		return nil, err
	}
	if bytes.HasPrefix(blob, lapTelemetryMagic) {
		return blob, nil
	}
	return EncodeLapTelemetry(samples), nil
}
