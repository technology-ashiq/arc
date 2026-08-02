# ADR 0104 — The Phase-0 fake phase is a committed fixture, not a throwaway demo

**Status:** accepted
**Date:** 2026-08-02
**Product:** `develop`
**Reversibility:** two-way
**Revisit trigger:** the fixture starts asserting a snapshot of live repo state rather than a rule —
the 2026-08-02 failure mode where closing a cycle turned five CI legs red with nothing broken.

## Context

The design source's Phase-0 exit criterion is "runs end-to-end offline on a fake phase" (§12, §13). It
does not say whether that fake phase is checked in. The choice decides whether the steel thread has a
permanent regression gate or a one-time demonstration.

## Options considered

1. **Committed fixture** under `tests/fixtures/develop/fake-phase/` — every future ledger or grammar
   change must keep it passing, and it doubles as the template the evaluation suite (§8.5) seeds from.
2. **Throwaway manual demonstration** — cheaper now, proves the machinery ran once. Proves nothing on
   the next PR, and gives the eval suite no template.

## Decision

Option 1. It matches the repo's existing golden-fixture pattern (`tests/fixtures/sync-golden/`,
`tests/fixtures/products/good/`) and makes the steel thread's own guarantee re-checkable by CI rather
than remembered.

The fixture is a complete miniature: a `phase-00-spec.md`, an expected brief, and a ledger with slices
in every state the lint cares about — proven, unproven, and deliberately malformed. The root-mode
contract fixture (a tree with no `initiatives/` directory) lives beside it, because "root-mode stays
byte-identical" is a permanent consumer contract that only a fixture can hold to account.

## Consequences

Easier: any change to the ledger grammar, the lint, or the lifecycle is caught by CI on all three OS
legs rather than by a human noticing. The eval suite gets its first template for free.

Harder: the fixture is now a maintained artifact — a deliberate grammar change means a named
regeneration step, exactly as `tree-manifest.txt` does today (retro-log 2026-07-22: diff the delta
first, confirm only intended paths moved, then re-record).

What we would revisit if this goes wrong: if the fixture turns brittle, the response is to make it
assert the *rule* and branch on state — never to delete it and go back to a demo.
