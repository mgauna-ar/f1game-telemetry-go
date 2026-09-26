package main

import (
	"encoding/json"
	"testing"

	"github.com/mgauna/f1game-telemetry-go/internal/packets"
	"github.com/mgauna/f1game-telemetry-go/internal/session"
)

// liveSnapshotsPerSecond is the LiveBroadcaster rate the server starts (cmd/server).
const liveSnapshotsPerSecond = 10

// datagramRecorder keeps every Write as one UDP datagram.
type datagramRecorder struct{ datagrams [][]byte }

func (r *datagramRecorder) Write(p []byte) (int, error) {
	r.datagrams = append(r.datagrams, append([]byte(nil), p...))
	return len(p), nil
}

// captureHub keeps the last message the broadcaster sends.
type captureHub struct{ last []byte }

func (h *captureHub) Broadcast(msg []byte) { h.last = msg }
func (h *captureHub) ClientCount() int     { return 1 }

// rawLiveSnapshot is the snapshot shape sent before the slim DTO: the decoded packets as they are.
// It stays here as the reference the slim payload is measured against.
type rawLiveSnapshot struct {
	Header         packets.PacketHeader             `json:"Header"`
	Session        *packets.PacketSessionData       `json:"Session,omitempty"`
	Participants   *packets.PacketParticipantsData  `json:"Participants,omitempty"`
	LapData        *packets.PacketLapData           `json:"LapData,omitempty"`
	CarTelemetry   *packets.PacketCarTelemetryData  `json:"CarTelemetry,omitempty"`
	CarTelemetry2  *packets.PacketCarTelemetry2Data `json:"CarTelemetry2,omitempty"`
	CarStatus      *packets.PacketCarStatusData     `json:"CarStatus,omitempty"`
	CarDamage      *packets.PacketCarDamageData     `json:"CarDamage,omitempty"`
	ActiveCarCount int                              `json:"ActiveCarCount,omitempty"`
}

func raceConfigForFormat(format uint16) SimulatorConfig {
	cfg := SimulatorConfig{
		Scenario:        "default",
		PacketFormat:    packets.PacketFormat2026,
		GameYear:        26,
		NumActiveCars:   22,
		TotalSlots:      packets.MaxCars2026,
		ActiveDrivers:   drivers2026,
		SessionType:     packets.SessionRace,
		SessionModeName: "Race",
	}
	if format == packets.PacketFormat2025 {
		cfg.PacketFormat = packets.PacketFormat2025
		cfg.GameYear = 25
		cfg.NumActiveCars = 20
		cfg.TotalSlots = packets.MaxCars2025
		cfg.ActiveDrivers = drivers2025
	}
	return cfg
}

// sendRaceFrame writes one mid-race frame of every packet the live snapshot carries, the way the
// simulator's main loop sends them.
func sendRaceFrame(w *datagramRecorder, cfg SimulatorConfig) {
	st := &simState{
		frameID:         1200,
		sessionUID:      987654321,
		sessionTime:     600,
		angle:           1.3,
		lapTimeMs:       45000,
		lapNum:          5,
		totalDistance:   22000,
		sessionTimeLeft: 2000,
	}
	header := packets.PacketHeader{
		PacketFormat:            cfg.PacketFormat,
		GameYear:                cfg.GameYear,
		GameMajorVersion:        1,
		PacketVersion:           1,
		SessionUID:              st.sessionUID,
		SessionTime:             st.sessionTime,
		FrameIdentifier:         st.frameID,
		OverallFrameIdentifier:  st.frameID,
		SecondaryPlayerCarIndex: 255,
	}
	const (
		speedKmh = 285
		rpm      = 11800
		gear     = 7
		throttle = 1.0
		brake    = 0.0
		lapDist  = 1800
	)

	sessionPkt := buildSessionPacket(cfg, st, header)
	sendSessionPacket(w, &sessionPkt, cfg.PacketFormat)
	sendParticipantsPacket(w, header, cfg.NumActiveCars, cfg.TotalSlots, cfg.ActiveDrivers, cfg.PacketFormat)
	sendTelemetryPacket(w, header, cfg.TotalSlots, buildTelemetryCars(cfg, st.angle, speedKmh, rpm, gear, throttle, brake), cfg.PacketFormat)
	if cfg.PacketFormat >= packets.PacketFormat2026 {
		sendCarTelemetry2Packet(w, header, cfg.TotalSlots, buildTelemetry2Cars(cfg, speedKmh, st.frameID))
	}
	sendLapDataPacket(w, header, cfg.TotalSlots, buildLapCars(cfg, st, lapDist))
	sendCarStatusPacket(w, header, cfg.TotalSlots, buildCarStatusCars(cfg, st), cfg.PacketFormat)
	sendCarDamagePacket(w, header, cfg.TotalSlots, buildCarDamageCars(cfg, st))
}

// TestLiveSnapshotPayloadSize measures the 10 Hz live snapshot built from simulator packets, next to
// the raw packet snapshot it replaced. Run with -v to see the sizes.
func TestLiveSnapshotPayloadSize(t *testing.T) {
	for _, format := range []uint16{packets.PacketFormat2025, packets.PacketFormat2026} {
		cfg := raceConfigForFormat(format)
		rec := &datagramRecorder{}
		sendRaceFrame(rec, cfg)

		hub := &captureHub{}
		b := session.NewLiveBroadcaster(hub)
		raw := rawLiveSnapshot{}
		for _, dgram := range rec.datagrams {
			pkt, err := packets.Decode(dgram)
			if err != nil {
				t.Fatalf("format %d: decode: %v", format, err)
			}
			b.ProcessPacket(pkt)
			raw.Header = pkt.GetHeader()
			switch p := pkt.(type) {
			case *packets.PacketSessionData:
				raw.Session = p
			case *packets.PacketParticipantsData:
				raw.Participants = p
			case *packets.PacketLapData:
				raw.LapData = p
			case *packets.PacketCarTelemetryData:
				raw.CarTelemetry = p
			case *packets.PacketCarTelemetry2Data:
				raw.CarTelemetry2 = p
			case *packets.PacketCarStatusData:
				raw.CarStatus = p
			case *packets.PacketCarDamageData:
				raw.CarDamage = p
			}
		}
		b.BroadcastSnapshot()
		if hub.last == nil {
			t.Fatalf("format %d: no snapshot broadcast", format)
		}

		var slim session.LiveSnapshot
		if err := json.Unmarshal(hub.last, &slim); err != nil {
			t.Fatalf("format %d: unmarshal snapshot: %v", format, err)
		}
		raw.Header.PacketId = packets.PacketIDLiveSnapshot
		raw.ActiveCarCount = slim.ActiveCarCount
		rawJSON, err := json.Marshal(raw)
		if err != nil {
			t.Fatalf("format %d: marshal raw snapshot: %v", format, err)
		}

		before, after := len(rawJSON), len(hub.last)
		t.Logf("format %d (%d active cars): before %d B/frame (%.1f KB/s), after %d B/frame (%.1f KB/s), %.0f%% of before",
			format, slim.ActiveCarCount,
			before, float64(before*liveSnapshotsPerSecond)/1024,
			after, float64(after*liveSnapshotsPerSecond)/1024,
			100*float64(after)/float64(before))

		if after*2 > before {
			t.Errorf("format %d: slim snapshot is %d B, want under half of the raw %d B", format, after, before)
		}
		n := slim.ActiveCarCount
		if n != cfg.NumActiveCars {
			t.Errorf("format %d: ActiveCarCount = %d, want %d", format, n, cfg.NumActiveCars)
		}
		lengths := map[string]int{
			"Participants": len(slim.Participants),
			"LapData":      len(slim.LapData),
			"CarTelemetry": len(slim.CarTelemetry),
			"CarStatus":    len(slim.CarStatus),
			"CarDamage":    len(slim.CarDamage),
		}
		if format >= packets.PacketFormat2026 {
			lengths["CarTelemetry2"] = len(slim.CarTelemetry2)
		}
		for name, got := range lengths {
			if got != n {
				t.Errorf("format %d: %s has %d cars, want %d", format, name, got, n)
			}
		}
		if slim.Session == nil || len(slim.Session.WeatherForecastSamples) != int(raw.Session.NumWeatherForecastSamples) {
			t.Errorf("format %d: want the %d filled forecast samples", format, raw.Session.NumWeatherForecastSamples)
		}
	}
}
