# ADR 0700 — MEM-A: memory indexes the organs in place; it never creates a second rule store

**Status:** accepted
**Date:** 2026-08-11
**Product:** `memory`
**Reversibility:** two-way
**Revisit trigger:** a source organ's own format becomes hostile enough that its adapter needs
more than ~0.5d of per-file special-casing — at which point the honest fix is to change that
organ's format as its own tiny change, not to copy its content somewhere friendlier.

## Context

The original `BRIEF-memory.md` (2026-07-22) proposed a `playbooks/` directory: a curated store
of rules, migrated out of the existing documents. That brief **predates the learning ledger**
(2026-08-02) and predates lanes. In the tree as it stands on 2026-08-11 the company's recorded
lessons already live in five places, each with a live consumer:

| Organ | Measured 2026-08-11 | Live consumer that would break |
|---|---|---|
| `docs/retro-log.md` | 53 pattern rows + 10 scoreboard rows | `/arc-kickoff` step 5 reads the whole file to seed the pre-mortem |
| `docs/trial-ledger.md` | 85 table rows (22 five-field, 63 seven-field) | gate-promotion decisions are read from it by a human before flipping a gate |
| `docs/develop/learning-ledger.md` | 4 blocks, L-001..L-004 | develop's Context Pack follows its typed links (ADR-0111) |
| `docs/adr/` | 140 files | every citation in every plan |
| spine `decision.recorded` | via reader only | `arc-inbox`, `arc-brief` |

Moving any of that into a new store creates two truths for the same fact. REQ-05 of this very
cycle exists to surface *contradicting rules* — manufacturing a second copy of every rule while
building the contradiction detector would be self-defeating.

## Options considered

1. **Migrate the organs into a curated `playbooks/` store** — pros: one clean format, no adapter
   per organ. Cons: breaks four live consumers, creates dual truth, and the "migration" is
   permanent manual curation work that competes with the recall module itself.
2. **Index the organs where they live; own nothing** — chosen. Pros: zero consumers disturbed,
   no dual truth, the organs stay the truth and the index stays disposable. Cons: five adapters
   instead of one reader, and every organ's format quirk becomes the adapter's problem.

## Decision

Memory **indexes in place**. The organs stay exactly where they live, in exactly the format they
have, owned by exactly whoever owns them today. `playbooks/` is **not created** in v1.

What the design source called "migration" is therefore **count-verified ingestion**: for each
adapter, `N_parsed == N_indexed`, printed per organ, and a mismatch is a build **failure**, not a
warning. Rows that are deliberately not indexed are **named in the output** with file and line —
never silently dropped.

Memory writes to exactly one place: its own derived index under `.claude/state/memory/`, which
is gitignored and rebuildable from the organs at any time.

**Confidence:** high.

## Consequences

- **Easier:** memory can be deleted entirely and the company loses nothing but a search box. That
  is the property that makes the whole module safe to build in 4 days.
- **Harder:** each organ's format is now a dependency. The 2026-08-11 measurement already found
  three surprises — trial-ledger is a markdown pipe table rather than the bare `date |` lines the
  design source assumed, retro-log holds two distinct row shapes plus **one anomalous 6-field
  row**, and the ADR corpus is 140 files rather than ~126. All three are handled by field-count
  parsing with named exclusions (ADR-0702), not by guessing.
- Format changes to any organ can break an adapter. This is caught by the count-verify, which
  fails loudly rather than quietly indexing fewer rows.
