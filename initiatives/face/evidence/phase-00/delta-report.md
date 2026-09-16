# Delta report — v0.7 (36 rooms) against the served registry (34 entries)

Phase 00, face v2 Cycle 16. Every figure below was produced by
`node .claude/scripts/hq/face-modules-contract.mjs` or computed from the contract it writes
(`initiatives/face/contracts/modules-v2.json`); none was typed from memory. The contract's
`--check` is in `tests/face-l3.bats`, so these figures cannot drift from their sources silently.

```
face-modules-contract: wrote initiatives/face/contracts/modules-v2.json -- 36 modules = 29 same-id
+ 3 renamed + 4 extra (3 served-planned) · 34 served, 2 without a module · 0 ring conflict(s)
```

## Renamed — the module takes the served id

Derived from v0.7's own `ROOM_ALIASES` (an alias key that is a served id), not from a hand list.

| served id (the module folder) | v0.7 id (kept as `alias`) | ring |
|---|---|---|
| `today` | `overview` | command |
| `engine-room` | `engine` | kernel |
| `council-chamber` | `council` | factory |

## Extra — v0.7 only, labelled, exempted by name (ADR-1327)

`factory` · `executor` · `agents` (factory ring) · `story` (company ring). Their exemptions land
with the factory and company ring PRs in Phase 03, unless the owner's §13 item 5 ruling gives one
a registry row instead.

## Served as planned — dotted, REHEARSAL (ADR-1328)

`ops` · `trader` · `discover` (money ring). v0.7's section 5.2 gives these three no reads at all —
they are the only modules that read nothing, which is consistent with a planned room.

## Served with no v0.7 room

| id | served status | ring | renders |
|---|---|---|---|
| `chat-mcp` | planned | command | generic module, reported — not counted in the 36 |
| `lane` | template | factory | not a room module (the lane-room template) |

## By ring

| ring | modules | ids (`*` extra · `†` served-planned · alias in brackets) |
|---|---|---|
| command | 6 | today (overview) · inbox · map · spine · board · ask-arc |
| kernel | 8 | engine-room (engine) · model-policy · policy · scheduler · memory · evolve · bench · absorb |
| factory | 8 | council-chamber (council) · develop · review-ship · design-studio · toolbelt · factory* · executor* · agents* |
| money | 8 | money · growth · leads · legal · ventures · ops† · trader† · discover† |
| company | 6 | law · learn · strategy · org · concepts · story* |

No ring disagrees between v0.7 and the served registry.

## Planned reads (PLAN-face-v2 section 5.2)

- **Served today and cited by a module: 10 routes** — `/api/brief` `/api/rooms` `/api/inbox`
  `/api/decide` `/api/file/:id` `/api/spine` `/api/board` `/api/lane/:id` `/api/ask` `/api/pnl`.
- **New routes the tables name: 19 distinct** — `/api/engine` `/api/model-policy` `/api/policy`
  `/api/jobs` `/api/memory` `/api/evolve` `/api/bench` `/api/absorb` `/api/council` `/api/slices`
  `/api/gates` `/api/design` `/api/roster` `/api/growth` `/api/leads` `/api/legal` `/api/ventures`
  `/api/learn` `/api/lanes`.
- **Correction:** PLAN-face-v2 section 5.2 states "17 new read routes"; its own tables name **19**
  distinct routes (`/api/roster` is shared by `executor` and `agents` and counted once). 19 is
  inside PLAN assumptions-ledger row 5's ±5 band. The figure Phase 04 builds against is still the
  union of Phase 03's five `NOT SERVED` lists, not this one.

## Throwing v1 rooms — the baseline that can only shrink

The Phase 00 exit criterion says a v1 room that throws is fixed only when the fix is one line, and
otherwise listed here by name; the browser suite's 0-exceptions assertion excludes exactly these
ids, and each id's Phase 03 module must empty it.

**Status: filled from the first CI run of `tests/face-browser.bats`.** Until that run exists this
list is not "empty" — it is unmeasured, and the suite does not yet exist to measure it.

| served id | configuration(s) | first exception line | disposition |
|---|---|---|---|

## Intake findings carried to later phases

- **Google Fonts at runtime** (Anybody, Inter, JetBrains Mono via `fonts.googleapis.com`) against
  the localhost / no-third-party rule (ADR-1312) → Phase 01.
- **The v0.4 collision table was written against v0.4's palette**; v0.7 retuned it → Phase 01
  re-checks each collision and recomputes every ratio.
- **The v0.7 harness is single-machine** (hardcoded Chrome path, Node's global `WebSocket`) → this
  phase ports it (ADR-1335).
- **29 of the 38 event kinds the flows assert do not exist in the spine** → Phase 05 binds them to
  real receipts or does not ship the op (ADR-1334).
