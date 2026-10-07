# Phase 01 — The guard, and the evidence age in the Policy room

**Goal (one line):** `policy-evidence.mjs guard` reports clean only with zero BELOW-BAR cells and otherwise raises exactly one approval, and the face Policy room shows each cell's evidence age or state (REQ-04).
**Appetite:** 0.75 days
**Depends on:** phase-00
**Serves:** REQ-04
**Branch:** `feat/policy-c2-evidence`

## Exit criteria (Definition of Done)
- [ ] `policy-evidence.mjs guard [--as-of D]`: refuses a spine root that is not the main clone (except under the test-only root door); clean → exactly one `run.completed` (`policy-evidence-guard@1.0.0`, `outcome: ok`); not clean → exactly one `approval.requested` (gate `policy-evidence`, payload lists every BELOW-BAR cell with state and refusal ULID) plus `run.completed outcome: partial`
- [ ] Invariant (c) fixture + mutant (guard input filtered by one cell) red; positive control (an all-fresh fixture spine) emits no approval
- [ ] The guard's `run.completed` is folded back as `last_audit` for every cell it read (fixture)
- [ ] `GET /api/policy` serves `evidence` on each cell (`state`, `evidence_age_days`, `last_refusal`, `n`), computed by the same fold; `face/src/modules/kernel/policy/fold.mjs` + `View.tsx` render the age or state text per cell; `git log origin/main -- face/src/modules/kernel/policy` checked before the edit; face-coverage and the room's tests green
- [ ] Two fresh attackers (logic · boundary) on the phase diff; CI green per job; wiki regenerated; tracker updated

## Verification plan
- **Test command:** CI `arc-ci` — `tests/policy-evidence.bats` (guard section), the face kernel/policy tests and `face-coverage`. Never run on this box.
- **Expected failure first:** the guard test fails with `unknown subcommand guard` (exit 2) and the face test fails because the rendered cell has no age text.
- **Live demo scenario:** fixture spine with one fresh and one absent in-scope cell → `guard --as-of D` writes one `approval.requested` and one `run.completed outcome: partial`; same spine with the absent cell refreshed → one `run.completed outcome: ok`, zero approvals; the room screenshot shows `12d` / `absent` / `n/a` cells (opened and looked at, not described).
- **Real-system check:** the first real guard run is the owner's, monthly, from the main clone; until then n/a.
- **Expected evidence:** CI run id per job; `evidence/phase-01/live-demo.md`; the room screenshot.

## Rabbit holes in this phase
- Scheduling the guard: no (ADR-0511, owner-started).

## Out of scope for this phase
Deny-listed files (Phase 02).

## Your-setup / pending
None.

## Non-negotiables (verbatim from PLAN)

<!-- Generated from PLAN.md at kickoff; resynced by /arc-change. Never hand-edited. -->
- (a) A capability with zero receipts is BELOW-BAR, never PASS.
- (b) A refusal receipt older than N flips to BELOW-BAR on the day boundary, deterministically under replay.
- (c) The guard cannot report clean with any BELOW-BAR cell.
- Each of (a)(b)(c) is a fixture AND a named mutant the fixture kills, plus a positive control that a broken fold cannot satisfy.
- Zero new spine kinds: `KINDS.length` is asserted derived and unchanged.
- No level changes, and no auto-promotion or auto-demotion on evidence: promotion stays a human `policy.level.changed` citing evidence (ADR-0508).
- The fold reads no clock and no file, and never parses prose to attribute a refusal.
- An agent never edits a deny-listed file: those changes ship as whole-file owner pastes generated from the live files.
- Tests run on CI only, read per job; every suite asserts it ran before asserting what it printed.
