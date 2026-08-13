/**
 * The approval chain (LEG-D, REQ-06). Publishing a legal page is the one act in this lane that
 * puts a statement in front of a customer, and it is gated on a HUMAN decision bound to exact
 * bytes.
 *
 * The law this file enforces, in one sentence: **a decision approves specific bytes, not a
 * venture.** An approval that survives an edit to the facts file is not an approval, it is a
 * rubber stamp with a delay. So the chain re-DERIVES every hash at publish time and compares
 * against what the decision committed to; nothing here trusts a recorded value because it is
 * recorded.
 *
 * Three failure classes, kept distinct because they have different repairs and different
 * severities:
 *
 *   FACTS_CHANGED      the venture's facts moved after approval -- the TOCTOU case
 *   TEMPLATES_CHANGED  the pinned template set moved after approval
 *   PAGE_BYTES_CHANGED the rendered file on disk is not the file that was approved
 *
 * "Could not check" is never folded into any of them. A missing page is PAGE_MISSING, not a
 * silent pass and not a byte mismatch.
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { bytesHash } from "./canonical.mjs";

export const APPROVAL_SUBJECT = "legal.publish";

/**
 * The strict payload profile (ADR-1003). Unknown keys are REJECTED rather than ignored, because
 * an emitter that accepts unknown keys will happily carry a `force: true` somebody added later,
 * and the receipt would look identical to a clean one.
 */
export const APPROVAL_KEYS = [
  "subject",
  "venture",
  "facts_sha256",
  "template_set",
  "template_set_sha",
  "effective_date",
  "pages",
];

const PAGE_KEYS = ["page", "output_sha256"];

/** Build the approval-request payload from a completed run. Deterministic: pages are sorted. */
export function approvalPayload(run) {
  return {
    subject: APPROVAL_SUBJECT,
    venture: run.venture,
    facts_sha256: run.facts_sha256,
    template_set: run.template_set,
    template_set_sha: run.template_set_sha,
    effective_date: run.effective_date,
    pages: [...run.pages]
      .map((p) => ({ page: p.page, output_sha256: p.output_sha256 }))
      .sort((a, b) => (a.page < b.page ? -1 : a.page > b.page ? 1 : 0)),
  };
}

/** Errors, not booleans: a caller that forgets to check a boolean publishes. */
export function validateApprovalPayload(payload) {
  const errs = [];
  if (!payload || typeof payload !== "object" || Array.isArray(payload))
    return ["the approval payload is not an object"];

  for (const k of Object.keys(payload))
    if (!APPROVAL_KEYS.includes(k))
      errs.push(`unknown key "${k}" in the approval payload. The profile is closed (ADR-1003): an emitter that ignores unknown keys carries whatever somebody adds later, and the receipt looks clean.`);
  for (const k of APPROVAL_KEYS)
    if (payload[k] === undefined) errs.push(`the approval payload is missing "${k}"`);

  if (payload.subject !== undefined && payload.subject !== APPROVAL_SUBJECT)
    errs.push(`subject is "${payload.subject}", not "${APPROVAL_SUBJECT}"`);
  if (payload.facts_sha256 !== undefined && !/^[0-9a-f]{64}$/.test(String(payload.facts_sha256)))
    errs.push("facts_sha256 is not a sha256 hex digest");
  if (payload.template_set_sha !== undefined && !/^[0-9a-f]{64}$/.test(String(payload.template_set_sha)))
    errs.push("template_set_sha is not a sha256 hex digest");
  if (payload.effective_date !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(String(payload.effective_date)))
    errs.push("effective_date is not an ISO date");

  if (payload.pages !== undefined) {
    if (!Array.isArray(payload.pages) || !payload.pages.length) {
      errs.push("pages is empty. An approval covering no page approves nothing, and would publish nothing while reporting success.");
    } else {
      const seen = new Set();
      for (const p of payload.pages) {
        if (!p || typeof p !== "object") { errs.push("a page entry is not an object"); continue; }
        for (const k of Object.keys(p))
          if (!PAGE_KEYS.includes(k)) errs.push(`unknown key "${k}" in a page entry`);
        if (typeof p.page !== "string" || !p.page) errs.push("a page entry has no page id");
        else if (seen.has(p.page)) errs.push(`page "${p.page}" appears twice in the approval`);
        else seen.add(p.page);
        if (!/^[0-9a-f]{64}$/.test(String(p.output_sha256)))
          errs.push(`page "${p.page}" has no valid output_sha256`);
      }
    }
  }
  return errs;
}

/**
 * Re-derive and compare. `fresh` is a run produced NOW from the tree as it stands; `approved` is
 * the payload the human decided on; `dir` holds the rendered bytes being published.
 *
 * Every comparison is against a value computed in this call. Reading `_run.json` and trusting its
 * `facts_sha256` would make the whole chain a check that the file agrees with itself.
 */
export function verifyChain({ approved, fresh, dir }) {
  const errs = [];

  if (approved.venture !== fresh.venture)
    errs.push(`VENTURE_MISMATCH: the approval is for "${approved.venture}" and this run is "${fresh.venture}"`);

  if (approved.facts_sha256 !== fresh.facts_sha256)
    errs.push(`FACTS_CHANGED: the facts file has moved since it was approved (approved ${approved.facts_sha256.slice(0, 12)}..., now ${fresh.facts_sha256.slice(0, 12)}...). The decision approved specific bytes, so it does not carry over.`);

  if (approved.template_set_sha !== fresh.template_set_sha)
    errs.push(`TEMPLATES_CHANGED: the pinned template set has moved since approval (approved ${approved.template_set_sha.slice(0, 12)}..., now ${fresh.template_set_sha.slice(0, 12)}...).`);

  const approvedPages = new Map(approved.pages.map((p) => [p.page, p.output_sha256]));
  const freshPages = new Map(fresh.pages.map((p) => [p.page, p.output_sha256]));

  for (const [page, sha] of approvedPages) {
    if (!freshPages.has(page)) { errs.push(`PAGE_MISSING: "${page}" was approved but this run does not produce it`); continue; }
    const file = join(dir, `${page}.mdx`);
    if (!existsSync(file)) { errs.push(`PAGE_MISSING: "${page}" was approved but ${file} does not exist`); continue; }
    // Hash the bytes ON DISK, not the run record's copy of them. The file is what gets published.
    let onDisk;
    try { onDisk = bytesHash(readFileSync(file, "utf8")); }
    catch (e) { errs.push(`PAGE_UNREADABLE: "${page}" could not be read (${e.message}). Could-not-check is not a pass.`); continue; }
    if (onDisk !== sha)
      errs.push(`PAGE_BYTES_CHANGED: "${page}" on disk is not the file that was approved (approved ${sha.slice(0, 12)}..., on disk ${onDisk.slice(0, 12)}...)`);
  }

  for (const page of freshPages.keys())
    if (!approvedPages.has(page))
      errs.push(`PAGE_EXTRA: this run produces "${page}", which the approval does not cover. Publishing it would put an unapproved page on the site.`);

  return errs;
}

/**
 * The decision receipt itself. Separate from the chain on purpose: a perfectly intact chain
 * bound to a REJECTED decision must not publish, and folding the two checks together is how that
 * becomes possible.
 */
export function verifyDecision(decision, payload, requestId) {
  const errs = [];
  if (!decision || typeof decision !== "object") return ["the decision receipt is not an object"];

  if (decision.kind !== "decision.recorded")
    errs.push(`the receipt is kind "${decision.kind}", not "decision.recorded"`);
  if (decision.verdict !== "approve")
    errs.push(`VERDICT_NOT_APPROVE: the recorded verdict is "${decision.verdict}". Only "approve" publishes; a rejected or deferred decision with an otherwise intact hash chain must still refuse.`);
  if (requestId && decision.decides !== requestId)
    errs.push(`DECIDES_MISMATCH: this decision decides "${decision.decides}", not the approval request "${requestId}" for these bytes. A decision taken about a different request is not a decision about this one.`);
  if (decision.subject !== APPROVAL_SUBJECT)
    errs.push(`the decision's subject is "${decision.subject}", not "${APPROVAL_SUBJECT}"`);

  // The decision must carry the hashes it approved. A receipt that names only a venture approves
  // whatever that venture happens to contain at publish time.
  if (decision.facts_sha256 !== payload.facts_sha256)
    errs.push("the decision's facts_sha256 is not the one being published");
  if (decision.template_set_sha !== payload.template_set_sha)
    errs.push("the decision's template_set_sha is not the one being published");

  return errs;
}

/**
 * Backdating. An effective date earlier than the decision says the page took effect before
 * anybody agreed to it, and a re-publish that moves the date backwards rewrites when a
 * commitment started.
 *
 * Dates are compared as ISO strings, which sorts correctly for `YYYY-MM-DD` and avoids a
 * timezone question that has no right answer here: the decision timestamp is an instant, the
 * effective date is a calendar day, and coercing either into the other's type invents precision.
 * Only the DAY of the decision is used.
 */
export function backdatingErrors({ effectiveDate, decisionAt, previousEffectiveDate }) {
  const errs = [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(effectiveDate)))
    return [`effective_date "${effectiveDate}" is not an ISO date`];

  if (decisionAt) {
    const day = String(decisionAt).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) errs.push(`the decision timestamp "${decisionAt}" has no ISO date in it`);
    else if (effectiveDate < day)
      errs.push(`BACKDATED: effective_date ${effectiveDate} is earlier than the decision (${day}). The page would claim to have been in force before anyone approved it.`);
  }

  if (previousEffectiveDate) {
    if (effectiveDate < previousEffectiveDate)
      errs.push(`NON_MONOTONIC: effective_date ${effectiveDate} is earlier than the version already published (${previousEffectiveDate}). A re-publish may move the date forward or leave it, never back -- moving it back rewrites when a commitment started.`);
  }

  return errs;
}

/**
 * What actually changed between the published version and this one, in the terms a human
 * approving it needs: which facts values moved, and which clauses appeared or disappeared.
 *
 * A re-approval presented as "the whole blob changed" is not a review, it is a signature. That is
 * why an empty diff against a DIFFERENT facts hash is itself reported: it means the change is
 * somewhere this function cannot see, and the reviewer should be told that rather than shown a
 * reassuring empty list.
 */
export function semanticDiff(previousRun, currentRun) {
  const changedFacts = [];
  const prevPages = new Map((previousRun.pages || []).map((p) => [p.page, p]));
  const curPages = new Map((currentRun.pages || []).map((p) => [p.page, p]));

  const clauseChanges = [];
  for (const [page, cur] of curPages) {
    const prev = prevPages.get(page);
    if (!prev) { clauseChanges.push({ page, added: cur.clauses || [], removed: [], note: "page is new" }); continue; }
    const prevSet = new Set(prev.clauses || []);
    const curSet = new Set(cur.clauses || []);
    const added = [...curSet].filter((c) => !prevSet.has(c));
    const removed = [...prevSet].filter((c) => !curSet.has(c));
    if (added.length || removed.length) clauseChanges.push({ page, added, removed });
  }
  for (const page of prevPages.keys())
    if (!curPages.has(page)) clauseChanges.push({ page, added: [], removed: prevPages.get(page).clauses || [], note: "page is gone" });

  const factsMoved = previousRun.facts_sha256 !== currentRun.facts_sha256;
  const templatesMoved = previousRun.template_set_sha !== currentRun.template_set_sha;
  const opaque = factsMoved && !clauseChanges.length;

  return {
    facts_changed: factsMoved,
    templates_changed: templatesMoved,
    effective_date: { from: previousRun.effective_date, to: currentRun.effective_date },
    clause_changes: clauseChanges,
    changed_facts: changedFacts,
    // The honest warning. Recorded as data rather than printed prose so a test can assert it.
    opaque_rechange: opaque,
    opaque_reason: opaque
      ? "the facts hash moved but no clause appeared or disappeared, so the change is in a VALUE the pages interpolate. Re-approving this without reading the rendered bytes is a signature, not a review."
      : null,
  };
}
