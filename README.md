# 🏎️ f1game-telemetry-go

> Real-time F1 25 / F1 26 telemetry analyzer and pit-wall dashboard built with Go, React, and SQLite.

![Go](https://img.shields.io/badge/Go-1.21+-00ADD8?style=flat&logo=go) ![License](https://img.shields.io/badge/License-MIT-green.svg)

---

## Features

- **UDP Telemetry Capture** — Listens for real-time telemetry packets from F1 25 / F1 26
- **SQLite Storage** — Persists session data, laps, telemetry traces, and session participants locally
- **Driver & Participant Metadata** — Stores driver names, team IDs, race numbers, and AI status per session
- **Modern Top Navigation Bar** — Premium sticky glassmorphic navigation header with reordered segmented tabs (1: **Session History**, 2: **Lap Comparator**, 3: **Live Session** with live pulse badge), app branding, persistent active tab memory, and real-time port indicator
- **Session Explorer & Historical Deep Dive** — Comprehensive historical session hub with aggregate KPI metrics (Total Sessions, Laps, Most Visited Circuit), visual Card Grid vs compact Data Table switcher, multi-attribute filtering (Track, Session Type, Weather) and column sorting. Features a 3-tab session deep-dive experience:
  - 🏆 **Classification & Laps**: P1/P2/P3 podium cards, driver standings with purple/green sector timing highlights, interactive tyre stint timelines with compound pills and lap counts, and interactive **"Slot A"** / **"Slot B"** staging chips with a persistent **Comparator Staging Dock** that enables staging and swapping laps without abrupt navigation before launching side-by-side telemetry comparison.
  - 📈 **Lap Progression & Gap Charts**: Interactive Recharts lap-by-lap pace chart (with driver toggle chips and pit-in/outlier scale optimizer), Lap Position evolution chart, and Gap to Leader delta chart.
  - ⚡ **Sector & Speed Matrix**: Session Ultimate Theoretical Lap record hero card, S1/S2/S3 sector rankings with delta to purple sector, and speed trap leaderboard with animated speed distribution bars.
  - 🤖 **AI Race Engineer Session Debrief**: Embedded slide-over drawer with real-time SSE streaming for instant strategic post-race debriefs, tyre degradation analysis, and sector improvement coaching.
- **Live Race Control Hub & Race Intelligence** — Dedicated live race center replacing single-car gauges with comprehensive session-level race control:
  - 📡 **Race Control & Incident Feed**: Real-time streaming timeline ticker for race events (Overtakes, Penalties, Fastest Laps, Pit In/Out, Safety Car/VSC deployments, and Retirements) with event filter chips and flag indicators.
  - 🌦️ **Weather Radar & Track Evolution**: Horizontal timeline forecast (+0m, +5m, +10m, +15m, +30m) with rain probability progress bars, air & track temperature trends, and tyre crossover strategy recommendations.
  - 🔧 **Pit Strategy & Field Tyre Matrix**: Session pit window monitoring (Ideal Lap, Latest Lap, Predicted Rejoin Position), active pitting counters, and field-wide tyre compound & stint age matrix with selected driver focus.
  - ⚡ **Live Sector Performance & Speed Traps**: Purple sector tracker (S1, S2, Fastest Lap), session theoretical ultimate best lap record, speed trap top 5 leaderboard, and driver split deltas.
- **Live Leaderboard Tower** — Full-width interactive standings tower with team color badges, driver numbers, interval deltas, tyre compounds, pit status, and Qualifying elimination cut-off markers. Selecting any driver synchronizes focus across all Race Control Hub panels.
- **Lap Comparison & Cross-Session Analysis** — High-performance lap analysis tool featuring dual Slot A & Slot B comparison cards, a **Link / Cross-Session** toggle (strictly filtered to the same track when comparing across sessions), rich searchable **Custom Lap Selectors** (with driver filter tabs, tyre compound badges, sector time breakdowns, personal best/fastest lap badges, and a "Valid Laps Only" toggle), server-side LTTB downsampling, 2-column layout with a sticky Track Map sidebar (smart outward corner offsetting, anti-collision turn badges, view mode switcher, and turn quick-jump ribbon), synchronized distance zoom toolbar, separated Throttle % and Brake % charts labeled with driver names, integrated ERS Battery % & ERS Deploy Mode (Off, Medium, Hotlap, Overtake) step charts, Sector split deltas, Quick-Select Driver Best Laps, Car Setup inspection, and real-time hover point telemetry readouts with contextual turn indicators
- **AI Race Engineer (Telemetry Chatbot)** — Interactive telemetry coaching assistant embedded directly in Lap Comparator. Analyzes driving delta, braking points, minimum corner apex speeds, throttle traction pickup, ERS battery deployment & DRS usage with real-time SSE streaming. Supports Google Gemini (default) and OpenAI / compatible endpoints with in-app settings or environment variables
- **Real-time WebSocket** — Stream live telemetry to the dashboard via WebSocket
- **Multi-format Support** — Focused exclusively on F1 2025 & F1 2026 DLC UDP packet formats for maximum performance and decoder accuracy

## Supported Operating Systems

| OS | Status | Notes |
|---|---|---|
| **Windows** | ✅ Supported (Windows 10 / 11) | Native support via PowerShell, CMD, Git Bash, or WSL. CGO-free pure Go SQLite (`modernc.org/sqlite`). |
| **macOS** | ✅ Supported (macOS 11+) | Apple Silicon (M-series) & Intel |
| **Linux** | ✅ Supported | Any modern x86_64 or ARM64 distribution |

## Quick Start

### Prerequisites

- [Go 1.21+](https://go.dev/dl/)
- [Node.js 18+](https://nodejs.org/) (for the frontend)

### Install & Run

#### Backend (Go)

##### Linux / macOS (using `make`):
```bash
# Clone the repository
git clone https://github.com/mgauna/f1game-telemetry-go.git
cd f1game-telemetry-go

# Build the binary
make build

# Run the backend server
make run
```

##### Windows (PowerShell / Command Prompt):
```powershell
# Clone the repository
git clone https://github.com/mgauna/f1game-telemetry-go.git
cd f1game-telemetry-go

# Option A: One-click runner (Auto-unblocks files, starts Backend + Frontend)
.\run.bat

# Option B: Manual run directly with Go
go run ./cmd/server
```

> **Windows Firewall & Security Note:** On your first run on Windows, `run.bat` will automatically set the PowerShell execution policy for the current user and unblock project binaries. Windows Defender Firewall may prompt you to allow network access: make sure to allow access for UDP port `20777` (for receiving F1 telemetry) and TCP port `8080` (for HTTP API & WebSocket dashboard stream).

#### Frontend (React)

In a new terminal window:

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser to view the dashboard.

## Game Configuration

To enable telemetry output from your F1 25 game:

1. Launch **F1 25** on your platform (PC / Windows, PlayStation, Xbox)
2. Go to **Settings** → **Telemetry Settings**
3. Set **UDP Telemetry** to **On**
4. Set **UDP Format** to **2025** (or **2026** if using the Season Pack DLC)
5. Set **UDP IP Address** to the IP of the machine running this server (use `127.0.0.1` if running on the same PC)
6. Set **UDP Port** to **20777**
7. Set **UDP Send Rate** to your preference (higher = more data)

## Configuration

Configuration is done via environment variables (or configured directly in the UI settings for AI):

| Variable | Description | Default |
|---|---|---|
| `F1T_UDP_ADDR` | UDP listener address | `0.0.0.0:20777` |
| `F1T_HTTP_ADDR` | HTTP server address | `:8080` |
| `GEMINI_API_KEY` | Google Gemini API Key for AI Race Engineer | *(Optional, can be set in UI)* |
| `OPENAI_API_KEY` | OpenAI API Key for AI Race Engineer | *(Optional, can be set in UI)* |
| `LLM_PROVIDER` | Default LLM provider (`gemini` or `openai`) | `gemini` |
| `LLM_MODEL` | Default LLM model identifier | `gemini-2.0-flash` |

Example:

```bash
# Linux / macOS:
F1T_UDP_ADDR=0.0.0.0:20777 F1T_HTTP_ADDR=:3000 GEMINI_API_KEY="AIzaSy..." make run

# Windows (PowerShell):
$env:F1T_UDP_ADDR="0.0.0.0:20777"; $env:F1T_HTTP_ADDR=":3000"; $env:GEMINI_API_KEY="AIzaSy..."; go run ./cmd/server
```

## Testing & Telemetry Simulation

You can test the application without needing the actual F1 game by running the built-in UDP telemetry simulator. You can easily switch between simulating a **Race** or **Qualifying** session:

### Linux / macOS (using `make`):
```bash
# Simulate a Race session (default):
make simulate

# Simulate a Qualifying session (Q1, Q2, Q3):
make simulate SESSION=quali
make simulate SESSION=q1
```

### Windows (PowerShell / CMD):
```powershell
# Simulate a Race session (default):
go run ./cmd/simulator -session race

# Simulate a Qualifying session:
go run ./cmd/simulator -session quali
go run ./cmd/simulator -session q1
```

This sends synthetic live telemetry packets (Session, Motion, Car Telemetry, Lap Data, Car Status, Participants Data) to port `20777` at 20Hz, allowing you to preview real-time telemetry, multi-car track visualization, participant standings, and WebSocket updates in the dashboard.

## Project Structure

```text
f1game-telemetry-go/
├── cmd/
│   ├── server/          # Application entry point
│   │   └── main.go
│   └── simulator/       # Synthetic UDP packet generator for testing
│       └── main.go

├── internal/
│   ├── api/             # HTTP server, REST endpoints, AI Race Engineer & WebSocket hub
│   ├── packets/         # F1 telemetry packet parsing and types
│   ├── session/         # Session tracking logic
│   ├── storage/         # SQLite persistence layer
│   └── udp/             # UDP listener and packet handling
├── frontend/            # React/Vite frontend application
├── Makefile
├── go.mod
├── README.md
├── CONTRIBUTING.md
└── LICENSE
```

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/` | Web dashboard |
| `GET` | `/ws` | WebSocket telemetry stream |
| `GET` | `/api/sessions` | List recorded sessions |
| `DELETE` | `/api/sessions/:id` | Delete a recorded session and all associated data |
| `GET` | `/api/sessions/:id/participants` | Get participant roster (drivers) for a session |
| `GET` | `/api/sessions/:id/setups` | Get car setups for a session |
| `GET` | `/api/sessions/:id/laps` | Get laps for a session |
| `GET` | `/api/laps/:id/telemetry` | Get telemetry for a lap (supports `?maxPoints=N` LTTB downsampling) |
| `POST` | `/api/ai/chat` | AI Race Engineer streaming telemetry chat endpoint (SSE) |
| `GET` | `/api/ai/config-status` | Get AI server environment key status |

> **Note:** API endpoints are planned and subject to change.

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
