# ADR 1011 — LED-L: ledger adds no policy subject, and must not become a self-authorizing money actor

**Status:** accepted
**Date:** 2026-08-12
**Product:** `ledger`
**Reversibility:** two-way
**Revisit trigger:** ledger gains a capability no existing subject authorizes — a provider API call,
a network fetch, or any non-human-initiated emission — at which point it becomes its own subject
and is born with its row in the same change.

## Context

The kickoff prompt carried a pre-kickoff checklist item: *"Policy C9 is live: hq.policy.yaml rows
for the month-close and revenue-ingest action kinds land in the same change (POL-I birth rule)."*
Verified against the live tree on 2026-08-12, that item rests on a misreading of the subject model,
and this ADR records the correction rather than executing the instruction.

`hq.policy.yaml` keys **subjects**, not event kinds. It holds exactly four —
`session:interactive`, `process:kickoff-plan`, `process:review-diff`, `process:commit-msg-draft` —
and `process:NAME` resolves against `processes/*.process.yaml`, authorized at the `arc-run` wrapper
(`ADR-0504`). There is no such thing as a policy row for an *action kind* like "month-close" or
"revenue-ingest"; those are things a human does with a CLI.

Two precedents already answer this exact question, and the second one answers it after making the
same initial mistake:

- **`ADR-0703`** (memory, MEM-D): a reader-only module that emits nothing needs no rows — POL-I is
  not applicable.
- **`ADR-0912`** (bench): *"An initial reading of this gate concluded bench needed a `process:bench`
  row carrying spend, network and write. That reading was wrong, and it matters why: it would have
  created a new subject that authorizes bench's spending in its own name, decoupled from the
  process actually being run."*

Ledger is the worst possible module in which to repeat that mistake. Constitution **E2 lists
"moving money" as an ungrantable action** — no grant, at any level, may authorize it. A
`process:ledger` row carrying write and spend would be a money-named subject that authorizes itself,
which is precisely the coupling the policy engine exists to prevent.

## Options considered

1. **No new subject.** Ledger is reader-only (LED-A) with one human-run emission. By POL-B's
   deny-by-default, a subject absent from the file is read-only at L1 — which is exactly and
   permanently the authorization ledger should have.
2. **Author a `process:ledger` row** with write and spend, per the literal checklist item — creates
   a self-authorizing money subject, decoupled from any process, next to an ungrantable-actions list
   whose first entry is "moving money".
3. **Add rows keyed on the action kinds** (`month-close`, `revenue-ingest`) — not expressible: the
   file has no such key space, so `policy-lint` would reject the rows and the birth-rule check would
   never see them.

## Decision

Option 1. **Ledger adds no `hq.policy.yaml` row and no `processes/ledger.process.yaml`.** It stays
read-only at L1 by deny-by-default, which is the correct and intended authorization for a module
that reads receipts and renders text.

Ledger **records** money; it never **moves** money. No ledger code initiates a payment, refund,
transfer or price change, and nothing in this lane may be built that does — that is E2, not a
preference.

The reason that carried the most weight: the checklist item asked for a control, and the thing it
asked for would have removed one.

## Consequences

Easier: the birth-rule check in `kickoff-lint` stays quiet for this lane because there is genuinely
nothing to govern — no process file, no row, no gap. The E2 boundary stays where the Constitution
put it.

Harder: an operator reading the original plan will expect policy rows and not find them. That is
why this correction is an ADR with the checklist item quoted, rather than a silent omission.

If ledger later needs a real capability — fetching an exchange rate, calling a provider API — the
revisit trigger fires and the subject is born **with** its row, in the same change, at L1.
