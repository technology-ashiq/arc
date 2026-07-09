# PROGRESS.md — arc v2 "World-Best" Upgrade

> Tracker for the initiative planned in `PLAN.md`. Rows flip ✅ only via `/arc-phase-done`
> (tests green + live demo + exit criteria + evidence). Evidence over assertion.

## Now

**Phase 01 BUILT — ready for CI + `/arc-phase-done 1`.** Branch `feat/phase-01-credibility`
(7 commits). All 8 exit criteria met locally: block-by-default profiles, `/arc-review` code-stamp,
cross-platform sync, hygiene, docs. **30 bats tests green** (13 scan + 11 profile + 6 sync),
docs-drift dogfood passes, version-gate green. Decisions applied: default profile = `standard`,
Playwright kept as fallback.

Remaining to close: push → CI green on both legs → `/arc-phase-done 1`. Appetite: part of one
session vs 1-week cap — well under.

Open thread: PR #2 (Phase 00 close — tracker + graph) still unmerged; the Phase 01 branch stacks on
it, so merge PR #2 → main first, then the Phase 01 PR shows only Phase 01 commits.

Phase 00 (CLOSED ✅ 2026-07-09): `arc-scan` spine, 13 bats, CI matrix, VERSION/CHANGELOG + gate.

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
