# Phase 00 — Hands First part 1, recorded: PR #449 closed on its evidence

**Goal (one line):** REQ-01 — record the Hands First work that merged before this kickoff (PR #449, `6012c36`) as the cycle's steel thread, and close it on the evidence it already carries.
**Appetite:** 0.5 days (gather and file the evidence 0.25d · owner read + `/arc-phase-done 00` 0.25d)
**Depends on:** none
**Serves:** REQ-01
**Branch:** `feat/face-v3-00-record` (evidence and tracker only — no product code)

Decisions it records: ADR-1357 (strip + drawer), ADR-1358 (frame-owned tabs), ADR-1359 (no View branch), ADR-1360 (org chart), ADR-1361 (not-ready sessions named), ADR-1362 (placeholders as examples), ADR-1363 (shell papercuts), ADR-1364 (the audit as proof).

Why it exists: the owner's 30-minute timebox (2026-10-21) built and merged FV3-A…H before any kickoff. Arc has no tracked home for a change without a cycle, so this phase is that home. It is closed on evidence, never rebuilt.

## Exit criteria (Definition of Done)
- [ ] **Capability on `main`:** first verb `top` < 768 px at 1366×768 in 27/27 rooms that have verbs; org chart 71/71 roles in 10/10 departments, Vacant filter 24; 6/6 not-ready sessions disabled with the process named; 32/32 ops plan 200 with their placeholders — re-measured on `main` @ `6012c36` by the audit script and filed as `evidence/phase-00/audit-6012c36.md`.
- [ ] **Tests green:** CI run 39551997252 on `d8f03de` (the PR head merged as `6012c36`) 19/19 `success`, read per job; the merged `main` re-read per job at close.
- [ ] **Live demo:** the owner's read of the pages on his main clone ("pages pathuten nice work", 2026-10-21), quoted in `evidence/phase-00/owner-demo.md`.
- [ ] **Attack evidence:** boundary rounds `attack-0991e16-r1-boundary.json` and `attack-7b0c082-r2-boundary.json` filed under `evidence/phase-00/`; three mediums fixed and pinned in `fixed-defects.md`; LOW residue in `debt-ledger.md`. **Narrower than written, stated:** the logic surface did not run (no trial model) — carried to REQ-05.
- [ ] **Order deviation recorded:** the done log says the phase was built before its kickoff and closed on evidence.
- [ ] Tracker updated: PROGRESS row ✅ + done-log line + receipts from `/arc-phase-done 00` on the canonical spine.

## Verification plan
- **Test command:** `node .claude/scripts/review/ci-digest.mjs` on the merged `main` (head SHA asserted), then the audit script over a door + app on `main` @ `6012c36`: `node face/scripts/harness-run.mjs --face FACE_COPY --moods dark` for the front door, flows and sessions, plus the first-verb read at 1366×768 per room.
- **Expected failure first:** the same audit on `17c07a5` (before #449) — org first verb ~6,000 px, 13/32 ops rejecting their placeholder, flows looking for op cards on the page — is the red this phase's green is read against; both numbers go into `audit-6012c36.md`.
- **Live demo scenario:** open `#/org`, `#/bench`, `#/develop` at 1366×768: the strip is under the header, a strip button opens the drawer with its form, the org opens on the chart, `develop.close-phase` reads "not built yet".
- **Real-system check:** the owner's canonical spine and door on his main clone (`node .claude/scripts/hq/arc-face.mjs`).
- **Expected evidence:** `evidence/phase-00/{audit-6012c36.md, owner-demo.md, attack-0991e16-r1-boundary.json, attack-7b0c082-r2-boundary.json}` and the two phase-done receipts.

## Rabbit holes in this phase
Re-opening any FV3-A…H decision — they are merged and recorded (ADR-1357…1364); a defect found while re-measuring becomes a Phase 01 slice via `/arc-change`, not a Phase 00 edit.

## Out of scope for this phase
Records tab, pickers, the CI gate and the logic attacker (Phase 01).

## Your-setup / pending
Stamp the kickoff approval; read the pages (done 2026-10-21).

## Non-negotiables (verbatim from PLAN)

- The module contract stays four files and a `View.tsx` holds no branch (ADR-1320, ADR-1359).
- `POST /api/decide` stays byte-parity with `arc-inbox` (`tests/face/dash-parity.mjs`).
- Zero new spine kinds; picker options and agent tiers ride EXISTING routes (`/api/ops`, `/api/roster`).
- Every write verb plans first and applies on the plan id (ADR-1339); every session starts only from a click as `arc-run --process NAME --driver NAME` (ADR-1326).
- Nothing in the face deploys, publishes or pushes (ADR-1366, AGENTS.md).
- Generated files are regenerated, never hand-edited (rooms.generated.json, docs/wiki, sync golden, compiled commands).
- No key, token or credential in the tree; the logic attacker's credentials live in the owner's environment (ADR-1368).
- Branch-only writes; `main` untouchable from the face; merge is the owner's.
