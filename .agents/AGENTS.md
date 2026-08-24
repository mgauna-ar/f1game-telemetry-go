# F1 Game Telemetry Project Rules

This file (`.agents/AGENTS.md`) contains workspace-specific rules and context that agents will automatically load and follow when working on this project.

## 1. Technology Stack & Architecture
*   **Supported OS:** Windows 10/11, macOS, and Linux (cross-platform).
*   **Target Telemetry Version:** Exclusive target for **F1 2025** and **F1 2026 DLC** UDP telemetry specifications (`PacketFormat` 2025/2026 with fixed 29-byte `PacketHeader`). Deprecated support for 2023 and older formats.
*   **Backend:** Go (located at the root using standard `cmd/` and `internal/` layout), utilizing WebSockets for real-time data streaming and SQLite (`modernc.org/sqlite` pure Go CGO-free driver) for cross-platform persistence.
*   **High-Efficiency Compressed Storage & Versioned Schema:** Telemetry samples are buffered in memory per car (`LapTracker`) and persisted as Zstandard (`zstd`) compressed JSON BLOBs per lap (`lap_telemetry` table) upon lap completion or session finish. Eliminates row bloat (>90% storage savings from ~25 GB/yr to ~2 GB/yr) with 1-seek retrieval. Cascading foreign keys (`ON DELETE CASCADE`) maintain strict referential integrity. Schema is managed via an inline versioned migration engine (`schema_version` table in `migrations.go`), with composite indexes (`idx_laps_session_car`, `idx_laps_car_laptime`), Hex-formatted session UIDs (`TEXT` e.g. `0x...` preventing signed 64-bit overflow and JS float truncation), initial weather preservation, `weather_forecast` timeline JSON, and enriched session metadata (`total_laps`, `ai_difficulty`, `session_duration`).
*   **Embedded Frontend & Standalone Single-Binary Release:** For production and non-developer distribution, the compiled Vite frontend (`frontend/dist`) is embedded directly into the Go executable via `//go:embed` (`frontend/embed.go`). The server serves embedded static assets with SPA fallback routing and automatic browser auto-launch (`system.OpenBrowser`), producing a 100% self-contained binary with zero external dependencies (no Go, Node.js, or npm required by end users).
*   **In-App Version & Update Checker:** `GET /api/system/version` exposes build metadata and `GET /api/system/check-updates` performs cached (1h TTL) semantic version checks against the upstream GitHub Releases API, driving a non-intrusive header notification chip and "What's New" release notes modal with direct download links. Full release lifecycle and standard operating procedures are governed by `RELEASE.md` and tracked in `CHANGELOG.md`.
*   **Session Portability & Batch Operations:** `GET /api/sessions/{id}/export` delivers compressed `.f1session` packages, `POST /api/sessions/export-batch` exports multiple selected sessions into a standard `.zip` archive, `POST /api/sessions/import` decompresses and restores full session telemetry (supporting both individual/multiple `.f1session` files and `.zip` archives with duplicate UID detection), `POST /api/sessions/batch-delete` cascades deletions in bulk, and `POST /api/sessions/batch-tags` assigns tags in bulk. Lap queries via `GET /api/sessions/{id}/laps` support optional `?carIndex=N` filtering.
*   **Frontend:** React (located in the `frontend/` directory), Vite (for building/bundling), Recharts (for data visualization), HTML5 Canvas (for track mapping). 
*   **Communication:** JSON payloads over WebSockets for live telemetry data (Packet IDs: 0 Motion, 1 Session, 2 LapData, 3 Event, 4 Participants, 5 CarSetup, 6 Telemetry, 7 CarStatus, 10 CarDamage). Streaming SSE for AI Race Engineer (`/api/ai/chat`).
 
## 2. Testing Standards
*   **Go Backend:** Always use table-driven tests for packet parsers (especially for handling binary input and struct alignment) and ensure proper error handling.
*   **Packet Simulation:** Use `make simulate` (defaults to F1 2026 24-car grid, or `make simulate FORMAT=2025` for 22-car grid) or `simulate.bat` (`cmd/simulator/main.go -format 2026/2025`) to generate synthetic live UDP telemetry packets (Motion, Telemetry, LapData, ParticipantsData, CarDamage, Event, Session with weather forecasts) at 20Hz without needing the physical F1 game. Use `-scenario <name>` flag to trigger specific in-race situations for testing the Voice Race Engineer: `wear` (tyres start at 38.5% → fires tyre deg alerts), `sc` (Full Safety Car), `vsc` (Virtual Safety Car), `rain` (rain forecast injection).
*   **Windows Helpers:** `run.bat` automated setup script (installs frontend deps if missing, launches backend and frontend concurrently, opens browser). `simulate.bat` shortcut for UDP simulator.
*   **React Frontend:** Use `vitest` and `@testing-library/react` (`jsdom`) for component and hook testing (like the `useTelemetry` hook).


## 3. F1 Telemetry Specifics
*   **Binary Parsing:** When modifying packet decoding logic (e.g., `PacketLapData`, `PacketMotionData`), ensure strict 1:1 alignment with the official EA F1 2025/2026 game telemetry specification. `LapDistance` and `TotalDistance` are floats positioned immediately before `SafetyCarDelta`.

*   **Data Transformation & Navigation:** Keep frontend payloads lightweight — only broadcast the specific data points needed by the UI (e.g., extracting `WorldPositionX/Z` for the mini-map) rather than sending raw, unparsed packets.

*   **Navigation Layout:** Top nav bar features the `<F1TelemetryLogo />` brand identity, followed by three main sections:

    **1) Session History** (default landing view)
    - **Multi-Tag & League Organization:** Vibrant motorsport color chips, horizontal Tag Filter Bar with session counts, inline `+ Tag` popovers, and detail header tag management.
    - **Glassmorphic Data Table:** Sortable columns (Date/Time, Track with `<TrackFlag />` SVG badges, Type/Format, Duration, Tags, Weather, Actions), multi-select checkboxes with indeterminate select-all, and a floating **Session Batch Dock** (`<SessionBatchDock />`) for bulk **ZIP Export**, **Batch Deletion**, **Batch Tagging**, and multi-file/ZIP drag-and-drop import with duplicate detection.
    - **Session Deep-Dive Tabs (4 tabs):**
        - *Classification & Laps:* Podium showcase, purple/green sector highlights, tyre stint timelines, `Slot A` / `Slot B` staging chips with persistent **Comparator Staging Dock** (select & swap both laps before launching comparison).
        - *Lap Progression & Gap Charts:* Multi-driver line filters, full continuous lap inclusion (in/out laps always retained).
        - *Tyre Strategy & Stints:* Field stint Gantt timeline with hover stats, tyre degradation & pace curves by tyre age, calculated deg rates (s/lap), driver/compound filter chips, KPI cards.
        - *Sector & Speed Matrix:* Ultimate session theoretical lap and speed trap rankings.
    - Hex session UID representation (`0x...`), interactive **Weather Evolution & Forecast** timeline hover popovers with rain chance bars and temperatures, multi-attribute filtering & country/ISO-aware search.

    **2) Lap Comparator**
    - Side-by-side Slot A & Slot B cards with flag badges, tag-aware session search, link/cross-session toggle, quick-select leaderboard, enlarged track map sidebar.
    - Separated throttle/brake charts, ERS battery/mode steps with year-aware labels — 2025: *Overtake* vs 2026: *Boost*.
    - Dedicated **Active Aero (Corner/Straight Mode) & Boost** step charts when analyzing 2026 sessions.

    **3) Live Session**
    - Live pulse badge, full-width leaderboard tower with Active Aero / Boost status pills, live track header with country flag.
    - **Live Race Control Hub (2×2 grid):** Real-time incident feed, weather radar timeline, pit strategy matrix, live sector performance tracker.
    - **Interactive Voice Race Engineer** (`<LiveRadioHUD />` — floating bottom-left):
        - **Push-to-Talk (PTT):** Via Gamepad API (`useGamepadPTT`) with interactive wheel button learning + `Space` keyboard fallback. FOM radio harmonic beeps (`radioAudio.ts`) play before/after each transmission.
        - **Driver Call-Sign Personalization:** Custom driver call-sign or nickname field (`driver_callsign`) injected into prompt context so the engineer naturally addresses the driver by name.
        - **Engineer Personas & Language-Filtered Neural Voices:** **Franco Colapinto 🇦🇷**, **Bono 🇬🇧**, **Custom**. Each persona uses language-filtered neural TTS voices: `RADIO_SPANISH_VOICES` (Tomás / Jorge / Álvaro) and `RADIO_ENGLISH_VOICES` (Ryan / Guy) — voice dropdown auto-filters to match the selected radio language, and voice resets automatically when switching languages.
        - **Audio Realism & Zero-Latency Caching:** Speech rate (-20% to +30%) and vocal pitch modulation sliders, analog cockpit static & squelch background FX (`createStaticNoiseBuffer`), and instant in-memory audio caching (`ttsAudioMemoryCache`) for frequent pit wall radio calls.
        - **Proactive Telemetry Radio Watcher & Session Intelligence** (`useProactiveTelemetryRadio`): Monitors 8 distinct telemetry subsystems with year-aware logic (2025 DRS vs 2026 Active Aero & Boost/Override), independent per-category anti-spam cooldowns and instant Emergency Bypass for safety-critical events (punctures, severe wing damage, SC/VSC, Red Flags, penalties, corner-cutting track limits):
          1. *Tyre Wear & Thermal Management:* Wear warning % & critical % sliders, critical puncture bypass (>=95%), thermal surface overheating (>115°C default for 2025, >110°C default for 2026 with narrower tyre traction management advice) and cold tyre warnings.
          2. *Aero & Mechanical Damage:* Front wing flap warning & critical (>=40% box) thresholds, floor/diffuser downforce loss %, engine internal component wear % (ICE/TC/MGU-K/Gearbox), mechanical faults (2025 DRS fault vs 2026 Active Aero straight mode failure & ERS faults).
          3. *ERS & Power Unit:* Low battery reserve % warning (2025 deploy mode management vs 2026 Lift & Coast MGU-K regen and Boost conservation), radiator dirty air water/oil overheating.
          4. *Braking Systems:* High disc fade temp threshold (°C) and cold brake drag warning on formation / SC restarts.
          5. *Fuel & Pit Strategy:* Target deficit delta (laps) with Lift & Coast directive, rival undercut threat within gap distance, ideal pit stop window opening.
          6. *Rivals & Overtaking/Defending Threat:* Year-aware logic — 2025 DRS gap & defense directives vs 2026 Override/Boost threat, Straight Mode deployment and Boost attack calls with compound offsets and rival damage notes.
          7. *Qualifying & Shootout Intelligence:* Out-lap clean air traffic gap warning (<4s in sector 3), flying lap track limits invalidation, session countdown timer (<3 min), Q1/Q2 elimination danger zone alerts.
          8. *Flags, Radar & Race Control:* Full SC, Virtual Safety Car, Red Flag session halts, weather radar rain horizon & probability thresholds, corner cutting warnings before penalty count, steward penalties.
        - **Granular Threshold Sliders, Quick Presets & Audio Test Hub:** Quick style presets (*Inmersivo F1*, *Coaching Pro*, *Mínimo*, *Personalizado*), Reset to Factory Defaults button, and individual audio test preview buttons for every single subsystem.
        - **Smart Driving Discretion & Configurable Triggers:** Suppresses non-critical calls during heavy braking (>50% brake) or high lateral G / apex turns (`|Steer| > 0.45`). Chatter cooldown presets (*Talkative* 20s, *Normal* 45s, *Minimal* 90s) with custom slider (10s–120s), and event-by-event category toggles. All proactive alerts are prefixed `[PROACTIVE PIT WALL CALL]` and **explicitly forbid "Entendido" / "Copy"** since the engineer initiates the call.
        - **4-Tab Glassmorphic Settings Dialog & Master Control:** Organized into *Persona & Driver*, *Voice & Audio Realism*, *Proactive Triggers & Discretion*, and *Tactical Coaching (8 Accordion Subsystems)*. Toggle in `<RadioSettingsPanel />` (⚙️ settings) or via the `⚡ Power` button in the HUD. When **OFF**, the HUD collapses to a compact non-intrusive pill (`[ ⚡ Encender Radio ] [ ⚙️ ]`) and all PTT, mic access, and background AI calls are fully paused.
        - **Proactive vs. Reply protocol:** `Entendido` / `Copy` / `Roger` are ONLY allowed when the driver spoke first via PTT.
    - **AI Race Engineer Chat Widget:** Rendered globally across all pages as a persistent non-modal floating bottom-right widget with FAB launcher, adaptive prompt chips, and multi-mode telemetry ingestion (active session tags & league metadata). Streaming SSE responses. Server-side LTTB downsampling (`?maxPoints=800`) for 60 FPS historical chart performance.

*   **Track & Country Flags System:** High-DPI crisp vector SVG country flags (`<CountryFlag />` and `<TrackFlag />`) for all 2025/2026 and historical circuits (AU, GB, IT, MC, ES, US, JP, BE, NL, etc.) with checkered racing flag fallback for unknown tracks. Flags feature rounded glassmorphic borders, interactive hover tooltips with type-safe localized country names (`common.countries.*`), and country name/ISO-3 code search integration. Centralized metadata resides in `frontend/src/constants/f1.ts` (`TRACK_METADATA` and `getTrackInfo`).

## 4. UI/UX Guidelines
*   **Design Aesthetic:** Build modern, responsive React components. Use curated color palettes, smooth micro-animations for real-time data updates, and avoid default browser styling to maintain a premium feel.

## 5. CI/CD Pipeline
*   **GitHub Actions:** Any new tests or linting tools must be integrated into the `.github/workflows/ci.yml` pipeline. Ensure that both the Go backend (`go test`) and React frontend (`vitest`) pass successfully before merging code.

## 6. Documentation Upkeep
*   **README & Rules:** Whenever significant changes are made to the architecture, tech stack, API endpoints, or project structure, you MUST update both `README.md` and `.agents/AGENTS.md` to reflect the new state. Do not leave documentation out of date!

## 7. Multi-Language & Localization Standards
*   **English-First Base & Type-Safe I18n:** All underlying codebase structures, backend APIs, default telemetry payloads, and English dictionaries (`src/locales/en/`) serve as the primary base schema.
*   **Multi-Language UI Support:** The frontend includes native, zero-dependency type-safe internationalization via `I18nProvider` and `useI18n` (`src/context/I18nContext.tsx`). Supported locales:
    - `en`: **English** (default) with 🇬🇧 flag indicator.
    - `es`: **Español (Latinoamérica)** with 🇦🇷 Argentina flag indicator (`"Español (Latinoamérica)"`), utilizing authentic Latin American motorsport terminology (*boxes*, *neumáticos*, *monoplaza*, *vuelta rápida*, *diferencia*). Standard international F1 acronyms (*DRS*, *ERS*, *S1/S2/S3*, *SC/VSC*, *RPM*, tyre compound letters) remain universally recognizable across all languages.
*   **Language Selector UI:** Compact glassmorphic dropdown (`src/components/LanguageSelector.tsx`) integrated in the top navigation bar right next to the port status badge. Preference automatically syncs with browser settings and persists in `localStorage` (`f1_telemetry_language`).
## 8. Clean Code: No Magic Numbers & Centralized Constants Standards
*   **Zero Magic Numbers / Literals Policy:** Never use hardcoded, unexplained numeric literals or inline raw status codes across the Go backend or React frontend (e.g. raw packet IDs `1`, `2`, `3`, `6`, `7`, `10`, `16`; result statuses `0..7`; safety car modes `0..3`; weather types `0..5`; tyre compound numbers `16..21`; time conversion constants like `60000`, `1000`, `3600000`; ERS store capacities `4000000.0`; buffer capacities `1800`; downsampling thresholds `800`/`850`; default colors).
*   **Go Backend Constants Location:** All F1 protocol enums, result statuses, pit statuses, driver statuses, safety car modes, weather codes, actual tyre compound IDs, and standard conversions MUST reside in `internal/packets/constants.go` (or domain-specific constants in their respective package) and be referenced as `packets.ResultStatusFinished`, `packets.PitStatusPitting`, `packets.MillisPerMinute`, `packets.MaxERSStoreEnergyJoules`, `packets.DefaultTelemetrySampleCapacity`, etc.
*   **React Frontend Constants Location:** All frontend F1 constants, packet IDs, compound IDs, penalty types, session types, time constants, and UI downsample thresholds MUST reside in `frontend/src/constants/f1.ts` (e.g. `PACKET_IDS`, `RESULT_STATUS`, `PIT_STATUS`, `DRIVER_STATUS`, `SAFETY_CAR_STATUS`, `PENALTY_TYPES`, `WEATHER_CODES`, `SESSION_TYPES`, `TIME_CONSTANTS`, `TELEMETRY_DOWNSAMPLE_LIMITS`, `ACTIVE_AERO_MODES`) and be imported directly across components and hooks.


