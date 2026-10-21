# Phase 04 — Debt: the logic surface owed, the harness's children, v3's residue

**Goal (one line):** REQ-07 — pay the owed logic surface on five areas (four Cycle 16 areas that only ever got the boundary surface, plus #449), stop the browser harness leaking children on a kill, and close v3's own LOW residue.
**Appetite:** 1.5 days (five logic areas at ≤ 0.25d each incl. fixes, capped at 1d total · D23 0.25d · D113 0.25d)
**Depends on:** phase-01 (REQ-05's trial model must run first)
**Serves:** REQ-07
**Branch:** `feat/face-v3-04-debt`
**Preconditions (STOP if absent):** REQ-05 closed — a real `model_source: trial` logic receipt is on file; if it is still `blocked-owner` at Phase 03's close, this phase runs only debt #D23 and #D113 and the five logic areas stay open, named in PROGRESS (PLAN kill criteria).

## Exit criteria (Definition of Done)
- [ ] debt #D95 (owner-key, ADR-1514 Amendment 2), debt #D96 (Phase 09 front door), debt #D99 (Phase 10 talking face), debt #D106 (model edit), and PR #449 (FV3-A…H, whose logic surface never ran — Phase 00 exit criterion 4): `/arc-attack --base BASE_N --lane face --classification external-ok` per area, where `BASE_N` and the diff's byte size are recorded in `evidence/phase-04/attack-bases.md` BEFORE the run; a code-only diff (no generated files, no tests-only noise), each input ≤ 120 KB, an over-cap area split by path into at most 2 runs, the split named; each writes `attack-SHA-r1-logic.json`; a run exiting 6 or 7 is a failed slice, never a pass; critical and high findings fixed and pinned in `fixed-defects.md`, mediums fixed in severity order within the area's 0.25d, the remainder re-filed one row each; LOW residue re-filed.
- [ ] debt #D23: `face/scripts/harness-run.mjs` starts door, preview and Chrome as process-group leaders (`detached` on POSIX; `taskkill /T /F` on win32) and kills the whole group on SIGINT/SIGTERM and on its own uncaught exit; the fixture spawns a stand-in tree (a node child that spawns a grandchild), sends SIGTERM on POSIX and the harness's IPC `shutdown` message on win32, and asserts by a pid probe that child AND grandchild are gone on all 3 OS legs, printing a RAN marker with the pids; a mutant that kills only the direct child FAILs.
- [ ] debt #D113: the strip and the docks share one `/api/ops` + `/api/sessions` read per room; door strings in org chips and cards are one-line and capped; `parseSaved` caps its key count.
- [ ] The six rows marked closed in `debt-ledger.md`; `kickoff-gates` debt count drops by 6; two attack surfaces on this PR; CI per job; `/arc-phase-done 04`.

## Verification plan
Refined when the phase starts (via `/arc-change`): the five logic attack receipts + `attack-bases.md` (each base ref and diff size), the process-tree fixture on 3 legs, a read-count fixture for D113, CI per job.

## Rabbit holes in this phase
Fixing LOW findings beyond the six rows (they stay rows); re-architecting any attacked area.

## Out of scope for this phase
The other 106 open rows.

## Your-setup / pending
REQ-05's trial model id (`z-ai/glm-5.3-flash`) and credentials, saved in the face's Keys tab and exported by the session into the `/arc-attack` child.

## Non-negotiables (verbatim from PLAN)

- The module contract stays four files and a `View.tsx` holds no branch (ADR-1320, ADR-1359).
- `POST /api/decide` stays byte-parity with `arc-inbox` (`tests/face/dash-parity.mjs`).
- Zero new spine kinds; picker options and agent tiers ride EXISTING routes (`/api/ops`, `/api/roster`).
- Every write verb plans first and applies on the plan id (ADR-1339); every session starts only from a click as `arc-run --process NAME --driver NAME` (ADR-1326).
- Nothing in the face deploys, publishes or pushes (ADR-1366, AGENTS.md).
- Generated files are regenerated, never hand-edited (rooms.generated.json, docs/wiki, sync golden, compiled commands).
- No key, token or credential in the tree; the logic attacker's credentials live in the owner's environment (ADR-1368).
- Branch-only writes; `main` untouchable from the face; merge is the owner's.
