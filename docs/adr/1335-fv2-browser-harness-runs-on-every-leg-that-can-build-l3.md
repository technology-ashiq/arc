# ADR 1335 — the browser harness runs from bats on every CI leg that can build L3; Node 18 is a named skip

**Status:** accepted
**Date:** 2026-09-16
**Product:** face
**Reversibility:** two-way
**Revisit trigger:** the browser suite is red on one OS leg for a reason outside the product (Chrome absent, runner image change) in 2 consecutive CI runs → the owner rules whether that leg drops to build-only, by new ADR; or `.github/workflows/**` becomes writable → move the suite to a dedicated job with an npm cache.
**Provenance:** owner ruling at the Cycle 16 kickoff, 2026-09-16 ("All legs Node ≥20"). Facts verified by a researcher the same day.

## Context

CI is 18 test jobs across 5 configurations: ubuntu Node 18/20/22, macOS Node 20 ×3 shards, windows Node 20 ×12 shards,
all bats-driven. `.github/workflows/**` is write-denied to the build session, so new gates run
from bats. No leg has ever run `npm ci` or built `face/`. The owner runs the face on Windows.

## Options considered

1. **Every leg with Node ≥20.19: `npm ci` + build + smoke (both moods) + flows, from one bats file; Node 18 prints a named, counted skip.**
2. **Browser on ubuntu only; windows and macOS build-only** — cheaper, blind to the OS the owner uses.
3. **Owner hand-edits a dedicated workflow job** — faster CI, but a hand task for the owner.

## Decision

Option 1, with four forced mechanics:

1. **Socket:** a dependency-free RFC 6455 client in a `.mjs` (text frames, client masking) — never Node's global `WebSocket`, which is flagged on Node 20 and absent on 18.
2. **Chrome:** `CHROME_BIN` if it happens to be set (never relied on) → the OS lookup: Windows the `App Paths\chrome.exe` registry key, then `%ProgramFiles%\Google\Chrome\Application\chrome.exe`; macOS `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`; Linux `command -v google-chrome`, then `/usr/bin/google-chrome` → **FAIL** naming every place tried. Never a skip. Linux launches with `--no-sandbox`. The suite prints the runner image name, because `-latest` labels move.
3. **Node 18:** the suite prints `SKIP: Vite 8 and @tailwindcss/oxide require Node >=20.19` and the skip is asserted as a skip — it can never read as a pass.
4. **Lockfile:** before `npm ci --include=optional`, a check FAILs if `face/package-lock.json` lacks the platform entries this leg needs (the Windows-generated-lockfile defect, npm/cli#4828); the suite gets a measured shard weight, never the default.

**Evidence:** Vite 8 `engines.node ^20.19.0 || >=22.12.0` (vite.dev/blog/announcing-vite8); Node `WebSocket` flagged from 20.10, unflagged from 22.0 (nodejs.org release posts); Chrome is installed on all three current images — and as of 2026-09 `windows-latest` maps to **Windows Server 2025** and `macos-latest` to **macOS 26 arm64** (actions/runner-images `README.md`, `images/windows/Windows2025-VS2026-Readme.md`, `images/macos/macos-26-arm64-Readme.md`, `images/ubuntu/Ubuntu2404-Readme.md`); the images document only `CHROMEWEBDRIVER`, and whether ubuntu exports `CHROME_BIN` is **CONTESTED** between two independent researchers (one read `install-google-chrome.sh` as exporting it, the re-verification found no such variable), so discovery does not depend on it; binary paths are inferred from the install scripts (`Install-Chrome.ps1` resolves `App Paths\chrome.exe`; `install-chrome.sh` invokes `/Applications/Google Chrome.app/…`), not printed verbatim — medium-high; `--no-sandbox` needed on GitHub Ubuntu runners (pptr.dev troubleshooting); Windows `npm ci` slower on runner I/O (actions/runner-images#12369).
**Confidence:** medium
**Rejected because:** ubuntu-only — blind on the owner's OS; owner-edited workflow — a hand task the owner did not choose.

## Consequences

- Phase 00 proves this on the real matrix before any token or module work (ADR-1336).
- A windows shard carries `npm ci` + build + a Chrome run; its measured weight must be committed with the suite, or it rides the 16 s default against a multi-minute cost.
