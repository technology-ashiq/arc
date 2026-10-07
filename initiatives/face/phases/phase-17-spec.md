# Phase 17 — The discover room goes live: discover's own receipts, read through the door

**Goal (one line):** REQ-21 — `money/discover` stops being a planned room. It reads discover's real receipts through one read-only door route, `GET /api/discover`, and the face contract moves discover from the planned list to a served room in the same PR.
**Appetite:** 1.5 days ((a) the route 0.5d · (b) the room 0.5d · (c) the contract move, F3 and discover-birth 0.5d)
**Depends on:** phase-16 (the room is born on Phase 15's `Availability` enum; 16 closes first so the order 14 → 15 → 16 holds)
**Serves:** REQ-21
**Branch:** `feat/face-v2-17-discover-room`
**Preconditions (STOP if absent):** Phase 16's close is merged; the owner accepted ADR-1356; `git log origin/main -5 -- .claude/scripts/discover/lib/spine.mjs tests/discover-birth.bats initiatives/face/contracts/planned-rooms.json` was read before the first edit (discover owns two of those files).

Why it exists (the discover lane's handoff `initiatives/discover/handoffs/face-discover-room.md`, pasted by the owner on 2026-10-07: "ithayum serthuka"): the discover lane was born on 2026-10-06 (ADR-1900, PR #343) and already writes real receipts, but the face still draws its money room dotted, with REHEARSAL cards and a line from `planned-rooms.json`. ADR-1328's revisit trigger has fired for discover, and ADR-1914 handed the flip to the face lane.

## Exit criteria (Definition of Done)

- [ ] **(a) The route:** `GET /api/discover` (`mutates: false`, `spineEffect: none`, no query keys, an unknown key refused) returns `captures`, `runs` and `winners` as ADR-1356 item 1 lists them. It selects events only through discover's own `PROCESS` prefix and `WINNER_GATE`, imported from `.claude/scripts/discover/lib/spine.mjs`. No `discover-winner` or `discover@` literal appears under `face/` or in `lib/face/reads.mjs`.
- [ ] **(a) Honest edges:** an empty spine returns zero counts marked served; an unreadable spine day returns `unknown` naming the day, never 0; a face `idea.captured` (no `discover` process) is not counted as a discover capture; a winner decided twice is impossible (`decision.recorded` refuses it), and a winner with no decision reads `open`.
- [ ] **(b) The room:** `money/discover` reads the route. It has no `data-planned`, no dotted line and no REHEARSAL card. The KPIs show ideas captured, the last hunt, the last judge and the open winners. The list shows each `discover-winner` request (`slug`, `score`, its tokens, its state and, when decided, the verdict and reason). A spine with no discover receipt reads "no hunt has run yet". `fold.mjs` decides everything and `View.tsx` draws it; `ops.mjs` stays empty.
- [ ] **(c) The contract:** the `discover` row leaves `planned-rooms.json` and `expected-set.json` `plannedRooms.map`; `rooms.discover.status` is live; `products.discover`, `lanes.discover`, `adrs.1900` and `commands.arc-hunt` map to `discover`; `face-sections.mjs` is re-run and `rooms.generated.json` committed; `face-coverage` is green.
- [ ] **(c) The pins:** module-frame F3 pins exactly the two rooms still planned (`ops`, `trader`) and FAILs on a mutant that puts `discover` back in the planned registry; discover-birth's two room tests flip to "discover is served, not planned" and "the check goes red on a copy that re-adds the planned row"; its declared count stays 9.
- [ ] **Mutants FAIL from birth:** a route that re-types the gate literal; a route that counts a non-discover `idea.captured`; a route that turns an unreadable day into 0; a room that still wears `data-planned`.
- [ ] Two fresh attackers (logic · shell) through `/arc-attack`, one round; the wiki and the sync golden regenerated in the same PR; CI green per job; the owner reads the room live from the main clone (`evidence/phase-17/owner-demo.md`); `/arc-phase-done 17` from the main clone.

## Verification plan

Tests run on CI only, read per job; each fixture asserts it RAN before asserting what it printed. One PR, one attack round, one push.

| Exit criterion | Check | Evidence | Who |
|---|---|---|---|
| Route | a door test against a sandbox spine holding one capture, one hunt, one judge, one open and one rejected winner returns each, with the right state | CI per job | CI |
| Honest edges | sandbox with an unreadable day → `unknown` naming it; a face `idea.captured` → not counted | CI per job | CI |
| No second grammar | grep for the gate and process literals under `face/` and `reads.mjs` finds none | CI per job | CI |
| Room | L3 fold test over the same payload: KPIs and winners drawn, no planned markers; the smoke opens the room in both moods with 0 errors | CI per job | CI |
| Contract | `face-coverage` and `face-sections --check` green; F3 and discover-birth flipped with their mutants | CI per job | CI |
| Owner read | the owner opens Money → Discover in the main clone and says what he sees | `owner-demo.md` | owner |

- **Expected failure first:** F3 still pins `discover` as planned, and discover-birth still asserts the planned row, so both go red the moment the row leaves; the route test is red until the route exists.

## Rabbit holes in this phase
- **A hunt button in the room.** Running a hunt stays `/arc-hunt`; an op would need its own no-second-path fixture and is a separate `/arc-change`.
- **Drawing the council's debate.** The room shows the winner request and its decision; `council.verdict` threads stay in the council room.
- **Converting `ops` or `trader`.** Their lanes are not born; ADR-1328 holds for them.

## Out of scope in this phase
A new spine kind · a write op · any edit to discover's scripts (`.claude/scripts/discover/**`) beyond importing its constants · editing `.github/` workflows.

## Your-setup / pending
The acceptance of ADR-1356, and the owner's live read of the room.

## Non-negotiables (verbatim from PLAN)

<!-- Generated from PLAN.md at kickoff; resynced by /arc-change. Never hand-edited. -->

- The served registry is the only room list: modules attach to served ids, orphans are checked both ways, and the four extra rooms are exempted by name only (ADR-1306, ADR-1321, ADR-1327).
- Tokens have one source, `docs/design/system/tokens.css`; `face/src/tokens.css` is generated and never hand-edited, as `.claude/scripts/core/face-tokens.mjs --check` enforces; no colour literal under `face/src/modules/**`; council renders `--accent-dim` and violet is the non-real family alone (ADR-1308, ADR-1322).
- Every decision lives in a `.mjs` that node imports with no install: `fold.mjs` imports nothing from React, Vite or three, `View.tsx` carries no branch worth asserting, and Tailwind stops at L3 (ADR-1320, ADR-1323).
- `POST /api/decide` stays byte-parity with `arc-inbox`: the parity fixture is green on every PR of this cycle and is a Phase 05 exit criterion (ADR-1302, ADR-1333).
- Zero new spine kinds: every op emits a kind already in `validate.mjs` KINDS, and an op that would need a new one does not ship (ADR-0026, ADR-1334).
- Branch-only writes: a file-touching op writes to a `feat/face-*` branch, shows the diff and stops; `main` is untouchable and merge never exists in the face (ADR-1326).
- The WORK door has no logic of its own: each op shells the same script a hand-run calls, proven per op by a no-second-path fixture; an op without a green fixture ships read-only with an honest badge (ADR-1326).
- The SESSION door starts `arc-run --driver …`, never a harness binary (ADR-1326).
- No provider key in the browser; Ask keeps zero write tools and `ASK_ACTIONS` = `open_room` · `set_speed` · `enter_hq` (ADR-1325).
- No facts bundle under `face/src/**`: a module cites a door route or renders `NOT SERVED` (ADR-1324).
- No new surface outside `.claude/scripts/` this cycle; the layout move belongs to the distribute lane, in one atomic PR (ADR-1319).
- Real vs simulated / rehearsal / planned are never mixed or summed; planned rooms render dotted and every write inside them says REHEARSAL (ADR-1313, ADR-1328).
- Both moods ship together from Phase 01; light is never deferred to a later batch (ADR-1331).
- The reference is the target: v0.7 is the canonical design and the ported harness's frozen strings are the bar (ADR-1318, ADR-1330).
- REQ-10 claims the surface is operable over two real days and never claims the habit holds (ADR-1329).
- Localhost + token; no PII in git, the door or the intake; escaped serializer (ADR-1312).
- Zero product-code writes before explicit owner approval of this plan; each phase lands as its own feat branch + PR, and a phase closes through `/arc-phase-done` from the main clone before the next phase's branch opens (ADR-1332).
- Tests green on CI per job, never run on this box; the browser harness runs on every leg with Node ≥20.19 and Node 18 is a named, counted skip; structural face lints (`face-pure`, colour-literal, facts-bundle) FAIL from birth, heuristic arms start WARN-first; two fresh attackers per new gate (decision logic + shell/OS boundary) carrying the lane's fixed-defect list; assert it RAN before asserting what it printed (ADR-1335, ADR-1336).
