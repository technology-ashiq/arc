# Trial-gate ledger

> The evidence log that decides when a WARN-first substance gate becomes a real (FAIL-capable)
> gate. Written by `/arc-retro`; consumed by a human before flipping a gate. This file is the
> reason "scripts GATE, never LLM self-assessment" stays literally true — promotion is driven by
> recorded runs, not a judgement call. (Kickoff v4, item F1. Spec: `docs/kickoff-v4-plan.md`.)

## What "in trial" means

Every v3.5 substance gate — `pre-mortem-cite` · `appetite-sum` · `adr-wired` · `adr-confidence` ·
`architecture` · `current-state-structure` · `nonneg-drift` — ships in the `TRIAL` set in
`.claude/scripts/kickoff-lint.mjs`. A trial gate **always WARNs** (suffix `[trial]`), even on a v3
plan; it never FAILs. `kickoff-lint` prints a `[trial-status]` footer showing the live-vs-trial count.

## Promotion criteria (both must hold)

A trial gate is **promotable** only when:

1. **Fixture-proven** — a bats test in `tests/kickoff-lint.bats` asserts the gate FAILs on its own
   named mutation, and the `good/` fixture passes clean (zero `[trial]` on the modelled practice).
2. **≥ 3 clean dogfood runs** — the gate has been exercised on ≥ 3 real kickoffs logged below with
   **zero false-positives** (it never fired on a plan that was actually fine).

Promotion = delete the group from the `TRIAL` set in `kickoff-lint.mjs` (one line), recorded in git.
`/arc-retro` proposes it as a diff; a human approves. A logged false-positive resets the count.

> Honesty: "3 clean runs" is a **threshold**, not a proof of correctness. It bounds false-positive
> risk — exactly what WARN-first was protecting against — nothing more.

## Ledger

`date | gate | run-ref | fired? | false-positive?`

| date | gate | run-ref | fired? | false-positive? |
|---|---|---|---|---|
| 2026-07-16 | (all substance gates) | c036e63 (arc-council-v2 kickoff) | no (0 `[trial]` WARNs) | no |
| 2026-07-16 | (all substance gates) | 58510be (arc-council-v3 kickoff) | no (0 `[trial]` WARNs) | no |

<!-- Append one row per (gate × kickoff run). run-ref = a PLAN commit SHA, a dry-run id, or a
     fixture name. fired? = did the gate WARN on that run. false-positive? = did it WARN on a plan
     that was actually fine. Delete the (example) row once real runs exist. -->
