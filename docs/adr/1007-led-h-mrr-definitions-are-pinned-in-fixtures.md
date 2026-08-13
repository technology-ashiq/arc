# ADR 1007 — LED-H: MRR definitions are pinned in fixtures, and cash-in is reported beside them

**Status:** accepted
**Date:** 2026-08-12
**Product:** `ledger`
**Reversibility:** two-way
**Revisit trigger:** a definition here is found to disagree with what the owner actually means when
he says MRR — the fixture is then changed in one place and every number moves with it.

## Context

MRR is not one number, it is a family of conventions, and every SaaS argument about it is really an
argument about which convention. Left unpinned, the definition drifts silently between the code,
the render and the reader's head, and the same month reports different figures in different places.

The design source names this as a rabbit hole in advance: taxonomy bikeshedding.

## Options considered

1. **Pin every definition as an executable fixture** — the fixture is the definition; disagreement
   is resolved by editing one file and watching every number move.
2. **Document the definitions in prose** — prose and code drift, and the code wins silently.
3. **Make the conventions configurable** — turns a rabbit hole into a feature and guarantees the
   argument recurs at every render.

## Decision

Option 1, with these conventions pinned:

- **MRR base is the recurring amount ex-tax.** Tax is not revenue; it is collected on behalf of
  someone else. Gateway fees do **not** reduce MRR — they appear on the fee line, because a fee is a
  cost of collection, not a smaller subscription.
- **Transitions:** new · expansion · contraction · churn · reactivation. All five are pinned as
  fixtures.
- **Annual and quarterly plans are normalized** to MRR (divide by 12 and by 3) and rendered
  **beside** a cash-in line. Both are labelled; they are never conflated and never added.
- **Refunds and partial refunds enter as superseding negative events, never as edits.**
- **Over-refund (refund greater than the original) raises a needs-you flag** and is never silently
  netted — it is either a data error or something that needs a human, and both deserve a human.

The reason that carried the most weight: an annual plan paid up front is a large cash-in and a
modest MRR, and any single number that tries to be both is wrong twice.

## Consequences

Easier: the argument happens once, here, and afterwards a disagreement is a fixture diff.

Harder: two revenue lines exist where a reader may expect one, and the difference has to be
understood once.

Re-litigating these definitions mid-build is a named rabbit hole. The detour is: change the
fixture, or leave it alone.
