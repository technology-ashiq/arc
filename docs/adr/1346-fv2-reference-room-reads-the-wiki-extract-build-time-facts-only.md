# ADR 1346 — The Reference room: the face reads the wiki's own extract, build-time facts only

**Status:** accepted (pending the owner's OK on the `/arc-change` of 2026-09-26)
**Date:** 2026-09-26
**Product:** face (reads from docs; no change in the docs lane)
**Reversibility:** two-way
**Revisit trigger:** the Reference room shows a fact that `docs/wiki/` does not (or the reverse) for the same tree.
The one-extract rule below is then broken somewhere, and the fix is to delete the second path, never to reconcile it.

## Context

The docs lane (Cycle 17, closed 2026-09-26) generates `docs/wiki/` from the tree with
`.claude/scripts/docs/wiki-build.mjs`: 133 entities across products, lanes, processes, ADR bands, commands, agents,
rules and gates. It reads the tree only through face-coverage's `treeWorld` (ADR-1501), so the wiki and the face's
completeness gate cannot disagree about what exists. `wiki-build --json` prints the extract (`wiki.json`, schema 1),
and the module exports `extract()`, `renderWiki()`, `PAGE_DIRS`, `TYPE_KEY` and `pagePath()`.

The owner asked for that wiki inside the face: a Reference room, and a Reference link from every room to its entity's
page. The design is the owner's own (`arc-wiki-engine_1.html`: Start here · The bigger loop · Reference · Evidence ·
Meta), which fits the no-redesign rule (ADR-1318). Three docs-lane rules bind any reader: DOC-I / ADR-1509 (the wiki
is build-time facts only), DOC-D / ADR-1504 (nothing hand-edits `docs/wiki/**`), and ADR-1508 (narrative is hand-written
or owner-accepted, and the first line is a fingerprint comment).

## Decision

1. **One extract, imported.** The door's read route (`GET /api/reference`) calls wiki-build's exported `extract()`
   over the same `treeWorld`. The client renders pages with `pagePath()` / `PAGE_DIRS` / `TYPE_KEY` semantics taken
   from that response. Nothing in `face/` or the door walks the tree, re-derives an entity or hand-spells a type list.
   A second walker is the failure this ADR exists to prevent.
2. **Build-time facts only (ADR-1509).** The route's response is the extract and the owner-accepted narrative. Nothing
   else: no spine read, nothing under `.claude/state/`, no live counts. Live numbers stay in the live rooms. A fixture
   plants a spine event and a state file and proves neither reaches the response.
3. **Read-only (ADR-1504).** The route is GET and writes nothing. The room has no verb and no dock. `docs/wiki/**` is
   never written by the face.
4. **Narrative is shown only when it exists and is owner-accepted.** "Start here" and "The bigger loop" render
   `docs/wiki/_narrative/<dir>/<id>.md`, with the first-line fingerprint stripped the way `renderWiki()` strips it.
   Where no narrative file exists, the section reads **"narrative pending"** and is never generated in the room.
5. **The room is born by the face's own birth rule (ADR-1306).** That means a contract row in `expected-set.json` and
   `rooms.generated.json` written by `face-sections.mjs` (canonical JSON: parse, mutate, stringify), plus a module
   under `face/src/modules/`. It is a module room outside REQ-01's 36, which are v0.7's design inventory. REQ-12 owns it.
6. **Per-room links come from the existing map.** Each room's Reference link is derived from `expected-set.json`'s
   `products.map` (product -> room) and the lane rooms (lane -> the lane template). A room with no wiki entity shows no
   link. The count of rooms with and without a link is asserted in a test, so a missing link is a number, not a silence.

## Consequences

- The face's third door family gains one read route (`/api/reference`) on the Phase 04 allow-list pattern: read-only,
  allow-listed, parsers imported.
- A docs-lane change to `extract()`'s shape reaches the room on the next door start with no face change, because the
  room renders what the extract returns. The schema number (`schema: 1`) is asserted, and a new schema fails the room
  loudly, never partially.
- The wiki's CI gates (`--check`, wiki-coverage, audit-counts, wiki-drift) stay the docs lane's. The face adds
  none, and they are not weakened.

## Related

ADR-1306 (the room birth rule) · ADR-1318 (the owner's design) · ADR-1501 (treeWorld) · ADR-1504 · ADR-1508 ·
ADR-1509 · REQ-12 · `initiatives/face/phases/phase-07-spec.md`.
