# PROGRESS.md — ci v1 "one Linux gate"

status: LIVE
cycle: arc-ci (Cycle 1, opened 2026-10-24)
phase: 03
appetite: 5d
burn: 1d
blocked-on: owner — §5 step 2: required checks on main (one gh api line)
depends-on: —

Tracker for `PLAN.md`. Rows flip ✅ only via `/arc-phase-done`. Evidence in `initiatives/ci/evidence/phase-NN/`.
ADR century 2200–2299; ADR-2200..2211 written at kickoff. CI-M = 1 (GitHub Pro) and CI-N = yes, answered by the owner at kickoff 2026-10-24.

## Phases

| Phase | Capability | Appetite | Status |
|---|---|---|---|
| 00 | Steel thread: `ci.yml` rewritten in place, green on its own PR, §5 cut-over, merged | 0.5d | ✅ |
| 01 | Local-first pre-push + `npm run ci` + weekly/release/dependabot + rules rewritten + face/launch filings + paperwork skip + dead hooks | 1.25d | ✅ |
| 02 | `node:test` harness + `org` template + worker kit + merge-time grammar + kill-line timing | 1d | ✅ |
| 03 | D.6 pilot on owner-named models + scorecard | 0.5d | ⬜ |
| 04 | Fan-out + retire bats + cycle close | 1.5d | ⬜ |

## Done-log

- **Kickoff 2026-10-24**: PLAN, 5 phase specs, ADR-2200..2211, from design source `docs/strategy/plans/PLAN-ci.md` v1.0. The kernel freeze `01M5ER722…` blocked the lane; the owner chose to exempt `ci Cycle 1`, and the superseding ruling `01M5N3AQZH98Q3FE3MKKX68B8Z` was emitted from the main clone and awaits the owner's `arc-inbox approve`. Verification found that the arc gates run as bats suites, not `ci.yml` steps (ADR-2016), so Phase 00's `quality` carries only version-gate + product-lint. The attack panel (3 attackers, 20 findings: 17 applied, 3 rejected) removed the shared `tests/bats.count` (derived floor, `ci-floor.mjs`), landed face's expected-set edit inside the ci PR, made `changes` fail open, kept the full bats suite out of pre-push, and fixed REQ-01's bound (≤ 7). The simulator went 21 blockers → round 2.

- **Phase 00 closed 2026-10-25** (PR #461): `ci.yml` is the one-Linux gate. REQ-01: PR #466's run 40114187097 started 9 jobs, all `ubuntu-latest`, Node 24 (face and ci-tier skip when their paths are untouched). REQ-03 (merged into REQ-01): `evidence/phase-00/cost.md`, 43 billed min against the old matrix's 414. The post-flip column is not measured because the repo is still public. Required checks: `main` still reports "Required status checks not enabled" at this close (2026-10-25). The §5 step-2 edit (strict `quality, test, security, face, ci-tier`) is the owner's one `gh api -X PUT` line, carried as blocked-on; nothing else in Phase 00 is open. Proven by: external (GitHub runs + the protection read-back). amendments: 1 · reopened: n · t-to-phase0: 1d.
- **Phase 01 closed 2026-10-25** (PRs #463, #465, #466, #468): local-first pre-push + `npm run ci`, the paperwork skip, the dead dev-loop hooks retired (REQ-11), and weekly/release/dependabot in with the 3 throwaway workflows out (REQ-07). REQ-07: `gh workflow run weekly.yml --ref main` run 40123984593 @ 03a6e2c5 was success on all 3 jobs, with windows `# tests 104`, pass 104, fail 0, and `.count` claim 73. REQ-04: `script-vs-workflow.md`, 0 gate steps missing. REQ-05: `pre-push-control-{1,2}.md`, push exit=1 both times. REQ-11: a fresh sync target lacks the 3 hooks, `.claude/hooks` holds 0 `npx`, and spine `tool.postuse` was 0 on 2026-10-25 across ~100 edits (7 on 10-24 before the merge). REQ-02: PR #476 (evidence only) ran 40124984137: changes/quality/security/test success, bats + node-test skipped. Attack: 4 rounds over 2 PRs; holes (ag)-(am) fixed, D16-D24 ledgered. Proven by: external (weekly dispatch, CI) + suite. amendments: 3 (paperwork + hooks fold, A-04 FIRED, Phase 03 models) · reopened: n.
- **Phase 02 closed 2026-10-25** (PR #464): node:test harness, the `org` template lane (73 = 73, both green, the name map, 6 mutants FAIL in migrate-guard), the worker kit, and the §11 kill line, ruled PASS by the owner at ~5.2x after the function-style pilot. Proven by: suite + the CI parity run. amendments: 1 (A-05 function-style pilot) · reopened: n.

**Appetite burn:** 1 of 5 days used (20%). Phases 00-02 were 2.75d of appetite, built in 1d.

## Now

**Current position:** kickoff APPROVED 2026-10-24: `approval.requested` `01M5N4RMK2NYSAXX8ZBYR3RV5D` decided by `decision.recorded` `01M5N5RY5VSW2F7ANM68X56M76`; freeze exemption `01M5N3AQZH98Q3FE3MKKX68B8Z` decided by `01M5N4V5FRJ06FMJP2N53A48CW` (both approve). `kickoff.done` `01M5N4RM8HZDPFYYZ7NA5WE8S0`.
**Change 2026-10-24 (`/arc-change`):** the dev-loop audit was folded into Phase 01 (REQ-02 widened to paperwork PRs, REQ-11 added, REQ-03 merged into REQ-01, ADR-2212). It awaits the owner's OK together with the kickoff.
**Next step (2026-10-25):** Phase 03 pilot. Two workers, owner-named (claude-sonnet-5-5 on `spine`, claude-haiku-5-5 on `jobs`), each via `migrate-worktree.sh` + `tests/MIGRATING.md`, then the scorecard (REQ-10). Phases 00-02 are closed; their position notes below are history.

**Position 2026-10-24 (build session):**
- **00** -- PR #461 (`feat/ci-p00-gate` @ `562bf9cf`) GREEN 11/11 on run 40035076217. **HELD unmerged by the owner**
  (a pending arc change). `main` has NO required status checks today (API: "Required status checks not enabled"),
  so §5 step 2 is: add `quality`, `test`, `security`, `face`, `ci-tier` as required, strict, on `main`.
- **01** -- built on `feat/ci-p01-local-first` (stacked on 00): ci-changes `code=` paperwork skip, ci-quality.sh,
  test-changed pre-push + `npm run ci`, ESLint trial in `tools/lint`, .nvmrc, docs, handoffs filed. Attack: 2 rounds
  (boundary 12+6+6+7, logic 15 + 8 on reasoning-on), every medium+ fixed or rejected in `evidence/phase-01/`.
  `npm run ci` green locally. **Not pushed**: the new pre-push hit its 5-min cap on this stacked branch (A-04 strike 1); strike 2 on 2026-10-24: a one-line fix in `tests/distribute-ship-nodeploy.bats` pulled the whole distribute lane (20 files) past the cap, pushed once with `--no-verify` on the owner's OK;
  it pushes cleanly once 00 merges, or by the owner's OK to push once with `--no-verify`.
  Still owed: weekly/release/dependabot + workflow retire (waits on face's go-ahead, `handoffs/face-expected-set.md`);
  the 3 dead hooks + the composer read-hook line (deny-floor `.claude/hooks/**`: the owner's one line).
- **02** -- built on `feat/ci-p02-org` (worktree `E:/Work_Hub/01_Automemory/wt-ci-p02`): tests/_lib, migrate-guard
  (self-test 7/7: clean PASS, 6 mutants FAIL), gate-parity node rows, MIGRATING.md, migrate-worktree.sh, org 73/73.
  **§11 kill line: org bats 678 s vs node:test 222 s = 3.05x, below 5x -> STOP Phase D and re-plan with the owner.**
- **03/04** -- not started: 03 needs two owner-named models (CI-R), and the §11 line above stops Phase D first.
**Change 2026-10-24 (`/arc-change`, owner OK):** A-05 FIRED (org 3.05x < 5x). Before any re-plan, a function-style pilot on `org` (`team`, `role-seat`, `judge`) re-times the lane; ≥ 5x keeps Phase D with that method, < 5x → strangler. Exit criterion in `phases/phase-02-spec.md`.
**Ruling 2026-10-24 (owner):** pilot re-time ~5.2x (117-145 s vs 678 s bats) → §11 passes, Phase D continues; MIGRATING.md carries the slow-test-own-file rule.
**Change 2026-10-24 (`/arc-change`, owner):** Phase 03 pilot models named: Sonnet 5.5 → `spine`, Haiku 5.5 → `jobs`, on the subscription (ADR-2211 amendment); scorecard cost = usage-limit %; A-06 superseded.
**Change 2026-10-24 (`/arc-change`, owner):** A-04 FIRED (3 pre-push cap hits); pre-push narrows bats to the files naming a changed path (phase-01 spec), branch `feat/ci-prepush-files`.
**Build 2026-10-24 (REQ-11, `feat/ci-p01-hooks`):** A-04 fix merged #465 (14a80c41). REQ-11 agent half: `sync-to-project.sh` RETIRED list (sha256 of every shipped version; edited copies kept) + one sync.bats case, manifest/golden/spine-wiring rows, the 2 SessionEnd session-log tests -> `tests/DROPPED.md`. `docs/session-log.md` was already untracked + ignored. The read hook arms only on `composer-session--*` (scope-check line 173), not the single `composer-session` the spec named, so its early exit tests that glob. Owner half: delete the 3 hooks + that one read-hook line (deny-floor).
**Build 2026-10-24 (REQ-07, `feat/ci-p01-workflows`):** REQ-11 merged #466 (ca9a1b93); face go-ahead merged #467. Agent half: expected-set rows (`workflow:weekly` + `workflow:release` in, the 3 throwaway workflows out) + `face-sections.mjs` regen; `tests/shard-tests.bats` + `tests/shard-timings.json` removed, 13 rows in `tests/DROPPED.md`, its ASCII-name guard moved to `ci-gate.bats` (recursive now; the nested-file guard is dropped because `ci-bats-shard.sh` finds nested files); `docs/owner-paste-ci-pin-opengrep.yml` -> `docs/archive/`; pre-push fix (owner): a push of only `initiatives/<lane>/*.md` notes no test names exits 0 as paperwork (CI still treats them as code). Owner half (deny-floor `.github/`): add `weekly.yml`, `release.yml`, `dependabot.yml` (npm at `/face` + `/tools/lint`: the root has no dependencies), remove the 3 workflows + `.github/scripts/shard-tests.mjs`.
