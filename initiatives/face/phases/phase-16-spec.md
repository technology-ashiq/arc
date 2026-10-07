# Phase 16 — Approval bindings: an approval knows what it waits on and what it is bound to

**Goal (one line):** REQ-20 — `approval.requested` gains three optional fields (`bound_to`, `depends_on`, `decision_key`) and the inbox folds STALE, WAITING and DUPLICATE_OF from the spine alone, so no request looks open, approved or single when it is not.
**Appetite:** 2 days ((a) bound_to 0.75d · (b) depends_on 0.75d · (c) decision_key 0.5d)
**Depends on:** phase-15 (an unevaluable binding renders as REQ-19's `unknown`)
**Serves:** REQ-20
**Branch:** `feat/face-v2-16-approval-bindings`
**Preconditions (STOP if absent):** Phase 15's close is merged, the owner accepted ADR-1355, and `git log origin/main -5 -- .claude/scripts/hq/lib/validate.mjs` was read before the first edit of that shared file (lanes.md, shared files).

Why it exists (owner, 2026-10-07, `/arc-change --lane face`): `decision.recorded` already refuses a second decision and `plan-expect` already refuses a stale apply, but the inbox sees neither. A child of a rejected parent lists OPEN; one decision raised by two lanes lists twice; an approve whose plan moved looks approved until the apply says `PLAN_STALE`.

## Exit criteria (Definition of Done)

Sub-order: (a), then (b), then (c). Each lands with its fixtures before the next starts.

- [ ] **No new kind:** KINDS is unchanged; `decision.recorded` stays `decides · verdict · reason`; the three fields ride `approval.requested`'s open payload as a validated profile in `validate.mjs` (ADR-1916's pattern).
- [ ] **(a) `bound_to: { kind: "plan-expect", expect: "<64hex>" }`:** `arc-inbox inbox` re-derives each bound request's plan DRY-RUN (`plan-expect`'s `spineRefusal` pattern) and marks a mismatch `STALE(plan-moved)`; the re-derive writes nothing (a fixture snapshots the tree, the spine and the lock dir before and after); `approve` on it refuses `PLAN_STALE`, the apply's own code; an already-approved request whose plan moved shows `approved · stale · re-plan needed` in the decided view, and the apply still refuses `PLAN_STALE`.
- [ ] **(b) `depends_on: [<approval.requested ULID>...]`:** at most 8, no self-reference, each must resolve to an `approval.requested` (a `decision.recorded` ULID is refused), no cycle (A→B→A refused at emit). Parent undecided → `WAITING(<ulid>)` and approve refuses `PARENT_OPEN`; parent rejected → `STALE(parent-rejected)` and approve refuses `PARENT_REJECTED` with zero events written; parent approved → OPEN. Stale is derived, never recorded: no auto-reject receipt.
- [ ] **(c) `decision_key: "<lane>:<subject>:<stable-id>"`:** an exact string, never normalised (trailing whitespace makes a different key, and is refused by the profile's grammar). Two OPEN requests sharing a key → the later one is `DUPLICATE_OF <earlier>`; deciding either shows the sibling `resolved-by <decision>` in the fold; still exactly one `decision.recorded`.
- [ ] **The inbox line:** `<ulid>  <what>  (<gate>)  <venture>  [OPEN | WAITING(<ulid>) | STALE(parent-rejected) | STALE(plan-moved) | DUPLICATE_OF <ulid>]`; OPEN only by default, `--all` for every state.
- [ ] **The face:** the Inbox room renders the five states as badges from the SAME fold (no second fold in the face), and a binding that cannot be evaluated renders REQ-19's `unknown` with its failure class.
- [ ] **Reader-only:** no state stored outside the spine; a wiped derived index rebuilds byte-identically (REQ-04); Tape as-of replay reproduces WAITING and STALE (ADR-1305).
- [ ] Two fresh attackers (logic · shell) through `/arc-attack`, one round — the prompts carry: a `depends_on` cycle A→B→A; a parent pointing at a decision ULID instead of a request ULID; the stale re-derive performing any write; a `decision_key` with trailing whitespace. CI green per job; the wiki regenerated; `/arc-phase-done 16` from the main clone.

## Verification plan

Tests run on CI only, read per job; each fixture asserts it RAN before asserting what it printed. One PR per sub-slice is allowed; one attack round on the phase.

| Exit criterion | Check | Evidence | Who |
|---|---|---|---|
| No new kind | KINDS byte-identical; a `decision.recorded` with a fourth field still refused | CI per job | CI |
| (a) stale | fixture: request bound to digest D, plan moved → `STALE(plan-moved)`; approve exits `PLAN_STALE`; snapshot before/after identical | CI per job | CI |
| (a) decided view | approve, then move the plan → `approved · stale · re-plan needed`, apply still `PLAN_STALE` | CI per job | CI |
| (b) parent | rejected parent → child approve exits `PARENT_REJECTED`, spine line count unchanged; open parent → `PARENT_OPEN` | CI per job | CI |
| (b) refusals | self-ref, a decision ULID, 9 parents, A→B→A each refused at emit | CI per job | CI |
| (c) duplicate | two requests one key → one OPEN + one DUPLICATE_OF; deciding either resolves both; one `decision.recorded` | CI per job | CI |
| (c) exact | `key` and `key ` (trailing space) refused by the grammar | CI per job | CI |
| Inbox line | default prints OPEN only; `--all` prints all five states | CI per job | CI |
| Face | browser smoke: the five badges in dark and in light from the fold fixture | CI per job | CI |
| Rebuild + replay | wipe the derived index → byte-identical rebuild; Tape replay shows WAITING then OPEN at the parent's decision | CI per job | CI |
| Live | from the main clone the owner reads one WAITING and one STALE in the face Inbox; his words go to `evidence/phase-16/owner-demo.md` | evidence file | owner |

- **Expected failure first:** the profile refuses `bound_to`; the inbox lists a rejected parent's child as OPEN.

## Rabbit holes in this phase
- **Auto-rejecting children.** STALE is a fold; a rejection is only ever the owner's `decision.recorded`.
- **A second fold in the face.** The Inbox room reads `arc-inbox`'s fold through the door; it never re-derives.

## Out of scope in this phase
A wall-clock `expires_at` · editing `decision.recorded` · auto-rejecting children · any new kind.

## Your-setup / pending
The acceptance of ADR-1355; the live read at the end, from the main clone.

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
