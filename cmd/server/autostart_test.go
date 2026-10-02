package main

import (
	"flag"
	"slices"
	"testing"
)

func TestAutostartArgs(t *testing.T) {
	const absDB = `C:\Users\me\F1 Telemetry\f1telemetry.db`
	tests := []struct {
		name string
		args []string
		want []string
	}{
		{
			name: "nothing set",
			args: nil,
			want: []string{"-db=" + absDB},
		},
		{
			name: "keeps ports and tray choice",
			args: []string{"-http", ":8090", "-udp=0.0.0.0:20778", "-no-tray"},
			want: []string{"-http=:8090", "-no-tray=true", "-udp=0.0.0.0:20778", "-db=" + absDB},
		},
		{
			name: "replaces db and drops browser flags",
			args: []string{"-db", "relative.db", "-open-browser", "-no-browser", "-version"},
			want: []string{"-db=" + absDB},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			fs := flag.NewFlagSet("test", flag.ContinueOnError)
			fs.String("http", ":8080", "")
			fs.String("udp", "0.0.0.0:20777", "")
			fs.String(flagDB, "f1telemetry.db", "")
			fs.Bool(flagOpenBrowser, false, "")
			fs.Bool(flagNoBrowser, false, "")
			fs.Bool("no-tray", false, "")
			fs.Bool(flagVersion, false, "")
			if err := fs.Parse(tt.args); err != nil {
				t.Fatal(err)
			}

			if got := autostartArgs(fs, absDB); !slices.Equal(got, tt.want) {
				t.Errorf("autostartArgs() = %q, want %q", got, tt.want)
			}
		})
	}
}
