# ADR 0505 — Authority is tracked per (action kind, capability) pair, and a demotion bites only the capability involved

**Status:** accepted
**Date:** 2026-08-06
**Product:** `policy`
**Reversibility:** two-way
**Revisit trigger:** dogfood shows an incident in one capability reliably predicting misuse in
another for the same kind — that is evidence for kind-wide demotion, and it reopens this ADR
with data rather than intuition.

## Context

The kickoff simulation gate found a contradiction in the schema as first drafted.
`hq.policy.yaml` grants a **separate level per capability per kind** — eight independent values
under `process:kickoff-plan`. But the event payloads drafted alongside it
(`policy.level.changed`, `policy.demoted`) carried `action_kind`, `from_level` and `to_level`
and **no capability field at all**, and the reducer fixture shape had the same hole.

That is not a missing field, it is an undecided semantic: does one promotion move one
capability's cap, or all eight at once? The two answers produce different reducer code, different
fixtures, different payload validators and a different demotion blast radius. POL-C fixed the
*arithmetic* of the two-key model (`effective = min(ceiling, cap)`, demotion bites from the
effective level) but never said what the key was.

## Options considered

1. **A — authority is per action kind.** One cap per kind, applied to all eight capabilities.
   Pros: smallest payloads, simplest reducer. Cons: contradicts the file, which already grants
   per capability, so `min(ceiling, cap)` would compare a per-capability ceiling against a
   kind-wide cap and silently flatten seven of the eight vectors — the capability vector stops
   being a vector.
2. **B — authority is per (action kind, capability) pair.** The cap is keyed the same way the
   ceiling is. Cons: every payload and fixture carries one more field.
3. **C — per kind for demotion, per capability for promotion.** Asymmetric: a raise is narrow, a
   fall is broad. Pros: arguably safer. Cons: two different keys in one state machine is how a
   reducer becomes unauditable, and it makes replay determinism harder to reason about for no
   evidence-backed benefit.

## Decision

**Option B.** The authority key is the pair **(action kind, capability)** everywhere — ceiling,
cap, effective level, both transition events, the approval profile, and the reducer.

- `policy.level.changed` payload: `action_kind`, `capability`, `correlation`, `decision_ref`,
  `from_level`, `policy_hash`, `to_level`, `trial_ledger_ref`.
- `policy.demoted` payload: `action_kind`, `capability`, `correlation`, `from_level`,
  `incident_ref`, `policy_hash`, `to_level`.
- The `approval.requested` `policy.promotion` profile gains `capability` on the same rule.
- Reducer state is a map keyed by the pair; a fixture's expected result names both.
- **A demotion bites only the capability involved in the denied action.** A kind that tried to
  write outside its roots loses a write level; its `network` grant is untouched.

The one reason that carried the most weight: **the ceiling is already per capability, and
`effective = min(ceiling, cap)` is only meaningful when both sides are keyed the same way.**
Option A would have compared values from two different key spaces, which is not a conservative
simplification — it is a silent flattening of seven vectors into one.

On the demotion blast radius specifically: kind-wide demotion is *tempting* because a
misbehaving kind feels untrustworthy as a whole. It is rejected for v1 because the evidence for
it does not exist yet, and A4's "trust is re-earned, never argued back" means every level lost
costs a human decision to restore — so an over-broad bite is not a free safety margin, it is
unearned friction charged to Ashiq. The revisit trigger above is what would earn it.

**That reasoning has a load-bearing premise — that the eight capabilities are independent — and
an adversarial pass showed it is false as stated.** A kind holding `shell: L2` with `node` or
`git` in `argv0_allow` can reproduce a denied `write` (`node -e "fs.writeFileSync(…)"`) and reach
the network (`git fetch`), so demoting only `write` after a write incident would leave the same
kind able to perform the identical write one step later. **ADR-0507 closes this, and it closes it
underneath this decision rather than by widening the bite:** a capability is capped at the
minimum of every capability its instruments can reproduce, and that minimum is recomputed at
every authorization — so demoting `write` automatically lowers `effective(shell)` for any kind
holding an interpreter. With ADR-0507 in place the per-capability bite is genuinely the smallest
*sufficient* blast radius. Without it, it would have been merely the smallest.

**Evidence:** the contradiction was found by the kickoff simulation gate reading only PLAN.md
and `phases/phase-00-spec.md` — the executor's real information set — and rated a blocker.
No external source involved; the two documents disagreed with each other.
**Confidence:** high.
**Rejected because:** A — compares a per-capability ceiling against a kind-wide cap, flattening
the vector model it is supposed to implement. C — two key spaces in one state machine, with no
evidence for the asymmetry.

## Consequences

Easier: the reducer, the validators and the file all key the same way, so replay determinism is
a property of one map rather than a reconciliation between two; demotion is precise enough that
an incident in one capability does not cost a human eight restorations. Harder: payloads carry
one more required field and the fixture matrix is larger — a promotion fixture set now has a
capability axis. Also note the reachable state this creates: one kind can legitimately sit at
`write: L2` and `network: L0` after a network incident, so any human-facing rendering of "the
level" of a kind must show the vector, never a single number.
