# PROGRESS.md — ci v1 "one Linux gate"

status: LIVE
cycle: arc-ci (Cycle 1, opened 2026-10-24)
phase: 00
appetite: 5d
burn: 0d
blocked-on: owner — gitleaks full-history scan, GitHub Pro (the deny was lifted 2026-10-24)
depends-on: —

Tracker for `PLAN.md`. Rows flip ✅ only via `/arc-phase-done`. Evidence in `initiatives/ci/evidence/phase-NN/`.
ADR century 2200–2299; ADR-2200..2211 written at kickoff. CI-M = 1 (GitHub Pro) and CI-N = yes, answered by the owner at kickoff 2026-10-24.

## Phases

| Phase | Capability | Appetite | Status |
|---|---|---|---|
| 00 | Steel thread: `ci.yml` rewritten in place, green on its own PR, §5 cut-over, merged | 0.5d | ⏳ |
| 01 | Local-first pre-push + `npm run ci` + weekly/release/dependabot + rules rewritten + face/launch filings + paperwork skip + dead hooks | 1.25d | ⬜ |
| 02 | `node:test` harness + `org` template + worker kit + merge-time grammar + kill-line timing | 1d | ⬜ |
| 03 | D.6 pilot on owner-named models + scorecard | 0.5d | ⬜ |
| 04 | Fan-out + retire bats + cycle close | 1.5d | ⬜ |

## Done-log

- **Kickoff 2026-10-24**: PLAN, 5 phase specs, ADR-2200..2211, from design source `docs/strategy/plans/PLAN-ci.md` v1.0. The kernel freeze `01M5ER722…` blocked the lane; the owner chose to exempt `ci Cycle 1`, and the superseding ruling `01M5N3AQZH98Q3FE3MKKX68B8Z` was emitted from the main clone and awaits the owner's `arc-inbox approve`. Verification found that the arc gates run as bats suites, not `ci.yml` steps (ADR-2016), so Phase 00's `quality` carries only version-gate + product-lint. The attack panel (3 attackers, 20 findings: 17 applied, 3 rejected) removed the shared `tests/bats.count` (derived floor, `ci-floor.mjs`), landed face's expected-set edit inside the ci PR, made `changes` fail open, kept the full bats suite out of pre-push, and fixed REQ-01's bound (≤ 7). The simulator went 21 blockers → round 2.

**Appetite burn:** 0 of 5 days used (0%).

## Now

**Current position:** kickoff APPROVED 2026-10-24: `approval.requested` `01M5N4RMK2NYSAXX8ZBYR3RV5D` decided by `decision.recorded` `01M5N5RY5VSW2F7ANM68X56M76`; freeze exemption `01M5N3AQZH98Q3FE3MKKX68B8Z` decided by `01M5N4V5FRJ06FMJP2N53A48CW` (both approve). `kickoff.done` `01M5N4RM8HZDPFYYZ7NA5WE8S0`.
**Change 2026-10-24 (`/arc-change`):** the dev-loop audit was folded into Phase 01 (REQ-02 widened to paperwork PRs, REQ-11 added, REQ-03 merged into REQ-01, ADR-2212). It awaits the owner's OK together with the kickoff.
**Next step:** owner approves → owner lifts the `.github/workflows/**` deny (Phase 00 owner prep) → `feat/ci-p00-gate` off fresh `origin/main`.

**Position 2026-10-24 (build session):**
- **00** -- PR #461 (`feat/ci-p00-gate` @ `562bf9cf`) GREEN 11/11 on run 40035076217. **HELD unmerged by the owner**
  (a pending arc change). `main` has NO required status checks today (API: "Required status checks not enabled"),
  so §5 step 2 is: add `quality`, `test`, `security`, `face`, `ci-tier` as required, strict, on `main`.
- **01** -- built on `feat/ci-p01-local-first` (stacked on 00): ci-changes `code=` paperwork skip, ci-quality.sh,
  test-changed pre-push + `npm run ci`, ESLint trial in `tools/lint`, .nvmrc, docs, handoffs filed. Attack: 2 rounds
  (boundary 12+6+6+7, logic 15 + 8 on reasoning-on), every medium+ fixed or rejected in `evidence/phase-01/`.
  `npm run ci` green locally. **Not pushed**: the new pre-push hit its 5-min cap on this stacked branch (A-04 strike 1);
  it pushes cleanly once 00 merges, or by the owner's OK to push once with `--no-verify`.
  Still owed: weekly/release/dependabot + workflow retire (waits on face's go-ahead, `handoffs/face-expected-set.md`);
  the 3 dead hooks + the composer read-hook line (deny-floor `.claude/hooks/**`: the owner's one line).
- **02** -- built on `feat/ci-p02-org` (worktree `E:/Work_Hub/01_Automemory/wt-ci-p02`): tests/_lib, migrate-guard
  (self-test 7/7: clean PASS, 6 mutants FAIL), gate-parity node rows, MIGRATING.md, migrate-worktree.sh, org 73/73.
  **§11 kill line: org bats 678 s vs node:test 222 s = 3.05x, below 5x -> STOP Phase D and re-plan with the owner.**
- **03/04** -- not started: 03 needs two owner-named models (CI-R), and the §11 line above stops Phase D first.
