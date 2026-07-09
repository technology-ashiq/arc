# PROGRESS.md — arc v2 "World-Best" Upgrade

> Tracker for the initiative planned in `PLAN.md`. Rows flip ✅ only via `/arc-phase-done`
> (tests green + live demo + exit criteria + evidence). Evidence over assertion.

## Now

**Phase 01 CLOSED ✅ (2026-07-09).** Block-by-default profiles live, CI green on both legs (PR #3).
Next up: **Phase 02 — Gate engine v1** (`phases/phase-02-spec.md`, 2-week appetite). **Highest-risk
phase after 0** (noise defense — pre-mortem #1: if the first scan dumps 400 findings and gates get
flipped to warn, the moat dies). Delivers: `arc.gates.yaml` declarative gates + generic gate-runner,
baseline (new-code-only blocking), LLM triage v1 (≥8/10 confidence, downgrade-only), suppression
ledger with justification, and committed evidence bundles at phase-close.

Setup needed from user: **none (all local)**. Open thread: PR #3 (Phase 01) is green — merge → main
before branching Phase 02.

Closed: Phase 00 (steel thread) · Phase 01 (credibility & hygiene). Both CI-green on ubuntu + windows.

## Phases

| Phase | Capability | Appetite | Status | Closed |
|---|---|---|---|---|
| 00 | Steel thread: arc-scan skeleton + CI on arc | 1 week | ✅ done | 2026-07-09 |
| 01 | Credibility & hygiene: block-by-default, code-stamp, cross-platform sync | 1 week | ✅ done | 2026-07-09 |
| 02 | Gate engine v1: gates.yaml, baseline, suppression, evidence bundles | 2 weeks | ⬜ not started | |
| 03 | Security pipeline: Trivy, trufflehog, CodeQL, RLS harness, ZAP | 1.5 weeks | ⬜ not started | |
| 04 | QA pipeline: Stryker, Lighthouse CI, visual regression, schemathesis | 1.5 weeks | ⬜ not started | |
| 05 | Phase ratchet + docs gate v2 | 1 week | ⬜ not started | |
| 06 | Measured agent quality: eval corpus, retro→eval loop · **cut-line** | 2 weeks | ⬜ not started | |
| 07 | Adversarial orchestration: saboteur, parallel gates, quorum · **cuttable** | 2 weeks | ⬜ not started | |
| 08 | Distribution | next cycle | ⏸ parked | |

## Done log

- **2026-07-09 · Phase 01 · Credibility & hygiene.** Shipped block-by-default via strictness
  profiles (`arc-profile.sh`: starter/standard/strict, one `arc.profile` key switches coverage+docs+scan
  as a set, per-gate + env overrides); `/arc-review` auto-stamps `code` on ship verdict; cross-platform
  `sync-to-project.sh` (bash twin of .ps1); repo hygiene (5 write-probes removed+gitignored, agent-browser
  SHIPPED, Playwright kept-as-fallback); docs (usermanual/README/how-it-works/CHANGELOG). **30 bats tests**
  (13 scan + 11 profile + 6 sync), green **in CI on ubuntu + windows** (PR #3, run 29021894177, `1..30`).
  Live demo: profile switches all gates; code-stamp gates ledger `require` (BLOCK exit 2 → PASS exit 0);
  sync excludes personal/state. docs-drift dogfood exit 0. **Actual: part of one session vs 1-week
  appetite — well under, no retro flag.** Decisions: default profile `standard`, Playwright kept.
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
