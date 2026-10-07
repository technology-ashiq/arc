# ADR 0510 — BELOW-BAR is an unproven refusal path, judged on the IST day boundary

**Status:** accepted
**Date:** 2026-10-07
**Product:** `policy`
**Reversibility:** two-way
**Revisit trigger:** after two guard runs, more than half of the in-scope cells are `stale`
while the processes holding them ran in the window. Then either N is wrong, or the work does
not exercise its refusals, and the owner reads which.

## Context

`PASS = zero violations` cannot see a policy nobody uses (ADR-0049's lesson, made a class by
ADR-0404 and ADR-1406). POL-L needs a class that fails for **insufficiency**: a pair that holds
a level but has never shown its refusal path working. It must be deterministic under replay,
so the age cannot depend on when the check happens to run. And it must not turn every lane's
CI red over a file only the owner can edit (`hq.policy.yaml` is on the deny floor).

Fork POL-L2: are interactive and headless refusals one cell or two?

## Options considered

1. **One cell per (subject × capability), age in IST calendar days from an injected as-of
   day.** Matches the reducer's own key (ADR-0505). The surfaces are already separate subjects
   (`session:interactive` vs `process:*`).
2. **A third axis per surface.** It doubles the table, and no subject is served by two
   surfaces today.
3. **Age in hours from the wall clock.** Not replayable: the same spine gives different
   answers a minute apart.

## Decision

**Option 1.**

- **Scope:** effective ≥ L1 **and** capability ∈ {spend, publish, deploy, network, shell}.
  An L0 pair is `n/a`, because the deny is the level. read, write and message are out of POL-L's
  scope and render `n/a`.
- **State, a closed enum:** `fresh` · `stale` · `absent` · `unknown` · `n/a`. `absent` = a
  carrier exists and has never fired for this pair. `unknown` = no surface that could refuse
  this pair writes a typed refusal (the ADR-0509 table's not-instrumented rows).
- **BELOW-BAR** ⇔ in scope **and** state ∈ {absent, unknown, stale}.
- **Age** = `asOf` IST day − IST day of `last_refusal.ts`. **stale** ⇔ age > N. So a receipt is
  still fresh at exactly N, and flips at the IST midnight that starts day N+1. The fold reads no
  clock: `asOf` is a required argument, and the CLI's default is resolved once, outside the fold.
- **N** is `evidence_days` on the grant, next to its level (`shell: { level: L1,
  evidence_days: 35 }`). **A missing N is BELOW-BAR with `reason: no-bar-declared`, never a
  lint FAIL.** Proposed starting value: 35 days (monthly guard cadence plus 4 days of grace). The
  owner sets the real values.
- **Gap B's Availability enum** does not exist on `origin/main` (`9864ee29`, grep). The local
  enum above ships with a one-to-one mapping table in the fold module. When Availability lands,
  the fold adopts it in that change and deletes the mapping. The owner names the lane that owns
  Gap B.

BELOW-BAR never changes a level and never denies an action (ADR-0508: promotion stays human).
It is a reported state.

## Consequences

Easier: one cell key everywhere (reducer, face, guard); replay is byte-identical by
construction.

Harder: the first honest reading is "every in-scope cell is BELOW-BAR", which is the point and
also the thing most likely to be waved off. The guard (ADR-0511) is what keeps it from becoming
wallpaper.

Revisit: the trigger above. N is a two-way door and is expected to move.
