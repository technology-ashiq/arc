# Phase 02 — `node:test` harness, the `org` template lane, and the worker kit

**Goal (one line):** `tests/_lib/` gives tests the helpers they actually use, `org` (11 files, 73 tests) migrates as the worked example under the §6 parity gate, and the worker kit (`migrate-guard.mjs`, `tests/MIGRATING.md`, `migrate-worktree.sh`) lets Phase 03 start a lane with no Claude judgement. The §11 kill line is checked here.
**Appetite:** 1 day — blown appetite = cut scope or kill, never extend silently
**Depends on:** phase-01
**REQs closed here:** REQ-09

**Decisions applied:** ADR-2202 (node:test, parity gate, per-lane .count), ADR-2207 (migrate-guard FAIL from birth).

## Scope

- Inventory the helpers first (`grep -oh '_arc_[a-z_]*\|run_[a-z_]*' tests/*.bats | sort | uniq -c`), then `tests/_lib/`: `ARC_ROOT`, a per-test temp dir, `runNode(script, args)` → `{status, stdout, stderr}`, `runBash(...)`, fixture copy + mutate (the mutation is asserted before the case asserts anything, retro 2026-10-14#3).
- `org` migrated to `tests/org/*.test.mjs` with `MIGRATED.md` + `.count`; §6 proof; `org-*.bats` deleted.
- `migrate-guard.mjs {lane}`: the six D.4 guards, one PASS/FAIL table, FAIL from birth; a step of the `test` job on `migrate/*` PRs. Its self-test in `tests/core/` plants one mutant per guard (REQ-09).
- `gate-parity.mjs:157` also accepts `tests/{lane}/{file}.test.mjs::{name}` (same exists + no-skip checks), so the 5 pinned bats files can move.
- `tests/MIGRATING.md` (the D.3 brief) and `migrate-worktree.sh {lane}` (worktree under `E:/Work_Hub/01_Automemory/wt-migrate-{lane}`, because the scratchpad path is too long on Windows).
- Kill-line timing: `org` under bats vs `node:test` on the owner's box, recorded in `tests/org/MIGRATED.md`.

## Exit criteria (Definition of Done)

- [ ] REQ-09: `migrate-guard` FAILs each of the 6 planted mutants, and PASSes the real `org` lane
- [ ] `org` parity proof (count, both green, name map, negative control) in the PR description
- [x] the §11 ratio recorded; < 5x → STOP and re-plan with the owner (3.05x, then the pilot below)
- [x] Function-style pilot (owner, 2026-10-24, `/arc-change`): `team`, `role-seat`, `judge` import the script functions instead of spawning node / copying the arc tree (1-2 CLI smoke spawns per script kept), then re-time `org`. ≥ 5x vs the 678 s bats baseline → function style is the migration method and `tests/MIGRATING.md` says so; < 5x → strangler (new tests node:test only, a lane migrates when touched) and Phase 03/04 re-planned with the owner
- [ ] tracker updated through `/arc-phase-done 02`

## Verification plan

- Coarse: `migrate-guard` self-test on CI + the `org` PR's per-job CI + the local timing table (refined at phase start via `/arc-change`).

## Non-negotiables (verbatim from PLAN)

- Branch-only writes: every change goes on a `feat/ci-*` or `migrate/{lane}` branch through a PR; never a commit to `main`.
- Never edit branch protection: at the cut-over, STOP and print the §5 step-2 list for the owner.
- Every action in every workflow is pinned by full commit SHA, with the tag in a trailing comment.
- Path filtering happens at job level through a `changes` job, never through workflow-level `paths` / `paths-ignore`.
- `migrate-guard` and the per-lane floors are FAIL from birth; ESLint starts WARN (CI-S).
- launch's ci provider and face's expected-set change only through `/arc-change` on their own lanes (CI-P, Phase 01).
- `npm run ci` locally before every push, then read CI per job with `ci-digest.mjs`, head SHA asserted.
- A migrated test asserts the SAME behaviour: no loosened assertion and no skipped, pending or `.only` test; a dropped test is listed with its reason in `MIGRATED.md`.
- Runtime `dependencies` stays `{}`; ESLint is the only devDependency, with a committed lockfile.
- Two-surface adversarial pass via `/arc-attack` (ADR-0226) per PR, carrying `initiatives/ci/fixed-defects.md`; the author is never the attacker.
  **Result:** the time was four slow cases serialised in two files, not the runner; split into their own files, `org` = 117-145 s (~131 s avg) vs 678 s = **~5.2x**, no function-style rewrite needed. Owner ruled 2026-10-24: **pass, Phase D continues**; `tests/MIGRATING.md` now tells workers to give any > 20 s test its own file.
