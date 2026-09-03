# F1 Game Telemetry Project Rules

This file (`.agents/AGENTS.md`) contains workspace-specific rules, architectural boundaries, and operational constraints that agents must strictly follow when working on this project.

## 1. Technology Stack & Architecture
*   **Supported OS:** Windows 10/11, macOS, and Linux (cross-platform).
*   **Target Telemetry Version:** Exclusive target for **F1 2025** and **F1 2026 DLC** UDP telemetry specifications (`PacketFormat` 2025/2026 with fixed 29-byte `PacketHeader`). Deprecated support for 2023 and older formats.
*   **Backend Layer Boundaries (Go):** Standard Go layout (`cmd/` and `internal/`).
    - `internal/api/`: HTTP router, request decoding, middleware, and response serialization only. **Zero heavy domain or analytical logic.**
    - `internal/session/`: Live session tracking, `LapTracker` memory buffering, `TelemetryBatchWriter`, and session import/export services.
    - `internal/analytics/`: Server-side computational analytics (classification standings, lap comparator distance merging, progression matrices, tyre stint degradation OLS regression).
    - `internal/engineer/`: Modular Strategy pattern AI race engineer rules engine (`EngineerEngine`, `EngineerRule`).
    - `internal/storage/`: SQLite repository, data models with custom `MarshalJSON` sanitization, versioned migrations, and raw zstd compression.
    - `internal/packets/`: Strict 1:1 binary UDP telemetry decoders and domain constants.
    - `internal/ai/`: External AI providers (Gemini, OpenAI) and neural TTS voice synthesis.
    - `internal/locales/`: Type-safe `PromptCatalog` interface, thread-safe locale registry, and locale-specific prompt catalogs (`en`, `es`) eliminating boolean language flags in the backend.
    - `internal/input/`: DirectInput PTT wheel and keyboard OS listeners.
*   **Storage Invariants:**
    - CGO-free pure Go SQLite (`modernc.org/sqlite`) with versioned migrations (`schema_version` table).
    - Per-lap telemetry samples buffered in memory and persisted as Zstandard (`zstd`) compressed JSON BLOBs (`lap_telemetry` table) with cascading foreign keys (`ON DELETE CASCADE`).
    - **Session UIDs must always be stored and serialized as Hex strings** (`TEXT` e.g. `0x...`) to prevent 64-bit signed integer overflow and JavaScript float truncation.
*   **Single-Binary Release & Frontend Distribution:** Compiled Vite frontend (`frontend/dist`) is embedded directly into the Go executable via `//go:embed` (`frontend/embed.go`), serving static assets with SPA fallback and automatic browser launch (`system.OpenBrowser`). Produces a 100% self-contained binary with zero external runtime dependencies.
*   **Communication & Performance:** Throttled 10Hz consolidated Live Telemetry Snapshots (`PacketIDLiveSnapshot` 255) and immediate event broadcasts (Packet ID 3) over WebSockets to minimize CPU and bandwidth. React frontend uses decoupled Zustand stores (`useTelemetryStore`) with fine-grained selectors to eliminate unnecessary whole-page re-renders. Streaming SSE for AI Race Engineer (`/api/ai/chat`).
 
## 2. Testing Standards & Quality Verification
*   **Mandatory Pre-Completion Verification Rule:** NEVER declare any task, refactor, or feature complete without first executing and verifying all linters, test suites, and production build:
    1. **Go Backend Linters & Formatting:** Run `gofmt -l .`, `go vet ./...`, and `golangci-lint run` (verify 0 formatting issues, 0 vet errors, 0 linter issues).
    2. **Go Backend Tests:** Run `go test -count=1 ./...` from the workspace root (ensure 100% pass across all packages without relying on test cache). Always use table-driven tests for packet parsers and proper error handling.
    3. **React Frontend Linters:** Run `npm run lint` (`oxlint`) in `frontend/` (ensure 0 errors).
    4. **React Frontend Tests:** Run `npm test` (`vitest run`) in `frontend/` (ensure 100% pass across all test suites).
    5. **Production Build:** Run `npm run build` in `frontend/` (`tsc -b && vite build`) to verify zero TypeScript compiler errors and bundle integrity.
    6. Always report actual test pass counts, linter output, and execution results in the final user response.
*   **Packet Simulation:** Use `make simulate` (defaults to F1 2026 24-car grid, or `make simulate FORMAT=2025` for 22-car grid) or `simulate.bat` (`cmd/simulator/main.go -format 2026/2025`) to generate synthetic live UDP telemetry packets (Motion, Telemetry, LapData, ParticipantsData, CarDamage, Event, Session with weather forecasts) at 20Hz without needing the physical F1 game. Use `-scenario <name>` flag to trigger specific in-race situations for testing the Voice Race Engineer: `wear` (tyres start at 38.5% → fires tyre deg alerts), `sc` (Full Safety Car), `vsc` (Virtual Safety Car), `rain` (rain forecast injection).
*   **Windows Helpers:** `run.bat` automated setup script (installs frontend deps if missing, builds production assets, compiles and launches the standalone single-binary embedded application, auto-opens browser). `simulate.bat` shortcut for UDP simulator.
*   **React Frontend:** Use `vitest` and `@testing-library/react` (`jsdom`) for component and hook testing (like the `useTelemetry` hook).

## 3. F1 Telemetry & Radio Protocols
*   **Binary Parsing Alignment:** When modifying packet decoding logic (e.g. `PacketLapData`, `PacketMotionData`), ensure strict 1:1 alignment with official EA F1 2025/2026 game telemetry specification. **Critical gotcha:** `LapDistance` and `TotalDistance` are floats positioned immediately before `SafetyCarDelta`.
*   **Lightweight Payloads:** Keep frontend payloads lightweight — broadcast only the specific data points needed by the UI (e.g. extracting `WorldPositionX/Z` for track maps) rather than sending raw, unparsed packets.
*   **Proactive Radio Protocol:**
    - All proactive pit wall alerts are prefixed with `[PROACTIVE PIT WALL CALL]`.
    - **Explicitly forbid "Entendido" / "Copy" / "Roger" on proactive calls** since the engineer initiates the communication.
    - "Entendido" / "Copy" / "Roger" are **only** permitted when the driver spoke first via Push-to-Talk (PTT).
*   **Global Background PTT:** On Windows, native DirectInput listening (`winmm.dll` for steering wheels, `user32.dll` for keyboard) captures PTT globally in the background so radio works while driving F1 in full screen. Browser Gamepad API and `Space` key act as fallback.

## 4. UI/UX Guidelines
*   **Design Aesthetic:** Build modern, responsive React components. Use curated color palettes, smooth micro-animations for real-time data updates, and avoid default browser styling to maintain a premium feel.

## 5. CI/CD Pipeline
*   **GitHub Actions:** Any new tests or linting tools must be integrated into the `.github/workflows/ci.yml` pipeline. Ensure that both the Go backend (`go test`) and React frontend (`vitest`) pass successfully before merging code.

## 6. Documentation Upkeep
*   **README & Rules:** Whenever significant changes are made to the architecture, tech stack, API endpoints, or project structure, you MUST update both `README.md` and `.agents/AGENTS.md` to reflect the new state. Do not leave documentation out of date!

## 7. Multi-Language & Localization Standards
*   **English-First Base & Type-Safe I18n:** All underlying codebase structures, backend APIs, default telemetry payloads, and English dictionaries (`frontend/src/locales/en/`) serve as the primary base schema.
*   **Backend Localization Architecture (`internal/locales`):** Eliminates hardcoded boolean language flags (`isEnglish`, `isSpanish`). Provides a type-safe `PromptCatalog` interface with English base fallback (`EnglishCatalog`), authentic Latin American motorsport Spanish catalog (`SpanishCatalog`), thread-safe registry (`Resolve`, `Get`), and unified Microsoft Edge Neural TTS voice mappings.
*   **Multi-Language UI Support:** The frontend includes native, zero-dependency type-safe internationalization via `I18nProvider` and `useI18n` (`frontend/src/context/I18nContext.tsx`). Supported locales:
    - `en`: **English** (default) with 🇬🇧 flag indicator.
    - `es`: **Español (Latinoamérica)** with 🇦🇷 Argentina flag indicator (`"Español (Latinoamérica)"`), utilizing authentic Latin American motorsport terminology (*boxes*, *neumáticos*, *monoplaza*, *vuelta rápida*, *diferencia*). Standard international F1 acronyms (*DRS*, *ERS*, *S1/S2/S3*, *SC/VSC*, *RPM*, tyre compound letters) remain universally recognizable across all languages.
*   **Language Selector UI:** Compact glassmorphic dropdown (`frontend/src/components/LanguageSelector.tsx`) integrated in the top navigation bar right next to the port status badge. Preference automatically syncs with browser settings and persists in `localStorage` (`f1_telemetry_language`).

## 8. Clean Code, Constants & Engineering Principles
*   **Zero Magic Numbers / Literals Policy:** Never use hardcoded, unexplained numeric literals or inline raw status codes across the Go backend or React frontend (e.g. raw packet IDs `1`, `2`, `3`, `6`, `7`, `10`, `16`; result statuses `0..7`; safety car modes `0..3`; weather types `0..5`; tyre compound numbers `16..21`; time conversion constants like `60000`, `1000`, `3600000`; ERS store capacities `4000000.0`; buffer capacities `1800`; downsampling thresholds `800`/`850`; default colors).
*   **Go Backend Constants Location:** All F1 protocol enums, result statuses, pit statuses, driver statuses, safety car modes, weather codes, actual tyre compound IDs, and standard conversions MUST reside in `internal/packets/constants.go` or dedicated domain-specific constant files (`constants_drivers.go`, `constants_teams.go`, `constants_sessions.go`) and be referenced as `packets.ResultStatusFinished`, `packets.PitStatusPitting`, `packets.MillisPerMinute`, `packets.MaxERSStoreEnergyJoules`, `packets.DefaultTelemetrySampleCapacity`, `packets.DriverName(...)`, `packets.TeamName(...)`, `packets.SessionTypeName(...)`, etc.
*   **React Frontend Constants Location:** All frontend F1 constants, packet IDs, compound IDs, penalty types, session types, time constants, and UI downsample thresholds MUST reside in `frontend/src/constants/f1.ts` (e.g. `PACKET_IDS`, `RESULT_STATUS`, `PIT_STATUS`, `DRIVER_STATUS`, `SAFETY_CAR_STATUS`, `PENALTY_TYPES`, `WEATHER_CODES`, `SESSION_TYPES`, `TIME_CONSTANTS`, `TELEMETRY_DOWNSAMPLE_LIMITS`, `ACTIVE_AERO_MODES`) and be imported directly across components and hooks.
*   **Core Engineering Principles:**
    - **DRY (Don't Repeat Yourself):** Always reuse centralized constants, shared Go types, TypeScript interfaces, conversion helpers, and custom hooks instead of duplicating parsing logic, unit conversions, or calculation math across packages or components.
    - **Single Responsibility & Separation of Concerns:** Keep HTTP handlers thin (transport and validation only); computational analytics, session state, and strategy rules belong in dedicated service layers (`internal/analytics`, `internal/session`, `internal/engineer`); React components focus strictly on presentation with telemetry state managed via Zustand.
    - **KISS (Keep It Simple, Stupid) & YAGNI:** Prioritize clean, straightforward, and testable code over premature abstractions, speculative generalized interfaces, or unnecessary configuration overhead.
