// growth/evidence -- does the evidence link actually resolve, and what does the site already
// target? Both are external reaches, so both get an interface + a fake + a real impl.
//
// Phase-02 criteria 2 and 5. The fake is deterministic and derives its answer from the input
// (testing rules): it takes an explicit map, so a test can say "this URL is dead" without a
// network and without randomness.

const MAX_REDIRECTS = 5;
const DEFAULT_TIMEOUT_MS = 8000;

export class EvidenceError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "EvidenceError";
    this.code = code;
  }
}

// THREE states, not two. The first version of this file had only ok/not-ok, and the first REAL
// mining run drove 41 valid Hacker News links into "did not resolve" on HTTP 429 -- a rate limit,
// which says nothing whatever about whether the page exists. Two-state logic turns "I could not
// tell" into "it is dead", which is MISSING being silently read as zero: the exact non-negotiable
// this lane carries. A fixture run would never have shown it, which is what criterion 7 is for.
export const EV_LIVE = "live";
export const EV_DEAD = "dead";
export const EV_UNKNOWN = "unknown";

// Definitively gone. Everything else that is not a success is UNKNOWN -- including 401/403, where
// a bot block tells us about the server's opinion of us and nothing about the resource.
const DEAD_STATUSES = new Set([404, 410]);

const sleepMs = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Deterministic resolver for tests and offline runs.
 * `map` is {url: true|false|"unknown"}. A URL the map does not mention is UNKNOWN, never live --
 * an unmentioned link is unproven, and defaulting it to fine would make every test that forgets
 * to list a URL pass for the wrong reason.
 */
export function fakeResolver(map = {}) {
  return async (url) => {
    if (map[url] === true) return { state: EV_LIVE, status: 200 };
    if (map[url] === false) return { state: EV_DEAD, status: 404 };
    return { state: EV_UNKNOWN, status: 0 };
  };
}

/**
 * Real resolver. HEAD first because it is cheaper, falling back to a ranged GET for the servers
 * that answer HEAD with 405 -- treating those as dead would silently strip real evidence.
 *
 * Retries the retryable statuses with backoff and honours Retry-After, then gives up as UNKNOWN
 * rather than as dead. `pauseMs` paces every call: the 429 storm above was self-inflicted, one
 * request per candidate as fast as the loop could issue them.
 */
export function httpResolver({
  timeoutMs = DEFAULT_TIMEOUT_MS,
  fetchImpl = globalThis.fetch,
  maxRetries = 3,
  pauseMs = 350,
  sleep = sleepMs,
} = {}) {
  return async (url) => {
    let last = { state: EV_UNKNOWN, status: 0 };
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (attempt > 0 || pauseMs > 0) await sleep(attempt === 0 ? pauseMs : Math.min(8000, pauseMs * 2 ** attempt));
      for (const method of ["HEAD", "GET"]) {
        const ac = new AbortController();
        const timer = setTimeout(() => ac.abort(), timeoutMs);
        try {
          const res = await fetchImpl(url, {
            method,
            redirect: "follow",
            signal: ac.signal,
            headers: method === "GET" ? { Range: "bytes=0-0" } : undefined,
          });
          if (res.status === 405 && method === "HEAD") continue;
          if (res.status >= 200 && res.status < 400) return { state: EV_LIVE, status: res.status };
          if (DEAD_STATUSES.has(res.status)) return { state: EV_DEAD, status: res.status };
          last = { state: EV_UNKNOWN, status: res.status };
          if (res.status === 429) {
            const ra = Number(res.headers && res.headers.get ? res.headers.get("retry-after") : NaN);
            if (Number.isFinite(ra) && ra > 0) await sleep(Math.min(30000, ra * 1000));
          }
          break; // retryable: go round the outer loop rather than trying GET on the same failure
        } catch {
          last = { state: EV_UNKNOWN, status: 0 };
          if (method === "GET") break;
        } finally {
          clearTimeout(timer);
        }
      }
    }
    return last;
  };
}

/**
 * Split candidates three ways. Returns all three rather than filtering silently: a run that
 * quietly drops half its candidates looks identical to a thin market, and the UNKNOWN bucket is
 * the one the caller must not be allowed to mistake for either of the others.
 */
export async function partitionByEvidence(candidates, resolve) {
  const live = [];
  const dead = [];
  const unknown = [];
  // The whole URL list is handed to every call so a source-native verifier can answer the batch
  // in one request instead of one per row. Computed once, outside the loop.
  const allUrls = candidates.map((c) => c.evidence_url);
  for (const c of candidates) {
    let r;
    try {
      // The candidate is passed too, so a caller can dispatch to the SOURCE's own verifier. A
      // source knows how to confirm its own evidence without abusing a human-facing page -- the
      // first real run learned that by rate-limiting itself into 38 unverifiable rows.
      r = await resolve(c.evidence_url, c, allUrls);
    } catch {
      r = { state: EV_UNKNOWN, status: 0 };
    }
    const state = r && r.state ? r.state : EV_UNKNOWN;
    if (state === EV_LIVE) live.push(c);
    else if (state === EV_DEAD) dead.push({ ...c, _status: r.status });
    else unknown.push({ ...c, _status: r ? r.status : 0 });
  }
  return { live, dead, unknown };
}

// ---------- own pages, read from the site's own sitemap ----------

// Deliberately a regex over <loc> rather than an XML parser dependency: A2, boring tech before
// clever tech. The shape is fixed by the sitemaps.org schema and Astro generates it, so the
// clever option buys nothing here. Entities are decoded because &amp; is the one that actually
// appears in generated sitemaps.
const LOC_RE = /<loc>\s*([^<]+?)\s*<\/loc>/gi;

export function parseSitemap(xml) {
  if (typeof xml !== "string" || xml.trim() === "")
    throw new EvidenceError("BAD_SITEMAP", "sitemap is empty");
  const urls = [];
  for (const m of xml.matchAll(LOC_RE)) {
    const raw = m[1]
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, "&");
    if (raw) urls.push(raw);
  }
  // A sitemap that parses to nothing is a parse failure, not an empty site. Returning [] here
  // would switch the own-pages exclusion off silently and the miner would start proposing
  // keywords the site already ranks for -- competing with itself, invisibly.
  if (urls.length === 0)
    throw new EvidenceError("BAD_SITEMAP", "sitemap contained no <loc> entries, which is a parse failure rather than an empty site");
  return urls;
}

/**
 * Turn sitemap URLs into the set of things the site already targets. The last non-empty path
 * segment is the slug, and the slug is what a keyword would collide with.
 */
export function ownTargetsFromSitemap(xml) {
  const out = new Set();
  for (const u of parseSitemap(xml)) {
    let path;
    try {
      path = new URL(u).pathname;
    } catch {
      continue; // a malformed <loc> is not a target; parseSitemap already proved the file parsed
    }
    const segs = path.split("/").filter(Boolean);
    if (segs.length === 0) continue; // the homepage targets nothing in particular
    out.add(segs[segs.length - 1].replace(/\.[a-z0-9]+$/i, ""));
  }
  return out;
}

/** Real sitemap reader. Kept separate from the parser so the parser stays pure and testable. */
export function httpSitemapReader({ timeoutMs = DEFAULT_TIMEOUT_MS, fetchImpl = globalThis.fetch } = {}) {
  return async (sitemapUrl) => {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    try {
      const res = await fetchImpl(sitemapUrl, { redirect: "follow", signal: ac.signal });
      if (!res.ok) throw new EvidenceError("BAD_SITEMAP", `sitemap fetch returned ${res.status}`);
      return await res.text();
    } finally {
      clearTimeout(timer);
    }
  };
}
