// growth/publish -- REQ-03. The review pack, the unedited counter, and the update-vs-duplicate rule.
//
// THIS MODULE DOES NOT SPAWN ANYTHING. Every subprocess in the publish path goes through
// `exec-allowlist.mjs`, which is the single choke point `guard.mjs` proves. Keeping the assembly
// logic in a module with no exec capability at all is what makes the graph audit meaningful: the
// interesting code and the dangerous code are not the same file.

import { assertTemplateId } from "./templates.mjs";

export class PublishError extends Error {
  constructor(code, message) { super(message); this.name = "PublishError"; this.code = code; }
}

const SHA256_RE = /^[0-9a-f]{64}$/;
const SLUG_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;
const PREVIEW_URL_RE = /^https:\/\/[a-z0-9.-]+(\/[^\s]*)?$/i;

/**
 * ONE inbox item: preview URL, lint report, citation report, diff, POV line.
 *
 * A pack MISSING THE PREVIEW URL IS INVALID -- structurally, not a warning. The spec is explicit,
 * and the reason is that the preview URL is the only part a reviewer cannot reconstruct from the
 * repo: without it the review is of a diff rather than of a page, and "looks fine in the diff" is
 * how a broken render ships. Phase 00 recorded that per-PR preview URLs do not exist until the
 * site repo is connected to the deploy provider, so this refusal will fire for real until that
 * owner action happens -- which is the point of making it structural rather than advisory.
 */
export function buildReviewPack({ slug, previewUrl, slopReport, citationReport, diff, povLine, templateId, contentSha }) {
  if (typeof slug !== "string" || !SLUG_RE.test(slug))
    throw new PublishError("BAD_SLUG", `slug ${JSON.stringify(slug)} must match ${SLUG_RE}`);
  if (typeof previewUrl !== "string" || previewUrl.trim() === "")
    throw new PublishError("NO_PREVIEW_URL",
      "a review pack without a preview URL is INVALID, not incomplete -- without it the reviewer is reading a diff, not a page (REQ-03)");
  if (!PREVIEW_URL_RE.test(previewUrl))
    throw new PublishError("BAD_PREVIEW_URL", `preview URL ${JSON.stringify(previewUrl)} must be an https URL`);
  for (const [k, v] of Object.entries({ slopReport, citationReport, diff, povLine }))
    if (typeof v !== "string" || v.trim() === "")
      throw new PublishError("INCOMPLETE_PACK", `the review pack needs a non-empty ${k}`);
  assertTemplateId(templateId);
  if (typeof contentSha !== "string" || !SHA256_RE.test(contentSha))
    throw new PublishError("BAD_CONTENT_SHA", "the pack must carry the draft content_sha the approval binds to");

  return {
    kind: "review-pack",
    slug,
    template_id: templateId,
    content_sha: contentSha,
    preview_url: previewUrl,
    sections: [
      { name: "preview", body: previewUrl },
      { name: "slop-lint", body: slopReport },
      { name: "citation-lint", body: citationReport },
      { name: "diff", body: diff },
      { name: "pov-floor", body: povLine },
    ],
  };
}

/** Render the pack as the one text block a human reads in the inbox. */
export function renderReviewPack(pack) {
  const lines = [
    `REVIEW PACK -- ${pack.slug} (${pack.template_id}, content_sha ${pack.content_sha.slice(0, 12)})`,
    "",
  ];
  for (const s of pack.sections) lines.push(`## ${s.name}`, "", s.body, "");
  return lines.join("\n");
}

/**
 * Is this publication an UPDATE of a slug already published, or a new page?
 *
 * `receipts` is every `content.published` payload for this site, newest last. The answer is an
 * update whenever the slug has been published before -- the page is one page, at one URL, and a
 * second receipt for it is a new version of the same thing rather than a second article. A
 * re-publish that created a duplicate page would split the URL's history in two, which is the
 * failure the criterion names.
 */
export function classifyPublication(slug, receipts) {
  if (!Array.isArray(receipts))
    throw new PublishError("BAD_INPUT", "receipts must be an array of content.published payloads");
  const prior = receipts.filter((r) => r && r.slug === slug);
  if (prior.length === 0) return { kind: "new", supersedes: null, priorCount: 0 };
  const last = prior[prior.length - 1];
  return { kind: "update", supersedes: last.content_sha, priorCount: prior.length };
}

/**
 * The unedited-approval counter (ADR-1107, REQ-03 criterion 7).
 *
 * THE RULE, and it is deliberately asymmetric: a sha-EQUAL approval increments; a sha-DIFFERENT
 * approval NEITHER INCREMENTS NOR RESETS. "Unedited approval" means the human approved exactly the
 * bytes the machine drafted, so an edited article is simply not evidence about the drafting -- it
 * is not counter-evidence either, and zeroing the count on an edit would make the number a
 * measure of the last article rather than of the twenty.
 *
 * ADR-1107 sets the bar at 20. This cycle produces at most 10, so it CANNOT earn an L2 promotion
 * by construction -- stated here as well as in PLAN.md, because a counter with a threshold invites
 * the reader to assume the threshold is reachable.
 */
export function tallyUnedited(events) {
  if (!Array.isArray(events))
    throw new PublishError("BAD_INPUT", "tallyUnedited needs an array of {draft_sha, approved_sha} records");
  let unedited = 0, edited = 0;
  for (const e of events) {
    if (!e || typeof e.draft_sha !== "string" || typeof e.approved_sha !== "string")
      throw new PublishError("BAD_INPUT", `record ${JSON.stringify(e)} needs draft_sha and approved_sha`);
    if (!SHA256_RE.test(e.draft_sha) || !SHA256_RE.test(e.approved_sha))
      throw new PublishError("BAD_INPUT", "both shas must be sha256 hex -- a truncated sha would compare unequal and silently look like an edit");
    if (e.draft_sha === e.approved_sha) unedited++;
    else edited++;
  }
  return {
    unedited,
    edited,
    // The bar is carried WITH the count, never inferred by the reader.
    bar: 20,
    l2Eligible: unedited >= 20,
    note: "sha-equal increments; sha-different neither increments nor resets (ADR-1107)",
  };
}
