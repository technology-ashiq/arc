# ADR 1337 — `story` and `factory` earn a registry row; `executor` and `agents` stay labelled exemptions

**Status:** accepted
**Date:** 2026-09-18
**Product:** face
**Reversibility:** two-way
**Revisit trigger:** either room's registry row is ever read by nothing but its own module (no `face-coverage` inventory, no map station, no board count) for a whole cycle → the row is ceremony, and the room goes back to a labelled exemption under ADR-1327 in the change that deletes the row.
**Provenance:** the owner's ruling on PLAN-face-v2 §13 item 5, asked before the company ring as PROGRESS required, 2026-09-18: "Both registry row". Supersedes ADR-1327 for `story` and `factory` only, exactly as ADR-1327's own revisit trigger foresaw.

## Context

ADR-1327 kept the four v0.7-only rooms (`factory`, `executor`, `agents`, `story`) as modules with a
not-in-registry badge, each exempted by name in `face-coverage`, and named the one ruling that could change
that: §13 item 5, whether `story` and `factory` earn a registry row instead. The ruling gated Phase 03's
36/36 and Phase 05, so none of the four extra rooms was built before it.

## Options considered

1. **Both earn a row** — the served registry (`expected-set.json` → `rooms.generated.json`) lists them like
   every other room: a ring, a sentence, a lede, what each holds. The door serves them, the map draws them,
   `/api/rooms` counts them, and their modules take the served id with no badge.
2. **Both stay exempt** (ADR-1327's default) — labelled extras, by-name exemptions.
3. **One of each.**

## Decision

Option 1, the owner's ruling. `story` (company ring) and `factory` (factory ring) get registry rows in the
same change that deletes their two exemptions from `face-coverage`. `executor` and `agents` were not in the
question and stay ADR-1327 exemptions, so the exemption list names exactly two rooms, and a third unnamed one
still FAILs.

## Consequences

- Served rooms go from 34 to 36 and openable rooms from 33 to 35; PLAN-face-v2 §4's table reads
  29 + 2 (v0.7 id = served id, now 31) + 3 renamed + 2 extra = 36 modules, the count unchanged.
- The contract is regenerated from its sources, never typed: `face-sections.mjs` writes the registry and
  every product manifest's `face:` section, and `face-modules-contract.mjs` re-derives `modules-v2.json`
  with both rooms as `served`. The sync-golden manifest moves with the manifests it hashes.
- Every count pinned against 34/33 moves in the same change, each named in the PR, so none drifts silently.
- Neither room's truth is invented to fill its row: `story` reads the cycles from `docs/HISTORY.md` through
  `/api/file/history`, and `factory` reads the lanes and the phase each is on through the door; what the
  door does not serve renders NOT SERVED (ADR-1324).

## How the two exemptions are drawn (recorded at the Phase 03 close, 2026-09-18)

The Phase 03 spec-fidelity pass found this decision's mechanism unrecorded, so it is recorded here:

- The shell draws the rooms arc does not serve from `initiatives/face/contracts/module-exemptions.json`, which
  the door now serves on its allow-list as `/api/file/module-exemptions` -- an allow-list row, not a new route.
  The registry has nothing for these rooms, so each exemption row also carries the facts the shell draws the room
  from: its `name`, `ring`, `sentence` and `lede`. `face-coverage` holds those fields (the ring must be the ring
  the module lives in; the name and sentence must be visible text), and the shell draws an extra only where its
  module lives, so the gate and the browser answer the question the same way.
- The room list the shell draws is therefore two sources in one fixed order: the served registry, then the
  exempted extras. A row naming a room the registry serves never replaces it.
