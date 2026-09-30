package main

import (
	"testing"

	"github.com/mgauna/f1game-telemetry-go/internal/engineer"
	"github.com/mgauna/f1game-telemetry-go/internal/session"
)

func TestGapTrendSourceWithoutLapData(t *testing.T) {
	source := gapTrendSource(engineer.NewEngineerEngine(nil))
	if ahead, behind := source(); ahead != nil || behind != nil {
		t.Errorf("expected no trends, got %+v %+v", ahead, behind)
	}
}

func TestLiveGapTrendRoundsToMilliseconds(t *testing.T) {
	got := liveGapTrend(&engineer.GapTrend{CarIdx: 4, PerLapSec: -0.1234, Laps: 3})
	want := session.LiveGapTrend{CarIndex: 4, ChangePerLapMS: -123, Laps: 3}
	if got == nil || *got != want {
		t.Errorf("liveGapTrend = %+v, want %+v", got, want)
	}
	if liveGapTrend(nil) != nil {
		t.Error("liveGapTrend(nil) should be nil")
	}
}
