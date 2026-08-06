/**
 * resolveEffectivePolicy -- the two-key authority state machine (POL-C, ADR-0505).
 *
 * Two keys per (action kind, capability) PAIR:
 *   ceiling -- declared by a human in hq.policy.yaml, changed only by a reviewed repo edit.
 *   cap     -- derived by folding the pair's transition events in SPINE APPEND ORDER.
 * effective = min(ceiling, cap), recomputed at every authorization.
 *
 * The pair is the key everywhere, because the ceiling is already per capability and
 * min(ceiling, cap) is only meaningful when both sides are keyed the same way. Keying the cap
 * per KIND would have compared values from two different key spaces -- not a conservative
 * simplification but a silent flattening of seven of the eight vectors.
 *
 * A demotion bites from the EFFECTIVE level, not from the cap. That is the difference between a
 * demotion and a no-op: a cap of L3 under a ceiling of L1 has an effective level of L1, so the
 * bite must land on L0. Taking one off the CAP would land on L2 and change nothing anyone can
 * observe -- the cap-above-ceiling no-op found in design review.
 *
 * ORDER: line/array order IS spine append order and is the only ordering used. `ts` is carried
 * for humans and is never sorted on -- that is the documented tie-break when a demotion and a
 * promotion decision land in the same tick, and a reducer that sorts by timestamp is wrong in a
 * way no other test would catch.
 *
 * The cap a demotion produces is COMPUTED here, never read from the event payload. A payload
 * that could set an arbitrary level would make a forged event a promotion.
 */

import { BIRTH_CAP, CAPABILITIES, isLevel, minLevel, oneDown } from "./model.mjs";

export const LEVEL_CHANGED = "policy.level.changed";
export const DEMOTED = "policy.demoted";

/** The ceiling a kind declares for a capability. An absent kind is read-only at L1 (POL-B). */
export function ceilingFor(policy, kind, capability) {
  const kinds = (policy && policy.kinds) || {};
  const entry = kinds[kind];
  if (!entry) return capability === "read" ? "L1" : "L0";
  const grant = entry[capability];
  if (!grant || typeof grant !== "object") return "L0";
  return isLevel(grant.level) ? grant.level : "L0";
}

/** The grant object (bounds live here), or null when the kind or capability is absent. */
export function grantFor(policy, kind, capability) {
  const entry = ((policy && policy.kinds) || {})[kind];
  if (!entry) return null;
  const grant = entry[capability];
  return grant && typeof grant === "object" ? grant : null;
}

/**
 * Fold the stream for one pair.
 * Returns { ceiling, cap, effective } -- all three, because a caller that only sees `effective`
 * cannot tell a lowered ceiling from a demotion, and those are different conversations.
 */
export function resolveEffectivePolicy(kind, capability, { policy, events } = {}) {
  if (!CAPABILITIES.includes(capability))
    throw new Error(`unknown capability ${JSON.stringify(capability)}`);

  const ceiling = ceilingFor(policy, kind, capability);
  let cap = BIRTH_CAP; // every pair is born at propose and climbs only by a human decision

  for (const event of events || []) {
    if (!event || typeof event !== "object") continue;
    const p = event.payload;
    if (!p || p.action_kind !== kind || p.capability !== capability) continue;

    if (event.kind === LEVEL_CHANGED) {
      if (isLevel(p.to_level)) cap = p.to_level;
      continue;
    }
    if (event.kind === DEMOTED) {
      // Bite from the effective level, and compute it -- never trust the payload's to_level.
      cap = oneDown(minLevel(ceiling, cap));
    }
  }

  return { ceiling, cap, effective: minLevel(ceiling, cap) };
}

/** The whole vector for one kind, for rendering and for the shell derivation rule. */
export function resolveVector(kind, { policy, events } = {}) {
  const out = {};
  for (const capability of CAPABILITIES)
    out[capability] = resolveEffectivePolicy(kind, capability, { policy, events });
  return out;
}
