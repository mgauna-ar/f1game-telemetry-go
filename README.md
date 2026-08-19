# 🏎️ F1 Telemetry

> High-performance real-time telemetry analyzer, pit wall dashboard, and AI race engineer for **EA Sports F1 25 & F1 26**.

[![Go](https://img.shields.io/badge/Go-1.21+-00ADD8?style=flat&logo=go)](https://go.dev/)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat&logo=react)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-5-646CFF?style=flat&logo=vite)](https://vitejs.dev/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

![F1 Telemetry Dashboard Demo](docs/assets/demo.gif)

---

## ✨ Key Features

### ⏱️ Live Pit Wall & Race Control Hub
* **Live Incident Feed:** Real-time event ticker tracking overtakes, penalties, fastest laps, pit stops, and Safety Car / VSC deployments with flag indicators.
* **Weather Radar & Tyre Strategy:** Live precipitation forecast (+5m to +30m), air/track temperatures, and tyre compound crossover advice.
* **Live Leaderboard Tower:** Full-grid timing tower with interval deltas, tyre compounds, pit status, and Qualifying elimination cut-off lines.
* **Sector Tracker & Speed Traps:** Live purple/green sector splits, theoretical ultimate best lap record, and top speed rankings.

### 🔍 Telemetry Comparator & Track Map
* **Side-by-Side Analysis:** Compare any two laps (personal bests, rival drivers, or cross-session runs) across Speed, Throttle, Brake, ERS, Gear traces, and 2026 **Active Aero** (`Corner` vs `Straight` mode) & **Boost** deployment.
* **Format-Adaptive Modes:** Automatically adapts ERS Deploy Mode telemetry semantics between F1 2025 (*Overtake*) and F1 2026 (*Boost*).
* **Interactive Track Map:** Sticky circuit visualizer with turn-by-turn badges, racing line synchronization, and real-time hover point readouts.
* **Delta Coaching:** Instant visual gap charts and braking/apex speed difference indicators.

### 📊 Session History & League Management
* **Data Table Explorer:** Streamlined session repository featuring sortable metadata (Date/Time, Track with High-DPI country flag badges, Type/Format, Duration, Tags, Weather, and Actions), fast filters, and 4-tab session deep-dive: Official Classification, Lap Progression & Gap Charts, Tyre Strategy & Stints, and Sector & Speed Matrix.
* **Batch Operations & Floating Action Dock:** Multi-select sessions via table checkboxes with indeterminate select-all to trigger bulk operations from the floating glassmorphic dock: **Export ZIP** (bundling selected sessions as `.f1session` packages inside a `.zip`), **Batch Deletion**, and **Batch Tag Assignment**.
* **Session Portability & Multi-File Import:** 1-click export of individual sessions (`.f1session`) or bulk ZIP archives (`.zip`), and multi-file drag-and-drop import supporting `.zip` extraction and multiple `.f1session` files with duplicate detection and toast summary reports.
* **Tyre Strategy & Stints Analytics:** Interactive field stint Gantt timeline with hover telemetry stats, pit markers, and tyre degradation & pace curves plotted by tyre age with calculated deg rates (s/lap).
* **Country Flag Visual Identity & Search:** Crisp vector SVG country flags with localized hover tooltips across all views (Session History, Comparator, Live Wall, AI Engineer), with country name and ISO code search support (e.g., searching `Italy`, `ITA`, or `Monza`).
* **Multi-Tag Organization:** Categorize sessions by league (e.g. *WOR*, *AOR*, *PSGL*), tier, or custom wet/dry setups with motorsport color chips and horizontal filter bar.


### 🤖 AI Race Engineer (EN / ES)
* **Real-Time Strategy & Post-Race Debriefs:** Streaming AI debriefs analyzing telemetry deltas, tyre degradation, braking points, and traction pickup.
* **Bilingual Coaching:** Full native support in **English 🇬🇧** and **Español (Latinoamérica) 🇦🇷** using authentic motorsport terminology.
* **LLM Provider Flexibility:** Works out-of-the-box with Google Gemini (default) or OpenAI / custom LLM endpoints (configured directly in UI settings).

---

## 🚀 Quick Start

### 🏎️ For Gamers & League Racers (Zero Setup Required)

**No programming knowledge, Go, or Node.js required!**

1. Go to **[GitHub Releases](../../releases/latest)** and download the archive for your operating system:
   * **Windows:** `f1telemetry_vX.X.X_windows_amd64.zip` (or `windows_arm64.zip`)
   * **macOS:** `f1telemetry_vX.X.X_darwin_arm64.zip` (Apple Silicon M1-M4) or `darwin_amd64.zip` (Intel)
   * **Linux:** `f1telemetry_vX.X.X_linux_amd64.tar.gz` (or `linux_arm64.tar.gz`)
2. Extract the archive.
3. **Double-click `f1telemetry.exe`** (or run `./f1telemetry` on Mac/Linux).
4. Your default web browser will automatically open **[http://localhost:8080](http://localhost:8080)** with the full pit wall dashboard ready!

---

### 💻 For Developers (Running from Source)

#### Prerequisites
* [Go 1.21+](https://go.dev/dl/)
* [Node.js 18+](https://nodejs.org/)

#### One-Click Developer Launch (Windows)
```powershell
.\run.bat
```
*Installs frontend dependencies on first run and starts both backend and frontend development servers.*

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
   * **UDP Send Rate:** `20Hz` or higher

---

## 🧪 Test with Built-in Simulator

You don't need the game open to test and explore the dashboard! Use the built-in UDP telemetry simulator to broadcast synthetic telemetry:

```bash
# Linux / macOS:
make simulate                # Simulate a full Race (default)
make simulate SESSION=quali  # Simulate a Qualifying session

# Windows:
.\simulate.bat               # Or: go run ./cmd/simulator -session race
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


