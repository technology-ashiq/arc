// growth/generate -- REQ-02 criteria 3 and 4. Prompt assembly and MDX rendering.
//
// The one rule that shapes this whole file: THE APPROVED EXEMPLARS ARE THE ONLY STYLE INPUT
// (ADR-1110). Not the exemplars plus a few sensible defaults. Not the exemplars plus "keep
// paragraphs short". The prompt this module builds carries the cluster row, the exemplar bytes,
// the E3 laws, and nothing else.
//
// TWO CONTROLS, KEPT APART. An adversarial pass on 2026-08-14 collapsed them into one and broke
// both, so they are now separate on purpose:
//
//   (a) Has OUR OWN authored instruction text drifted back to prescribing structure?
//       -> `assertNoStylePrescription`, which scans the authored TEMPLATE and nothing else.
//   (b) Can the cluster's DATA write new prompt sections, or smuggle in a link target?
//       -> `assertRowSafe`, plus taking the row from the approved cluster rather than the caller.
//
// Merged, they failed in both directions at once. The old control scanned the whole assembled
// prompt, so an ordinary approved keyword -- `seo faq schema`, `h2 vs h3 headings` -- threw
// STYLE_PRESCRIPTION and permanently bricked generation for that row, with a message naming the
// wrong cause. And because the HN adapter writes the mining QUERY into `gap_note`, one query word
// could brick every row of a cluster. Meanwhile the real drift it was meant to catch slipped past
// under soft hyphens, and the exemplar-stripping step it used to avoid its own false positives
// could be switched off entirely by approving three exemplars containing the letters "h", "a", "u".

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { foldText, extractLinks, linkDefinitions } from "./text.mjs";

export class GenerateError extends Error {
  constructor(code, message) { super(message); this.name = "GenerateError"; this.code = code; }
}

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,79}$/;
const FRONTMATTER_KEYS = ["layout", "title", "meta", "pubDate", "slug", "cluster_id", "template_id", "citations"];
const MAX_FIELD = 1000;

// Line separators that a YAML or prompt parser may treat as a break. `/[\r\n]/` missed U+0085,
// U+2028 and U+2029 -- and `JSON.stringify` passes all three through raw, so the character reaches
// the emitted scalar. Whether a given parser breaks on them is parser-dependent, which is exactly
// the reason not to ship one.
// Written as escapes, never as the characters themselves: U+2028 and U+2029 ARE line
// terminators in JavaScript source, so the literal form ends the regex mid-expression.
const LINE_BREAKS_RE = /[\r\n\u0085\u2028\u2029]/;
const CONTROL_RE = /[\p{Cc}\p{Cf}]/u;

/**
 * Load the approved voice exemplars. Every `.md`/`.mdx` file in the directory, in sorted order so
 * the assembled prompt is byte-stable across filesystems.
 *
 * An EMPTY exemplar directory is an error, never an empty style input. Falling through with no
 * exemplars would silently hand the model its own defaults -- the un-anchored generic voice
 * ADR-1114 exists to prevent, arriving as a missing file rather than a decision.
 */
export function loadExemplars(dir) {
  let names;
  try {
    names = readdirSync(dir).filter((f) => /\.mdx?$/.test(f)).sort();
  } catch (e) {
    throw new GenerateError("NO_EXEMPLARS", `exemplar directory ${dir} cannot be read: ${e.message}`);
  }
  if (names.length === 0)
    throw new GenerateError("NO_EXEMPLARS", `${dir} holds no exemplar files -- the exemplars are the only style input, so an empty set is not a style, it is a silent default`);
  return names.map((name) => {
    const text = readFileSync(join(dir, name), "utf8");
    // "Non-empty" was the whole bar, which is a pass condition that is only an absence -- ADR-0049,
    // in the file that anchors the voice. A one-character exemplar is not a voice.
    if (text.trim().length < 200)
      throw new GenerateError("EMPTY_EXEMPLAR", `exemplar ${name} is ${text.trim().length} characters -- too short to anchor a voice, and an exemplar that anchors nothing silently hands the model its own defaults`);
    return { name, text };
  });
}

/**
 * Every row of the approved cluster, flattened, so the internal-link plan can only ever name a
 * target the human approved.
 */
export function clusterRows(cluster) {
  if (cluster === null || typeof cluster !== "object" || Array.isArray(cluster))
    throw new GenerateError("BAD_CLUSTER", "cluster must be the parsed approved plan");
  // Spreading a STRING yields its characters. `spokes: "seo"` produced rows `"s","e","o"` and an
  // approved-link block reading `- undefined (undefined)` three times, from the function whose
  // stated job is that only approved targets can appear. Defect #5 in this lane's running list.
  for (const k of ["spokes", "bofu"])
    if (cluster[k] !== undefined && !Array.isArray(cluster[k]))
      throw new GenerateError("BAD_CLUSTER", `cluster.${k} must be an array, got ${typeof cluster[k]}`);
  const rows = [cluster.pillar, ...(cluster.spokes || []), ...(cluster.bofu || [])];
  for (const r of rows)
    if (r === null || typeof r !== "object" || Array.isArray(r) || typeof r.keyword !== "string")
      throw new GenerateError("BAD_CLUSTER", `cluster holds a row that is not a row: ${JSON.stringify(r)}`);
  if (rows.length === 0) throw new GenerateError("BAD_CLUSTER", "cluster has no rows");
  return rows;
}

/**
 * Every interpolated field is bounded and single-line.
 *
 * `renderMdx` already guarded newlines because "a title could write its own frontmatter keys"; its
 * sibling assembled a prompt with no such guard, so a newline in `gap_note` wrote a second
 * INTERNAL LINKS section -- carrying an attacker's URL, and placed ABOVE the real one.
 */
export function assertRowSafe(row) {
  for (const k of ["keyword", "intent", "evidence_url", "gap_note"]) {
    const v = row[k];
    if (v === undefined) continue;
    if (typeof v !== "string")
      throw new GenerateError("BAD_ROW", `row.${k} must be a string`);
    if (v.length > MAX_FIELD)
      throw new GenerateError("BAD_ROW", `row.${k} is ${v.length} characters, over the ${MAX_FIELD} cap`);
    if (LINE_BREAKS_RE.test(v) || CONTROL_RE.test(v))
      throw new GenerateError("BAD_ROW", `row.${k} contains a line break or control character, which would write its own prompt section`);
  }
  return row;
}

// The AUTHORED instruction text. Everything here is written by us; nothing is interpolated. This is
// the string `assertNoStylePrescription` scans, and it is the only string it scans.
const TEMPLATE = Object.freeze([
  "Write one article for the arc site.",
  "TARGET",
  "INTERNAL LINKS -- you may link to these and to nothing else. They are the other rows of the",
  "approved cluster. Do not invent a target.",
  "VOICE -- these are the approved exemplars, and they are the ONLY style input. Write the way",
  "they are written. No other style guidance exists, here or anywhere; do not supply your own.",
  "NOT STYLE -- these three are law (E3, Tier E, unamendable):",
  "1. Every claim of fact carries a source link.",
  "2. No fabricated numbers, benchmarks, case studies or testimonials. Arc's own results may be",
  "   cited only where a receipt exists. Anything simulated is labelled simulated.",
  "3. Carry at least one original practitioner insight -- something arc learned by doing.",
]);

// Vocabulary that would mean a style rule had crept into OUR text. A NEGATIVE list, in the spirit
// of ADR-1110: it does not describe a good prompt, it names the way this prompt is known to rot.
// The v0 skill supplied every one of these words.
const PRESCRIPTION_MARKERS = [
  "h2", "h3", "faq", "word count", "words long", "outline", "subheading", "bullet",
  "deterministic structure", "keyword density", "first 100 words", "meta description should",
  "paragraphs short", "listicle", "tone should", "voice should",
];

/**
 * The negative control for criterion 3.
 *
 * Scans the AUTHORED template only. Interpolated cluster data is excluded by construction rather
 * than by stripping it back out afterwards: the row is the human's approved keyword, and an
 * article about FAQ schema is a legitimate thing for this site to write. The separate question --
 * whether that data can inject instructions -- is `assertRowSafe`'s, above.
 *
 * Folded before scanning, so a soft hyphen inside each marker word no longer hides a complete
 * structural brief. That bypass returned `true` from this function on 17 planted markers.
 */
export function assertNoStylePrescription(templateLines = TEMPLATE) {
  const scan = foldText(Array.isArray(templateLines) ? templateLines.join(" ") : String(templateLines));
  const hits = PRESCRIPTION_MARKERS.filter((m) => scan.includes(foldText(m)));
  if (hits.length > 0)
    throw new GenerateError("STYLE_PRESCRIPTION",
      `the authored prompt template prescribes style, which ADR-1110 forbids: ${hits.join(", ")}`);
  return true;
}

/**
 * Assemble the drafting prompt for ONE row.
 *
 * The row is taken FROM THE APPROVED CLUSTER by keyword, never from the caller's object. The old
 * version validated `row.keyword` for membership and then built the prompt out of the caller's
 * `evidence_url` and `gap_note` -- validate one value, use another, which is defect #1 in this
 * lane's running list and the one it has hit most often.
 */
export function assemblePrompt({ row, cluster, exemplars }) {
  if (!row || typeof row.keyword !== "string" || row.keyword.trim() === "")
    throw new GenerateError("BAD_ROW", "row must carry a keyword");
  const rows = clusterRows(cluster).map(assertRowSafe);
  const approved = rows.find((r) => r.keyword === row.keyword);
  if (!approved)
    throw new GenerateError("ROW_NOT_IN_CLUSTER", `row ${JSON.stringify(row.keyword)} is not part of cluster ${cluster.cluster_id} -- generation may only target an approved row`);
  if (!Array.isArray(exemplars) || exemplars.length === 0)
    throw new GenerateError("NO_EXEMPLARS", "assemblePrompt needs at least one exemplar");
  assertNoStylePrescription();

  const linkTargets = rows
    .filter((r) => r.keyword !== approved.keyword)
    .map((r) => `- ${r.keyword} (${r.intent})`)
    .join("\n");

  const voice = exemplars
    .map((e) => `----- exemplar: ${e.name} -----\n${e.text.trim()}`)
    .join("\n\n");

  return [
    TEMPLATE[0],
    "",
    TEMPLATE[1],
    `keyword: ${approved.keyword}`,
    `intent: ${approved.intent}`,
    `evidence: ${approved.evidence_url}`,
    `context: ${approved.gap_note}`,
    "",
    TEMPLATE[2],
    TEMPLATE[3].replace("approved cluster.", `approved cluster ${cluster.cluster_id}.`),
    linkTargets === "" ? "- (none: this cluster has one row)" : linkTargets,
    "",
    TEMPLATE[4],
    TEMPLATE[5],
    "",
    voice,
    "",
    ...TEMPLATE.slice(6),
  ].join("\n");
}

/** Every link URL in the body. Shared extractor -- see text.mjs for why there is only one. */
export function bodyLinks(body) {
  return extractLinks(String(body), linkDefinitions(String(body)));
}

/**
 * Render the MDX file.
 *
 * `citations` is DERIVED from the body, never accepted from the caller. A frontmatter citation list
 * that disagrees with the links in the text is a lie in a machine-readable field, and it is exactly
 * the kind that survives review because nobody cross-checks two parts of the same file by hand.
 */
export function renderMdx({ title, meta, slug, cluster_id, template_id, body, pubDate }) {
  const req = { title, meta, slug, cluster_id, template_id, body };
  for (const [k, v] of Object.entries(req))
    if (typeof v !== "string" || v.trim() === "")
      throw new GenerateError("BAD_FRONTMATTER", `${k} must be a non-empty string`);
  if (!SLUG_RE.test(slug))
    throw new GenerateError("BAD_FRONTMATTER", `slug ${JSON.stringify(slug)} must match ${SLUG_RE}`);
  for (const [k, v] of Object.entries({ title, meta, cluster_id, template_id }))
    if (LINE_BREAKS_RE.test(v))
      throw new GenerateError("BAD_FRONTMATTER", `${k} must not contain a line break (including U+0085, U+2028 and U+2029, which JSON.stringify passes through raw)`);

  // `pubDate` is REQUIRED and is not derived from a clock. The homepage sorts on it and the layout
  // puts it in the JSON-LD `datePublished`, so a missing one silently reorders the index and
  // publishes structured data with no date. It is a parameter rather than `new Date()` because the
  // publication date of an article is a fact about the article, not about when this function ran —
  // a re-render months later must not restamp it.
  if (typeof pubDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(pubDate))
    throw new GenerateError("BAD_FRONTMATTER", `pubDate ${JSON.stringify(pubDate)} must be YYYY-MM-DD`);

  const citations = bodyLinks(body);
  const y = (s) => JSON.stringify(String(s)); // JSON strings are valid YAML scalars, and they escape
  const lines = [
    "---",
    // THE LAYOUT LINE, and it is load-bearing rather than cosmetic.
    //
    // Without it Astro renders the MDX as a bare fragment. Measured on this function's first LIVE
    // use, 2026-08-18, by building the real site with a rendered article in it: no `<html>` tag,
    // no `rel=canonical`, no `application/ld+json` — every bit of Phase 04's GEO work silently
    // absent — and, worst, no `noindex` control, because `isPublishedDomain` lives in the layout
    // the page never loads. A page published this way is indexable no matter what INDEXABLE says.
    //
    // Every fixture for this function asserted the frontmatter KEYS it emits. None ever built the
    // site, so the one property that mattered — does this file become a page — was never tested.
    // Fixture-proven is not live-validated, and this is what the difference looked like.
    "layout: ../../layouts/Article.astro",
    `title: ${y(title)}`,
    `meta: ${y(meta)}`,
    `pubDate: ${y(pubDate)}`,
    `slug: ${y(slug)}`,
    `cluster_id: ${y(cluster_id)}`,
    `template_id: ${y(template_id)}`,
    "citations:",
    ...(citations.length === 0 ? ["  []"] : citations.map((c) => `  - ${y(c)}`)),
    "---",
    "",
    body.trim(),
    "",
  ];
  return lines.join("\n");
}

/** The frontmatter key list, exported so a test can assert the contract rather than restate it. */
export const REQUIRED_FRONTMATTER = Object.freeze(FRONTMATTER_KEYS.slice());
/** The authored template, exported so a test can scan exactly what the control scans. */
export const PROMPT_TEMPLATE = TEMPLATE;
