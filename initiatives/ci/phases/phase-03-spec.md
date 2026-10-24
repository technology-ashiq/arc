# Phase 03 — The D.6 pilot: two lanes, two owner-named models, one scorecard

**Goal (one line):** `spine` (14 files, 116 tests) on model X and `jobs` (6 files, 148 tests) on model Y migrate in parallel through the worker kit, each PR is reviewed by Opus with one negative control, and the owner picks the fan-out model from a recorded scorecard.
**Appetite:** 0.5 day — blown appetite = cut scope or kill, never extend silently
**Depends on:** phase-02
**REQs closed here:** REQ-10

## Scope

- The owner names X and Y and has the OmniRoute / OpenRouter key and endpoint ready (D.2). The session never picks a model (ADR-0069 b1, ADR-2211).
- `migrate-worktree.sh spine` and `migrate-worktree.sh jobs`; the owner launches each worker with the printed line.
- Per PR: `migrate-guard` table, Opus review, one negative control, approve or send back.
- Scorecard per model in each `MIGRATED.md` header: first-push PASS (y/n) · review findings by severity · negative control caught (y/n) · wall time · cost from OmniRoute logs.
- §11 second kill arm: both models fail first push AND both have a weakened assertion → STOP, the owner re-approves an Opus-only cost.

## Exit criteria (Definition of Done)

- [ ] REQ-10: both scorecards recorded; the owner's pick recorded as a `decision.recorded` before any fan-out PR opens
- [ ] both pilot PRs merged under §6
- [ ] tracker updated through `/arc-phase-done 03`

## Verification plan

- Coarse: the two pilot PRs' `migrate-guard` tables + per-job CI + the scorecards (refined at phase start via `/arc-change`).

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
