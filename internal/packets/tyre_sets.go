package packets

import (
	"bytes"
	"encoding/binary"
	"fmt"
)

const MaxTyreSets = 20

// TyreSetData contains data for a single tyre set.
type TyreSetData struct {
	ActualTyreCompound uint8 `json:"ActualTyreCompound"`
	VisualTyreCompound uint8 `json:"VisualTyreCompound"`
	Wear               uint8 `json:"Wear"`
	Available          uint8 `json:"Available"`
	RecommendedSession uint8 `json:"RecommendedSession"`
	LifeSpan           uint8 `json:"LifeSpan"`
	UsableLife         uint8 `json:"UsableLife"`
	LapDeltaTime       int16 `json:"LapDeltaTime"`
	Fitted             uint8 `json:"Fitted"`
}

// PacketTyreSetsData contains tyre set data for a specific car. Packet ID: 12.
type PacketTyreSetsData struct {
	Header      PacketHeader             `json:"Header"`
	CarIdx      uint8                    `json:"CarIdx"`
	TyreSetData [MaxTyreSets]TyreSetData `json:"TyreSetData"`
	FittedIdx   uint8                    `json:"FittedIdx"`
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
