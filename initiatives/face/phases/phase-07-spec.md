# Phase 07 — The Reference room: the wiki inside the face, and a Reference link from every room

**Goal (one line):** REQ-12 — the face serves `docs/wiki`'s own extract on a read route and renders it as a Reference room (index → type → entity pages, with the markdown's cross-links), and every room carries a Reference link to its entity's page (ADR-1346).
**Appetite:** 10.5 days (3 from ADR-1339's re-bank + 5.5 added by ADR-1347 on 2026-09-27: rendering 0.5 · narrative-anchors + verifier 1 · 34 narratives 4; + 2 added by ADR-1348 the same day: page-shape parts + Diagram + fold 1.5 · ADR-1514 gate change 0.5; the specs sum to the full 31.5d, zero slack)
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
- [ ] **Rich narrative (ADR-1347 §2):** the fold parses narrative markdown into blocks (heading, paragraph, list, table, code) and the View draws them -- no HTML injection; a fixture holds every block kind, and a planted `<script>` and an `onerror=` render as text.
- [ ] **Page shape v1 (ADR-1348 §1-3):** an entity page draws Start here · The bigger loop · Reference · Evidence · Meta with a left nav, a masthead (name, version, tagline, chips) and a `narrative`/`generated` pill per section, from kit parts (Lede, Panel, StepPipe, Figure, Rosetta, StatGrid, Pill, Gloss) on face tokens only; generated sections come from the extract and a section whose fact the extract lacks is omitted; a fold fixture over a canned extract holds every part, both moods open clean in the smoke.
- [ ] **Diagram (ADR-1348 §4):** `diagram.mjs` (pure, node-importable) computes `flow` and `loop` geometry from a spec; a fixture FAILs overlapping boxes, an arrow that ends on no box, and a divider outside the boxes it names — each arm FAILs from birth with its mutant; `View.tsx` only maps geometry to `<svg>`.
- [ ] **Fenced blocks (ADR-1348 §5):** `lede`, `steps`, `flow`, `loop`, `panel`, `stats`, `rosetta` parse to typed blocks; a malformed block renders as visible source with an error, never dropped; a planted `<script>` and `onerror=` still render as text.
- [ ] **Drift-checked (ADR-1514 §2, amending ADR-1513 §1-2):** `narrative-anchors` FAILs a narrative naming a path, command, agent, process, script, gate or ADR that does not resolve; the every-block marker rule and the verify-receipt requirement are retired; each new arm FAILs from birth with its mutant.
- [ ] **Owner-accepted (ADR-1514 §4):** `narrative-anchors --accept <dir>/<id>` records the owner's acceptance against the narrative's sha256; an edit after acceptance reads awaiting-owner; awaiting-owner = 0 at close.
- [ ] **Sample first (ADR-1348):** the qa page ships through the whole pipeline and the owner accepts it in the room before any of the other 33 is rewritten.
- [ ] **All of it (ADR-1347 §1):** all 34 product and lane pages (counted from the extract) render page shape v1 with an accepted narrative and at least one diagram; the explanation-debt count is on the index.
- [ ] Two fresh attackers (logic · boundary); CI green per job; `/arc-phase-done 07` from the main clone.

## Verification plan

Refined 2026-09-26 at phase open. Two PRs, each with one attack round and one push; tests run on CI only, read per job, and each fixture asserts it RAN before asserting what it printed.

**PR A — the door (`/api/reference`).**
- **Test command:** `tests/face-dash.bats` → `tests/face/reference-door.mjs` (no door) and the P07 arm of `tests/face/dash-doors.mjs` (live door).
- **Expected failure first:** before the route exists, `reference-door.mjs` fails to import `lib/face/reference/route.mjs`, and the live arm's `route("/api/reference")` is 404, so `named` is false.
- **Checks:** A — entity ids equal `wiki-build --json`'s both ways, and byte for byte. B — a marker planted in a fixture tree's spine and `.claude/state/` never reaches the body; the narrative is served with its fingerprint stripped, and every other entity has none. C — schema 2 and an incomplete extract are `SOURCE_INVALID`, and a missing `narrativeReader` export is `PARSER_UNAVAILABLE`. D — the docs lane's own `tests/docs/no-walker.mjs` passes over the route's directory and catches a mutant copy that lists a directory. E — every tracked `docs/wiki` file is byte-identical after two runs. Live — named, schema 1, ≥100 entities, no fixture-spine id in the body, POST refused, query `BAD_ARGS`, 401 / 403 posture.
- **Additive in the docs lane (ADR-1339 pattern):** `narrativeReader` is exported from `wiki-build.mjs` so the door imports it rather than spelling it a second time.

**PR B — the room and the links.**
- Birth: an `expected-set.json` row, the `room-copy.json` entry, `rooms.generated.json` via `face-sections.mjs`, `modules-v2.json` via `face-modules-contract.mjs`, and the module under `face/src/modules/<ring>/reference/`. face-coverage stays green both directions.
- The room: the five sections of `arc-wiki-engine_1.html`, in both moods, in the smoke on every L3 leg, with a fold fixture over a canned extract (index → type → entity; each cross-link resolves to a page the extract holds).
- The links: one Reference link per served room, from `holds.products` / `holds.lanes`, with the with/without counts asserted.
- **Live demo:** from the main clone, open the Reference room, walk index → one entity of each type → a cross-link, and follow one room's Reference link to its page; the transcript goes into `evidence/phase-07/`.

**PR C — page shape v1 + Diagram + the qa sample (ADR-1348, ADR-1514, 2026-09-27).**
- **Test command:** `tests/face-dash.bats` → `tests/face/reference-fold.mjs` (parts + fenced blocks) and a new `tests/face/diagram.mjs` (geometry); `tests/docs-narrative.bats` (drift + accept arms).
- **Expected failure first:** `diagram.mjs` absent → import fails; a fenced `flow` block renders as a plain code block; `--accept` is an unknown flag (exit 2).
- **Checks:** every kit part in a canned-extract fold; flow + loop geometry mutants (overlap, dangling arrow, misplaced divider) each FAIL; malformed fenced block visible; drift arm FAILs an unknown ADR and an unknown command; an edit after accept flips the page to awaiting-owner.
- **Live demo:** from the main clone, open Reference → products → qa in both moods; the owner reads it beside `arc-wiki-engine_1.html` and accepts or sends it back.

**PR D… — the other 33 pages in batches**, each batch read and accepted by the owner in the room before the next.

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
