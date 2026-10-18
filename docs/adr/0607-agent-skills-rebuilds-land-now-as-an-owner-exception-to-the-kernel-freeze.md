# ADR 0607 — the agent-skills rebuilds land now, as an owner-approved exception to the kernel freeze

**Status:** accepted
**Date:** 2026-10-18
**Product:** `absorb`
**Reversibility:** two-way
**Why two-way:** every landed file is a playbook or a hand-written command step; deleting them restores
the prior behaviour, and no gate, script or CI job depends on them.
**Revisit trigger:** `/arc-phase-done` step 5b flags a bar-lowering move that turns out to be a
deliberate, discussed change more than twice in one cycle — the checklist wording is then too noisy.

## Context

The study of `addyosmani/agent-skills` @ `aeac41d4` (MIT; report
`initiatives/absorb/evidence/agent-skills/extraction-report.md`, PR #439) registered five ABSORB rows as
`candidate`: T-05, T-06, T-10, T-11, T-13.

absorb is a kernel lane. The kernel-freeze ruling of 2026-10-14 (request
`01M4VP8AMYJPMT1MZNQRB0FYY6`, approved `01M4VPVKGNX9DMNWFEEZ57ZGJX`) bars a new kernel cycle until
`revenue.received >= 1`, and absorb Cycle 10 closed on 2026-08-10, so these rebuilds have no live phase.

The owner approved a scoped exception through the inbox: request `01M574E95SWDZST6Z261RYXDJ3`, decision
`01M5776Q2WK2D674NT58091SCX` (2026-10-18). This ADR is that decision's tracked home.

## Options considered

1. **Park until first revenue.** Recommended in-session; the owner chose otherwise.
2. **A new absorb cycle via `/arc-kickoff`.** `kickoff-lint` FAILs `[kernel-freeze]`, correctly, and a
   cycle for five documentation edits is ceremony out of proportion to the work.
3. **A scoped exception, decided through the inbox and recorded here, no cycle.** Chosen.

## Decision

- The five rebuilds land in one PR, on the ADR-0602 allowlist only (`docs/playbooks/**`,
  `.claude/commands/**`), with zero runtime dependencies and the MIT attribution in every rebuilt file.
- **No cycle is opened and the freeze ruling is not superseded.** The exception covers exactly these
  five rows; the next absorb rebuild meets the freeze again.
- Landing sites:
  - T-05 + T-06 → `docs/playbooks/bar-guard.md`, caller `/arc-phase-done` step 5b.
  - T-10 → a reconcile section in `docs/playbooks/finding-verification.md`.
  - T-11 → `.claude/commands/arc-second-opinion.md` (stdin, read-only, announced skip).
  - T-13 → `docs/playbooks/process-authoring.md`.
- The rows stay `candidate`. `adopted` still needs a `decision.recorded` ref per row (REQ-07); this
  decision approves landing, not adoption, and no A/B has run.

## Consequences

- `/arc-phase-done` gains a checklist step, not a gate: prose the closing agent follows, weaker than a
  lint. A lint would be `.claude/scripts/**`, off the allowlist (ADR-0602).
- T-08 (pairwise skill-routing evals) stays UNBUCKETED and is not covered by this exception.
