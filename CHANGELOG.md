# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Planned
- Custom user telemetry layouts and modular telemetry gauge docks.
- Voice-activated debrief triggers for the AI Race Engineer.

---

## [1.0.0-rc.1] - 2026-08-19

### Added
- **Zero-Dependency Standalone Releases**: Single native executable with embedded production React frontend (`//go:embed`), auto-launching default browser on startup with zero prerequisites (no Go or Node.js required by end users).
- **In-App Auto-Update Checks & "What's New" Modal**: Automatic startup check against GitHub Releases API with a top-bar notification chip, markdown changelog preview, and 1-click downloads for Windows, macOS, and Linux.
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

---

[Unreleased]: https://github.com/mgauna/f1game-telemetry-go/compare/v1.0.0-rc.1...HEAD
[1.0.0-rc.1]: https://github.com/mgauna/f1game-telemetry-go/releases/tag/v1.0.0-rc.1
