# ADR 0705 — MEM-F: contradicting rules are surfaced to a human at write time; semantic contradiction detection is explicitly out of scope

**Status:** accepted
**Date:** 2026-08-11
**Product:** `memory`
**Reversibility:** two-way
**Revisit trigger:** the write-time check fires on more than ~1 in 3 real `/arc-retro` appends
without a genuine near-duplicate among them → T is too low and gets retuned, recorded in the
same file as the misses that drove it.

## Context

53 retro rows, 120 distinct tags, and a corpus that grows every cycle. Two rows that say
opposing things is a real prospect, and the recorded cost of contradiction is already on file:
2026-08-02, `arc-portfolio` — *rewriting three sections of a doc left the SAME file contradicting
itself*, and none of the agents that wrote the new sections could see it.

The tempting design is a read-time contradiction detector. The problem is that a lexical
overlap check cannot read meaning: "always run the pass at close" and "never run the pass at
close" have near-identical tokens and opposite content, while two genuinely conflicting rules
may share almost no vocabulary. A gate that claims to detect contradiction but actually detects
token overlap is a gate that **passes on blindness** — precisely the failure class ADR-0049
named when it required a quality gate to be able to fail for insufficiency.

## Options considered

1. **Read-time semantic contradiction detection** — pros: catches conflicts whenever anyone
   looks. Cons: cannot be done lexically, and doing it with an LLM makes the index
   non-deterministic and the result unfalsifiable. Would be theatre.
2. **Write-time near-duplicate surfacing, human decides** — chosen. Pros: catches the conflict at
   the moment of authorship, when the author has the context to merge or justify; deterministic;
   honest about what it detects. Cons: only catches conflicts among *similar-looking* rows, and
   only at the pen.

## Decision

The check runs at **write time**, in `/arc-retro`, before a new row is appended.
`.claude/commands/arc-retro.md` is hand-written and directly editable, so this needs no engine
regeneration.

Detection is **lexical only**, and says so:

- **≥ 2 shared tags** (already locked in the design source), **AND**
- **token overlap ≥ T**, where **T = 0.5** on normalized prevention text.

T = 0.5 was an open MEM-L value; it is a sensitivity dial, changeable any day without touching
architecture, and it has a falsification trigger above.

On a hit, the candidate pairs are **shown** to the author, who proceeds or merges **on the
record**. Nothing is ever auto-resolved, auto-merged, or blocked.

`--pairs` (read-time listing of near-duplicate pairs) is a **secondary** surface, and is the
first thing cut inside REQ-05 if time is short.

**Semantic contradiction detection is declared out of scope**, in writing, so that a later cycle
cannot quietly claim this check does something it cannot do.

**Confidence:** medium — the mechanism is certain, the value of T is a first guess with a
retune trigger attached.

## Consequences

- **Easier:** prevention at the pen beats detection at read. The author is the one person who
  knows whether two similar rows are the same rule.
- **Harder:** conflicts between rows that share little vocabulary are **not** caught, by
  construction. That limit is stated rather than hidden.
- REQ-05 is the **designated first cut** in this cycle's cut order, so this ADR may describe a
  capability that ships next cycle. The decision stands either way; only its timing is at risk.
