# Phase 06 — spec fidelity (2026-09-26)

A fresh `spec-fidelity` agent read ONLY `phases/phase-06-spec.md` and `git diff 5c957e44 465f5b82` (PRs #269 to #285),
plus `evidence/phase-06/residue.md`, and answered per exit criterion. **Verdict: `FIDELITY: drift found`.** Every item
is dispositioned below for the owner's stamp.

## Exit criteria, as the agent read them

| criterion | agent | disposition |
|---|---|---|
| Session door start / stream / attach; driver-only | MET | -- |
| Click-started only | MET | -- |
| Council convene lands `council.verdict`; absorb read and hire certification | MET | absorb and hire are NOT SHIPPABLE rows in `residue.md` (ADR-1334 allows it) |
| Every SESSION verb (ADR-1339) | PARTLY | FIXED IN THE CLOSE, then DECLARED: `residue.md` now splits the 15 three ways, 5 shipped with the receipt shown, 4 start-only, 6 residue (drift a). A fixture holds the file to the registry both ways and to the tree. The owner's stamp approves the list |
| Engine room: driver, model, health; no key | MET | -- |
| Two attackers; CI green per job; close from the main clone | PARTLY | DECLARED: the logic surface never ran (free trial model 429), debt-ledger row 2026-09-26. CI per job: `ci-jobs.json` in this bundle. The close runs from the main clone after this PR merges |

## Drift items

- **(a) Four verbs counted as shipped on a declared kind, with no read-back.** `review-ship.review`,
  `executor.dispatch`, `strategy.adopt-plan` and `org.lane-birth` start from a click, and the fixtures prove the start.
  None has had its own receipt read back. **Disposition:** moved out of "ships" into a start-only table in
  `residue.md`. A new check requires each one's process body to emit the row's kind (`review-diff` emits
  `review.completed`, `kickoff-plan` emits `kickoff.done`), and it has a mutant control. The read-back itself is a
  debt-ledger row: a mock-driver fixture per row, before Phase 07's dogfood days.
- **(b) The verification plan wanted one PR per verb, grouped by lane.** Review, dispatch, adopt-plan and lane-birth
  landed together in slice 01 (#269). **Disposition:** DECLARED, and minor. They needed no new process file, so each
  was a registry row, not a lane change.
- **(c) `ship`'s confirm stop is enforced by refusing to start at all** (`CONFIRM_STEP_UNENFORCED`), not by a session
  that pauses before the deploy. **Disposition:** agreed. It is a residue row, filed to engine, and not counted as
  passed.

## Scope creep

- `CLAUDE.md`'s CI rule was rewritten inside #285 (the background `ci-digest` watch). **Disposition:** DECLARED. The
  owner asked for it in that PR (2026-09-26). It is a company rule and changes no face behaviour.
- The engine and docs PRs in the range (#265, #268, #275, #277, #280, #281, #283) belong to other lanes.
  `develop.mjs` and `proposal-branch.mjs` (#282) and `redact.mjs` plus the claude-code driver streaming (#274) serve
  the phase's own verbs. The agent judged these justified.

## Non-negotiables

None broken. The spine gained zero new kinds, `validate.mjs` is untouched, the session door only starts
`arc-run --driver`, writes stay on a branch, and no key reaches the browser.

## What the owner sees

Rooms have a session dock with a Start button. A click starts a governed `arc-run` session that streams its steps live
and can be reattached after a restart. Nine verbs start. Five of them have landed a receipt the door read back,
including a real council convene. Six refuse and say what is missing. The Engine room shows driver, model and health.
