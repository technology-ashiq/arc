# ADR 1008 — LED-I: `ventures.yaml` is a root company organ, and moving a goalpost needs a receipt

**Status:** accepted
**Date:** 2026-08-12
**Product:** `ledger`
**Reversibility:** two-way
**Revisit trigger:** the receipt requirement is routinely satisfied by a rubber-stamp
`decision.recorded` written in the same minute as the edit — the control is then theatre and needs
teeth or removal.

## Context

Kill criteria are the numbers that decide whether a venture lives. They therefore attract the
oldest failure in self-assessment: when the line is about to be crossed, the line moves. A file
edit leaves a git commit, which is a record of *what* changed and not of *that someone decided
to change it* — and in a repo where the author and the approver are the same person, the
distinction is the entire control.

Placement: kill criteria span every venture and belong to no lane, which is the shared-company-organ
pattern (`ADR-0053`, `docs/adr/0053-port-d-shared-company-organs-stay-single.md`; evidence scoping
per `ADR-0055`).

## Options considered

1. **Root `ventures.yaml`, schema-versioned, edits honored only with an accompanying
   `decision.recorded` receipt naming the change.**
2. **Criteria inside each lane's tracker** — closer to the work, and there is then no single place
   to ask "what are all the lines", which is the question that matters.
3. **Criteria as spine events only** — maximally receipted, and unreadable: the current criteria
   become a fold over history rather than a file anyone can open.

## Decision

Option 1. `ventures.yaml` lives at the repo root, is schema-versioned, and holds **criteria, never
money** (LED-B, ADR-1001). An edit is honored **only** with an accompanying `decision.recorded`
receipt naming the change; a silent edit produces a loud `UNRECEIPTED CRITERIA CHANGE` refusal,
pinned as a fixture.

**v1 ships exactly the two sketched criteria** — `days_without_revenue` and
`traffic_floor_monthly`. An MRR-floor criterion is deliberately *not* added even though ledger now
computes MRR: the receipted-edit design means new criteria are a tracked decision later, and
Phase 1 has two days.

The reason that carried the most weight: an unreceipted goalpost move is indistinguishable from
the goalpost having always been there.

## Consequences

Easier: "why is the line here" always has an answer on the record, and the answer is dated.

Harder: adjusting a criterion is two acts instead of one. That friction is the feature, applied to
the one file where a frictionless edit is most dangerous.

`ventures.yaml` is parser-class: it gets the mandatory adversarial construct-a-breaking-input pass,
holes fixed and pinned as red fixtures, before its lint is promoted from WARN to FAIL. A criteria
parser that accepts a malformed line is a criteria parser that silently disables a kill switch.
