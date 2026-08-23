# ADR 1301 — FACE-B: three layers — L1 truth · L2 one read door + one decision door · L3 face

**Status:** accepted
**Date:** 2026-08-19
**Product:** face
**Reversibility:** one-way
**Revisit trigger:** a hosted multi-tenant L2 cycle opens (FACE-O / ADR-1314), or a
sanctioned file-history source appears (assumptions ledger row 7) — either reopens the
layer contract by new ADR, never by drift.

## Context

arc's truth is one append-only spine with a closed vocabulary (E1, ADR-0026) read through
one public API (SPINE-G / ADR-0030), plus sanctioned tracker files parsed by the lints.
The face must not become a second truth (A5). ADR-0027 already ruled the dashboard is
*another consumer of the SAME reader API*.

## Options considered

1. **Three layers, parsers imported from the lints** — L1 stays untouched; L2 is the only
   process that reads files; L3 only speaks HTTP to L2. Pros: reader-only lint extends to
   L2; no re-implementation drift. Cons: every file-borne panel needs its parser exported.
2. **L3 reads files directly where convenient** — pros: fewer endpoints. Cons: N readers,
   N parsers, replay breaks, reader-only law unenforceable.

## Decision

Option 1. **L1 truth** (spine JSONL + sanctioned files) is read by **L2 `arc dash`** only,
through `spine.mjs` and through the *same parsers the lints use* (`board-lint`,
`kickoff-lint`, `council-lint`, `policy-lint`, `jobs-lint`) — imported, never
re-implemented. A **spine-health** function (quarantine counts by refusal code, idem-index
size, torn lines) is added to `spine.mjs` itself in Phase 03 **via `/arc-change`**, so no
consumer ever opens `_quarantine/` or `derived/`. `/api/file/:id` serves ONLY an
allow-listed set of sanctioned ids. **L3 never touches files** — a grep-lint (WARN-first,
per the trial-ledger rule) forbids `events/`, `state.db` and file reads in L3. As-of
applies to spine-derived views; file-borne panels show the *current file* with a visible
"file, not log" badge.

## Consequences

Easier: replay determinism holds for the whole UI; one place to secure; chat-mcp later
mounts the same L2. Harder: every sanctioned file the face wants needs its parser exported
from the lint that owns it — that export is arc-side work in this lane's phases.
