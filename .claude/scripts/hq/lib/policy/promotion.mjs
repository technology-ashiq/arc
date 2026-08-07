/**
 * The promotion chain and automatic demotion (REQ-04, POL-C).
 *
 *   request   `approval.requested` under the strict `policy.promotion` profile
 *   decide    a human `decision.recorded` through the inbox
 *   apply     `policy.level.changed` citing that decision
 *
 * THE CEILING IS CHECKED AT DECISION TIME, NOT AT REQUEST TIME, and that is the whole reason
 * this module exists rather than a validator rule. A ceiling is a human repo edit (POL-A), so it
 * can be LOWERED between the moment a promotion is requested and the moment it is approved --
 * and the request carries the old ceiling in its `policy_hash`. Checking only at request time
 * would let a stale approval apply a level the file no longer permits, with a receipt that looks
 * perfectly legitimate. So the level is re-derived from the CURRENT policy when the decision is
 * applied, and an approval that has gone out of date is refused rather than clamped: silently
 * granting less than a human approved is its own lie.
 *
 * DEMOTION IS MACHINE-DERIVED AND BITES FROM THE EFFECTIVE LEVEL (POL-C). One level down,
 * floored at L0, for the capability involved in the denied action only (ADR-0505) -- and
 * computed here, never taken from an incident payload, because a level an event can name is a
 * level an event can forge.
 */

import { minLevel, oneDown, rank, isLevel } from "./model.mjs";
import { ceilingFor, resolveEffectivePolicy } from "./reduce.mjs";
import { policyHash } from "./encode.mjs";

export const PROMOTION_SUBJECT = "policy.promotion";

/**
 * Build the `approval.requested` payload. The request records the level the requester is asking
 * for and the evidence they are asking a human to weigh -- never a justification in prose, which
 * is why `trial_ledger_ref` is a citation and not a paragraph.
 */
export function buildPromotionRequest({ kind, capability, toLevel, trialLedgerRef, what }, { policy, events }) {
  if (!isLevel(toLevel)) throw new Error(`to_level ${JSON.stringify(toLevel)} is not a level`);
  const { effective, ceiling } = resolveEffectivePolicy(kind, capability, { policy, events });

  if (rank(toLevel) <= rank(effective))
    throw new Error(`${kind}/${capability} is already at ${effective}; a promotion must raise the level`);
  if (rank(toLevel) > rank(ceiling))
    throw new Error(
      `${kind}/${capability} cannot be promoted to ${toLevel}: the declared ceiling is ${ceiling}. ` +
      `Raising a ceiling is a repo edit in a reviewed diff (POL-A), never something an approval grants.`
    );
  if (!trialLedgerRef || String(trialLedgerRef).trim() === "")
    throw new Error("a promotion request must cite trial-ledger evidence — trust is re-earned, never argued back (A4)");

  return {
    action_kind: kind, capability, correlation: `promote-${kind}-${capability}`,
    from_level: effective, gate: "policy", policy_hash: policyHash(policy),
    subject: PROMOTION_SUBJECT, to_level: toLevel,
    trial_ledger_ref: String(trialLedgerRef),
    what: what || `raise ${kind}/${capability} from ${effective} to ${toLevel}`,
  };
}

/**
 * Turn an approved decision into the `policy.level.changed` payload — or refuse.
 *
 * `request` is the original `approval.requested` event, `decision` the `decision.recorded` that
 * answers it. Both are required: a level change that cannot name the decision authorising it is
 * indistinguishable from a forgery.
 */
export function applyDecision({ request, decision }, { policy, events }) {
  if (!request || !request.payload || request.payload.subject !== PROMOTION_SUBJECT)
    throw new Error("applyDecision needs the approval.requested it answers, under the policy.promotion profile");
  if (!decision || !decision.payload) throw new Error("applyDecision needs the decision.recorded");
  if (decision.payload.decides !== request.id)
    throw new Error(`decision ${decision.id} decides ${decision.payload.decides}, not this request ${request.id}`);
  if (decision.payload.verdict !== "approve")
    throw new Error(`the decision verdict is ${JSON.stringify(decision.payload.verdict)} — only an approval applies a level change`);

  const p = request.payload;
  // RE-DERIVED FROM THE CURRENT FILE. The ceiling in the request may be stale by now.
  const ceilingNow = ceilingFor(policy, p.action_kind, p.capability);
  if (rank(p.to_level) > rank(ceilingNow))
    throw new Error(
      `the approval grants ${p.to_level} but the ceiling for ${p.action_kind}/${p.capability} is now ` +
      `${ceilingNow}. The ceiling was lowered after the request; this approval is out of date and is ` +
      `refused rather than quietly applying less than a human approved.`
    );

  const { effective } = resolveEffectivePolicy(p.action_kind, p.capability, { policy, events });
  return {
    action_kind: p.action_kind, capability: p.capability,
    correlation: p.correlation, decision_ref: decision.id,
    from_level: effective, policy_hash: policyHash(policy),
    to_level: p.to_level, trial_ledger_ref: p.trial_ledger_ref,
  };
}

/**
 * The `policy.demoted` payload for an incident. Returns null when there is nothing left to take
 * — a pair already at L0 does not produce a receipt asserting a change that did not happen.
 */
export function buildDemotion({ kind, capability, incidentId }, { policy, events }) {
  if (!incidentId) throw new Error("a demotion must cite the incident that caused it");
  const { effective } = resolveEffectivePolicy(kind, capability, { policy, events });
  const to = oneDown(effective);
  if (to === effective) return null; // already at L0
  return {
    action_kind: kind, capability, correlation: `demote-${kind}-${capability}`,
    from_level: effective, incident_ref: incidentId,
    policy_hash: policyHash(policy), to_level: to,
  };
}

/** The effective level a pair would hold after this demotion, without emitting anything. */
export const levelAfterDemotion = (kind, capability, { policy, events }) => {
  const { ceiling, effective } = resolveEffectivePolicy(kind, capability, { policy, events });
  return minLevel(ceiling, oneDown(effective));
};
