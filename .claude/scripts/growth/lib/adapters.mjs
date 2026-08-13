// growth/adapters -- one adapter per source id. This is the I/O layer: everything above it
// (mine.mjs, cluster.mjs) is pure and testable without a network.
//
// An adapter's contract: async (source) => rawCandidate[], where every row carries the evidence
// URL that source's OWN response produced and `source_id` equal to the source's id. mine.mjs
// re-checks both, so an adapter cannot launder a keyword it did not actually find.

import { readFileSync } from "node:fs";
import { MineError } from "./mine.mjs";

/**
 * Release a response whose body we are not going to read. Under undici an unconsumed body keeps
 * the socket checked out, which can stall process exit on a long run -- and a miner that has
 * printed its result but will not exit reads as a hang.
 */
async function drain(res) {
  try {
    if (res && res.body && typeof res.body.cancel === "function") await res.body.cancel();
  } catch { /* releasing a socket must never be the thing that fails a run */ }
}

const HN_ENDPOINT = "https://hn.algolia.com/api/v1/search";
const HN_ITEM = "https://news.ycombinator.com/item?id=";
const MAX_KEYWORD_LEN = 120;

// Intent is CLASSIFIED from the language people actually used, never invented. The bands are
// deliberately coarse: the machine is not scoring or ranking (a phase rabbit hole), it is only
// sorting rows so a human reads a sensible shape and can move any row before approving.
const TRANSACTIONAL = /\b(pricing|price|cost|buy|vs\.?|alternative|alternatives|cheapest|free tier)\b/i;
const COMMERCIAL = /\b(best|top|review|reviews|comparison|compare|tool|tools|platform|software)\b/i;

/** Title -> a keyword phrase. Strips the HN prefixes and punctuation people put in titles. */
export function titleToKeyword(title) {
  // TRUNCATE FIRST. `/\s*[--|]\s*.*$/` backtracks quadratically on long whitespace runs: 40k
  // chars took 3.3s and 160k took 35s. The 120-char cap used to be applied at the END, after
  // every regex had already run, so it protected nothing. This function is exported, so the
  // bound cannot rely on HN's own title limits.
  const s = String(title)
    .slice(0, 512)
    .replace(/^\s*(show|ask|tell)\s+hn\s*:\s*/i, "")
    .replace(/\s*[–—|]\s*.*$/, "") // drop a trailing dash/pipe subtitle
    .replace(/["'`(){}[\]]/g, " ")
    .replace(/[^\p{L}\p{N}\s.+#-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  return s.slice(0, MAX_KEYWORD_LEN).trim();
}

export function classifyIntent(keyword) {
  if (TRANSACTIONAL.test(keyword)) return "transactional";
  if (COMMERCIAL.test(keyword)) return "commercial";
  return "informational";
}

/**
 * Hacker News via the Algolia public search API -- the one source enabled by default, because it
 * is documented for public use and needs no credentials.
 *
 * `offline` returns [] rather than fabricating hits. A fake that invents plausible keywords would
 * be indistinguishable from the thing this whole module forbids.
 */
export function hnAlgoliaAdapter({ offline = false, fetchImpl = globalThis.fetch, hitsPerQuery = 20 } = {}) {
  return async (source) => {
    if (offline) return [];
    const out = [];
    for (const q of source.queries) {
      const url = `${HN_ENDPOINT}?query=${encodeURIComponent(q)}&tags=story&hitsPerPage=${hitsPerQuery}`;
      let json;
      try {
        const res = await fetchImpl(url, { headers: { accept: "application/json" } });
        if (!res.ok) {
          await drain(res);
          throw new MineError("SOURCE_HTTP", `${source.id} returned ${res.status} for ${JSON.stringify(q)}`);
        }
        json = await res.json();
      } catch (e) {
        // A source that fails is an ERROR, not an empty result. Swallowing it here would turn a
        // broken integration into "the market is quiet", which is the misreading this lane exists
        // to prevent -- MISSING is never zero.
        throw e instanceof MineError ? e : new MineError("SOURCE_UNREACHABLE", `${source.id} unreachable: ${e.message}`);
      }
      // Same shape check, same reason: a 200 whose body is not a hits array is a broken
      // integration, and returning [] for it turns that into "the market is quiet".
      if (json === null || typeof json !== "object" || !Array.isArray(json.hits))
        throw new MineError("SOURCE_SHAPE", `${source.id} answered 200 with no hits array for ${JSON.stringify(q)}`);
      for (const hit of json.hits) {
        if (!hit || !hit.objectID) continue; // no id means no evidence link, so no row
        out.push({ title: hit.title ?? "", objectID: String(hit.objectID), query: q });
      }
    }
    return attestedCandidates(out, source.id);
  };
}

// Words that carry no topic on their own. A phrase made only of these is not a target.
const STOP = new Set(("a an and are as at be building built by can do does for from has have how i in is it its "
  + "my new not of on or our s that the their to us use using vs was we what when where which who why will with you your "
  + "show ask tell hn launch open source").split(" "));

/**
 * Titles are HEADLINES, not keywords -- and the first real run proved it: taking whole titles
 * produced a proposal whose pillar was "dspack studio", a product name nobody searches, next to
 * spokes sharing not one token with it. A headline names one thing that happened once.
 *
 * So a keyword here is an n-gram ATTESTED by at least two INDEPENDENT stories. Frequency across
 * separate items is the evidence that a phrase is language people actually reach for, and it
 * removes proper nouns and one-off announcements structurally rather than by a blocklist. This is
 * still the opposite of inventing keywords: every phrase was typed by a human on a real page, and
 * the row carries a link to one of them.
 */
export function attestedCandidates(items, sourceId, { minAttestations = 2, minN = 2, maxN = 4 } = {}) {
  const seen = new Map(); // phrase -> {ids:Set of distinct TITLES, evidence, query}
  for (const it of items) {
    const words = titleToKeyword(it.title).split(" ").filter(Boolean);
    // Attestation counts distinct TITLES, not distinct objectIDs. HN reposts the same article
    // under the same headline several times, and each repost is its own objectID -- so counting
    // ids let one story corroborate itself three times and manufactured "operating system for
    // 916" as a three-story topic. Independent evidence means a different headline.
    const titleKey = words.join(" ");
    const phrases = new Set();
    for (let n = minN; n <= maxN; n++)
      for (let i = 0; i + n <= words.length; i++) {
        const gram = words.slice(i, i + n);
        // Anchored at both ends: a phrase starting or ending on a stopword is a fragment
        // ("of the agent"), and a phrase of pure stopwords is nothing at all.
        if (STOP.has(gram[0]) || STOP.has(gram[gram.length - 1])) continue;
        if (gram.every((w) => STOP.has(w))) continue;
        if (gram.some((w) => w.length < 2)) continue;
        // A bare number is never a keyword. These arrive as prices and years cut out of a
        // headline -- "operating system for 916" came from a $916 figure -- and they read as
        // topics while being pure noise.
        if (gram.some((w) => /^\d+$/.test(w))) continue;
        phrases.add(gram.join(" "));
      }
    for (const p of phrases) {
      if (!seen.has(p)) seen.set(p, { ids: new Set(), evidence: it.objectID, query: it.query });
      seen.get(p).ids.add(titleKey);
    }
  }
  // Drop a phrase that never occurs OUTSIDE a longer one. If "agents build" is attested exactly
  // as often as "ai agents build", it has no independent existence -- it is the same topic seen
  // through a shorter window, and shipping both puts two rows in front of a human that mean one
  // thing. Equal counts is the test: "ai agents" appears in many contexts and survives, which is
  // why the pillar stays broad while the redundant fragments go.
  const kept = [...seen.entries()].filter(([phrase, rec]) => rec.ids.size >= minAttestations);
  const redundant = new Set();
  for (const [a, ra] of kept)
    for (const [b, rb] of kept) {
      if (a === b || a.length >= b.length) continue;
      if ((" " + b + " ").includes(" " + a + " ") && ra.ids.size === rb.ids.size) { redundant.add(a); break; }
    }

  const out = [];
  for (const [phrase, rec] of seen) {
    if (rec.ids.size < minAttestations) continue;
    if (redundant.has(phrase)) continue;
    // The count is CARRIED, not re-parsed. Sorting used to run a regex back over the prose in
    // gap_note to recover the number it had just written there -- which throws the day anyone
    // rewords the sentence, and is the same validate-one-read-use-another shape as the rest.
    out.push({
      n: rec.ids.size,
      cand: {
        keyword: phrase,
        evidence_url: HN_ITEM + encodeURIComponent(rec.evidence),
        intent: classifyIntent(phrase),
        gap_note: `attested in ${rec.ids.size} independent HN stories; evidence link is one of them; found via query ${JSON.stringify(rec.query)}`,
        source_id: sourceId,
      },
    });
  }
  // Most-attested first, so the pillar chooser sees the broadest topics at the top.
  // Deterministic tiebreak, NOT localeCompare. localeCompare follows the host locale, so the same
  // candidates could order differently on another machine -- and candidate order picks the pillar,
  // which changes the plan, which changes the plan_sha the approval is bound to. A gate keyed on a
  // hash cannot have a locale-dependent input.
  return out.sort((a, b) => b.n - a.n || (a.cand.keyword < b.cand.keyword ? -1 : a.cand.keyword > b.cand.keyword ? 1 : 0)).map((x) => x.cand);
}

/**
 * Verify an HN candidate through Algolia's items API rather than by fetching the human-facing
 * item page.
 *
 * The first real mining run issued one HEAD per candidate against news.ycombinator.com and was
 * rate-limited into 38 unverifiable rows. That was the run behaving badly, not the evidence being
 * bad: the front end is for people. Algolia publishes a per-item endpoint for programmatic use,
 * it is the SAME source that produced the candidate, and a 404 there is a real "this story does
 * not exist" rather than "you are asking too fast".
 */
export function hnAlgoliaVerifier({ fetchImpl = globalThis.fetch, timeoutMs = 15000, chunk = 20 } = {}) {
  // BATCHED, and lazily. The per-item endpoint (`/api/v1/items/<id>`) returns a story's entire
  // comment tree; asking it 51 times ran past ten minutes. The search endpoint answers "do these
  // ids exist" for a whole chunk at once, which is one request instead of fifty and is still a
  // real check against the source rather than a rubber stamp.
  const known = new Set();   // objectIDs Algolia confirmed
  const asked = new Set();   // objectIDs we have already looked up (so absence means absence)
  let reachable = true;      // false once a lookup fails: absence then proves nothing

  async function lookup(ids) {
    const todo = ids.filter((id) => !asked.has(id));
    for (let i = 0; i < todo.length; i += chunk) {
      const slice = todo.slice(i, i + chunk);
      const filters = slice.map((id) => `objectID:${id}`).join(" OR ");
      const url = `https://hn.algolia.com/api/v1/search?tags=story&hitsPerPage=${slice.length}&filters=${encodeURIComponent(filters)}`;
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), timeoutMs);
      try {
        const res = await fetchImpl(url, { headers: { accept: "application/json" }, signal: ac.signal });
        if (!res.ok) {
          reachable = false;
          // Every id in this slice is marked asked-and-unknown so the caller does not then fire
          // one fresh request per remaining candidate -- which is the per-candidate hammering
          // this batching exists to remove, returning through the failure path.
          await drain(res);
          return;
        }
        const json = await res.json();
        // A 200 carrying something that is not a hits array is a BROKEN ANSWER, not an empty one.
        // Treating it as empty marked every id in the slice asked-and-absent while `reachable`
        // stayed true, so the verifier reported live stories DEAD and the run exited 0 with a
        // quietly thinner proposal. The !res.ok and catch paths both set reachable=false; this
        // path did not -- the same fix, missing from one of its three sites.
        if (json === null || typeof json !== "object" || !Array.isArray(json.hits)) { reachable = false; return; }
        for (const hit of json.hits) known.add(String(Number(hit && hit.objectID)));
        for (const id of slice) asked.add(id);
      } catch {
        reachable = false;
        return;
      } finally {
        clearTimeout(timer);
      }
    }
  }

  let primed = null;
  // The URL must actually BE an HN item URL. Matching /[?&]id=(\d+)/ against any string meant a
  // link on a domain guaranteed not to exist was certified LIVE because the number after `id=`
  // happened to be a real HN story -- an invented evidence link passing the one check that exists
  // to make invented evidence impossible. The host is the claim; check it.
  const isHnItem = (u) => {
    if (typeof u !== "string" || !u.startsWith(HN_ITEM)) return null;
    const m = /^https:\/\/news\.ycombinator\.com\/item\?id=(\d+)$/.exec(u);
    // Leading zeros are stripped: "?id=044" and "?id=44" are the same story, and a string compare
    // against the returned set reported the padded form dead.
    return m ? String(Number(m[1])) : null;
  };

  return async (url, _c, allUrls) => {
    const id = isHnItem(url);
    // Not an HN item URL at all -- say UNKNOWN rather than guessing. The caller falls back.
    if (id === null) return { state: "unknown", status: 0 };
    if (!primed) {
      // Only OUR urls are batched. Scraping an id out of every candidate's link regardless of
      // host sent other sources' identifiers to Algolia and burned hitsPerPage slots on them.
      const ids = (Array.isArray(allUrls) ? allUrls : [url]).map(isHnItem).filter((x) => x !== null);
      primed = lookup(ids.length ? ids : [id]);
    }
    await primed;
    // Only retry a single id if the batch actually SUCCEEDED and simply did not cover this one.
    // Retrying while `reachable` is false reopens the request-per-candidate storm on the exact
    // path -- a failing upstream -- where it hurts most.
    if (!asked.has(id) && reachable) await lookup([id]);
    if (known.has(id)) return { state: "live", status: 200 };
    // Absence is only meaningful if the lookup actually succeeded. If Algolia was unreachable,
    // "not in the set" says nothing at all -- and calling that dead is the same MISSING-as-zero
    // mistake this whole three-state resolver exists to stop.
    return reachable && asked.has(id) ? { state: "dead", status: 404 } : { state: "unknown", status: 0 };
  };
}

/**
 * Hand-entered rows (the competitor-gap column). A person read the page and typed the row; the
 * machine still holds it to the same evidence bar as anything it mined itself.
 */
export function manualAdapter() {
  return async (source) => {
    let text;
    try {
      text = readFileSync(source.access.file, "utf8");
    } catch (e) {
      throw new MineError("NO_MANUAL_FILE", `manual source ${source.id} names ${source.access.file}, which cannot be read: ${e.message}`);
    }
    const rows = [];
    text.split("\n").forEach((line, i) => {
      if (line.trim() === "") return;
      try {
        rows.push(JSON.parse(line));
      } catch (e) {
        throw new MineError("BAD_MANUAL_ROW", `${source.access.file} line ${i + 1} is not JSON: ${e.message}`);
      }
    });
    return rows;
  };
}
