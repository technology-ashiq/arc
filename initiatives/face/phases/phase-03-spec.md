# Phase 03 — The 36 modules, read-side, in five ring PRs

**Goal (one line):** REQ-01 + REQ-05 — all 36 v0.7 modules render in both moods from what the door serves, and every gap is a named `NOT SERVED` entry instead of a bundled fact (ADR-1324).
**Appetite:** 1.5 days spent of 7 days allotted (command 1d · kernel 2d · factory 1.5d · money 1.5d · company 1d), the rest banked forward (ADR-1339)
**Depends on:** phase-02
**Serves:** REQ-01, REQ-05
**Branches:** `feat/face-v2-03-command` · `-kernel` · `-factory` · `-money` · `-company` — one PR each, in that order.
**Preconditions (STOP if absent):** Phase 02's PROGRESS row reads ✅ CLOSED via `/arc-phase-done 02` from the main clone.

## Exit criteria (Definition of Done)

**Per ring PR**
- [ ] Every module in the ring is four files (ADR-1320) and green on `face-pure` + `face-coverage`.
- [ ] Browser suite: the ring's modules open with 0 console errors and 0 exceptions in both moods on every Node ≥20.19 leg.
- [ ] `initiatives/face/evidence/phase-03/not-served-<ring>.md` names every gap (module · panel · the route it needs) — this list, not PLAN-face-v2 §5.2's table, is what Phase 04 builds.
- [ ] `face-dogfood` read and its count recorded in PROGRESS.md as a usage TREND (never counted toward REQ-10) — from the command ring onward.
- [ ] Carried Cycle 15 findings (`initiatives/face/archive/evidence-cycle15-2026-09-16/phase-09/room-sweep-by-eye.md`) closed in their ring: **F1** the ADR band map names lanes, not rooms (the module that renders it) · **F2** the scheduler lede promises only what the module shows (kernel) · **F3** planned `trader` never wears LIVE (money, ADR-1328).
- [ ] factory ring adds the named exemptions for `factory` · `executor` · `agents`; company ring adds `story` (ADR-1327) — unless the owner's §13 item 5 ruling gives a room a registry row instead.

**Whole phase**
- [ ] Shot review contract: candidate shots captured on the owner's box with the SAME contract as Phase 00's baseline (1440×1000, both moods, Chrome version recorded, `initiatives/face/evidence/phase-00/baseline-shots.json`); per ring, the `design-critic` agent — fresh, never the ring's author — judges each module's candidate against its baseline and writes `initiatives/face/evidence/phase-03/shot-review-RING.md`, one line per module × mood classed VIOLATION / BELOW-BAR / WEAKNESS / POLISH; a VIOLATION or BELOW-BAR blocks that ring's merge.
- [ ] 36/36 in both moods on CI; a fresh agent reviews per-module shots against the v0.7 baseline with 0 VIOLATION and 0 BELOW-BAR (ADR-0049; ADR-1322's council colour is a declared delta).
- [ ] Facts-bundle lint (FAIL from birth) refuses a planted facts module under `face/src/**`.
- [ ] Block B tripwire reading (day 5 of 10, after command + kernel) recorded in PROGRESS.md; if 14 modules are not green → cut the remaining bespoke folds to generic renders.
- [ ] The Phase 00 baseline list of throwing v1 rooms is empty.
- [ ] Two fresh attackers (facts-bundle lint decision logic · module/browser shell-OS boundary), each carrying the lane's fixed-defect list, run against the ring PR that SHIPS the facts-bundle lint — not deferred to the phase close (retro-log 2026-08-02: bind the attack to the PR that ships the gate); holes fixed and pinned.
- [ ] `/arc-phase-done 03` once, after the company ring merges.

## Verification plan

Refined 2026-09-17 at phase start (`/arc-change`, classified trivial and in scope: it names how each exit criterion above is proven and changes no REQ, ADR, appetite or non-negotiable). All tests run on CI only.

**1 · The read host — once, in the command ring PR, for all 36.** `face/src/lib/door.mjs` names the door's routes in one table (`DOOR_ROUTES`: the served GET reads, and `/api/decide` · `/api/ask` as acts). A `module.mjs` `routes` list may name only those; a route the door does not serve is not declared, it is a `NOT SERVED` panel. `fold()` returns `reads` — the declared routes it needs, with a param or a query — and the host (`shell/RoomFrame.tsx`) loads exactly those through the door and folds again; the View reaches the door only through `ctx.onPick` · `ctx.onAct` · `ctx.onReread`. Every decision of that loop (a read's key and path, which payloads a fold may receive, what an act refreshes) is in `face/src/lib/registry.mjs`. Proof: `tests/face/module-frame.mjs` — a fixture handing `fold()` an undeclared route's payload FAILs by name (REQ-05), a read of an undeclared route is refused, a manifest declaring a route the door does not serve does not attach; red first on the missing exports.

**2 · NOT SERVED is derived, never typed.** A fold returns a panel it cannot fill as `notServed(panel, route)`; the View draws the kit's `NotServed`, marked `data-not-served`. `tests/face/module-frame.mjs` folds every module of each shipped ring with no payloads and requires `evidence/phase-03/not-served-RING.md`'s table (module · panel · route) to EQUAL what the folds name, both ways. The smoke prints `smoke: not-served mood=M panels=N` per mood.

**3 · Per ring.** `tests/face/module-frame.mjs` holds the shipped rings. For each: its module folders equal `contracts/modules-v2.json`'s ids for that ring (an ADR-1327 extra counted only with its exemption row), no View imports a Cycle 15 renderer from `face/src/rooms/`, every declared route is in `DOOR_ROUTES`, and every boolean-named field a fold returns is a boolean. Red first: the ring is added to the shipped list before its modules are ported, and the run FAILs by name. Then `tests/face-browser.bats` green per job on ubuntu Node 20 + 22, macOS and windows: every room opened in both moods, 0 errors, the render line equal to face-coverage's module half.

**4 · Facts-bundle lint — command ring PR.** `.claude/scripts/core/face-facts.mjs` over `face/src`: structural arms FAIL from birth (a data file, a link, an import leaving face/src or turning a file into a value, a glob beyond `./` code, an asset URL, an env value, a fetch of anything but `/api/`, a text blob, a data literal of 200+ leaves, v0.7's bundle names); heuristic arms WARN (a 64+ leaf literal, a 512+ character string, a GENERATED banner, a repo-fact-shaped string in a module). `tests/face/face-facts.mjs` plants each arm, including v0.7's `arcFacts` shape, and holds the real tree at `fail=0`. Two fresh attackers (decision logic · shell/OS boundary) carrying `fixed-defects.md`, in the same PR.

**5 · Shots.** `face/scripts/harness-run.mjs --shots DIR` captures every module at 1440×1000 in both moods with the Chrome version recorded, from the ring's branch build over the fixture spine; the `design-critic` agent, fresh, judges each against its Phase 00 baseline PNG with the ADR-1324 contract declared (a `NOT SERVED` panel is the honest state, not a defect) and writes one line per module × mood; a VIOLATION or BELOW-BAR blocks the ring's merge.

**6 · Readings.** After each ring merges: `face-dogfood` from the main clone, its count recorded in PROGRESS.md as a trend. After the kernel ring: the Block B tripwire reading. The Phase 00 throwing-rooms list stays MEASURED EMPTY on every ring's smoke.

## Rabbit holes in this phase

- **Re-laying the owner's rooms** — markup moves as-is; only decisions move into `fold.mjs`.
- **"Fixing" a `NOT SERVED` panel with a fetched file or a constant** — the facts-bundle lint and ADR-1324; the gap goes on the list.
- **Planned rooms looking live** — rendered from `planned-rooms.json`, dotted, REHEARSAL (ADR-1328).

## Out of scope for this phase

New door routes → Phase 04 · any verb, button that writes, or flow → Phase 05.

## Your-setup / pending

The owner runs the git for five ring PRs and may score a ring BELOW the reference (cycle kill criterion).

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
