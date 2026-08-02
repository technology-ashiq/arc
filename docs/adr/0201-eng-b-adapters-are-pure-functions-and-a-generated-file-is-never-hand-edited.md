# ADR 0201 — ENG-B: adapters are pure functions, and a generated file is never hand-edited

**Status:** accepted
**Date:** 2026-08-03
**Product:** `engine` — lane `engine`, ADR band 0200–0299
**Reversibility:** two-way
**Revisit trigger:** the DO-NOT-EDIT lint fires on a hand-edit that turns out to have been the
right thing to do — i.e. the canonical file could not express the change. That is the signal the
format is under-powered, not that the author was careless.

**Locked upstream.** ENG-B from `docs/strategy/plans/PLAN-engine-process-layer.md`.

## Context

Once a canonical process file generates `.claude/commands/arc-commit.md`, that markdown file
becomes an *output*. Nothing prevents a future session from editing the output directly — it
looks exactly like the hand-written file it replaced, and it is the file that is actually loaded
at run time, so editing it *works*. The change then survives until the next regeneration silently
deletes it.

This is not hypothetical drift. All three pilot files sit in `tests/fixtures/sync-golden/tree-manifest.txt`
(lines 32, 41, 47) under a SHA256 byte-identity gate, and retro-log 2026-07-22 records that
gate breaking across ten separate commits because content edits to product-shipped files move
their hash — surfacing as surprise mid-task failures rather than planned steps.

## Options considered

1. **Header comment only** — pros: free. Cons: a comment is documentation, and retro-log
   2026-08-02 is explicit that a stated control is not a control until something asserts it.
2. **Header + lint, WARN-first** — pros: a real check with a real failure mode, promoted on
   evidence. Cons: a WARN can be scrolled past.
3. **Header + lint, BLOCK from day one** — pros: no scrolling past it. Cons: violates arc's
   WARN-first promotion rule (`docs/trial-ledger.md`) — a gate goes FAIL-capable on fixture
   evidence plus ≥3 clean dogfood runs, not on the author's confidence in it.

## Decision

**An adapter is a pure function `canonical → dialect text`.** Same input, same output, on every
platform: no clock, no randomness, no environment reads, no filesystem access of its own. The
compiler reads and writes files; the adapter transforms strings. This is what makes the
byte-diff of REQ-02 a meaningful measurement rather than a coincidence.

**Every generated file carries a DO-NOT-EDIT header** naming the canonical source and the
command that regenerates it, and a hand-edit to a generated file is a **lint failure, WARN-first**,
promoted per `docs/trial-ledger.md`.

**The header lands only after the byte-identical proof, never before.** REQ-02 measures
regeneration against the *current hand-written* files, which have no header. Adding the header
is therefore a deliberate, separate step in Phase 1 that moves three hashes in
`tree-manifest.txt` — diffed first, only the three intended paths confirmed moved, then
re-recorded and named in its own commit (retro-log 2026-07-22). Emitting the header before the
proof would make the proof unachievable by construction.

Detection of a hand-edit is by **content hash recorded next to the generated file**, not by
reading the header — a hand-edit that also deletes the header must still be caught, and a check
that trusts the marker it is policing catches only honest mistakes.

**Confidence:** high

## Consequences

**Easier.** Regeneration is safe: nothing of value can be sitting only in the output. Reviewing a
dialect change means reviewing a diff of the adapter, once, instead of the same edit in N files.

**Harder.** The loop "edit the command file, try it, iterate" — the fastest way to work on an arc
command today — becomes "edit the canonical file, recompile, try it". That is real friction on
the 3 pilots, and it is why the other 21 commands stay hand-written this cycle.

**What we'd revisit if this goes wrong.** If the lint fires repeatedly on edits that were
correct, the finding is about the canonical format's expressiveness (ADR 0200), and the
revisit trigger above routes it there rather than weakening this check.
