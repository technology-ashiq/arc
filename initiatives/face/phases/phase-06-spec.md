# Phase 06 — Session door: streaming work started by a click

**Goal (one line):** REQ-08 — council convene, absorb read, hire certification and every SESSION verb the Phase 05 probe found (15) start from a click, stream their phases, and land as receipts of existing kinds, always through `arc-run --driver` (ADR-1326, ADR-1333, ADR-1339).
**Appetite:** 5 days (2 allotted + 3 banked from Blocks A and B, ADR-1339)
**Depends on:** phase-05
**Serves:** REQ-08
**Branch:** `feat/face-v2-06`
**Preconditions (STOP if absent):** Phase 05's PROGRESS row reads ✅ CLOSED via `/arc-phase-done 05` from the main clone.

## Exit criteria (Definition of Done)

- [ ] Session door start / stream / attach beside the work door; every session's command line is `arc-run --driver …`; a command line naming a harness binary FAILs the fixture.
- [ ] Click-started only: a fixture proves 0 sessions start on page load, on reload, or on attach.
- [ ] A council convened from the `council` module streams its phases and lands a `council.verdict` receipt; absorb read and hire certification land receipts of kinds already in `validate.mjs` KINDS, or are labelled NOT SHIPPABLE (ADR-1334). The probe found `/arc-council`'s verdict payload fails the closed `council.verdict` shape (`validate.mjs:316`) — fixed in the council lane, additively, before the demo.
- [ ] **Every SESSION verb (ADR-1339):** the 15 in `evidence/phase-05/cli-probe.md` — council convene · develop proof · close phase · review · qa · ship · hire · dispatch · log lesson · promote rule · absorb adopt · growth draft · adopt plan · record ADR · lane birth — each starts from a click through `arc-run --driver` and lands a receipt of an existing kind, or is a residue row approved by the owner as a whole. A verb whose command has no process file (qa, ship and others) gets one from the engine lane, additively; `ship` deploys outward, so its session stops for the owner's confirmation before the deploy step.
- [ ] The Engine room shows driver, model and health; no key (ADR-1325).
- [ ] Two fresh attackers (session decision logic · process/OS boundary); CI green per job; `/arc-phase-done 06` from the main clone.

## Verification plan

Coarse (refined via `/arc-change` when the phase starts): the no-click and driver-only fixtures RED first, green per job; one real council convene from the face as the live demo, its receipt read back from the spine.

## Rabbit holes in this phase

- **Long-running sessions outliving the door** — attach reads the session's own receipts; the door holds no session state of its own.
- **Budget spend on a demo** — the convene uses the council's own budget guard; the face renders its refusal verbatim.

## Out of scope for this phase

New drivers or router classes (engine lane) · scheduled sessions (scheduler lane).

## Your-setup / pending

The owner approves any real council spend the demo triggers; the owner runs the git for `feat/face-v2-06`.

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
