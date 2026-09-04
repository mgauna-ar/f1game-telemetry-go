package packets

import (
	"bytes"
	"encoding/binary"
	"math"
	"testing"
)

// Helper to create a valid packet header
func createHeader(packetID uint8, format uint16) PacketHeader {
	year := uint8(25)
	if format >= PacketFormat2026 {
		year = 26
	}
	return PacketHeader{
		PacketFormat:            format,
		GameYear:                year,
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
			name:    "Valid header F1 2025",
			data:    serializeHeader(createHeader(PacketIDMotion, PacketFormat2025)),
			wantErr: false,
			wantID:  PacketIDMotion,
		},
		{
			name:    "Valid header F1 2026",
			data:    serializeHeader(createHeader(PacketIDCarTelemetry2, PacketFormat2026)),
			wantErr: false,
			wantID:  PacketIDCarTelemetry2,
		},
		{
			name:    "Data too short",
			data:    make([]byte, 10),
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

func TestDecodeMotion2025And2026(t *testing.T) {
	formats := []struct {
		name         string
		format       uint16
		numCars      int
		expectedSize int
	}{
		{"F1 2025 (22 cars, 1349 bytes)", PacketFormat2025, 22, 1349},
		{"F1 2026 (24 cars, 1325 bytes)", PacketFormat2026, 24, 1325},
	}

	for _, tt := range formats {
		t.Run(tt.name, func(t *testing.T) {
			buf := new(bytes.Buffer)
			hdr := createHeader(PacketIDMotion, tt.format)
			_ = binary.Write(buf, binary.LittleEndian, &hdr)

			for i := 0; i < tt.numCars; i++ {
				_ = binary.Write(buf, binary.LittleEndian, float32(100.0+float32(i))) // X
				_ = binary.Write(buf, binary.LittleEndian, float32(5.0))              // Y
				_ = binary.Write(buf, binary.LittleEndian, float32(200.0))            // Z
				_ = binary.Write(buf, binary.LittleEndian, float32(30.0))             // VelX
				_ = binary.Write(buf, binary.LittleEndian, float32(0.0))              // VelY
				_ = binary.Write(buf, binary.LittleEndian, float32(-30.0))            // VelZ
				_ = binary.Write(buf, binary.LittleEndian, int16(1000))               // FwdX
				_ = binary.Write(buf, binary.LittleEndian, int16(0))                  // FwdY
				_ = binary.Write(buf, binary.LittleEndian, int16(0))                  // FwdZ
				_ = binary.Write(buf, binary.LittleEndian, int16(0))                  // RgtX
				_ = binary.Write(buf, binary.LittleEndian, int16(1000))               // RgtY
				_ = binary.Write(buf, binary.LittleEndian, int16(0))                  // RgtZ

				if tt.format >= PacketFormat2026 {
					_ = binary.Write(buf, binary.LittleEndian, int16(1500)) // Lat G * 1000 -> 1.5
					_ = binary.Write(buf, binary.LittleEndian, int16(-500)) // Long G * 1000 -> -0.5
					_ = binary.Write(buf, binary.LittleEndian, int16(100))  // Vert G * 1000 -> 0.1
				} else {
					_ = binary.Write(buf, binary.LittleEndian, float32(1.5))  // Lat G
					_ = binary.Write(buf, binary.LittleEndian, float32(-0.5)) // Long G
					_ = binary.Write(buf, binary.LittleEndian, float32(0.1))  // Vert G
				}

				_ = binary.Write(buf, binary.LittleEndian, float32(0.5)) // Yaw
				_ = binary.Write(buf, binary.LittleEndian, float32(0.1)) // Pitch
				_ = binary.Write(buf, binary.LittleEndian, float32(0.2)) // Roll
			}

			if buf.Len() != tt.expectedSize {
				t.Fatalf("Constructed buffer size %d does not match expected spec size %d", buf.Len(), tt.expectedSize)
			}

			pkt, err := DecodeMotion(hdr, buf.Bytes()[HeaderSize:])
			if err != nil {
				t.Fatalf("DecodeMotion failed: %v", err)
			}

			if pkt.CarMotionData[0].WorldPositionX != 100.0 {
				t.Errorf("Car 0 WorldPositionX expected 100.0, got %f", pkt.CarMotionData[0].WorldPositionX)
			}
			if pkt.CarMotionData[0].GForceLateral != 1.5 {
				t.Errorf("Car 0 GForceLateral expected 1.5, got %f", pkt.CarMotionData[0].GForceLateral)
			}
			if pkt.CarMotionData[0].GForceLongitudinal != -0.5 {
				t.Errorf("Car 0 GForceLongitudinal expected -0.5, got %f", pkt.CarMotionData[0].GForceLongitudinal)
			}
			if pkt.CarMotionData[tt.numCars-1].WorldPositionX != float32(100.0+float32(tt.numCars-1)) {
				t.Errorf("Last car WorldPositionX expected %f, got %f", float32(100.0+float32(tt.numCars-1)), pkt.CarMotionData[tt.numCars-1].WorldPositionX)
			}
		})
	}
}

func TestDecodeSession2025And2026(t *testing.T) {
	formats := []struct {
		name         string
		format       uint16
		expectedSize int
	}{
		{"F1 2025 (753 bytes)", PacketFormat2025, 753},
		{"F1 2026 (926 bytes)", PacketFormat2026, 926},
	}

	for _, tt := range formats {
		t.Run(tt.name, func(t *testing.T) {
			buf := new(bytes.Buffer)
			hdr := createHeader(PacketIDSession, tt.format)
			_ = binary.Write(buf, binary.LittleEndian, &hdr)

			_ = binary.Write(buf, binary.LittleEndian, uint8(0))     // Weather: Clear
			_ = binary.Write(buf, binary.LittleEndian, int8(35))     // TrackTemp
			_ = binary.Write(buf, binary.LittleEndian, int8(25))     // AirTemp
			_ = binary.Write(buf, binary.LittleEndian, uint8(58))    // TotalLaps
			_ = binary.Write(buf, binary.LittleEndian, uint16(5300)) // TrackLength
			_ = binary.Write(buf, binary.LittleEndian, uint8(15))    // SessionType: Race
			_ = binary.Write(buf, binary.LittleEndian, int8(0))      // TrackId: Melbourne
			_ = binary.Write(buf, binary.LittleEndian, uint8(0))     // Formula
			_ = binary.Write(buf, binary.LittleEndian, uint16(3600)) // TimeLeft
			_ = binary.Write(buf, binary.LittleEndian, uint16(7200)) // Duration
			_ = binary.Write(buf, binary.LittleEndian, uint8(60))    // PitSpeedLimit
			_ = binary.Write(buf, binary.LittleEndian, uint8(0))     // GamePaused
			_ = binary.Write(buf, binary.LittleEndian, uint8(0))     // IsSpectating
			_ = binary.Write(buf, binary.LittleEndian, uint8(0))     // SpectatorCarIndex
			_ = binary.Write(buf, binary.LittleEndian, uint8(1))     // SliPro
			_ = binary.Write(buf, binary.LittleEndian, uint8(1))     // NumMarshalZones

			var mzones [21]MarshalZone
			mzones[0] = MarshalZone{ZoneStart: 0.1, ZoneFlag: 1}
			_ = binary.Write(buf, binary.LittleEndian, mzones)

			_ = binary.Write(buf, binary.LittleEndian, uint8(0)) // SafetyCarStatus
			_ = binary.Write(buf, binary.LittleEndian, uint8(0)) // NetworkGame
			_ = binary.Write(buf, binary.LittleEndian, uint8(1)) // NumWeatherForecastSamples

			var wfs [64]WeatherForecastSample
			wfs[0] = WeatherForecastSample{SessionType: 15, TimeOffset: 0, Weather: 0, TrackTemperature: 35, AirTemperature: 25}
			_ = binary.Write(buf, binary.LittleEndian, wfs)

			_ = binary.Write(buf, binary.LittleEndian, uint8(0))    // ForecastAccuracy
			_ = binary.Write(buf, binary.LittleEndian, uint8(95))   // AIDifficulty
			_ = binary.Write(buf, binary.LittleEndian, uint32(111)) // SeasonLink
			_ = binary.Write(buf, binary.LittleEndian, uint32(222)) // WeekendLink
			_ = binary.Write(buf, binary.LittleEndian, uint32(333)) // SessionLink
			_ = binary.Write(buf, binary.LittleEndian, uint8(15))   // IdealPit
			_ = binary.Write(buf, binary.LittleEndian, uint8(20))   // LatestPit
			_ = binary.Write(buf, binary.LittleEndian, uint8(5))    // RejoinPos
			_ = binary.Write(buf, binary.LittleEndian, uint8(0))    // SteeringAssist
			_ = binary.Write(buf, binary.LittleEndian, uint8(0))    // BrakingAssist
			_ = binary.Write(buf, binary.LittleEndian, uint8(1))    // GearboxAssist
			_ = binary.Write(buf, binary.LittleEndian, uint8(0))    // PitAssist
			_ = binary.Write(buf, binary.LittleEndian, uint8(0))    // PitReleaseAssist
			_ = binary.Write(buf, binary.LittleEndian, uint8(0))    // ERSAssist
			_ = binary.Write(buf, binary.LittleEndian, uint8(0))    // DRSAssist
			_ = binary.Write(buf, binary.LittleEndian, uint8(0))    // DynRacingLine
			_ = binary.Write(buf, binary.LittleEndian, uint8(0))    // DynRacingLineType
			_ = binary.Write(buf, binary.LittleEndian, uint8(0))    // GameMode
			_ = binary.Write(buf, binary.LittleEndian, uint8(0))    // RuleSet
			_ = binary.Write(buf, binary.LittleEndian, uint32(720)) // TimeOfDay
			_ = binary.Write(buf, binary.LittleEndian, uint8(7))    // SessionLength
			_ = binary.Write(buf, binary.LittleEndian, uint8(1))    // SpeedUnitsLead
			_ = binary.Write(buf, binary.LittleEndian, uint8(0))    // TempUnitsLead
			_ = binary.Write(buf, binary.LittleEndian, uint8(1))    // SpeedUnitsSec
			_ = binary.Write(buf, binary.LittleEndian, uint8(0))    // TempUnitsSec
			_ = binary.Write(buf, binary.LittleEndian, uint8(0))    // NumSC
			_ = binary.Write(buf, binary.LittleEndian, uint8(0))    // NumVSC
			_ = binary.Write(buf, binary.LittleEndian, uint8(0))    // NumRedFlags
			_ = binary.Write(buf, binary.LittleEndian, uint8(0))    // EqualCarPerf
			_ = binary.Write(buf, binary.LittleEndian, uint8(0))    // RecoveryMode
			_ = binary.Write(buf, binary.LittleEndian, uint8(3))    // FlashbackLimit
			_ = binary.Write(buf, binary.LittleEndian, uint8(1))    // SurfaceType
			_ = binary.Write(buf, binary.LittleEndian, uint8(0))    // LowFuelMode
			_ = binary.Write(buf, binary.LittleEndian, uint8(0))    // RaceStarts
			_ = binary.Write(buf, binary.LittleEndian, uint8(1))    // TyreTemp
			_ = binary.Write(buf, binary.LittleEndian, uint8(1))    // PitLaneTyreSim
			_ = binary.Write(buf, binary.LittleEndian, uint8(2))    // CarDamage
			_ = binary.Write(buf, binary.LittleEndian, uint8(1))    // CarDamageRate
			_ = binary.Write(buf, binary.LittleEndian, uint8(2))    // Collisions
			_ = binary.Write(buf, binary.LittleEndian, uint8(0))    // CollisionsFirstLap
			_ = binary.Write(buf, binary.LittleEndian, uint8(0))    // MPUnsafePit
			_ = binary.Write(buf, binary.LittleEndian, uint8(0))    // MPOffGriefing
			_ = binary.Write(buf, binary.LittleEndian, uint8(1))    // CornerCutting
			_ = binary.Write(buf, binary.LittleEndian, uint8(1))    // ParcFerme
			_ = binary.Write(buf, binary.LittleEndian, uint8(2))    // PitStopExp
			_ = binary.Write(buf, binary.LittleEndian, uint8(2))    // SC
			_ = binary.Write(buf, binary.LittleEndian, uint8(1))    // SCExp
			_ = binary.Write(buf, binary.LittleEndian, uint8(1))    // FormationLap
			_ = binary.Write(buf, binary.LittleEndian, uint8(1))    // FormationLapExp
			_ = binary.Write(buf, binary.LittleEndian, uint8(2))    // RedFlags
			_ = binary.Write(buf, binary.LittleEndian, uint8(0))    // AffectsLicenceSolo
			_ = binary.Write(buf, binary.LittleEndian, uint8(0))    // AffectsLicenceMP
			_ = binary.Write(buf, binary.LittleEndian, uint8(3))    // NumSessionsInWeekend

			var ws [12]uint8
			ws[0] = 1
			ws[1] = 5
			ws[2] = 15
			_ = binary.Write(buf, binary.LittleEndian, ws)

			_ = binary.Write(buf, binary.LittleEndian, float32(1800.0)) // Sector2Start
			_ = binary.Write(buf, binary.LittleEndian, float32(3600.0)) // Sector3Start

			if tt.format >= PacketFormat2026 {
				_ = binary.Write(buf, binary.LittleEndian, uint8(0)) // ActiveAeroStatus: Full
				_ = binary.Write(buf, binary.LittleEndian, uint8(2)) // NumActiveAeroZonesFull

				var aazf [8]ActiveAeroZone
				aazf[0] = ActiveAeroZone{ZoneStart: 0.1, ZoneEnd: 0.25}
				aazf[1] = ActiveAeroZone{ZoneStart: 0.6, ZoneEnd: 0.8}
				_ = binary.Write(buf, binary.LittleEndian, aazf)

				_ = binary.Write(buf, binary.LittleEndian, uint8(0)) // NumActiveAeroZonesPartial
				var aazp [8]ActiveAeroZone
				_ = binary.Write(buf, binary.LittleEndian, aazp)

				_ = binary.Write(buf, binary.LittleEndian, uint8(2)) // NumDRSZones
				var drsz [4]DRSZone
				drsz[0] = DRSZone{ZoneStart: 0.1, ZoneEnd: 0.25}
				drsz[1] = DRSZone{ZoneStart: 0.6, ZoneEnd: 0.8}
				_ = binary.Write(buf, binary.LittleEndian, drsz)

				_ = binary.Write(buf, binary.LittleEndian, float32(0.24)) // StartReactionTime
				_ = binary.Write(buf, binary.LittleEndian, uint8(1))      // AntiLockBrakesAssist
				_ = binary.Write(buf, binary.LittleEndian, uint8(1))      // TractionControlAssist
				_ = binary.Write(buf, binary.LittleEndian, uint8(0))      // DynRacingLineHiVis
				_ = binary.Write(buf, binary.LittleEndian, uint8(0))      // DynRacingLineColourBlind
				_ = binary.Write(buf, binary.LittleEndian, uint8(0))      // RecurringRewindPrompt
			}

			if buf.Len() != tt.expectedSize {
				t.Fatalf("Constructed session buffer size %d does not match expected spec size %d", buf.Len(), tt.expectedSize)
			}

			pkt, err := DecodeSession(hdr, buf.Bytes()[HeaderSize:])
			if err != nil {
				t.Fatalf("DecodeSession failed: %v", err)
			}

			if pkt.TotalLaps != 58 {
				t.Errorf("Expected TotalLaps 58, got %d", pkt.TotalLaps)
			}
			if pkt.AIDifficulty != 95 {
				t.Errorf("Expected AIDifficulty 95, got %d", pkt.AIDifficulty)
			}
			if pkt.Sector2LapDistanceStart != 1800.0 {
				t.Errorf("Expected Sector2LapDistanceStart 1800.0, got %f", pkt.Sector2LapDistanceStart)
			}
			if tt.format >= PacketFormat2026 {
				if pkt.NumActiveAeroZonesFull != 2 {
					t.Errorf("Expected NumActiveAeroZonesFull 2, got %d", pkt.NumActiveAeroZonesFull)
				}
				if pkt.ActiveAeroZonesFull[0].ZoneStart != 0.1 {
					t.Errorf("Expected ActiveAeroZone[0].ZoneStart 0.1, got %f", pkt.ActiveAeroZonesFull[0].ZoneStart)
				}
			}
		})
	}
}

func TestDecodeParticipants2025And2026(t *testing.T) {
	formats := []struct {
		name         string
		format       uint16
		expectedCars int
		expectedSize int
	}{
		{"F1 2025 (22 cars, 1284 bytes)", PacketFormat2025, 22, 1284},
		{"F1 2026 (24 cars, 1470 bytes)", PacketFormat2026, 24, 1470},
	}

	for _, tt := range formats {
		t.Run(tt.name, func(t *testing.T) {
			buf := new(bytes.Buffer)
			hdr := createHeader(PacketIDParticipants, tt.format)
			_ = binary.Write(buf, binary.LittleEndian, &hdr)

			numCars := uint8(tt.expectedCars)
			_ = binary.Write(buf, binary.LittleEndian, &numCars)

			for i := 0; i < tt.expectedCars; i++ {
				var name [32]byte
				copy(name[:], "DriverName")

				if tt.format >= PacketFormat2026 {
					_ = binary.Write(buf, binary.LittleEndian, uint8(1))      // AIControlled
					_ = binary.Write(buf, binary.LittleEndian, uint16(100+i)) // DriverId (uint16)
					_ = binary.Write(buf, binary.LittleEndian, uint16(0))     // NetworkId (uint16)
					_ = binary.Write(buf, binary.LittleEndian, uint16(476+i)) // TeamId (uint16)
					_ = binary.Write(buf, binary.LittleEndian, uint8(0))      // MyTeam
					_ = binary.Write(buf, binary.LittleEndian, uint8(i+1))    // RaceNumber
					_ = binary.Write(buf, binary.LittleEndian, uint8(10))     // Nationality
					buf.Write(name[:])
					_ = binary.Write(buf, binary.LittleEndian, uint8(1))     // YourTelemetry
					_ = binary.Write(buf, binary.LittleEndian, uint8(1))     // ShowOnlineNames
					_ = binary.Write(buf, binary.LittleEndian, uint16(1000)) // TechLevel
					_ = binary.Write(buf, binary.LittleEndian, uint8(1))     // Platform
					_ = binary.Write(buf, binary.LittleEndian, uint8(4))     // NumColours
					_ = binary.Write(buf, binary.LittleEndian, [4]LiveryColour{
						{Red: 255, Green: 0, Blue: 0},
						{Red: 0, Green: 255, Blue: 0},
						{Red: 0, Green: 0, Blue: 255},
						{Red: 255, Green: 255, Blue: 255},
					})
				} else {
					_ = binary.Write(buf, binary.LittleEndian, uint8(1))   // AIControlled
					_ = binary.Write(buf, binary.LittleEndian, uint8(i+1)) // DriverId (uint8)
					_ = binary.Write(buf, binary.LittleEndian, uint8(0))   // NetworkId (uint8)
					_ = binary.Write(buf, binary.LittleEndian, uint8(i))   // TeamId (uint8)
					_ = binary.Write(buf, binary.LittleEndian, uint8(0))   // MyTeam
					_ = binary.Write(buf, binary.LittleEndian, uint8(i+1)) // RaceNumber
					_ = binary.Write(buf, binary.LittleEndian, uint8(10))  // Nationality
					buf.Write(name[:])
					_ = binary.Write(buf, binary.LittleEndian, uint8(1))     // YourTelemetry
					_ = binary.Write(buf, binary.LittleEndian, uint8(1))     // ShowOnlineNames
					_ = binary.Write(buf, binary.LittleEndian, uint16(1000)) // TechLevel
					_ = binary.Write(buf, binary.LittleEndian, uint8(1))     // Platform
					_ = binary.Write(buf, binary.LittleEndian, uint8(4))     // NumColours
					_ = binary.Write(buf, binary.LittleEndian, [4]LiveryColour{
						{Red: 255, Green: 0, Blue: 0},
						{Red: 0, Green: 255, Blue: 0},
						{Red: 0, Green: 0, Blue: 255},
						{Red: 255, Green: 255, Blue: 255},
					})
				}
			}

			if buf.Len() != tt.expectedSize {
				t.Fatalf("Constructed participants buffer size %d does not match expected spec size %d", buf.Len(), tt.expectedSize)
			}

			pkt, err := DecodeParticipants(hdr, buf.Bytes()[HeaderSize:])
			if err != nil {
				t.Fatalf("DecodeParticipants failed: %v", err)
			}

			if pkt.NumActiveCars != numCars {
				t.Errorf("Expected NumActiveCars %d, got %d", numCars, pkt.NumActiveCars)
			}
			if pkt.Participants[0].NameString() != "DriverName" {
				t.Errorf("Expected driver name DriverName, got %q", pkt.Participants[0].NameString())
			}
			if tt.format >= PacketFormat2026 {
				if pkt.Participants[0].DriverId != 100 {
					t.Errorf("Expected DriverId 100, got %d", pkt.Participants[0].DriverId)
				}
				if pkt.Participants[0].TeamId != 476 {
					t.Errorf("Expected TeamId 476, got %d", pkt.Participants[0].TeamId)
				}
			}
		})
	}
}

func TestDecodeCarTelemetry2(t *testing.T) {
	buf := new(bytes.Buffer)
	hdr := createHeader(PacketIDCarTelemetry2, PacketFormat2026)
	_ = binary.Write(buf, binary.LittleEndian, &hdr)

	for i := 0; i < 24; i++ {
		t2 := CarTelemetry2Data{
			ActiveAeroMode:               uint8(i % 2),
			ActiveAeroAvailable:          1,
			ActiveAeroActivationDistance: uint16(100 * i),
			OvertakeAvailable:            1,
			OvertakeActive:               uint8((i + 1) % 2),
			OvertakeActivationDistance:   0,
			Regulations2026:              1,
			DrivingWrongWay:              0,
		}
		_ = binary.Write(buf, binary.LittleEndian, &t2)
	}

	if buf.Len() != 269 {
		t.Fatalf("Expected CarTelemetry2 buffer size 269, got %d", buf.Len())
	}

	pkt, err := DecodeCarTelemetry2(hdr, buf.Bytes()[HeaderSize:])
	if err != nil {
		t.Fatalf("DecodeCarTelemetry2 failed: %v", err)
	}

	if pkt.CarTelemetry2Data[0].ActiveAeroMode != 0 {
		t.Errorf("Car 0 ActiveAeroMode expected 0, got %d", pkt.CarTelemetry2Data[0].ActiveAeroMode)
	}
	if pkt.CarTelemetry2Data[1].ActiveAeroMode != 1 {
		t.Errorf("Car 1 ActiveAeroMode expected 1, got %d", pkt.CarTelemetry2Data[1].ActiveAeroMode)
	}
	if pkt.CarTelemetry2Data[1].ActiveAeroActivationDistance != 100 {
		t.Errorf("Car 1 ActiveAeroActivationDistance expected 100, got %d", pkt.CarTelemetry2Data[1].ActiveAeroActivationDistance)
	}
}

func TestDecodeCarSetup2025And2026(t *testing.T) {
	formats := []struct {
		name         string
		format       uint16
		numCars      int
		expectedSize int
	}{
		{"F1 2025 (22 cars, 1133 bytes)", PacketFormat2025, 22, 1133},
		{"F1 2026 (24 cars, 1233 bytes)", PacketFormat2026, 24, 1233},
	}

	for _, tt := range formats {
		t.Run(tt.name, func(t *testing.T) {
			buf := new(bytes.Buffer)
			hdr := createHeader(PacketIDCarSetup, tt.format)
			_ = binary.Write(buf, binary.LittleEndian, &hdr)

			for i := 0; i < tt.numCars; i++ {
				_ = binary.Write(buf, binary.LittleEndian, uint8(10+i))   // FrontWing
				_ = binary.Write(buf, binary.LittleEndian, uint8(8+i))    // RearWing
				_ = binary.Write(buf, binary.LittleEndian, uint8(60))     // OnThrottle
				_ = binary.Write(buf, binary.LittleEndian, uint8(50))     // OffThrottle
				_ = binary.Write(buf, binary.LittleEndian, float32(-3.5)) // FrontCamber
				_ = binary.Write(buf, binary.LittleEndian, float32(-1.5)) // RearCamber
				_ = binary.Write(buf, binary.LittleEndian, float32(0.05)) // FrontToe
				_ = binary.Write(buf, binary.LittleEndian, float32(0.20)) // RearToe
				_ = binary.Write(buf, binary.LittleEndian, uint8(8))      // FrontSuspension
				_ = binary.Write(buf, binary.LittleEndian, uint8(6))      // RearSuspension
				_ = binary.Write(buf, binary.LittleEndian, uint8(7))      // FrontAntiRollBar
				_ = binary.Write(buf, binary.LittleEndian, uint8(5))      // RearAntiRollBar
				_ = binary.Write(buf, binary.LittleEndian, uint8(33))     // FrontSuspensionHeight
				_ = binary.Write(buf, binary.LittleEndian, uint8(38))     // RearSuspensionHeight
				_ = binary.Write(buf, binary.LittleEndian, uint8(100))    // BrakePressure
				_ = binary.Write(buf, binary.LittleEndian, uint8(56))     // BrakeBias
				_ = binary.Write(buf, binary.LittleEndian, uint8(2))      // EngineBraking (Byte offset 28!)
				_ = binary.Write(buf, binary.LittleEndian, float32(21.5)) // RearLeftTyrePressure
				_ = binary.Write(buf, binary.LittleEndian, float32(21.5)) // RearRightTyrePressure
				_ = binary.Write(buf, binary.LittleEndian, float32(23.5)) // FrontLeftTyrePressure
				_ = binary.Write(buf, binary.LittleEndian, float32(23.5)) // FrontRightTyrePressure
				_ = binary.Write(buf, binary.LittleEndian, uint8(0))      // Ballast
				_ = binary.Write(buf, binary.LittleEndian, float32(45.0)) // FuelLoad
			}

			// Trailer (NextFrontWingValue)
			_ = binary.Write(buf, binary.LittleEndian, float32(12.0))

			if buf.Len() != tt.expectedSize {
				t.Fatalf("Constructed car setup buffer size %d does not match expected %d", buf.Len(), tt.expectedSize)
			}

			pkt, err := DecodeCarSetup(hdr, buf.Bytes()[HeaderSize:])
			if err != nil {
				t.Fatalf("DecodeCarSetup failed: %v", err)
			}

			if pkt.CarSetupData[0].FrontWing != 10 {
				t.Errorf("Car 0 FrontWing expected 10, got %d", pkt.CarSetupData[0].FrontWing)
			}
			if pkt.CarSetupData[0].EngineBraking != 2 {
				t.Errorf("Car 0 EngineBraking expected 2, got %d", pkt.CarSetupData[0].EngineBraking)
			}
			if pkt.CarSetupData[0].RearLeftTyrePressure != 21.5 {
				t.Errorf("Car 0 RearLeftTyrePressure expected 21.5, got %f", pkt.CarSetupData[0].RearLeftTyrePressure)
			}
			if pkt.NextFrontWingValue != 12.0 {
				t.Errorf("NextFrontWingValue expected 12.0, got %f", pkt.NextFrontWingValue)
			}
		})
	}
}

func TestDecodeCarTelemetry2025And2026(t *testing.T) {
	formats := []struct {
		name         string
		format       uint16
		numCars      int
		expectedSize int
	}{
		{"F1 2025 (22 cars, 1352 bytes)", PacketFormat2025, 22, 1352},
		{"F1 2026 (24 cars, 1448 bytes)", PacketFormat2026, 24, 1448},
	}

	for _, tt := range formats {
		t.Run(tt.name, func(t *testing.T) {
			buf := new(bytes.Buffer)
			hdr := createHeader(PacketIDCarTelemetry, tt.format)
			_ = binary.Write(buf, binary.LittleEndian, &hdr)

			for i := 0; i < tt.numCars; i++ {
				_ = binary.Write(buf, binary.LittleEndian, uint16(250+i))                 // Speed
				_ = binary.Write(buf, binary.LittleEndian, float32(0.95))                 // Throttle
				_ = binary.Write(buf, binary.LittleEndian, float32(0.0))                  // Steer
				_ = binary.Write(buf, binary.LittleEndian, float32(0.0))                  // Brake
				_ = binary.Write(buf, binary.LittleEndian, uint8(0))                      // Clutch
				_ = binary.Write(buf, binary.LittleEndian, int8(7))                       // Gear
				_ = binary.Write(buf, binary.LittleEndian, uint16(11500))                 // EngineRPM
				_ = binary.Write(buf, binary.LittleEndian, uint8(1))                      // DRS
				_ = binary.Write(buf, binary.LittleEndian, uint8(85))                     // RevLightsPercent
				_ = binary.Write(buf, binary.LittleEndian, uint16(0x0FFF))                // RevLightsBitValue
				_ = binary.Write(buf, binary.LittleEndian, [4]uint16{350, 350, 400, 400}) // BrakesTemp
				_ = binary.Write(buf, binary.LittleEndian, [4]uint8{95, 95, 98, 98})      // TyresSurfaceTemp
				_ = binary.Write(buf, binary.LittleEndian, [4]uint8{90, 90, 92, 92})      // TyresInnerTemp

				if tt.format >= PacketFormat2026 {
					_ = binary.Write(buf, binary.LittleEndian, uint8(95)) // EngineTemp (uint8)
				} else {
					_ = binary.Write(buf, binary.LittleEndian, uint16(95)) // EngineTemp (uint16)
				}

				_ = binary.Write(buf, binary.LittleEndian, [4]float32{22.0, 22.0, 23.0, 23.0}) // Pressure
				_ = binary.Write(buf, binary.LittleEndian, [4]uint8{0, 0, 0, 0})               // SurfaceType
			}

			// Trailer
			_ = binary.Write(buf, binary.LittleEndian, uint8(255))
			_ = binary.Write(buf, binary.LittleEndian, uint8(255))
			_ = binary.Write(buf, binary.LittleEndian, int8(8))

			if buf.Len() != tt.expectedSize {
				t.Fatalf("Constructed car telemetry buffer size %d does not match expected %d", buf.Len(), tt.expectedSize)
			}

			pkt, err := DecodeCarTelemetry(hdr, buf.Bytes()[HeaderSize:])
			if err != nil {
				t.Fatalf("DecodeCarTelemetry failed: %v", err)
			}

			if pkt.CarTelemetryData[0].Speed != 250 {
				t.Errorf("Car 0 Speed expected 250, got %d", pkt.CarTelemetryData[0].Speed)
			}
			if pkt.CarTelemetryData[0].EngineTemperature != 95 {
				t.Errorf("Car 0 EngineTemperature expected 95, got %d", pkt.CarTelemetryData[0].EngineTemperature)
			}
			if pkt.CarTelemetryData[0].TyresPressure[0] != 22.0 {
				t.Errorf("Car 0 TyresPressure[0] expected 22.0, got %f", pkt.CarTelemetryData[0].TyresPressure[0])
			}
		})
	}
}

func TestDecodeCarStatus2025And2026(t *testing.T) {
	formats := []struct {
		name         string
		format       uint16
		numCars      int
		expectedSize int
	}{
		{"F1 2025 (22 cars, 1239 bytes)", PacketFormat2025, 22, 1239},
		{"F1 2026 (24 cars, 1445 bytes)", PacketFormat2026, 24, 1445},
	}

	for _, tt := range formats {
		t.Run(tt.name, func(t *testing.T) {
			buf := new(bytes.Buffer)
			hdr := createHeader(PacketIDCarStatus, tt.format)
			_ = binary.Write(buf, binary.LittleEndian, &hdr)

			for i := 0; i < tt.numCars; i++ {
				_ = binary.Write(buf, binary.LittleEndian, uint8(1))           // TractionControl
				_ = binary.Write(buf, binary.LittleEndian, uint8(1))           // AntiLockBrakes
				_ = binary.Write(buf, binary.LittleEndian, uint8(1))           // FuelMix
				_ = binary.Write(buf, binary.LittleEndian, uint8(56))          // FrontBrakeBias
				_ = binary.Write(buf, binary.LittleEndian, uint8(0))           // PitLimiterStatus
				_ = binary.Write(buf, binary.LittleEndian, float32(50.0))      // FuelInTank
				_ = binary.Write(buf, binary.LittleEndian, float32(110.0))     // FuelCapacity
				_ = binary.Write(buf, binary.LittleEndian, float32(25.5))      // FuelRemainingLaps
				_ = binary.Write(buf, binary.LittleEndian, uint16(12500))      // MaxRPM
				_ = binary.Write(buf, binary.LittleEndian, uint16(4000))       // IdleRPM
				_ = binary.Write(buf, binary.LittleEndian, uint8(8))           // MaxGears
				_ = binary.Write(buf, binary.LittleEndian, uint8(1))           // DRSAllowed
				_ = binary.Write(buf, binary.LittleEndian, uint16(0))          // DRSActivationDistance
				_ = binary.Write(buf, binary.LittleEndian, uint8(18))          // ActualTyreCompound: C3
				_ = binary.Write(buf, binary.LittleEndian, uint8(16))          // VisualTyreCompound: Soft
				_ = binary.Write(buf, binary.LittleEndian, uint8(3))           // TyresAgeLaps
				_ = binary.Write(buf, binary.LittleEndian, int8(0))            // VehicleFIAFlags
				_ = binary.Write(buf, binary.LittleEndian, float32(500000.0))  // EnginePowerICE
				_ = binary.Write(buf, binary.LittleEndian, float32(120000.0))  // EnginePowerMGUK
				_ = binary.Write(buf, binary.LittleEndian, float32(3500000.0)) // ERSStoreEnergy
				_ = binary.Write(buf, binary.LittleEndian, uint8(2))           // ERSDeployMode: Hotlap
				_ = binary.Write(buf, binary.LittleEndian, float32(100000.0))  // ERSHarvestedMGUK
				_ = binary.Write(buf, binary.LittleEndian, float32(50000.0))   // ERSHarvestedMGUH

				if tt.format >= PacketFormat2026 {
					_ = binary.Write(buf, binary.LittleEndian, float32(2000000.0)) // ERSHarvestLimitPerLap
				}

				_ = binary.Write(buf, binary.LittleEndian, float32(400000.0)) // ERSDeployedThisLap
				_ = binary.Write(buf, binary.LittleEndian, uint8(0))          // NetworkPaused
			}

			if buf.Len() != tt.expectedSize {
				t.Fatalf("Constructed car status buffer size %d does not match expected %d", buf.Len(), tt.expectedSize)
			}

			pkt, err := DecodeCarStatus(hdr, buf.Bytes()[HeaderSize:])
			if err != nil {
				t.Fatalf("DecodeCarStatus failed: %v", err)
			}

			if pkt.CarStatusData[0].FuelInTank != 50.0 {
				t.Errorf("Car 0 FuelInTank expected 50.0, got %f", pkt.CarStatusData[0].FuelInTank)
			}
			if pkt.CarStatusData[0].ERSDeployMode != 2 {
				t.Errorf("Car 0 ERSDeployMode expected 2, got %d", pkt.CarStatusData[0].ERSDeployMode)
			}
			if tt.format >= PacketFormat2026 {
				if pkt.CarStatusData[0].ERSHarvestLimitPerLap != 2000000.0 {
					t.Errorf("Car 0 ERSHarvestLimitPerLap expected 2000000.0, got %f", pkt.CarStatusData[0].ERSHarvestLimitPerLap)
				}
			}
		})
	}
}

func TestDecodeFinalClassification2025And2026(t *testing.T) {
	formats := []struct {
		name         string
		format       uint16
		expectedCars int
		expectedSize int
	}{
		{"F1 2025 (22 cars, 1042 bytes)", PacketFormat2025, 22, 1042},
		{"F1 2026 (24 cars, 1134 bytes)", PacketFormat2026, 24, 1134},
	}

	for _, tt := range formats {
		t.Run(tt.name, func(t *testing.T) {
			buf := new(bytes.Buffer)
			hdr := createHeader(PacketIDFinalClassification, tt.format)
			_ = binary.Write(buf, binary.LittleEndian, &hdr)

			numCars := uint8(tt.expectedCars)
			_ = binary.Write(buf, binary.LittleEndian, &numCars)

			for i := 0; i < tt.expectedCars; i++ {
				_ = binary.Write(buf, binary.LittleEndian, uint8(i+1))                         // Position
				_ = binary.Write(buf, binary.LittleEndian, uint8(58))                          // NumLaps
				_ = binary.Write(buf, binary.LittleEndian, uint8(i+1))                         // GridPosition
				_ = binary.Write(buf, binary.LittleEndian, uint8(25))                          // Points
				_ = binary.Write(buf, binary.LittleEndian, uint8(2))                           // NumPitStops
				_ = binary.Write(buf, binary.LittleEndian, uint8(3))                           // ResultStatus: Finished
				_ = binary.Write(buf, binary.LittleEndian, uint8(2))                           // ResultReason: Finished (Byte offset 6!)
				_ = binary.Write(buf, binary.LittleEndian, uint32(84250))                      // BestLapTimeInMS
				_ = binary.Write(buf, binary.LittleEndian, float64(5120.450))                  // TotalRaceTime
				_ = binary.Write(buf, binary.LittleEndian, uint8(0))                           // PenaltiesTime
				_ = binary.Write(buf, binary.LittleEndian, uint8(0))                           // NumPenalties
				_ = binary.Write(buf, binary.LittleEndian, uint8(2))                           // NumTyreStints
				_ = binary.Write(buf, binary.LittleEndian, [8]uint8{18, 17, 0, 0, 0, 0, 0, 0}) // Actual
				_ = binary.Write(buf, binary.LittleEndian, [8]uint8{16, 17, 0, 0, 0, 0, 0, 0}) // Visual
				_ = binary.Write(buf, binary.LittleEndian, [8]uint8{25, 58, 0, 0, 0, 0, 0, 0}) // EndLaps
			}

			if buf.Len() != tt.expectedSize {
				t.Fatalf("Constructed classification buffer size %d does not match expected %d", buf.Len(), tt.expectedSize)
			}

			pkt, err := DecodeFinalClassification(hdr, buf.Bytes()[HeaderSize:])
			if err != nil {
				t.Fatalf("DecodeFinalClassification failed: %v", err)
			}

			if pkt.NumCars != numCars {
				t.Errorf("Expected NumCars %d, got %d", numCars, pkt.NumCars)
			}
			if pkt.ClassificationData[0].Position != 1 {
				t.Errorf("Car 0 Position expected 1, got %d", pkt.ClassificationData[0].Position)
			}
			if pkt.ClassificationData[0].ResultReason != 2 {
				t.Errorf("Car 0 ResultReason expected 2, got %d", pkt.ClassificationData[0].ResultReason)
			}
			if pkt.ClassificationData[0].BestLapTimeInMS != 84250 {
				t.Errorf("Car 0 BestLapTimeInMS expected 84250, got %d", pkt.ClassificationData[0].BestLapTimeInMS)
			}
		})
	}
}

func TestDecodeCarDamage2025And2026(t *testing.T) {
	formats := []struct {
		name         string
		format       uint16
		expectedCars int
		expectedSize int
	}{
		{"F1 2025 (22 cars, 1041 bytes)", PacketFormat2025, 22, 1041},
		{"F1 2026 (24 cars, 1133 bytes)", PacketFormat2026, 24, 1133},
	}

	for _, tt := range formats {
		t.Run(tt.name, func(t *testing.T) {
			buf := new(bytes.Buffer)
			hdr := createHeader(PacketIDCarDamage, tt.format)
			_ = binary.Write(buf, binary.LittleEndian, &hdr)

			for i := 0; i < tt.expectedCars; i++ {
				_ = binary.Write(buf, binary.LittleEndian, [4]float32{15.0, 15.0, 20.0, 20.0}) // TyresWear
				_ = binary.Write(buf, binary.LittleEndian, [4]uint8{0, 0, 2, 2})               // TyresDamage
				_ = binary.Write(buf, binary.LittleEndian, [4]uint8{5, 5, 10, 10})             // BrakesDamage
				_ = binary.Write(buf, binary.LittleEndian, [4]uint8{0, 0, 3, 3})               // TyreBlisters
				_ = binary.Write(buf, binary.LittleEndian, uint8(15))                          // FrontLeftWing
				_ = binary.Write(buf, binary.LittleEndian, uint8(10))                          // FrontRightWing
				_ = binary.Write(buf, binary.LittleEndian, uint8(5))                           // RearWing
				_ = binary.Write(buf, binary.LittleEndian, uint8(8))                           // Floor
				_ = binary.Write(buf, binary.LittleEndian, uint8(6))                           // Diffuser
				_ = binary.Write(buf, binary.LittleEndian, uint8(4))                           // Sidepod
				_ = binary.Write(buf, binary.LittleEndian, uint8(0))                           // DRSFault
				_ = binary.Write(buf, binary.LittleEndian, uint8(0))                           // ERSFault
				_ = binary.Write(buf, binary.LittleEndian, uint8(12))                          // GearBoxDamage
				_ = binary.Write(buf, binary.LittleEndian, uint8(10))                          // EngineDamage
				_ = binary.Write(buf, binary.LittleEndian, uint8(15))                          // MGUH
				_ = binary.Write(buf, binary.LittleEndian, uint8(12))                          // ES
				_ = binary.Write(buf, binary.LittleEndian, uint8(8))                           // CE
				_ = binary.Write(buf, binary.LittleEndian, uint8(18))                          // ICE
				_ = binary.Write(buf, binary.LittleEndian, uint8(20))                          // MGUK
				_ = binary.Write(buf, binary.LittleEndian, uint8(14))                          // TC
				_ = binary.Write(buf, binary.LittleEndian, uint8(0))                           // Blown
				_ = binary.Write(buf, binary.LittleEndian, uint8(0))                           // Seized
			}

			if buf.Len() != tt.expectedSize {
				t.Fatalf("Constructed damage buffer size %d does not match expected %d", buf.Len(), tt.expectedSize)
			}

			pkt, err := DecodeCarDamage(hdr, buf.Bytes()[HeaderSize:])
			if err != nil {
				t.Fatalf("DecodeCarDamage failed: %v", err)
			}

			if pkt.CarDamageData[0].FrontLeftWingDamage != 15 {
				t.Errorf("Car 0 FrontLeftWingDamage expected 15, got %d", pkt.CarDamageData[0].FrontLeftWingDamage)
			}
			if pkt.CarDamageData[0].TyreBlisters[2] != 3 {
				t.Errorf("Car 0 TyreBlisters[2] expected 3, got %d", pkt.CarDamageData[0].TyreBlisters[2])
			}
		})
	}
}

func TestDecodeMotionEx(t *testing.T) {
	buf := new(bytes.Buffer)
	hdr := createHeader(PacketIDMotionEx, PacketFormat2026)
	_ = binary.Write(buf, binary.LittleEndian, &hdr)

	for i := 0; i < 61; i++ {
		_ = binary.Write(buf, binary.LittleEndian, float32(i+1))
	}

	if buf.Len() != 273 {
		t.Fatalf("Expected MotionEx buffer size 273, got %d", buf.Len())
	}

	pkt, err := DecodeMotionEx(hdr, buf.Bytes()[HeaderSize:])
	if err != nil {
		t.Fatalf("DecodeMotionEx failed: %v", err)
	}

	if pkt.SuspensionPosition[0] != 1.0 {
		t.Errorf("Expected SuspensionPosition[0] 1.0, got %f", pkt.SuspensionPosition[0])
	}
	if pkt.WheelCamberGain[3] != 61.0 {
		t.Errorf("Expected WheelCamberGain[3] 61.0, got %f", pkt.WheelCamberGain[3])
	}
}

func TestDecodeTimeTrial2025And2026(t *testing.T) {
	formats := []struct {
		name         string
		format       uint16
		expectedSize int
	}{
		{"F1 2025 (101 bytes)", PacketFormat2025, 101},
		{"F1 2026 (104 bytes)", PacketFormat2026, 104},
	}

	for _, tt := range formats {
		t.Run(tt.name, func(t *testing.T) {
			buf := new(bytes.Buffer)
			hdr := createHeader(PacketIDTimeTrial, tt.format)
			_ = binary.Write(buf, binary.LittleEndian, &hdr)

			for ds := 0; ds < 3; ds++ {
				_ = binary.Write(buf, binary.LittleEndian, uint8(0)) // CarIdx
				if tt.format >= PacketFormat2026 {
					_ = binary.Write(buf, binary.LittleEndian, uint16(478)) // TeamId (uint16)
				} else {
					_ = binary.Write(buf, binary.LittleEndian, uint8(2)) // TeamId (uint8)
				}
				_ = binary.Write(buf, binary.LittleEndian, uint32(84500))
				_ = binary.Write(buf, binary.LittleEndian, uint32(28000))
				_ = binary.Write(buf, binary.LittleEndian, uint32(31000))
				_ = binary.Write(buf, binary.LittleEndian, uint32(25500))
				_ = binary.Write(buf, binary.LittleEndian, uint8(0))
				_ = binary.Write(buf, binary.LittleEndian, uint8(1))
				_ = binary.Write(buf, binary.LittleEndian, uint8(1))
				_ = binary.Write(buf, binary.LittleEndian, uint8(1))
				_ = binary.Write(buf, binary.LittleEndian, uint8(1))
				_ = binary.Write(buf, binary.LittleEndian, uint8(1))
			}

			if buf.Len() != tt.expectedSize {
				t.Fatalf("Constructed time trial buffer size %d does not match %d", buf.Len(), tt.expectedSize)
			}

			pkt, err := DecodeTimeTrial(hdr, buf.Bytes()[HeaderSize:])
			if err != nil {
				t.Fatalf("DecodeTimeTrial failed: %v", err)
			}

			if tt.format >= PacketFormat2026 {
				if pkt.PlayerSessionBestDataSet.TeamId != 478 {
					t.Errorf("Expected TeamId 478, got %d", pkt.PlayerSessionBestDataSet.TeamId)
				}
			} else {
				if pkt.PlayerSessionBestDataSet.TeamId != 2 {
					t.Errorf("Expected TeamId 2, got %d", pkt.PlayerSessionBestDataSet.TeamId)
				}
			}
		})
	}
}

func TestDecodeLapPositions2025And2026(t *testing.T) {
	formats := []struct {
		name         string
		format       uint16
		numCars      int
		expectedSize int
	}{
		{"F1 2025 (22 cars, 1131 bytes)", PacketFormat2025, 22, 1131},
		{"F1 2026 (24 cars, 1231 bytes)", PacketFormat2026, 24, 1231},
	}

	for _, tt := range formats {
		t.Run(tt.name, func(t *testing.T) {
			buf := new(bytes.Buffer)
			hdr := createHeader(PacketIDLapPositions, tt.format)
			_ = binary.Write(buf, binary.LittleEndian, &hdr)

			_ = binary.Write(buf, binary.LittleEndian, uint8(10)) // NumLaps
			_ = binary.Write(buf, binary.LittleEndian, uint8(0))  // LapStart

			for lap := 0; lap < 50; lap++ {
				for car := 0; car < tt.numCars; car++ {
					_ = binary.Write(buf, binary.LittleEndian, uint8(car+1))
				}
			}

			if buf.Len() != tt.expectedSize {
				t.Fatalf("Constructed lap positions buffer size %d does not match expected spec size %d", buf.Len(), tt.expectedSize)
			}

			pkt, err := DecodeLapPositions(hdr, buf.Bytes()[HeaderSize:])
			if err != nil {
				t.Fatalf("DecodeLapPositions failed: %v", err)
			}

			if pkt.NumLaps != 10 {
				t.Errorf("Expected NumLaps 10, got %d", pkt.NumLaps)
			}
			if pkt.PositionForVehicleIdx[0][0] != 1 {
				t.Errorf("Expected lap 0 car 0 pos 1, got %d", pkt.PositionForVehicleIdx[0][0])
			}
		})
	}
}

func TestDecodeLapData2025And2026(t *testing.T) {
	formats := []struct {
		name         string
		format       uint16
		numCars      int
		expectedSize int
	}{
		{"F1 2025 (22 cars, 1285 bytes)", PacketFormat2025, 22, 1285},
		{"F1 2026 (24 cars, 1399 bytes)", PacketFormat2026, 24, 1399},
	}

	for _, tt := range formats {
		t.Run(tt.name, func(t *testing.T) {
			buf := new(bytes.Buffer)
			hdr := createHeader(PacketIDLapData, tt.format)
			_ = binary.Write(buf, binary.LittleEndian, &hdr)

			for i := 0; i < tt.numCars; i++ {
				lap := LapData{
					LastLapTimeInMS:              85000,
					CurrentLapTimeInMS:           42000,
					Sector1TimeMSPart:            28000,
					Sector1TimeMinutesPart:       0,
					Sector2TimeMSPart:            30000,
					Sector2TimeMinutesPart:       0,
					DeltaToCarInFrontMSPart:      1200,
					DeltaToCarInFrontMinutesPart: 0,
					DeltaToRaceLeaderMSPart:      3400,
					DeltaToRaceLeaderMinutesPart: 0,
					LapDistance:                  1500.0,
					TotalDistance:                15000.0,
					SafetyCarDelta:               0.5,
					CarPosition:                  uint8(i + 1),
					CurrentLapNum:                5,
					PitStatus:                    0,
					NumPitStops:                  0,
					Sector:                       1,
					CurrentLapInvalid:            0,
					Penalties:                    0,
					TotalWarnings:                1,
					CornerCuttingWarnings:        1,
					NumUnservedDriveThroughPens:  0,
					NumUnservedStopGoPens:        0,
					GridPosition:                 uint8(i + 1),
					DriverStatus:                 4,
					ResultStatus:                 2,
					PitLaneTimerActive:           0,
					PitLaneTimeInLaneInMS:        0,
					PitStopTimerInMS:             0,
					PitStopShouldServePen:        0,
					SpeedTrapFastestSpeed:        320.5,
					SpeedTrapFastestLap:          3,
				}
				_ = binary.Write(buf, binary.LittleEndian, &lap)
			}

			// Trailer: TimeTrialPBCarIdx, TimeTrialRivalCarIdx
			_ = binary.Write(buf, binary.LittleEndian, uint8(255))
			_ = binary.Write(buf, binary.LittleEndian, uint8(255))

			if buf.Len() != tt.expectedSize {
				t.Fatalf("Constructed lap data buffer size %d does not match expected spec size %d", buf.Len(), tt.expectedSize)
			}

			pkt, err := DecodeLapData(hdr, buf.Bytes()[HeaderSize:])
			if err != nil {
				t.Fatalf("DecodeLapData failed: %v", err)
			}

			if pkt.LapData[0].LastLapTimeInMS != 85000 {
				t.Errorf("Car 0 LastLapTimeInMS expected 85000, got %d", pkt.LapData[0].LastLapTimeInMS)
			}
			if pkt.LapData[0].CarPosition != 1 {
				t.Errorf("Car 0 CarPosition expected 1, got %d", pkt.LapData[0].CarPosition)
			}
		})
	}
}

func TestDecodeEvent(t *testing.T) {
	buf := new(bytes.Buffer)
	hdr := createHeader(PacketIDEvent, PacketFormat2025)
	_ = binary.Write(buf, binary.LittleEndian, &hdr)

	// EventStringCode "FTLP" (Fastest Lap)
	_ = binary.Write(buf, binary.LittleEndian, [4]uint8{'F', 'T', 'L', 'P'})
	// FastestLapEventData (12 bytes)
	_ = binary.Write(buf, binary.LittleEndian, uint8(3))       // VehicleIdx
	_ = binary.Write(buf, binary.LittleEndian, float32(84.25)) // LapTime
	_ = binary.Write(buf, binary.LittleEndian, [7]uint8{})     // padding

	pkt, err := DecodeEvent(hdr, buf.Bytes()[HeaderSize:])
	if err != nil {
		t.Fatalf("DecodeEvent failed: %v", err)
	}

	if string(pkt.EventStringCode[:]) != "FTLP" {
		t.Errorf("Expected EventStringCode FTLP, got %s", string(pkt.EventStringCode[:]))
	}
}

func TestDecodeLobbyInfo2025And2026(t *testing.T) {
	formats := []struct {
		name         string
		format       uint16
		numPlayers   int
		expectedSize int
	}{
		{"F1 2025 (22 players, 954 bytes)", PacketFormat2025, 22, 954},
		{"F1 2026 (24 players, 1062 bytes)", PacketFormat2026, 24, 1062},
	}

	for _, tt := range formats {
		t.Run(tt.name, func(t *testing.T) {
			buf := new(bytes.Buffer)
			hdr := createHeader(PacketIDLobbyInfo, tt.format)
			_ = binary.Write(buf, binary.LittleEndian, &hdr)

			numPlayers := uint8(tt.numPlayers)
			_ = binary.Write(buf, binary.LittleEndian, &numPlayers)

			for i := 0; i < tt.numPlayers; i++ {
				var name [32]byte
				copy(name[:], "PlayerName")

				if tt.format >= PacketFormat2026 {
					_ = binary.Write(buf, binary.LittleEndian, uint8(0))      // AIControlled
					_ = binary.Write(buf, binary.LittleEndian, uint16(476+i)) // TeamId (uint16)
					_ = binary.Write(buf, binary.LittleEndian, uint8(10))     // Nationality
					_ = binary.Write(buf, binary.LittleEndian, uint8(1))      // Platform
					buf.Write(name[:])
					_ = binary.Write(buf, binary.LittleEndian, uint8(i+1))  // CarNumber
					_ = binary.Write(buf, binary.LittleEndian, uint8(1))    // YourTelemetry
					_ = binary.Write(buf, binary.LittleEndian, uint8(1))    // ShowOnlineNames
					_ = binary.Write(buf, binary.LittleEndian, uint16(500)) // TechLevel
					_ = binary.Write(buf, binary.LittleEndian, uint8(1))    // ReadyStatus
				} else {
					_ = binary.Write(buf, binary.LittleEndian, uint8(0))  // AIControlled
					_ = binary.Write(buf, binary.LittleEndian, uint8(i))  // TeamId (uint8)
					_ = binary.Write(buf, binary.LittleEndian, uint8(10)) // Nationality
					_ = binary.Write(buf, binary.LittleEndian, uint8(1))  // Platform
					buf.Write(name[:])
					_ = binary.Write(buf, binary.LittleEndian, uint8(i+1))  // CarNumber
					_ = binary.Write(buf, binary.LittleEndian, uint8(1))    // YourTelemetry
					_ = binary.Write(buf, binary.LittleEndian, uint8(1))    // ShowOnlineNames
					_ = binary.Write(buf, binary.LittleEndian, uint16(500)) // TechLevel
					_ = binary.Write(buf, binary.LittleEndian, uint8(1))    // ReadyStatus
				}
			}

			if buf.Len() != tt.expectedSize {
				t.Fatalf("Constructed lobby info buffer size %d does not match expected %d", buf.Len(), tt.expectedSize)
			}

			pkt, err := DecodeLobbyInfo(hdr, buf.Bytes()[HeaderSize:])
			if err != nil {
				t.Fatalf("DecodeLobbyInfo failed: %v", err)
			}

			if pkt.NumPlayers != numPlayers {
				t.Errorf("Expected NumPlayers %d, got %d", numPlayers, pkt.NumPlayers)
			}
			if pkt.LobbyPlayers[0].NameString() != "PlayerName" {
				t.Errorf("Expected PlayerName, got %s", pkt.LobbyPlayers[0].NameString())
			}
		})
	}
}

func TestDecodeSessionHistory(t *testing.T) {
	buf := new(bytes.Buffer)
	hdr := createHeader(PacketIDSessionHistory, PacketFormat2025)
	_ = binary.Write(buf, binary.LittleEndian, &hdr)

	_ = binary.Write(buf, binary.LittleEndian, uint8(0)) // CarIdx
	_ = binary.Write(buf, binary.LittleEndian, uint8(5)) // NumLaps
	_ = binary.Write(buf, binary.LittleEndian, uint8(1)) // NumTyreStints
	_ = binary.Write(buf, binary.LittleEndian, uint8(3)) // BestLapTimeLapNum
	_ = binary.Write(buf, binary.LittleEndian, uint8(3)) // BestSector1LapNum
	_ = binary.Write(buf, binary.LittleEndian, uint8(3)) // BestSector2LapNum
	_ = binary.Write(buf, binary.LittleEndian, uint8(3)) // BestSector3LapNum

	var laps [MaxLapHistoryEntries]LapHistoryData
	laps[0] = LapHistoryData{LapTimeInMS: 85000, Sector1TimeMSPart: 28000, Sector2TimeMSPart: 30000, Sector3TimeMSPart: 27000, LapValidBitFlags: 0x0F}
	_ = binary.Write(buf, binary.LittleEndian, &laps)

	var stints [MaxTyreStintHistoryEntries]TyreStintHistoryData
	stints[0] = TyreStintHistoryData{EndLap: 5, TyreActualCompound: 18, TyreVisualCompound: 16}
	_ = binary.Write(buf, binary.LittleEndian, &stints)

	pkt, err := DecodeSessionHistory(hdr, buf.Bytes()[HeaderSize:])
	if err != nil {
		t.Fatalf("DecodeSessionHistory failed: %v", err)
	}

	if pkt.NumLaps != 5 {
		t.Errorf("Expected NumLaps 5, got %d", pkt.NumLaps)
	}
	if pkt.LapHistoryData[0].LapTimeInMS != 85000 {
		t.Errorf("Expected LapTimeInMS 85000, got %d", pkt.LapHistoryData[0].LapTimeInMS)
	}
}

func TestDecodeTyreSets(t *testing.T) {
	buf := new(bytes.Buffer)
	hdr := createHeader(PacketIDTyreSets, PacketFormat2025)
	_ = binary.Write(buf, binary.LittleEndian, &hdr)

	_ = binary.Write(buf, binary.LittleEndian, uint8(0)) // CarIdx

	var sets [MaxTyreSets]TyreSetData
	sets[0] = TyreSetData{ActualTyreCompound: 18, VisualTyreCompound: 16, Wear: 10, Available: 1, Fitted: 1}
	_ = binary.Write(buf, binary.LittleEndian, &sets)

	_ = binary.Write(buf, binary.LittleEndian, uint8(0)) // FittedIdx

	pkt, err := DecodeTyreSets(hdr, buf.Bytes()[HeaderSize:])
	if err != nil {
		t.Fatalf("DecodeTyreSets failed: %v", err)
	}

	if pkt.CarIdx != 0 {
		t.Errorf("Expected CarIdx 0, got %d", pkt.CarIdx)
	}
	if pkt.TyreSetData[0].Wear != 10 {
		t.Errorf("Expected tyre set wear 10, got %d", pkt.TyreSetData[0].Wear)
	}
}

func TestDecodeDispatcher(t *testing.T) {
	buf := new(bytes.Buffer)
	hdr := createHeader(PacketIDMotion, PacketFormat2025)
	_ = binary.Write(buf, binary.LittleEndian, &hdr)

	for i := 0; i < 22; i++ {
		_ = binary.Write(buf, binary.LittleEndian, float32(100.0)) // X
		_ = binary.Write(buf, binary.LittleEndian, float32(5.0))   // Y
		_ = binary.Write(buf, binary.LittleEndian, float32(200.0)) // Z
		_ = binary.Write(buf, binary.LittleEndian, float32(30.0))  // VelX
		_ = binary.Write(buf, binary.LittleEndian, float32(0.0))   // VelY
		_ = binary.Write(buf, binary.LittleEndian, float32(-30.0)) // VelZ
		_ = binary.Write(buf, binary.LittleEndian, int16(1000))    // FwdX
		_ = binary.Write(buf, binary.LittleEndian, int16(0))       // FwdY
		_ = binary.Write(buf, binary.LittleEndian, int16(0))       // FwdZ
		_ = binary.Write(buf, binary.LittleEndian, int16(0))       // RgtX
		_ = binary.Write(buf, binary.LittleEndian, int16(1000))    // RgtY
		_ = binary.Write(buf, binary.LittleEndian, int16(0))       // RgtZ
		_ = binary.Write(buf, binary.LittleEndian, float32(1.5))   // Lat G
		_ = binary.Write(buf, binary.LittleEndian, float32(-0.5))  // Long G
		_ = binary.Write(buf, binary.LittleEndian, float32(0.1))   // Vert G
		_ = binary.Write(buf, binary.LittleEndian, float32(0.5))   // Yaw
		_ = binary.Write(buf, binary.LittleEndian, float32(0.1))   // Pitch
		_ = binary.Write(buf, binary.LittleEndian, float32(0.2))   // Roll
	}

	pkt, err := Decode(buf.Bytes())
	if err != nil {
		t.Fatalf("Decode failed: %v", err)
	}

	motionPkt, ok := pkt.(*PacketMotionData)
	if !ok {
		t.Fatalf("Expected *PacketMotionData, got %T", pkt)
	}
	if motionPkt.CarMotionData[0].WorldPositionX != 100.0 {
		t.Errorf("Car 0 WorldPositionX expected 100.0, got %f", motionPkt.CarMotionData[0].WorldPositionX)
	}
}

func TestEventAccessorsAndCollision(t *testing.T) {
	// 1. FastestLapData
	{
		hdr := createHeader(PacketIDEvent, PacketFormat2025)
		var details EventDataDetails
		details.Data[0] = 5 // VehicleIdx
		binary.LittleEndian.PutUint32(details.Data[1:5], math.Float32bits(78.45))
		pkt := PacketEventData{
			Header:          hdr,
			EventStringCode: [4]uint8{'F', 'T', 'L', 'P'},
			EventDetails:    details,
		}
		data, ok := pkt.FastestLapData()
		if !ok || data.VehicleIdx != 5 || data.LapTime < 78.44 || data.LapTime > 78.46 {
			t.Errorf("FastestLapData failed: got %+v, ok=%v", data, ok)
		}
		if _, ok := pkt.RetirementData(); ok {
			t.Errorf("RetirementData should return ok=false for FTLP")
		}
	}

	// 2. RetirementData
	{
		hdr := createHeader(PacketIDEvent, PacketFormat2025)
		var details EventDataDetails
		details.Data[0] = 7 // VehicleIdx
		details.Data[1] = 3 // Reason (terminal damage)
		pkt := PacketEventData{
			Header:          hdr,
			EventStringCode: [4]uint8{'R', 'T', 'M', 'T'},
			EventDetails:    details,
		}
		data, ok := pkt.RetirementData()
		if !ok || data.VehicleIdx != 7 || data.Reason != 3 {
			t.Errorf("RetirementData failed: got %+v, ok=%v", data, ok)
		}
	}

	// 3. DRSDisabledData
	{
		hdr := createHeader(PacketIDEvent, PacketFormat2025)
		var details EventDataDetails
		details.Data[0] = DRSDisabledReasonSafetyCar
		pkt := PacketEventData{
			Header:          hdr,
			EventStringCode: [4]uint8{'D', 'R', 'S', 'D'},
			EventDetails:    details,
		}
		data, ok := pkt.DRSDisabledData()
		if !ok || data.Reason != DRSDisabledReasonSafetyCar {
			t.Errorf("DRSDisabledData failed: got %+v, ok=%v", data, ok)
		}
		marshaled, err := pkt.MarshalJSON()
		if err != nil || !bytes.Contains(marshaled, []byte(`"Reason":1`)) {
			t.Errorf("MarshalJSON for DRSD failed: %s", string(marshaled))
		}
	}

	// 4. CollisionData 2025 vs 2026
	{
		// 2025: only vehicle1 and vehicle2, Severity should default to 0
		hdr25 := createHeader(PacketIDEvent, PacketFormat2025)
		var details25 EventDataDetails
		details25.Data[0] = 2 // Vehicle1
		details25.Data[1] = 5 // Vehicle2
		details25.Data[2] = 2 // Should be ignored in 2025
		pkt25 := PacketEventData{
			Header:          hdr25,
			EventStringCode: [4]uint8{'C', 'O', 'L', 'L'},
			EventDetails:    details25,
		}
		col25, ok := pkt25.CollisionData()
		if !ok || col25.Vehicle1Idx != 2 || col25.Vehicle2Idx != 5 || col25.Severity != 0 {
			t.Errorf("CollisionData 2025 failed: got %+v, ok=%v", col25, ok)
		}

		// 2026: severity read from byte 2
		hdr26 := createHeader(PacketIDEvent, PacketFormat2026)
		var details26 EventDataDetails
		details26.Data[0] = 2 // Vehicle1
		details26.Data[1] = 5 // Vehicle2
		details26.Data[2] = 2 // High severity
		pkt26 := PacketEventData{
			Header:          hdr26,
			EventStringCode: [4]uint8{'C', 'O', 'L', 'L'},
			EventDetails:    details26,
		}
		col26, ok := pkt26.CollisionData()
		if !ok || col26.Vehicle1Idx != 2 || col26.Vehicle2Idx != 5 || col26.Severity != 2 {
			t.Errorf("CollisionData 2026 failed: got %+v, ok=%v", col26, ok)
		}
	}

	// 5. OvertakeData
	{
		hdr := createHeader(PacketIDEvent, PacketFormat2025)
		var details EventDataDetails
		details.Data[0] = 0 // Overtaking
		details.Data[1] = 4 // Being overtaken
		pkt := PacketEventData{
			Header:          hdr,
			EventStringCode: [4]uint8{'O', 'V', 'T', 'K'},
			EventDetails:    details,
		}
		data, ok := pkt.OvertakeData()
		if !ok || data.OvertakingVehicleIdx != 0 || data.BeingOvertakenVehicleIdx != 4 {
			t.Errorf("OvertakeData failed: got %+v, ok=%v", data, ok)
		}
	}

	// 6. PenaltyData
	{
		hdr := createHeader(PacketIDEvent, PacketFormat2025)
		var details EventDataDetails
		details.Data[0] = 5  // PenaltyType (e.g. 5 sec time penalty)
		details.Data[1] = 1  // InfringementType
		details.Data[2] = 0  // VehicleIdx
		details.Data[3] = 4  // OtherVehicleIdx
		details.Data[4] = 5  // Time
		details.Data[5] = 12 // LapNum
		details.Data[6] = 0  // PlacesGained
		pkt := PacketEventData{
			Header:          hdr,
			EventStringCode: [4]uint8{'P', 'E', 'N', 'A'},
			EventDetails:    details,
		}
		data, ok := pkt.PenaltyData()
		if !ok || data.PenaltyType != 5 || data.Time != 5 || data.LapNum != 12 {
			t.Errorf("PenaltyData failed: got %+v, ok=%v", data, ok)
		}
	}

	// 7. SpeedTrapData
	{
		hdr := createHeader(PacketIDEvent, PacketFormat2025)
		var details EventDataDetails
		details.Data[0] = 0 // VehicleIdx
		binary.LittleEndian.PutUint32(details.Data[1:5], math.Float32bits(345.8))
		details.Data[5] = 1 // IsOverallFastest
		details.Data[6] = 1 // IsDriverFastest
		details.Data[7] = 0 // FastestVehicleIdx
		binary.LittleEndian.PutUint32(details.Data[8:12], math.Float32bits(345.8))
		pkt := PacketEventData{
			Header:          hdr,
			EventStringCode: [4]uint8{'S', 'P', 'T', 'P'},
			EventDetails:    details,
		}
		data, ok := pkt.SpeedTrapData()
		if !ok || data.VehicleIdx != 0 || data.Speed < 345.7 || data.Speed > 345.9 {
			t.Errorf("SpeedTrapData failed: got %+v, ok=%v", data, ok)
		}
	}
}
