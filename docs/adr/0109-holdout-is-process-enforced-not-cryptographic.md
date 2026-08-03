# ADR 0109 — The holdout is process-enforced, and says so

**Status:** accepted
**Date:** 2026-08-02
**Product:** `develop`
**Reversibility:** two-way
**Revisit trigger:** a promoted learning passes the withheld set and then fails forward measurement
twice — the holdout is then leaking, and the exclusion needs to become mechanical (a separate repo
or an encrypted set) rather than procedural.

## Context

A learning candidate must be judged on cases it was not written from, or it is only being judged on
its own memory. That needs a holdout.

**A cryptographically blind holdout is impossible here and pretending otherwise would be the more
dangerous option.** The candidate-authoring session runs inside this repository with read access to
everything in it. Any "hidden" fixture directory is one `cat` away. A holdout that claims blindness
it does not have is worse than no holdout, because it converts a soft signal into a hard-looking one
— which is precisely the false-precision failure this product exists to refuse.

## Options considered

1. **Claim a blind holdout and hope** — rejected. The claim is false and the falseness is invisible
   in the artifact, which is the shape of every measurement failure in this repo's retro-log.
2. **A separate private repository the authoring session cannot read** — genuinely blind, and real
   infrastructure: another repo, another sync path, another thing to keep in step. Disproportionate
   before the loop has proven its value.
3. **Process-enforced blindness, honestly labelled** — three independent mechanisms, none of them
   cryptographic, and the label says so.

## Decision

Option 3, with all three mechanisms required together:

1. **Exclusion.** `tests/fixtures/develop-evals/withheld/` is excluded from candidate-authoring
   context, and a lint FAILs when a candidate row cites a withheld fixture id. No command prints
   the withheld set's contents.
2. **Unanchored evaluation.** The replay is run and judged by a fresh agent (ADR-0108) that never
   received the authoring reasoning.
3. **Time-forward holdout — the one that cannot be gamed.** Escaped-miss and rework rates in phases
   *after* a promotion, against the pre-promotion baseline. A learning that does not generalise
   forward is rolled back, and the rollback is recorded with its evidence.

Mechanism 3 is the real control. 1 and 2 raise the cost of accidental contamination; only 3 tests
whether the learning was true.

**The label is part of the decision.** Anywhere the holdout is reported it is named
"process-enforced", never "blind". Honest limits stay honest.

## Consequences

Easier: no new infrastructure, and the loop can start now rather than after a second repo exists.

Harder: mechanism 3 pays out over phases, not immediately, so early promotions rest mostly on 1 and
2 — which are the weak ones. Early promotions should be few and reversible, and the rollback path
must work before the first promotion, not after.

What we would revisit if this goes wrong: the revisit trigger above moves us to option 2, which is
the honest escalation once there is evidence the procedure leaks.
