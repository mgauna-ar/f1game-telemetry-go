package main

import (
	"slices"
	"testing"
)

func TestRestartArgs(t *testing.T) {
	tests := []struct {
		name string
		args []string
		want []string
	}{
		{name: "nothing set", args: nil, want: nil},
		{
			name: "keeps the database, ports, tray choice and sign-in start",
			args: []string{"-db", "relative.db", "-http", ":8090", "-no-tray", "-autostart"},
			want: []string{"-autostart=true", "-db=relative.db", "-http=:8090", "-no-tray=true"},
		},
		{
			name: "drops browser and version flags",
			args: []string{"-open-browser", "-no-browser", "-version", "-udp=0.0.0.0:20778"},
			want: []string{"-udp=0.0.0.0:20778"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {

			if got := restartArgs(serverFlags(t, tt.args)); !slices.Equal(got, tt.want) {
				t.Errorf("restartArgs() = %q, want %q", got, tt.want)
			}
		})
	}
}
