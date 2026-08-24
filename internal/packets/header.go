package packets

import (
	"bytes"
	"encoding/binary"
	"fmt"
)

const (
	HeaderSize       = 29
	MaxCars          = 24
	MaxCars2025      = 22
	MaxCars2026      = 24
	PacketFormat2025 = 2025
	PacketFormat2026 = 2026
)

// Tyre compound constants
const (
	CompoundInter     uint8 = 7
	CompoundWet       uint8 = 8
	CompoundSoft      uint8 = 16
	CompoundMedium    uint8 = 17
	CompoundHard      uint8 = 18
	CompoundSuperSoft uint8 = 19
	CompoundClassicS  uint8 = 20
	CompoundClassicM  uint8 = 21
	CompoundClassicH  uint8 = 22
)

// VisualTyreCompoundName returns the human-readable visual tyre compound name.
func VisualTyreCompoundName(compound uint8) string {
	switch compound {
	case CompoundSoft, CompoundClassicS:
		return "SOFT"
	case CompoundMedium, CompoundClassicM:
		return "MEDIUM"
	case CompoundHard, CompoundClassicH:
		return "HARD"
	case CompoundInter:
		return "INTERMEDIATE"
	case CompoundWet:
		return "WET"
	case CompoundSuperSoft:
		return "SOFT"
	default:
		return "MEDIUM"
	}
}

// ActualTyreCompoundName returns the human-readable F1 compound identifier (C1-C5, etc.).
func ActualTyreCompoundName(compound uint8) string {
	switch compound {
	case ActualCompoundC5:
		return "C5"
	case ActualCompoundC4:
		return "C4"
	case ActualCompoundC3:
		return "C3"
	case ActualCompoundC2:
		return "C2"
	case ActualCompoundC1:
		return "C1"
	case ActualCompoundC0:
		return "C0"
	case CompoundInter:
		return "INTERMEDIATE"
	case CompoundWet:
		return "WET"
	default:
		return "UNKNOWN"
	}
}

// MaxCarsForFormat returns the maximum number of cars for a given packet format (22 for 2025, 24 for 2026).
func MaxCarsForFormat(packetFormat uint16) int {
	if packetFormat >= PacketFormat2026 {
		return MaxCars2026
	}
	return MaxCars2025
}

// PerCarItemSize calculates the per-car byte stride based on packet payload length and format car count.
func PerCarItemSize(payload []byte, header PacketHeader, structSize, trailer int) int {
	maxCars := MaxCarsForFormat(header.PacketFormat)
	if len(payload) == 0 || maxCars <= 0 {
		return structSize
	}

	netLen := len(payload)
	if trailer > 0 && len(payload) >= trailer {
		netLen = len(payload) - trailer
	}

	if netLen > 0 {
		if netLen%maxCars == 0 {
			size := netLen / maxCars
			if size >= structSize {
				return size
			}
		}
		if netLen%MaxCars == 0 {
			size := netLen / MaxCars
			if size >= structSize {
				return size
			}
		}
	}

	return structSize
}

// Packet IDs
const (
	PacketIDMotion              uint8 = 0
	PacketIDSession             uint8 = 1
	PacketIDLapData             uint8 = 2
	PacketIDEvent               uint8 = 3
	PacketIDParticipants        uint8 = 4
	PacketIDCarSetup            uint8 = 5
	PacketIDCarTelemetry        uint8 = 6
	PacketIDCarStatus           uint8 = 7
	PacketIDFinalClassification uint8 = 8
	PacketIDLobbyInfo           uint8 = 9
	PacketIDCarDamage           uint8 = 10
	PacketIDSessionHistory      uint8 = 11
	PacketIDTyreSets            uint8 = 12
	PacketIDMotionEx            uint8 = 13
	PacketIDTimeTrial           uint8 = 14
	PacketIDLapPositions        uint8 = 15
	PacketIDCarTelemetry2       uint8 = 16
	PacketIDInsight             uint8 = 250
)

// DriverNames maps official EA driver ID to human-readable driver name.
var DriverNames = map[uint16]string{
	0: "Carlos Sainz", 2: "Daniel Ricciardo", 3: "Fernando Alonso", 4: "Felipe Massa",
	7: "Lewis Hamilton", 9: "Max Verstappen", 10: "Nico Hülkenberg", 11: "Kevin Magnussen",
	14: "Sergio Pérez", 15: "Valtteri Bottas", 17: "Esteban Ocon", 19: "Lance Stroll",
	20: "Arron Barnes", 21: "Martin Giles", 22: "Alex Murray", 23: "Lucas Roth",
	24: "Igor Correia", 25: "Sophie Levasseur", 26: "Jonas Schiffer", 27: "Alain Forest",
	28: "Jay Letourneau", 29: "Esto Saari", 30: "Yasar Atiyeh", 31: "Callisto Calabresi",
	32: "Naota Izumi", 33: "Howard Clarke", 34: "Lars Kaufmann", 35: "Marie Laursen",
	36: "Flavio Nieves", 38: "Klimek Michalski", 39: "Santiago Moreno", 40: "Benjamin Coppens",
	41: "Noah Visser", 50: "George Russell", 54: "Lando Norris", 58: "Charles Leclerc",
	59: "Pierre Gasly", 62: "Alexander Albon", 70: "Rashid Nair", 71: "Jack Tremblay",
	77: "Ayrton Senna", 80: "Guanyu Zhou", 83: "Juan Manuel Correa", 90: "Michael Schumacher",
	94: "Yuki Tsunoda", 102: "Aidan Jackson", 109: "Jenson Button", 110: "David Coulthard",
	112: "Oscar Piastri", 113: "Liam Lawson", 116: "Richard Verschoor", 123: "Enzo Fittipaldi",
	125: "Mark Webber", 126: "Jacques Villeneuve", 127: "Callie Mayer", 132: "Logan Sargeant",
	136: "Jack Doohan", 137: "Amaury Cordeel", 138: "Dennis Hauger", 145: "Zane Maloney",
	146: "Victor Martins", 147: "Oliver Bearman", 148: "Jak Crawford", 149: "Isack Hadjar",
	152: "Roman Stanek", 153: "Kush Maini", 156: "Brendon Leigh", 157: "David Tonizza",
	158: "Jarno Opmeer", 159: "Lucas Blakeley", 160: "Paul Aron", 161: "Gabriel Bortoleto",
	162: "Franco Colapinto", 163: "Taylor Barnard", 164: "Joshua Dürksen", 165: "Andrea-Kimi Antonelli",
	166: "Ritomo Miyata", 167: "Rafael Villagómez", 168: "Zak O’Sullivan", 169: "Pepe Martí",
	170: "Sonny Hayes", 171: "Joshua Pearce", 172: "Callum Voisin", 173: "Matías Zagazeta",
	174: "Nikola Tsolov", 175: "Tim Tramnitz", 185: "Luca Cortez", 186: "Luke Browning",
	187: "Cian Shields", 188: "Arvid Lindblad", 189: "Dino Beganovic", 190: "Leonardo Fornaroli",
	191: "Oliver Goethe", 192: "Gabriele Minì", 193: "Sebastián Montoya", 194: "Alexander Dunne",
	195: "Max Esterson", 196: "Sami Meguetounif", 197: "John Bennett",
}

// DriverName returns the driver name for the given driver ID.
func DriverName(id uint16) string {
	if name, ok := DriverNames[id]; ok {
		return name
	}
	return fmt.Sprintf("Driver %d", id)
}

// TeamNames maps official EA team ID to human-readable team name.
var TeamNames = map[uint16]string{
	0: "Mercedes", 1: "Ferrari", 2: "Red Bull Racing", 3: "Williams",
	4: "Aston Martin", 5: "Alpine", 6: "RB", 7: "Haas",
	8: "McLaren", 9: "Sauber", 41: "F1 Generic", 104: "F1 Custom Team",
	129: "Konnersport", 142: "APXGP '24", 154: "APXGP '25", 155: "Konnersport '24",
	158: "Art GP '24", 159: "Campos '24", 160: "Rodin Motorsport '24", 161: "AIX Racing '24",
	162: "DAMS '24", 163: "Hitech '24", 164: "MP Motorsport '24", 165: "Prema '24",
	166: "Trident '24", 167: "Van Amersfoort Racing '24", 168: "Invicta '24",
	185: "Mercedes '24", 186: "Ferrari '24", 187: "Red Bull Racing '24", 188: "Williams '24",
	189: "Aston Martin '24", 190: "Alpine '24", 191: "RB '24", 192: "Haas '24",
	193: "McLaren '24", 194: "Sauber '24",
	465: "Art GP '25", 466: "Campos '25", 467: "Rodin Motorsport '25", 468: "AIX Racing '25",
	469: "DAMS '25", 470: "Hitech '25", 471: "MP Motorsport '25", 472: "Prema '25",
	473: "Trident '25", 474: "Van Amersfoort Racing '25", 475: "Invicta '25",
	476: "Mercedes '26", 477: "Ferrari '26", 478: "Red Bull Racing '26", 479: "Williams '26",
	480: "Aston Martin '26", 481: "Alpine '26", 482: "RB '26", 483: "Haas '26",
	484: "McLaren '26", 485: "Audi '26", 486: "Cadillac '26",
}

// TeamName returns the team name for the given team ID.
func TeamName(id uint16) string {
	if name, ok := TeamNames[id]; ok {
		return name
	}
	return fmt.Sprintf("Team %d", id)
}

// PacketHeader is the header present at the start of every UDP packet.
type PacketHeader struct {
	PacketFormat            uint16
	GameYear                uint8
	GameMajorVersion        uint8
	GameMinorVersion        uint8
	PacketVersion           uint8
	PacketId                uint8
	SessionUID              uint64
	SessionTime             float32
	FrameIdentifier         uint32
	OverallFrameIdentifier  uint32
	PlayerCarIndex          uint8
	SecondaryPlayerCarIndex uint8
}

// Packet is the interface implemented by all packet types.
type Packet interface {
	GetHeader() PacketHeader
}

// DecodeHeaderWithOffset decodes a PacketHeader and returns the header length (29 bytes for F1 2025/2026).
func DecodeHeaderWithOffset(data []byte) (PacketHeader, int, error) {
	if len(data) < HeaderSize {
		return PacketHeader{}, 0, fmt.Errorf("data too short for header: got %d bytes, need %d", len(data), HeaderSize)
	}

	var h PacketHeader
	err := binary.Read(bytes.NewReader(data[:HeaderSize]), binary.LittleEndian, &h)
	if err != nil {
		return PacketHeader{}, 0, fmt.Errorf("failed to decode header: %w", err)
	}
	return h, HeaderSize, nil
}

// DecodeHeader decodes a PacketHeader from raw bytes.
func DecodeHeader(data []byte) (PacketHeader, error) {
	h, _, err := DecodeHeaderWithOffset(data)
	return h, err
}
