# Phase 00 — fake steel thread (fixture)

**Goal (one line):** exercise the develop lifecycle end-to-end with no network.
**Appetite:** 0.5 days
**Depends on:** none

Serves **REQ-01**, **REQ-02**.

Relevant decisions: ADR-0063 and ADR-0065.

Touches `.claude/scripts/develop/develop.mjs` and `products/develop/manifest.json`.

## Exit criteria (Definition of Done)

- [ ] the lifecycle runs
- [ ] tests green

## Non-negotiables (verbatim from PLAN)

- Every slice declares its acceptance proof BEFORE implementation.
- The harness never runs git.
