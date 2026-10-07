# Phase 15 — Five-state availability: "checked, zero" is never "could not check"

**Goal (one line):** REQ-19 — the binary `NOT SERVED` (ADR-1324) becomes one `Availability` enum of five states, every non-served field names its source and owner lane, and a source that failed reads `unknown`, never 0.
**Appetite:** 1.5 days
**Depends on:** phase-14
**Serves:** REQ-19
**Branch:** `feat/face-v2-15-availability`
**Preconditions (STOP if absent):** Phase 14's close is merged, and the owner accepted ADR-1354 (done 2026-10-07, "ok").

Why it exists (owner, 2026-10-07, `/arc-change --lane face`): the Money, Ventures, Legal, Growth and Leads folds collapse four truths into one word, so the owner cannot tell a source that was read and held nothing from a source that was never reached.

## Exit criteria (Definition of Done)

- [ ] **One enum:** `face/src/lib/availability.mjs` exports `Availability` = `served` · `zero` (source read, no records; renders 0 with its provenance) · `unknown` (source unreachable or failed; never 0, never blank; shows the failure class) · `not-applicable` (declared, never inferred) · `not-instrumented` (arc knows the kind or adapter does not exist). Every fold imports it; a fold that redefines a state string FAILs a lint.
- [ ] **Every non-served field is named:** it returns `{ availability, source, owner_lane, as_of }`; `face-coverage`'s walker FAILs a fold that cannot name a `source` for one (FAIL from birth).
- [ ] **Failure is `unknown`:** a fake adapter that throws maps to `unknown` with its failure class, never to 0 (a mutant mapping it to 0 FAILs); a declared `not-applicable` stays `not-applicable` when its adapter throws.
- [ ] **One component:** `NotServed` becomes one five-state component; it keeps `data-not-served` for the harness and adds `data-availability="<state>"`.
- [ ] **Counts on screen:** each room header shows its count of `unknown` and `not-instrumented` fields; zero of each shows nothing, never a silent default.
- [ ] **`FIELD_UNKNOWN`:** a room verb whose plan reads a field at `unknown` refuses `FIELD_UNKNOWN` rather than planning on 0. The verbs this gates are listed here, by name, as the phase's first step (before any code) and nothing else is gated.
- [ ] **Replay:** Tape as-of replay reproduces every field's state byte-identically (ADR-1305).
- [ ] **Browser smoke:** the five states render in Money, Ventures, Legal, Growth and Leads in dark and in light, counted by `data-availability`.
- [ ] Two fresh attackers (logic · shell) through `/arc-attack`, one round — the logic prompt carries: a fold returning numeric 0 where the source was unreachable; a fold hard-coding `served` without reading. CI green per job; the wiki regenerated; `/arc-phase-done 15` from the main clone.

## Verification plan

Tests run on CI only, read per job; each fixture asserts it RAN before asserting what it printed. One PR, one attack round, one push.

| Exit criterion | Check | Evidence | Who |
|---|---|---|---|
| One enum | node fixture: every fold imports the enum; a planted literal state FAILs | CI per job | CI |
| Fields named | `face-coverage` mutant: a non-served field with no `source` FAILs | CI per job | CI |
| Failure is unknown | fake adapter that throws → `unknown`; mutant mapping to 0 FAILs; declared `not-applicable` holds under a throw | CI per job | CI |
| Component | browser smoke counts `data-availability` per state, both moods | CI per job | CI |
| Header counts | module fixture: 2 unknown + 1 not-instrumented → header reads 2 and 1 | CI per job | CI |
| FIELD_UNKNOWN | each listed verb, planned against an `unknown` field, refuses with no file and no event | CI per job | CI |
| Replay | Tape as-of fixture: two replays of one spine prefix give byte-identical states | CI per job | CI |
| Live | from the main clone the owner opens Money and reads one `unknown` and one `zero`; his words go to `evidence/phase-15/owner-demo.md` | evidence file | owner |

- **Expected failure first:** no `availability.mjs`; the throw fixture renders 0.

## Rabbit holes in this phase
- **Building the missing adapters.** `not-instrumented` names the gap; filling it belongs to the owning lane.
- **Backfilling `as_of`.** A field with no time renders the state with `as_of` unknown; no history is rewritten.

## Out of scope in this phase
Building missing adapters · backfilling `as_of` · gating any verb beyond the listed ones · a new spine kind.

## Your-setup / pending
The acceptance of ADR-1354; the live read at the end, from the main clone.

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
