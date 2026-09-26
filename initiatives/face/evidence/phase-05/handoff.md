# Phase 05 — handoff (2026-09-23)

## Predictions

No Build Brief predictions were written before the build (there is no `phase-05-tasks.md`): the phase opened straight
into PR 1 from the owner's "OK machi, start pannu". **Nothing is scored**, and none is written now against a known
outcome. For the retro: the same skip as Phase 04.

What a prediction would have had to face: the riskiest file was `.claude/scripts/hq/lib/face/work-door.mjs` and the
owning-lane CLIs it drives; the likeliest failure was the twin -- a fix made in one place and left open one file over --
and it recurred to the last round (PR 5c round 2: the "latest approval" fix made in the plan and not in the helper the
send reads).

## Verification plan, as run

- **RED first, per PR:** the no-second-path and `main`-untouchable fixtures failed against a door with no registry in
  PR 1; each owning-lane change's behaviour-pinning fixture was written before its change (ADR-1339).
- **GREEN, per job:** every PR head 19/19 before merge; the final tree (`2fba48f7`, #263) 19/19 on run 35870851639
  (attempt 2: one Node 18 leg's Chrome handshake timed out and passed on the re-run -- the Chrome-flake debt row).
  Full suite on ubuntu Node 20: `1..3427`, 3427 ok, 0 not ok.
- **Live demo:** `live-demo.md` -- the door live from the main clone, 31 ops served, five plans read back, one real
  apply receipted and read off the spine, the pulse moving.
- **Coverage:** `face-coverage --selftest` 117 arms, PASS (the DoD asks for more than 93).

## For Phase 06

- The session door starts from the 15 SESSION verbs in `cli-probe.md`; the work door's registry, plan/apply routes and
  receipts are its base.
- Open debt that touches it: the leads approval binds only the body (filed to leads); propose's staging render can be
  stranded by a kill; the Chrome handshake flake on the browser suite.
