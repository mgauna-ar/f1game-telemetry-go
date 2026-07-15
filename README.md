# 🏎️ f1game-telemetry-go

> Real-time F1 25 / F1 26 telemetry analyzer written in Go

![Go](https://img.shields.io/badge/Go-1.21+-00ADD8?style=flat&logo=go) ![License](https://img.shields.io/badge/License-MIT-green.svg)

---

## Features

- **UDP Telemetry Capture** — Listens for real-time telemetry packets from F1 25 / F1 26
- **SQLite Storage** — Persists session data locally for analysis and replay
- **Web Dashboard** — Browser-based interface for live data visualization
- **Lap Comparison** — Compare lap times, sector splits, and telemetry traces
- **Real-time WebSocket** — Stream live telemetry to the dashboard via WebSocket
- **Multi-format Support** — Supports both 2025 & 2026 UDP packet formats

## Quick Start

### Prerequisites

- [Go 1.21+](https://go.dev/dl/)

### Install & Run

```bash
# Clone the repository
git clone https://github.com/mgauna/f1game-telemetry-go.git
cd f1game-telemetry-go

# Build the binary
make build

# Run the server
make run
```

Open [http://localhost:8080](http://localhost:8080) in your browser.

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

## Project Structure

```
f1game-telemetry-go/
├── cmd/
│   └── server/          # Application entry point
│       └── main.go
├── internal/
│   ├── udp/             # UDP listener and packet handling
│   ├── packet/          # Packet parsing and types
│   ├── storage/         # SQLite persistence layer
│   └── web/             # HTTP server and WebSocket
├── web/                 # Frontend assets (HTML, CSS, JS)
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
| `GET` | `/api/sessions/:id/laps` | Get laps for a session |
| `GET` | `/api/laps/:id/telemetry` | Get telemetry for a lap |

> **Note:** API endpoints are planned and subject to change.

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
