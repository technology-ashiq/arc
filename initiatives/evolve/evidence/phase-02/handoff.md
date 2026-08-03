# Handoff pack — phase 02 · lane evolve

9/9 slices proven.

## Prediction calibration

4 hit · 0 miss · 1 unforeseen

- **likely-failure-mode** — hit -- 2b44775. Exactly that, five separate ways: an unresolved cohort count read as zero, MISSING windows never consulted, omitted guardrails read as none declared, NaN units passing the floor check, and a polluted prototype supplying a whole arm
- **likely-regression-site** — hit -- 2b44775. 9 of the 15 breaks were in the gate; the arithmetic was clean apart from the alpha lookup
- **riskiest-file** — hit -- 2b44775. verdict.mjs, as predicted
- **expected-blockers** — unforeseen -- 77e4655. Sourcing the vectors was not the blocker. The blocker was that the two independent derivations DISAGREED, and that the acceptance criterion REQ-04 states was therefore unachievable as written. That needed an ADR, not a workaround
- **expected-proof-failures** — hit -- dded67e. The vectors did fail to reproduce, but on the TOLERANCE rather than the platform: case D sits 512 ULP from the independent derivation and 2.2e-19 from it in absolute terms

## Proofs

| slice | tier | proof | commit |
|---|---|---|---|
| 01 | contract | contract - determinism, a 2x2 arm-by-cohort contingency over 10000 units, and a 500-pair test that (a\|b,c) and (a,b\|c) are DIFFERENT assignments | 2b44775 |
| 02 | contract | contract - a 50/50 split lands 4800-5200 of 10000; a 90/10 split honours the declared proportions; fractional, zero and negative shares are refused | 2b44775 |
| 03 | contract | contract - ttlExpired fires exactly at the boundary and not 1ms before; 10 malformed inputs THROW rather than returning a falsy value | 2b44775 |
| 04 | contract | contract - an intact seal passes, a moved seal reports canonical-drift, and a malformed digest is refused rather than string-compared | 2b44775 |
| 05 | contract | contract - two INDEPENDENT derivations, committed BEFORE any implementation; bit-for-bit against the pinned tree plus absolute agreement with the independent one | 2b44775 |
| 06 | contract | contract - a below-floor arm is named; an unresolved guardrail refuses; MISSING windows gate; a cohort violation refuses; an unresolved violation COUNT also refuses | 2b44775 |
| 07 | contract | contract - a second compute is refused, and every truthy computedBefore value refuses | 2b44775 |
| 08 | contract | contract - a THIRD fresh unanchored agent, on floor / cohort / seal / no-peeking, told to construct and RUN breaking inputs | 2b44775 |
| 09 | contract | contract - the full CI matrix, 19 jobs across ubuntu 18/20/22, macos and windows | 2b44775 |

## Spec-fidelity

Run the `spec-fidelity` agent over this phase's spec and diff, and paste its report
below. It reads ONLY those two files — never this pack, never the ledger — because the
session that wrote the code cannot see its own blind spots.

<!-- paste the fidelity report here; the verdict line is the last line of its output -->
