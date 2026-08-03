# ADR 0111 — The Context Pack follows typed links exactly one hop, and records every source it used

**Status:** accepted
**Date:** 2026-08-02
**Product:** `develop`
**Reversibility:** two-way
**Revisit trigger:** a slice repeatedly needs a fact that sits exactly two hops away — recorded as
an assumption-ledger row in the Cycle-6 plan, tested in Phase 05.

## Context

The Context Pack assembles what past work already knows about a slice: the code neighbourhood, the
ADRs that governed it, the learning rows and retro patterns tagged to its area, the files that churn
most in its blast radius.

Records carry typed links — `area:` `adr:` `rule:` `fixture:` `phase:` — so an auth learning points
at the rule and the fixture that auth failures produced. The question is how far to walk them.

Two opposite failures sit either side of the answer. Walk zero hops and the links are decoration.
Walk transitively and the pack becomes everything, which is the same as nothing — and *process tax*
is the risk the design source ranks first, because a pack nobody reads costs on every slice and pays
on none.

## Options considered

1. **Zero hops** — retrieve only direct matches. Cheap, and it makes the typed-link fields pointless.
2. **One hop** — a matched learning row's own links are followed once, and there it stops.
3. **Transitive with a budget** — walk until N items. The budget becomes the real design, it needs
   ranking to decide what falls off, and ranking needs a relevance score — an invented number, which
   this product bans.

## Decision

Option 2. A record matched by area, tag or blast radius contributes itself **and** the things its
own typed links name. Those things contribute nothing further.

**Every source that contributed is recorded in the slice's `sources:` field**, including the ones
that produced nothing and including which retrieval path actually ran — code graph or the grep
fallback. A pack that cannot say where it looked cannot be audited, and a fallback that is silent is
the 2026-07-30 failure where a normalisation removed the property being measured and nobody could
see it.

**A source that is never useful is therefore visible**, which is what makes option 3 unnecessary:
if one hop is too little, `sources:` will show the same near-misses repeatedly and the assumption
row fires. Widening on evidence beats widening on intuition.

## Consequences

Easier: the pack has a fixed, explainable shape. Its cost per slice is bounded and does not grow as
the ledger grows, which is what keeps it usable in a year.

Harder: a genuinely useful fact two hops out is missed, and the operator will not know it was there.
The assumption ledger carries that risk explicitly rather than leaving it unstated.

What we would revisit if this goes wrong: two hops for `area:` links only — the vocabulary is
controlled and small, so that widening is bounded — before anything unbounded is considered.
