# Phase 02 — Earned judgment: predictions scored, fidelity checked by someone with no stake

**Goal (one line):** `handoff` stops being a summary and starts being a reckoning — the phase's
predictions are scored against what actually happened, and a fresh context that never saw the build
checks the diff against the spec.
**Appetite:** 0.75 days
**Depends on:** phase-00, phase-01

Serves **REQ-08** (prediction calibration), **REQ-09** (unanchored spec-fidelity pass).

## This phase opens by self-hosting — the plan's pre-mortem row 3 depends on it

Before building anything, run the Phase-00/01 harness against **this file** —
`node .claude/scripts/develop/develop.mjs start 2 --lane develop` — and read the brief it produces
against `PLAN.md`. That is the only non-fixture proof this cycle buys, and real-phase dogfooding is
otherwise a declared no-go, so without this step the harness's first real use is also the first time
anyone finds out whether it works.

Portfolio's Phase 01 made the same move. If the harness cannot produce a usable brief for its own
real spec, that is this phase's first finding and it gets recorded in the ledger and the retro — not
worked around by hand-writing the brief and moving on.

## What this phase actually builds

- Prediction scoring in `handoff`: each of the brief's 5 prediction fields marked `hit`, `miss` or
  `unforeseen`, each with the ledger line that settles it. Unsettleable predictions are
  `unforeseen`, never quietly dropped.
- `.claude/agents/spec-fidelity.md` — a fresh-context agent whose entire information set is
  `phase-NN-spec.md` plus the phase diff. It returns: built what the spec says · scope creep ·
  exit-criteria drift · non-negotiables intact · one user-visible-behaviour line. It is unanchored by
  construction: it never receives the build session's reasoning, because the point is that it cannot
  inherit the author's blind spots.
- The handoff evidence pack: proofs + tiers + the prediction scorecard + the fidelity report,
  assembled for `/arc-phase-done`. Develop never closes the phase.

## Exit criteria (Definition of Done)

- [ ] the harness was run against this phase's own real spec before the phase was built, and what it
      produced (usable brief, or the specific way it failed) is recorded in the ledger
- [ ] `handoff` scores all 5 prediction fields with a settling ledger reference each
- [ ] no numeric confidence appears anywhere in the output — `develop-lint`'s
      `self-declared-number` group is asserted against the handoff output itself
- [ ] `spec-fidelity` runs with spec + diff only and its report lands in the evidence pack
- [ ] a deliberately drifted fixture (a slice implementing something the spec never asked for) is
      caught by the fidelity pass
- [ ] tests added & green on all 3 CI legs
- [ ] tracker updated (PROGRESS.md row ✅ + done-log)

## Verification plan

One coarse line at kickoff, refined via `/arc-change` when the phase starts: bats over the handoff
scorer against a fixture whose outcomes are known in advance, plus a scope-creep fixture the
`spec-fidelity` agent must catch and a matched clean fixture it must pass.

## Rabbit holes in this phase

- **A semantic-diff engine.** Rejected in the design source §11. The fidelity pass narrates behaviour
  change in prose, and that prose line is the whole of it this cycle — the deterministic half it was
  meant to pair with (the public-API surface diff) is a PLAN no-go until something can read code.
- **Letting the fidelity agent read the ledger or the brief.** It would then be grading work it can
  see the reasoning for, which is the whole failure mode this exists to avoid.
- **Growing the prediction taxonomy** because 5 fields feel thin. They stay 5 until real scores say
  otherwise.

## Out of scope for this phase

- Stuck backstops, checkpoints, debt ledger → Phase 03.
- The learning ledger and any promotion loop → PLAN `## No-gos`.

## Your-setup / pending

Nothing.

**Tripwire:** at 1.0 day inside this phase, ship prediction scoring and cut the `spec-fidelity` agent
to Phase 03's remaining budget — the scorecard is worthless if it is never filled, while the fidelity
pass can run manually for one cycle.

## Non-negotiables (verbatim from PLAN)

- The main session writes the code — develop supplies context, discipline, checkpoints and evidence; there is no coder subagent, ever (ADR-0068).
- develop never closes a phase, never intakes scope and never creates a lane — `/arc-phase-done`, `/arc-change` and `/arc-kickoff` keep those jobs.
- Every slice declares its acceptance proof BEFORE implementation; `proof: none` is not a slice (ADR-0063).
- Every number is computed by a tool or earned from a scored outcome — a self-declared score in a ledger row is a lint finding (ADR-0064).
- Any gate, lint or parser this build ships gets an adversarial construct-a-breaking-input pass in the same section that ships it, with every hole pinned as a fixture.
- develop never modifies its own policies, gates, skills or capabilities without a recorded, Ashiq-approved promotion.
- The whole lifecycle runs offline on a committed fixture; `--lane` is the only lane input and root-mode output stays byte-identical (ADR-0067).
