# Phase 05 — Work door + verbs: the owner's hand, with no second brain

**Goal (one line):** REQ-04 + REQ-07 + REQ-09 — `/api/op/:id/plan|apply` runs the real tools per op, only ops with a green no-second-path fixture ship, flows run in CI, and coverage checks ops both ways (ADR-1326, ADR-1334).
**Appetite:** 4 days
**Depends on:** phase-04
**Serves:** REQ-04, REQ-07, REQ-09
**Branch:** `feat/face-v2-05`
**Preconditions (STOP if absent):** Phase 04's PROGRESS row reads ✅ CLOSED via `/arc-phase-done 04` from the main clone; the owner has ruled PLAN-face-v2 §13 items 4 and 5; the Block B tripwire reading is recorded in PROGRESS.md.

## Exit criteria (Definition of Done)

- [ ] **Day-1 CLI probe, before any door code:** for every op the owner's §13 item 4 ruling names, record in `initiatives/face/evidence/phase-05/cli-probe.md` — the CLI's path, whether it has a dry-run/plan mode, whether its output is machine-readable, and the kind it emits (checked against `validate.mjs` KINDS). An op whose CLI lacks any of the three is NOT SHIPPABLE from that moment (assumptions ledger row 6); these CLIs belong to other lanes and are never modified from this phase.
- [ ] Server ops registry beside the door (`.claude/scripts/hq/face-ops.mjs`, ADR-1319): each op names the exact script or emitter a hand-run calls; its main-guard realpaths both sides.
- [ ] Binding table per op (ADR-1334): v0.7 kind → the existing kind the real CLI emits | NOT SHIPPABLE; written from each CLI, never from the v0.7 name.
- [ ] `POST /api/op/:id/plan` → command line + file diff + ₹ estimate; `POST /api/op/:id/apply` → runs, streams, emits a receipt of a kind in `validate.mjs` KINDS.
- [ ] Per-op **no-second-path fixture**: the door's invocation equals the hand-run invocation; an op without it green does not ship and its module renders read-only with an honest badge.
- [ ] **`main`-untouchable fixture:** a file-touching op writes only to a `feat/face-*` branch, shows the diff and stops; no merge exists.
- [ ] A tool's own refusal (send-window, cap, budget, lint) renders verbatim.
- [ ] Module `ops.mjs` filled for shipped ops; `face-coverage` op half: a module `ops[]` id missing from the server registry FAILs, and vice versa; selftest arms > 93.
- [ ] `face/scripts/flows.mjs` ported: button text, placeholders, `data-*`, h1 frozen; event assertions read receipts through the door; runs from `tests/face-browser.bats` on every Node ≥20.19 leg; a planted change to a frozen string FAILs.
- [ ] `POST /api/decide` byte-parity fixture green (former REQ-08, ADR-1333); route-enumeration fixture proves no bulk write path appeared.
- [ ] **Block C gate:** if the six flagship ops cannot all be made green, the door does not ship — every module read-only with a no-verbs badge — and the door moves to its own cycle.
- [ ] Two fresh attackers (door decision logic · shell/git boundary), each carrying the fixed-defect list; CI green per job; `/arc-phase-done 05` from the main clone.

## Verification plan

Coarse (refined via `/arc-change` when the phase starts): per op, the no-second-path and `main`-untouchable fixtures RED first against a door with no ops registry, then green per job; flows RED on a planted string, green on the real one.

## Rabbit holes in this phase

- **CLIs with no dry-run** — the op does not ship; no shim in the door (ADR-1326).
- **Ops that "need" a new kind** — out of scope and labelled (ADR-1334).
- **The engine seam** — `face-ask`'s `hq.policy.yaml` row still waits on the empty-allowlist seam; no op routes around it (PLAN-face-v2 §11).

## Out of scope for this phase

Streaming sessions (council convene, absorb read, hire certification) → Phase 06 · merge from the UI → never.

## Your-setup / pending

The owner's §13 rulings (items 4, 5) before start; the owner runs the git for `feat/face-v2-05`.

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
