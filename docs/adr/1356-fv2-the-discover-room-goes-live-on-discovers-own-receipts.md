# ADR 1356 — FV2-X: the discover room goes live on discover's own receipts

**Status:** proposed 2026-10-07 (the discover lane's handoff `initiatives/discover/handoffs/face-discover-room.md`, pasted by the owner: "ithayum serthuka")
**Lane:** face (Cycle 16) · **REQ:** REQ-21 · **Phase:** 17
**Reversibility:** two-way
**Revisit trigger:** discover emits a receipt the room does not read (a new `step`, a new gate) and the room still says "nothing yet"; or the discover lane changes `PROCESS` / `WINNER_GATE` and the room keeps reading the old value.
**Bound by:** ADR-1328 (planned rooms stay dotted until the lane is born; amended here for discover only) · ADR-1914 (discover's four map rows move to the room in this PR) · ADR-1324 (no facts bundle: a module cites a door route) · ADR-0026 (closed spine kinds) · ADR-1354 (a failed source is `unknown`, never 0)

## Context

The discover lane was born on 2026-10-06 (ADR-1900, PR #343). The face still draws `money/discover` as a **planned** room: dotted, its hunt / score / shortlist flows marked REHEARSAL, its line read from `planned-rooms.json`. ADR-1328's revisit trigger names exactly this moment ("the lane is born → the module drops its REHEARSAL marking in the same change"). ADR-1914 kept the planned row only because the face module still read it, and handed the flip to the face lane.

Discover now writes real receipts: `idea.captured` (process `discover@x.y.z`, `payload.source_id`), `run.completed` (`payload.step` `hunt` or `judge`), `approval.requested` with `gate: discover-winner` (`slug`, `cluster_fp`, `cluster_tokens`, `score`), and the `decision.recorded` that decides it (`decides`, `verdict`, `reason`).

The general `GET /api/spine` reads one day, a page at a time, and filters by kind only. The room needs four kinds across every day, filtered by discover's process and gate.

## Options considered

- **A. A read-only door route, `GET /api/discover`, that imports discover's own constants (chosen).** The route lives in `lib/face/reads.mjs` beside `/api/leads` and `/api/legal` and follows their rule: the parser is the one the owning lane already uses. It reads through the spine reader, takes discover's `PROCESS` prefix and `WINNER_GATE` from `.claude/scripts/discover/lib/spine.mjs`, and returns one fold-ready payload. If discover renames its gate, the room follows without a face edit.
- **B. The fold reads `/api/spine?kind=…` four times.** No new route, but the fold would re-type discover's gate name and process prefix as string literals, page per day under `PAGE_CAP`, and miss a winner older than the window. That makes a second copy of discover's grammar inside face code.
- **C. Leave the planned room and wait.** The face shows discover twice (a live lane in the generic `lane` room, a dotted money room). That is honest today but stale, and ADR-1328 already says the planned room goes when the lane is born.

## Decision

1. `GET /api/discover`: `mutates: false`, `spineEffect: none`, no query keys. It returns `captures` (count, and the latest with `source_id` and day), `runs` (the latest `hunt` and the latest `judge`: when, receipt and outcome), and `winners` (each `discover-winner` request: `slug`, `score`, `cluster_tokens`, `cluster_fp`, and its state, which is `open`, or `approved` / `rejected` with the deciding receipt and reason). The only events it counts are the ones discover's own constants select. An unreadable spine day makes the route say `unknown` with the day named, never 0 (ADR-1354).
2. `money/discover` becomes a live room. It reads that route, drops `data-planned`, the dotted line and every REHEARSAL card, and when the spine holds no discover receipt it says "no hunt has run yet". `ops.mjs` stays empty: the room reads, and running a hunt stays `/arc-hunt` (no new op, no new spine kind).
3. In the same PR the contract moves. The `discover` row leaves `planned-rooms.json` and `plannedRooms.map`, `rooms.discover.status` becomes live, `products.discover`, `lanes.discover`, `adrs.1900` and `commands.arc-hunt` move from `lane` to `discover`, `face-sections.mjs` regenerates the manifest sections and `rooms.generated.json`, module-frame F3 pins the two rooms still planned (`ops`, `trader`), and discover-birth's two room tests flip from "the planned row stays" to "discover is served, not planned".
4. ADR-1328 holds for `ops` and `trader`, unchanged.

## Consequences

- One new read route on the door. It is GET-only, has no write path, and needs no key.
- If discover changes its receipt shape, the room changes in step. A mutant that re-types the gate as a literal, or that counts a face `idea.captured` (no `discover` process) as a discover capture, FAILs.
- Two of discover's bats tests change in a face PR, as the handoff asked. Their count stays 9.
- Phase 17 runs after Phase 16, so the room is built on Phase 15's `Availability` enum and needs no rework.
