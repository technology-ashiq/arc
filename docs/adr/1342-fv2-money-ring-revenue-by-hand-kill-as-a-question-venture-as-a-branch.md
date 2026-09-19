# ADR 1342 — The money ring: revenue by the owner's hand, a kill as a question, a venture as a branch

**Status:** accepted
**Date:** 2026-09-19
**Product:** face (with additive changes in ledger/hq, under ADR-1339 and ADR-1340)
**Reversibility:** two-way
**Revisit trigger:** the ledger lane adds a `--ts` to ingest, or a venture.* kind is admitted (ADR-0026) -- either one
replaces a choice below; the ledger lane rejects an additive change here -- that verb becomes a residue row (ADR-1339).
**Provenance:** Phase 05 PR 5a carries three of the money and company ring's seven verbs: record real revenue
(ingest), propose a kill review, and register a venture. The other four -- the leads send, the legal stamp, a lane's
status and a concept -- follow in 5b and 5c.

## Context

The probe (evidence/phase-05/cli-probe.md) found no CLI for any of the three:
- **ingest** had parsers and a normalizer in the ledger's library, and only `arc-event ingest` for one hand-built
  payload. revenue.received "is recorded by a person's hand only".
- **kill review** had a panel that displays crossed lines and nothing that raises the question.
- **register** had no kind: `venture.registered` is not in the closed vocabulary, and a venture exists only where
  ventures.yaml gives it kill lines (ADR-1008) and PORTFOLIO.md gives it a passport row.

## Decision

1. **Ingest is a thin CLI over the ledger's own library** (`hq/ledger-ingest.mjs`): the provider's parser reads the
   export, the normalizer makes each row a payload, and each lands through `arc-event ingest`, whose idem is the
   payment's content, so one payment is one receipt however often it is recorded. It is a bound (`--expect`) op, run
   on the owner's click only; the plan names each row, skips rows already on the spine (one payment is one venture's),
   refuses a venture ventures.yaml does not register, and names the export by its digest, never its path.
   **When a row counts:** the spine stamps a receipt with the moment it is recorded, and a closed day takes no new
   event (ADR-0029). A settlement dated in an earlier month counts in the month it is recorded, and the plan says so
   row by row. Stamping the settlement's own instant would need an ingest `--ts` and a rule for closed days: the
   ledger lane's call, recorded as the revisit trigger, not taken here.
2. **A kill review is a question, never an action.** `arc-pnl --kill-request VENTURE --reason WHY` prints the emit of
   approval.requested (gate `venture-kill`) carrying the venture's kill lines as the panel reads them, the crossed
   ones, and the criteria digest; one per venture, per criteria version, per decided review before it (the idem). It refuses under an
   unreceipted criteria file (the lines are not the owner's yet). The owner's stamp in the inbox is the decision; the
   attic, the retro and the harvest stay the owner's.
3. **A venture is registered on a proposal branch** (`hq/venture-register.mjs`, ADR-1340's rule for law files):
   its kill lines appended to ventures.yaml and proven by the ledger's parser, its passport row, its room in the
   face's contract and what the contract derives, then the ledger's existing criteria request (ADR-1017) for the
   digest the new file parses to. The three sets (ventures.yaml, passports, contract) must agree on main first.
   Approved and merged, the kill panel renders the venture; merged without approval, it refuses -- the mechanism
   working.

## Consequences

- Three Phase 03 cards retire: money's "Record real revenue", ventures' "Register a venture" and "Propose a kill
  review". Staging a venture stays a card.
- Two new CLIs in the ledger lane's folder, and one flag on arc-pnl; each carries its tests in
  `tests/face/money-work.mjs`, and the ledger's own suites must stay green.

## Amendment, PR 5a round 1 (next day)

A fresh pair found 7 logic and 6 shell holes. All but one (a debt row) are fixed and pinned. One decision sharpens: **a
venture is registered only on top of criteria the owner has already approved** -- the criteria request covers the
whole file, so without that gate an unreceipted change on main would be approved under the new venture's name.

## Amendment, PR 5a round 2 (same day, the last round)

The second pair found one HIGH both of them hit: the kill review asked a possibly stale sqlite index whether a review
was open. It now always reads the spine itself. The kill idem no longer carries the day; it is welded to the last
decided review, so two plans held open across midnight are one question. `--repository` is allow-listed to three
shapes. The owner capped attack rounds at two per PR, so what is left goes to the debt ledger.
