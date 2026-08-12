# ADR 0709 — MEM-K: vocabulary mismatch is fixed by a hand-curated, git-reviewed alias layer, not by stemming or embeddings

**Status:** accepted
**Date:** 2026-08-11
**Product:** `memory`
**Reversibility:** two-way
**Revisit trigger:** the alias file passes ~200 entries, or a single golden-set miss needs more
than three alias edits to fix → the deterministic layer is carrying more than it should and the
embeddings condition in ADR-0706 gets re-examined.

## Context

BM25 ranks by term overlap, so it fails exactly where the searcher's words differ from the
recorder's. arc's corpus is full of this. Someone searching *"duplicate events lost"* needs the
row that says `DUP_IDEM`. Someone searching *"fire-and-forget"* needs the row about receipts in
`_quarantine`. Measured 2026-08-11: **120 distinct tags** across 53 retro rows, with a long tail —
`verification` appears 17 times, `gate` 12, but most tags appear once or twice. That is a
vocabulary that emerged from writing, not one that was designed, and it will not match a
searcher's guess.

Stemming is the reflexive fix and it is wrong here: this corpus is full of exact technical tokens
(`sed -i`, `withLock`, `p=none`, `bm25`, `DUP_IDEM`) that a Porter stemmer mangles. The
tokenizer is pinned to `unicode61` for the same reason — fold case and diacritics, change
nothing else.

## Options considered

1. **Porter stemming** — rejected: mangles the exact technical tokens that make this corpus
   searchable at all.
2. **Embeddings / vector search** — rejected for v1: a sub-1MB corpus does not need it, it adds a
   dependency and a model, it makes the index non-deterministic (breaking the rebuild fixture),
   and its trigger is now a number (ADR-0706) rather than a feeling.
3. **Hand-curated alias expansion, reviewed in git** — chosen.

## Decision

A hand-curated alias file at `docs/memory/aliases.md` drives **deterministic query expansion**.
It is a normal git-reviewed document — diffable, auditable, and owned by whoever writes the
rules.

**Every golden-set miss is fixed by an alias or tag edit, and the entry records the miss it
fixed.** That discipline is what stops the alias file becoming an undocumented pile of
guesses, and it is what makes ADR-0706's "≥3 alias iterations" condition countable.

Ranking weights follow the shape of the data: **tags > prevention > body**. The tag column
carries the highest weight because tags are the one deliberately-assigned field in the corpus;
prevention outranks body because prevention is the actionable half of a retro row and the half
users are looking for.

The tokenizer is pinned to **`unicode61`** — verified working in the 2026-08-11 probe, including
diacritic folding — and the canonical JS engine implements the **same** tokenization, since the
two engines must agree (ADR-0701).

**Confidence:** medium — the mechanism is deterministic and certain; whether hand-curation keeps
pace with the corpus is the open question, and it has a trigger above.

## Consequences

- **Easier:** every ranking failure has a cheap, deterministic, reviewable fix that lands in one
  file, and the fix is visible in a diff rather than buried in a model.
- **Harder:** it is manual. Someone has to notice a miss and write the alias. The golden set is
  what makes misses visible rather than leaving them to be noticed by accident.
- Aliases apply at **query** time, not at ingest, so adding one never requires a reindex and can
  never change what a record says — which keeps the index a pure function of the organs.
