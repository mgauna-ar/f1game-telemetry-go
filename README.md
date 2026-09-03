# 🏎️ F1 Telemetry

> High-performance real-time telemetry analyzer, pit wall dashboard, and AI race engineer for **EA Sports F1 25 & F1 26**.

[![Go](https://img.shields.io/badge/Go-1.21+-00ADD8?style=flat&logo=go)](https://go.dev/)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat&logo=react)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-5-646CFF?style=flat&logo=vite)](https://vitejs.dev/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

![F1 Telemetry Dashboard Demo](docs/assets/demo.gif)

---

## ✨ Key Features

### ⏱️ Live Pit Wall & Race Control
* **Dual View Modes:** Switch between the complete 2×2 Race Control Hub and a zero-overhead **Voice Cockpit Mode** built for maximum FPS on sim rigs and VR.
* **Live Leaderboard & Timing Tower:** Full-grid timing tower with interval deltas, tyre compounds, pit status, and live Active Aero / Boost indicators.
* **Dynamic Weather & Radar:** Live precipitation forecasts (+5m to +30m), track temperature trends, and tyre crossover recommendations.
* **Real-Time Incidents & Sectors:** Instant ticker tracking overtakes, penalties, safety cars, sector splits, speed traps, and theoretical best laps.

### 🔍 Lap Comparator & Track Map
* **Side-by-Side Telemetry:** Compare any two laps across Speed, Throttle, Brake, Gears, ERS, and 2026 Active Aero (`Corner` / `Straight` mode) & Boost traces.
* **Interactive Track Visualizer:** Synchronized circuit map with turn badges, apex speed deltas, and racing line overlays.
* **Server-Side Distance Merging:** High-performance distance-normalized grid (5m step) for pinpoint delta coaching.
* **Configurable Driver Defaults & Auto-Rival Matching:** Configure your default Reference pilot name and comparison targets (Fastest Lap / Leader with P2 tiebreaker, Teammate, or specific driver) with immediate re-evaluation and intelligent fallbacks.

### 📊 Session History & League Management
* **4-Tab Deep Dive:** Detailed analysis for Official Classification & Penalties, Lap Progression & Gap Charts, Tyre Strategy & Stint Degradation, and Speed/Sector Matrix.
* **League & Tag Organization:** Categorize sessions by league (*WOR*, *AOR*, *PSGL*) or weather setup with color chips and tag filtering.
* **Batch Operations & Portability:** Multi-select sessions to export to ZIP, bulk delete, or batch tag. Drag-and-drop import with duplicate detection.

### 🎙️ AI Race Engineer & Voice Radio
* **Hands-Free Global Push-to-Talk (PTT):** DirectInput support for steering wheels (Fanatec, Logitech, Moza, Simagic) and global keyboard shortcuts while driving in full-screen.
* **Proactive Pit Wall Calls:** Context-aware pit wall alerts for tyre wear/temperatures, aero damage, ERS deployment, fuel Lift & Coast, rival gaps, and safety cars.
* **Smart Driving Discretion:** Automatically suppresses non-critical radio chatter during heavy braking or corner apexes until reaching the straight.
* **Neural Voices & Personas:** Authentic pit wall personas (**Bono 🇬🇧**, **Franco Colapinto 🇦🇷**, or **Custom**) with realistic cockpit radio distortion, spatial audio filtering, and FOM harmonic beeps.
* **Bilingual Strategy & Debriefs:** Native bilingual support in **English** and **Español (Latinoamérica)** with streaming AI post-session debriefs.

---

## 🚀 Quick Start

Standalone pre-compiled release packages will be published under GitHub Releases with upcoming releases. In the meantime, you can launch or build the standalone application in seconds.

### Prerequisites
* [Go 1.21+](https://go.dev/dl/)
* [Node.js 18+](https://nodejs.org/)

---

### 💻 Launching & Building

#### One-Click Standalone Launch (Windows)
```powershell
.\run.bat
```
*Installs dependencies if needed, builds the embedded web assets, compiles, and launches the standalone single-binary application with automatic browser opening.*

#### Single-Binary Embedded Build (All Platforms)
```bash
# Build the complete standalone binary containing embedded web assets:
make build-embedded

# Run the single binary:
./bin/f1telemetry
```

#### Hot-Reload Dev Mode
```bash
# Terminal 1: Backend
make run      # or: go run ./cmd/server

# Terminal 2: Frontend (Hot Reload)
cd frontend && npm install && npm run dev
```

Open **[http://localhost:5173](http://localhost:5173)** in your browser for live Vite development.

---

## 🎮 F1 Game Configuration

To stream telemetry from your game (PC, PlayStation, or Xbox):

1. Open **F1 25** (or **F1 26**) and navigate to **Game Options** → **Settings** → **Telemetry Settings**.
2. Configure the following options:
   * **UDP Telemetry:** `On`
   * **UDP Format:** `2025` *(or `2026` for Season Pack DLC)*
   * **UDP IP Address:** IP address of the machine running this application (`127.0.0.1` if playing on the same PC)
   * **UDP Port:** `20777`
   * **UDP Send Rate:** `20Hz` *(Recommended for optimal storage savings and smooth 60 FPS charts; 60Hz is also fully supported)*

---

## 🧪 Test with Built-in Simulator

You don't need the game open to test and explore the dashboard! Use the built-in UDP telemetry simulator to broadcast synthetic telemetry:

```bash
# Linux / macOS:
make simulate                # Simulate a full Race (default F1 2026, 24-car grid)
make simulate SESSION=quali  # Simulate a Qualifying session
make simulate FORMAT=2025    # Use F1 2025 format (22-car grid)

# Windows:
.\simulate.bat               # Or: go run ./cmd/simulator -session race
```

#### Scenario Flags (for testing the Voice Race Engineer)

Trigger specific in-race situations to test proactive radio alerts without waiting for them to happen naturally:

```bash
go run ./cmd/simulator -scenario wear      # Tyres start at 38.5% → triggers tyre deg alerts quickly
go run ./cmd/simulator -scenario sc        # Deploys a Full Safety Car → tests SC radio call
go run ./cmd/simulator -scenario vsc       # Deploys Virtual Safety Car (VSC)
go run ./cmd/simulator -scenario rain      # Injects rain forecast → tests weather crossover alert
```

---

## ⚙️ Configuration (Optional)

Configure server ports or AI API keys via environment variables (or directly within the in-app AI settings drawer):

| Variable | Description | Default |
|---|---|---|
| `F1T_UDP_ADDR` | UDP telemetry listener address | `0.0.0.0:20777` |
| `F1T_HTTP_ADDR` | Web API & WebSocket server address | `:8080` |
| `GEMINI_API_KEY` | Google Gemini API Key for AI Race Engineer | *(Can be set in UI)* |
| `OPENAI_API_KEY` | OpenAI API Key for AI Race Engineer | *(Can be set in UI)* |

---

## 🤝 Contributing & Release Process

Contributions are welcome! Please check out:
* **[CONTRIBUTING.md](CONTRIBUTING.md)**: Development guidelines and PR workflows.
* **[RELEASE.md](RELEASE.md)**: Release lifecycle, SemVer rules, and automated publishing guide.
* **[CHANGELOG.md](CHANGELOG.md)**: Full release history and notable changes.

---

## ⚠️ Disclaimer

This project is an unofficial, open-source community tool developed for educational, telemetry analysis, and league racing purposes. It is **not** affiliated with, endorsed by, or associated with Electronic Arts Inc., Codemasters, or Formula One World Championship Limited. 

*F1*, *FORMULA ONE*, *FORMULA 1*, *FIA FORMULA ONE WORLD CHAMPIONSHIP*, and related logos and marks are trademarks of Formula One Licensing B.V. All game titles, screenshots, and car data are property of their respective owners.

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.


