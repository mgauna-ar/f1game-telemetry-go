# 🏎️ f1game-telemetry-go

> Real-time F1 25 / F1 26 telemetry analyzer and pit-wall dashboard built with Go, React, and SQLite.

![Go](https://img.shields.io/badge/Go-1.21+-00ADD8?style=flat&logo=go) ![License](https://img.shields.io/badge/License-MIT-green.svg)

---

## Features

- **UDP Telemetry Capture** — Listens for real-time telemetry packets from F1 25 / F1 26
- **SQLite Storage** — Persists session data, laps, telemetry traces, and session participants locally
- **Driver & Participant Metadata** — Stores driver names, team IDs, race numbers, and AI status per session
- **Pit Wall Command Center UI** — Browser-based interface featuring session status (Track name, Weather, Safety Car flags, Session type, Countdown/Total laps)
- **Live Leaderboard Tower** — Real-time standings tower with team color badges, driver numbers, interval deltas, tyre compounds, pit status, and Qualifying elimination cut-off markers
- **Car Damage & Tire Wear Telemetry** — Live monitoring of 4-wheel tyre wear %, aero damage (wings, floor, diffuser), brake wear, gearbox/engine component health, and DRS/ERS faults
- **Car Setup Telemetry** — Stored setup telemetry for aerodynamics (wings), suspension & anti-roll bars, geometry (camber/toe), brake bias/pressure, and tyre pressures in Lap Analysis
- **Car Status & Strategy Telemetry** — Live monitoring of ERS Store Energy %, ERS deployment modes, fuel remaining in kg, and tyre compound age
- **Lap Comparison** — High-performance lap analysis tool featuring server-side LTTB downsampling, 2-column layout with a sticky Track Map sidebar, synchronized distance zoom toolbar, separated Throttle % and Brake % charts labeled with driver names, integrated ERS Battery % & ERS Deploy Mode (Off, Medium, Hotlap, Overtake) step charts, Sector split deltas, Quick-Select Driver Best Laps, Car Setup inspection, and real-time hover point telemetry readouts
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

Configuration is done via environment variables:

| Variable | Description | Default |
|---|---|---|
| `F1T_UDP_ADDR` | UDP listener address | `0.0.0.0:20777` |
| `F1T_HTTP_ADDR` | HTTP server address | `:8080` |

Example:

```bash
# Linux / macOS:
F1T_UDP_ADDR=0.0.0.0:20777 F1T_HTTP_ADDR=:3000 make run

# Windows (PowerShell):
$env:F1T_UDP_ADDR="0.0.0.0:20777"; $env:F1T_HTTP_ADDR=":3000"; go run ./cmd/server
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
│   ├── api/             # HTTP server, REST endpoints and WebSocket hub
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

> **Note:** API endpoints are planned and subject to change.

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
