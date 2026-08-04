// research-lint.mjs — provenance, jurisdiction, verification, and the ICP-generic predicate
// (ADR-0406, ADR-0409, ADR-0404).
//
// Four outcomes, not two. The distinction matters because "accepted" and "sendable" are
// different things:
//
//   PASS      -- a clean dossier, citable for a first touch
//   HELD      -- a dossier exists, but the email could not be verified, so it can NEVER be
//                sent to. Not a rejection: the lead is real, the address is doubtful, and a
//                bounce burns a domain that took 2-4 weeks to warm (ADR-0409).
//   BELOW-BAR -- a dossier exists but has fewer than 2 citable facts. It is WARNed, not
//                blocked: ADR-0404 hard-gates only the deterministic FAIL class, because one
//                false positive on a heuristic silently kills a good draft.
//   REJECTED  -- no dossier is written at all. Purchased and login-wall provenance die here,
//                structurally, rather than being discouraged by policy text.

export const PROVENANCE_ALLOWLIST = Object.freeze([
  "firm-site", "public-directory", "public-listing", "manual-linkedin-note",
]);
export const JURISDICTION_ALLOWLIST = Object.freeze(["IN"]);
const MIN_SOURCE_URLS = 2;
const MIN_CITABLE_FACTS = 2;

// ---------- the ICP-generic predicate (C6b) ----------
//
// A self-labelling `is_generic: true` flag in the fixture would be a vacuous pass -- the test
// would assert the fixture's own claim rather than the rule. So the rule is mechanical and a
// pure function of the corpus.
//
// CHARACTER trigrams, Jaccard, threshold 0.8. The co-citer count is ABSOLUTE (>=3 others),
// not a percentage: an earlier draft said ">=20% of other candidates", which on a 34-row
// corpus means >=7 co-citers and could never fire on a 3-row seed. The rule contradicted the
// corpus it shipped with.

// The character class is spelled out rather than written as a negated a-z range. The repo
// bans negated letter-ranges tree-wide (locale-collation trap) and the gate greps every
// script, JS included -- so a range that is safe in a JS regex still fails the lint. Spelling
// it out costs one line and removes the question.
const KEEP = "abcdefghijklmnopqrstuvwxyz0123456789 \t\n";
const normalizeFact = (t) =>
  Array.from(String(t).toLowerCase())
    .map((ch) => (KEEP.includes(ch) ? ch : ""))
    .join("")
    .replace(/\s+/g, " ")
    .trim();

function trigrams(text) {
  const s = normalizeFact(text);
  const out = new Set();
  for (let i = 0; i + 3 <= s.length; i++) out.add(s.slice(i, i + 3));
  return out;
}

export function similarity(a, b) {
  const A = trigrams(a), B = trigrams(b);
  if (A.size === 0 && B.size === 0) return 1;
  let inter = 0;
  for (const g of A) if (B.has(g)) inter++;
  const union = A.size + B.size - inter;
  return union === 0 ? 0 : inter / union;
}

const GENERIC_SIMILARITY = 0.8;
const GENERIC_MIN_COCITERS = 3;
const SHARED_URL_MIN_OTHERS = 2;

const hostOf = (url) => {
  try { return new URL(String(url)).host.replace(/^www\./, "").toLowerCase(); } catch { return ""; }
};

// Marks the FACT, not the candidate. A candidate drops to BELOW-BAR only when it is left
// with fewer than MIN_CITABLE_FACTS after generic facts are struck -- which is how three
// PASS rows can each cite the same generic fact and stay PASS, while the one whose ONLY
// fact is generic falls through.
export function markGenericFacts(candidates) {
  const all = candidates.flatMap((c, ci) => (c.facts || []).map((f, fi) => ({ ci, fi, f })));
  const urlCount = new Map();
  for (const { f } of all) {
    const h = hostOf(f.evidence_url);
    if (h) urlCount.set(f.evidence_url, (urlCount.get(f.evidence_url) || 0) + 1);
  }

  return candidates.map((c, ci) => ({
    ...c,
    facts: (c.facts || []).map((f, fi) => {
      // rule 1 -- the same claim carried by >=3 OTHER candidates
      const coCiters = new Set();
      for (const other of all) {
        if (other.ci === ci) continue;
        if (similarity(other.f.text, f.text) >= GENERIC_SIMILARITY) coCiters.add(other.ci);
      }
      const byRepetition = coCiters.size >= GENERIC_MIN_COCITERS;

      // rule 2 -- evidence that is not the lead's own domain and is shared with >=2 others
      const own = hostOf(`https://${c.firm_domain || ""}`);
      const evHost = hostOf(f.evidence_url);
      const shared = (urlCount.get(f.evidence_url) || 0) - 1;
      const bySharedUrl = evHost !== "" && evHost !== own && shared >= SHARED_URL_MIN_OTHERS;

      return { ...f, generic: byRepetition || bySharedUrl, _fi: fi };
    }),
  }));
}

// A fact is citable when it is lead-specific AND carries both its evidence URL and the
// fact->offer relevance line. The relevance line is what ADR-0404's FAIL class checks a draft
// against; a fact without one cannot support a personalized first touch.
const isCitable = (f) => !f.generic && !!String(f.evidence_url || "").trim() && !!String(f.relevance || "").trim();

export function lintCandidates(candidates, verdictByEmail) {
  const marked = markGenericFacts(candidates);
  const accepted = [];
  const rejected = [];

  for (const c of marked) {
    const reject = (reason) => rejected.push({ firm: c.firm, exclusion_reason: reason, source_urls: c.source_urls || [] });

    if (!PROVENANCE_ALLOWLIST.includes(c.provenance)) {
      reject(`provenance "${c.provenance}" is outside the closed allowlist — purchased lists and login-wall scraping are rejected structurally (ADR-0409)`);
      continue;
    }
    if (!c.geography) { reject("no geography — a lead without a jurisdiction cannot be checked against the allowlist (ADR-0406)"); continue; }
    if (!JURISDICTION_ALLOWLIST.includes(c.geography)) {
      reject(`geography "${c.geography}" is outside the v1 allowlist ${JURISDICTION_ALLOWLIST.join(",")} — expanding it is its own ADR carrying that regime's rules (ADR-0406)`);
      continue;
    }
    if ((c.source_urls || []).length < MIN_SOURCE_URLS) {
      reject(`only ${(c.source_urls || []).length} source link(s); ${MIN_SOURCE_URLS} required — a dossier is an audit trail, not an assertion`);
      continue;
    }

    const citable = c.facts.filter(isCitable);
    const emailStatus = verdictByEmail.get(String(c.email).toLowerCase()) === "unverifiable" ? "held" : "verified";
    accepted.push({
      ...c,
      email_status: emailStatus,
      citable_facts: citable,
      fact_count: citable.length,
      below_bar: citable.length < MIN_CITABLE_FACTS,
      below_bar_reason: citable.length < MIN_CITABLE_FACTS
        ? `only ${citable.length} citable fact(s); ${MIN_CITABLE_FACTS} required (generic facts and facts missing a relevance line do not count)`
        : null,
    });
  }
  return { accepted, rejected };
}
