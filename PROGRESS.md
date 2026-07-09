# PROGRESS.md — arc v2 "World-Best" Upgrade

> Tracker for the initiative planned in `PLAN.md`. Rows flip ✅ only via `/arc-phase-done`
> (tests green + live demo + exit criteria + evidence). Evidence over assertion.

## Now

**Phase 00 CLOSED ✅ (2026-07-09).** Steel thread proven end-to-end + cross-platform. Next up:
**Phase 01 — Credibility & hygiene** (`phases/phase-01-spec.md`, 1-week appetite): flip gates to
block-by-default (ADR-0008), wire `/arc-review` to code-stamp the `scan` verdict into the review
ledger, cross-platform sync, strictness profiles, repo cleanup.

Open thread before Phase 01 code starts: PR #1 is green but branch `feat/phase-00-steel-thread` may
still need merge → main (last local commit `bbda7cb` — tracker sync — unpushed). Merge first so
Phase 01 branches off a clean main.

Phase 00 shipped: `arc-scan` spine (diff-scope → semgrep+gitleaks adapters → SARIF merge → triage
stub → ledger stamp), 13 bats tests, CI matrix (ubuntu+windows), VERSION/CHANGELOG + version-gate.

## Phases

| Phase | Capability | Appetite | Status | Closed |
|---|---|---|---|---|
| 00 | Steel thread: arc-scan skeleton + CI on arc | 1 week | ✅ done | 2026-07-09 |
| 01 | Credibility & hygiene: block-by-default, code-stamp, cross-platform sync | 1 week | ⬜ not started | |
| 02 | Gate engine v1: gates.yaml, baseline, suppression, evidence bundles | 2 weeks | ⬜ not started | |
| 03 | Security pipeline: Trivy, trufflehog, CodeQL, RLS harness, ZAP | 1.5 weeks | ⬜ not started | |
| 04 | QA pipeline: Stryker, Lighthouse CI, visual regression, schemathesis | 1.5 weeks | ⬜ not started | |
| 05 | Phase ratchet + docs gate v2 | 1 week | ⬜ not started | |
| 06 | Measured agent quality: eval corpus, retro→eval loop · **cut-line** | 2 weeks | ⬜ not started | |
| 07 | Adversarial orchestration: saboteur, parallel gates, quorum · **cuttable** | 2 weeks | ⬜ not started | |
| 08 | Distribution | next cycle | ⏸ parked | |

## Done log

- **2026-07-09 · Phase 00 · Steel thread.** Shipped `arc-scan` spine (diff-scope → semgrep+gitleaks
  adapters → minimal-SARIF normalize/merge → threshold triage stub → review-ledger `scan` stamp),
  offline `arc-min` ruleset, `version-gate`. **13 bats tests** (degrade · normalize · merge · triage ·
  ledger · e2e), all green. CI matrix **green on ubuntu + windows Git Bash** (PR #1, run 29015093526).
  Live demo: seeded repo (planted eval-injection + `ghp_` secret) → `block` exit 2; clean → `pass`
  exit 0, stamps `scan`. **Actual: ~1 session (< 1 day) vs 1-week appetite — well under, no retro flag.**
  CI caught a real Windows/Linux exec-bit split on run 1 (fixed in `e3e9d51`) — cross-platform moat
  proved itself day one. Carry-forward to Phase 2: gitleaks staging-path fidelity (finding URIs show
  the temp stage dir, not the repo-relative path).

## North-star metric

Escaped defect rate (post-gate production bugs) — tracking begins at Phase 02 close.
