package api

import (
	"bytes"
	"context"
	"testing"
	"time"
)

func TestHub_NamingAndDefaults(t *testing.T) {
	defaultHub := NewHub()
	if defaultHub.name != "Telemetry" {
		t.Errorf("expected default hub name Telemetry, got %s", defaultHub.name)
	}

	customHub := NewHub("CustomHub")
	if customHub.name != "CustomHub" {
		t.Errorf("expected custom hub name CustomHub, got %s", customHub.name)
	}
}

func TestHub_LifecycleAndClientCount(t *testing.T) {
	hub := NewHub("TestLifecycle")
	go hub.Run(t.Context())

	if count := hub.ClientCount(); count != 0 {
		t.Errorf("expected 0 clients initially, got %d", count)
	}
	if count := hub.ClientsCount(); count != 0 {
		t.Errorf("expected 0 clients for ClientsCount(), got %d", count)
	}

	client1 := &Client{hub: hub, send: make(chan []byte, clientSendBufferSize)}
	client2 := &Client{hub: hub, send: make(chan []byte, clientSendBufferSize)}

	hub.Register(client1)
	hub.Register(client2)

	deadline := time.Now().Add(500 * time.Millisecond)
	for hub.ClientCount() < 2 && time.Now().Before(deadline) {
		time.Sleep(5 * time.Millisecond)
	}

	if count := hub.ClientCount(); count != 2 {
		t.Fatalf("expected 2 clients, got %d", count)
	}

	hub.Unregister(client1)
	deadline = time.Now().Add(500 * time.Millisecond)
	for hub.ClientCount() > 1 && time.Now().Before(deadline) {
		time.Sleep(5 * time.Millisecond)
	}

	if count := hub.ClientCount(); count != 1 {
		t.Fatalf("expected 1 client after unregistering client1, got %d", count)
	}

	// Verify client1's send channel was closed upon unregistration
	select {
	case _, ok := <-client1.send:
		if ok {
			t.Errorf("expected client1.send to be closed")
		}
	default:
		t.Errorf("expected client1.send to be readable (closed)")
	}

	hub.Unregister(client2)
	deadline = time.Now().Add(500 * time.Millisecond)
	for hub.ClientCount() > 0 && time.Now().Before(deadline) {
		time.Sleep(5 * time.Millisecond)
	}

	if count := hub.ClientCount(); count != 0 {
		t.Fatalf("expected 0 clients after unregistering all, got %d", count)
	}
}

func TestHub_BroadcastFanOut(t *testing.T) {
	hub := NewHub("TestBroadcast")
	go hub.Run(t.Context())

	c1 := &Client{hub: hub, send: make(chan []byte, clientSendBufferSize)}
	c2 := &Client{hub: hub, send: make(chan []byte, clientSendBufferSize)}

	hub.Register(c1)
	hub.Register(c2)

	deadline := time.Now().Add(500 * time.Millisecond)
	for hub.ClientCount() < 2 && time.Now().Before(deadline) {
		time.Sleep(5 * time.Millisecond)
	}

	testMsg := []byte("broadcast test message")
	hub.Broadcast(testMsg)

	for i, c := range []*Client{c1, c2} {
		select {
		case msg := <-c.send:
			if !bytes.Equal(msg, testMsg) {
				t.Errorf("client %d received %s; want %s", i+1, string(msg), string(testMsg))
			}
		case <-time.After(500 * time.Millisecond):
			t.Fatalf("timed out waiting for message on client %d", i+1)
		}
	}
}

func TestHub_SlowClientEviction(t *testing.T) {
	hub := NewHub("TestSlowClient")
	go hub.Run(t.Context())

	// Slow client with a channel buffer of 1 that is filled
	slowClient := &Client{hub: hub, send: make(chan []byte, 1)}
	slowClient.send <- []byte("already full")

	// Fast client with ample buffer
	fastClient := &Client{hub: hub, send: make(chan []byte, clientSendBufferSize)}

	hub.Register(slowClient)
	hub.Register(fastClient)

	deadline := time.Now().Add(500 * time.Millisecond)
	for hub.ClientCount() < 2 && time.Now().Before(deadline) {
		time.Sleep(5 * time.Millisecond)
	}

	// Broadcast should evict slowClient because its send buffer is full
	hub.Broadcast([]byte("new message"))

	select {
	case msg := <-fastClient.send:
		if string(msg) != "new message" {
			t.Errorf("fast client received %s; want new message", string(msg))
		}
	case <-time.After(500 * time.Millisecond):
		t.Fatal("timed out waiting for fast client message")
	}

	deadline = time.Now().Add(500 * time.Millisecond)
	for hub.ClientCount() > 1 && time.Now().Before(deadline) {
		time.Sleep(5 * time.Millisecond)
	}

	if count := hub.ClientCount(); count != 1 {
		t.Errorf("expected 1 client remaining after slow client eviction, got %d", count)
	}

	// Verify slow client channel was closed
	<-slowClient.send // drain the "already full" message
	select {
	case _, ok := <-slowClient.send:
		if ok {
			t.Errorf("expected slow client channel to be closed")
		}
	default:
		t.Errorf("expected slow client channel to be readable as closed")
	}
}

func TestHub_BroadcastCongestion(t *testing.T) {
	hub := NewHub("TestCongested")

	// Fill broadcast buffer (1024)
	for i := 0; i < 1024; i++ {
		hub.Broadcast([]byte("fill"))
	}

	// The 1025th broadcast should not block (hits default case)
	done := make(chan struct{})
	go func() {
		hub.Broadcast([]byte("overflow"))
		close(done)
	}()

	select {
	case <-done:
		// Succeeded without blocking
	case <-time.After(200 * time.Millisecond):
		t.Fatal("Broadcast blocked on congested channel")
	}
}

func TestHub_RunContextCancellation(t *testing.T) {
	hub := NewHub("TestCancel")
	ctx, cancel := context.WithCancel(context.Background())

	done := make(chan struct{})
	go func() {
		hub.Run(ctx)
		close(done)
	}()

	client := &Client{hub: hub, send: make(chan []byte, clientSendBufferSize)}
	hub.Register(client)

	deadline := time.Now().Add(500 * time.Millisecond)
	for hub.ClientCount() < 1 && time.Now().Before(deadline) {
		time.Sleep(5 * time.Millisecond)
	}

	if count := hub.ClientCount(); count != 1 {
		t.Fatalf("expected 1 client, got %d", count)
	}

	cancel()

	select {
	case <-done:
		// Clean exit
	case <-time.After(500 * time.Millisecond):
		t.Fatal("Hub.Run failed to exit after context cancellation")
	}

	if count := hub.ClientCount(); count != 0 {
		t.Fatalf("expected 0 clients after hub shutdown, got %d", count)
	}

	select {
	case _, ok := <-client.send:
		if ok {
			t.Errorf("expected client.send to be closed upon hub shutdown")
		}
	default:
		t.Errorf("expected client.send to be closed and readable")
	}
}
