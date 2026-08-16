# ADR 1015 — LED-P: reconciliation takes both input paths, over one summable parser result

**Status:** accepted
**Date:** 2026-08-12
**Product:** `ledger`
**Reversibility:** two-way
**Revisit trigger:** the export-file path goes unused for two consecutive closes because the manual
total is always faster — the file path is then dead code and should be cut, not maintained.

## Context

REQ-05 names both reconciliation inputs — "provider export sum **or** manually entered provider
total". The open question is not *whether* both exist but *when the coupling is decided*: if
Phase 0's export parsers return something Phase 2 cannot sum, Phase 2 either rewrites them or grows
a second parsing path, inside a two-day budget.

Phase 0 already builds two export parsers (razorpay, merchant-of-record) for ingest. The marginal
cost of the file-based reconciliation path is therefore not "write a parser" — it is "be able to sum
what the parser already returns".

## Options considered

1. **Both paths, sharing one typed parser result** — Phase 0's parsers return a typed list of
   normalized payments; Phase 2 sums that list for the export path and takes an integer for the
   manual path. Both converge on one number before the gate sees anything.
2. **Manual total only in v1** — needs no new code and silently narrows a locked REQ, leaving the
   operator to add up an export by hand, which is the arithmetic most likely to be got wrong on the
   one occasion it matters.
3. **Export file only** — cleanest input, and it blocks a close whenever a provider's export is slow
   or unavailable, turning a safety net into a hard dependency on a third party.

## Decision

Option 1. Both paths ship, and the coupling is decided now: **Phase 0's export parsers return a
typed, summable list of normalized payments**, and Phase 2 reuses that type unchanged.

- `--reconcile-file <path> --rail <name>` sums the parsed export
- `--reconcile-total <minor-units> --rail <name>` takes the operator's figure directly

Both produce one integer in minor units per rail (LED-M, ADR-1012), and the gate (LED-F, ADR-1005)
compares that against the spine's total for the same rail. A close covering more than one rail
requires an input for **each** rail — an unreconciled rail blocks the close exactly as a mismatched
one does, because "no input" and "matches" must never render the same.

The reason that carried the most weight: this is a locked REQ, so the real decision was the parser's
return type, and deciding it at kickoff costs nothing while deciding it in Phase 2 costs a rewrite.

## Consequences

Easier: Phase 2's reconciliation is arithmetic over an existing type rather than new parsing. The
manual path keeps the close possible when an export is unavailable.

Harder: Phase 0's parser interface now has a second consumer it must not break, so its return type
is part of the phase's contract and is pinned by fixtures rather than left implicit.

Export parsers are parser-class and get the mandatory adversarial pass before FAIL promotion.
Redacted, PII-stripped real samples are pinned as fixtures — a reconciliation sum computed from a
misparsed export is a wrong number wearing a gate's authority.
