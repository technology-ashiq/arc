// growth/citation-lint -- REQ-02, ADR-1110/1111. Two separate questions, deliberately kept apart:
//
//   1. Does a claim-of-fact carry a source link?   -> UNCITED, a FAIL. This is E3's truth law.
//   2. Does that link still resolve?               -> DEAD_LINK, a WARN, never a FAIL.
//
// The web rots. A gate that FAILs because someone else's server had a bad afternoon is a gate
// people learn to bypass, and a bypassed gate protects nothing (ADR-1110).
//
// WHAT COUNTS AS A CLAIM-OF-FACT. Not every sentence -- only the ones that assert something
// CHECKABLE: a figure, or an attribution to someone else. That is a deliberately narrow net. A
// sentence of pure opinion is not a claim-of-fact and this lint says nothing about it; the POV
// floor at the human gate is where writing is judged. Narrow and honest beats broad and ignored: a
// citation lint that fires on ordinary prose gets switched off within a week.
//
// THIS FILE DID NO UNICODE FOLDING AT ALL until 2026-08-14, while its twin one directory over did.
// An adversarial pass walked five fabricated figures past it with zero-width spaces and fullwidth
// digits, and the review pack printed "No uncited claim found." Folding now comes from the shared
// `text.mjs` -- the same function slop-lint uses, so there is no twin left to forget.

import { blocks, foldText, extractLinks, linkDefinitions, isSourceLink } from "./text.mjs";

export class CitationLintError extends Error {
  constructor(code, message) { super(message); this.name = "CitationLintError"; this.code = code; }
}

// Attribution language -- the sentence is reporting someone else's finding. Matched against FOLDED
// text, so `Accord​ing to` and `ACCORDING TO` are the same phrase.
const ATTRIBUTION = [
  "according to", "studies show", "studies have shown", "research shows", "research has shown",
  "researchers found", "a study found", "a survey found", "survey of", "report found",
  "reports that", "data from", "figures from", "as reported by", "cited by", "benchmark shows",
];

// A figure that can be checked: a percentage, a multiplier, a money amount, or a thousands-
// separated number.
//
// A BARE run of three or more digits was in this list and came out again the first time the lint
// met real writing: it flagged "the source answered HTTP 429" as an uncited claim. Status codes,
// ports and version numbers are identifiers, not measurements. BARE YEARS came out for the same
// reason on 2026-08-14 -- "I have been writing since 2019" is not a claim anyone cites, and a
// markdown table row `| 2024 | 40% |` was being failed on the year rather than the percentage.
//
// The alternation is anchored and possessive-ish by construction: each branch matches a bounded
// shape, and the input is TRUNCATED BEFORE the regex runs (see scanCitations). The previous form
// ran on the full sentence and truncated afterwards, which is quadratic on a long digit run --
// 60,000 digits took 7.5 seconds. Truncate first, then match. This lane fixed exactly this shape
// in `titleToKeyword` and left it standing here.
const FIGURE_RE = /\d{1,12}(?:\.\d{1,6})?\s?%|\b\d{1,9}(?:\.\d{1,6})?\s?x\b|[$£€]\s?\d|\b\d{1,3}(?:,\d{3})+\b/;
const MAX_SENTENCE_SCAN = 2000;

/**
 * Split a block into sentences, carrying each one's line number.
 *
 * Deliberately simple: split on . ! ? followed by whitespace. It over-splits on "e.g." and on
 * decimals, which makes the checked unit SMALLER and the lint STRICTER, never more permissive.
 *
 * The previous version had a `guard++ < 500` bail-out that DROPPED the rest of the line without a
 * word -- a single line with 500 sentence terminators hid every claim after it, and the reported
 * count saturated at 500 rather than reporting what was there. There is no cap now; the loop is
 * bounded by the string's own length because every iteration consumes at least one character.
 */
export function sentences(text) {
  const out = [];
  const lines = String(text).split(/\r\n|\r|\n/);
  lines.forEach((raw, i) => {
    let rest = raw;
    while (rest.trim() !== "") {
      const m = rest.match(/^(.*?[.!?])(\s+)(.*)$/s);
      if (!m) { out.push({ text: rest.trim(), line: i + 1 }); break; }
      if (m[1].trim() !== "") out.push({ text: m[1].trim(), line: i + 1 });
      rest = m[3];
    }
  });
  return out.filter((s) => s.text !== "");
}

/** Every link in a string. Thin wrapper over the shared extractor, kept for callers and tests. */
export function linksIn(s, defs = new Map()) {
  return extractLinks(s, defs);
}

/** True when a sentence asserts something checkable. */
export function isClaimOfFact(sentence) {
  // Links are removed BEFORE the figure test. A URL containing digits -- `item?id=43740549` is
  // every evidence link this lane produces -- would otherwise make a sentence its own reason to
  // need a citation, so a properly cited sentence would be flagged BECAUSE it was cited.
  const bare = foldText(stripLinks(String(sentence))).slice(0, MAX_SENTENCE_SCAN);
  if (ATTRIBUTION.some((a) => bare.includes(a))) return true;
  return FIGURE_RE.test(bare);
}

function stripLinks(s) {
  return String(s)
    .replace(/\[([^\]\n]*)\]\([^)]*\)/g, " $1 ")
    .replace(/\[([^\]\n]*)\]\[[^\]\n]*\]/g, " $1 ")
    .replace(/<?\bhttps?:\/\/[^\s<>)\]]+>?/g, " ");
}

/**
 * Scan for uncited claims. Pure and offline: no network here at all, so the whole claim half of
 * this lint is testable without a resolver.
 *
 * Scope is the BLOCK (paragraph), not the sentence. Sentence scope failed every ordinary markdown
 * citation style -- a reference link, a footnote, or a link on the following line all read as
 * uncited. The accepted looseness is stated rather than hidden: a claim in the first sentence of a
 * paragraph is satisfied by a source link anywhere in that paragraph.
 *
 * Fenced code and table rows are skipped. A JSON snippet containing `"since": 2024` and a data row
 * `| 2024 | 40% |` are not prose claims, and failing them is how this gate would earn its bypass.
 */
export function scanCitations(text) {
  if (typeof text !== "string")
    throw new CitationLintError("BAD_INPUT", "text to scan must be a string");
  const defs = linkDefinitions(text);
  const findings = [];
  let sentencesScanned = 0;
  let claims = 0;

  for (const b of blocks(text)) {
    if (b.fenced) continue;
    const body = b.lines.map((l) => l.text).join("\n");
    const blockLinks = extractLinks(body, defs).filter(isSourceLink);
    for (const s of sentences(body)) {
      const line = b.lines[Math.min(s.line, b.lines.length) - 1]?.line ?? b.startLine;
      // A table row, a heading, and a reference definition are not prose.
      if (/^\s{0,3}#{1,6}\s/.test(s.text)) continue;
      if (/^\s{0,3}\|/.test(s.text) || /\|\s*$/.test(s.text)) continue;
      if (/^\s{0,3}\[[^\]]+\]:\s*\S+/.test(s.text)) continue;
      sentencesScanned++;
      if (!isClaimOfFact(s.text)) continue;
      claims++;
      if (blockLinks.length > 0) continue;
      findings.push({
        level: "FAIL", code: "UNCITED", line,
        excerpt: s.text.length > 160 ? s.text.slice(0, 157) + "..." : s.text,
        why: "asserts a figure or someone else's finding, and its paragraph carries no source link (E3, ADR-1111)",
      });
    }
  }
  return { sentencesScanned, claims, findings };
}

/**
 * Check every link in the text against a resolver.
 *
 * `resolve(url) -> {state: "live"|"dead"|"unknown", status}`. UNKNOWN IS NOT DEAD, and it is not
 * live either: the first real mining run in this lane called 41 good links dead on an HTTP 429,
 * and collapsing "could not check" into either verdict is how MISSING gets read as zero.
 *
 * `budgetMs` bounds the whole pass. `httpResolver` retries four times with backoff, so a 20-link
 * draft on a flaky network could sit for ~12 minutes with no output while a human waited on the
 * review pack. Links not reached inside the budget come back UNCHECKED -- which is the truth, and
 * the same state the three-state contract already has a name for.
 */
export async function checkLinks(text, resolve, { budgetMs = 120000, now = () => Date.now() } = {}) {
  if (typeof resolve !== "function")
    throw new CitationLintError("BAD_INPUT", "checkLinks needs a resolver function");
  const defs = linkDefinitions(String(text));
  const urls = extractLinks(String(text), defs).filter(isSourceLink);
  const findings = [];
  const deadline = now() + budgetMs;
  let checked = 0;
  for (const url of urls) {
    if (now() >= deadline) {
      findings.push({ level: "WARN", code: "UNCHECKED_LINK", url, status: 0,
        why: "not reached inside the link-check budget -- not live, not dead, simply not checked" });
      continue;
    }
    const r = await resolve(url);
    checked++;
    // OWN property, never an inherited one. A resolver returning an object whose `state` lives on
    // its prototype was read as live and produced no finding -- the three-state contract this file
    // exists to protect, decided by a prototype lookup (defect #12 in this lane's list).
    const state = r !== null && typeof r === "object" && Object.hasOwn(r, "state") ? r.state : undefined;
    const status = r !== null && typeof r === "object" && Object.hasOwn(r, "status") ? r.status : undefined;
    if (state === "live") continue;
    if (state === "dead")
      findings.push({ level: "WARN", code: "DEAD_LINK", url, status,
        why: "the source no longer resolves; the web rots, so this is a WARN and never a FAIL (ADR-1110)" });
    else if (state === "unknown")
      findings.push({ level: "WARN", code: "UNCHECKED_LINK", url, status,
        why: "the link could not be checked -- that is not the same as alive, and it is not the same as dead" });
    else
      throw new CitationLintError("BAD_RESOLVER", `resolver returned ${JSON.stringify(state)} for ${url}, which is none of live/dead/unknown`);
  }
  return { linksFound: urls.length, linksChecked: checked, findings };
}

/** Render for the review pack. FAILs and WARNs are listed apart, because they mean different things. */
export function renderCitationReport(claimResult, linkResult) {
  const lines = [
    `citation-lint -- ${claimResult.sentencesScanned} sentence(s) scanned, ${claimResult.claims} claim(s) of fact` +
    (linkResult ? `, ${linkResult.linksChecked} of ${linkResult.linksFound} link(s) checked` : ", links NOT checked this run"),
  ];
  const fails = claimResult.findings.filter((f) => f.level === "FAIL");
  if (fails.length === 0) lines.push("No uncited claim found. Only figures and attributions are checked -- an unsourced opinion is not caught here and is not meant to be.");
  else {
    lines.push(`${fails.length} uncited claim(s):`);
    for (const f of fails) lines.push(`  L${f.line} [${f.code}] ${f.excerpt}`);
  }
  const warns = (linkResult ? linkResult.findings : []);
  if (warns.length > 0) {
    lines.push(`${warns.length} link warning(s):`);
    for (const w of warns) lines.push(`  [${w.code}] ${w.url} (status ${w.status})`);
  }
  return lines.join("\n");
}
