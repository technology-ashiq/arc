# Phase 00 — Steel thread: a headless refusal becomes evidence, and an unproven level reads BELOW-BAR

**Goal (one line):** a real `arc-run` policy refusal writes a typed `policy.refusal` receipt, the pure fold attributes it to its pair, and `policy-evidence.mjs check` reports every in-scope pair with no fresh refusal as BELOW-BAR (REQ-01, REQ-02, REQ-03).
**Appetite:** 1.25 days
**Depends on:** none
**Serves:** REQ-01, REQ-02, REQ-03
**Branch:** `feat/policy-c2-evidence`

## Exit criteria (Definition of Done)
- [ ] `.claude/scripts/hq/lib/validate-policy-refusal.mjs` holds the ADR-0509 closed shape; `validate.mjs` calls it for `note.logged` with `subject: "policy.refusal"` and refuses a near-miss subject (case/whitespace); `KINDS.length` unchanged, asserted derived
- [ ] `arc-run.mjs` `policyGate`'s deny arm emits one `policy.refusal` per denied capability per run (`surface: headless`, `decision: deny`, `level: L0`, `incident_ref` = the `incident.raised` it just wrote) after that incident; `verifyLanded` runs on it as on the incident; a fallback hop calling `invoke()` again writes no second receipt for the same capability; a receipt that fails to land is reported and the deny still stands (exit code unchanged)
- [ ] `.claude/scripts/hq/lib/policy-evidence/fold.mjs` exports `foldEvidence({ policy, events, asOf })`: pure, no clock, no fs; effective level via `resolveVector` (POL-D: no second reducer); carriers exactly as PLAN-policy § v1.1; folds only events that pass `validateEvent` AND an `eventSha` recompute, deduped on `idem`; ignores events whose IST day is after `asOf`; IST day bucketing; refusal attribution from typed fields only; inconsistent `(decision, level)` discarded; a headless refusal without a resolvable `incident_ref` is `unverified`; a refusal refreshes a cell only at the cell's current effective level and only when ≥ L1; `unknown` for pairs whose surface writes no typed refusal; local state enum + Gap B mapping table (ADR-0510: scope, IST day boundary, `no-bar-declared`)
- [ ] The reader refuses a non-canonical spine (exit 2, by name): a linked worktree, a missing spine, an `ARC_SPINE_ROOT` naming another spine; arc-run writes ≤ 1 refusal per (action_kind, capability, deny, IST day) and its incident carries typed `denials` (attack round 1)
- [ ] `.claude/scripts/hq/policy-evidence.mjs` CLI: `report [--as-of D] [--json]` and `check [--as-of D]` (exit 0 clean, 3 BELOW-BAR, 2 usage/refusal); the as-of default resolved once in the CLI from IST today, never inside the fold
- [ ] `tests/policy-evidence.bats` (ASCII names, self-count guard, asserts the fold RAN — cell count = subjects × 8 — before asserting any state): invariant (a) + mutant, invariant (b) at d+N and d+N+1 over two byte-identical replays + mutant, positive control, `no-bar-declared`, forged-inconsistent discard, near-miss subject, the end-to-end arc-run refusal read back off the spine directory
- [ ] `arc-brief` needs no new group (the kind is unchanged) — asserted by `tests/policy-brief.bats` staying green, not edited
- [ ] Two fresh attackers (logic · boundary) via `/arc-attack`, carrying `initiatives/policy/fixed-defects.md`; findings fixed and pinned before the push; CI green per job
- [ ] Wiki regenerated in the same PR (`wiki-build.mjs`), tracker updated

## Verification plan
- **Test command:** CI `arc-ci` (bats on Windows/macOS/Linux) — `tests/policy-evidence.bats` (new), `tests/policy-runwrapper.bats`, `tests/policy-receipts.bats`, `tests/policy-brief.bats`. Never run on this box.
- **Expected failure first:** before the implementation, `policy-evidence.bats`'s first test fails with `Cannot find module '.../hq/lib/policy-evidence/fold.mjs'`, and the validator test fails because a `note.logged` with `subject: "policy.refusal"` and an unknown key `extra` is ACCEPTED (no profile exists yet).
- **Mutants (each must turn its fixture red):** M-a `state: absent` mapped to not-BELOW-BAR · M-b age computed from `Date.now()` instead of `asOf` · M-b2 `>=` instead of `>` at the N boundary · M-utc UTC day bucketing · M-future events after `asOf` folded · M-l0 any-level receipt refreshes an L1 cell · M-noforge the level-consistency check deleted · M-sha the sha recompute deleted · M-ref the `incident_ref` resolution deleted · M-writer the no-writer-means-forged check deleted. Prose attribution has no single-line mutant (an incident carries no typed pair to match), so it is pinned by the positive scenario `proseIgnored` instead (an incident naming the capability leaves the cell `absent`, not `n/a` or fresh).
- **Live demo scenario:** in a sandbox holding a full copy of `.claude/scripts/**` plus its own `hq.policy.yaml` (with `process:commit-msg-draft` lowered to `shell: L0`) and `.claude/state/hq/events`, so that `policyRoot()` (derived from the module location, not `--root`/`ARC_ROOT`) resolves to the sandbox, and a fake driver. The run's stderr must carry NO `unpoliced` NOTICE before anything else is asserted; `arc-run --process commit-msg-draft` is refused (exit 1); `policy-evidence.mjs report --as-of <today> --json` shows `process:commit-msg-draft/shell` with `last_refusal` = the ULID read from that root's spine file; `check` exits 3 and lists the 17 L1 cells as `unknown`/`absent`.
- **Real-system check:** after the merge, from the main clone, `policy-evidence.mjs report` over the canonical spine: 17 in-scope cells, all BELOW-BAR, 0 refusals — recorded verbatim as the cycle's baseline.
- **Expected evidence:** CI run id with per-job conclusions; `evidence/phase-00/live-demo.md` (the demo transcript) and `evidence/phase-00/baseline.txt` (the real-system report).

## Rabbit holes in this phase
- Fixing the hook's subject for headless runs: not this phase, not this cycle (PLAN rabbit holes).
- A refusal receipt from `spend.mjs`: deny-listed and out of the bar (no spend pair ≥ L1); the cell reads `unknown`.

## Out of scope for this phase
The guard and the room (Phase 01) · every deny-listed file (Phase 02).

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
