# ADR 0016 — Physical extraction of a product is demand-triggered, never speculative

**Status:** accepted
**Date:** 2026-07-17
**Reversibility:** two-way
**Revisit trigger:** the first real external user or buyer of a specific product — that event
fires Phase 6 for that product only.

## Context

The product monorepo (ADR-0014) creates real boundaries, which makes full extraction —
separate repo, plugin/marketplace packaging, per-product versioning, SaaS engine split —
technically cheap. The temptation is to do it now "while we're in there." But there are zero
external users today, and ADR-0013's rule-of-three logic (don't draw a boundary before a
second concrete consumer exists) was written precisely against this. ADR-0013's engine/adapter
*writing rule* (engine scripts assume no Claude) stands unchanged; what this ADR settles is
the *timing* of any physical split beyond the monorepo — ADR-0013 pinned that to v2's
Phase 8; the v2 initiative is now parked (ADR-0017), so the timing clause needs a new owner.

## Options considered

1. **Extract now** (separate repos / plugin packages this cycle) — pros: cleanest sellable
   artifact; cons: pure speculation, doubles maintenance surface, judged weakest (22–23/40).
2. **Never extract** (monorepo forever) — pros: simplest; cons: blocks the open-source/SaaS
   goal that motivated the restructure.
3. **Demand-triggered**: extraction fires only on the first real external user/buyer of a
   product; until then Phase 6 is locked — pros: zero speculative work, the manifest is the
   ready git-mv list; cons: first buyer waits days (packaging work) instead of zero.

## Decision

Option 3, verbatim rule: **physical extraction of a product to a separate repo, plugin, or
service triggers on the first real external user or buyer of that product; `product-lint
--paths <product>` emits the authoritative file list for the move.** Until the trigger fires,
Phase 6 is not planned, specced, or built. Council is the expected first candidate.

## Consequences

Easier: this cycle stays 6 weeks; no speculative packaging rots unused; the extraction cost
is prepaid by manifests + per-product tests (packaging, not archaeology). Harder: a sudden
buyer means days of packaging lead time — accepted. Supersedes the Phase-8 timing clause of
ADR-0013 only; its engine/adapter writing rule remains in force and is inherited as a
non-negotiable by this initiative.
