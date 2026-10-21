# Phase 04 — handoff (2026-09-18)

## Predictions

The Build Brief's prediction fields (`phase-04-tasks.md`) were never filled before the build started: all five read
"(empty until proven)". **Nothing is scored.** Writing predictions now, after the outcome is known, would score a
guess against its own answer, so none are written. For the retro: the phase opened straight into the build from the
owner's "start 04" directive, and the Build Brief step that writes predictions was skipped.

What a prediction would have had to face, for the record: the riskiest file was `.claude/scripts/hq/lib/face/reads.mjs`
(four attacker rounds, every one finding holes there); the likely failure mode was the twin -- a rule fixed on one
route and left open on the next -- which is what rounds 2, 3 and 4 each found.

## Verification plan, as run

The spec's plan was the coarse one-liner ("per route, a dash-doors arm RED before the route exists, then green per
job; the NOT SERVED count from the browser suite before and after"). It was refined at the close, not at the start
(an amendment, counted):

- **RED:** Phase 03's five `not-served-*.md` lists name every Phase 04 route as one the door did not serve; on
  `e4aa8bf4` each answered `UNKNOWN_ROUTE`. dash-doors' "P04 route list" arm holds every built route inside that union.
- **GREEN, per job:** dash-doors' P04 arms (posture, parsers, route table, per-route payloads over the fixture) and
  `tests/face/phase04-folds.mjs` (141 checks) on CI -- 19/19 on the PR head `d62ea4b6` and on `main` by dispatch.
- **NOT SERVED before and after:** 50 panels on the Phase 03 lists; 15 after (`residue.md`), 39 served tables on 35
  panels (`served.md`), both held equal to the folds by module-frame and counted in the rendered page by the browser
  suite on every leg.
- **Real place:** the door in live mode from the main clone, 19 of 19 routes 200 (`live-demo.md`).

## Evidence in this folder

`served.md`, `residue.md` (the derived lists) · `live-demo.md` · `spec-fidelity.md` · `attackers.md` ·
`ci-jobs.json` (the per-job conclusions of the `main` dispatch on the merge).
