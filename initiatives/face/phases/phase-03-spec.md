# Phase 03 — The 36 modules, read-side, in five ring PRs

**Goal (one line):** REQ-01 + REQ-05 — all 36 v0.7 modules render in both moods from what the door serves, and every gap is a named `NOT SERVED` entry instead of a bundled fact (ADR-1324).
**Appetite:** 7 days — command 1d · kernel 2d · factory 1.5d · money 1.5d · company 1d
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

Coarse (refined via `/arc-change` when the phase starts): per ring, the browser suite's module count for that ring RED before its modules exist, then green per job; the whole-phase shot review by a fresh agent.

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
