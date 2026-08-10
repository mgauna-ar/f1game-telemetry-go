# 🏎️ f1game-telemetry-go

> Real-time F1 25 / F1 26 telemetry analyzer written in Go

![Go](https://img.shields.io/badge/Go-1.21+-00ADD8?style=flat&logo=go) ![License](https://img.shields.io/badge/License-MIT-green.svg)

---

## Features

- **UDP Telemetry Capture** — Listens for real-time telemetry packets from F1 25 / F1 26
- **SQLite Storage** — Persists session data, laps, telemetry traces, and session participants locally
- **Driver & Participant Metadata** — Stores driver names, team IDs, race numbers, and AI status per session
- **Web Dashboard** — Browser-based interface for live data visualization
- **Lap Comparison** — Compare lap times, sector splits, and telemetry traces
- **Real-time WebSocket** — Stream live telemetry to the dashboard via WebSocket
- **Multi-format Support** — Supports both 2025 & 2026 UDP packet formats
- **Live Track Mini-Map** — Real-time visualization of the car's position on the circuit

## Quick Start

### Prerequisites

- [Go 1.21+](https://go.dev/dl/)
- [Node.js 18+](https://nodejs.org/) (for the frontend)

### Install & Run

#### Backend (Go)

```bash
# Clone the repository
git clone https://github.com/mgauna/f1game-telemetry-go.git
cd f1game-telemetry-go

# Build the binary
make build

# Run the backend server
make run
```

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

1. Launch **F1 25** on your platform
2. Go to **Settings** → **Telemetry Settings**
3. Set **UDP Telemetry** to **On**
4. Set **UDP Format** to **2025** (or **2026** if using the Season Pack DLC)
5. Set **UDP IP Address** to the IP of the machine running this server
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
F1T_UDP_ADDR=0.0.0.0:20777 F1T_HTTP_ADDR=:3000 make run
```

## Testing & Telemetry Simulation

You can test the application without needing the actual F1 game by running the built-in UDP telemetry simulator:

```bash
# In a separate terminal while the server is running:
make simulate
```

This sends synthetic live telemetry packets (Motion, Car Telemetry, Lap Data) to port `20777` at 20Hz, allowing you to preview real-time telemetry, track visualization, and WebSocket updates in the dashboard.

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
| `GET` | `/api/sessions/:id/participants` | Get participant roster (drivers) for a session |
| `GET` | `/api/sessions/:id/laps` | Get laps for a session |
| `GET` | `/api/laps/:id/telemetry` | Get telemetry for a lap |
| `GET` | `/api/laps/:id/export` | Export lap and telemetry as a Ghost Lap JSON |
| `POST` | `/api/laps/import` | Import a Ghost Lap JSON file |

> **Note:** API endpoints are planned and subject to change.

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
