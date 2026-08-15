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
        // Redirects are followed BY HAND so that MAX_REDIRECTS actually bounds something. With
        // `redirect: "follow"` the constant was declared and never referenced -- the real bound
        // was the platform default of 20 -- which is a guard that cannot fire.
        let target = url;
        let hops = 0;
        let settled = null;
        while (settled === null) {
          const ac = new AbortController();
          const timer = setTimeout(() => ac.abort(), timeoutMs);
          try {
            const res = await fetchImpl(target, {
              method,
              redirect: "manual",
              signal: ac.signal,
              headers: method === "GET" ? { Range: "bytes=0-0" } : undefined,
            });
            const status = res.status;
            const location = res.headers && res.headers.get ? res.headers.get("location") : null;
            if (status >= 300 && status < 400 && location) {
              if (++hops > MAX_REDIRECTS) { settled = { state: EV_UNKNOWN, status }; break; }
              let next;
              try { next = new URL(location, target).toString(); } catch { settled = { state: EV_UNKNOWN, status }; break; }
              // A catch-all redirect to the site root is a SOFT 404: the page does not exist and
              // the server said so with a 200 somewhere else. Calling that live would let a
              // fabricated evidence_url pass verification, which is the one thing this module
              // exists to prevent.
              try {
                if (new URL(next).pathname === "/" && new URL(url).pathname !== "/") {
                  settled = { state: EV_UNKNOWN, status };
                  break;
                }
              } catch { /* an unparseable next is handled on the following hop */ }
              target = next;
              continue;
            }
            if (status === 405 && method === "HEAD") { settled = "try-get"; break; }
            if (status >= 200 && status < 300) { settled = { state: EV_LIVE, status }; break; }
            if (DEAD_STATUSES.has(status)) { settled = { state: EV_DEAD, status }; break; }
            if (status === 429) {
              const ra = Number(res.headers && res.headers.get ? res.headers.get("retry-after") : NaN);
              if (Number.isFinite(ra) && ra > 0) await sleep(Math.min(30000, ra * 1000));
            }
            settled = { state: EV_UNKNOWN, status };
          } catch {
            settled = { state: EV_UNKNOWN, status: 0 };
          } finally {
            clearTimeout(timer);
          }
        }
        if (settled === "try-get") continue;
        if (settled.state === EV_LIVE || settled.state === EV_DEAD) return settled;
        last = settled;
        break; // retryable: go round the outer loop rather than trying GET on the same failure
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
  // Everything that can throw is INSIDE the loop's try. Building this list outside it, and
  // reading r.status outside it, meant one null candidate or one throwing getter rejected the
  // whole function -- losing every row at once, which looks exactly like a thin market and is the
  // failure this function's own contract says it prevents.
  const allUrls = [];
  for (const c of candidates) allUrls.push(c === null || typeof c !== "object" ? "" : c.evidence_url);

  for (const c of candidates) {
    let state = EV_UNKNOWN;
    let status = 0;
    try {
      // The candidate is passed too, so a caller can dispatch to the SOURCE's own verifier. A
      // source knows how to confirm its own evidence without abusing a human-facing page -- the
      // first real run learned that by rate-limiting itself into 38 unverifiable rows.
      const r = await resolve(c.evidence_url, c, allUrls);
      // ONE read of each field. Reading r.state twice let an injected resolver answer "dead" to
      // the classification and "live" to the branch, putting a 404 row into the live bucket.
      const s = r === null || typeof r !== "object" ? undefined : r.state;
      const st = r === null || typeof r !== "object" ? undefined : r.status;
      state = s === EV_LIVE || s === EV_DEAD || s === EV_UNKNOWN ? s : EV_UNKNOWN;
      status = Number.isFinite(st) ? st : 0;
    } catch {
      state = EV_UNKNOWN;
      status = 0;
    }
    if (state === EV_LIVE) live.push(c);
    else if (state === EV_DEAD) dead.push({ ...c, _status: status });
    else unknown.push({ ...c, _status: status });
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
  // COMMENTS ARE STRIPPED FIRST. A bare regex honoured a <loc> inside an XML comment, so one
  // injected comment -- anywhere a sitemap is generated from CMS or user content -- adds an
  // own-page target and silently excludes whatever keyword it names. That is a denial-of-content
  // attack with no error and no log line.
  xml = xml.replace(/<!--[\s\S]*?-->/g, "");
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
  // parseSitemap refuses a file with zero <loc> so the exclusion is never silently switched off.
  // This function could still hand back an empty Set from a sitemap that parsed fine -- a site of
  // nothing but the homepage, or of unparseable <loc> values -- which switches it off one layer
  // further up, where nothing was watching. Same defect, one layer over.
  if (out.size === 0)
    throw new EvidenceError("BAD_SITEMAP",
      "the sitemap parsed but yielded no own-page targets, which would switch the exclusion off silently -- pass no sitemap deliberately instead");
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
