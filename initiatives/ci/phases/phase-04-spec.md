# Phase 04 — Fan-out, retire bats, close the cycle

**Goal (one line):** every remaining lane migrates in batches of ≤ 5 workers (groups 1–4, largest-first, heavy files and the 5 merge-time-pinned files to Opus), bats and `test_helper.bash` are deleted, the floor is derived, and the cycle closes with the `.github` deny restored.
**Appetite:** 1.5 days — blown appetite = cut scope or kill, never extend silently
**Depends on:** phase-03
**REQs closed here:** REQ-06, REQ-08

## Scope

- Fan-out in the source's D.6 order (HQ core → build machinery → security scanners → business), one lane = one worktree = one `migrate/{lane}` PR; the D.5 heavy files (`launch-contract`, `design-composer-eyes`, `leads-mail-guard`, `ledger-close`, `face-l3`, `design-composer-bash`, `face-browser`) and the lanes of the 5 `engine/enforcement.yaml`-pinned files go to Opus, who repoints the rows in the same PR.
- At group 4 the owner rules on leads/ledger (migrate, or freeze the code and archive the tests).
- Retire: delete `tests/test_helper.bash`, `tests/bats.count`, the `bats` shards and the `test:bats` script; the floor = sum of `tests/{lane}/.count`; record the full local suite time on the owner's box.
- Close: owner restores the `settings.json` deny; `wiki-build --check`, `face-coverage`, sync golden; `/arc-retro --lane ci`.

## Exit criteria (Definition of Done)

- [ ] REQ-06: 0 `.bats` files; every lane PR carried its §6 proof
- [ ] REQ-08: deny restored, ADRs merged, wiki + face-coverage green, sync golden regenerated, on the close commit's CI
- [ ] REQ-01's ≤ 6 jobs after retirement, from a PR run's job list
- [ ] tracker updated through `/arc-phase-done 04`

## Verification plan

- Coarse: per-lane `migrate-guard` tables + the close commit's per-job CI (refined at phase start via `/arc-change`).

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
