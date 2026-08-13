# ADR 1000 — LED-A: ledger is a reader-only derivation layer that emits exactly one kind

**Status:** accepted
**Date:** 2026-08-12
**Product:** `ledger`
**Reversibility:** one-way
**Revisit trigger:** a ledger view is needed that cannot be computed from the spine at render
time within the render budget — at which point the fork reopens as "cache with a replay-equivalence
gate", never as "ledger emits derived events".

## Context

Ledger computes per-venture P&L from the append-only spine. The tempting shape for any
derivation layer is to write its conclusions back as events (`mrr.computed`, `pnl.rolled_up`)
so later reads are cheap. That shape destroys the property the whole module exists to provide:
if a number is stored, `rm derived -> replay` no longer reproduces it, and two sources of the
same truth immediately disagree.

Constraints in play: the spine is arc's only public API and is read through one reader
(`ADR-0030`, SPINE-G, `docs/adr/0030-spine-g-spine-is-the-only-public-api.md`), enforced by the
grep-lint at `.claude/scripts/review/spine-reader-lint.sh`. The event vocabulary is closed
(`ADR-0026`). The owner's Build-out Mandate receipt `01KZTM348858PDH44K4HA64CVA` fired this lane.

## Options considered

1. **Reader-only; one human-run emission (`month.closed`)** — every number is derived at render;
   the only write is a human closing a month. Cons: render cost grows with spine size.
2. **Emit derived roll-up events** — cheap reads, and every roll-up is a second copy of a truth
   the spine already holds; a corrected input silently disagrees with a roll-up already written.
3. **Materialised cache written by ledger, invalidated on replay** — faster, but a cache that
   writes to the spine is option 2 wearing a different name, and one that writes beside it is a
   second money store (LED-B forbids it).

## Decision

Option 1. Ledger consumes the spine exclusively through the reader lib and writes exactly one
event kind, `month.closed`, and only from the human-run close command. **No event is ever
derived from event data.** Kill-distance crossings, MRR transitions and cost roll-ups are all
computed at render by the ledger lib and rendered — never emitted.

The reason that carried the most weight: a derived event is indistinguishable from a recorded
one once it is on an append-only log, and a money brain whose inputs and conclusions are stored
in the same immutable stream can never afterwards prove which was which.

## Consequences

Easier: replay determinism is structural rather than maintained — `rm derived -> arc-replay ->
arc pnl` is byte-identical because there is nothing else it could be. Auditing a number means
reading the events that produced it, which is exactly what `--explain` (REQ-07) surfaces.

Harder: every render pays the full derivation cost, so render time is a live risk tracked in the
assumptions ledger (trigger: render >=5s on the owner's box -> sqlite accelerator path,
equivalence-gated). `arc pnl` may not memoise across invocations in v1.

If this goes wrong — renders become too slow to use — we add a derived cache **outside** the
spine, gated by a test that asserts cache and cold-render produce identical bytes, and this ADR
is superseded rather than quietly bent.
