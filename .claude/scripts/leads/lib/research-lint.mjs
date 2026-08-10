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
  // Two facts that both normalize to nothing are NOT "identical" -- they are two facts with
  // no comparable content. Returning 1 marked every non-Latin-script fact generic, in an
  // India-only campaign, which is a false positive that silently kills good drafts. KEEP is
  // ASCII, so Devanagari and Tamil normalize to "".
  if (A.size === 0 || B.size === 0) return 0;
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

// Rule 2 keyed its counter on the RAW url string while comparing hosts through hostOf --
// "validate one read, compare another", the exact recurring class. One query parameter
// (`?ref=3`) or one fragment (`#3`) made five identical directory citations look like five
// distinct sources, and the rule went from 10/10 caught to 0/10.
const canonicalUrl = (url) => {
  try {
    const u = new URL(String(url));
    return `${u.protocol}//${u.host.replace(/^www\./, "").toLowerCase()}${u.pathname.replace(/\/+$/, "")}`;
  } catch { return String(url).trim().toLowerCase(); }
};

// Marks the FACT, not the candidate. A candidate drops to BELOW-BAR only when it is left
// with fewer than MIN_CITABLE_FACTS after generic facts are struck -- which is how three
// PASS rows can each cite the same generic fact and stay PASS, while the one whose ONLY
// fact is generic falls through.
export function markGenericFacts(candidates) {
  const all = candidates.flatMap((c, ci) => (c.facts || []).map((f, fi) => ({ ci, fi, f })));
  // Count DISTINCT CANDIDATES per canonical URL, not raw facts. Counting facts let a single
  // candidate citing one third-party URL three times mark its own facts generic with no other
  // candidate in the corpus -- self-exclusion was applied in rule 1 and omitted in rule 2, in
  // the same function.
  const urlCandidates = new Map();
  for (const { ci, f } of all) {
    const key = canonicalUrl(f.evidence_url);
    if (!key) continue;
    if (!urlCandidates.has(key)) urlCandidates.set(key, new Set());
    urlCandidates.get(key).add(ci);
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

      // rule 2 -- evidence that is not the lead's own domain and is shared with >=2 OTHER
      // candidates. `firm_domain` is corroborated against the email domain: it was
      // caller-supplied and validated against nothing, so declaring firm_domain to BE the
      // shared directory host turned every generic citation into a "lead-specific" one.
      const claimed = hostOf(`https://${c.firm_domain || ""}`);
      const fromEmail = String(c.email || "").split("@")[1] || "";
      const own = claimed && (claimed === fromEmail.toLowerCase() || fromEmail.toLowerCase().endsWith("." + claimed)) ? claimed : "";
      const evHost = hostOf(f.evidence_url);
      const others = new Set(urlCandidates.get(canonicalUrl(f.evidence_url)) || []);
      others.delete(ci);
      const bySharedUrl = evHost !== "" && evHost !== own && others.size >= SHARED_URL_MIN_OTHERS;

      return { ...f, generic: byRepetition || bySharedUrl, _fi: fi };
    }),
  }));
}

// A fact is citable when it is lead-specific AND carries both its evidence URL and the
// fact->offer relevance line. The relevance line is what ADR-0404's FAIL class checks a draft
// against; a fact without one cannot support a personalized first touch.
const isValidUrl = (u) => { try { const x = new URL(String(u)); return x.protocol === "http:" || x.protocol === "https:"; } catch { return false; } };
// `text` was never inspected, so two zero-content facts with an evidence_url and a relevance
// line passed as a clean 2-fact PASS. A fact with no text is not a fact.
const isCitable = (f) =>
  !f.generic && String(f.text || "").trim().length >= 12 && isValidUrl(f.evidence_url) && !!String(f.relevance || "").trim();

// H15: provenance was a LABEL the caller picked, and nothing corroborated it -- so a purchased
// CSV row labelled "public-directory" was accepted, and the comment "rejected structurally"
// described something the code did not do. Each class now has to be consistent with the
// evidence actually supplied.
const LOGIN_WALLED = ["linkedin.com", "facebook.com", "instagram.com", "x.com", "twitter.com"];
function provenanceCorroborated(c, urls) {
  const hosts = urls.map((u) => hostOf(u)).filter(Boolean);
  const emailHost = (String(c.email || "").split("@")[1] || "").toLowerCase();
  const isOwn = (h) => emailHost && (h === emailHost || emailHost.endsWith("." + h) || h.endsWith("." + emailHost));
  const walled = hosts.filter((h) => LOGIN_WALLED.some((w) => h === w || h.endsWith("." + w)));

  switch (c.provenance) {
    case "firm-site":
      // Must cite the firm's own domain, or it is not the firm's site.
      return hosts.some(isOwn) ? null : `provenance "firm-site" but no source link is on the firm's own domain (${emailHost || "unknown"})`;
    case "manual-linkedin-note":
      // The ONE sanctioned login-walled class, and it must actually be one -- otherwise it is
      // a label anything can wear to smuggle scraped content past the allowlist.
      return walled.length ? null : `provenance "manual-linkedin-note" but no source link is on a LinkedIn-class host`;
    case "public-directory":
    case "public-listing":
      // Must NOT be login-walled: a directory behind a login is a scrape wearing a label.
      return walled.length ? `provenance "${c.provenance}" but ${walled[0]} is login-walled — that is a scrape, whatever the label says` : null;
    default:
      return `provenance "${c.provenance}" is outside the closed allowlist`;
  }
}

// EXPORTED, because the caller that BUILDS the verdict map has to key it the same way this
// module READS it. `cmdResearch` keyed on `String(email).toLowerCase()` while this reads with
// NFC + trim + lowercase, so a padded or non-NFC address missed, came back `undefined`, and the
// lead was reported HELD — indistinguishable from a real verifier hold, on a lead the verifier
// had actually verified. One fact derived two ways (D5), across a module boundary.
export const normKey = (e) => String(e == null ? "" : e).normalize("NFC").trim().toLowerCase();

// H8 (a D3 RECURRENCE, not a cousin): rule 1 counts >=3 OTHER candidates, so it cannot fire
// at all on a batch of 3 or fewer -- confirmed 100% PASS on template-identical drafts at
// n<=3, and 100% BELOW-BAR at n>=4. D3 replaced a percentage that could never fire on a small
// corpus with an absolute that also could never fire on a small corpus.
//
// There is no threshold that fixes this, because the rule is inherently comparative: with two
// candidates there is nothing to compare against. So the honest answer is to SAY SO rather
// than emit a silent PASS. The caller surfaces this loudly; it is not swallowed.
export const GENERIC_RULE_MIN_CORPUS = GENERIC_MIN_COCITERS + 1;

export function lintCandidates(candidates, verdictByEmail) {
  const corpusTooSmall = candidates.length < GENERIC_RULE_MIN_CORPUS;
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
    // Length was the only check, so ["",""] satisfied "two source links". Validity and
    // DISTINCTNESS are what make it an audit trail; the same URL twice is one source.
    const urls = [...new Set((c.source_urls || []).filter(isValidUrl).map(canonicalUrl))];
    if (urls.length < MIN_SOURCE_URLS) {
      reject(`only ${urls.length} valid distinct source link(s); ${MIN_SOURCE_URLS} required — a dossier is an audit trail, not an assertion`);
      continue;
    }

    const badProv = provenanceCorroborated(c, urls);
    if (badProv) { reject(badProv + " (ADR-0409)"); continue; }

    const citable = c.facts.filter(isCitable);
    // FAIL CLOSED. This read `=== "unverifiable" ? "held" : "verified"`, so a lookup MISS, a
    // null, and every unrecognized verdict a real verifier might return ("invalid", "risky",
    // "catch-all", "unknown") all mapped to VERIFIED, i.e. sendable. "invalid" means the
    // provider says the mailbox does not exist -- a guaranteed hard bounce on a domain that
    // took 2-4 weeks to warm. Only an explicit "verified" now clears; everything else HOLDs.
    const verdict = verdictByEmail.get(normKey(c.email));
    const emailStatus = verdict === "verified" ? "verified" : "held";
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
  return {
    accepted,
    rejected,
    // Never a silent pass. A run below the floor did not "find no template blast" -- it was
    // structurally incapable of looking.
    genericRuleApplied: !corpusTooSmall,
    corpusWarning: corpusTooSmall
      ? `only ${candidates.length} candidate(s): the ICP-generic repetition rule needs at least ${GENERIC_RULE_MIN_CORPUS} to fire, so template-blast was NOT checked in this run`
      : null,
  };
}
