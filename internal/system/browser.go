package system

import (
	"fmt"
	"net"
	"os"
	"os/exec"
	"runtime"
)

// OpenBrowser opens a dashboard page. On Windows it opens in Chrome when Chrome is installed,
// otherwise (and on macOS and Linux) in the user's default browser.
//
// The voice engineer hears the driver through the browser's speech recognition, and the game is in
// front of the page while racing. Chrome keeps listening to a page hidden behind the game; Edge, the
// usual default browser on Windows, doesn't, so questions asked from the game would go unanswered.
func OpenBrowser(url string) error {
	if chrome := dashboardBrowser(runtime.GOOS, os.Getenv, fileExists); chrome != "" {
		cmd := exec.Command(chrome, url)
		if err := cmd.Start(); err == nil {
			// A running Chrome opens the page in a new tab and this process exits.
			go func() { _ = cmd.Wait() }()
			return nil
		}
	}
	if err := OpenPath(url); err != nil {
		return fmt.Errorf("failed to launch default browser: %w", err)
	}
	return nil
}

// dashboardBrowser is the browser OpenBrowser opens dashboard pages with instead of the default
// one: Chrome's program on Windows when it is installed, else "".
func dashboardBrowser(goos string, getenv func(string) string, exists func(string) bool) string {
	if goos != "windows" {
		return ""
	}
	return findWindowsProgram([]string{windowsChrome}, getenv, exists)
}

// OpenPath opens a URL, file or folder with whatever the OS uses for it by default: the browser
// for a URL, the associated app for a file (e.g. a text editor for a .log), the file manager for
// a folder.
func OpenPath(target string) error {
	var cmd *exec.Cmd

	switch runtime.GOOS {
	case "windows":
		cmd = exec.Command("rundll32", "url.dll,FileProtocolHandler", target)
	case "darwin":
		cmd = exec.Command("open", target)
	default: // linux, bsd, etc.
		cmd = exec.Command("xdg-open", target)
	}

	if err := cmd.Start(); err != nil {
		return fmt.Errorf("failed to open %s: %w", target, err)
	}
	return nil
}

// GetLocalIP attempts to find the primary non-loopback outbound IPv4 address.
func GetLocalIP() string {
	conn, err := net.Dial("udp", "8.8.8.8:80")
	if err == nil {
		defer conn.Close()
		if localAddr, ok := conn.LocalAddr().(*net.UDPAddr); ok {
			return localAddr.IP.String()
		}
	}

	// Fallback to iterating network interfaces
	addrs, err := net.InterfaceAddrs()
	if err == nil {
		for _, addr := range addrs {
			if ipNet, ok := addr.(*net.IPNet); ok && !ipNet.IP.IsLoopback() {
				if ipNet.IP.To4() != nil {
					return ipNet.IP.String()
				}
			}
		}
	}

	return LoopbackIPv4
}
