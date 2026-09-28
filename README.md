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
* **Real-Time Incidents & Sectors:** Instant ticker tracking overtakes, penalties, safety cars, sector splits, speed traps, and theoretical best laps. The server builds every race control row (event code plus parameters) and sends it with the 10 Hz live snapshot; the dashboard writes the text in your language.

### 🔍 Lap Comparator & Track Map
* **Side-by-Side Telemetry:** Compare any two laps across Speed, Throttle, Brake, Gears, ERS, and 2026 Active Aero (`Corner` / `Straight` mode) & Boost traces.
* **Interactive Track Visualizer:** Synchronized circuit map with turn badges, apex speed deltas, and racing line overlays.
* **Where Did I Lose Time:** A corner table (one row per detected turn) with both laps' entry and minimum speed, braking point, throttle pickup and the time gained or lost there. Clicking a corner zooms the charts and the map to it (the zoom is in the URL); "Ask AI" on a corner asks the AI engineer about that stretch.
* **Strip Charts:** A compact layout with every trace as a thin strip on one shared distance axis, the values under the cursor beside each strip, drag-to-zoom across any strip, and strips you can reorder or hide (remembered on this device). The track map marker follows the cursor.
* **Quick Start:** Before any lap is picked, one-click comparisons from your sessions: your best lap against the fastest, against your best the last time at that track, and at another track.
* **Server-Side Distance Merging:** High-performance distance-normalized grid (5m step) for pinpoint delta coaching.
* **Configurable Driver Defaults & Auto-Rival Matching:** Configure your default Reference pilot name and comparison targets (Fastest Lap / Leader with P2 tiebreaker, Teammate, or specific driver) with immediate re-evaluation and intelligent fallbacks.

### 📊 Session History & League Management
* **Session Story and One Tab Bar:** A session opens on its **Story**: your race, your lap times against the field median and the fastest lap of each lap (with your average gap on clean racing laps), a key-moments timeline from the race-control feed (the start, safety cars, red flags, retirements, penalties that change a result, the fastest lap that stood, and your own overtakes, pit stops and incidents, filterable to yours), and an AI engineer debrief written in place on request. The other tabs are Classification, Pace, Positions, Gap to leader, Tyres & stints and Sectors & speed; the three lap charts keep the drivers you pick, label each line at its end, dash a team's second car, shade safety car and VSC periods, and the pace chart fits its range to the laps shown and marks pit stops. Sessions recorded before the race-control feed was stored show the story without the timeline and shading.
* **A Session List That Scales:** Compact rows, grouped by day, track or tag (folding each group), and pages of 50 sessions. Quick filters (last 7 days, with your result, your podiums, places gained) add up with the search, type, circuit and tag filters, and any set of filters can be saved under a name as a one-click chip in this browser. Export, tags and delete sit in each session's "⋯" menu, on the table and on the phone cards alike. In a session, the classification switches between the gap to the leader (or pole) and the interval to the car ahead, and sector times use F1's colours: purple for the session best, green for a personal best, yellow for slower.
* **Tyre Degradation on Clean Laps:** Each stint's degradation rate is a straight line through its clean laps only: in and out laps, safety car and VSC laps, and laps over 107% of the stint's median are left out, and the table says which laps and why. Sort every stint in the race by rate, clean average or best lap, tick the ones to chart, and the chart draws the left-out laps as hollow dots off the line.
* **Your Car in Every Session:** Each recorded session stores which car you drove (`player_car_index`), so the list and the AI debrief know your result. The session list has a "Your result" column (position, places gained, best lap; the winner or pole when your car is unknown), a session highlights your row and opens with a "Your race" card (result, grid, best lap against the fastest, the cars either side, and a one-click comparison), its charts start on you and the cars around you, and the Lap Comparator starts from your best lap. Sessions recorded before this was stored keep it empty and find you by the driver name saved in the comparator's preferences.
* **League & Tag Organization:** Categorize sessions by league (*WOR*, *AOR*, *PSGL*) or weather setup with color chips and tag filtering.
* **Batch Operations & Portability:** Multi-select sessions to export to ZIP, bulk delete, or batch tag. Drag-and-drop import with duplicate detection.

### 🎙️ AI Race Engineer & Voice Radio
* **Hands-Free Global Push-to-Talk (PTT):** DirectInput support for steering wheels (Fanatec, Logitech, Moza, Simagic) and global keyboard shortcuts while driving in full-screen.
* **Proactive Pit Wall Calls:** Context-aware pit wall alerts for tyre wear/temperatures, aero damage, ERS deployment, fuel Lift & Coast, rival gaps, and safety cars.
* **Radio Q&A With the Full Race Picture:** Ask anything over push-to-talk. The engineer remembers the conversation for the session and answers from live data for every car: gaps and whether they are closing, rivals' tyres and stops, tyre wear per lap and laps to the limit, fuel burn against target, pit window, weather for the current session, and the calls it already made. For anything beyond that picture (any driver's lap times and stints, the full standings, your tyre sets, lap-by-lap history, the full forecast) it looks the data up mid-answer through function calling, with Gemini, OpenAI, Anthropic Claude and OpenAI-compatible models. Answers start playing as soon as the first sentence is ready instead of after the whole reply.
* **Smart Driving Discretion:** Automatically suppresses non-critical radio chatter during heavy braking or corner apexes until reaching the straight.
* **Neural Voices & Personas:** Authentic pit wall personas (**Bono 🇬🇧**, **Franco Colapinto 🇦🇷**, or **Custom**) with realistic cockpit radio distortion, spatial audio filtering, and FOM harmonic beeps.
* **Bilingual Strategy & Debriefs:** Native bilingual support in **English** and **Español (Latinoamérica)** with streaming AI post-session debriefs.
* **Chat Context From the Server:** The chat only tells the server what it is about (the live session, a recorded session, or two compared laps and the zoomed segment). The server builds the live briefing, the session debrief and the lap comparison from its own data, and adds the driver call-sign and custom persona saved in the settings, so the dashboard does no prompt work while you drive.
* **Readable Chat Replies:** Long answers render as proper tables, nested lists, code and quotes. The reply starts at your question and stays there while it streams, a *Jump to latest* button takes you to the end, replies can be copied, and the chat can be expanded to a large reading view.
* **Per-Provider AI Settings:** Pick Gemini, OpenAI, Claude or a local / OpenAI-compatible server from cards that show which ones are ready. Each shows only its own fields: the key and where to get one for cloud providers, the server address (with one-click Ollama, LM Studio and Groq presets) for local servers, and a searchable list of that provider's models.

---

## 🚀 Quick Start

### 📦 Option 1: Download Standalone Executable (Recommended)

Pre-compiled, self-contained single binaries with the embedded web dashboard are available under **[GitHub Releases](https://github.com/mgauna-ar/f1game-telemetry-go/releases/latest)**. **No runtime dependencies or installations are required** (no Go or Node.js needed to run).

1. Download the archive for your operating system from the **[Latest Release](https://github.com/mgauna-ar/f1game-telemetry-go/releases/latest)**:
   * **Windows:** `f1telemetry_<version>_windows_amd64.zip` (or `arm64`)
   * **macOS:** `f1telemetry_<version>_darwin_arm64.zip` (Apple Silicon M-series) or `f1telemetry_<version>_darwin_amd64.zip` (Intel)
   * **Linux:** `f1telemetry_<version>_linux_amd64.tar.gz` (or `arm64`)
2. Extract the archive contents.
3. Run `f1telemetry.exe` (Windows) or `./f1telemetry` (macOS / Linux). The server will start and automatically open your default browser to `http://localhost:8080`. Every page has its own address you can bookmark or share on your network: a session (`/history/12/stints`), a lap comparison with its zoom (`/compare?sa=12&a=345&b=346`), your progress at a track (`/progress/Silverstone`) or the live cockpit (`/live/cockpit`).

> [!NOTE]
> **Windows Defender / SmartScreen Notice:**
> Because this is a free, community open-source project without an expensive commercial code-signing certificate, Windows Defender SmartScreen may display a blue warning (*"Windows protected your PC"* or *"Unknown Publisher"*). This is standard and expected for newly released, unsigned open-source executables.
>
> To proceed: click **"More info"** → **"Run anyway"**. You can also verify binary integrity against the official SHA-256 hashes published in `checksums.txt`, or compile the binary yourself from source.

---

### 💻 Option 2: Build & Run from Source

If you prefer building locally or contributing to the codebase:

#### Prerequisites
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

#### Wire Types (Go → TypeScript)
The frontend's types for the server's JSON (`frontend/src/types/generated/`) are generated from the Go structs by `cmd/tsgen`. After changing a Go type the dashboard reads, regenerate them:
```bash
make gen-types   # or: go run ./cmd/tsgen
```
CI runs `go run ./cmd/tsgen -check` and fails when the generated files are out of date.

The 10 Hz live snapshot on `/ws` is a slim DTO (`internal/session/live_snapshot.go`): one row per active car and only the fields the live views read. To show another packet field live, add it there first. `go test -run TestLiveSnapshotPayloadSize -v ./cmd/simulator` prints its size per frame next to the raw packets.

`GET /api/sessions` returns each session with a `summary` of its result (`analytics.SessionListItem`): the leader (race winner or pole), the fastest lap, the laps completed and `player`, your finish and grid position, places gained, best lap and laps. `player` comes from the session's `player_car_index`: the car the game recorded, or the one you picked (`player_car_source` is `game` or `user`, and `player.source` is `recorded` or `chosen`). Sessions with neither have no `player`.

`PUT /api/sessions/{id}/player` with `{"car_index": <n>}` picks your car in a session (it must be one of the session's participants: 404 for an unknown session, 400 for an unknown car) and returns the session; `{"car_index": null}` clears it ("I wasn't driving"). A pick is never overwritten when the game saves that session again. `POST /api/sessions/batch-player` with `{"session_ids": [...], "driver_name": "..."}` picks, in each session, the participant with exactly that name (ignoring case) and returns `{"updated", "not_found", "ambiguous"}` (session IDs with a match, with none, and with more than one). Exports carry `player_car_source`, and an import keeps the file's value.

`GET /api/progress?track=<name>` powers the Progress page (`analytics.TrackProgressResponse`): every track with its session count, and your sessions at the chosen track (the latest session's track when `track` is left out), oldest first. Each one has your best lap and best valid sectors, the session's fastest lap and your gap to it, and your consistency: the standard deviation of your clean laps (valid, no pit in or out lap, none slower than 107% of your median, not a race's first lap), given from 3 of them. Sessions without your car (none recorded and none picked) are counted in `unmatched_sessions`.

Opening a recorded session is one request, `GET /api/sessions/{id}/detail`: the classification, progression and stints plus the session's participants, laps and `events` (its race-control feed rows, each with `raceLap`, the leader's lap; empty for sessions recorded before they were stored), loaded from SQLite once and sent once (standings and stints refer to laps by `car_index` and lap ID). `go test -run TestSessionViewPayloadSize -v ./internal/api` prints its bytes and database reads for a full synthetic race; set `F1_PAYLOAD_DB` (a copy of your database) and `F1_PAYLOAD_SESSION` to measure a recorded one.

#### Styles & Accessibility
The dashboard's colours, spacing, type, shadows, layers and motion are design tokens in `frontend/src/styles/base/variables.css`; components use them as `var(--token)`, and TypeScript that draws colours (Recharts, canvas) reads them through `frontend/src/styles/theme.ts`. Keyboard focus, screen-reader-only text and reduced motion are handled globally in `frontend/src/styles/base/accessibility.css`, and `npm run lint` includes accessibility rules (oxlint's `jsx-a11y` plugin), so clickable elements must be real buttons or links. Shared building blocks (buttons, dialogs, panels, tabs, tables, badges, empty and loading states, tooltips, markdown) live in `frontend/src/components/ui/`, each styled by its own CSS Module.

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
go run ./cmd/simulator -scenario start     # Formation lap warmup, grid approach, and lights-out launch reaction debrief
go run ./cmd/simulator -scenario pit       # Pit limiter entry, penalty hold, stationary stop duration debrief, and exit release
```

---

## ⚙️ Configuration (Optional)

Server settings can be set with command-line flags, environment variables, or a `.env` file (copy `.env.example` to `.env` in the folder you start the app from, or next to the executable). Flags win over environment variables, and real environment variables win over `.env`. The AI variables are defaults: anything saved in the in-app AI settings wins over them.

| Flag | Variable | Description | Default |
|---|---|---|---|
| `-udp` | `F1T_UDP_ADDR` | UDP telemetry listener address | `0.0.0.0:20777` |
| `-http` | `F1T_HTTP_ADDR` | Web API & WebSocket server address | `:8080` |
| `-db` | `F1T_DB_PATH` | SQLite database file (relative paths are resolved from the current folder; the full path is shown at startup) | `f1telemetry.db` |
| `-no-browser` | `F1T_NO_BROWSER` | Don't open the dashboard in a browser on startup | `false` |
| | `GEMINI_API_KEY` | Google Gemini API key for the AI Race Engineer | *(Can be set in UI)* |
| | `OPENAI_API_KEY` | OpenAI API key for the AI Race Engineer | *(Can be set in UI)* |
| | `ANTHROPIC_API_KEY` | Anthropic API key for Claude models in the AI Race Engineer | *(Can be set in UI)* |
| | `LLM_PROVIDER` | Default AI provider: `gemini`, `openai`, `claude` or `custom` | First provider with a key, else `gemini` |
| | `LLM_MODEL` | Default model for `LLM_PROVIDER` | Built-in model for the provider |

The Live tab shows the UDP port the server listens on and this PC's network addresses (with copy buttons), which is what to enter in the game's telemetry settings on a console. The simulator sends to `127.0.0.1` on the server's `F1T_UDP_ADDR` port. Use `-target` (or `F1T_SIM_TARGET`) to send somewhere else, e.g. `go run ./cmd/simulator -target 192.168.1.20:20777`.

Settings you change in the dashboard are saved in the database, so every device that opens it (the PC, a tablet on your network) shares them: radio alert rules, the AI provider, model and API keys, the engineer's persona and voice, and push-to-talk. When one device saves a change, the other open dashboards reload it right away, and if two devices change the radio alert rules at once, the later save is refused and that dashboard shows the newer rules instead of overwriting them. A save that fails shows a notice. Saved API keys are never sent back to a browser; the settings only show that a key is saved. Volume, radio effects, whether alerts play and the chat window size stay per device.

The API only accepts changes from the dashboard the app serves, so other websites open in your browser can't change settings or use your saved keys. Any device that can open the dashboard can still chat using the saved keys, the same as keys set in `.env`.

---

## 🤝 Contributing

Contributions are welcome! Please check out **[CONTRIBUTING.md](CONTRIBUTING.md)** for development guidelines and PR workflows, and **[GitHub Releases](https://github.com/mgauna-ar/f1game-telemetry-go/releases)** for release history and changelogs.

---

## ⚠️ Disclaimer

This project is an unofficial, open-source community tool developed for educational, telemetry analysis, and league racing purposes. It is **not** affiliated with, endorsed by, or associated with Electronic Arts Inc., Codemasters, or Formula One World Championship Limited. 

*F1*, *FORMULA ONE*, *FORMULA 1*, *FIA FORMULA ONE WORLD CHAMPIONSHIP*, and related logos and marks are trademarks of Formula One Licensing B.V. All game titles, screenshots, and car data are property of their respective owners.

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.


