---
name: regenerate-readme-gif
description: Deterministically regenerate docs/assets/demo.gif for README.md using an isolated Go backend, 20Hz UDP simulator, seeded F1 2026 sessions, headless Chrome (CDP), and 2-pass ffmpeg Lanczos palette encoding without external npm packages or live LLM API keys.
---

# Regenerate README Demo GIF (`docs/assets/demo.gif`)

Use this skill whenever `docs/assets/demo.gif` (embedded at the top of `README.md`) needs to be refreshed after UI/UX updates, new dashboard tabs, or telemetry visualization changes.

## Prerequisites

Ensure the following tools are available on the machine:
- **Go 1.26+** (`go version`)
- **Node.js 22+** (`node --version` — uses built-in `fetch` and `WebSocket`, zero external npm packages required)
- **FFmpeg & FFprobe** (`ffmpeg -version`, `ffprobe -version`)
- **Google Chrome / Chromium** (auto-detected on macOS, Linux, and Windows, or specified via `--chrome <path>` / `CHROME_BIN`)

## Quick Start (One Command)

From the repository root:

```bash
make demo-gif
```

Or invoke the generator script directly:

```bash
node .agents/skills/regenerate-readme-gif/scripts/generate-demo-gif.mjs
```

## CLI Options

`generate-demo-gif.mjs` accepts the following optional flags:

| Flag | Default | Description |
| :--- | :--- | :--- |
| `--output <path>` | `docs/assets/demo.gif` | Output GIF path (relative to repo root or absolute). |
| `--width <px>` | `900` | Target GIF width in pixels. |
| `--height <px>` | `600` | Target GIF height in pixels. |
| `--fps <num>` | `8` | Output frame rate (frames per second). |
| `--skip-build` | `false` | Skip running `npm --prefix frontend run build` when `frontend/dist` is already up to date. |
| `--chrome <path>` | *(auto-detected)* | Explicit path to the Chrome/Chromium executable (or set `CHROME_BIN`). |
| `--keep-temp` / `--keep-frames` | `false` | Keep the temporary directory containing raw PNG frames, palette, and SQLite DB for debugging. |

## How the Pipeline Works

1. **Production Frontend Build:** Builds `frontend/dist` (unless `--skip-build` is passed) and compiles isolated `cmd/server` and `cmd/simulator` binaries into a temporary directory so `//go:embed` serves the latest assets.
2. **Isolated Backend & SQLite DB:** Starts `cmd/server` against a temporary SQLite database on isolated HTTP and UDP ports (`-no-browser`), leaving any local `f1telemetry.db` untouched.
3. **Frameless Headless Chrome via CDP:** Launches Chrome with `--headless=new` at a desktop viewport (`1200x800` for `900x600` output, preserving aspect ratio above the `1100px` `--laptop` breakpoint) and injects deterministic `Page.addScriptToEvaluateOnNewDocument` stubs for:
   - `/api/system/network` (displays standard `UDP 20777` and LAN IP in the header)
   - `/api/system/version` and `/api/system/check-updates` (displays clean release version metadata)
   - `/api/settings/ai`, `/api/ai/chat`, and `/api/ai/tts` (streams deterministic SSE Markdown debriefs and corner analyses plus a silent WAV buffer so AI features and voice radio HUD states work 100% offline without API keys)
4. **Phase A — Live 20Hz Telemetry Capture:**
   - Runs `cmd/simulator -format 2026 -scenario rain` to stream 20Hz F1 2026 packets (22 active cars + Active Aero/Boost + weather forecast + race-control events).
   - Captures **Scene 1 (`/live/dashboard`)**: 2×2 Race Control Hub, full-grid timing tower, weather radar, pit strategy, sector tracker, and `LiveRadioHUD` (`BONO SPEAKING` waveform).
   - Captures **Scene 2 (`/live/cockpit`)**: Voice Cockpit Mode with `HeroPersonaBadge`, live pit-wall radio transcript, and `VitalTelemetryStrip`.
   - Stops the simulator and deletes its transient 0-lap session (`DELETE /api/sessions/{id}`) so recorded views stay clean.
5. **Phase B — Deterministic 2026 Session Seeding & Recorded Capture:**
   - Seeds 7 F1 2026 sessions via `POST /api/sessions/import` (`ExportedSessionPackage` JSON), led by an 18-lap race at **Spa-Francorchamps** (22-car 2026 grid, `Soft ➔ Medium` stints, Safety Car on Laps 6–8, race-control feed events, and closed-loop 8-corner telemetry samples with `Curvature > 0.006 rad/m`, braking points, apex speed minima, throttle pickup, and 2026 `ActiveAeroMode`/`OvertakeActive` traces) plus 3 earlier Spa sessions and 3 multi-track sessions (`Silverstone`, `Monza`, `Zandvoort`).
   - Captures **Scene 3 (`/history`)**: Multi-track session list with `Your result` badges, `F1 26` badges, weather forecasts, and league/setup tags.
   - Captures **Scene 4 (`/history/:id`)**: **Story** tab (`YourRaceCard`, `FieldPaceChart` with SC shading, `KeyMomentsTimeline`, and streaming AI debrief in `SessionDebriefPanel`).
   - Captures **Scene 5 (`/history/:id/classification` & `/history/:id/stints`)**: Classification Gap/Interval toggle, `StrategyKPICards`, `StintGanttTimeline`, `DegradationTable`, and `DegradationCurves` with hollow excluded-lap dots.
   - Captures **Scene 6 (`/compare`)**: Track Map with `T1`–`T8` turn badges, **Where Did I Lose Time** (`CornerTable`), **Strip Charts** (`StripCharts` with 2026 Active Aero trace), corner zoom, and **Ask AI** streaming corner telemetry analysis in `AiRaceEngineer`.
   - Captures **Scene 7 (`/progress/Spa-Francorchamps`)**: Headline `ProgressStats` cards, `All | Race | Qualifying` filter, and multi-session `Best Lap & Sectors` and `Consistency` trend charts.
6. **Two-Pass FFmpeg Encoding:** Downsamples frames with `flags=lanczos`, generates a diff-optimized palette (`palettegen=stats_mode=diff`), and encodes the looping GIF (`paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle`).

## Customizing Scenes

To add or adjust scenes when new UI features are introduced:
1. Open `.agents/skills/regenerate-readme-gif/scripts/generate-demo-gif.mjs`.
2. Locate `captureWalkthrough()` where Scenes 1–7 are orchestrated.
3. Use `navigateSpa(cdp, path)` for client-side route transitions and `captureFrames(cdp, framesDir, count, intervalMs)` to record smooth animations.
4. Keep total frame count around `120–150` frames at `8 fps` so the resulting GIF stays under `8 MB`.

## Post-Generation Verification

After running the skill, verify the output GIF:

```bash
ffprobe -v error -select_streams v:0 \
  -show_entries stream=width,height,nb_frames,duration \
  -show_entries format=size \
  -of default=noprint_wrappers=1 docs/assets/demo.gif
```

Confirm:
- `width=900` and `height=600` (unless custom dimensions were passed)
- `nb_frames` ≥ 100
- `size` < 8,000,000 bytes (`< 8 MB`)
