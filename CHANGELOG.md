# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- **Interactive Voice Race Engineer & Push-to-Talk (PTT)**: Two-way radio via Gamepad/wheel and keyboard `Space`, realistic cockpit audio FX, FOM harmonic beeps, driver call-sign personalization, and multi-language neural voices (Bono, Colapinto, Custom).
- **Proactive Pit Wall Telemetry Watcher**: Real-time server-side insight engine monitoring 9 subsystems (tyres, damage, ERS, brakes, fuel, rivals/DRS, coaching, qualy, and weather) with smart driving discretion and 2025/2026 regulation awareness.
- **Voice Cockpit Mode**: Distraction-free live dashboard mode with 0% DOM/canvas rendering overhead and vital telemetry strip for high-FPS sim rigs and VR.
- **10Hz Telemetry Broadcaster & Store**: Consolidated 10Hz live snapshot streaming and decoupled Zustand store for optimal UI performance.
- **System Version & Update Checker**: In-app version indicator in top navigation bar and OS-filtered release asset downloads.
- **Zero-Dependency Standalone Releases**: Single native executable with embedded production React frontend (`//go:embed`), auto-launching default browser on startup with zero prerequisites (no Go or Node.js required by end users).
- **Custom Windows Executable Icon & Manifest**: High-resolution F1 tachometer application icon embedded on-the-fly into `f1telemetry.exe` with Per-Monitor V2 DPI awareness and Windows 10/11 compatibility.
- **Automated GitHub Actions Release CI/CD**: Cross-platform compilation matrix publishing `.zip` (Windows & macOS) and `.tar.gz` (Linux) packages with SHA-256 checksums on semantic git tags (`v*.*.*`).
- **Live Pit Wall & Race Control Hub**:
  - Real-time incident ticker tracking overtakes, penalties, fastest laps, and SC / VSC flags.
  - Weather radar and tyre compound crossover recommendations.
  - Full-grid timing leaderboard tower with live Active Aero (`Corner` / `Straight` mode) and Boost indicators.
  - Sector tracker with theoretical ultimate best lap and speed trap rankings.
- **Lap Comparator & Track Map**:
  - Side-by-side telemetry comparison across Speed, Throttle, Brake, Gears, ERS, and 2026 Active Aero & Boost traces.
  - Year-aware ERS semantics (F1 2025 *Overtake* vs F1 2026 *Boost*).
  - Synchronized track map visualizer with turn badges and live apex speed deltas.
- **Session History & League Organization**:
  - Customizable multi-tag system for leagues (*WOR*, *AOR*, *PSGL*) with color chips and horizontal filter bar.
  - Glassmorphic data table with multi-selection dock for batch ZIP export, bulk deletion, and bulk tagging.
  - High-DPI crisp vector country flags with localized hover tooltips and ISO search.
  - 4-tab deep dive: Classification, Lap Progression, Tyre Strategy & Stint Gantt timeline, and Sector/Speed Matrix.
- **AI Race Engineer**:
  - Persistent, non-modal floating chat widget with streaming SSE telemetry ingestion.
  - Native bilingual support in **English 🇬🇧** and **Español (Latinoamérica) 🇦🇷**.
  - Multi-LLM provider compatibility (Google Gemini, OpenAI, custom endpoints).

### Fixed
- **Qualifying Tyre Stints**: Corrected stint progression during qualifying sessions via tyre set change events (`PacketTyreSets`).
- **Position Progression & Dynamic Standings**: Fixed a bug where final classification packets (`PacketFinalClassificationData`) overwrote every past lap's `car_position` in SQLite with the driver's final finishing position, causing flat horizontal lines in historical session charts.
- **Race Progression Dynamic Reconstruction**: Enhanced `SessionLapChartsTab` to dynamically compute running race order from cumulative elapsed race times (`sum(lap_time_ms)`) or dynamic positions, accurately reflecting on-track overtakes, pit stop overcuts/undercuts, and lead changes for all historical sessions.
- **Qualifying & Practice Progression**: Dynamically calculates running standings order across laps based on each driver's best valid lap time achieved up to that lap.
- **Gap to Leader Evolution**: Dynamically calculates the true session leader at each specific lap $k$ and computes accurate positive deltas (`+X.XXXs`) relative to that lap's actual leader.

---

[Unreleased]: https://github.com/mgauna-ar/f1game-telemetry-go/commits/main
