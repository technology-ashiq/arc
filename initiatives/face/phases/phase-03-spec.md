# Phase 03 — Agent tiers on `/api/roster` and the discover hunt op

**Goal (one line):** REQ-08, REQ-09 — the agents room shows each agent's tier implied by its model, and the owner starts a discover hunt from the discover room.
**Appetite:** 1 day
**Depends on:** phase-01
**Serves:** REQ-08, REQ-09
**Branch:** `feat/face-v3-03-tiers-hunt`

## Exit criteria (Definition of Done)
- [ ] `/api/roster` serves `tier` + `tier_source: "implied by model:"` per agent, `unmapped` for a model absent from router.yaml (mutant guessing FAILs); the agents room's tier and switched-on panels read served values (ADR-1367).
- [ ] `discover.hunt` op: plan `--dry-run`; apply writes the niche file under `.claude/state/discover/` and runs `hunt --niche-file`; a fixture greps argv for the niche and FAILs if present; `run.completed{step: hunt}` in the room within 5 s; ADR-1356 decision 2 superseded by ADR-1369 in the PR (ADR-1369).
- [ ] Coverage, wiki, sync golden regenerated; two attack surfaces; CI per job; the owner runs one hunt from the face; `/arc-phase-done 03`.

## Verification plan
Refined when the phase starts (via `/arc-change`): roster fold fixture, hunt op no-second-path + argv fixture against `--offline-fixture`, CI per job, the owner's live hunt.

## Rabbit holes in this phase
A `tier:` key on agent files (ADR-1367); running the council judge from the face (stays `/arc-hunt`).

## Out of scope for this phase
The hunt's council judge; a discover session row.

## Your-setup / pending
A niche to hunt for the live demo.

## Non-negotiables (verbatim from PLAN)

- The module contract stays four files and a `View.tsx` holds no branch (ADR-1320, ADR-1359).
- `POST /api/decide` stays byte-parity with `arc-inbox` (`tests/face/dash-parity.mjs`).
- Zero new spine kinds; picker options and agent tiers ride EXISTING routes (`/api/ops`, `/api/roster`).
- Every write verb plans first and applies on the plan id (ADR-1339); every session starts only from a click as `arc-run --process NAME --driver NAME` (ADR-1326).
- Nothing in the face deploys, publishes or pushes (ADR-1366, AGENTS.md).
- Generated files are regenerated, never hand-edited (rooms.generated.json, docs/wiki, sync golden, compiled commands).
- No key, token or credential in the tree; the logic attacker's credentials live in the owner's environment (ADR-1368).
- Branch-only writes; `main` untouchable from the face; merge is the owner's.
