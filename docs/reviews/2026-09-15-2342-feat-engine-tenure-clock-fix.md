# Code review — `feat/engine-tenure-clock-fix` (PR #225)

- **Date:** 2026-09-15 23:42 IST
- **Branch:** `feat/engine-tenure-clock-fix` → `main`
- **Reviewed commit:** `a22dc3a7` (8 files, +529 / −48)
- **Reviewer:** `code-reviewer` subagent (scanners + 4-pass method)
- **Diff-recall (REQ-08):** exit 3, no memory index in the worktree. A WARN, never a block (ADR-0704).
- **CI on the reviewed commit:** arc-ci run 35004151393, **19/19 success, read per job**. Zero `not ok` lines in the whole log. The steel-probe count test, all three REQ-06 tests and the registered-count guards each ran on 5 legs and passed.

## Verdict: **ship**

The fix matches arc-run's own sentences exactly, throws on every answer it does not recognise, and after it no test's verdict depends on today's date. There is nothing Critical. The one Warning is dormant and not a regression.

## Scanners

- **opengrep** (`--config auto`; semgrep is not installed), on the 5 changed code files: 7 hits.
  - 3 are in new code: `arc-bench.mjs:809/815/820`, `detect-non-literal-regexp`. All false positives. Every interpolated value goes through `reLiteral`, and each is a process-file name, an arc-run-validated model id, or a driver name. The patterns are anchored to the start of a line with no nested quantifiers, so there is no ReDoS risk.
  - 4 are pre-existing and outside the diff: `arc-bench.mjs:42/49/100` and `bench-steel-probe.mjs:771`.
- **gitleaks** (`detect`, `main..HEAD`): 2 commits scanned, no leaks.
- **osv-scanner:** not run. No dependency manifest or lockfile is in the diff.
- **knip / npm run lint:** skipped. There is no root `package.json`. The 5 new helpers are private and all used.
- **Tests:** not run locally, per the repo rule. Count checked by hand: 13 checks in section 7 on `main`, plus 13 in section 7 (i) (4 on the real arc-run, 6 on the scripted one, 3 on the dispatch path). That gives 26 for section 7 and 70 + 13 = 83 in total.
- **Blast radius** (found with grep; codegraph indexes `main`, not this branch):
  - `driverTakesModel` is called by `runBench` and the steel probe.
  - `routeLapsedOn` is called by `runBench` only.
  - `closeClass` is called by `runBench` and `replayBench`.
  - Two places read the reason prefix. `closeClass` was updated. `evaluateGates` already treats every reason except "declares no repo_state" as refused.

## Checked in context, no finding

- The three anchored regexes match arc-run's exact output: `arc-run.mjs:732` on stderr, `:1516` on stdout with the U+2014 dash, and `:1543`.
- The capability check (`:731`) runs before the dry-run tenure check (`:1515`), so `mock` gets "not capable" whether or not a route has expired.
- The fallback vehicle is calendar-safe. Only `build-in-public-draft` carries a `review_by`, and it declares 1 eval, so it is never benched. The next vehicle, `commit-msg-draft`, has no tenure.
- The synthetic router rows pass `routerFaults`.
- `capped_root` still reaches exit 5, because the boundary check (`:1639`) runs before `processIsSelfConsistent` (`:1649`).
- No remaining test dispatches the live expired row.
- The golden manifest hashes match the committed blobs.

## Critical

None.

## Warning

1. **`arc-bench.mjs:2329-2334` and `:2466-2472`: the drift guard is a twin that was not taught about tenure.**
   - **What happens:** `driftAlerts` would read a tenure-skipped class (at least 5 fixtures declared, both rates null, the champion has rates) as "a total collapse, not an absence of evidence". `buildGuardReport` would then emit an inbox `approval.requested` saying so, which is a false statement on the append-only ledger.
   - **Also:** the `run.completed` payload carries `proposal` but no unselected reason.
   - **Not a regression:** before this PR, the refused attempts produced the same alert. It is also dormant: the only class with tenure declares 1 eval, and the guard mutes it at `:2317`.
   - **Fix:** return a distinct "not benched: route expired" finding when `selected === 0` and every unselected reason starts with `failure: tenure`. Carry the refusal reason for each class on the receipt.

## Nits

1. `arc-bench.mjs:692`: the docstring says "Costs one process per RUN". That is no longer true: the probe can spawn one process per runnable vehicle, plus one `routeLapsedOn` per eligible class.
2. `arc-bench.mjs:1595-1597`: fixtures that declare no `repo_state` get relabelled `failure: tenure`. That loses "cannot be posed" and inflates the "never ran" count in `evaluateGates`. Keep the `!fx.id` branch first inside the tenure loop.
3. `arc-bench.mjs:1592`: tenure is checked once per class. A run that crosses local midnight into the day after `review_by` falls back to the old behaviour for that class. Either say so in the comment or re-check per group.
4. `tests/bench-steel-probe.mjs:646`: check (i.5) would also pass if the scripted arc-run crashed for a case, because a crash also gives "no usable answer". Checks (i.1)–(i.4) prove the script runs. Still, assert that each thrown "arc-run said:" block quotes part of that case's scripted output.
5. `arc-bench.mjs:1809-1811`: a tenure-partial run can never pass replay. Budget refusals already have the same gap.
6. `tests/engine-data-boundary.bats:187`: the heredoc is unquoted (`<<YAML`). That matches the existing `terminated_root` style, but `<<'YAML'` would guard against a future `$` or backtick.
7. `tests/shard-timings.json`: `bench-harness.bats` (weighted at 58s) gains about 25 node spawns and 3 copies of `.claude/scripts`. Re-weigh it when convenient.

## Dispositions

- **Shipped as reviewed.** No code changed after `a22dc3a7`. This archive and the tracker note are the only additions, so the reviewed code is the code that merges.
- The Warning and all seven Nits are recorded as tracked follow-ups in `initiatives/engine/PROGRESS.md` § Now (2026-09-15), under "Known and open". Each is a separate `/arc-change`, not a silent drop.
