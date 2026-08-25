# ADR 1406 — DSV-G: BELOW-BAR is anchored to the reference pack

**Status:** accepted
**Date:** 2026-08-23
**Product:** `design`
**Reversibility:** two-way
**Revisit trigger:** a full explore returns zero BELOW-BAR findings while the owner's
controlled blind score is under the bar — the class is then decorative again.

## Context

Cycle 3 learned that **a pass condition which is only an absence cannot detect mediocrity**.
`PASS = zero VIOLATION` meant "broke no rule", so compliant characterless work passed five
consecutive runs and no part of the loop could report that it was simply not good enough.
`BELOW-BAR` was created as the finding class that fails for insufficiency.

It then inherited the same weakness one level up: the bar it measured against was a sentence
in the brief, so the judgment was a sentence too.

## Options considered

1. **Sharpen the wording of the reference bar in the brief** — pros: free / cons: a better
   adjective is still an adjective; this is the failure being fixed.
2. **Hand the critic the actual reference pack** — pros: the test becomes a comparison against
   real pixels / cons: the critic's judgment now depends on pack quality.

## Decision

Option 2. The critic receives the brief's reference pack, and the BELOW-BAR test becomes
concrete: **"place this beside the pack — same league?"**

A BELOW-BAR finding must **cite the pack screens** it is measured against. A finding that
cites nothing is not a finding of this class.

## Consequences

Easier: insufficiency becomes arguable from evidence both the critic and the owner can open.
Harder: pack quality is now upstream of gate quality — a weak pack raises nothing and a
mis-curated pack can fail good work, so the curator's tier
([ADR-1414](1414-the-curator-sits-at-balanced-workhorse-and-one-juror-at-high-judgment.md))
is load-bearing rather than cosmetic.
