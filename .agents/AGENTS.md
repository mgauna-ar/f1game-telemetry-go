# F1 Game Telemetry Project Rules

This file (`.agents/AGENTS.md`) contains workspace-specific rules and context that agents will automatically load and follow when working on this project.

## 1. Technology Stack & Architecture
*   **Supported OS:** Windows 10/11, macOS, and Linux (cross-platform).
*   **Target Telemetry Version:** Exclusive target for **F1 2025** and **F1 2026 DLC** UDP telemetry specifications (`PacketFormat` 2025/2026 with fixed 29-byte `PacketHeader`). Deprecated support for 2023 and older formats.
*   **Backend:** Go (located at the root using standard `cmd/` and `internal/` layout), utilizing WebSockets for real-time data streaming and SQLite (`modernc.org/sqlite` pure Go CGO-free driver) for cross-platform persistence.
*   **Frontend:** React (located in the `frontend/` directory), Vite (for building/bundling), Recharts (for data visualization), HTML5 Canvas (for track mapping). 
*   **Communication:** JSON payloads over WebSockets for live telemetry data (Packet IDs: 0 Motion, 1 Session, 2 LapData, 3 Event, 4 Participants, 5 CarSetup, 6 Telemetry, 7 CarStatus, 10 CarDamage). Streaming SSE for AI Race Engineer (`/api/ai/chat`).
 
## 2. Testing Standards
*   **Go Backend:** Always use table-driven tests for packet parsers (especially for handling binary input and struct alignment) and ensure proper error handling.
*   **Packet Simulation:** Use `make simulate` or `simulate.bat` (`cmd/simulator/main.go`) to generate synthetic live UDP telemetry packets (Motion, Telemetry, LapData, ParticipantsData, CarSetup, CarDamage, Event, Session with weather forecasts) at 20Hz without needing the physical F1 game.
*   **Windows Helpers:** `run.bat` automated setup script (installs frontend deps if missing, launches backend and frontend concurrently, opens browser). `simulate.bat` shortcut for UDP simulator.
*   **React Frontend:** Use `vitest` and `@testing-library/react` (`jsdom`) for component and hook testing (like the `useTelemetry` hook).


## 3. F1 Telemetry Specifics
*   **Binary Parsing:** When modifying packet decoding logic (e.g., `PacketLapData`, `PacketMotionData`), ensure strict 1:1 alignment with the official EA F1 2025/2026 game telemetry specification. `LapDistance` and `TotalDistance` are floats positioned immediately before `SafetyCarDelta`.
*   **Data Transformation & Navigation:** Keep frontend payloads lightweight. Only broadcast the specific data points needed by the UI (e.g., extracting `WorldPositionX/Z` for the mini-map) rather than sending raw, unparsed packets. Top navigation bar features a modern segmented layout ordered: 1) **Session History** (default landing view with aggregate KPI cards, rich card grid / table view switcher, multi-attribute filtering & sorting, 3-tab session deep dive: Classification & Laps with podium showcase, purple/green sector highlights, tyre stint timelines, and interactive 'Slot A' / 'Slot B' staging chips with a persistent **Comparator Staging Dock** that allows selecting and swapping both laps without abrupt page jumps before launching comparison; Lap Progression & Gap Charts with multi-driver line filters and outlier toggles; Sector & Speed Matrix with Ultimate session theoretical lap and speed trap rankings; and an embedded **AI Race Engineer Session Debrief** slide-over drawer with real-time SSE streaming), 2) **Lap Comparator** (side-by-side Slot A & Slot B comparison cards, link/cross-session toggle, quick-select leaderboard, track map sidebar, separated throttle/brake charts, ERS battery/mode steps, and AI Race Engineer), 3) **Live Session** (live pulse badge, full-width leaderboard tower, and a 2x2 **Live Race Control Hub** featuring: 1) Real-time Race Control & Incident feed with flag/SC statuses and filter chips, 2) Weather Radar & Forecast Timeline with rain probability bars and tyre crossover advice, 3) Pit Strategy & Field Tyre Matrix with pit window estimations and driver sync, and 4) Live Sector Performance with purple splits, theoretical ultimate best lap, and speed trap top 5; accompanied by animated "Waiting for Telemetry Data" empty state). For historical lap comparison telemetry, server-side LTTB downsampling (`?maxPoints=800`) is used to maintain 60FPS UI performance.

## 4. UI/UX Guidelines
*   **Design Aesthetic:** Build modern, responsive React components. Use curated color palettes, smooth micro-animations for real-time data updates, and avoid default browser styling to maintain a premium feel.

## 5. CI/CD Pipeline
*   **GitHub Actions:** Any new tests or linting tools must be integrated into the `.github/workflows/ci.yml` pipeline. Ensure that both the Go backend (`go test`) and React frontend (`vitest`) pass successfully before merging code.

## 6. Documentation Upkeep
*   **README & Rules:** Whenever significant changes are made to the architecture, tech stack, API endpoints, or project structure, you MUST update both `README.md` and `.agents/AGENTS.md` to reflect the new state. Do not leave documentation out of date!

## 7. Language & Localization Standards
*   **English-First Policy:** All codebase implementations, UI labels, text copy, placeholder strings, tooltips, error messages, user-facing telemetry summaries, AI assistant system prompts, and prompt chips MUST be written exclusively in **English**. Even when receiving user instructions or questions in another language (e.g. Spanish), all code, UI components, system prompts, and backend payloads must remain in English to maintain complete platform-wide consistency.

