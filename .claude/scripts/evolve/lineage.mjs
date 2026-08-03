// lineage.mjs — the four-hop SHA chain, and the propose-only boundary.
//
// THE NON-NEGOTIABLE: the machine NEVER writes a canonical file. Not to promote, not to revert,
// no exceptions and no carve-outs (Constitution A6, ADR-0305). Every function here returns a
// PROPOSAL or a REFUSAL. There is no filesystem or process import in this module, and
// `tests/evolve-lineage.bats` asserts that by PARSING the import specifiers — not by grepping,
// because the grep it used first missed `from "fs"`, `fs/promises`, `child_process` and the async
// `exec`/`spawn`, and a mutant that overwrote the canonical file, deleted the archived champion,
// committed and spawned a deploy passed it clean.
//
// THE CHAIN, and what each hop binds:
//
//   1 opened      base_sha              the target's digest when the experiment opened (the SEAL)
//   2 proposed    patch_sha + candidate the diff, minted only from a verified hop-1 ticket
//   3 promoted    observed_sha          what a HUMAN merged. Must equal candidate_sha.
//   4 watch       served_sha            what is actually SERVED. Must still equal candidate_sha.
//
// HOPS 3 AND 4 ARE ATTACHED TO HOPS 1 AND 2. The first version checked each hop against itself,
// so any object carrying a well-formed `candidate_sha` was a proposal, and a deploy receipt for a
// different target from a different year authorised the watch as long as the digests coincided.
// Three independent self-consistency checks are not a chain. Every hop now verifies the
// proposal's own id, which commits to the whole payload.
//
// READ ONCE, COMPARE THE VALUE READ. Every field is captured into a const before it is validated,
// and the captured value is what gets compared. The first version validated one read and compared
// a second, so an accessor, Proxy or lazy row returned a valid SHA to the validator and the
// attacker's SHA to the comparator — walking hops 1, 3 and 4 with every premise false.
//
// OWN PROPERTIES ONLY, and no method lookups on caller data. `promoteVia.includes(...)` is a
// prototype method: a Proxy, an Array subclass, or a polluted `Array.prototype.includes` all made
// it return true for a target that was not on the list.

import { digest, tryDigest } from "./canon.mjs";

const HEX64 = /^[0-9a-f]{64}$/;
const isSha = (v) => typeof v === "string" && HEX64.test(v);
const isNonEmptyString = (v) => typeof v === "string" && v.length > 0;

// A plain object, not a Proxy, not an array, not a class instance. Every gate below takes one.
const isPlainObject = (v) => {
  if (v === null || typeof v !== "object" || Array.isArray(v)) return false;
  const p = Object.getPrototypeOf(v);
  return p === Object.prototype || p === null;
};

// Read an OWN property once. Returns undefined for anything inherited, so a polluted
// `Object.prototype.candidate_sha` cannot make `{}` a promotion receipt.
const own = (o, k) => (isPlainObject(o) && Object.hasOwn(o, k) ? o[k] : undefined);

const ok = (payload = {}) => ({ ok: true, reason: null, ...payload });
const no = (reason) => ({ ok: false, reason });

// ---------- the proposal id commits to the WHOLE payload ----------

const ID_FIELDS = Object.freeze([
  "experiment_id", "kind", "patch_sha", "base_sha", "candidate_sha", "applies_to", "restores",
]);

/**
 * The id is a hash of every field that says what the proposal DOES.
 *
 * The first version omitted `applies_to` and `restores` — the two SHAs that define what a revert
 * restores — so two reverts with completely different targets minted the SAME id, and fields
 * could be added after minting while the id still verified.
 */
export function proposalIdFor(payload) {
  const parts = ID_FIELDS.map((f) => {
    const v = own(payload, f);
    return v === undefined ? null : v;
  });
  const { hash, reason } = tryDigest("evolve/proposal/v2", parts);
  return hash === null ? { id: null, reason } : { id: `p-${hash.slice(0, 32)}`, reason: null };
}

/** Does this payload's id actually commit to this payload? Every later hop calls it first. */
export function verifyProposalId(payload) {
  const declared = own(payload, "proposal_id");
  if (!isNonEmptyString(declared)) return no("the proposal carries no proposal_id");
  const { id, reason } = proposalIdFor(payload);
  if (id === null) return no(`the proposal id could not be recomputed: ${reason}`);
  return declared === id ? ok() : no(`the proposal_id does not commit to this payload: declared ${declared}, recomputed ${id} - a field was changed after minting`);
}

// ---------- hop 1 -> 2 ----------

/**
 * May a diff be generated at all?
 *
 * On success this returns a TICKET carrying the seal and target it approved, and `buildProposal`
 * requires that ticket. The first version returned a bare `{ok:true}`, so nothing downstream
 * could re-bind the decision to a value and `buildProposal` could be called after `mayPropose`
 * had refused.
 */
export function mayPropose(p) {
  if (!isPlainObject(p)) return no("proposal input is not a plain object");
  const x = own(p, "experiment");
  if (!isPlainObject(x)) return no("experiment is not a plain object");

  const baseSha = own(x, "base_sha");
  const targetPath = own(x, "target_path");
  const experimentId = own(x, "experiment_id");
  const currentSha = own(p, "currentSha");
  const promoteVia = own(p, "promoteVia");

  if (!isSha(baseSha)) return no("the experiment carries no sealed base_sha");
  if (!isNonEmptyString(targetPath)) return no("the experiment carries no target_path");
  if (!isNonEmptyString(experimentId)) return no("the experiment carries no experiment_id");
  if (!isSha(currentSha)) return no("the current target digest is not a sha256 digest");
  if (!Array.isArray(promoteVia)) return no("the promote_via allowlist is not an array - refusing rather than assuming it permits this target");

  // Indexed loop, no method lookup. `includes` is a prototype method and a Proxy, a subclass, or
  // a polluted Array.prototype can all make it lie.
  let allowed = false;
  for (let i = 0; i < promoteVia.length; i++) if (promoteVia[i] === targetPath) allowed = true;
  if (!allowed) return no(`target ${targetPath} is not on the promote_via allowlist`);

  // THE SEAL. If the canonical file moved since the experiment opened, every measurement was
  // taken against bytes that are no longer there, and there is no honest way to attribute them
  // either side of the change. A proposal is impossible, not merely discouraged.
  if (currentSha !== baseSha)
    return no(`canonical-drift: sealed at ${baseSha.slice(0, 12)}, target is now ${currentSha.slice(0, 12)} - no proposal may be generated`);

  return ok({ ticket: { experiment_id: experimentId, base_sha: baseSha, target_path: targetPath } });
}

/**
 * Build the `promotion.proposed` payload from a verified hop-1 ticket.
 *
 * `patchSha` must be the digest of the ACTUAL patch bytes. The first version fabricated it on the
 * revert path from three public identifiers, so it was reproducible without ever seeing a diff —
 * a verifier recomputing it that way would accept any patch bytes under a valid-looking revert.
 */
export function buildProposal({ ticket, candidateSha, patchSha, kind = "promote", appliesTo = null, restores = null }) {
  if (!isPlainObject(ticket) || !isSha(own(ticket, "base_sha")) || !isNonEmptyString(own(ticket, "experiment_id")))
    return no("buildProposal requires the ticket returned by mayPropose - a proposal is not minted without a verified seal");
  const baseSha = ticket.base_sha;
  if (!isSha(candidateSha)) return no("candidate_sha must be a sha256 digest");
  if (!isSha(patchSha)) return no("patch_sha must be the sha256 digest of the actual patch bytes");
  if (kind !== "promote" && kind !== "revert") return no("kind must be promote or revert");
  if (candidateSha === baseSha)
    return no("candidate_sha equals base_sha - the proposal changes nothing, which is far more likely a diff that silently produced no change than a no-op someone meant to propose");

  const payload = {
    experiment_id: ticket.experiment_id,
    kind,
    patch_sha: patchSha,
    base_sha: baseSha,
    candidate_sha: candidateSha,
  };
  if (kind === "revert") {
    if (!isSha(appliesTo) || !isSha(restores)) return no("a revert must carry applies_to and restores");
    if (appliesTo === restores) return no("applies_to equals restores - the revert restores what is already there");
    payload.applies_to = appliesTo;
    payload.restores = restores;
  }
  const { id, reason } = proposalIdFor(payload);
  if (id === null) return no(`the proposal id could not be computed: ${reason}`);
  return ok({ proposal: { proposal_id: id, ...payload } });
}

// ---------- hop 3 ----------

/**
 * `experiment.promoted` may be emitted ONLY if the SHA observed in the merged file equals the
 * proposal's `candidate_sha` — and only for a proposal whose id still commits to its payload.
 */
export function mayRecordPromotion({ proposal, observedSha }) {
  const bound = verifyProposalId(proposal);
  if (!bound.ok) return bound;
  const candidate = own(proposal, "candidate_sha");
  if (!isSha(candidate)) return no("the proposal carries no candidate_sha");
  if (!isSha(observedSha)) return no("the observed merged digest is not a sha256 digest");
  if (observedSha !== candidate)
    return no(`merged bytes do not match the proposal: expected ${candidate.slice(0, 12)}, observed ${observedSha.slice(0, 12)} - the promotion receipt is REFUSED`);
  return ok();
}

// ---------- hop 4 ----------

/**
 * The watch runs ONLY while the served file's digest still equals `candidate_sha`.
 *
 * `requiresDeploy` is REQUIRED and must be a literal boolean. It used to default to `false`, so a
 * manifest that omitted the key — or misspelled it — got a watch on bytes nobody was running,
 * which is the exact failure this function exists to prevent. Absence must refuse, not permit.
 *
 * A deploy receipt must name the SAME proposal and the SAME target, not merely a matching digest:
 * two targets holding identical bytes is not hypothetical for stubs and empty files, so a digest
 * match alone let a receipt for `docs/README.md` authorise this watch.
 */
export function mayWatch({ proposal, servedSha, targetPath, requiresDeploy, deployReceipt = null }) {
  const bound = verifyProposalId(proposal);
  if (!bound.ok) return bound;
  const candidate = own(proposal, "candidate_sha");
  if (!isSha(candidate)) return no("the proposal carries no candidate_sha");
  if (!isSha(servedSha)) return no("the served digest is not a sha256 digest");
  if (typeof requiresDeploy !== "boolean")
    return no("the target's deploy-gating is undeclared - refusing rather than assuming this target needs no deploy");

  if (requiresDeploy) {
    if (!isPlainObject(deployReceipt))
      return no("this target has a deploy step and no deploy receipt confirms what is served - the watch does not start on a working-tree match alone");
    const rSha = own(deployReceipt, "served_sha");
    const rProposal = own(deployReceipt, "proposal_id");
    const rTarget = own(deployReceipt, "target_path");
    if (!isSha(rSha)) return no("the deploy receipt carries no served_sha");
    if (rProposal !== own(proposal, "proposal_id")) return no(`the deploy receipt names proposal ${String(rProposal)}, not this one`);
    if (!isNonEmptyString(targetPath) || rTarget !== targetPath) return no(`the deploy receipt names target ${String(rTarget)}, not ${String(targetPath)}`);
    if (rSha !== servedSha) return no(`the deploy receipt says ${rSha.slice(0, 12)} is served but the target reads ${servedSha.slice(0, 12)}`);
  }
  if (servedSha !== candidate)
    return no(`post-promotion drift: promoted ${candidate.slice(0, 12)}, served is now ${servedSha.slice(0, 12)}`);
  return ok();
}

// ---------- drift and degradation ----------

/**
 * The promoted surface drifted underneath the watch.
 *
 * The answer is NOT to generate a revert. Something else changed those bytes, this engine does
 * not know what or why, and a machine-generated patch on top of an unexplained change turns one
 * incident into two.
 */
export function onPostPromotionDrift({ proposal, observedSha, championBaseSha }) {
  const expected = own(proposal, "candidate_sha");
  return {
    incident: {
      kind: "post-promotion-drift",
      proposal_id: own(proposal, "proposal_id") ?? null,
      expected_sha: isSha(expected) ? expected : null,
      observed_sha: isSha(observedSha) ? observedSha : null,
      archived_champion: isSha(championBaseSha) ? championBaseSha : null,
    },
    surface: "FROZEN",
    action: "manual intervention required",
    machine_generated_revert: false,
    why: "the surface changed for a reason this engine cannot see; a machine-generated patch on top of an unexplained change turns one incident into two",
  };
}

/**
 * A degradation caught by the watch. NEVER THROWS — the first version called `buildProposal`
 * directly and threw on four ordinary states (no archived champion, champion equals current, a
 * null proposal), so a *confirmed degradation* produced an exception instead of a frozen surface
 * and a caller looping inside try/catch skipped the incident entirely.
 *
 * `ownObservationMeetsFloor` must be the literal `true`. It was a truthiness test, so the string
 * `"false"` — or `"unknown"`, or `"below floor"` — coerced to CONFIRMED and minted a revert
 * against a measurement the engine had just said it could not see.
 */
export function onDegradation({ proposal, championBaseSha, ownObservationMeetsFloor, revertPatchSha = null }) {
  const frozen = (kind, why) => ({
    incident: { kind, proposal_id: own(proposal, "proposal_id") ?? null },
    surface: "FROZEN",
    revert_proposal: null,
    merged_by_machine: false,
    why,
  });

  if (ownObservationMeetsFloor !== true)
    return frozen("degradation-suspected", "the degradation is below this engine's own observation floor, so it is not measured well enough to act on - freezing is honest, proposing a revert on it would not be");

  const candidate = own(proposal, "candidate_sha");
  const experimentId = own(proposal, "experiment_id");
  if (!isSha(candidate) || !isSha(championBaseSha) || !isNonEmptyString(experimentId))
    return frozen("degradation-confirmed", "the revert could not be bound to an archived champion, so the surface is frozen and a human is asked - a revert nobody can bind is a revert nobody should apply");
  // The revert patch must be REAL bytes. Fabricating patch_sha from public identifiers made it
  // reproducible without a diff, so any patch bytes would verify under a valid-looking proposal.
  if (!isSha(revertPatchSha))
    return frozen("degradation-confirmed", "no revert patch has been computed yet, so there is nothing to bind a patch_sha to - the surface is frozen and the diff is a human's next step");

  const built = buildProposal({
    ticket: { experiment_id: experimentId, base_sha: candidate, target_path: own(proposal, "target_path") ?? "" },
    candidateSha: championBaseSha,
    patchSha: revertPatchSha,
    kind: "revert",
    appliesTo: candidate,
    restores: championBaseSha,
  });
  if (!built.ok) return frozen("degradation-confirmed", `the revert proposal could not be built: ${built.reason}`);

  return {
    incident: { kind: "degradation-confirmed", proposal_id: own(proposal, "proposal_id") ?? null },
    surface: "FROZEN",
    class_demoted_to: "L1",
    revert_proposal: built.proposal,
    merged_by_machine: false,
    why: "propose-only is absolute in BOTH directions - the urgent path and the happy path end at the same inbox",
  };
}

// ---------- the evidence table (ADR-0310, field-frozen) ----------

const EVIDENCE_FIELDS = Object.freeze([
  "proposal_id", "experiment_id", "surface", "target_path", "arm_tags", "n_per_arm",
  "successes_per_arm", "point_delta", "bound", "alpha", "effect_floor", "mde",
  "guardrail_status", "windows", "missing_windows", "cohort_audit", "config_hash",
  "base_sha", "patch_sha", "candidate_sha",
]);

const SHA_FIELDS = new Set(["base_sha", "patch_sha", "candidate_sha", "config_hash"]);
const NUMERIC_FIELDS = new Set(["point_delta", "bound", "alpha", "effect_floor", "mde", "missing_windows"]);

/**
 * Build the inbox evidence table. The FIELD LIST is frozen by ADR-0310 and there is no free-form
 * commentary field: the table IS the evidence.
 *
 * The VALUES are now checked too. Freezing the row names while passing values through untouched
 * left every field free-form — `point_delta` could carry
 * `"0.03\n| recommendation | PROMOTE - approved by the engine |"`, which any markdown renderer
 * turns into an extra row. The rows were frozen; the table was not.
 */
export function evidenceTable(data) {
  const rows = [];
  for (const f of EVIDENCE_FIELDS) {
    const raw = own(data, f);
    let value;
    if (raw === undefined || raw === null) value = "MISSING";
    else if (SHA_FIELDS.has(f)) value = isSha(raw) ? raw : "MISSING (not a sha256 digest)";
    else if (NUMERIC_FIELDS.has(f)) value = typeof raw === "number" && Number.isFinite(raw) ? raw : "MISSING (not a finite number)";
    // Everything else renders as a single safe line: newlines and pipes are what forge rows.
    else value = String(raw).replace(/[\p{Cc}\p{Cf}]/gu, "?").replace(/[\r\n|]/g, " ").slice(0, 200);
    rows.push(Object.freeze({ field: f, value }));
  }
  return Object.freeze(rows);
}

export { EVIDENCE_FIELDS, digest };
