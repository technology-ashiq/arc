# ADR 0913 — reproducibility is replay-determinism with honest variance (BEN-B)

**Status:** accepted
**Date:** 2026-08-12
**Product:** `bench`
**Reversibility:** one-way
**Revisit trigger:** the provenance tuple proves insufficient to explain a disputed score — a
missing component is added by amendment, forward-only, never backfilled onto past records.

## Context

The archived brief promised "same config → same scores". That is not a keepable promise for
nondeterministic models, and promising it would make every honest re-run look like a defect.

## Options considered

1. **Claim live-run determinism** — clean-sounding, and false; it would train readers to
   distrust real variance.
2. **Split the claim**: scoring is deterministic, model output is not — and report the spread.

## Decision

**Option 2**, in two halves.

**Deterministic half — scoring captured outputs is pure.** Re-scoring a captured run produces a
**byte-identical scorecard**. This is the fixture-proven claim (REQ-01) and it is what makes a
disputed number re-checkable without spending money.

**Honest half — live calls vary.** **K = 3** attempts per fixture, temperature 0 where the
provider offers it, **medians reported WITH their spread**. Live re-run variance is reported,
never presented as certainty.

**The provenance tuple, recorded on every run:** fixture IDs + input SHAs · eval-pack revision ·
process version · **driver name + version** · exact model ID + MP-F fingerprint (as sibling
blocks, ADR-0903) · request settings · router SHA · ceiling-file reference · timestamp ·
normalized results.

**Absent fields stay absent** — never estimated, never `unknown`, never a placeholder
(ADR-0069 b(5)).

Marked **one-way** because every record written under this tuple is append-only evidence.

## Consequences

**Easier:** a number can be re-derived from captured bytes for free, and variance is visible
rather than averaged away.

**Harder:** the replay proof requires canonical serialization everywhere, and any change to the
normalizer invalidates stored scorecards — so the normalizer carries its own version inside
each scorecard.

**Two traps this closes, both from `docs/retro-log.md`:**

- 2026-08-09 (arc-absorb) — *"changing a hash preimage format silently invalidated every
  commitment already outstanding, and the verifier then accused the owner's own sealed
  judgement of TAMPERING."* The scorecard therefore carries its normalizer version, and a
  replay mismatch reports **stale-format** and **genuine mismatch** as different outcomes with
  different exit codes.
- 2026-08-04 (arc-evolve) — a non-total encoder folded `NaN` and `-Infinity` to `null`, giving
  two opposite states one hash. The canonical encoder is **total and type-tagged** and refuses
  what it cannot represent (ADR-0907).
