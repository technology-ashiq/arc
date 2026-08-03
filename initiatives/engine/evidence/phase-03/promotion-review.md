# Phase 03 — gate promotion review

`docs/trial-ledger.md` sets two criteria, and BOTH must hold before a WARN-first gate becomes
FAIL-capable:

1. **Fixture-proven** — a bats test asserts the gate FAILs on its own named mutation, and the
   good fixture passes clean.
2. **≥3 clean dogfood runs** — exercised on ≥3 real runs, with **zero** false positives.

## The gates this cycle shipped

| Gate | Fixture-proven? | ≥3 clean dogfood runs? | Verdict |
|---|---|---|---|
| `process-lint` (19 checks) | **yes** — 73 REJECT fixtures each asserted against its own check id, plus 11 ACCEPT fixtures | **no** — 2 real runs, 1 of which failed | **not promotable** |
| `arc-compile` byte-diff + `lf-only` | **yes** — two negative controls with byte offsets; `lf-only` has a CRLF-seeded control | **no** — never exercised on real work | **not promotable** |
| `arc-run` budget / schema / scrub | **yes** — every path has a fixture, and the scrub has both a positive and a negative control | **no** — 2 real runs | **not promotable** |

## Verdict: nothing is promoted this cycle

Every gate meets criterion 1 and none meets criterion 2. Two real runs is not three, and one
of the two failed — on a defect the gates themselves did not catch (the fenced-JSON bug,
found by the run rather than by a gate). Promoting on that evidence would be exactly the
"three clean runs is a threshold, not a proof of correctness" line the trial ledger writes
about itself.

**No ledger rows are added.** A row records a gate being *exercised on a real kickoff*; these
gates have not been. Writing rows to make the table look populated is the failure mode
`PORTFOLIO.md` names — a number nobody recomputes starts lying.

## The related question this review has to answer honestly

The PLAN's no-go says *"Promoting any gate to BLOCK beyond what `docs/trial-ledger.md`
evidence supports. Everything new ships WARN-first."* Every `process-lint` check exits 1.

That is not a violation, and the reason is the one `phase-00-spec.md` recorded when the
tension first appeared: the no-go governs promoting a gate to BLOCK **in the CI pipeline**,
not the tool's own exit code. A lint that cannot exit non-zero on a hostile input is not a
lint, and its fixtures could assert nothing.

**Verified, not assumed:** no engine gate is wired into `.github/workflows/ci.yml` as a step.
They run only from `tests/*.bats`. So nothing new blocks a merge, and the no-go holds.

**The promotion question that remains open** is therefore not "WARN → FAIL" but "test-invoked
→ CI step". That needs the same ≥3 clean dogfood runs, and it is carried as a retro input
rather than decided here.

## Carried to the retro

1. **RI-1** — REQ-08's non-Claude real runs (`evidence/phase-03/real-runs.md`). Blocks the
   cycle's central claim.
2. **RI-2** — wiring `process-lint --all` and `arc-compile --check --all` into CI as named
   steps, once the dogfood evidence exists. Today the only thing checking the three generated
   commands is a bats file.
3. **RI-3** — the spine's `cost` block cannot express tokens-without-money, so ADR-0069 block
   (c) metric 1 stays uncomputable. A spine change, not an engine one.
