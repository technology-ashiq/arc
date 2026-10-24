# Phase 01 — Local-first, and everything coupled to the old CI

**Goal (one line):** the owner's box becomes the first gate (`pre-push` runs lint + changed-lane tests, `npm run ci` mirrors the PR gate), the weekly/release/dependabot workflows land, the throwaways leave, and every rule, doc and cross-lane file that still describes the old CI is rewritten or filed to its owning lane.
**Appetite:** 1.25 days — blown appetite = cut scope or kill, never extend silently
**Depends on:** phase-00
**REQs closed here:** REQ-02, REQ-04, REQ-05, REQ-07, REQ-11

**Decisions applied:** ADR-2201 (pre-push, weekly), ADR-2207 (ESLint WARN), ADR-2209 (tag-driven release).

## Scope (in order)

1. **Cross-lane filings first**, so they land in the same window:
   - `initiatives/ci/handoffs/face-expected-set.md`: a paste-ready `/arc-change --lane face` prompt. It adds `workflow:weekly` and `workflow:release`, and drops `workflow:measure-windows-cost`, `workflow:shard-calibrate` and `workflow:weigh-tests`, then runs `face-sections.mjs` + commits `rooms.generated.json`. A face-side PR on its own would add rows for files that do not exist yet, and this PR is red until those rows exist, so neither could go green first (attack B2). The face session therefore approves the change through `/arc-change --lane face`, and the `expected-set.json` + `rooms.generated.json` edit lands **on this branch, in this PR**. Workflow adds and deletes do not start until face's go-ahead is recorded in the handoff file.
   - `initiatives/ci/handoffs/launch-ci-provider.md`: a paste-ready `/arc-change --lane launch` prompt for CI-P (`LEGS = ["ubuntu-latest"]`, Node 24, `pull_request` + `push: main`, concurrency, draft skip, its `verify` list and tests). That is not a ci REQ (ADR-2205).
2. **Workflows:** `weekly.yml` (Sunday cron + `workflow_dispatch` + `workflow_call`: `windows-latest` `node --test "tests/**/*.test.mjs"` (quoted glob) whose reported `# tests N` is asserted > 0 before pass is read, the clean-install proof `npm pack` → install into a temp dir → `node -e` import of the entry, and `ci-tier`), `release.yml` (`push: tags: v*` → `uses: ./.github/workflows/weekly.yml` → `npm pack` → `gh release create` with the tarball and the matching `CHANGELOG.md` section), `.github/dependabot.yml` (npm at `/` and `/face`, `github-actions`, weekly). Same hygiene and SHA pinning as Phase 00. The `release.yml` job sets `permissions: contents: write` (top-level read makes `gh release create` a 403), and `weekly.yml`'s jobs keep `contents: read`.
   **Paperwork skip (REQ-02, ADR-2212).** Measured on 2026-10-24: 86 of 234 commits since 09-01 were docs-only PRs, 57 of them phase close/evidence/kickoff, and each ran the full 19-job matrix. The gates paperwork can break (`kickoff-lint`, `portfolio-board`, `wiki-build --check` + `wiki-coverage`, `face-coverage`) still run as bats suites, so skipping bats would also skip them. So they **also** run as direct script steps in `quality` (the bats copies stay until their lanes migrate). `ci-changes.mjs` then gains `code=false` when EVERY changed path matches `docs/**/*.md`, `initiatives/*/{PLAN,PROGRESS}.md`, `initiatives/*/phases/*.md`, `initiatives/*/evidence/**`, `initiatives/*/handoffs/**` or `PORTFOLIO.md`, and nothing outside that list. Any path that `readers.md` shows a bats test reads by content, other than those five gates, is taken off the list. When `code=false`, `bats` and `node-test` are skipped, and `test` passes only if `changes` is `success`.
   **Dead dev-loop hooks (REQ-11, ADR-2212).** Delete `.claude/hooks/PostToolUse.d/00-format.sh`: it runs `npx --no-install prettier/eslint` on every edit, no `node_modules` exists, and ESLint is a CI gate, not an edit-time auto-fixer. Delete `.claude/hooks/PostToolUse.d/90-emit.sh`: it wrote 974 of 2,752 spine events (35%) as `note.logged {event: tool.postuse}`, and no reader exists (grep for `tool.postuse` in `.claude/scripts`, `engine`, `face`; the build re-runs that grep and STOPs on a hit). Keep `.claude/hooks/PreToolUse-read.d/10-design-composer.sh`, because it is a declared BLOCK (`engine/enforcement.yaml` `hook-read-design-composer`). Add one line before its `exec` instead: `[ -f "${CLAUDE_PROJECT_DIR:-.}/.claude/state/design/composer-session" ] || exit 0`. Read the scope-check first: if it arms on any other state file, test that one too. Delete `.claude/hooks/SessionEnd.d/00-session-log.sh`, `git rm --cached docs/session-log.md` + `.gitignore` it, and drop or rewrite `tests/root-golden.bats`'s "SessionEnd writes byte-stable session-log entry" test with a `tests/DROPPED.md` row. Hooks that still exist get a `products/*/manifest.json` + sync-golden update.
   **Ventures keep stale copies:** `sync-to-project.sh` only copies, and `--prune-report` only reports. Add a `RETIRED` list of exactly these 3 paths (the read hook stays) to the existing sync. A sync removes a listed path from the target only when it is byte-identical to a known arc version (its sha256 is in the list), and prints `retired: {path}`. A venture-edited copy is reported and left alone. Test it with one bats case in the existing sync suite: one planted stale copy gets removed, one edited copy is kept.
3. **Remove through git:** `shard-calibrate.yml`, `weigh-tests.yml`, `measure-windows-cost.yml`, `.github/scripts/shard-tests.mjs`, `tests/shard-timings.json`, `tests/shard-tests.bats`. Its 14 tests are listed with the reason "tests a deleted script" in `tests/DROPPED.md`, which `ci-floor.mjs` subtracts. Move `docs/owner-paste-ci-pin-opengrep.yml` to `docs/archive/`.
4. **Local-first:** `.nvmrc` = `24`. `.claude/scripts/core/test-changed.mjs` reads pre-push stdin (`local_ref local_sha remote_ref remote_sha`) and skips a delete push (`local_sha` all zeros). It runs `git fetch origin main --quiet`, diffs `git merge-base {local_sha} origin/main`..`{local_sha}`, and maps the paths to lanes by `tests/{lane}-*.bats` prefix and `tests/{lane}/`. A path under `.claude/scripts/core/`, `tests/test_helper.bash` or `tests/_lib/`, or a path no lane matches, runs the `core` lane plus every migrated `node:test` lane, and prints why. If the fetch or the merge-base fails, it runs the same set and prints why; it never maps against a stale ref. **The full bats suite never runs from pre-push** (about 4.3 h on Windows); `--all` exists for an explicit run. A hard 5-min timeout prints the lanes not run and exits 1 (A-04). Extend the existing `.githooks/pre-push` (keep the `branch-guard.sh --pre-push` line first) with `npm run lint` + `npm run test:changed`. Each command's exit status is read directly, with no pipe into `tail`/`tee`. The hook is enabled once per clone with `git config core.hooksPath .githooks` (AGENTS.md); there is no `prepare` script.
5. **`package.json`:** `engines.node >=24`; `scripts.lint` = ESLint (WARN, CI-S) + the arc gate commands; `scripts.test` = `node --test "tests/**/*.test.mjs"` + `node .claude/scripts/core/ci-floor.mjs`; `scripts["test:bats"]`, `scripts["test:changed"]`, `scripts.ci` (= lint + test, the same list as CI); `scripts["ci:status"]` = the old `ci-digest --wait`; `devDependencies: { eslint }` + committed `package-lock.json`. Add `eslint.config.mjs` (flat, `eslint:recommended` + `no-undef`/`no-unused-vars`), fix real errors, and give every rule turned off a one-line reason. `quality` gains the `npm run lint` step, which reports and never blocks while in TRIAL, and `security` gains root `npm audit --audit-level=high`.
6. **Rules + docs:** `.claude/rules/testing.md` "Where tests run" → the local-first rule (keep per-job reading and the run-exists-for-SHA check); `AGENTS.md:12` stack line and lines 68–76; `ci-digest.mjs` header example → `npm run ci:status`; every "Phase 01" row of `evidence/phase-00/readers.md`. Then the `products/core/manifest.json` lines for every new synced file (`.nvmrc`, `eslint.config.mjs`, `test-changed.mjs`, `tests/core/test-changed.test.mjs`, `tests/DROPPED.md`), then `wiki-build` → `--check`, then the sync golden LAST. The golden is regenerated with untracked files filtered out, and its delta is diffed before re-recording: the row count moves by exactly the number of synced files added or removed.
7. `/arc-attack` on the local commit, push once, background `ci-digest`, merge on per-job green. Then `gh workflow run weekly.yml --ref main` (a workflow absent from `main` cannot be dispatched) for REQ-07, and the phase closes on that run.

## Exit criteria (Definition of Done)

- [ ] REQ-02: a draft PR starts 0 jobs; a docs-only PR shows `test`/`node-test`/`bats` skipped and the merge button enabled (A-03)
- [ ] REQ-04: the command list in `scripts.ci` equals the `run:` lines of `quality` + `test` (a diff in `evidence/phase-01/` shows 0 missing)
- [ ] REQ-05: two negative controls. A planted failing test in a changed lane makes `git push` exit non-zero from `pre-push`. The same plant in a worktree whose local `origin/main` is 20 commits behind also exits non-zero.
- [ ] REQ-07: AFTER the merge, a `gh workflow run weekly.yml --ref main` run has its `windows-latest` step log printing `# tests N` with N ≥ 1, and the suite, the clean-install proof and `ci-tier` are all `success`
- [ ] face's expected-set edit landed in this PR with face's recorded go-ahead; launch's handoff filed (its merge is launch's)
- [ ] REQ-11: spine `note.logged` count before/after a 10-edit session moves by 0 `tool.postuse`; no `npx` process in the edit hook chain; `git status --short` empty after SessionEnd; a fresh sync target lacks the 3 retired files; the read hook exits before spawning when unarmed (the existing composer bats suites stay green)
- [ ] REQ-02 paperwork run: the phase-close PR of THIS phase is itself the docs-only proof (`changes` + `quality` + `security` only)
- [ ] tracker updated through `/arc-phase-done 01`

## Verification plan

- **Test command:** `npm run ci` on the owner's box, then the PR's CI via `ci-digest.mjs` (head SHA asserted); `gh workflow run weekly.yml` + `ci-digest` on that run.
- **Expected failure first:** `tests/core/test-changed.test.mjs` is committed first, asserting that `test-changed.mjs --dry-run` maps `.claude/scripts/spine/x.mjs` to lane `spine` and `.claude/scripts/core/y.mjs` to `core` plus the migrated lanes, and that a delete push (all-zero `local_sha`) maps to nothing. Before the script exists it fails with `Cannot find module '.claude/scripts/core/test-changed.mjs'`. The REQ-05 control: add `assert.equal(1, 2)` to a scratch test in a changed lane on a scratch branch, and `git push` prints the failing test name and exits 1.
- **Live demo scenario:** change one `.mjs` under `.claude/scripts/spine/`, `git push`; pre-push prints `lanes: spine`, runs only those tests, and the push proceeds. Push a docs-only change; pre-push runs lint only.
- **Real-system check:** the docs-only PR's Checks tab shows `test` as skipped and the PR as mergeable under the new protection.
- **Expected evidence:** `initiatives/ci/evidence/phase-01/` holds the pre-push transcripts, the script-vs-workflow diff, the draft and docs-only PR numbers, and the weekly run id.

## Rabbit holes in this phase

- ESLint flood: fix real ones; never `eslint-disable` a file to get green.
- `test:changed` lane inference for a file no lane prefix matches: run the `core` lane and print why.

## Out of scope for this phase

- `node:test` migration of any lane (Phase 02+); editing launch's provider or face's contract directly.

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
