# ADR 0108 — A learning candidate is graded by an agent that never saw its author's reasoning

**Status:** accepted
**Date:** 2026-08-02
**Product:** `develop`
**Reversibility:** one-way
**Revisit trigger:** a fresh-agent verdict is shown to be systematically worse than the author's own
— i.e. it promotes candidates that later fail forward-measurement more often than the author would
have. That is the only evidence that would justify letting the author grade its own work.

## Context

The Learning System proposes safeguards: a rule, a fixture, a checklist, a template. Something has
to decide whether a proposed safeguard is real. The cheapest answer — the session that wrote the
candidate evaluates it against the fixtures — is the one that cannot work.

Cycle 5 measured why, on this exact repo. I built `develop-lint`, then wrote 26 adversarial inputs
for it. All 26 were caught: zero holes. An agent that had never seen the parser then found **nine**,
including a ledger claiming `proof: it works` / `commit: yes` that parsed to zero slices, zero
errors, and got "all checks passed ✔". All 26 of mine attacked one direction — a slice the parser
*sees* holding bad data. All nine attacked the other — a slice the parser never sees.

**26 of 26 was a true result about my blind spot, not about the gate.** An author grading their own
safeguard produces exactly that number, and it means nothing.

## Options considered

1. **The authoring session evaluates its own candidate** — cheapest, and demonstrably worthless by
   the measurement above.
2. **A fresh agent receiving only the candidate and its fixture results** — cannot inherit the
   reasoning that makes a weak candidate look sufficient, because it never receives it.
3. **A quorum of fresh agents** — more robust, and the right answer later; but three verdicts on
   every candidate is a cost this cycle has not earned, and one unanchored verdict is already a
   category better than zero.

## Decision

Option 2. The evaluator receives exactly two things: the candidate, and the computed results of
replaying it against the fixtures. It does not receive the failure that motivated it, the session
that authored it, or any reasoning about why it should work.

Its output is a verdict plus what would change its mind — never a score. A number it invents about
its own certainty is the thing this product's governing rule forbids.

**The evaluator does not promote.** It produces one of the three inputs Ashiq weighs (ADR-0109 has
the second and third). No verdict, count or streak promotes anything on its own.

## Consequences

Easier: a candidate that only looks good because you know why it was written stops passing. The
"promoted" state gains a real meaning.

Harder: every promotion costs an agent round-trip, and a candidate cannot be promoted in the same
breath as it is written. That latency is the mechanism, not a side effect.

What we would revisit if this goes wrong: if single fresh verdicts prove noisy, the fix is option 3
— a quorum with disagreement surfaced — not a return to self-grading.
