# Phase 06 — handoff (2026-09-26)

## Predictions

`phase-06-tasks.md` has a Predictions block, but `likely-failure-mode` and `likely-regression-site` were left
`(empty until proven)` and never filled before the build. **Nothing is scored**, and none is written now against a
known outcome. For the retro, this is the third phase running (after 04 and 05) where the prediction step was skipped.

Had one been written, it would have had to face these:
- **The riskiest file** was `.claude/scripts/hq/lib/face/session-door.mjs`, where a child process spawns, streams,
  and has its lifetime managed on Windows.
- **The likeliest failure** was a live run that behaves differently from its fixture. The live convene needed four
  attempts (`live-demo.md`), and each attempt found a defect the fixtures did not: backgrounded agents, the verdict
  heading, a reply that was not JSON alone.

## What Phase 07 needs from the owner

- **Two real days on the face** (REQ-10). `face-dogfood` must read MET on each: every `decision.recorded` matched to
  the face journal, and at least one op receipt from the face that day.
- **The stamp on this phase's `approval.requested{gate: phase-done}`.** It also approves `residue.md` as a whole,
  including the 4 start-only rows, and accepts or refuses the two debt rows opened at this close (the logic attacker
  never ran; the four read-backs).
- **Optional:** a paid `ARC_ATTACK_TRIAL_MODEL`, so the logic surface can pay its debt row before the dogfood days.

## Open at handoff

- #267 (the Windows proposal-branch race fix): CI green, not merged, and not face's to merge on its own.
- The residue rows are filed to engine (ship, qa, hire), develop (close phase), absorb (adopt) and growth (draft).
  Each is a row in `residue.md`. None has been opened in its lane yet.
