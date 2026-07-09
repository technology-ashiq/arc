# PROGRESS.md — arc v2 "World-Best" Upgrade

> Tracker for the initiative planned in `PLAN.md`. Rows flip ✅ only via `/arc-phase-done`
> (tests green + live demo + exit criteria + evidence). Evidence over assertion.

## Now

**Phase 02 — all 8 slices BUILT; closing via `/arc-phase-done 2`.** Gate engine v1
(`phases/phase-02-spec.md`, 2-week appetite), the highest-risk noise-defense phase (pre-mortem #1).
On `main` (7 slices merged, 3-OS CI green): gitleaks path fidelity · baseline (new-code-only) ·
`arc.gates.yaml` + generic gate-runner · suppression ledger · evidence bundles · macOS CI +
portability audit · per-adapter runtime fallback (native→docker→SKIPPED). On branch
`feat/phase-02-llm-triage`: **LLM triage v1** — downgrade-only false-positive filter (<8/10 → error
downgraded to note, tagged; never upgrades, never invents — PLAN rabbit hole #6). Pluggable backend
`ARC_TRIAGE_CMD` (finding JSON → confidence), deterministic fake trusts-all offline, fail-closed on
any backend error. +12 bats. Full suite ~79.

**Remaining to close Phase 02 (at `/arc-phase-done 2`):** hook-tier <30s budget check · live demo
(new finding blocks / baseline passes / justified suppress passes / unjustified blocks) · first
dogfooded evidence bundle via arc-evidence.sh · flip the Phase 02 row.

Setup needed from user: **none (all local)**. Docker rung of #9 is fake-tested now; the real pinned
arc-tools image is Phase 03 (ADR-0006 amendment).

Closed: Phase 00 (steel thread) · Phase 01 (credibility & hygiene). Both 3-OS CI-green, evidence-backed.

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
