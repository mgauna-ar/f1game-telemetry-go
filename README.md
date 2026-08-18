# 🏎️ F1 Telemetry

> High-performance real-time telemetry analyzer, pit wall dashboard, and AI race engineer for **EA Sports F1 25 & F1 26**.

[![Go](https://img.shields.io/badge/Go-1.21+-00ADD8?style=flat&logo=go)](https://go.dev/)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat&logo=react)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-5-646CFF?style=flat&logo=vite)](https://vitejs.dev/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

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
* **Data Table Explorer:** Streamlined session repository featuring sortable metadata (Date/Time, Track, Type/Format, Duration, Tags, Weather, and Actions), fast filters, and deep-dive session classification, tyre stint timelines, and lap progression charts.
* **Multi-Tag Organization:** Categorize sessions by league (e.g. *WOR*, *AOR*, *PSGL*), tier, or custom wet/dry setups with motorsport color chips and horizontal filter bar.
* **Session Portability:** 1-click export and import of complete sessions via compressed `.f1session` packages.

### 🤖 AI Race Engineer (EN / ES)
* **Real-Time Strategy & Post-Race Debriefs:** Streaming AI debriefs analyzing telemetry deltas, tyre degradation, braking points, and traction pickup.
* **Bilingual Coaching:** Full native support in **English 🇬🇧** and **Español (Latinoamérica) 🇦🇷** using authentic motorsport terminology.
* **LLM Provider Flexibility:** Works out-of-the-box with Google Gemini (default) or OpenAI / custom LLM endpoints (configured directly in UI settings).

---

## 🚀 Quick Start

### Prerequisites
* [Go 1.21+](https://go.dev/dl/)
* [Node.js 18+](https://nodejs.org/)

---

### Windows

**Option A — One-Click Setup (Recommended):**
Double-click `run.bat` or run:
```powershell
.\run.bat
```
*This automatically unblocks scripts, installs frontend dependencies on first run, and launches both backend and frontend servers.*

**Option B — Manual Setup:**
```powershell
# 1. Start Backend (Terminal 1)
go run ./cmd/server

# 2. Start Frontend (Terminal 2)
cd frontend
npm install
npm run dev
```

---

### macOS / Linux

```bash
# 1. Start Backend (Terminal 1)
make run

# 2. Start Frontend (Terminal 2)
cd frontend
npm install
npm run dev
```

Open **[http://localhost:5173](http://localhost:5173)** in your browser to access the dashboard.

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

## 🤝 Contributing

Contributions are welcome! Please check out [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines, branch naming conventions, and development workflows.

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
