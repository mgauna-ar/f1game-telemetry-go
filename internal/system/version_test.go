package system

import (
	"testing"
)

func TestCompareSemVer(t *testing.T) {
	tests := []struct {
		v1   string
		v2   string
		want int
	}{
		{"v1.0.0", "v1.0.0", 0},
		{"1.0.0", "1.0.0", 0},
		{"v1.1.0", "v1.0.0", 1},
		{"v1.0.1", "v1.0.0", 1},
		{"v2.0.0", "v1.9.9", 1},
		{"v1.0.0", "v1.1.0", -1},
		{"v1.0.0", "v1.0.1", -1},
		{"v1.0.0", "v1.0.0-beta.1", 1},        // Stable > Pre-release
		{"v1.0.0-beta.1", "v1.0.0", -1},       // Pre-release < Stable
		{"v1.0.0-beta.2", "v1.0.0-beta.1", 1}, // Beta 2 > Beta 1
		{"v1.0.0-beta.1", "v1.0.0-beta.2", -1},
		{"v1.0.0-rc.1", "v1.0.0-beta.5", 1},  // rc > beta
		{"v0.9.0", "v1.0.0-beta.1", -1},      // Major version overrides pre-release
		{"v1.0.1", "v1.0.1-35-g48f0b96", -1}, // Official tag 1.0.1 is older than local dev build with 35 commits ahead
		{"v1.0.1-35-g48f0b96", "v1.0.1", 1},
		{"v1.0.2", "v1.0.1-35-g48f0b96", 1}, // Newer minor/patch tag 1.0.2 is greater than 1.0.1+35 commits
		{"v1.0.1-35-g48f0b96", "v1.0.1-10-g1234567", 1},
		{"v1.0.1-10-g1234567", "v1.0.1-35-g48f0b96", -1},
	}

	for _, tt := range tests {
		t.Run(tt.v1+"_vs_"+tt.v2, func(t *testing.T) {
			got := CompareSemVer(tt.v1, tt.v2)
			if got != tt.want {
				t.Errorf("CompareSemVer(%q, %q) = %d, want %d", tt.v1, tt.v2, got, tt.want)
			}
		})
	}
}
