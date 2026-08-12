# ADR 0217 — EXE-J: a hire is a receipt, and the row cites the decision that made it

**Status:** accepted
**Date:** 2026-08-12
**Product:** `engine` — Cycle 7, executor v1
**Reversibility:** two-way
**Revisit trigger:** a runtime row is found in `router.yaml` whose cited decision ULID resolves to nothing on the spine — the citation has become decoration and needs a lint rather than a convention.

Decided under the owner's **Build-out Mandate (2026-08-09)**.

## Context

Constitution E1: every action that matters emits an event, and a claim without a receipt is an
opinion. Hiring a contractor that will hold a credential, read approved company data and produce work
in arc's name is an action that matters.

The failure this prevents is quiet: a routing row appears in a diff, gets reviewed for syntax, and
nobody can later say who decided it or why. Six months on, the row is load-bearing and its
justification exists only in a session transcript nobody kept.

## Options considered

1. **The reviewed diff is the record.** Git already has the author and date; no new machinery. But a
   diff records *that* it changed, never the decision it implements, and git history is not the
   spine.
2. **A new `hire.recorded` event kind.** Precise; extends a closed vocabulary for one use, which
   ADR-0026 requires an ADR for and which this cycle has a standing no-go against.
3. **Existing kinds plus a citation in the row.**

## Decision

**Option 3, with zero new event kinds.** Adding or removing a runtime row flows
`approval.requested` → `decision.recorded`, both already in the closed vocabulary (verified live:
44 kinds, both present).

The row's own comment **cites two ULIDs**: the **Build-out Mandate** decision that authorised this
cycle, and the **hire** decision that authorised this row. Two, not one, because they answer different
questions — why arc is building executors at all, and why *this* runtime. Reading the row alone tells
you both.

**Runtimes take no `models:` entry** in `router.yaml`. That block maps tier to a concrete model per
driver, and a runtime chooses its own model; an entry there would assert a routing decision nothing
applies — the exact defect the file's own header records from C6, where `model: tier:X` claimed
something no call had implemented. A runtime pins per ADR-0209 or runs recorded-as-unpinned.

**Confidence:** high.

## Consequences

**Easier.** "Why is this here?" is answerable from the file, offline, without a git archaeology
session. Removal is symmetrical with addition, so retiring a contractor produces the same quality of
record as hiring one.

**Harder.** A ULID in a comment is unverified text until something checks it — this ADR's own revisit
trigger. And the mandate ULID does not exist until Phase 04 emits it, so the row cannot be written
before the mandate is on the spine; that ordering is a Phase-04-before-Phase-07 dependency rather than
a nicety.
