# ADR 1748 — fit rules carry ids, ranking is two named rules, and an override is an approved request plan cites

**Status:** accepted
**Date:** 2026-10-09
**Product:** `launch`
**Reversibility:** two-way
**Revisit trigger:** receipt weighting's trigger fires (two or more vetted providers in a slot and two or more ventures
with receipts, ADR-1706), or an owner asks for an override that `apply` takes without `--provider`

## Context

REQ-08: `plan` prints, per slot, `recommended · why (fit-rule ids · status · last_verified) · alternatives · REFUSED
(reason)`, and "an override is a `decision.recorded` the next `plan` cites by id". ADR-1706 chose fit rules with ids
over a hand-kept ranking. Phase 01's `plan` printed the three fit facts with no ids, and had no ranking or override.

## Decision

- **Fit rules**, in `board.mjs` `FIT_RULES`: `FIT-1` type (the row's `fits` holds the venture's type), `FIT-2` region
  (`any` or equal), `FIT-3` payment_model (`any` or equal). A pick prints every rule id with what it matched. A vetted
  row that fails prints the one rule that excluded it.
- **Ranking** among vetted fitting rows: `RANK-1` the most recently verified first, then `RANK-2` the row id, so the
  order is stable and is never read as a preference. When more than one row fits, the line names both rules.
- **Override**: `arc-launch override SLOT --venture V --provider ID --reason TEXT` emits `approval.requested` with
  `subject: launch.override`, the slot, the provider and the reason, and exits 5. A blocked, retired or unknown row,
  and a reason shorter than eight characters, are refused before anything is emitted. The owner decides it in
  arc-inbox. `plan` folds approved requests (newest decision per slot) and prints `recommended <id> -- why: owner
  override, decision <ULID>`. An undecided or rejected request changes nothing. An override naming a row that is
  later blocked is shown as "not taken".
- `apply` is unchanged: with two vetted rows it still needs `--provider`. The override is the plan's recommendation,
  not a hidden choice the runner makes.

## Consequences

- No new spine kind: the override rides `approval.requested` and `decision.recorded`, like ledger's criteria.
