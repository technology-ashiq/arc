# Phase 05 evidence — what this bundle does NOT contain, and why

Phase 04 set the pattern and it is kept: a bundle that quietly shortens its own expected-files list
has stopped being evidence. Everything the Verification plan names and this bundle cannot produce is
named here, with the reason, as a finding rather than an omission.

## 1. The two adversarial reports do not carry agent session ids

**Verification plan:** *"the two adversarial reports (each recording the agent's session id and an
explicit statement that it read no implementation file)"*.

**What exists:** `adversarial-passes.md`, reconstructed from `PROGRESS.md` § Now and the commits the
passes produced. The findings, the mechanisms, the fixes and the fixtures are all recorded and are
independently checkable against the suite.

**What is missing:** the session ids, and the agents' own written statements about what they had and
had not read.

**Why:** the passes ran on 2026-08-13 and 2026-08-16 in sessions that recorded their *findings* into
the tracker but not their *identity*. The requirement was written into the phase spec at kickoff and
was not carried into the prompts the passes actually ran under.

**What that costs:** the anti-anchoring claim — that the attacker had not seen the implementation —
is asserted by this bundle rather than evidenced by it. That is a real weakening. This lane's own
`gate-author-cannot-be-its-attacker` finding (the author's own 26 breaking inputs found 0 holes; an
unanchored agent found 9) is the reason the clause exists.

**Fixed forward, not backfilled:** a session id cannot be invented after the fact and none is. The
2026-08-17 pass on the egress and workspace code records its agent identity at dispatch time, and
that is the shape every later pass in this cycle uses.

## 2. Pre-merge CI run ids for PR #184 and PR #172

Recorded in `PROGRESS.md` § Done log with their conclusions; the run ids themselves fall outside the
API window this bundle was assembled from. `ci-per-job.md` cites the closing run at `50a0148`
instead, which carries all of this phase's code and is read per job.

## 3. No live-demo recording

**Verification plan:** *"run `arc-run --process commit-msg-draft --driver hermes --budget min=2`
against the fixture process and watch it produce JSON, a sidecar and exit 0; then run it with a
budget small enough to trip the wall-clock and watch it exit 2 with `reason: budget`."*

Both behaviours are pinned by tests — `hermes: a runtime that writes an answer and never exits is
BUDGET, exit 2, never driver` and `hermes: a deadline already spent declines BEFORE starting the
runtime` — and the real-container arm was exercised on 2026-08-16, producing exit 1 with a schema
failure, one same-tier retry and a proposal receipt in 599 seconds
(`../phase-06/runtime-answer-reliability.md`).

**What is missing** is a transcript of the demo as a demo. The behaviours are evidenced; the
ceremony is not. Recorded rather than claimed.

## 4. The unreachable-target probe proves the shim's code runs — the real arm is Phase 06's

The DoD asks that *"a separate probe proves the real path executes — an unreachable target reaches
the shim's own code and produces the correct failure exit"*. `tests/engine-hermes-probe.mjs` carries
the Node half of the contract suite and every subcommand prints a terminal marker so the caller
asserts the probe RAN. What Phase 05 does **not** carry is the certification arm against the real
runtime — that is Phase 06's REQ-02 by design, and it is named here so the boundary between the two
phases is not read as a gap in this one.
