package main

import "testing"

func TestSimTargetForListenAddr(t *testing.T) {
	tests := []struct {
		listenAddr string
		want       string
	}{
		{listenAddr: "0.0.0.0:20777", want: "127.0.0.1:20777"},
		{listenAddr: ":20778", want: "127.0.0.1:20778"},
		{listenAddr: "[::]:20779", want: "127.0.0.1:20779"},
		{listenAddr: "192.168.1.20:20777", want: "192.168.1.20:20777"},
		{listenAddr: "not-an-address", want: defaultTargetUDP},
	}

	for _, tt := range tests {
		if got := simTargetForListenAddr(tt.listenAddr); got != tt.want {
			t.Errorf("simTargetForListenAddr(%q) = %q, want %q", tt.listenAddr, got, tt.want)
		}
	}
}
