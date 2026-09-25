package packets

import (
	"bytes"
	"encoding/binary"
	"fmt"
)

// perCarLayout returns the per-car stride and the number of cars to read from carsPayload.
// It rejects payloads too short to hold every car slot, so truncated packets fail loudly
// instead of decoding as a partially zeroed grid.
func perCarLayout(carsPayload []byte, header PacketHeader, structSize, trailerSize, maxReadLimit int) (itemSize, numToRead int, err error) {
	itemSize = PerCarItemSize(carsPayload, header, structSize, trailerSize)

	numToRead = min(MaxCarsForFormat(header.PacketFormat), MaxCars)
	if maxReadLimit > 0 && maxReadLimit < numToRead {
		numToRead = maxReadLimit
	}

	if numToRead > 0 {
		need := (numToRead-1)*itemSize + structSize
		if len(carsPayload) < need {
			return 0, 0, fmt.Errorf("data too short for %d cars: got %d bytes, need %d", numToRead, len(carsPayload), need)
		}
	}
	return itemSize, numToRead, nil
}

// DecodePerCarBinary reads fixed-size binary struct arrays for each car from a payload.
func DecodePerCarBinary[T any](payload []byte, header PacketHeader, structSize, trailerSize, prefixSize, maxReadLimit int) ([MaxCars]T, error) {
	var cars [MaxCars]T
	carsPayload := payload
	if prefixSize > 0 {
		if len(payload) < prefixSize {
			return cars, fmt.Errorf("data too short for prefix: got %d bytes, want %d", len(payload), prefixSize)
		}
		carsPayload = payload[prefixSize:]
	}

	itemSize, numToRead, err := perCarLayout(carsPayload, header, structSize, trailerSize, maxReadLimit)
	if err != nil {
		return cars, err
	}

	for i := 0; i < numToRead; i++ {
		offset := i * itemSize
		r := bytes.NewReader(carsPayload[offset : offset+structSize])
		if err := binary.Read(r, binary.LittleEndian, &cars[i]); err != nil {
			return cars, fmt.Errorf("failed to decode car %d: %w", i, err)
		}
	}
	return cars, nil
}

// DecodePerCarCustom reads per-car data by invoking a custom decoder closure for each car's byte slice.
func DecodePerCarCustom[T any](
	payload []byte,
	header PacketHeader,
	structSize, trailerSize, prefixSize, maxReadLimit int,
	decodeCar func(carBytes []byte, is2026 bool) (T, error),
) ([MaxCars]T, error) {
	var cars [MaxCars]T
	carsPayload := payload
	if prefixSize > 0 {
		if len(payload) < prefixSize {
			return cars, fmt.Errorf("data too short for prefix: got %d bytes, want %d", len(payload), prefixSize)
		}
		carsPayload = payload[prefixSize:]
	}

	is2026 := header.PacketFormat >= PacketFormat2026
	itemSize, numToRead, err := perCarLayout(carsPayload, header, structSize, trailerSize, maxReadLimit)
	if err != nil {
		return cars, err
	}

	for i := 0; i < numToRead; i++ {
		offset := i * itemSize
		car, err := decodeCar(carsPayload[offset:offset+structSize], is2026)
		if err != nil {
			return cars, fmt.Errorf("failed to decode car %d: %w", i, err)
		}
		cars[i] = car
	}
	return cars, nil
}

// Decode decodes any F1 telemetry packet from raw UDP data.
// Returns a typed Packet interface implementation.
func Decode(data []byte) (Packet, error) {
	header, err := DecodeHeader(data)
	if err != nil {
		return nil, fmt.Errorf("decode header: %w", err)
	}

	payload := data[HeaderSize:]

	switch header.PacketId {
	case PacketIDMotion:
		return asPacket(DecodeMotion(header, payload))
	case PacketIDSession:
		return asPacket(DecodeSession(header, payload))
	case PacketIDLapData:
		return asPacket(DecodeLapData(header, payload))
	case PacketIDEvent:
		return asPacket(DecodeEvent(header, payload))
	case PacketIDParticipants:
		return asPacket(DecodeParticipants(header, payload))
	case PacketIDCarSetup:
		return asPacket(DecodeCarSetup(header, payload))
	case PacketIDCarTelemetry:
		return asPacket(DecodeCarTelemetry(header, payload))
	case PacketIDCarStatus:
		return asPacket(DecodeCarStatus(header, payload))
	case PacketIDFinalClassification:
		return asPacket(DecodeFinalClassification(header, payload))
	case PacketIDLobbyInfo:
		return asPacket(DecodeLobbyInfo(header, payload))
	case PacketIDCarDamage:
		return asPacket(DecodeCarDamage(header, payload))
	case PacketIDSessionHistory:
		return asPacket(DecodeSessionHistory(header, payload))
	case PacketIDTyreSets:
		return asPacket(DecodeTyreSets(header, payload))
	case PacketIDMotionEx:
		return asPacket(DecodeMotionEx(header, payload))
	case PacketIDTimeTrial:
		return asPacket(DecodeTimeTrial(header, payload))
	case PacketIDLapPositions:
		return asPacket(DecodeLapPositions(header, payload))
	case PacketIDCarTelemetry2:
		return asPacket(DecodeCarTelemetry2(header, payload))
	default:
		return nil, fmt.Errorf("unknown packet ID: %d", header.PacketId)
	}
}

// asPacket converts a typed decoder result into a Packet, returning a nil interface on error
// so callers never receive a non-nil Packet wrapping a nil pointer.
func asPacket[T Packet](pkt T, err error) (Packet, error) {
	if err != nil {
		return nil, err
	}
	return pkt, nil
}
