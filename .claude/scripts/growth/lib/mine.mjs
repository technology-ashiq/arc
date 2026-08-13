// growth/mine -- turn a NAMED source list into evidenced keyword candidates.
//
// REQ-01, phase-02 criteria 1-3. Pure logic: every external reach is an injected function, so the
// whole module is testable with no network (offline-first, build playbook 3.2/3.4). The CLI wires
// the real fetchers; the tests wire fakes that derive their answers from the input.
//
// THE RULE THIS FILE EXISTS TO ENFORCE: no invented keywords, ever. A candidate is admissible only
// if it carries the id of the source that produced it AND an evidence URL from that source's own
// response. That is why `source_id` is on the candidate even though the phase spec names four
// keys: without provenance "this keyword came from a real source" is an assertion, not a fact, and
// the rabbit-hole list in the spec calls inventing keywords out by name. The deviation is
// deliberate and recorded in PROGRESS rather than absorbed silently.

const INTENTS = Object.freeze(["informational", "commercial", "transactional"]);
export const CANDIDATE_KEYS = Object.freeze(["keyword", "evidence_url", "intent", "gap_note", "source_id"]);
const ENABLABLE_METHODS = Object.freeze(["official-public-api", "official-api", "manual-entry"]);
const SOURCE_ID_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
const HTTPS_RE = /^https:\/\/[a-z0-9.-]+\/[^\s]*$/i;
const MAX_KEYWORD_LEN = 120;
const MAX_GAP_NOTE_LEN = 500;

export class MineError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "MineError";
    this.code = code;
  }
}

// Control characters are refused by CODE POINT so no control byte is ever written literally into
// this source file -- the same reason validate-content.mjs does it this way.
function hasControlChar(s) {
  for (let i = 0; i < s.length; i++) {
    const c = s.codePointAt(i);
    if (c < 0x20 || c === 0x7f) return true;
  }
  return false;
}

/**
 * Parse and validate the versioned source list. Throws rather than returning a partial list: a
 * miner that silently drops a malformed source reads exactly like a miner whose source returned
 * nothing, and the phase spec's whole point is that the sources are KNOWN.
 */
export function loadSources(text) {
  let cfg;
  try {
    cfg = JSON.parse(text);
  } catch (e) {
    throw new MineError("BAD_SOURCES", `source list is not valid JSON: ${e.message}`);
  }
  if (cfg === null || typeof cfg !== "object" || Array.isArray(cfg))
    throw new MineError("BAD_SOURCES", "source list must be a JSON object");
  if (cfg.schema !== 1)
    throw new MineError("BAD_SOURCES", `source list schema must be 1, got ${JSON.stringify(cfg.schema)}`);
  if (!Array.isArray(cfg.sources))
    throw new MineError("BAD_SOURCES", "source list must carry a sources array");

  const seen = new Set();
  for (const s of cfg.sources) {
    if (s === null || typeof s !== "object" || Array.isArray(s))
      throw new MineError("BAD_SOURCES", "every source must be an object");
    if (typeof s.id !== "string" || !SOURCE_ID_RE.test(s.id))
      throw new MineError("BAD_SOURCES", `source id ${JSON.stringify(s.id)} is not a lowercase slug`);
    if (seen.has(s.id)) throw new MineError("BAD_SOURCES", `duplicate source id ${JSON.stringify(s.id)}`);
    seen.add(s.id);
    if (typeof s.enabled !== "boolean")
      throw new MineError("BAD_SOURCES", `source ${s.id} must state enabled as a boolean`);
    // A disabled source must say WHY in the file itself. A bare `false` decays into folklore in
    // about a week, and the phase spec's pending owner question is exactly this list.
    if (!s.enabled && (typeof s.disabled_reason !== "string" || s.disabled_reason.trim() === ""))
      throw new MineError("BAD_SOURCES", `disabled source ${s.id} must carry a disabled_reason`);
    if (s.access === null || typeof s.access !== "object" || Array.isArray(s.access))
      throw new MineError("BAD_SOURCES", `source ${s.id} must carry an access object`);
    // The non-negotiable is official APIs only. This is where that is enforced rather than
    // remembered: an enabled source whose method is not an official one cannot run at all.
    //
    // `manual-entry` is the third allowed method and it does NOT weaken that rule: it covers rows
    // a person read and typed, where no automated access happens at all, so the terms question the
    // rule exists to answer does not arise. It is held to a stricter bar instead -- it must name
    // the file holding those rows, and every row still needs a resolving evidence URL like any
    // other candidate. That is the path the competitor-gap column uses.
    if (s.enabled && !ENABLABLE_METHODS.includes(s.access.method))
      throw new MineError("BAD_SOURCES",
        `source ${s.id} is enabled with access.method ${JSON.stringify(s.access.method)} -- only ${ENABLABLE_METHODS.join(", ")} may be enabled (official APIs only)`);
    if (s.enabled && s.access.method === "manual-entry" && (typeof s.access.file !== "string" || s.access.file.trim() === ""))
      throw new MineError("BAD_SOURCES", `enabled manual-entry source ${s.id} must name the access.file holding its hand-entered rows`);
    if (s.enabled && s.access.method !== "manual-entry" && (typeof s.access.terms_url !== "string" || !HTTPS_RE.test(s.access.terms_url)))
      throw new MineError("BAD_SOURCES", `enabled source ${s.id} must cite a terms_url so the permission is checkable`);
    if (!Array.isArray(s.queries))
      throw new MineError("BAD_SOURCES", `source ${s.id} must carry a queries array`);
    if (s.enabled && s.access.method !== "manual-entry" && s.queries.length === 0)
      throw new MineError("BAD_SOURCES", `enabled source ${s.id} has no queries, so enabling it mines nothing`);
  }
  return cfg;
}

export const enabledSources = (cfg) => cfg.sources.filter((s) => s.enabled);

/**
 * Structural validation of ONE candidate. Used on the way out of every source adapter, so a
 * malformed row never reaches the cluster builder in the first place.
 */
export function assertCandidate(c) {
  if (c === null || typeof c !== "object" || Array.isArray(c))
    throw new MineError("BAD_CANDIDATE", "candidate must be an object");

  // ONE read per field, taken up front through an OWN-property descriptor, validated as the local
  // copy, and returned as the local copy. Two confirmed attacks made this necessary:
  //   - the closed-key loop used Object.keys (own) while the presence loop used `in` (inherited),
  //     so an object with NO own properties whose prototype carried all five fields passed;
  //   - fields were read 2-6 times, so a getter could answer the validation reads with a real URL
  //     and hand the consumer an invented one.
  // Validating one value and shipping another is this lane's recurring defect. Returning `frozen`
  // rather than `c` is the half that actually closes it.
  const frozen = {};
  for (const k of CANDIDATE_KEYS) {
    const d = Object.getOwnPropertyDescriptor(c, k);
    if (d === undefined) throw new MineError("BAD_CANDIDATE", `candidate is missing ${k}`);
    // A getter is refused outright rather than read once: its value is not a property of the
    // object, it is a function of when you asked.
    if (!("value" in d)) throw new MineError("BAD_CANDIDATE", `candidate ${k} is an accessor, not a value`);
    frozen[k] = d.value;
  }
  for (const k of Object.keys(c))
    if (!CANDIDATE_KEYS.includes(k))
      throw new MineError("BAD_CANDIDATE", `candidate has unknown key ${JSON.stringify(k)} (shape is closed to ${CANDIDATE_KEYS.join("|")})`);
  for (const k of CANDIDATE_KEYS) {
    if (typeof frozen[k] !== "string") throw new MineError("BAD_CANDIDATE", `candidate ${k} must be a string`);
    if (hasControlChar(frozen[k])) throw new MineError("BAD_CANDIDATE", `candidate ${k} contains a control character`);
  }
  const kw = frozen.keyword.trim();
  if (kw === "") throw new MineError("BAD_CANDIDATE", "candidate keyword is empty");
  if (kw !== frozen.keyword) throw new MineError("BAD_CANDIDATE", "candidate keyword has leading or trailing whitespace");
  if (kw.length > MAX_KEYWORD_LEN)
    throw new MineError("BAD_CANDIDATE", `candidate keyword is ${kw.length} chars, ceiling is ${MAX_KEYWORD_LEN}`);
  if (!INTENTS.includes(frozen.intent))
    throw new MineError("BAD_CANDIDATE", `candidate intent ${JSON.stringify(frozen.intent)} is outside ${INTENTS.join("|")}`);
  // The evidence URL is the whole claim. An absent or non-http one is refused HERE, structurally,
  // so criterion 5 is not a warning printed by something downstream that a caller can ignore.
  if (!HTTPS_RE.test(frozen.evidence_url))
    throw new MineError("NO_EVIDENCE", `candidate ${JSON.stringify(frozen.keyword)} has no resolvable-shaped evidence_url (${JSON.stringify(frozen.evidence_url)})`);
  if (!SOURCE_ID_RE.test(frozen.source_id))
    throw new MineError("BAD_CANDIDATE", `candidate source_id ${JSON.stringify(frozen.source_id)} is not a lowercase slug`);
  if (frozen.gap_note.length > MAX_GAP_NOTE_LEN)
    throw new MineError("BAD_CANDIDATE", `candidate gap_note is ${frozen.gap_note.length} chars, ceiling is ${MAX_GAP_NOTE_LEN}`);
  return Object.freeze(frozen);
}

/**
 * Normalised comparison key for "the site already targets this". Case, punctuation and word order
 * all vary between a keyword and the slug a page was published under, so both sides are reduced to
 * a sorted token set. Sorting matters: "agent build system" and "build system agent" are the same
 * target, and treating them as different is how a site ends up competing with itself.
 */
export function targetKey(s) {
  // UNICODE-PRESERVING. The first version stripped everything outside [a-z0-9], so every
  // non-Latin keyword collapsed to the empty string: two distinct CJK phrases became the same
  // key, dedupe silently dropped one, and a single em-dash slug in the sitemap excluded EVERY
  // non-Latin candidate at once. The adapter deliberately keeps \p{L}\p{N}, so the two halves of
  // the pipeline were running contradictory unicode policies -- and losing rows to that is
  // MISSING read as zero, which this lane treats as a defect rather than a rough edge.
  // NFKC first so accented and decomposed forms of the same word agree.
  const tokens = String(s)
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return tokens.slice().sort().join(" ");
}

/**
 * Drop candidates the site already targets. `ownTargets` is the set produced from the site's own
 * sitemap, so this is evidence-driven rather than a hand-maintained deny list that goes stale the
 * first time someone publishes without updating it.
 */
export function excludeOwnPages(candidates, ownTargets) {
  // A Set or an array -- not a string. Spreading a string yields its CHARACTERS, so a caller
  // passing "abc" silently excluded on single letters instead of erroring.
  if (typeof ownTargets === "string" || !(ownTargets instanceof Set || Array.isArray(ownTargets)))
    throw new MineError("BAD_INPUT", "ownTargets must be a Set or an array of slugs");
  // The empty key is dropped from BOTH sides. targetKey can legitimately return "" (a slug of
  // pure punctuation), and one such entry would otherwise match every candidate whose keyword
  // also reduced to "" -- an unbounded, silent exclusion driven by one junk sitemap row.
  const own = new Set([...ownTargets].map(targetKey).filter((k) => k !== ""));
  return candidates.filter((c) => {
    const k = targetKey(c.keyword);
    return k === "" || !own.has(k);
  });
}

/** Drop exact-duplicate keywords, keeping the first (append order = discovery order). */
export function dedupeCandidates(candidates) {
  const seen = new Set();
  const out = [];
  for (const c of candidates) {
    const k = targetKey(c.keyword);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(c);
  }
  return out;
}

/**
 * Run every ENABLED source through its adapter and return validated, deduped, own-page-excluded
 * candidates.
 *
 * `adapters` maps a source id to an async (source) => rawCandidate[]. An enabled source with no
 * adapter is an ERROR, not a skip: silently mining nothing from a source the file says is on is
 * the failure mode that makes an empty result look like a quiet market.
 */
export async function mine({ cfg, adapters, ownTargets = new Set() }) {
  // "Official APIs only" was enforced ONLY in loadSources, while mine() re-derived the enabled
  // list from whatever object it was handed -- so the non-negotiable was a call-order convention
  // rather than a property of the code. A cfg that never passed the door is re-run through it
  // here; loadSources is pure and cheap, and a structural guarantee beats a remembered one.
  cfg = loadSources(typeof cfg === "string" ? cfg : JSON.stringify(cfg));
  const enabled = enabledSources(cfg);
  if (enabled.length === 0)
    throw new MineError("NO_SOURCES", "no source is enabled, so this run could only invent keywords");
  const all = [];
  for (const s of enabled) {
    const adapter = adapters[s.id];
    if (typeof adapter !== "function")
      throw new MineError("NO_ADAPTER", `source ${s.id} is enabled but has no adapter wired`);
    const raw = await adapter(s);
    if (!Array.isArray(raw))
      throw new MineError("BAD_ADAPTER", `adapter for ${s.id} did not return an array`);
    for (const c of raw) {
      assertCandidate(c);
      // Provenance is checked, not trusted: an adapter that mislabels its own output would
      // otherwise launder a keyword from one source under another source's name.
      if (c.source_id !== s.id)
        throw new MineError("BAD_PROVENANCE", `adapter for ${s.id} returned a candidate labelled ${JSON.stringify(c.source_id)}`);
      all.push(c);
    }
  }
  return excludeOwnPages(dedupeCandidates(all), ownTargets);
}
