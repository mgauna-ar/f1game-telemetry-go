package udp

import (
	"context"
	"fmt"
	"log/slog"
	"net"
	"sync"

	"github.com/mgauna/f1game-telemetry-go/internal/packets"
)

const (
	// DefaultBufferSize is the default read buffer size in bytes.
	DefaultBufferSize = 2048

	// minPacketSize is the minimum valid packet size (F1 2025/2026 29-byte header).
	minPacketSize = packets.HeaderSize
)

// RawPacket represents a raw UDP packet received from the F1 game.
type RawPacket struct {
	Data []byte
	Size int
}

// Listener listens for UDP telemetry packets from the F1 game.
type Listener struct {
	addr       string
	bufferSize int
	packets    chan RawPacket

	mu        sync.RWMutex
	conn      *net.UDPConn
	closeOnce sync.Once
	readyOnce sync.Once
	listenErr error
	ready     chan struct{} // closed when the listener is ready to receive packets or failed to bind
	bufPool   sync.Pool
}

// NewListener creates a new UDP listener with the given address and buffer size.
func NewListener(addr string, bufferSize int) *Listener {
	if bufferSize <= 0 {
		bufferSize = DefaultBufferSize
	}
	l := &Listener{
		addr:       addr,
		bufferSize: bufferSize,
		packets:    make(chan RawPacket, 1024),
		ready:      make(chan struct{}),
	}
	l.bufPool.New = func() any {
		b := make([]byte, l.bufferSize)
		return &b
	}
	return l
}

// Packets returns the read-only channel of received packets.
func (l *Listener) Packets() <-chan RawPacket {
	return l.packets
}

// Ready returns a channel that is closed when the UDP listener is bound and ready,
// or when initialization failed. Call Err() to check for startup errors.
func (l *Listener) Ready() <-chan struct{} {
	return l.ready
}

// Err returns any startup or listener error.
func (l *Listener) Err() error {
	l.mu.RLock()
	defer l.mu.RUnlock()
	return l.listenErr
}

func (l *Listener) markReady(err error) {
	l.readyOnce.Do(func() {
		l.mu.Lock()
		l.listenErr = err
		l.mu.Unlock()
		close(l.ready)
	})
}

// Listen starts listening for UDP packets and blocks until the context is canceled
// or an unrecoverable error occurs.
func (l *Listener) Listen(ctx context.Context) error {
	udpAddr, err := net.ResolveUDPAddr("udp", l.addr)
	if err != nil {
		resErr := fmt.Errorf("resolve UDP address %s: %w", l.addr, err)
		l.markReady(resErr)
		return resErr
	}

	conn, err := net.ListenUDP("udp", udpAddr)
	if err != nil {
		listenErr := fmt.Errorf("listen UDP on %s: %w", l.addr, err)
		l.markReady(listenErr)
		return listenErr
	}

	l.mu.Lock()
	l.conn = conn
	l.mu.Unlock()

	// Signal that the listener is ready.
	l.markReady(nil)

	slog.Info("UDP listener listening", "addr", conn.LocalAddr().String())

	// Close the connection when context is canceled to unblock ReadFromUDP.
	go func() {
		<-ctx.Done()
		_ = l.closeConn()
	}()

	bufPtr, ok := l.bufPool.Get().(*[]byte)
	if !ok || bufPtr == nil {
		empty := make([]byte, l.bufferSize)
		bufPtr = &empty
	}
	defer l.bufPool.Put(bufPtr)
	buf := *bufPtr

	for {
		n, _, err := conn.ReadFromUDP(buf)
		if err != nil {
			// Check if context was canceled (graceful shutdown).
			select {
			case <-ctx.Done():
				slog.Info("Shutting down UDP listener")
				return nil
			default:
				return fmt.Errorf("read UDP: %w", err)
			}
		}

		if n < minPacketSize {
			slog.Warn("Dropping UDP packet: too small", "bytes", n, "minBytes", minPacketSize)
			continue
		}

		// Copy the data to avoid buffer reuse issues.
		data := make([]byte, n)
		copy(data, buf[:n])

		packet := RawPacket{
			Data: data,
			Size: n,
		}

		// Non-blocking send: drop packet if channel is full.
		select {
		case l.packets <- packet:
		default:
			slog.Warn("UDP packet channel full, dropping packet")
		}
	}
}

// closeConn closes the underlying UDP connection once.
func (l *Listener) closeConn() error {
	var err error
	l.closeOnce.Do(func() {
		l.mu.RLock()
		conn := l.conn
		l.mu.RUnlock()
		if conn != nil {
			err = conn.Close()
		}
	})
	return err
}

// Addr returns the local address the listener is bound to, or empty if not bound.
func (l *Listener) Addr() string {
	l.mu.RLock()
	defer l.mu.RUnlock()
	if l.conn == nil {
		return ""
	}
	return l.conn.LocalAddr().String()
}

// Close closes the UDP connection.
func (l *Listener) Close() error {
	return l.closeConn()
}
