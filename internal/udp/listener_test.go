package udp

import (
	"context"
	"net"
	"testing"
	"time"
)

func TestListenerReceivesPacket(t *testing.T) {
	// Create a listener on a random available port.
	listener := NewListener("127.0.0.1:0", DefaultBufferSize)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Start listening in a goroutine.
	errCh := make(chan error, 1)
	go func() {
		errCh <- listener.Listen(ctx)
	}()

	// Wait for the listener to start.
	<-listener.Ready()

	addr := listener.Addr()
	if addr == "" {
		t.Fatal("listener did not bind to an address")
	}

	// Resolve the listener's address and send a fake packet.
	udpAddr, err := net.ResolveUDPAddr("udp", addr)
	if err != nil {
		t.Fatalf("resolve address: %v", err)
	}

	conn, err := net.DialUDP("udp", nil, udpAddr)
	if err != nil {
		t.Fatalf("dial UDP: %v", err)
	}
	defer conn.Close()

	// Send a 29-byte fake header (minimum valid size).
	fakeHeader := make([]byte, 29)
	fakeHeader[0] = 0xFF // marker byte for identification
	_, err = conn.Write(fakeHeader)
	if err != nil {
		t.Fatalf("write UDP: %v", err)
	}

	// Wait for the packet on the channel.
	select {
	case pkt := <-listener.Packets():
		if pkt.Size != 29 {
			t.Errorf("expected packet size 29, got %d", pkt.Size)
		}
		if pkt.Data[0] != 0xFF {
			t.Errorf("expected first byte 0xFF, got 0x%02X", pkt.Data[0])
		}
	case <-time.After(2 * time.Second):
		t.Fatal("timed out waiting for packet")
	}
}

func TestListenerDropsSmallPackets(t *testing.T) {
	listener := NewListener("127.0.0.1:0", DefaultBufferSize)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	go func() {
		_ = listener.Listen(ctx)
	}()

	<-listener.Ready()

	addr := listener.Addr()
	udpAddr, err := net.ResolveUDPAddr("udp", addr)
	if err != nil {
		t.Fatalf("resolve address: %v", err)
	}

	conn, err := net.DialUDP("udp", nil, udpAddr)
	if err != nil {
		t.Fatalf("dial UDP: %v", err)
	}
	defer conn.Close()

	// Send a packet smaller than the minimum (28 bytes).
	smallPacket := make([]byte, 28)
	_, err = conn.Write(smallPacket)
	if err != nil {
		t.Fatalf("write UDP: %v", err)
	}

	// The small packet should be dropped; channel should remain empty.
	select {
	case pkt := <-listener.Packets():
		t.Fatalf("expected no packet, but got one with size %d", pkt.Size)
	case <-time.After(200 * time.Millisecond):
		// Expected: no packet received.
	}
}

func TestListenerGracefulShutdown(t *testing.T) {
	listener := NewListener("127.0.0.1:0", DefaultBufferSize)

	ctx, cancel := context.WithCancel(context.Background())

	errCh := make(chan error, 1)
	go func() {
		errCh <- listener.Listen(ctx)
	}()

	<-listener.Ready()

	// Cancel the context to trigger graceful shutdown.
	cancel()

	select {
	case err := <-errCh:
		if err != nil {
			t.Fatalf("expected nil error on graceful shutdown, got: %v", err)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("timed out waiting for listener to shut down")
	}
}
