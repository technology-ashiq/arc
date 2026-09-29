# ADR 1621 — Phase 02's hired-seat dry run through `generic-api` runs only if it is reachable at ₹0; otherwise REQ-11 is recorded unproven-live

**Status:** accepted
**Date:** 2026-09-29
**Product:** `org`
**Reversibility:** two-way
**Revisit trigger:** The owner explicitly approves a paid dry run -> it runs as one bench event under ADR-0220 `--trial-model`, no router row written.

## Context
`generic-api` is unpinned and unreachable per ADR-0914. Standing owner rule: no paid live runs unless asked. Fired by the owner ruling of 2026-09-29 (ADR-1600).

## Options considered
1. **Free or recorded unproven** — REQ-11's mutant arms still prove the gate.
2. **Paid run by default** — spends money unasked.

## Decision
Free or recorded. REQ-11 is proven by its mutant arms (hired with no `hire.runtime`, staffed with no fixture verdict) either way; the live leg is marked `unproven-live` in the Phase 02 bundle when no ₹0 path exists.

## Consequences
Easier: no surprise spend. Harder: the first real hire is exercised later.
