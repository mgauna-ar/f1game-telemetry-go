package system

import (
	"net"
	"strconv"
)

// LoopbackIPv4 is the address a game running on the same PC sends telemetry to.
const LoopbackIPv4 = "127.0.0.1"

// TelemetryEndpoint tells the dashboard where the game has to send its UDP telemetry.
type TelemetryEndpoint struct {
	// UDPAddr is the listen address as configured, e.g. "0.0.0.0:20777".
	UDPAddr string `json:"udp_addr"`
	// UDPPort is the port the game has to send to, or 0 when UDPAddr can't be parsed.
	UDPPort int `json:"udp_port"`
	// LocalIP is the address to enter in the game when it runs on this PC.
	LocalIP string `json:"local_ip"`
	// LANIPs are the addresses a console or another PC can send to, the primary one first.
	// Empty when the listener only accepts packets from this PC.
	LANIPs []string `json:"lan_ips"`
}

// DescribeTelemetryEndpoint reports the port and addresses the game can reach the UDP listener on.
// A listener bound to every interface is reachable on each LAN address, one bound to a single
// address only on that address.
func DescribeTelemetryEndpoint(udpAddr string) TelemetryEndpoint {
	endpoint := TelemetryEndpoint{UDPAddr: udpAddr, LocalIP: LoopbackIPv4, LANIPs: []string{}}

	host, _, err := net.SplitHostPort(udpAddr)
	if err != nil {
		endpoint.LANIPs = LANIPv4Addresses()
		return endpoint
	}
	endpoint.UDPPort = ListenPort(udpAddr)

	ip := net.ParseIP(host)
	switch {
	case host == "" || (ip != nil && ip.IsUnspecified()):
		endpoint.LANIPs = LANIPv4Addresses()
	case ip != nil && ip.IsLoopback():
		endpoint.LocalIP = host
	default:
		endpoint.LocalIP = host
		endpoint.LANIPs = []string{host}
	}
	return endpoint
}

// ListenPort is the port of a listen address such as "0.0.0.0:20777", or 0 when it can't be parsed.
func ListenPort(addr string) int {
	_, portStr, err := net.SplitHostPort(addr)
	if err != nil {
		return 0
	}
	port, err := strconv.Atoi(portStr)
	if err != nil {
		return 0
	}
	return port
}

// LANIPv4Addresses lists the IPv4 addresses other devices on the network can reach this PC on:
// the one used for outbound traffic first, then any other private address of an interface that is up.
func LANIPv4Addresses() []string {
	ips := []string{}
	seen := map[string]bool{}
	add := func(ip string) {
		if !seen[ip] {
			seen[ip] = true
			ips = append(ips, ip)
		}
	}

	if primary := GetLocalIP(); primary != LoopbackIPv4 {
		add(primary)
	}

	ifaces, err := net.Interfaces()
	if err != nil {
		return ips
	}
	for _, iface := range ifaces {
		if iface.Flags&net.FlagUp == 0 || iface.Flags&net.FlagLoopback != 0 {
			continue
		}
		addrs, err := iface.Addrs()
		if err != nil {
			continue
		}
		for _, addr := range addrs {
			ipNet, ok := addr.(*net.IPNet)
			if !ok {
				continue
			}
			if ip4 := ipNet.IP.To4(); ip4 != nil && ip4.IsPrivate() {
				add(ip4.String())
			}
		}
	}
	return ips
}
