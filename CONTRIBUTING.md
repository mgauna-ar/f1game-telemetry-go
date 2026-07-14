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

- [Go 1.21+](https://go.dev/dl/)
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

## Questions?

Feel free to open an issue if you have questions or need help getting started.
