# ADR 0042 — old /arc-design + design-reviewer run in parallel until the new critique mode is proven

**Status:** accepted
**Date:** 2026-07-28
**Reversibility:** two-way
**Revisit trigger:** the new module's critique mode passes its own dogfood check (one clean explore-critique run) → the retirement task (retire old agent, repoint command) becomes due.

## Context

Owner fork at kickoff. `design-reviewer` + `/arc-design` live under `products/qa/` and
work today; the review-ledger `design` stamp is wired to /arc-design PASS. A mid-cycle
cutover would break a working surface while its replacement is unproven.

## Options considered

1. **Parallel until proven** — old command + agent untouched; ledger stamp wiring untouched; retire + repoint only after the new critique mode passes dogfood. Con: two design surfaces coexist briefly.
2. **Immediate cutover at Phase 1** — no duplication. Con: migration risk lands mid-cycle on unproven code.
3. **Rename now + deprecated alias** — clean name early. Con: same risk as 2 plus churn.

## Decision

Option 1 (owner's call, recommended default). Retirement is its own tracked task, never
ad-hoc.

## Consequences

Easier: nothing in-flight breaks; rollback is trivial (new module simply unused).
Harder: brief coexistence of two design surfaces — the new module's modes get distinct
naming until retirement to avoid confusion.
