# Phase 01 — Scorecards, teams, and the browser proof

**Goal (one line):** the org room shows every staffed seat's verdict with its receipts and the venture teams, and opens with 0 errors in both moods.
**Appetite:** 1.25 days
**Depends on:** phase-00
**REQs closed here:** REQ-03, REQ-04, REQ-05

## Scope
- `fold.mjs`: `scorecards` section over the served `staffed: true` rows (seat, verdict, why, due line, receipts line or `no evidence`), an "other seats with receipts" list with no verdict, and a `teams` section (team rows or the empty sentence naming ADR-1612).
- `View.tsx`: render both; no decision in the View.
- Fixtures in `tests/face/org-fold.mjs` for `no evidence`, verdict closure, empty teams, a fixture team.

## Exit criteria (Definition of Done)
- [x] scorecards and teams render end-to-end
- [x] tests added & green on CI
- [x] live demo run + output checked, screenshot of the room opened and looked at
- [x] verified against the real system: main clone spine
- [x] contract tests: n/a
- [x] `/arc-attack` two surfaces (route/decision logic; door/shell boundary) once on the local commit before push, with the lane fixed-defect list
- [x] tracker updated (PROGRESS.md row ✅ + done-log)

## Verification plan
- **Test command:** `node tests/face/org-fold.mjs` + `tests/face-browser.bats` on CI
- **Expected failure first:** `org-fold.mjs` fails `scorecards section missing` until the fold adds it.
- **Live demo scenario:** open Org → a seat with no receipts shows `no evidence`; teams show the ADR-1612 sentence.
- **Real-system check:** compare three seats against `org-review --role <id> --spine-dir <main spine>`.
- **Expected evidence:** CI per-JOB, screenshot path, the three-seat comparison.

## Rabbit holes in this phase
The known front-door flake in face-browser test 5 (`space-key-unmount`, one mood): re-run once; a failure naming `org` is ours.

## Out of scope for this phase
Work-door verbs; dispatcher proposals.

## Your-setup / pending
None.

## Non-negotiables (verbatim from PLAN)

- Every number the room shows comes from an org producer through `/api/org`; the face counts nothing itself.
- A seat with no placed receipt reads `no evidence`, never 0 or a percentage.
- The route is GET-only, takes no query, writes nothing, and refuses whole on a wrong shape.
- The lane roster and ADR band map in the org room keep working unchanged.
- Tests run on CI, never on this box; a test asserts it RAN before asserting what it printed.
