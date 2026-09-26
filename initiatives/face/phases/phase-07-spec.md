# Phase 07 — The Reference room: the wiki inside the face, and a Reference link from every room

**Goal (one line):** REQ-12 — the face serves `docs/wiki`'s own extract on a read route and renders it as a Reference room (index → type → entity pages, with the markdown's cross-links), and every room carries a Reference link to its entity's page (ADR-1346).
**Appetite:** 3 days (the 3d left unallocated by ADR-1339's re-bank; the phase specs now sum to the full 24d, zero slack)
**Depends on:** phase-04, phase-06
**Serves:** REQ-12
**Branch:** `feat/face-v2-07`
**Preconditions (STOP if absent):** Phase 06's PROGRESS row reads ✅ CLOSED via `/arc-phase-done 06` from the main clone; the owner's OK on this `/arc-change` (2026-09-26).

## Exit criteria (Definition of Done)

- [ ] **One extract (ADR-1346 §1):** `GET /api/reference` returns wiki-build's exported `extract()` over `treeWorld`, `schema: 1` asserted; a fixture proves the route's entity ids equal `wiki-build --json`'s for the same tree, both ways; nothing under `face/` or the door walks the tree (a grep-based check with a mutant control that plants a second walker).
- [ ] **Build-time facts only (ADR-1509):** a fixture plants a spine event and a `.claude/state/` file with a unique marker, and the marker appears nowhere in the route's response.
- [ ] **Read-only (ADR-1504):** the route is GET-only (any other method is refused), the room has no verb and no dock, and `docs/wiki/**` is byte-identical before and after a full room walk in the browser harness.
- [ ] **The room renders the owner's design:** index → type → entity pages, with the cross-links the markdown has (requires / required-by, product ↔ lane, command / agent → owning product, lane → its ADRs); sections Start here · The bigger loop · Reference · Evidence · Meta per `arc-wiki-engine_1.html`; both moods; opens clean in the smoke on every L3 leg.
- [ ] **Narrative honest (ADR-1508):** Start here / The bigger loop render `docs/wiki/_narrative/<dir>/<id>.md` with the fingerprint line stripped; an entity with no narrative file reads "narrative pending" — a fixture holds both arms.
- [ ] **Born by the birth rule (ADR-1306):** contract row in `expected-set.json`, `rooms.generated.json` via `face-sections.mjs`, a module under `face/src/modules/`; face-coverage green both directions; wiki-build run in the same PR (the room's product/room rows change what the wiki lists).
- [ ] **Per-room Reference link (ADR-1346 §6):** every served room whose product or lane has a wiki entity links to that entity's page; the counts of rooms with and without a link are asserted, not assumed.
- [ ] Two fresh attackers (logic · boundary); CI green per job; `/arc-phase-done 07` from the main clone.

## Verification plan

Coarse, refined when the phase starts (playbook: later phases keep one line): the door's read-route fixtures + the browser smoke over the new room in both moods, read per job on CI; the live demo opens the Reference room from the main clone, walks index → one entity of each type → its cross-links, and shows one room's Reference link landing on its page.

## Rabbit holes in this phase

- **Re-deriving the wiki in the client.** Every page path, type name and cross-link comes from the extract's response; the client computes nothing the extract already decided.
- **"Helpful" live numbers.** A count of runs next to a process page is exactly what ADR-1509 forbids; it belongs in the live room the link points to.
- **Generating the missing narrative.** "narrative pending" is the correct output, not a gap to fill with model prose (ADR-1508).

## Out of scope for this phase

Editing or regenerating `docs/wiki/**` from the face (docs lane, ADR-1504) · search across the wiki (a later change if the owner asks) · any new wiki gate (the docs lane owns them).

## Your-setup / pending

The owner's OK on this `/arc-change`, and later the owner's accepted narrative files for any section that should not read "narrative pending".

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
