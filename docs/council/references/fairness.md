# arc-council — fairness & anti-rigging invariants

The council is only worth trusting if it can't be quietly rigged toward the asker's hopes. These invariants
make that structural. Where an invariant is mechanically checkable, `council-lint` enforces it; the rest are
enforced by the Chair protocol + the verifier (a separate agent) — **never by the Chair grading itself**.

## Invariants
1. **Independence** — members are spawned in ONE parallel batch, each blind to the others; a failed member is retried blind, never primed with siblings' answers. *(protocol)*
2. **Neutral Evidence Brief** — facts only, no verdict-leaning language; the verifier separately flags brief-framing bias. *(protocol + verifier)*
3. **No fabrication** — never invent a source or number; unverifiable claims are marked Low. *(protocol)*
4. **Triangulation** — a live brief's High/Med fact needs ≥2 independent sources or an explicit low mark. *(`council-lint --brief`)*
5. **Verified-only verdict** — every KEY REASON and the DISSENT cite a POINT-ID the verifier rated Supported/Plausible. *(`council-lint --verdict`)*
6. **No rubber-stamp** — a run whose verifier contested nothing (0 Weak/Contested) is invalid. *(`council-lint --verdict`)*
7. **Preserved dissent** — the strongest surviving opposing point is always shown. *(`--verdict` requires a cited DISSENT; protocol)*
8. **Pre-registered prediction** — the Chair records its predicted decision BEFORE reading the verifier and shows PREDICTION-vs-RESULT, exposing hindsight bias. *(`council-lint --verdict` requires a `PREDICTION:` line)*
9. **Willing to decide against the asker** — the advocate is not the decider; a council that only ever says "yes, do it" is useless. *(protocol)*
10. **Confidence discipline** — High needs strong evidence AND low dissent. *(protocol)*
11. **Guardrails** — non-partisan (policy), not-licensed-advice (finance/legal/medical). *(agent contracts)*

## What the lint mechanically enforces (not Chair self-report)
- **`--verdict`** — cited IDs are verifier-Supported/Plausible · the verifier contested ≥1 point · a `PREDICTION:` line exists.
- **`--brief`** — ≥3 facts · a live brief's High/Med facts carry ≥2 sources or a low mark.
- **static** — the command + all 12 member agents exist with valid frontmatter.

The Chair NEVER certifies its own fairness — the verifier (a separate `opus` agent) and `council-lint` do.
