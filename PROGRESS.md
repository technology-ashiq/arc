# PROGRESS.md — arc v2 "World-Best" Upgrade

> Tracker for the initiative planned in `PLAN.md`. Rows flip ✅ only via `/arc-phase-done`
> (tests green + live demo + exit criteria + evidence). Evidence over assertion.

## Now

**Phase 00 built — ready for `/arc-phase-done 0`.** Steel thread runs end-to-end on Windows Git Bash:
`arc-scan.sh` (diff-scope → semgrep+gitleaks adapters → minimal-SARIF normalize/merge → threshold
triage → review-ledger stamp). 13/13 bats tests green; version gate green; live demo verified
(seeded dirty repo → `block` exit 2 with 2 errors; clean → `pass` exit 0, stamps `scan`).

Built this session:
- `.claude/scripts/arc-scan/` — `arc-scan.sh`, `adapters/{semgrep,gitleaks}.sh`, `lib/{common,sarif,triage}.sh`, `rules/arc-min.yaml`, `version-gate.sh`
- `tests/arc-scan.bats` + `tests/test_helper.bash` (13 tests: degrade · normalize · merge · triage · ledger · e2e)
- `.github/workflows/ci.yml` — bats on ubuntu + windows Git Bash, version gate, best-effort tool install
- `VERSION` (0.2.0) + `CHANGELOG.md`; `scan` kind added to `review-ledger.sh`
- Toolchain: installed `jq` (scoop) + `bats` (npm); opengrep + gitleaks already present

Pending before close: push so CI proves green on **both** matrix legs (only Windows-local proven so far),
then `/arc-phase-done 0` to stamp the tracker + record actual-vs-appetite.

## Phases

| Phase | Capability | Appetite | Status | Closed |
|---|---|---|---|---|
| 00 | Steel thread: arc-scan skeleton + CI on arc | 1 week | ⬜ not started | |
| 01 | Credibility & hygiene: block-by-default, code-stamp, cross-platform sync | 1 week | ⬜ not started | |
| 02 | Gate engine v1: gates.yaml, baseline, suppression, evidence bundles | 2 weeks | ⬜ not started | |
| 03 | Security pipeline: Trivy, trufflehog, CodeQL, RLS harness, ZAP | 1.5 weeks | ⬜ not started | |
| 04 | QA pipeline: Stryker, Lighthouse CI, visual regression, schemathesis | 1.5 weeks | ⬜ not started | |
| 05 | Phase ratchet + docs gate v2 | 1 week | ⬜ not started | |
| 06 | Measured agent quality: eval corpus, retro→eval loop · **cut-line** | 2 weeks | ⬜ not started | |
| 07 | Adversarial orchestration: saboteur, parallel gates, quorum · **cuttable** | 2 weeks | ⬜ not started | |
| 08 | Distribution | next cycle | ⏸ parked | |

## Done log

_(empty — filled by `/arc-phase-done`: date · phase · tests count · actual vs appetite)_

## North-star metric

Escaped defect rate (post-gate production bugs) — tracking begins at Phase 02 close.
