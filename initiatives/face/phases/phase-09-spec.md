# Phase 09 — The front door: the face at the entrance, ENTER HQ into the workroom

**Goal (one line):** REQ-13 — `/` shows the owner's front door (the neon particle face at full presence, one message, one ENTER HQ control with the warp) and the workroom stays a clean room without the face, in both moods; a WebGL failure never takes the workroom down.
**Appetite:** 1.5 days
**Depends on:** phase-02, phase-07
**Serves:** REQ-13
**Branch:** `feat/face-v2-09`
**Preconditions (STOP if absent):** Phase 07's PROGRESS row reads ✅ CLOSED (done 2026-09-30) **and the owner has approved ADR-1349** (its status reads accepted). The change is proposed until he says so.

## Exit criteria (Definition of Done)

- [ ] **The front door renders (ADR-1349 §2):** `/` with no hash draws `FaceStage` at presence 1 on the neon ground, one message line and one ENTER HQ control; `#hq` draws the workroom. The browser smoke opens both on every L3 leg and asserts the stage's canvas exists on `/` and does not exist under `#hq`.
- [ ] **ENTER HQ works by pointer and by keyboard:** the control is a real button, focusable, Enter and Space fire it; it fires the stage warp (direction in) and switches to `#hq`; leaving HQ (the design's exit) returns to `/` with the warp reversed. A fixture on the pure mode decision (`lib/*.mjs`, no React) holds every transition: `/` to `#hq`, `#hq` to `/`, a bad hash to `/`.
- [ ] **The workroom never mounts the stage, in either mood:** a fixture asserts the shell renders no stage node under `#hq` in dark and in light, so the Phase 02 ruling ("a clean room") still holds.
- [ ] **A WebGL failure is contained (the guard row):** with WebGL unavailable (forced in the harness) the front door shows a visible fallback line and ENTER HQ still opens the workroom, and a stage that throws is caught at its boundary so the workroom still opens. Each arm FAILs from birth against the unguarded stage.
- [ ] **Named, not a room (ADR-1349 §1):** the front door has one exemption row in `expected-set.json` and `rooms.generated.json` via `face-sections.mjs`; `face-coverage` stays green both directions and FAILs a second, unnamed surface (a planted one, with its mutant control).
- [ ] **The lint learns the front door (ADR-1349 §4):** the colour-literal lint reads `face/src/face` and the front-door directory; the neon palette is allowed by name in one file and a planted literal elsewhere FAILs. The ledger row that says the lint does not read them is paid.
- [ ] **Palette on the door:** ⌘K opens on the front door as in the design (the existing palette, nothing new).
- [ ] **Owner sees it against the design:** from the MAIN clone the owner opens `/`, presses ENTER HQ, lands in the workroom, and says whether it is his design. The transcript goes to `evidence/phase-09/`. This is the criterion only he can tick.
- [ ] Two fresh attackers (logic · boundary); CI green per job; `/arc-phase-done 09` from the main clone.

## Verification plan

Tests run on CI only, read per job, and each fixture asserts it RAN before asserting what it printed. One PR, one attack round, one push.

- **Test command:** `tests/face-dash.bats` → a new `tests/face/front-door.mjs` (mode decision, guard, coverage exemption, lint arm) and the harness smoke (`smoke.mjs` + `flows.mjs`) extended to open `/` and `#hq`.
- **Expected failure first:** before the change, `front-door.mjs` fails to import `lib/mode.mjs`; the smoke finds no stage canvas on `/`; `face-coverage` has no surface row to check.
- **Checks:** every transition of the mode decision; the stage absent under `#hq` in both moods (dark and light); WebGL-off shows the fallback and ENTER HQ still works; a stage that throws is caught; a planted second surface FAILs coverage; a planted colour literal outside the neon file FAILs the lint.
- **Live demo:** from the main clone, open `/`, see the face, press ENTER HQ, arrive in the workroom, press the exit, return to `/`; the owner states whether it matches his design. Transcript to `evidence/phase-09/`.

## Rabbit holes in this phase

- **The faithful landing.** Sections S1..S6 and chapters C01..C09 with their live spine panels are about 2,700 lines of design JSX and a live read of the spine. They are ADR-1349 option B and NOT this phase; starting them here is the overrun this phase exists to avoid.
- **Voice.** ADR-1315 stands: no voice on the front door.
- **Tuning the particles.** The stage is ported as the design has it. A change to the face's look is the owner's call, after he has seen it.

## Out of scope for this phase

The story sections and chapters (option B, its own REQ if the owner wants it) · voice · a live panel on the front door · any change to the workroom.

## Your-setup / pending

The owner's OK on ADR-1349 before any code, and his look at the front door against the design at the end.

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
