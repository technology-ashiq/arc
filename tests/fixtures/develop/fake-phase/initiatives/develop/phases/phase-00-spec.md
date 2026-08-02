# Phase 00 — fake steel thread (fixture)

**Goal (one line):** exercise the develop lifecycle end-to-end with no network.
**Appetite:** 0.5 days
**Depends on:** none

Serves **REQ-01**, **REQ-02**.

Relevant decisions: ADR-0063 and ADR-0065.

Touches `initiatives/develop/PLAN.md` (exists — survives the filter),
`initiatives/develop/phases/phase-00-tasks.md` (does not exist yet, but its parent directory does —
survives as a new-file entry) and `.claude/scripts/develop/develop.mjs` (no ancestor in this tree —
dropped and counted). All three branches of the blast-radius filter, in one fixture.

## Exit criteria (Definition of Done)

<!-- 5 boxes on purpose: `start` derives one slice per exit-criteria checkbox, so this
     fixture's ledger comes out with exactly 5 slices. -->

- [ ] the lifecycle runs end to end
- [ ] the ledger is written
- [ ] receipts land on the spine
- [ ] the lane contract holds
- [ ] tests green

## Non-negotiables (verbatim from PLAN)

- Every slice declares its acceptance proof BEFORE implementation.
- The harness never runs git.
