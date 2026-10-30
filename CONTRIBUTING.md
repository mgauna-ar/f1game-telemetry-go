# Contributing to f1game-telemetry-go

Thank you for your interest in contributing! 🏎️

## Getting Started

1. **Fork** the repository on GitHub
2. **Clone** your fork locally:
   ```bash
   git clone https://github.com/<your-username>/f1game-telemetry-go.git
   cd f1game-telemetry-go
   ```
3. Create a new **branch** for your feature or fix

## Prerequisites

- [Go 1.26+](https://go.dev/dl/)
- [Node.js 22+](https://nodejs.org/)
- Make (for build tasks)

## Branch Naming

Use descriptive branch names with a prefix:

- `feat/` — New features (e.g., `feat/lap-comparison`)
- `fix/` — Bug fixes (e.g., `fix/packet-parsing`)
- `docs/` — Documentation changes (e.g., `docs/api-endpoints`)
- `refactor/` — Code refactoring (e.g., `refactor/udp-listener`)
- `test/` — Test additions or changes (e.g., `test/storage-layer`)

## Commit Style

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]
```

**Types:** `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

Examples:

```
feat(udp): add support for 2026 packet format
fix(storage): handle nil session on insert
docs(readme): update configuration section
```

## Pull Request Guidelines

1. Keep PRs focused — one feature or fix per PR
2. Write or update tests for your changes
3. Run `make test` and `make lint` before submitting
4. Update documentation if your change affects the public API
5. Fill out the PR template with a clear description

## Code Style

- Follow standard Go conventions (`gofmt`, `go vet`)
- Run `make fmt` before committing
- Keep functions small and focused
- Add comments for exported types and functions
- Use meaningful variable and function names

## Windows Build

- On Windows the app is a [Wails v3](https://github.com/wailsapp/wails) window over the app's own server (`internal/desktop/shell_windows.go`): no Wails bindings, the dashboard talks to the server as in a browser. It cross-compiles from macOS or Linux with `CGO_ENABLED=0`.
- Release builds use `-tags production` (Wails' release mode, without developer tools) and `-ldflags -H=windowsgui` (no console); `make build-all` does both. `go run ./cmd/server` on Windows keeps the developer tools.

## Releases

- Pushing a SemVer git tag (`vX.Y.Z`, or `vX.Y.Z-beta.N` for a pre-release) publishes a release from GitHub Actions (`.github/workflows/release.yml`): Linux builds the three archives, windows-2022 builds the Windows installer around the zip's exe (`build/windows/installer.nsi`, with NSIS), and the release gets them all with `checksums.txt`. Releases are under [GitHub Releases](https://github.com/mgauna-ar/f1game-telemetry-go/releases).
- Notes written for a version in `docs/releases/vX.Y.Z.md` (its betas use them too) come first in its release, before the generated list of changes. The app shows them in its release notes.
- Keep the archive names (`f1telemetry_<tag>_<os>_<arch>.zip` or `.tar.gz`) and `checksums.txt`: **Update now** in earlier versions looks for them.
- To try the installer without a release, run **CI/CD Pipeline** by hand with **installer** ticked. To build it on Windows yourself, with [NSIS](https://nsis.sourceforge.io/) installed: build the exe (`make build-all`), copy `internal/commands/webview2/MicrosoftEdgeWebview2Setup.exe` from the Wails module (`go list -m -f '{{.Dir}}' github.com/wailsapp/wails/v3`) to `build/windows/`, and run `makensis /DEXE=<full path of the exe> /DOUTFILE=<full path of the setup> build\windows\installer.nsi`.

## Questions?

Feel free to open an issue if you have questions or need help getting started.

