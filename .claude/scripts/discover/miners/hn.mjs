// discover/miners/hn -- HN Algolia through growth's OWN adapter, tapped at the transport (ADR-1915).
//
// growth's `hnAlgoliaAdapter` walks the search API and classifies every failure (SOURCE_HTTP,
// SOURCE_UNREACHABLE, SOURCE_SHAPE), but returns keyword phrases, not hits. So discover does not
// call Algolia itself: it hands the adapter a `fetchImpl` that paces, identifies itself, caps the
// body and records it, then parses the recorded hits. One walker, two readers of its responses.

import { hnAlgoliaAdapter } from "../../growth/lib/adapters.mjs";
import { MineError } from "../../growth/lib/mine.mjs";
import { ABSENT, MAX_TITLE_BYTES, normalizeCount, normalizeText } from "../lib/normalize.mjs";

export const SOURCE = "hn";
export const USER_AGENT = "arc-discover/0.1 (+https://arc.automemory.ai)";
export const MAX_BODY_BYTES = 4 * 1024 * 1024;
export const PACE_MS = 1000; // ADR-1904: one request per second
const HN_ITEM = "https://news.ycombinator.com/item?id=";
const OBJECT_ID_RE = /^[0-9]{1,12}$/;

/** A pacer: the first call goes at once, each later one waits until PACE_MS after the previous. */
export function pacer(ms = PACE_MS, sleep = (t) => new Promise((r) => setTimeout(r, t)), now = () => Date.now()) {
  let last = null;
  return async () => {
    if (last !== null) {
      const wait = last + ms - now();
      if (wait > 0) await sleep(wait);
    }
    last = now();
  };
}

/** The tap: a fetchImpl for growth's adapter that records every 200 body it passes through. */
export function tapFetch(fetchImpl, { pace = pacer(), maxBytes = MAX_BODY_BYTES } = {}) {
  const recorded = [];
  const tap = async (url, init = {}) => {
    await pace();
    const headers = { ...(init.headers || {}), "user-agent": USER_AGENT };
    const res = await fetchImpl(url, { ...init, headers });
    if (!res.ok) return res; // the adapter drains it and throws SOURCE_HTTP
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.length > maxBytes) throw new MineError("SOURCE_OVERSIZE", `HN answered ${buf.length} bytes, over the ${maxBytes}-byte cap`);
    // Invalid UTF-8 becomes U+FFFD here rather than failing the parse downstream.
    const text = new TextDecoder("utf-8", { fatal: false }).decode(buf);
    recorded.push({ url: String(url), text });
    return new Response(text, { status: res.status, headers: { "content-type": "application/json" } });
  };
  return { tap, recorded };
}

/** One recorded hit -> one evidence record, or a reason it was skipped. Pure. */
export function hitToRecord(hit, query) {
  if (!hit || typeof hit !== "object") return { skip: "not-an-object" };
  const id = typeof hit.objectID === "string" || typeof hit.objectID === "number" ? String(hit.objectID) : "";
  if (!OBJECT_ID_RE.test(id)) return { skip: "no-object-id" };
  const title = normalizeText(hit.title, MAX_TITLE_BYTES);
  const text = normalizeText(hit.story_text);
  if (title === ABSENT && text === ABSENT) return { skip: "deleted-or-empty" };
  return {
    record: {
      source_id: `${SOURCE}:${id}`,
      source_url: HN_ITEM + id,
      title,
      text,
      engagement: { points: normalizeCount(hit.points), comments: normalizeCount(hit.num_comments) },
      ts: normalizeCount(hit.created_at_i),
      query: normalizeText(query, MAX_TITLE_BYTES),
    },
  };
}

/** Code-point order on source_id: numeric-looking ids compare by length first, then bytes. */
export function bySourceId(a, b) {
  const x = a.source_id, y = b.source_id;
  return x.length - y.length || (x < y ? -1 : x > y ? 1 : 0);
}

/**
 * Mine `queries` for `niche`. Returns { records, skipped } with records deduped by source_id and
 * sorted by it, so the same responses in any order give the same output.
 * Throws MineError on any source failure, and COULD_NOT_SCAN when the adapter returned but the tap
 * saw no response -- an unread source is never a quiet market.
 */
export async function mine(queries, { fetchImpl = globalThis.fetch, hitsPerQuery = 20, pace } = {}) {
  if (!Array.isArray(queries) || queries.length === 0) throw new MineError("NO_QUERY", "mine needs at least one query");
  const { tap, recorded } = tapFetch(fetchImpl, pace ? { pace } : {});
  await hnAlgoliaAdapter({ fetchImpl: tap, hitsPerQuery })({ id: "hn-algolia", queries });
  if (recorded.length !== queries.length)
    throw new MineError("COULD_NOT_SCAN", `the adapter returned, but the tap recorded ${recorded.length} of ${queries.length} responses`);
  const byId = new Map();
  const skipped = {};
  recorded.forEach((r, i) => {
    const hits = JSON.parse(r.text).hits; // the adapter already proved this parses to a hits array
    for (const hit of hits) {
      const out = hitToRecord(hit, queries[i]);
      if (out.skip) { skipped[out.skip] = (skipped[out.skip] || 0) + 1; continue; }
      if (!byId.has(out.record.source_id)) byId.set(out.record.source_id, out.record);
      else skipped.duplicate = (skipped.duplicate || 0) + 1;
    }
  });
  return { records: [...byId.values()].sort(bySourceId), skipped };
}

/** A fetchImpl over a fixture file's `responses[]`, served in order; for --offline-fixture and CI. */
export function fixtureFetch(fixture) {
  if (!fixture || !Array.isArray(fixture.responses) || fixture.responses.length === 0)
    throw new MineError("COULD_NOT_SCAN", "fixture has no responses[]");
  let i = 0;
  return async () => {
    if (i >= fixture.responses.length) throw new Error("fixture exhausted");
    const r = fixture.responses[i++];
    const body = r.bodyBase64 !== undefined ? Buffer.from(r.bodyBase64, "base64") : r.body;
    if (r.repeatBytes) return new Response(new Uint8Array(r.repeatBytes).fill(0x20), { status: r.status });
    return new Response(body, { status: r.status });
  };
}
