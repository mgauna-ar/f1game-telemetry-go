package packets

import (
	"bytes"
	"encoding/binary"
	"fmt"
)

const MaxTyreSets = 20

// TyreSetData contains data for a single tyre set.
type TyreSetData struct {
	ActualTyreCompound uint8
	VisualTyreCompound uint8
	Wear               uint8
	Available          uint8
	RecommendedSession uint8
	LifeSpan           uint8
	UsableLife         uint8
	LapDeltaTime       int16
	Fitted             uint8
}

// PacketTyreSetsData contains tyre set data for a specific car. Packet ID: 12.
type PacketTyreSetsData struct {
	Header      PacketHeader
	CarIdx      uint8
	TyreSetData [MaxTyreSets]TyreSetData
	FittedIdx   uint8
}

func (p PacketTyreSetsData) GetHeader() PacketHeader { return p.Header }

type rawTyreSetsPayload struct {
	CarIdx      uint8
	TyreSetData [MaxTyreSets]TyreSetData
	FittedIdx   uint8
}

// DecodeTyreSets decodes a PacketTyreSetsData from header and payload bytes.
func DecodeTyreSets(header PacketHeader, payload []byte) (*PacketTyreSetsData, error) {
	var raw rawTyreSetsPayload
	err := binary.Read(bytes.NewReader(payload), binary.LittleEndian, &raw)
	if err != nil {
		return nil, fmt.Errorf("failed to decode tyre sets packet: %w", err)
	}
	return &PacketTyreSetsData{
		Header:      header,
		CarIdx:      raw.CarIdx,
		TyreSetData: raw.TyreSetData,
		FittedIdx:   raw.FittedIdx,
	}, nil
}
