# ADR 0304 — EVO-D: every experiment receipt is typed, closed-payload and idem-bound

**Status:** accepted
**Date:** 2026-08-03
**Product:** `evolve`
**Reversibility:** two-way
**Revisit trigger:** a decision-critical field is discovered that no existing kind can carry —
which per ADR-0309 is a new kind by ADR, never a new payload field on an existing one.

## Context

The whole engine's guarantee is "if replay cannot re-derive it, it does not count". That only
holds if every decision-critical fact rides a validated field. A free-form payload is a place for
decision-critical data to hide from the validator, and the repo already has the counter-pattern:
`assertMoney` and `assertDecision` close their payloads, and `decision.idem` is a derived
preimage rather than a caller-supplied string.

## Options considered

1. **Free-form payloads per kind.** Cons: nothing validates the fields the verdict depends on;
   replay silently re-derives from whatever happened to be written.
2. **One generic `experiment.event` kind with a `type` discriminator.** Cons: one payload
   validator that must branch on `type` is the shape where a missing branch passes silently.
3. **One kind per lifecycle step, each with its own closed payload validator.** Chosen.

## Decision

Eight kinds, each with a closed payload validator, following the `assertDecision` template:

| Kind | Carries |
|---|---|
| `experiment.opened` | **`base_sha`** — the SHA-256 seal of the target file at open |
| `experiment.assigned` | unit → arm, cohort |
| `experiment.measured` | the experiment-attributed unit measurement, with cohort |
| `experiment.verdict` | config hash + metric hash, so replay re-derives the same decision |
| `promotion.proposed` | **`proposal_id` + `patch_sha` + `base_sha` + `candidate_sha`**; `kind: promote \| revert`; a revert also carries **`applies_to` + `restores`** |
| `experiment.promoted` | `proposal_id` + `commit_ref` + **`observed_candidate_sha` — REFUSED on mismatch** |
| `experiment.rolled_back` | emitted at the human merge, with the commit ref |
| `experiment.closed` | `winner \| no-verdict \| killed` + reason |

Rules that apply across all eight:

- **Free-form payloads never carry decision-critical experiment data.** If the verdict reads it,
  a validator asserts it.
- **Corrections ride `supersedes`, never overwrite** — the spine is append-only and every event
  already carries the field.
- Idems are total-preimage, following ADR-0302's formula shape, so two receipts that differ in
  any identity-bearing field can never collide.

The exact kind list is frozen here and registered by ADR-0309.

## Consequences

**Easier.** A replay can re-derive every verdict, because the inputs are validated fields rather
than convention. The `REFUSED on mismatch` rule on `experiment.promoted` turns "the human merged
the exact proposal" from a hope into a checked precondition.

**Harder.** Eight validators and their hostile fixtures are real work in Phase 0, and every one
is parser-class — meaning each needs the fresh-agent breaking-input pass, not the author's. The
2026-08-02 `develop` entry is the specific warning: a receipt emitter reported success while
every receipt was quarantined `UNKNOWN_KIND` and exit 0 hid it, so Phase 0's exit criteria assert
where receipts actually landed rather than trusting the writer's exit code.
