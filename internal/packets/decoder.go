package packets

import (
	"bytes"
	"encoding/binary"
	"fmt"
)

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

	maxCars := MaxCarsForFormat(header.PacketFormat)
	itemSize := PerCarItemSize(carsPayload, header, structSize, trailerSize)

	numToRead := maxCars
	if maxReadLimit > 0 && maxReadLimit < numToRead {
		numToRead = maxReadLimit
	}

	for i := 0; i < numToRead && i < MaxCars; i++ {
		offset := i * itemSize
		if offset+structSize > len(carsPayload) {
			break
		}
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
	maxCars := MaxCarsForFormat(header.PacketFormat)
	itemSize := PerCarItemSize(carsPayload, header, structSize, trailerSize)

	numToRead := maxCars
	if maxReadLimit > 0 && maxReadLimit < numToRead {
		numToRead = maxReadLimit
	}

	for i := 0; i < numToRead && i < MaxCars; i++ {
		offset := i * itemSize
		if offset+structSize > len(carsPayload) {
			break
		}
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
		return DecodeMotion(header, payload)
	case PacketIDSession:
		return DecodeSession(header, payload)
	case PacketIDLapData:
		return DecodeLapData(header, payload)
	case PacketIDEvent:
		return DecodeEvent(header, payload)
	case PacketIDParticipants:
		return DecodeParticipants(header, payload)
	case PacketIDCarSetup:
		return DecodeCarSetup(header, payload)
	case PacketIDCarTelemetry:
		return DecodeCarTelemetry(header, payload)
	case PacketIDCarStatus:
		return DecodeCarStatus(header, payload)
	case PacketIDFinalClassification:
		return DecodeFinalClassification(header, payload)
	case PacketIDLobbyInfo:
		return DecodeLobbyInfo(header, payload)
	case PacketIDCarDamage:
		return DecodeCarDamage(header, payload)
	case PacketIDSessionHistory:
		return DecodeSessionHistory(header, payload)
	case PacketIDTyreSets:
		return DecodeTyreSets(header, payload)
	case PacketIDMotionEx:
		return DecodeMotionEx(header, payload)
	case PacketIDTimeTrial:
		return DecodeTimeTrial(header, payload)
	case PacketIDLapPositions:
		return DecodeLapPositions(header, payload)
	case PacketIDCarTelemetry2:
		return DecodeCarTelemetry2(header, payload)
	default:
		return nil, fmt.Errorf("unknown packet ID: %d", header.PacketId)
	}
}
