package udp

import (
	"context"
	"fmt"
	"log"
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
	ready     chan struct{} // closed when the listener is ready to receive packets
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
		packets:    make(chan RawPacket, 2048),
		ready:      make(chan struct{}),
	}
	l.bufPool.New = func() any {
		b := make([]byte, l.bufferSize)
		return &b
	}
	return l
}

// Packets returns a read-only channel that receives parsed raw packets.
func (l *Listener) Packets() <-chan RawPacket {
	return l.packets
}

// Ready returns a channel that is closed when the listener has bound
// to its address and is ready to receive packets.
func (l *Listener) Ready() <-chan struct{} {
	return l.ready
}

// Listen starts listening for UDP packets. It blocks until the context is
// canceled or an unrecoverable error occurs.
func (l *Listener) Listen(ctx context.Context) error {
	defer close(l.packets)

	udpAddr, err := net.ResolveUDPAddr("udp", l.addr)
	if err != nil {
		return fmt.Errorf("resolve UDP address %q: %w", l.addr, err)
	}

	conn, err := net.ListenUDP("udp", udpAddr)
	if err != nil {
		return fmt.Errorf("listen UDP on %s: %w", l.addr, err)
	}

	l.mu.Lock()
	l.conn = conn
	l.mu.Unlock()

	// Signal that the listener is ready.
	close(l.ready)

	log.Printf("[UDP] Listening on %s", conn.LocalAddr().String())

	// Close the connection when context is canceled to unblock ReadFromUDP.
	go func() {
		<-ctx.Done()
		_ = l.closeConn()
	}()

	bufPtr := l.bufPool.Get().(*[]byte)
	defer l.bufPool.Put(bufPtr)
	buf := *bufPtr

	for {
		n, _, err := conn.ReadFromUDP(buf)
		if err != nil {
			// Check if context was canceled (graceful shutdown).
			select {
			case <-ctx.Done():
				log.Println("[UDP] Shutting down listener")
				return nil
			default:
				return fmt.Errorf("read UDP: %w", err)
			}
		}

		if n < minPacketSize {
			log.Printf("[UDP] Dropping packet: too small (%d bytes, minimum %d)", n, minPacketSize)
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
			log.Println("[UDP] WARNING: packet channel full, dropping packet")
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

// Close closes the UDP connection.
func (l *Listener) Close() error {
	return l.closeConn()
}

// Addr returns the local address the listener is bound to.
// Returns an empty string if the listener is not yet started.
func (l *Listener) Addr() string {
	l.mu.RLock()
	defer l.mu.RUnlock()
	if l.conn != nil {
		return l.conn.LocalAddr().String()
	}
	return ""
}
