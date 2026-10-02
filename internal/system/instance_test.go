package system

import (
	"context"
	"encoding/json"
	"net"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestFindRunningInstance(t *testing.T) {
	tests := []struct {
		name    string
		handler http.HandlerFunc
		want    bool
	}{
		{
			name: "this app",
			handler: func(w http.ResponseWriter, r *http.Request) {
				if r.URL.Path != "/api/system/version" {
					http.NotFound(w, r)
					return
				}
				_ = json.NewEncoder(w).Encode(AppVersion{Version: "v1.2.3", Commit: "abc"})
			},
			want: true,
		},
		{
			name: "another web server",
			handler: func(w http.ResponseWriter, r *http.Request) {
				_, _ = w.Write([]byte("<html>hello</html>"))
			},
			want: false,
		},
		{
			name: "json without a version",
			handler: func(w http.ResponseWriter, r *http.Request) {
				_, _ = w.Write([]byte(`{"status":"ok"}`))
			},
			want: false,
		},
		{
			name: "error status",
			handler: func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusInternalServerError)
			},
			want: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			srv := httptest.NewServer(tt.handler)
			defer srv.Close()

			ver, got := FindRunningInstance(context.Background(), srv.URL+"/")
			if got != tt.want {
				t.Fatalf("FindRunningInstance() found = %v, want %v", got, tt.want)
			}
			if got && ver.Version != "v1.2.3" {
				t.Errorf("version = %q, want v1.2.3", ver.Version)
			}
		})
	}
}

func TestFindRunningInstance_NothingListening(t *testing.T) {
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	addr := ln.Addr().String()
	_ = ln.Close()

	if _, found := FindRunningInstance(context.Background(), "http://"+addr); found {
		t.Fatal("expected no instance on a closed port")
	}
}
