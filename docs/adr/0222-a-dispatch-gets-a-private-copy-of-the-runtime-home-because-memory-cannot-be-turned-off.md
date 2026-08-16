# ADR 0222 — a dispatch gets a private copy of the runtime home, because the runtime's memory cannot be turned off

**Status:** accepted
**Date:** 2026-08-17
**Product:** `engine` — Cycle 7, executor v1. Closes Phase 06 fixture 8 and a REQ-06 hole it exposed.
**Reversibility:** two-way
The template stays on disk untouched; reverting means pointing `ARC_HERMES_DATA` back at it directly, which is today's behaviour.
**Revisit trigger:** the vendor ships a supported way to disable built-in memory, or the template copy stops being cheap relative to a cold boot (re-measure; today it is 2.2s against 145–400s+).

Routed via `/arc-change --lane engine` on 2026-08-17.

## Context

Phase 06 fixture 8 requires *"a marker planted in run N is unrecallable in run N+1, proving
persistent memory OFF (ADR-0211)"*. It fails, measured:

A marker planted in run N was found on disk in the mounted volume, in `memories/MEMORY.md` and in
`state.db`. Run N answered *"I've saved the marker as a memory. I can recall it later if needed."*
Run N+1's stdout did **not** contain it — so the obvious assertion ("run N+1's output lacks the
marker") would have recorded a **PASS on a false property**. The assertion has to be *the volume does
not contain the marker*.

**It cannot be configured off, and the vendor says so.** `hermes memory --help` on the pinned image:

```
Set up and manage external memory provider plugins. ... Built-in memory
(MEMORY.md/USER.md) is ALWAYS ACTIVE.
    off     Disable external provider (built-in only)
    reset   Erase all built-in memory (MEMORY.md and USER.md)
```

`memory off` disables an *external* provider and leaves the built-in one running. So this is not a
runtime setting arc failed to set — it is a property of the runtime, and the only lever arc holds is
**what it mounts**.

**It is wider than fixture 8, and that is the real reason this needs a decision.** REQ-06 confines
what enters a dispatch: an owner-approved `external-ok` context pack, with `internal-only` refused
above the driver at arc-run exit 5. That confinement assumes **the dispatch is the unit**. It is not,
while the runtime writes memories into a volume the next dispatch mounts: content from pack A reaches
dispatch B **without ever travelling as a pack**, so the boundary check never sees it. Strictly worse
than the carry-over path assumption A-06 already worries about, because that one at least goes
through the pack.

## Options considered, with measurements rather than intuitions

| | Closes it? | Measured cost |
|---|---|---|
| 1. **A fresh empty volume per dispatch** | yes, completely | a full cold boot every time: **145s–400s+**, against 32–80s warm |
| 2. **A warm template copied per dispatch** | yes, completely | **2,235 ms** to copy 36 MB / 1,171 files |
| 3. **Wipe the memory surface between dispatches** | only if the wipe list is complete | ~0 ms, and the list is the problem |

Option 3 is the cheapest and the least trustworthy. The marker turned up in **`state.db`** as well as
`memories/MEMORY.md`, so the surface is already wider than the two files the vendor names, and a wipe
list one file short reads **GREEN while carrying data across**. That is a guard that cannot fail, and
this cycle has recorded four of those already.

Option 1 is correct and costs a cold boot per dispatch — which lands directly on REQ-05's class
budgets, since those are derived from calibration receipts.

## Decision

**Option 2.** Each dispatch runs against a **private copy of a warm template**, made immediately
before the container starts and removed after it exits.

1. **`ARC_HERMES_DATA` becomes the TEMPLATE, not the workspace.** It is read, never mounted. The
   container mounts a per-dispatch copy.
2. **The copy is made fresh for every dispatch and deleted after.** Two dispatches can therefore
   never share a memory file, a session, or a `state.db` — regardless of which of the volume's 20+
   directories the runtime decides to persist into next. This is the property fixture 8 asserts, and
   it holds without arc needing to know the runtime's storage layout, which is the whole point:
   **option 3 requires that knowledge and option 2 does not.**
3. **Fixture 8's assertion is on the VOLUME, never on the answer.** A test that asks run N+1 whether
   it remembers is asking the model, and a model that simply did not mention the marker passes it.
4. **The template is never written to.** If a dispatch could mutate the template, run N's memories
   would reach run N+1 through the template itself and this ADR would buy nothing.
5. **When copying fails, the dispatch FAILS.** It does not fall back to mounting the template
   directly. A fallback there is unconfined execution wearing the appearance of a control — the same
   shape the egress work refused one commit earlier.

**2.2 seconds against a 145–400s cold boot is a hundred-fold difference**, so the honest cheap option
and the honest safe option are the same one. That is worth stating because it is unusual; where they
diverge, this plan takes the safe one.

## Consequences

- `ARC_HERMES_DATA` changes meaning. The env contract and `.env.example` say so explicitly, because
  a variable that silently becomes a template is a variable an operator will keep treating as a
  workspace.
- Disk: one 36 MB copy per concurrent dispatch, transient. Not per dispatch cumulatively — it is
  removed on exit, including the failure paths, which the usage-report cleanup did **not** do and had
  to be corrected for.
- **The template still needs seeding once**, and that first boot is the cold one. Phase 08 pays it
  once rather than per run.
- **Fixture 8 flips from FAIL to PASS on a property that is actually true**, rather than by being
  asserted more loosely.
- The REQ-06 hole closes for the volume path specifically. The carry-over path A-06 names — accepted
  drafts riding a later pack — is a **different** route and is not closed by this ADR.

**Evidence:** `initiatives/engine/evidence/phase-06/fixture-08-memory.md` (the planted marker, both
on-disk locations, the vendor's always-active quote) · copy cost measured 2026-08-17 at 2,235 ms for
36 MB / 1,171 files · cold boot 145s and 400s+, warm 32s and 80s, measured 2026-08-16.

**Confidence:** high on the mechanism (a private copy cannot share state by construction, and needs
no knowledge of the runtime's storage layout) · high on the cost (measured, not estimated) · the
copy's behaviour under **concurrent** dispatches is unproven, and the per-dispatch directory name
must therefore be collision-proof rather than `pid + ms`, which an adversarial pass already flagged
as too weak for exactly this reason.
