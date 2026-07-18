# ADR 0021 — Tests stay centralised in `tests/`; REQ-07 amended to scripts only

**Status:** accepted
**Date:** 2026-07-19
**Reversibility:** two-way
**Decided by:** Ashiq, at Phase 03 checkpoint-4 close
**Amends:** REQ-07 · supersedes the tests clause of the Phase 03 goal (ADR-0018 unaffected)

## Context

REQ-07 as originally written had two halves: *"scripts live under `.claude/scripts/PRODUCT/`,
tests under `products/NAME/tests/`"*. Phase 03 delivered the first half for all five products —
`.claude/scripts/` now contains nothing outside `core/`, `council/`, `plan/`, `review/`.

The second half was never started. All 22 `.bats` files are still in `tests/` and
`products/NAME/tests/` does not exist. That was drift rather than a decision: checkpoint 1
deferred council's fixtures for a real reason (`phases/phase-00-spec.md:26` pins two of them as a
CLOSED phase's named REQ-01 evidence) and the per-product test move was never picked back up.
Surfaced at ckpt-4 close rather than being quietly left unticked.

## The fact that decides it

**Tests never cross the product boundary.** Verified, not assumed: a full
`sync-to-project.sh TARGET` produces a tree with no `.bats` file anywhere in it, and no product
manifest carries a `tests` key at all — the resolver has no concept of a test as shipped payload.

REQ-07's user outcome is *"products have physical boundaries."* A boundary matters where
something crosses it. Tests do not: a consumer installing `--products council` receives council's
commands, agents, scripts and docs, and never receives a test. Relocating `tests/council-*.bats`
into `products/council/tests/` would therefore change nothing a consumer can observe, and nothing
REQ-01 ("a product installs alone and works") measures — that is proven by `sync.bats`, which
itself tests **all** products' installation and so belongs to no single product.

## Options considered

1. **Checkpoint 5 — relocate the bats files per product.** Pros: REQ-07 as literally written is
   satisfied; a product directory becomes self-describing. Cons: `sync.bats`, `products.bats`,
   `gates.bats` and `portability.bats` are inherently cross-product and have no owner to move to;
   `test_helper.bash` would need per-product path math; CI discovery and the test-count floor
   fragment across N directories. Real cost, and the benefit is unobservable to consumers.
2. **Amend REQ-07 to scripts only, keep the suite centralised.** Pros: matches what tests actually
   are here — arc's own CI harness, not shipped payload; keeps `bats -r tests/` as one cheap
   invocation, which is what makes the CI-authority model (adopted this same phase) work. Cons:
   REQ-07 no longer reads as originally drafted; a product dir does not carry its own tests.

## Decision

**Option 2.** REQ-07's acceptance becomes scripts-only. Tests stay in `tests/`, flat.

This is not the cheap option winning — it is the observation that the second half of REQ-07 was
specifying a boundary around something that never leaves the repo. The requirement was drafted
before the registry and the CI-authority model existed; both landed since and made the split
strictly costly.

## Consequences

- `phases/phase-03-spec.md`'s goal line and per-checkpoint contract drop their tests clause; the
  phase becomes closeable on the scripts half alone.
- `bats -r tests/` and the 247-test floor in CI stay as they are. The `-r` flag, added in
  anticipation of this move, is now redundant but harmless — left in place so a future
  reversal costs nothing.
- **Revisit trigger:** if a product is ever physically extracted to its own repo (ADR-0016,
  demand-triggered), its tests must go with it. At that point this ADR is superseded for that
  product, and the extraction — not a re-home — is what carries the tests across.
- What REQ-07 still guarantees is unchanged and was fully delivered: scripts under
  `.claude/scripts/PRODUCT/`, every move behind a green byte-diff gate.
