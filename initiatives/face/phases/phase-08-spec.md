# Phase 08 — Dogfood on the final surface + retro

**Goal (one line):** REQ-10 — two real days where every decision goes through the face and ≥1 op per day is run from it, measured by `face-dogfood`; the retro and HISTORY close the cycle. Claims the surface is operable, never that the habit holds (ADR-1329).
**Appetite:** 2 days (real calendar days)
**Depends on:** phase-05, phase-06, phase-07
**Serves:** REQ-10
**Branch:** `feat/face-v2-08` (retro, HISTORY, tracker only)
**Preconditions (STOP if absent):** Phase 07's PROGRESS row reads ✅ CLOSED via `/arc-phase-done 07` from the main clone.

## Exit criteria (Definition of Done)

- [ ] Both days run from the MAIN clone via `node .claude/scripts/hq/arc-face.mjs`.
- [ ] `face-dogfood` reads MET for 2 days: every `decision.recorded` matched to the face journal, and ≥1 op receipt from the face on each day. If Phase 05's Block C gate fired and zero ops shipped, the op clause is recorded NOT MET and REQ-10 is re-scoped through `/arc-change` before these days start — never silently redefined.
- [ ] The usage trend recorded since the command ring (Phase 03) is read next to the two days in the retro (retro-log 2026-09-16 lesson).
- [ ] Assumptions ledger row 7 answered from the numbers: timing or Inbox shape.
- [ ] ADR-1315's voice question asked at the retro (its trigger's natural place).
- [ ] `/arc-retro` run; `docs/HISTORY.md` Cycle 16 row; `/arc-phase-done 08` from the main clone.

## Verification plan

Coarse (refined via `/arc-change` when the phase starts): `node .claude/scripts/core/face-dogfood.mjs` output for each day, pasted verbatim into the evidence bundle.

## Rabbit holes in this phase

- **Counting a half day** — a day is MET or it is not; the harness decides.
- **Claiming the habit** — two days prove operability only (ADR-1329).

## Out of scope for this phase

Raising the dogfood bar (a later cycle's question) · fixes beyond one-line — they become the next cycle's input.

## Your-setup / pending

Two real days of the owner's time deciding and working through the face.

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
