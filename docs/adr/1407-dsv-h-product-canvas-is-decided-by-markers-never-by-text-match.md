# ADR 1407 — DSV-H: product canvas vs documentation is decided by markers, never by text-match

**Status:** accepted
**Date:** 2026-08-23
**Product:** `design`
**Reversibility:** two-way
**Revisit trigger:** the gate refuses a page that a human reads as legitimate product — the
marker vocabulary is then wrong, and the fix is the manifest, never a text heuristic.

## Context

Cycle 3's variants spent **30–60% of their scroll** on state-matrix tables and keyboard-shortcut
documentation, and the jury ranked them **up** for it — thoroughness read as craft. The product
canvas was being judged partly on its own documentation.

The obvious fix — refuse pages whose text says "Reference" or "States" — is the exact shape
this lane has already been burned by. `design-explore.sh` once refused a correct variant over
`&#8377;`, the rupee HTML entity, because a text rule could not tell a colour literal from a
currency sign. The lane's own precedent is recorded in that script's comments: **a gate that
refuses correct work is broken, not strict.**

## Options considered

1. **Text-match documentation vocabulary** — pros: no authoring burden / cons: a legitimate
   product page may legitimately say "Reference"; this manufactures false refusals and the
   lane has the scar.
2. **Explicit markers plus a per-explore surface manifest** — pros: deterministic, and
   classification is declared rather than guessed / cons: composers must mark surfaces.

## Decision

Option 2. Every explore carries a **surface manifest**, and surfaces carry a
`data-arc-doc-surface` attribute classifying them as product canvas versus demo/reference.
Doc-surface content rendered on a **product** surface is a deterministic **ERR**.

Text-matching is rejected outright, not deferred.

## Consequences

Easier: the classification is a fact the run declares, so it can be asserted rather than
inferred. Harder: an unmarked surface is now ambiguous, and the gate must decide what unmarked
means — it fails closed, which means a composer who forgets the attribute gets a refusal; that
cost is accepted, and the adversarial pass on this gate must include an unmarked-surface case
and a legitimate page carrying the word "Reference" as its two negative controls.
