# Phase 00 — Hands First part 1, recorded: PR #449 closed on its evidence

**Goal (one line):** REQ-01 — record the Hands First work that merged before this kickoff (PR #449, `6012c36`) as the cycle's steel thread, and close it on the evidence it already carries.
**Appetite:** 0.5 days (gather and file the evidence 0.25d · owner read + `/arc-phase-done 00` 0.25d)
**Depends on:** none
**Serves:** REQ-01
**Branch:** `feat/face-v3-00-record` from `origin/main` after the kickoff PR merges (evidence, its audit tool and tracker only — no product code)

Decisions it records: ADR-1357 (strip + drawer), ADR-1358 (frame-owned tabs), ADR-1359 (no View branch), ADR-1360 (org chart), ADR-1361 (not-ready sessions named), ADR-1362 (placeholders as examples), ADR-1363 (shell papercuts), ADR-1364 (the audit as proof).

Why it exists: the owner's 30-minute timebox (2026-10-21) built and merged FV3-A…H before any kickoff. Arc has no tracked home for a change without a cycle, so this phase is that home. It is closed on evidence, never rebuilt.

## Exit criteria (Definition of Done)
- [ ] **Capability on `main`:** measured by `initiatives/face/evidence/phase-00/audit.cjs` on product code `6012c36` (or the later `main` SHA, named) and filed as `initiatives/face/evidence/phase-00/audit-SHA.md`. The file is the script's stdout unedited: a per-room markdown table, then exactly these four summary lines, each of which must read as shown (the room set is derived from `/api/rooms`, never from this file):
  - `first verb < 768 px: N/N rooms with verbs · console errors: 0` — both N equal (23/23 of 36 served rooms in the kickoff dry-run, 2026-10-21);
  - `org chart: 71 role chips · 10 department boxes · 24 after the Vacant filter`;
  - `not-ready sessions (door): 6 -- develop.close-phase, review-ship.qa, review-ship.ship, executor.hire, absorb.adopt, growth.draft` — the per-button "not built yet" render is read from CI's `face-browser` sessions line (criterion 2), not re-proven here;
  - `ops planned 200 with their own placeholders: 32/32`.
  A changed count is not a fail by itself if the door changed under it (a new room, role or op on `main`); the done log names the delta and its cause. A count that drops with no door change is a fail.
- [ ] **Tests green:** `node .claude/scripts/review/ci-digest.mjs --sha d8f03de9a837ef7200e88ae1d6c304831f5a664a` (the PR head merged as `6012c36`) reads run 39551997252 19/19 `success` per job (needs the runner's `gh` auth). `main` has no push-triggered CI (`on: pull_request, workflow_dispatch`), so the merged tree is re-read by one `gh workflow run arc-ci --ref main` dispatch at close and `ci-digest.mjs --sha MAIN_SHA`, the SHA named in the done log.
- [ ] **Live demo:** the owner's read of the pages on his main clone ("pages pathuten nice work", 2026-10-21, this session's chat) quoted with date and medium in `initiatives/face/evidence/phase-00/owner-demo.md`.
- [ ] **Attack evidence:** the two boundary rounds are ALREADY at `initiatives/face/evidence/phase-00/attack-0991e16-r1-boundary.json` and `attack-7b0c082-r2-boundary.json` (moved there by the kickoff commit `255a713`); the three mediums (0991e16 B1, B2; 7b0c082 B1) are the two rows already appended to `initiatives/face/fixed-defects.md` by #449 (verify, do not re-add); the LOW residue is row D113 of `initiatives/face/debt-ledger.md` (verify). **Narrower than written, stated:** the logic surface did not run (no trial model) — carried to REQ-07 (Phase 04, area #449).
- [ ] **Order deviation recorded:** the PROGRESS done-log line for Phase 00 says, in these words, "built and merged before its kickoff (the owner's 30-minute timebox, 2026-10-21); closed on evidence, not rebuilt".
- [ ] **Tracker + receipts:** `/arc-phase-done 00 --lane face` run from the owner's MAIN clone (`E:/Work_Hub/01_Automemory/arc`, branch `main` pulled; a worktree cannot write the canonical spine) flips the row ✅, adds the done-log line with `t-to-phase0`, and emits `phase.closed{phase:"00"}` and `approval.requested{gate: phase-done, phase:"00"}` on the canonical spine; Phase 00 has no evidence bundle (ADR-0002 bundles start at Phase 02).

## Verification plan
- **Order (STOP if absent):** (1) the kickoff PR is merged and the owner has stamped BOTH the freeze-exemption owner-ruling `01M5ER722G87D19PFDR7KFD48H` and the kickoff `approval.requested{gate: kickoff}` (its id is printed when it is emitted and is listed by `node .claude/scripts/hq/arc-inbox.mjs inbox`); (2) branch `feat/face-v3-00-record` from `origin/main` at that moment; (3) evidence; (4) PR; (5) the owner merges; (6) `/arc-phase-done 00 --lane face` from the main clone.
- **Test command:** CI read first — `node .claude/scripts/review/ci-digest.mjs --sha d8f03de9a837ef7200e88ae1d6c304831f5a664a > /tmp/ci-d8f03de.txt`, then for each `face-browser` job id it lists: `gh api repos/technology-ashiq/arc/actions/jobs/JOB_ID/logs` (the API answers 302; follow the Location) `| grep -E "smoke: front-door|^flows:|^sessions:"`. Both outputs go verbatim into `initiatives/face/evidence/phase-00/ci-d8f03de.md`: the digest under `## ci-digest`, one `## face-browser JOB_ID (OS)` block per leg. Expected: 19/19 `success`; per leg 34/34 front door, 32/32 flows, 9/9 sessions. Read from CI, not re-run on the box (`testing.md`).
- **Audit topology (who, where):** this session (cloud), not the owner's machine — a checkout of `main` at the SHA under test with a COPY of the owner's canonical spine (`.claude/state/hq/events/*.jsonl`, staged read-only from `E:/Work_Hub/01_Automemory/arc`); door + app started by `node .claude/scripts/hq/arc-face.mjs --no-open --token TOKEN` (defaults: app `http://localhost:5180/`, door `http://127.0.0.1:8317`); then `APP=http://localhost:5180/ DOOR=http://127.0.0.1:8317 ARC_DASH_TOKEN=TOKEN PLAYWRIGHT_PATH=/opt/npm-tools/node_modules/playwright node initiatives/face/evidence/phase-00/audit.cjs > initiatives/face/evidence/phase-00/audit-SHA.md`. The copy is never written back; the audit only reads and plans (plan seals nothing on the spine). The kickoff dry-run of exactly this command on 2026-10-21 printed the four lines of exit criterion 1.
- **Expected failure first:** the "before" numbers are quoted from `docs/strategy/plans/PLAN-face-v3.md` §1 lines 35–36 (org first verb ~6,000 px; page heights), line 43 (6/15 dead session buttons) and line 46 (13/32 ops rejecting their placeholder), measured 2026-10-21 on `17c07a5`; cited, not re-run. The audit script's own red: pointed at `17c07a5` it would report rooms with verbs and no strip (`—`), which its summary counts as failing.
- **Live demo scenario:** open `#/org`, `#/bench`, `#/develop` at 1366×768: the strip is under the header, a strip button opens the drawer with its form, the org opens on the chart, `develop.close-phase` reads "not built yet" (exit criterion 1, the 6/6 count).
- **Real-system check:** the owner's canonical spine and door on his main clone.
- **Expected evidence:** `initiatives/face/evidence/phase-00/{audit.cjs, audit-SHA.md, ci-d8f03de.md, owner-demo.md, attack-0991e16-r1-boundary.json, attack-7b0c082-r2-boundary.json}` and the two phase-done receipts' ids in the done log.
- **Who runs `/arc-phase-done 00`:** this session, against the owner's main clone through the device shell (owner's ruling at kickoff: "Naan un machine-la emit pannuren") — `cd E:/Work_Hub/01_Automemory/arc`, `--dry-run` first, then the real emit; the tracker edit lands on the Phase 00 branch, never on `main`.

## Rabbit holes in this phase
Re-opening any FV3-A…H decision — they are merged and recorded (ADR-1357…1364); a defect found while re-measuring becomes a Phase 01 slice via `/arc-change`, not a Phase 00 edit.

## Out of scope for this phase
Records tab, pickers, the CI gate and the logic attacker (Phase 01).

## Your-setup / pending
Stamp the freeze-exemption owner-ruling `01M5ER722G87D19PFDR7KFD48H` and the kickoff approval in the face inbox (both precede the Phase 00 branch); merge the kickoff PR; read the pages (done 2026-10-21).

## Non-negotiables (verbatim from PLAN)

- The module contract stays four files and a `View.tsx` holds no branch (ADR-1320, ADR-1359).
- `POST /api/decide` stays byte-parity with `arc-inbox` (`tests/face/dash-parity.mjs`).
- Zero new spine kinds; picker options and agent tiers ride EXISTING routes (`/api/ops`, `/api/roster`).
- Every write verb plans first and applies on the plan id (ADR-1339); every session starts only from a click as `arc-run --process NAME --driver NAME` (ADR-1326).
- Nothing in the face deploys, publishes or pushes (ADR-1366, AGENTS.md).
- Generated files are regenerated, never hand-edited (rooms.generated.json, docs/wiki, sync golden, compiled commands).
- No key, token or credential in the tree; the logic attacker's credentials live in the owner's environment (ADR-1368).
- Branch-only writes; `main` untouchable from the face; merge is the owner's.
