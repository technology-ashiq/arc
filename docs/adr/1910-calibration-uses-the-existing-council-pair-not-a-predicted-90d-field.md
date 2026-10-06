# ADR 1910 — Calibration uses the existing council pair, not a `predicted_90d` field

**Status:** accepted
**Date:** 2026-10-06
**Product:** `discover`
**Reversibility:** two-way
**Revisit trigger:** evolve's calibration needs a numeric horizon that the call/confidence/outcome triple cannot express. Then that is a council-lane `/arc-change` on its own payload, and never discover's.

## Context

The design source's REQ-04 and REQ-08 put `predicted_90d` on every `council.verdict`. Kickoff verification against `.claude/scripts/hq/lib/validate.mjs:326` found that the `council.verdict` payload is **closed** at `session_id · question_hash · call · confidence`. Per ADR-0304 and ADR-0310, calibration is computed from those fields, so a validator asserts them. `predicted_90d` appears nowhere in the tree. Adding it would mean editing a company organ's payload, and DIS-F (ADR-1906) forbids that.

## Options considered

1. **Amend the council payload.** It matches the design wording, but it is a council-lane change to a closed calibration schema.
2. **Use the pair that already exists.** The council question is phrased as a 90-day forecast. `call + confidence` is the forecast, and a `council.outcome` (`happened · did-not-happen · unresolved`) recorded at day 90 resolves it. `council-calibrate.mjs` already scores exactly this pair.

## Decision

Option 2. The council question discover asks is fixed-form: *"Within 90 days of launch, will <slug> reach <signal>?"* Its hash is the verdict's `question_hash`, and the full text and signal go into `<slug>.hunt.md`. REQ-04 and REQ-08 are reworded to say this, and their IDs are kept.

## Consequences

The evolve feed is a reader test over `council.verdict` and `council.outcome`, and no council code is touched. The day-90 outcome is recorded by the owner. Until then the outcome is `unresolved`, which counts as no data rather than a miss.
