# ADR 1914 — discover's product, lane, ADR band and command map to the generic `lane` room

**Status:** accepted
**Date:** 2026-10-06
**Product:** `discover`
**Reversibility:** two-way
**Revisit trigger:** face builds a `money/discover` room module (a face-lane change); the four map rows move to it in that PR.

## Context

The Phase 00 spec drafted the manifest's face section as room `discover`, ring `money`. Building it showed that `discover` exists in the face contract only as a **planned** room (`plannedRooms.map`), not a served one. The manifest's `face:` section is written by `face-sections.mjs` from `expected-set.json`, never by hand. A product mapped to a room that is not served fails `face-coverage`. launch, born three days earlier, maps product, lane, ADR band and lint to the generic `lane` room.

## Options considered

1. **Build a `discover` room now.** It matches the planned row, but it is face-lane UI work, and the PLAN's no-gos forbid UI beyond the manifest.
2. **Map to `lane`, as launch did, and retire the planned row.** The face shows discover as a live lane today.

## Decision

Option 2. `expected-set.json` gains `products.discover`, `lanes.discover`, `adrs.1900` and `commands.arc-hunt`, all set to `lane`. `face-sections.mjs` regenerates the manifest's face section.

**Amended 2026-10-06 (birth PR #343 CI):** the `discover` planned room is NOT retired. `face/src/modules/money/discover/` already exists as a planned-room module that reads its line from `planned-rooms.json`, and `tests/face/module-frame.mjs` F3 pins that read, so retiring the row broke two face-l3 tests on CI. That module is face-lane code. The planned row and `plannedRooms.map.discover` stay until the face lane converts the module to read discover's live receipts. The handoff is `initiatives/discover/handoffs/face-discover-room.md`.

## Consequences

REQ-10 is met by the generic `lane` room plus the existing planned money room. Flipping the money room solid is a face-lane `/arc-change` (handoff above), never a discover edit to face code.
