# ADR 0046 — design-lint.mjs rides the existing gate-runner and lint conventions; no new runner

**Status:** accepted
**Date:** 2026-07-28
**Reversibility:** two-way
**Revisit trigger:** design-lint needs per-variant execution context the flat gate list cannot express (conditions/DAGs are a gates-v2 feature) — then it runs standalone until gates catch up.

## Context

Auto-decided two-way door. Deterministic design checks (§2.10) need a home. Arc already
has: a declarative gate file (`arc.gates.yaml`, strict flat parser) run by
`arc-gates.sh`, the WARN-first TRIAL convention for new lints, and zero-dep `.mjs`
scripts under `.claude/scripts/<module>/`.

## Options considered

1. **Ride existing machinery** — `design-lint.mjs` under `.claude/scripts/design/`; the `design` gate row in arc.gates.yaml (mode: warn, tier: hook) calls it; WARN-first per v3.5 doctrine. Con: flat gate list, no conditions yet.
2. **New standalone runner** — freedom. Con: parallel infrastructure arc must maintain; violates extend-don't-duplicate.

## Decision

Option 1. Promotion warn→block only via retro + owner OK (PLAN no-go this cycle).

## Consequences

Easier: gate wiring, evidence path, and TRIAL discipline come free. Harder: none material
this cycle — v0's checks are unconditional.
