# Phase 14 — The plan-bound audit: every write verb measured, not assumed

**Goal (one line):** REQ-18 — one read-only script lists every verb under `.claude/scripts` that writes the spine or a tracked file, says whether it goes through `plan-expect` (`--expect`), and fails CI on an unbound write verb that is not on its allowlist with a reason.
**Appetite:** 0.5 day
**Depends on:** phase-13
**Serves:** REQ-18
**Branch:** `feat/face-v2-14-plan-bound-audit`
**Preconditions (STOP if absent):** Phase 13's close is merged, and the owner accepted ADR-1353 (done 2026-10-07, "ok").

Why it exists (owner, 2026-10-07, `/arc-change --lane face`, "three honesty gaps"): Phases 15 and 16 lean on the plan-digest guarantee (`core/plan-expect.mjs`: `planDigest`, `staleReason`, `spineRefusal`, an apply refused `PLAN_STALE` when its plan moved). Nothing measures that every write verb honours it. This phase measures it first, so the next two build on a fact rather than an assumption.

## Exit criteria (Definition of Done)

- [ ] **The listing:** `node .claude/scripts/core/plan-bound-audit.mjs` prints one line per write verb, `verb · file · writes-to · plan-bound yes/no`, where `writes-to` is `spine`, `tracked-file` or both, and plan-bound means the verb's write path is reachable only through `--expect` (or a `spineRefusal` / `staleReason` check before the write).
- [ ] **The gate:** it exits non-zero on any unbound write verb absent from `plan-bound-allowlist.json` beside it; every allowlist row carries a `why` (e.g. `arc-event emit` IS the writer); a row with an empty `why` FAILs, and a row naming a verb that no longer exists FAILs (a stale allowlist is a lie).
- [ ] **Mutants FAIL from birth:** a planted write verb with no `--expect` path FAILs; an allowlist row with no reason FAILs; a planted verb that reads `--expect` but writes before checking it FAILs (the check must come before the write, not merely exist).
- [ ] **In CI:** it runs from a bats suite beside `face-coverage` on every leg (`.github/` is not edited, per the standing route), and the run asserts it RAN (a counted line total above zero) before asserting the exit.
- [ ] **No behaviour changes:** no verb's code changes in this phase. Each unbound verb found that is not allowlisted is filed as its own `/arc-change` row in PROGRESS `## Now`; the allowlist carries it until that change lands.
- [ ] Two fresh attackers (logic · shell) through `/arc-attack`, one round; CI green per job; the wiki regenerated in the same PR; `/arc-phase-done 14` from the main clone.

## Verification plan

Tests run on CI only, read per job; each fixture asserts it RAN before asserting what it printed. One PR, one attack round, one push.

| Exit criterion | Check | Evidence | Who |
|---|---|---|---|
| Listing | the bats suite runs the audit on the real tree and asserts a line count above zero and the four-column shape | CI per job | CI |
| Gate | sandbox tree with one unbound verb not allowlisted → exit 1 naming it | CI per job | CI |
| Mutants | three planted inputs (no `--expect`; empty `why`; write-before-check) each FAIL | CI per job | CI |
| Stale allowlist | a row naming a deleted verb FAILs | CI per job | CI |
| No behaviour change | `git diff --stat` of the PR touches no existing verb script | PR diff | CI + attacker |
| Gaps filed | each unbound verb found has a PROGRESS row | tracker | session |

- **Expected failure first:** the audit script does not exist; the bats suite is red.

## Rabbit holes in this phase
- **Fixing a verb found unbound.** The audit measures; each fix is its own `/arc-change`, never folded in here.
- **A full data-flow analysis.** The detection is structural (argv parse of `--expect`, the call order of the check and the writer); where it cannot decide, it says `unknown` and FAILs, so a verb is never passed by default.

## Out of scope in this phase
Changing any verb · a new spine kind · editing `.github/` workflows.

## Your-setup / pending
The acceptance of ADR-1353.

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
