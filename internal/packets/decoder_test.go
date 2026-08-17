package packets

import (
	"bytes"
	"encoding/binary"
	"testing"
)

// Helper to create a valid packet header
func createHeader(packetID uint8) PacketHeader {
	return PacketHeader{
		PacketFormat:            2025,
		GameYear:                25,
		GameMajorVersion:        1,
		GameMinorVersion:        0,
		PacketVersion:           1,
		PacketId:                packetID,
		SessionUID:              123456789,
		SessionTime:             12.5,
		FrameIdentifier:         100,
		OverallFrameIdentifier:  100,
		PlayerCarIndex:          0,
		SecondaryPlayerCarIndex: 255,
	}
}

// Helper to serialize a header to bytes
func serializeHeader(h PacketHeader) []byte {
	buf := new(bytes.Buffer)
	_ = binary.Write(buf, binary.LittleEndian, &h)
	return buf.Bytes()
}

func TestDecodeHeader(t *testing.T) {
	tests := []struct {
		name    string
		data    []byte
		wantErr bool
		wantID  uint8
	}{
		{
			name:    "Valid header F1 2025/2026",
			data:    serializeHeader(createHeader(PacketIDMotion)),
			wantErr: false,
			wantID:  PacketIDMotion,
		},
		{
			name:    "Data too short",
			data:    make([]byte, 10), // less than 29 bytes
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := DecodeHeader(tt.data)
			if (err != nil) != tt.wantErr {
				t.Errorf("DecodeHeader() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if !tt.wantErr && got.PacketId != tt.wantID {
				t.Errorf("DecodeHeader() got PacketId = %v, want %v", got.PacketId, tt.wantID)
			}
		})
	}
}

func TestDecode(t *testing.T) {
	tests := []struct {
		name     string
		packetID uint8
		wantErr  bool
	}{
		{"Motion Packet", PacketIDMotion, true},
		{"Session Packet", PacketIDSession, true},
		{"Unknown Packet", 255, true}, // 255 is not a valid packet ID
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			headerData := serializeHeader(createHeader(tt.packetID))

			_, err := Decode(headerData)

			if tt.wantErr {
				if err == nil {
					t.Errorf("Decode() expected error but got none")
				} else if tt.packetID == 255 && err.Error() != "unknown packet ID: 255" {
					t.Errorf("Decode() unexpected error message: %v", err)
				}
			} else {
				if err != nil {
					t.Errorf("Decode() unexpected error: %v", err)
				}
			}
		})
	}
}

func TestDecodeLapDataAlignment(t *testing.T) {
	buf := new(bytes.Buffer)
	hdr := createHeader(PacketIDLapData)
	_ = binary.Write(buf, binary.LittleEndian, &hdr)

	for i := 0; i < MaxCars; i++ {
		ld := LapData{
			LastLapTimeInMS:         90000,
			CurrentLapTimeInMS:      45000,
			Sector1TimeMSPart:       25000,
			Sector2TimeMSPart:       20000,
			DeltaToCarInFrontMSPart: 500,
			DeltaToRaceLeaderMSPart: 1500,
			LapDistance:             2500.5,
			TotalDistance:           15000.0,
			SafetyCarDelta:          0.0,
			CarPosition:             uint8(i + 1),
			CurrentLapNum:           uint8(5 + i),
			PitStatus:               0,
			ResultStatus:            2, // Active
		}
		_ = binary.Write(buf, binary.LittleEndian, &ld)
	}

	pkt, err := DecodeLapData(buf.Bytes())
	if err != nil {
		t.Fatalf("DecodeLapData failed: %v", err)
	}

	// Verify car 0 (leader) and car 3
	if pkt.LapData[0].CarPosition != 1 || pkt.LapData[0].CurrentLapNum != 5 {
		t.Errorf("Expected Car 0 Position 1, Lap 5; got Pos %d, Lap %d", pkt.LapData[0].CarPosition, pkt.LapData[0].CurrentLapNum)
	}
	if pkt.LapData[3].CarPosition != 4 || pkt.LapData[3].CurrentLapNum != 8 {
		t.Errorf("Expected Car 3 Position 4, Lap 8; got Pos %d, Lap %d", pkt.LapData[3].CarPosition, pkt.LapData[3].CurrentLapNum)
	}
	if pkt.LapData[0].LapDistance != 2500.5 {
		t.Errorf("Expected LapDistance 2500.5, got %f", pkt.LapData[0].LapDistance)
	}
}

func TestDecodeCarTelemetryAlignment(t *testing.T) {
	buf := new(bytes.Buffer)
	hdr := createHeader(PacketIDCarTelemetry)
	hdr.PlayerCarIndex = 18
	_ = binary.Write(buf, binary.LittleEndian, &hdr)

	numCars := MaxCarsForFormat(hdr.PacketFormat)
	for i := 0; i < numCars; i++ {
		cd := CarTelemetryData{
			Speed:     uint16(100 + i),
			Throttle:  0.75,
			Brake:     0.25,
			EngineRPM: uint16(10000 + i*100),
		}
		_ = binary.Write(buf, binary.LittleEndian, &cd)
	}

	pkt, err := DecodeCarTelemetry(buf.Bytes())
	if err != nil {
		t.Fatalf("DecodeCarTelemetry failed: %v", err)
	}

	if pkt.CarTelemetryData[18].Speed != 118 {
		t.Errorf("Expected Car 18 Speed 118, got %d", pkt.CarTelemetryData[18].Speed)
	}
	if pkt.CarTelemetryData[18].Throttle != 0.75 || pkt.CarTelemetryData[18].Brake != 0.25 {
		t.Errorf("Expected Throttle 0.75, Brake 0.25; got %f, %f", pkt.CarTelemetryData[18].Throttle, pkt.CarTelemetryData[18].Brake)
	}
}

func TestDecodeCarSetupAlignment(t *testing.T) {
	buf := new(bytes.Buffer)
	hdr := createHeader(PacketIDCarSetup)
	_ = binary.Write(buf, binary.LittleEndian, &hdr)

	for i := 0; i < MaxCars; i++ {
		cs := CarSetupData{
			FrontWing:              uint8(10 + i),
			RearWing:               uint8(5 + i),
			OnThrottle:             uint8(60 + i),
			OffThrottle:            uint8(50 + i),
			FrontCamber:            -3.5 + float32(i)*0.1,
			RearCamber:             -1.5 + float32(i)*0.05,
			FrontToe:               0.05 + float32(i)*0.01,
			RearToe:                0.20 + float32(i)*0.01,
			FrontSuspension:        uint8(8 + i),
			RearSuspension:         uint8(6 + i),
			FrontAntiRollBar:       uint8(7 + i),
			RearAntiRollBar:        uint8(5 + i),
			FrontSuspensionHeight:  uint8(33 + i),
			RearSuspensionHeight:   uint8(38 + i),
			BrakePressure:          100,
			BrakeBias:              56,
			RearLeftTyrePressure:   21.5,
			RearRightTyrePressure:  21.5,
			FrontLeftTyrePressure:  23.5,
			FrontRightTyrePressure: 23.5,
			Ballast:                0,
			FuelLoad:               45.0,
		}
		_ = binary.Write(buf, binary.LittleEndian, &cs)
	}

	pkt, err := DecodeCarSetup(buf.Bytes())
	if err != nil {
		t.Fatalf("DecodeCarSetup failed: %v", err)
	}

	if pkt.CarSetupData[0].FrontWing != 10 || pkt.CarSetupData[0].FrontCamber != -3.5 {
		t.Errorf("Car 0 Setup expected FrontWing 10, Camber -3.5; got Wing %d, Camber %f", pkt.CarSetupData[0].FrontWing, pkt.CarSetupData[0].FrontCamber)
	}
	if pkt.CarSetupData[21].FrontWing != 31 || pkt.CarSetupData[21].BrakePressure != 100 {
		t.Errorf("Car 21 Setup expected FrontWing 31, BrakePressure 100; got Wing %d, Pressure %d", pkt.CarSetupData[21].FrontWing, pkt.CarSetupData[21].BrakePressure)
	}
}

func TestDecodeCarDamage2025And2026(t *testing.T) {
	formats := []struct {
		name         string
		packetFormat uint16
		expectedCars int
	}{
		{"F1 2025 (22 cars)", 2025, 22},
		{"F1 2026 (24 cars)", 2026, 24},
	}

	for _, fmtCase := range formats {
		t.Run(fmtCase.name, func(t *testing.T) {
			buf := new(bytes.Buffer)
			hdr := createHeader(PacketIDCarDamage)
			hdr.PacketFormat = fmtCase.packetFormat
			_ = binary.Write(buf, binary.LittleEndian, &hdr)

			for i := 0; i < fmtCase.expectedCars; i++ {
				cd := CarDamageData{
					FrontLeftWingDamage:  uint8(10 + i),
					FrontRightWingDamage: uint8(20 + i),
					RearWingDamage:       uint8(30 + i),
					GearBoxDamage:        uint8(i),
				}
				_ = binary.Write(buf, binary.LittleEndian, &cd)
			}

			pkt, err := DecodeCarDamage(buf.Bytes())
			if err != nil {
				t.Fatalf("DecodeCarDamage failed for %s: %v", fmtCase.name, err)
			}

			if pkt.CarDamageData[0].FrontLeftWingDamage != 10 {
				t.Errorf("Car 0 FrontLeftWingDamage expected 10, got %d", pkt.CarDamageData[0].FrontLeftWingDamage)
			}
			if pkt.CarDamageData[fmtCase.expectedCars-1].FrontLeftWingDamage != uint8(10+fmtCase.expectedCars-1) {
				t.Errorf("Last Car FrontLeftWingDamage expected %d, got %d", 10+fmtCase.expectedCars-1, pkt.CarDamageData[fmtCase.expectedCars-1].FrontLeftWingDamage)
			}
		})
	}
}

func TestDecodeFinalClassification2025And2026(t *testing.T) {
	formats := []struct {
		name         string
		packetFormat uint16
		expectedCars int
	}{
		{"F1 2025 (22 cars)", 2025, 22},
		{"F1 2026 (24 cars)", 2026, 24},
	}

	for _, fmtCase := range formats {
		t.Run(fmtCase.name, func(t *testing.T) {
			buf := new(bytes.Buffer)
			hdr := createHeader(PacketIDFinalClassification)
			hdr.PacketFormat = fmtCase.packetFormat
			_ = binary.Write(buf, binary.LittleEndian, &hdr)

			numCars := uint8(fmtCase.expectedCars)
			_ = binary.Write(buf, binary.LittleEndian, &numCars)

			for i := 0; i < fmtCase.expectedCars; i++ {
				fc := FinalClassificationData{
					Position:        uint8(i + 1),
					NumLaps:         50,
					BestLapTimeInMS: uint32(80000 + i*500),
					TotalRaceTime:   4500.5,
				}
				_ = binary.Write(buf, binary.LittleEndian, &fc)
			}

			pkt, err := DecodeFinalClassification(buf.Bytes())
			if err != nil {
				t.Fatalf("DecodeFinalClassification failed for %s: %v", fmtCase.name, err)
			}

			if pkt.NumCars != numCars {
				t.Errorf("Expected NumCars %d, got %d", numCars, pkt.NumCars)
			}
			if pkt.ClassificationData[0].Position != 1 {
				t.Errorf("Car 0 position expected 1, got %d", pkt.ClassificationData[0].Position)
			}
			if pkt.ClassificationData[fmtCase.expectedCars-1].Position != uint8(fmtCase.expectedCars) {
				t.Errorf("Last car position expected %d, got %d", fmtCase.expectedCars, pkt.ClassificationData[fmtCase.expectedCars-1].Position)
			}
		})
	}
}

func TestDecodeLobbyInfo2025And2026(t *testing.T) {
	formats := []struct {
		name         string
		packetFormat uint16
		expectedCars int
	}{
		{"F1 2025 (22 cars)", 2025, 22},
		{"F1 2026 (24 cars)", 2026, 24},
	}

	for _, fmtCase := range formats {
		t.Run(fmtCase.name, func(t *testing.T) {
			buf := new(bytes.Buffer)
			hdr := createHeader(PacketIDLobbyInfo)
			hdr.PacketFormat = fmtCase.packetFormat
			_ = binary.Write(buf, binary.LittleEndian, &hdr)

			numPlayers := uint8(fmtCase.expectedCars)
			_ = binary.Write(buf, binary.LittleEndian, &numPlayers)

			for i := 0; i < fmtCase.expectedCars; i++ {
				var li LobbyInfoData
				li.TeamId = uint8(i)
				li.CarNumber = uint8(i + 1)
				copy(li.Name[:], "PlayerName")
				_ = binary.Write(buf, binary.LittleEndian, &li)
			}

			pkt, err := DecodeLobbyInfo(buf.Bytes())
			if err != nil {
				t.Fatalf("DecodeLobbyInfo failed for %s: %v", fmtCase.name, err)
			}

			if pkt.NumPlayers != numPlayers {
				t.Errorf("Expected NumPlayers %d, got %d", numPlayers, pkt.NumPlayers)
			}
			if pkt.LobbyPlayers[0].NameString() != "PlayerName" {
				t.Errorf("Expected player 0 name PlayerName, got %q", pkt.LobbyPlayers[0].NameString())
			}
		})
	}
}

func TestDecodeLapPositions2025And2026(t *testing.T) {
	formats := []struct {
		name         string
		packetFormat uint16
		expectedCars int
	}{
		{"F1 2025 (22 cars)", 2025, 22},
		{"F1 2026 (24 cars)", 2026, 24},
	}

	for _, fmtCase := range formats {
		t.Run(fmtCase.name, func(t *testing.T) {
			buf := new(bytes.Buffer)
			hdr := createHeader(PacketIDLapPositions)
			hdr.PacketFormat = fmtCase.packetFormat
			_ = binary.Write(buf, binary.LittleEndian, &hdr)

			for i := 0; i < fmtCase.expectedCars; i++ {
				var lp LapPositionsCarData
				lp.NumPositions = 10
				lp.Positions[0] = LapPosition{X: float32(i * 10), Y: 5.0, Z: 100.0}
				_ = binary.Write(buf, binary.LittleEndian, &lp)
			}

			pkt, err := DecodeLapPositions(buf.Bytes())
			if err != nil {
				t.Fatalf("DecodeLapPositions failed for %s: %v", fmtCase.name, err)
			}

			if pkt.LapPositionsCarData[0].Positions[0].X != 0 {
				t.Errorf("Car 0 Position[0].X expected 0, got %f", pkt.LapPositionsCarData[0].Positions[0].X)
			}
			if pkt.LapPositionsCarData[1].Positions[0].X != 10 {
				t.Errorf("Car 1 Position[0].X expected 10, got %f", pkt.LapPositionsCarData[1].Positions[0].X)
			}
		})
	}
}

func TestDecodeParticipants2025And2026(t *testing.T) {
	drivers := []struct {
		name       string
		raceNumber uint8
		teamID     uint8
	}{
		{"Max Verstappen", 1, 0},
		{"Sergio Perez", 11, 0},
		{"Lewis Hamilton", 44, 4},
		{"Charles Leclerc", 16, 4},
		{"Lando Norris", 4, 2},
		{"Oscar Piastri", 81, 2},
		{"George Russell", 63, 1},
		{"Kimi Antonelli", 12, 1},
		{"Fernando Alonso", 14, 3},
		{"Lance Stroll", 18, 3},
		{"Pierre Gasly", 10, 5},
		{"Jack Doohan", 7, 5},
		{"Alexander Albon", 23, 6},
		{"Carlos Sainz", 55, 6},
		{"Yuki Tsunoda", 22, 7},
		{"Liam Lawson", 30, 7},
		{"Nico Hulkenberg", 27, 8},
		{"Gabriel Bortoleto", 5, 8},
		{"Esteban Ocon", 31, 9},
		{"Oliver Bearman", 87, 9},
		{"Isack Hadjar", 6, 0},
		{"Felipe Drugovich", 31, 3},
		{"Colton Herta", 26, 10},
		{"Alex Palou", 10, 10},
	}

	formats := []struct {
		name         string
		packetFormat uint16
		expectedCars int
		nameLen      int
		structSize   int
	}{
		{"F1 2025 (22 cars)", 2025, 22, 48, 60},
		{"F1 2026 (24 cars)", 2026, 24, 32, 57},
	}

	for _, fmtCase := range formats {
		t.Run(fmtCase.name, func(t *testing.T) {
			buf := new(bytes.Buffer)
			hdr := createHeader(PacketIDParticipants)
			hdr.PacketFormat = fmtCase.packetFormat
			_ = binary.Write(buf, binary.LittleEndian, &hdr)

			numCars := uint8(fmtCase.expectedCars)
			_ = binary.Write(buf, binary.LittleEndian, &numCars)

			for i := 0; i < fmtCase.expectedCars; i++ {
				d := drivers[i]
				_ = binary.Write(buf, binary.LittleEndian, uint8(1))     // AIControlled
				_ = binary.Write(buf, binary.LittleEndian, uint8(i+1))   // DriverId
				_ = binary.Write(buf, binary.LittleEndian, uint8(0))     // NetworkId
				_ = binary.Write(buf, binary.LittleEndian, d.teamID)     // TeamId
				_ = binary.Write(buf, binary.LittleEndian, uint8(0))     // MyTeam
				_ = binary.Write(buf, binary.LittleEndian, d.raceNumber) // RaceNumber
				_ = binary.Write(buf, binary.LittleEndian, uint8(12))    // Nationality

				nameBytes := make([]byte, fmtCase.nameLen)
				copy(nameBytes, d.name)
				buf.Write(nameBytes)

				_ = binary.Write(buf, binary.LittleEndian, uint8(1))     // YourTelemetry
				_ = binary.Write(buf, binary.LittleEndian, uint8(1))     // ShowOnlineNames
				_ = binary.Write(buf, binary.LittleEndian, uint16(1000)) // TechLevel
				_ = binary.Write(buf, binary.LittleEndian, uint8(1))     // Platform

				written := 7 + fmtCase.nameLen + 5
				if written < fmtCase.structSize {
					extra := make([]byte, fmtCase.structSize-written)
					buf.Write(extra)
				}
			}

			pkt, err := DecodeParticipants(buf.Bytes())
			if err != nil {
				t.Fatalf("DecodeParticipants failed for %s: %v", fmtCase.name, err)
			}

			if pkt.NumActiveCars != numCars {
				t.Errorf("Expected NumActiveCars %d, got %d", numCars, pkt.NumActiveCars)
			}

			for i := 0; i < fmtCase.expectedCars; i++ {
				p := pkt.Participants[i]
				expectedName := drivers[i].name
				expectedNumber := drivers[i].raceNumber

				if p.NameString() != expectedName {
					t.Errorf("Car %d: expected name %q, got %q", i, expectedName, p.NameString())
				}
				if p.RaceNumber != expectedNumber {
					t.Errorf("Car %d: expected race number %d, got %d", i, expectedNumber, p.RaceNumber)
				}
				if p.TeamId != drivers[i].teamID {
					t.Errorf("Car %d: expected team ID %d, got %d", i, drivers[i].teamID, p.TeamId)
				}
			}
		})
	}
}

func TestDecodeCarTelemetryAllCarsNoShift(t *testing.T) {
	formats := []struct {
		name         string
		packetFormat uint16
		expectedCars int
	}{
		{"F1 2025 (22 cars)", 2025, 22},
		{"F1 2026 (24 cars)", 2026, 24},
	}

	for _, fmtCase := range formats {
		t.Run(fmtCase.name, func(t *testing.T) {
			buf := new(bytes.Buffer)
			hdr := createHeader(PacketIDCarTelemetry)
			hdr.PacketFormat = fmtCase.packetFormat
			_ = binary.Write(buf, binary.LittleEndian, &hdr)

			for i := 0; i < fmtCase.expectedCars; i++ {
				cd := CarTelemetryData{
					Speed:             uint16(200 + i*5),
					Throttle:          0.5 + float32(i)*0.01,
					Steer:             -0.2 + float32(i)*0.01,
					Brake:             0.1,
					Clutch:            10,
					Gear:              int8(5),
					EngineRPM:         uint16(11000 + i*50),
					DRS:               uint8(i % 2),
					EngineTemperature: uint16(90 + i),
				}
				_ = binary.Write(buf, binary.LittleEndian, &cd)
			}

			// Trailer
			_ = binary.Write(buf, binary.LittleEndian, uint8(255))
			_ = binary.Write(buf, binary.LittleEndian, uint8(255))
			_ = binary.Write(buf, binary.LittleEndian, int8(0))

			pkt, err := DecodeCarTelemetry(buf.Bytes())
			if err != nil {
				t.Fatalf("DecodeCarTelemetry failed: %v", err)
			}

			for i := 0; i < fmtCase.expectedCars; i++ {
				expectedSpeed := uint16(200 + i*5)
				expectedRPM := uint16(11000 + i*50)
				expectedTemp := uint16(90 + i)

				actualSpeed := pkt.CarTelemetryData[i].Speed
				actualRPM := pkt.CarTelemetryData[i].EngineRPM
				actualTemp := pkt.CarTelemetryData[i].EngineTemperature

				if actualSpeed != expectedSpeed {
					t.Errorf("Car %d: expected speed %d km/h, got %d km/h", i, expectedSpeed, actualSpeed)
				}
				if actualRPM != expectedRPM {
					t.Errorf("Car %d: expected RPM %d, got %d", i, expectedRPM, actualRPM)
				}
				if actualTemp != expectedTemp {
					t.Errorf("Car %d: expected temp %d, got %d", i, expectedTemp, actualTemp)
				}
			}
		})
	}
}
