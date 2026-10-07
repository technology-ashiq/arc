# Phase 02 — The owner paste: N in the law, interactive refusals, the lint, the deny floor

**Goal (one line):** the deny-listed half of POL-L lands as whole files the owner copies, and an armed interactive refusal becomes a cell's `last_refusal` (REQ-05).
**Appetite:** 0.5 days
**Depends on:** phase-01
**Serves:** REQ-05
**Branch:** `feat/policy-c2-evidence`

## Exit criteria (Definition of Done)
- [ ] Generated from the live files into `initiatives/policy/evidence/phase-02/paste/` (whole files, never diffs): `hq.policy.yaml` (+ `evidence_days` on every in-scope grant), `lib/policy/lint.mjs` (+ the key, integer ≥ 1), `policy-hook.mjs` (≤1 `policy.refusal` per kind-capability-decision-IST-day, exit code untouched), `policy-lint.mjs` (`--evidence` delegates), the ungrantable/deny-floor additions for the evidence files
- [ ] Owner applies; the applied files are byte-compared to the generated ones and the result recorded
- [ ] Hostile lint fixtures (`evidence_days: 0`, `-1`, `1.5`, `"35"`) exit 2; the armed hook's propose in a throwaway root is read back off the spine as `last_refusal`
- [ ] Attackers on the paste's code paths; CI green per job; tracker updated

## Verification plan
- Coarse, refined when the phase starts (via `/arc-change`): CI `tests/policy-lint.bats` + `policy-hook.bats` + `policy-evidence.bats`; red first = `evidence_days` rejected as an unknown key today.

## Rabbit holes in this phase
- Editing any deny-listed file from the session: never. If the paste is not applied, the phase is BLOCKED, not worked around.

## Out of scope for this phase
Headless per-action L1 refusals (engine, PLAN rabbit holes).

## Your-setup / pending
**The owner copies the generated files into place.** That is the only human action this cycle needs.

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
