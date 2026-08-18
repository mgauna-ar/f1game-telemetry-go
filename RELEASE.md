# 🚀 Release Process & Standard Operating Procedure (SOP)

This document defines the formal release process, versioning rules, pre-flight checklists, and publishing workflows for **F1 Telemetry Analyzer**.

---

## 📌 1. Semantic Versioning Conventions

This project strictly adheres to [Semantic Versioning (SemVer 2.0.0)](https://semver.org/):

| Format | Type | Description & Example |
|---|---|---|
| `vX.Y.Z` | **Stable Release** | Production-ready release for general users (e.g. `v1.0.0`, `v1.1.0`). |
| `vX.Y.Z-beta.N` | **Beta Pre-Release** | Public preview for beta testing new features (e.g. `v1.0.0-beta.1`, `v1.0.0-beta.2`). Automatically marked as *Pre-release* on GitHub. |
| `vX.Y.Z-rc.N` | **Release Candidate** | Final stabilization build prior to a major/minor stable release (e.g. `v1.0.0-rc.1`). |

* **`X` (Major):** Breaking architectural changes, major UI overhauls, or breaking database schema shifts.
* **`Y` (Minor):** New backwards-compatible features (e.g. new analysis tab, new LLM provider, new game season pack support).
* **`Z` (Patch):** Bug fixes, packet decoding alignments, and performance optimizations.

---

## 📋 2. Pre-Flight Release Checklist

Before creating any release tag, complete the following validation steps locally on `main`:

### ✅ Step 1: Run Automated Backend & Frontend Tests
```bash
# Run all Go tests with race detector
make test

# Run all React component and hook tests
cd frontend && npm run test && cd ..
```
*Both suites must pass with **0 failures**.*

### ✅ Step 2: Code Linting & Formatting
```bash
# Backend lint and format
make fmt
make lint

# Frontend lint
cd frontend && npm run lint && cd ..
```

### ✅ Step 3: Test Single-Binary Embedded Build
```bash
# Build standalone single-binary with embedded frontend:
make build-embedded

# Verify version output:
./bin/f1telemetry -version
```

### ✅ Step 4: Update Documentation & Changelog
1. Open [`CHANGELOG.md`](CHANGELOG.md).
2. Move items from `[Unreleased]` into a new version header:
   ```markdown
   ## [1.0.0-beta.1] - 2026-08-18
   ### Added
   - Description of new features...
   ```
3. Update the compare links at the bottom of `CHANGELOG.md`.

---

## 🏷️ 3. Tagging & Automated Publishing

All release archives and checksums are compiled and published **automatically** by GitHub Actions upon pushing a version tag.

### Option A: Via Command Line (Recommended)
```bash
# 1. Commit any changelog and version updates
git add .
git commit -m "chore(release): prepare v1.0.0-beta.1"
git push origin main

# 2. Create and push the annotated git tag
git tag v1.0.0-beta.1
git push origin v1.0.0-beta.1
```

### Option B: Via GitHub Actions Web UI
1. Navigate to **Actions** → **Release** workflow.
2. Click **Run workflow**.
3. Enter the tag name (e.g. `v1.0.0-beta.1`).
4. Click **Run workflow**.

---

## ⚙️ 4. What GitHub Actions Automates

When triggered, the [`.github/workflows/release.yml`](.github/workflows/release.yml) pipeline executes:
1. **Frontend Production Build**: Compiles TypeScript and bundles optimized assets via Vite (`npm run build`).
2. **On-the-Fly Windows Icon & Manifest Generation**: Generates embeddable Windows `.syso` resources from `frontend/public/apple-touch-icon.png`.
3. **Cross-Platform Compilation**:
   * `windows/amd64` → `f1telemetry_vX.X.X_windows_amd64.zip` (with custom F1 icon)
   * `windows/arm64` → `f1telemetry_vX.X.X_windows_arm64.zip` (with custom F1 icon)
   * `darwin/arm64` → `f1telemetry_vX.X.X_darwin_arm64.zip` (Apple Silicon M1-M4)
   * `darwin/amd64` → `f1telemetry_vX.X.X_darwin_amd64.zip` (macOS Intel)
   * `linux/amd64` → `f1telemetry_vX.X.X_linux_amd64.tar.gz`
   * `linux/arm64` → `f1telemetry_vX.X.X_linux_arm64.tar.gz`
4. **SHA-256 Checksum Generation**: Produces `checksums.txt`.
5. **Release Creation**: Publishes the GitHub Release with attached binaries, automatic changelog generation, and pre-release badging.

---

## 🔍 5. Post-Release Smoke Test

After GitHub Actions finishes (typically ~1-2 minutes):

1. Open the release page: `https://github.com/mgauna/f1game-telemetry-go/releases/tag/vX.X.X`.
2. Download the archive for your operating system.
3. Extract and launch `f1telemetry` / `f1telemetry.exe`.
4. Verify:
   * App opens your browser to `http://localhost:8080`.
   * Banner shows correct version and LAN IP.
   * Running `make simulate` sends packets that render live on the dashboard.
   * Closing the console window terminates the application cleanly.

---

## 🚨 6. Hotfix & Rollback Procedures

### If a critical bug is discovered after release:

1. **Immediate Hotfix Release**:
   * Branch from `main`: `git checkout -b hotfix/vX.Y.Z+1`.
   * Apply the fix, add tests, and update `CHANGELOG.md`.
   * Merge to `main` and tag `vX.Y.Z+1`.
   * Push tag to trigger automatic rebuild and release.

2. **Revoking / Unpublishing a Faulty Release**:
   * Navigate to GitHub **Releases** → Click **Edit** on the affected release.
   * Check **Set as a pre-release** (or delete the release asset) and add a warning notice pointing users to the hotfix version.
