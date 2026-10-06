# Phase 13 — The Org room: who fills each role, and the owner edits a seat

**Goal (one line):** REQ-17 — every role in the Org room shows who sits it (agents, skills, scripts, process, tier) or says in words that no one does, and the owner reassigns a seat from the face as a reviewed proposal branch.
**Appetite:** 2.5 days (A show 0.5d · B edit 2d)
**Depends on:** phase-11
**Serves:** REQ-17
**Branch:** `feat/face-v2-13-org-seats`
**Preconditions (STOP if absent):** Phase 11's close (PR #358) is merged, and the owner accepted ADR-1352 (2026-10-07, "ok"; scope A+B chosen in the org session).

Why it exists (owner, 2026-10-07, from the org session): the role cards already name who fills each seat, but the face shows only "state · seat", and the only org op is the lane status. "ituhum pananum new req".

## Exit criteria (Definition of Done)

- [ ] **A — the route carries binds:** `GET /api/org` returns each role's `binds` (`agents`, `skills`, `scripts`, `process`, `tier`) exactly as the card holds them; a card with no `binds` returns empty lists, never a missing field.
- [ ] **A — the room says who:** `fold.mjs`'s `RoleRow` carries the binds and the View lists them under each role by name; a `vacant` role reads "no one sits this role"; a staffed seat with empty binds is named as a disagreement, not drawn as filled. Held by the org module's node fixture, with a mutant that draws a vacant seat as filled.
- [ ] **B — the op plans:** `org.seat-assign` (room `org`, `touchesFiles: true`, `humanRun: true`) takes a role, a seat and its agents; its plan runs `org/org-own.mjs` in assign mode with `--dry-run` and shows the card diff and the derived tier; nothing is written.
- [ ] **B — the op applies on a branch only:** apply rewrites ONLY `seat` and `binds` of ONE card on a new proposal branch off `main` and emits one `approval.requested`; `main` and the owner's checkout are untouched; every other byte of the card is identical (a fixture compares the rest of the card before and after).
- [ ] **B — refusals before any file or event:** an agent with no `.claude/agents/<name>.md`; a card id duplicated across departments; a staffed seat with empty binds or a vacant seat with binds. Each refusal leaves no branch, no file and no spine event (fixture asserts all three).
- [ ] **B — tier is derived, never typed:** the op has no tier field; `binds.tier` comes from the bound agents' frontmatter as `org-catalog`/`org-own` derive it; a mutant that accepts a typed tier FAILs.
- [ ] **Browser smoke:** the Org room shows a staffed role's agents and a vacant role's words, and the seat op opens its plan, in dark and in light.
- [ ] Two fresh attackers (logic · boundary) through `/arc-attack`, one round; CI green per job; the wiki regenerated in the same PR; `/arc-phase-done 13` from the main clone.

## Verification plan

Tests run on CI only, read per job; each fixture asserts it RAN before asserting what it printed. One PR, one attack round, one push.

| Exit criterion | Check | Evidence | Who |
|---|---|---|---|
| Route carries binds | the door fixture reads `/api/org` against a fixture card set with a staffed, a vacant and a no-binds card | CI per job | CI |
| Room says who | the org module's node fixture + mutant (vacant drawn as filled FAILs) | CI per job | CI |
| Op plans | `flows.mjs`/ops fixture: plan returns the diff and the derived tier, the tree unchanged | CI per job | CI |
| Branch only, one card | fixture in a sandbox repo: one card changed on a new branch, rest byte-identical, `main` untouched, one `approval.requested` | CI per job | CI |
| Refusals | three planted inputs, each: no branch, no file, no event | CI per job | CI |
| Tier derived | mutant with a typed tier FAILs | CI per job | CI |
| Live | from the main clone the owner opens Org, reads who sits a role, and plans one seat change; his words go to `evidence/phase-13/owner-demo.md` | evidence file | owner |

- **Expected failure first:** `/api/org` rows carry no `binds`; `org.seat-assign` is not in the ops registry.

## Rabbit holes in this phase

- **Editing anything else on the card.** Mission, stages, history and hire stay hand-edited; the op touches `seat` and `binds` only.
- **A second role-card writer.** `org-own.mjs` gains a mode; no new script.
- **Choosing a model for the seat.** Tier follows the agents (ADR-0069); a model choice is model-policy's surface.

## Out of scope for this phase

Creating or retiring a role · hiring an outside contractor (`org-own`'s hire-to-own stays as it is) · editing an agent file · team files (`org/teams/`) · merging the proposal branch from the face (merge never exists in the face, ADR-1326).

## Your-setup / pending

His acceptance of ADR-1352, then his live read at the end, from the main clone.

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
