package packets

import "fmt"

// Decode decodes any F1 telemetry packet from raw UDP data.
// Returns a typed Packet interface implementation.
func Decode(data []byte) (Packet, error) {
	header, err := DecodeHeader(data)
	if err != nil {
		return nil, err
	}

	switch header.PacketId {
	case PacketIDMotion:
		return DecodeMotion(data)
	case PacketIDSession:
		return DecodeSession(data)
	case PacketIDLapData:
		return DecodeLapData(data)
	case PacketIDEvent:
		return DecodeEvent(data)
	case PacketIDParticipants:
		return DecodeParticipants(data)
	case PacketIDCarSetup:
		return DecodeCarSetup(data)
	case PacketIDCarTelemetry:
		return DecodeCarTelemetry(data)
	case PacketIDCarStatus:
		return DecodeCarStatus(data)
	case PacketIDFinalClassification:
		return DecodeFinalClassification(data)
	case PacketIDLobbyInfo:
		return DecodeLobbyInfo(data)
	case PacketIDCarDamage:
		return DecodeCarDamage(data)
	case PacketIDSessionHistory:
		return DecodeSessionHistory(data)
	case PacketIDTyreSets:
		return DecodeTyreSets(data)
	case PacketIDMotionEx:
		return DecodeMotionEx(data)
	case PacketIDTimeTrial:
		return DecodeTimeTrial(data)
	case PacketIDLapPositions:
		return DecodeLapPositions(data)
	default:
		return nil, fmt.Errorf("unknown packet ID: %d", header.PacketId)
	}
}
