# Phase 04 — Debt: the logic surface owed, the harness's children, v3's residue

**Goal (one line):** REQ-07 — pay six debt rows: run the logic attacker on the four Cycle 16 areas that only ever got the boundary surface, stop the browser harness leaking children on a kill, and close v3's own LOW residue.
**Appetite:** 1.5 days (four logic attacks + fixes 1d · D23 0.25d · D113 0.25d)
**Depends on:** phase-01 (REQ-05's trial model must run first)
**Serves:** REQ-07
**Branch:** `feat/face-v3-04-debt`

## Exit criteria (Definition of Done)
- [ ] debt #D95 (owner-key, ADR-1514 Amendment 2), debt #D96 (Phase 09 front door), debt #D99 (Phase 10 talking face), debt #D106 (model edit): `/arc-attack` logic on each area's current code writes `attack-SHA-r1-logic.json`; critical, high and medium findings fixed and pinned in `fixed-defects.md`; LOW residue re-filed as its own row.
- [ ] debt #D23: `face/scripts/harness-run.mjs` kills door, preview and Chrome on SIGINT/SIGTERM; a fixture sends the signal and finds no child left.
- [ ] debt #D113: the strip and the docks share one `/api/ops` + `/api/sessions` read per room; door strings in org chips and cards are one-line and capped; `parseSaved` caps its key count.
- [ ] The six rows marked closed in `debt-ledger.md`; `kickoff-gates` debt count drops by 6; two attack surfaces on this PR; CI per job; `/arc-phase-done 04`.

## Verification plan
Refined when the phase starts (via `/arc-change`): the four logic attack receipts, the signal fixture, a read-count fixture for D113, CI per job.

## Rabbit holes in this phase
Fixing LOW findings beyond the six rows (they stay rows); re-architecting any attacked area.

## Out of scope for this phase
The other 106 open rows.

## Your-setup / pending
REQ-05's DeepSeek model id and credentials in the environment that runs `/arc-attack`.

## Non-negotiables (verbatim from PLAN)

- The module contract stays four files and a `View.tsx` holds no branch (ADR-1320, ADR-1359).
- `POST /api/decide` stays byte-parity with `arc-inbox` (`tests/face/dash-parity.mjs`).
- Zero new spine kinds; picker options and agent tiers ride EXISTING routes (`/api/ops`, `/api/roster`).
- Every write verb plans first and applies on the plan id (ADR-1339); every session starts only from a click as `arc-run --process NAME --driver NAME` (ADR-1326).
- Nothing in the face deploys, publishes or pushes (ADR-1366, AGENTS.md).
- Generated files are regenerated, never hand-edited (rooms.generated.json, docs/wiki, sync golden, compiled commands).
- No key, token or credential in the tree; the logic attacker's credentials live in the owner's environment (ADR-1368).
- Branch-only writes; `main` untouchable from the face; merge is the owner's.
