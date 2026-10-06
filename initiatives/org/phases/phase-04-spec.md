# Phase 04 — The face contract gates refuse a duplicate JSON key

**Goal (one line):** `face-sections --check` and `face-coverage` fail by name on a face contract file holding a duplicate key (ADR-1630).
**Appetite:** 0.25 days
**Depends on:** none
**REQs closed here:** REQ-06

## Scope
- `.claude/scripts/core/face-sections.mjs`: `loadContract` and the `room-copy.json` read call
  `assertNoDuplicateKeys(text, FILE)` from `core/json-strict.mjs` before `JSON.parse`.
- `.claude/scripts/core/face-coverage.mjs`: `loadContract` and `treeModules`' `readJson` do the same.
- Sync golden and wiki regenerated in the same commit. Added through /arc-change, 2026-10-06.

## Exit criteria (Definition of Done)
- [x] each gate FAILs on every face contract file it reads with one duplicate key, naming the file (face-coverage never reads room-copy.json; face-sections catches a registry duplicate as drift)
- [x] both gates pass on main's real contracts
- [x] tests added & green on CI (`tests/org/dup-keys.mjs` from a bats file)
- [x] live demo run + output checked
- [x] contract tests: n/a — no external dependency
- [x] `/arc-attack` boundary surface once on the local commit before push
- [x] tracker updated (PROGRESS.md row ✅ + done-log)

## Verification plan
- **Test command:** `node tests/org/dup-keys.mjs` (a scratch copy of the contracts with one key duplicated per file).
- **Expected failure first:** before the gate edits, each mutant passes both gates (the fixture prints `FAIL ... passed with a duplicate key`).
- **Live demo scenario:** `node .claude/scripts/core/face-sections.mjs --check` and `node .claude/scripts/core/face-coverage.mjs` on main: both pass.
- **Real-system check:** the 2026-10-05 shape -- `PLAN-launch` twice in `expected-set.json` -- fails both gates.
- **Expected evidence:** CI per-JOB conclusions; fixture RAN line; the two gates' output on main.

## Rabbit holes in this phase
- Do not widen to a repo-wide JSON lint (ADR-1630 option 1).

## Out of scope for this phase
Other JSON files; the generated files' writers.

## Your-setup / pending
None.

## Non-negotiables (verbatim from PLAN)

- Nothing in this cycle writes to the owner's checkout or to `main`: every card or skill change is a proposal
  branch plus `approval.requested`.
- A refusal writes no event and no file, and names every failed condition.
- The role resolver is deterministic: the same cards and spine give the same agent.
- The model seat (`seat`, `seat_source`) keeps its meaning; the agent seat is new, separate fields.
- Tests run on CI, never on this box; a test asserts it RAN before asserting what it printed.
