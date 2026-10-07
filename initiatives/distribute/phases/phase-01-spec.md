# Phase 01 — Gates to merge-time, and the brain

**Goal (one line):** every blocking rule arc relies on has a declared row in `engine/enforcement.yaml` and a merge-time
twin (or an explicit `advisory` declaration for its local damage class), `gate-parity.mjs` fails from birth on any gap,
`.githooks/` runs the same commands as the second line, `main` is protected with the ADR-2015 settings and `doctor
--repo` reads them back, and `AGENTS.md` is the tracked brain that `CLAUDE.md` imports.
**Appetite:** 2.5 days — blown appetite = cut scope or kill, never extend silently
**Depends on:** phase-00
**REQs closed here:** REQ-01, REQ-06, REQ-09
**Kill checkpoint (day 4.5, this phase's exit):** does a planted hook-only blocking rule get refused on the merge path
of the real repository with no harness running? If NO → STOP the cycle and record the finding (PLAN Appetite).

## Scope (in order)

1. **Read every blocking fragment before writing its row.** For each of the 9 fragments
   (`.claude/hooks/PreToolUse.d/{00-destructive,10-design-composer,40-policy,50-deploy}.sh`,
   `PreToolUse-edit.d/{00-freeze,10-design-critic,11-design-composer,40-policy}.sh` and
   `PreToolUse-read.d/10-design-composer.sh`), record what it actually refuses and the script it calls. Do the same for
   each of the 7 `arc.gates.yaml` rules. The design source's table guessed some rows: it named
   "edit a generated file" and "commit a secret" as `PreToolUse` blocks, and no fragment greps for either. Where the
   guess is false, the row is corrected rather than invented.
2. **`engine/enforcement.yaml`** (ADR-2002). It is block YAML with one row per rule, keyed `id` and carrying
   `source: hook:<Event>/<fragment> | gate:<rule> | action:<name>`, `class: blocking | advisory`, `tool_time:`,
   `commit_time:` (an exact command, or `n/a: <reason>`), `merge_time:` (an exact CI bats test name or required-check
   name, or `n/a: <reason>`) and `advisory_reason:`, which is required when `class: advisory`.
   - The design source's action rows are kept: generated-file edit, secret, commit to main, failing tests, merge,
     deploy, destructive shell, and rendered-directory hand-edit.
   - The local-damage classes are declared `advisory` for non-Claude harnesses: destructive shell, freeze, the design
     fences and policy L-levels.
3. **`.claude/scripts/core/gate-parity.mjs`** (REQ-01, FAIL-FROM-BIRTH).
   - It reads `engine/enforcement.yaml`, lists `.claude/hooks/*.d/` for the 3 blocking events (through the event list
     `_dispatch.sh` declares as blocking, never through a second hard-coded list), and parses `arc.gates.yaml`.
   - The fragment and rule sets are derived from disk (`.claude/hooks/*.d/*.sh` for the events `_dispatch.sh` treats as blocking, and `arc.gates.yaml`), never from the yaml it checks; it prints `N fragments, M rules`.
   - It exits 1 when any of these holds, naming each case: a fragment or rule has no row; a row names a fragment file that does not exist; a `blocking` row has
     `merge_time: n/a`; an `advisory` row has no reason; a `commit_time` command is not invoked verbatim by
     `.githooks/pre-commit` or `pre-push`; or a `merge_time` bats name does not exist under `tests/`; or that bats test body contains `skip` that a missing tool can reach while `CI=true` (a scanner-dependent row must declare `requires: [tool, …]` and its test must FAIL, not skip, on a CI runner without the tool).
   - It prints `COULD NOT SCAN` and exits 2 when it finds 0 fragments, or when the yaml or the gates file is unreadable.
   - `--mutant-selftest` copies the tree to a temp dir, plants `PreToolUse.d/99-mutant.sh`, and asserts that the
     copy's run exits 1 and names `99-mutant`.
   - It applies `fixed-defects.md` (a)–(i).
4. **`.githooks/pre-commit` and `.githooks/pre-push`** (ADR-2013). These are POSIX `sh`, and each line is a command
   copied from a `commit_time:` cell, with no logic of their own. Fast lints only: `.claude/rules/testing.md` keeps
   tests off the box. **`arc init` and `sync-to-project.sh` do not set `core.hooksPath` yet** (P03/P04 adapters do).
   For arc itself, the main clone runs `git config core.hooksPath .githooks` once, with the result recorded.
5. **`.claude/scripts/engine/arc-doctor.mjs --repo`** (REQ-09 witness). It reads `gh api
   repos/<owner>/<repo>/branches/main/protection`, takes the owner/repo from `git remote get-url origin`, and prints the
   5 ADR-2015 settings one per line as `ok`, `MISSING` or `UNKNOWN (unreadable: <reason>)`. `--protection-json <file>`
   is the fake. An unreadable state is never printed as `ok`. It also diffs the required contexts against the newest `pull_request` run's check-run names and prints `STALE-CONTEXT: {name}` (exit 1) for any required context with no check-run there. P03 extends this file with install doctor.
6. **The brain** (DST-G, REQ-06). Write `AGENTS.md` with the harness-neutral rules from `CLAUDE.md`. Reduce `CLAUDE.md`
   to `@AGENTS.md` plus `<!-- claude-only -->` blocks. Remove every `TODO` from both, by deleting the template `Project /
   Tools / Monetization / Environment` placeholders or replacing them with real arc facts. Add
   `.claude/scripts/core/brain-drift.mjs` with a mutant arm. Run `git log origin/main --oneline -5 -- CLAUDE.md` first,
   because every lane edits this file.
7. **CI wiring** (ADR-2016): `tests/distribute-gate-parity.bats`, `tests/distribute-brain-drift.bats` and
   `tests/distribute-doctor-repo.bats`, each asserting RAN first and asserting its own test count. Add the new scripts
   to `products/core/manifest.json` and `products/engine/manifest.json`. Regenerate the sync golden in the same commit if
   any new file sits under `.claude/`.
8. **`/arc-attack`** (two surfaces) → fix → one push → background ci-digest → merge on per-job green.
9. **REQ-09 flip** (ADR-2015). The one-line flip request goes to the owner at P01 OPEN. The flip itself happens after
   this phase's merge, after face PR #361 has merged, and only once a `workflow_dispatch` of `ci.yml` on `main` is green
   per job. The escape hatch is written next to the PUT body before the flip: `gh api -X DELETE
   repos/technology-ashiq/arc/branches/main/protection/enforce_admins`. Not flipped 24 h after the merge → the cycle
   pauses as `BLOCKED owner — protection flip`.
   - The session enumerates the check-run names from the newest `pull_request` run: `gh api
     repos/technology-ashiq/arc/commits/{pr-head-sha}/check-runs --jq '.check_runs[].name'` (never from a `main` dispatch).
   - It writes the exact PUT body to `evidence/phase-01/protection.json`.
   - **It asks the owner once**, as one line: "flip now / you flip". The flip binds every lane's merges.
   - Then it runs `gh api -X PUT …/branches/main/protection --input evidence/phase-01/protection.json`, or the owner does.
10. **The kill checkpoint.** Open a throwaway PR (`feat/distribute-p01-planted`) that adds
    `PreToolUse.d/99-planted.sh` with no row. Once all checks finish, read `gh pr view {n} --json mergeStateStatus,statusCheckRollup`:
    `mergeStateStatus` must be `BLOCKED` AND the rollup must show a FAILED `selftest` check-run whose `gh run view
    --log-failed` output contains `99-planted`, AND no other required context failed. Record the check name, the log
    line and the head SHA in `evidence/phase-01/planted-pr.md`. Run `git push origin HEAD:main` from a clean clone and record the server refusal. Close the PR
    unmerged and delete the branch.

## Exit criteria (Definition of Done)

- [ ] REQ-01: `gate-parity` exits 0 on the merged tree and `--mutant-selftest` exits 0 (mutant caught), both on CI per job
- [ ] REQ-06: `AGENTS.md` tracked, `CLAUDE.md` starts with `@AGENTS.md`, brain-drift green + mutant arm red-as-expected, `grep -c TODO` 0 on both
- [ ] REQ-09: protection GET returns 200 with the 5 settings; `doctor --repo` prints 5 `ok` lines
- [ ] kill checkpoint answered with evidence: planted PR `BLOCKED`, direct push refused; or STOP recorded
- [ ] closed via `/arc-phase-done 01` from the MAIN clone

## Verification plan

- **Test command:** CI bats `tests/distribute-gate-parity.bats` (9 tests; test 9: with gitleaks off `PATH` and `CI=true`, the secret row's merge-time test FAILS rather than skips), `tests/distribute-brain-drift.bats` (5) and
  `tests/distribute-doctor-repo.bats` (4). They run inside `selftest` on 3 legs and are never run on this box.
- **Expected failure first:** the three bats files are committed before the scripts exist, and each fails with
  `gate-parity.mjs: No such file` (or the equivalent), asserted as the RAN failure rather than passed vacuously. Then:
  - `gate-parity` on the real tree, before `enforcement.yaml` rows exist, must exit 1 naming every derived fragment (N printed, N > 0);
  - the mutant arm must name `99-mutant`;
  - `brain-drift` against a `CLAUDE.md` copy with an added unmarked `## Planted rule` must exit 1 naming it;
  - `doctor --repo --protection-json fixtures/404.json` must print 5 `MISSING`, never `ok`.
- **Live demo scenario:** from the main clone, `node .claude/scripts/core/gate-parity.mjs` prints `gate-parity: {N}
  fragments, {M} rules, 0 gaps`, with N and M equal to the census in `evidence/phase-01/fragment-census.md`; `node .claude/scripts/engine/arc-doctor.mjs --repo` prints 5 `ok`; a `git commit` that
  stages a hand-edit to `.claude/commands/arc-commit.md` is refused by `.githooks/pre-commit` with the `arc-compile
  --check` message.
- **Real-system check:** the live protection GET is saved as `evidence/phase-01/protection-after.json`, and the planted
  PR's `mergeStateStatus` and the push refusal text are recorded.
- **Expected evidence:** `initiatives/distribute/evidence/phase-01/` holds the fragment census, `protection.json`,
  `protection-after.json`, the planted-PR record, the CI run ids per job, and both attack reports.

## Rabbit holes in this phase

- Wiring commit-time into every worktree automatically: `doctor` reports it, and P03/P04 set it on install.
- Rewriting `CLAUDE.md`'s content beyond the split: move rules, don't edit them.
- Making the planted PR mergeable "to see it fail": it is closed unmerged.

## Out of scope for this phase

- any harness adapter, renderer or CLI · the `targets:` key (P02)

## Non-negotiables (verbatim from PLAN)

- The Claude source (`.claude/commands/*.md`, `.claude/agents/*.md`, `.claude/skills/`, `.claude/hooks/`, `.mcp.json`) is not moved, renamed or reformatted; adding the `targets:` key is the only source edit, and a lint pins it (ADR-2001).
- No prose fallback: a construct a target cannot express is dropped only where the matrix cell says so, otherwise `[unsupported]` by name (ADR-2001, ADR-2003).
- Merge-time is the truth: nothing is enforced only in a Claude Code hook, and a git hook is never called the gate (ADR-2002, ADR-2013, ADR-2015).
- The gates phase (P01) precedes every adapter; phase order is never changed; undeclared surfaces are resolved before any new one (ADR-2004, ADR-2014).
- `sync-to-project.sh`'s output stays byte-identical to the golden committed in P00 for every root-mode consumer (ADR-2005).
- `AGENTS.md` is the brain and `CLAUDE.md` only imports it plus marked Claude-only blocks (ADR-2007).
- Subagents degrade to role skills, never to a nested harness call; only the four v1 targets install (ADR-2009, ADR-2010).
- Code lives in `engine` beside `arc-compile` and gates in `core`; no second compiler, no second walker (ADR-2012); new gates run as bats inside existing CI jobs (ADR-2016).
- Two-surface adversarial pass via `/arc-attack` (ADR-0226) per PR, logic and boundary, carrying `initiatives/distribute/fixed-defects.md`; the author is never the attacker; max 2 rounds (ADR-2011).
- Zero npm deps; no `npm publish`; no public README rewrite; no bash port (ADR-2008); no model, driver, router, profile or tier change (ADR-2006).
- Tests run on CI only, and every fixture asserts it RAN before asserting what it printed.
