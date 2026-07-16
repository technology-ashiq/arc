# ADR 0014 — Persist the verifier's first-pass ratings to anchor the REBUTTAL LOG

**Status:** accepted (supersedes the "final-only ratings" aspect of ADR-0008)
**Date:** 2026-07-15
**Reversibility:** one-way
**Revisit trigger:** a cross-model juror (backlog) ships — a second independent grader makes the
first-pass ratings verifiable against a DIFFERENT agent's output, closing the residual single-author
fabrication gap this ADR only raises the bar on.

## Context
ADR-0008 stored **final-only** `## VERIFIER RATINGS` plus a `## REBUTTAL LOG` recording each
rebuttal-set id's `pre → post`, and let a re-graded first-pass Weak/Contested satisfy the
no-rubber-stamp invariant (fairness.md #6). The Phase-2 adversarial pass proved this is a **one-word
loophole**: because the same Chair authors the log's `pre`, its `post`, AND the final ratings, writing
`S1: Contested → Supported` for any already-Supported point manufactures a "contest" the lint cannot
disprove — the `post == final-rating` check only rejects an *inconsistent* flip, never a *consistent
fabrication*. The verifier's actual first-pass grades were never persisted, so the log's `pre` column
had nothing to diff against. ADR-0008's own revisit trigger named exactly this ("log abused as a loophole").

## Options considered
1. **Persist first-pass ratings + measure no-rubber-stamp on them** — the verdict emits the verifier's
   step-5 grades verbatim as `## FIRST-PASS RATINGS`; the REBUTTAL LOG becomes a checked diff (`pre` must
   equal the first-pass grade, `post` the final grade); no-rubber-stamp checks FIRST-PASS. Pros: the log
   is anchored to persisted verifier output, so a fabricated contest now requires lying in the first-pass
   section — a blatant, auditable misquote of the verifier, not a buried one-word edit. Cons: an extra
   section; single-author fabrication is raised, not cryptographically closed.
2. **Keep final-only, tighten the log regex** — rejected: no regex can anchor `pre` to anything, because
   the artifact holds no independent record of the first pass. The loophole is structural, not syntactic.

## Decision
Option 1. When a rebuttal ran, the verdict carries `## FIRST-PASS RATINGS` (the verifier's original
grades, verbatim from step 5) AND the final `## VERIFIER RATINGS` (post-rebuttal). council-lint measures
the no-rubber-stamp invariant on the first-pass grades, requires each `## REBUTTAL LOG` line's `pre` to
equal the first-pass grade and `post` the final grade, and forbids more than one of either section. The
carrying reason: the invariant is about whether the verifier contested anything on its FIRST pass — that
is the honest place to measure it, and persisting that pass is the only way to make the log real proof.

## Consequences
Easier: the REBUTTAL LOG is a mechanically-checkable diff between two persisted rating sets; a rubber-stamp
can no longer be laundered through a fabricated log line. Harder: the Chair must persist the verifier's
first-pass output faithfully — and the residual honest limit stands: one author who fabricates BOTH the
first-pass section and the log is still not caught mechanically. That gap closes only with a second
independent grader (the cross-model juror on the v2 backlog), which the revisit trigger names.
