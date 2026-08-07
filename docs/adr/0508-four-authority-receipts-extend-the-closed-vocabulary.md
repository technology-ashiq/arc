# ADR 0508 — Four authority receipts extend the closed vocabulary, 40 to 44

**Status:** accepted
**Date:** 2026-08-06
**Product:** `policy`
**Reversibility:** one-way
**Revisit trigger:** none that removes a kind. A spine kind is permanent once emitted — the
receipts referencing it outlive any decision to stop using it, and ADR-0026's closure is what
makes "the vocabulary is closed" a checkable claim rather than a habit. A FIFTH policy kind
would be a new ADR, and the bar it must clear is the one below: a genuinely distinct truth
source, not a variant of an existing fact.

## Context

POL-E specified exactly four new kinds and the vocabulary has been closed since ADR-0026, so
adding them requires this record. The count is currently 40 (22 base ADR-0107 + 8 experiment
ADR-0309 + `council.outcome` ADR-0310 + 8 leads ADR-0400/0408 + `constitution.adopted` ADR-0073),
derived by `KINDS.length` rather than read off a document — the last count in a doc was wrong by
nine.

Phase 1 built the reducer and the money guard against injected event streams because these kinds
did not exist. Two adversarial findings made the gap concrete rather than theoretical:

- The run gate's event loader read `policy.level.changed` off disk with no validation, and since
  the sanctioned emitter would have quarantined that kind as `UNKNOWN_KIND`, **every event it
  could read was forged by construction.** A cap folded from that chain is the attacker's.
- `reserveAndSpend` emits `spend.reserved` and then calls a provider. With the kind outside the
  vocabulary every reservation receipt quarantines, the ledger reads zero forever, and every
  subsequent cap check passes. A quarantined money receipt is not a bookkeeping annoyance — it
  is budget nobody is holding.

Neither can be fixed anywhere but here.

## Options considered

1. **One `policy.changed` kind with a `direction` field.** Fewer kinds. Cons: a promotion and a
   demotion have different TRUTH SOURCES — one is a human decision that must cite the decision
   authorising it, the other is machine-derived and must cite the incident causing it. One kind
   means one payload shape, so both citations become optional, and an event asserting
   `direction: up` with no decision to point at is a forgery the validator cannot reject.
2. **One `spend.event` kind with a `state` field.** Same objection, and worse for money: the
   reservation and its settlement are written by different processes at different times, and a
   shared shape means neither can be required to carry what only it knows.
3. **Reuse `cost.incurred` for reservations.** It already exists. Cons: it records money that
   MOVED; a reservation records money that is HELD. Conflating them makes the ledger unable to
   distinguish a charge from a hold, which is the one distinction the double-spend guard is made
   of.
4. **Exactly four kinds, each with a closed payload validator.**

## Decision

**Option 4.** `policy.level.changed`, `policy.demoted`, `spend.reserved`, `spend.released`.
Vocabulary 40 → 44, validated in `.claude/scripts/hq/lib/validate-policy.mjs`, following the
`validate-experiment.mjs` / `validate-leads.mjs` pattern exactly (ADR-0304): one assert function
per kind, closed payload, unknown key is a hard error.

**Two kinds for one direction each, and that is the whole argument.** The
`revenue.received` / `revenue.simulated` pair is the precedent: they are separate not because
the data differs but because *who is entitled to assert them* differs. So
`policy.level.changed` requires `decision_ref` (a ULID pointing at the human decision) and
`trial_ledger_ref` (the evidence it rested on); `policy.demoted` requires `incident_ref` and
**may only ever lower a level** — the validator rejects a demotion whose `to_level` is not below
its `from_level`. Without that rule an attacker who can emit would always prefer the demotion
kind, because it needs no decision to cite.

**Every payload carries `capability`** (ADR-0505). Authority is keyed per (action kind,
capability) pair, and the first draft of these shapes omitted it — which would have compared a
per-capability ceiling against a kind-wide cap and silently flattened seven of the eight vectors.

**Every idem is a total preimage** over the identity-bearing fields (ADR-0304's rule, and C2's
scar: a partial preimage quarantined ~100 receipts as `DUP_IDEM`, and a cap derived from receipts
that were never written counts zero and never trips). For `spend.reserved` the preimage includes
the `idempotency_key`, so two reservations for one key collide as `DUP_IDEM` rather than both
being held — the idempotency guarantee becomes a property of the spine rather than of the
caller's diligence.

`spend.released` carries `released_on`, which is either `policy` or
`provider_attested_no_charge`. Those are different claims: one is the engine's own decision, the
other rests on a provider's word that it never charged — the single unverifiable delegation in
the money model (ADR-0506 has the same honesty note for `e2: []`). An auditor must be able to
tell them apart, so the distinction is a validated enum rather than free text in `reason`.

**Evidence:** `KINDS.length` = 40 before, 44 after, derived. All existing count assertions in
`tests/` read the length rather than hardcoding it (verified across `evolve-receipts.bats`,
`evolve-calibrate.bats`, `leads-receipts.bats`, `spine-constitution.bats`), which is ADR-0107's
rule doing exactly what it was written for — extending the vocabulary breaks no sibling lane.
The `UNKNOWN_KIND` message derives its count and now cites this ADR.
**Confidence:** high.
**Rejected because:** 1 and 2 — one kind means one payload, so the citation that makes each
assertion trustworthy becomes optional. 3 — a hold and a charge are the distinction the
double-spend guard is built from.

## Consequences

Easier: the reducer and the money guard can read the real spine instead of injected fixtures;
`loadPolicyEvents` can validate through the spine's own validator rather than trusting a file;
a duplicate reservation is refused by the spine rather than by the caller remembering to check.
Harder: four more shapes to keep closed, and the vocabulary is now 44 — every future addition
carries more weight, which is the intended friction. This is a **one-way door**: these kinds
will appear in receipts that outlive any decision to stop using them, so the payloads are worth
getting right now rather than superseding later.
