// lineage.mjs — the four-hop SHA chain, and the propose-only boundary.
//
// THE NON-NEGOTIABLE THIS FILE ENFORCES: the machine NEVER writes a canonical file. Not to
// promote, not to revert, no exceptions and no carve-outs (Constitution A6, ADR-0305). Every
// function here returns a PROPOSAL or a REFUSAL. There is no filesystem write anywhere in this
// module, and `tests/evolve-lineage.bats` asserts that by grepping the source — a rule that
// depends on nobody adding one later is not a rule.
//
// THE CHAIN. Four hops, each binding a SHA to the one before it:
//
//   1 opened      base_sha       the target's digest when the experiment opened (the SEAL)
//   2 proposed    patch_sha      + base_sha + candidate_sha: what the diff would produce
//   3 promoted    observed_...   what a HUMAN actually merged. Must equal candidate_sha.
//   4 watch       current        what is actually SERVED. Must still equal candidate_sha.
//
// Every hop can REFUSE, and every refusal has a negative-control fixture proving it can fire.
// A chain whose links have only ever been observed succeeding has not been shown to be a chain.
//
// The four failure classes this lane keeps rediscovering are all live here, so they are checked
// for by name rather than waited on: no in-band separators (hashing goes through canon.mjs), no
// refusal sharing a channel with an answer (every function returns {ok} or {refused, reason}),
// no throwing instead of refusing, and the read path re-asserts what the write path validated.

import { digest } from "./canon.mjs";

const HEX64 = /^[0-9a-f]{64}$/;
const isSha = (v) => typeof v === "string" && HEX64.test(v);
const isNonEmptyString = (v) => typeof v === "string" && v.length > 0;

const ok = () => ({ ok: true, reason: null });
const no = (reason) => ({ ok: false, reason });

// ---------- hop 1 -> 2: may a proposal be generated at all? ----------

/**
 * A diff may be generated only against the sealed `base_sha`, only onto a target on the module's
 * `promote_via` allowlist, and only while the seal still holds.
 *
 * @param {object} p
 *   experiment   {experiment_id, target_path, base_sha}
 *   currentSha   the target's digest RIGHT NOW
 *   promoteVia   the allowlist from the module's evolve section
 */
export function mayPropose(p) {
  if (p === null || typeof p !== "object") return no("proposal input is not an object");
  const x = p.experiment;
  if (x === null || typeof x !== "object") return no("experiment is not an object");
  if (!isSha(x.base_sha)) return no("the experiment carries no sealed base_sha");
  if (!isNonEmptyString(x.target_path)) return no("the experiment carries no target_path");
  if (!Array.isArray(p.promoteVia)) return no("the promote_via allowlist is not an array - refusing rather than assuming it permits this target");
  // OWN membership, exact string. An allowlist checked with `includes` on a non-array, or read
  // through a prototype, is not an allowlist.
  if (!p.promoteVia.includes(x.target_path)) return no(`target ${x.target_path} is not on the promote_via allowlist`);
  if (!isSha(p.currentSha)) return no("the current target digest is not a sha256 digest");
  // THE SEAL. If the canonical file moved since the experiment opened, every measurement was
  // taken against bytes that are no longer there, and there is no honest way to attribute them
  // either side of the change. A proposal is impossible, not merely discouraged.
  if (p.currentSha !== x.base_sha)
    return no(`canonical-drift: sealed at ${x.base_sha.slice(0, 12)}, target is now ${p.currentSha.slice(0, 12)} - no proposal may be generated`);
  return ok();
}

// ---------- the proposal itself ----------

/**
 * Build the `promotion.proposed` payload. Pure: it computes identifiers and returns them. It
 * writes nothing, and it cannot — there is no fs import in this file.
 */
export function buildProposal({ experiment, candidateSha, patchSha, kind = "promote", appliesTo = null, restores = null }) {
  if (!isSha(candidateSha)) throw new TypeError("candidate_sha must be a sha256 digest");
  if (!isSha(patchSha)) throw new TypeError("patch_sha must be a sha256 digest");
  if (kind !== "promote" && kind !== "revert") throw new TypeError("kind must be promote or revert");
  if (candidateSha === experiment.base_sha)
    throw new RangeError("candidate_sha equals base_sha - the proposal changes nothing, which is far more likely a diff that silently produced no change than a no-op someone meant to propose");
  const payload = {
    proposal_id: `p-${digest("evolve/proposal/v1", [experiment.experiment_id, experiment.base_sha, candidateSha, patchSha, kind]).slice(0, 32)}`,
    experiment_id: experiment.experiment_id,
    kind,
    patch_sha: patchSha,
    base_sha: experiment.base_sha,
    candidate_sha: candidateSha,
  };
  if (kind === "revert") {
    if (!isSha(appliesTo) || !isSha(restores)) throw new TypeError("a revert must carry applies_to and restores");
    if (appliesTo === restores) throw new RangeError("applies_to equals restores - the revert restores what is already there");
    payload.applies_to = appliesTo;
    payload.restores = restores;
  }
  return payload;
}

// ---------- hop 3: did the human merge THIS proposal? ----------

/**
 * `experiment.promoted` may be emitted ONLY if the SHA observed in the merged file equals the
 * proposal's `candidate_sha`.
 *
 * This is what turns "the human merged the exact proposal" from a hope into a checked
 * precondition. A human who edited the diff before merging, or merged a different proposal, or
 * merged something that was rebased on the way — all produce a different observed SHA, and all
 * are refused with the two digests named.
 */
export function mayRecordPromotion({ proposal, observedSha }) {
  if (proposal === null || typeof proposal !== "object") return no("proposal is not an object");
  if (!isSha(proposal.candidate_sha)) return no("the proposal carries no candidate_sha");
  if (!isSha(observedSha)) return no("the observed merged digest is not a sha256 digest");
  if (observedSha !== proposal.candidate_sha)
    return no(`merged bytes do not match the proposal: expected ${proposal.candidate_sha.slice(0, 12)}, observed ${observedSha.slice(0, 12)} - the promotion receipt is REFUSED`);
  return ok();
}

// ---------- hop 4: is the watch window watching what is actually served? ----------

/**
 * The watch window runs ONLY while the served file's digest still equals `candidate_sha`.
 *
 * `servedSha` must come from wherever the target is actually SERVED. For any target with a
 * deploy step, a working-tree match with NO confirming deploy receipt does not start the watch —
 * otherwise the watch passes while watching bytes nobody is running, which is a green light
 * derived from a file that never reached a user.
 */
export function mayWatch({ proposal, servedSha, requiresDeploy = false, deployReceipt = null }) {
  if (proposal === null || typeof proposal !== "object") return no("proposal is not an object");
  if (!isSha(proposal.candidate_sha)) return no("the proposal carries no candidate_sha");
  if (!isSha(servedSha)) return no("the served digest is not a sha256 digest");
  if (requiresDeploy) {
    if (deployReceipt === null || typeof deployReceipt !== "object")
      return no("this target has a deploy step and no deploy receipt confirms what is served - the watch does not start on a working-tree match alone");
    if (!isSha(deployReceipt.served_sha))
      return no("the deploy receipt carries no served_sha");
    if (deployReceipt.served_sha !== servedSha)
      return no(`the deploy receipt says ${deployReceipt.served_sha.slice(0, 12)} is served but the target reads ${servedSha.slice(0, 12)}`);
  }
  if (servedSha !== proposal.candidate_sha)
    return no(`post-promotion drift: promoted ${proposal.candidate_sha.slice(0, 12)}, served is now ${servedSha.slice(0, 12)}`);
  return ok();
}

// ---------- drift after promotion ----------

/**
 * What to do when the promoted surface has drifted underneath the watch.
 *
 * The answer is NOT to generate a revert. The machine never writes a canonical file in either
 * direction (ADR-0305), and here it does not even propose one: something else changed those
 * bytes, this engine does not know what or why, and a machine-generated patch on top of an
 * unexplained change is how an incident becomes two incidents.
 *
 * So: raise, freeze, and hand a human the two digests and the archived champion.
 */
export function onPostPromotionDrift({ proposal, observedSha, championBaseSha }) {
  return {
    incident: {
      kind: "post-promotion-drift",
      proposal_id: proposal?.proposal_id ?? null,
      expected_sha: proposal?.candidate_sha ?? null,
      observed_sha: isSha(observedSha) ? observedSha : null,
      archived_champion: isSha(championBaseSha) ? championBaseSha : null,
    },
    surface: "FROZEN",
    action: "manual intervention required",
    // Stated as data, not prose, so a test can assert it rather than reading the message.
    machine_generated_revert: false,
    why: "the surface changed for a reason this engine cannot see; a machine-generated patch on top of an unexplained change turns one incident into two",
  };
}

/**
 * A degradation caught by the watch, where the engine DOES have its own observation above floor.
 *
 * Here a revert diff IS prepared — and it is still only a PROPOSAL, bound to the SHA it applies
 * to and the SHA it restores. ADR-0305: propose-only is absolute in BOTH directions, so the
 * urgent path and the happy path end at the same inbox.
 */
export function onDegradation({ proposal, championBaseSha, ownObservationMeetsFloor }) {
  if (!ownObservationMeetsFloor) {
    return {
      incident: { kind: "degradation-suspected", proposal_id: proposal?.proposal_id ?? null },
      surface: "FROZEN",
      action: "manual intervention required",
      revert_proposal: null,
      why: "the degradation is below this engine's own observation floor, so it is not measured well enough to act on - freezing is honest, proposing a revert on it would not be",
    };
  }
  return {
    incident: { kind: "degradation-confirmed", proposal_id: proposal?.proposal_id ?? null },
    surface: "FROZEN",
    class_demoted_to: "L1",
    revert_proposal: buildProposal({
      experiment: { experiment_id: proposal.experiment_id, base_sha: proposal.candidate_sha },
      candidateSha: championBaseSha,
      patchSha: digest("evolve/revert-patch/v1", [proposal.proposal_id, proposal.candidate_sha, championBaseSha]),
      kind: "revert",
      appliesTo: proposal.candidate_sha,
      restores: championBaseSha,
    }),
    // The urgent path proposes. It does not merge, and it does not write.
    merged_by_machine: false,
  };
}

// ---------- the evidence table (ADR-0310, field-frozen) ----------

const EVIDENCE_FIELDS = Object.freeze([
  "proposal_id", "experiment_id", "surface", "target_path", "arm_tags", "n_per_arm",
  "successes_per_arm", "point_delta", "bound", "alpha", "effect_floor", "mde",
  "guardrail_status", "windows", "missing_windows", "cohort_audit", "config_hash",
  "base_sha", "patch_sha", "candidate_sha",
]);

/**
 * Build the inbox evidence table. The field list is FROZEN by ADR-0310 and there is deliberately
 * no free-form commentary field: the table IS the evidence, and anything not in this list is not
 * evidence the human is being asked to weigh.
 *
 * A missing field is rendered MISSING rather than omitted — an omitted row reads as "nothing to
 * report", which is the same lie as counting an absent window as zero.
 */
export function evidenceTable(data) {
  const rows = [];
  for (const f of EVIDENCE_FIELDS) {
    const v = data === null || typeof data !== "object" || !Object.hasOwn(data, f) ? null : data[f];
    rows.push({ field: f, value: v === null || v === undefined ? "MISSING" : v });
  }
  return rows;
}

export { EVIDENCE_FIELDS };
