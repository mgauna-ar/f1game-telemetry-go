# F1 Game Telemetry Project Rules

This file (`.agents/AGENTS.md`) contains workspace-specific rules and context that agents will automatically load and follow when working on this project.

## 1. Technology Stack & Architecture
*   **Backend:** Go (located at the root using standard `cmd/` and `internal/` layout), utilizing WebSockets for real-time data streaming and SQLite for persistence.
*   **Frontend:** React (located in the `frontend/` directory), Vite (for building/bundling), Recharts (for data visualization), HTML5 Canvas (for track mapping). 
*   **Communication:** JSON payloads over WebSockets for live telemetry data.

## 2. Testing Standards
*   **Go Backend:** Always use table-driven tests for packet parsers (especially for handling malformed binary input) and ensure proper error handling.
*   **Packet Simulation:** Use `make simulate` (`cmd/simulator/main.go`) to generate synthetic live UDP telemetry packets (Motion, Telemetry, LapData) at 20Hz without needing the physical F1 game.
*   **React Frontend:** Use `vitest` and `@testing-library/react` (`jsdom`) for component and hook testing (like the `useTelemetry` hook).


## 3. F1 Telemetry Specifics
*   **Binary Parsing:** When modifying packet decoding logic (e.g., `PacketMotionData`), ensure strict alignment with the official F1 game telemetry specification. 
*   **Data Transformation:** Keep frontend payloads lightweight. Only broadcast the specific data points needed by the UI (e.g., extracting `WorldPositionX/Z` for the mini-map) rather than sending raw, unparsed packets.

## 4. UI/UX Guidelines
*   **Design Aesthetic:** Build modern, responsive React components. Use curated color palettes, smooth micro-animations for real-time data updates, and avoid default browser styling to maintain a premium feel.

## 5. CI/CD Pipeline
*   **GitHub Actions:** Any new tests or linting tools must be integrated into the `.github/workflows/ci.yml` pipeline. Ensure that both the Go backend (`go test`) and React frontend (`vitest`) pass successfully before merging code.

## 6. Documentation Upkeep
*   **README & Rules:** Whenever significant changes are made to the architecture, tech stack, API endpoints, or project structure, you MUST update both `README.md` and `.agents/AGENTS.md` to reflect the new state. Do not leave documentation out of date!
