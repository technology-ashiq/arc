# absorb PLANOFF bundles

Old-way versus absorbed-way, on at least 3 representative fixtures of the target class (REQ-03).

**Layout, reused from `docs/evidence/planner-bench/` rather than reinvented** (ADR-0605): a
`protocol.md` fixing what is compared and how BEFORE any run, a `scoring/` note saying what counts,
a `RESULTS.md` filled only AFTER the run, and an append-only `LEDGER.md` with one row per run.

**This directory is under the LANE, not under `docs/evidence/`,** and ADR-0605 Amendment 1 records
why: `docs/evidence/**` is frozen as the sole canonical copy of pre-portfolio history (ADR-0058), and
evidence is lane-scoped forward (ADR-0055). `planner-bench` sits in the frozen area because it
predates the portfolio split. Mirroring its layout was right; mirroring its location was not.

**Comparability is preserved by a link, not by a copy:** `docs/evidence/planner-bench/LEDGER.md` is
the sibling record, and PLANOFF-01 there is the receipt behind ADR-0606's first target — arc took the
top composite (94.5 vs gstack's 90.8) and still neither found nor survived the malformed-escape
defect that gstack's post-build review pass caught.

## The rules a bundle here obeys

1. **The prediction is pre-registered.** PLANOFF-01's own biggest hole was a verdict that could not
   be proven un-retrofitted. Write the expectation, with the fixtures, before the first run.
2. **A proposal without its results table is lint-invalid** (REQ-03). The table travels WITH the
   adoption proposal, never after it.
3. **The A/B never runs on the cycle's own diff.** Absorb's first target is arc's review surface, so
   measuring the rebuild against the change that produced it would be the author grading the author.
4. **Fixtures are chosen by someone who has not seen the rebuild diff** — the score is protected by
   rule 3, and the fixture SET needs its own protection.
5. **Blind and sealed** (ADR-0603): variant labels randomized, the label-to-variant mapping committed
   as a hash before the decision and revealed only after `decision.recorded` lands.

## Bundles

_None yet. The first is Phase 04's, on the unspecified-input defect class._
