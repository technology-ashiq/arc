// personalization.mjs — the draft gate (ADR-0404). FAIL / BELOW-BAR / PASS.
//
// The split is by DETERMINISM, not by severity:
//
//   FAIL      -- structural, mechanically checkable, and it HARD-GATES from birth. A draft
//                citing a fact that is not in the dossier cannot reach the inbox at all, so
//                fake personalization is impossible rather than discouraged.
//   BELOW-BAR -- heuristic. WARN-first, rendered ON the inbox item, so the approver sees it
//                and decides. One false positive on a heuristic would otherwise silently kill
//                a good draft and starve the trial ledger of the evidence that would justify
//                promoting the check.
//
// ADR-0049's lesson runs underneath all of it: a pass condition that is only an ABSENCE
// cannot detect mediocrity. "References nothing specific -> FAIL" lets compliant,
// characterless mail through. So BELOW-BAR exists as a class that fails for INSUFFICIENCY,
// and the cross-draft similarity guard exists because per-draft checks are structurally
// blind to template-blast: 25 drafts can each cite a real fact and still be the same email.

import { createHash } from "node:crypto";

export const VERDICT = Object.freeze({ FAIL: "FAIL", BELOW_BAR: "BELOW-BAR", PASS: "PASS" });

const DEFAULTS = Object.freeze({ min_cited_facts: 2, similarity_threshold: 0.7 });

// Slop markers. Not an exhaustive list and not claimed to be -- it catches the phrases that
// signal a draft nobody actually wrote for this person.
const SLOP = [
  "hope this finds you well",
  "i hope this email finds you",
  "i came across your profile",
  "i noticed you",
  "quick question",
  "just following up",
  "circling back",
  "touching base",
  "as a fellow",
  "i've been following your work",
];

export const draftSha = (body) => createHash("sha256").update(String(body), "utf8").digest("hex");

const KEEP = "abcdefghijklmnopqrstuvwxyz0123456789 ";
const norm = (s) =>
  Array.from(String(s).toLowerCase()).map((c) => (KEEP.includes(c) ? c : " ")).join("").replace(/\s+/g, " ").trim();

// Word shingles, not character trigrams. Template-blast is a WORD-level phenomenon: two
// drafts differing only in a name share their sentences, and word shingles measure that
// directly. (The dossier's ICP-generic rule uses character trigrams because there the unit
// is a short claim, not a body.)
function shingles(text, n = 5) {
  const w = norm(text).split(" ").filter(Boolean);
  const out = new Set();
  for (let i = 0; i + n <= w.length; i++) out.add(w.slice(i, i + n).join(" "));
  return out;
}

export function bodySimilarity(a, b) {
  const A = shingles(a), B = shingles(b);
  if (A.size === 0 || B.size === 0) return A.size === B.size ? 1 : 0;
  let inter = 0;
  for (const s of A) if (B.has(s)) inter++;
  return inter / Math.min(A.size, B.size);
}

// A draft declares its citations in frontmatter: { fact, source } pairs. The lint verifies
// BOTH directions -- the fact appears in the body, and the source exists in the dossier --
// because a one-directional check lets a draft cite a real dossier fact it never mentions,
// or mention a fact it never sourced.
export function lintDraft(draft, dossier, opts = {}) {
  const cfg = { ...DEFAULTS, ...opts };
  const fails = [];
  const warns = [];
  const body = String(draft.body || "");
  const cites = Array.isArray(draft.cites) ? draft.cites : [];

  const dossierFacts = (dossier.citable_facts || dossier.facts || []);
  const factTexts = dossierFacts.map((f) => norm(f.text));

  // FAIL 1 -- nothing lead-specific at all.
  if (cites.length === 0)
    fails.push("no lead-specific reference at all: the draft cites zero dossier facts");

  for (const c of cites) {
    const cf = norm(c.fact);
    // FAIL 2 -- a cited fact that is not in the dossier. THIS is what makes fake
    // personalization mechanically impossible: the model cannot invent a flattering detail,
    // because the detail must already exist in evidence gathered at research time.
    if (!factTexts.some((t) => t.includes(cf) || cf.includes(t)))
      fails.push(`cited fact is not in the dossier: "${String(c.fact).slice(0, 60)}" — a draft cannot invent evidence`);
    // FAIL 3 -- cited but not actually in the body.
    else if (!norm(body).includes(cf.slice(0, Math.min(cf.length, 40))))
      fails.push(`cited fact does not appear in the draft body: "${String(c.fact).slice(0, 60)}"`);
    // FAIL 4 -- the fact->offer relevance line.
    if (!String(c.relevance || "").trim())
      fails.push(`cited fact carries no fact-to-offer relevance line: "${String(c.fact).slice(0, 60)}"`);
  }

  if (fails.length) return { verdict: VERDICT.FAIL, fails, warns, sha: draftSha(body) };

  // ---- heuristic classes below this line: WARN, never a block ----
  if (cites.length < cfg.min_cited_facts)
    warns.push(`only ${cites.length} cited fact(s); the bar is ${cfg.min_cited_facts}`);

  const low = norm(body);
  for (const s of SLOP) if (low.includes(norm(s))) warns.push(`slop marker: "${s}"`);

  return { verdict: warns.length ? VERDICT.BELOW_BAR : VERDICT.PASS, fails, warns, sha: draftSha(body) };
}

// Campaign-scope, because that is the only scope at which template-blast is visible. Run
// after per-draft linting: a draft can be individually perfect and still be one of 25 clones.
export function lintCampaign(drafts, opts = {}) {
  const cfg = { ...DEFAULTS, ...opts };
  const results = drafts.map((d) => ({ ref: d.ref, verdict: d.verdict, warns: [...(d.warns || [])] }));
  for (let i = 0; i < drafts.length; i++) {
    for (let j = i + 1; j < drafts.length; j++) {
      const sim = bodySimilarity(drafts[i].body, drafts[j].body);
      if (sim >= cfg.similarity_threshold) {
        const msg = (other) => `body is ${(100 * sim).toFixed(0)}% identical to draft ${other} (threshold ${(100 * cfg.similarity_threshold).toFixed(0)}%)`;
        results[i].warns.push(msg(drafts[j].ref));
        results[j].warns.push(msg(drafts[i].ref));
      }
    }
  }
  // A FAIL stays a FAIL; a PASS with a new similarity warning drops to BELOW-BAR.
  for (const r of results)
    if (r.verdict === VERDICT.PASS && r.warns.length) r.verdict = VERDICT.BELOW_BAR;
  return results;
}
