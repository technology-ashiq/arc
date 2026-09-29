# ADR 1614 — ORG-N: a seat's `origin` is `own` or `hired`, nothing else; a hire enters only through `arc-run` and only after a bench interview

**Status:** accepted
**Date:** 2026-09-29
**Product:** `org`
**Reversibility:** one-way
**Revisit trigger:** A second hire-to-own rewrite happens -> the command (ORG-R item 4) is earned; the two states stay two.

## Context
Locked in the design source `docs/strategy/plans/PLAN-org.md` (ORG-N). The owner rejected a third "converted" state on 2026-09-29: a hire that becomes own is own; provenance lives in `history:` and an ADR. Fired by the owner ruling of 2026-09-29 (ADR-1600).

## Options considered
1. **Two states, engine-only door, bench interview** (REQ-11).
2. **Direct model calls from a card** — no receipt, no tenure, bypasses ADR-0069.

## Decision
`origin: hired` requires `hire.runtime` (an `arc-run` driver), `hire.source`, a router tier, `vetted_by: capability-scout` (ADR-0110), ADR-0216 tenure, and receipts carrying `model_source: router | trial` (ADR-0220). A seat — own or hired — flips to `staffed` only in the same branch as a bench run over the role's `fixtures` with a human verdict. **No card names a model string**; coverage FAILs one that does.

## Consequences
Easier: every seat is governed identically. Harder: a hire costs an interview even when obviously good.
