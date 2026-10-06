// discover/cluster -- deterministic token-overlap clustering (ADR-1902). Pure: no I/O, no clock.
//
// Determinism is the contract: the same records in ANY order give byte-identical output on every
// OS. So: input is sorted by source_id first, similarity is an integer (never a float string),
// every sort is code-point (never localeCompare), and no path or time enters the document.

import { createHash } from "node:crypto";
import { STOP, titleToKeyword } from "../../growth/lib/adapters.mjs";
import { ABSENT } from "./normalize.mjs";
import { bySourceId } from "../miners/hn.mjs";

// Jaccard x 10000 against each cluster's SEED (first member), chosen once on the recorded snapshot:
// 2500 left 40 clusters of 43 records; any-member matching at 1000 chained unrelated "Launch HN (YC ..)"
// posts through the batch code. Seed at 1000 gave 28 clusters, 8 of them real multi-story pains.
export const THRESHOLD = 1000;
export const TOP_TOKENS = 8;
export const VERSION = 1;

// A YC batch code ("w20", "s17") and "yc" itself name a cohort, not a pain.
const YC = /^(yc|[swfx][0-9]{2})$/;
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/** A conservative plural strip, so "invoices" and "invoice" meet. Never shorter than 3 chars. */
export function stem(word) {
  if (word.length > 4 && word.endsWith("ies")) return word.slice(0, -3) + "y";
  if (word.length > 3 && word.endsWith("s") && !/(ss|us|is|as)$/.test(word)) return word.slice(0, -1);
  return word;
}

/** Title -> its sorted, deduped topic tokens (growth's STOP list, ADR-1116: one list, two readers). */
export function tokens(title) {
  if (title === ABSENT) return [];
  const out = new Set();
  for (const w of titleToKeyword(title).split(" ")) {
    if (!w || STOP.has(w) || w.length < 2 || /^[0-9]+$/.test(w) || YC.test(w)) continue;
    const s = stem(w);
    if (!STOP.has(s)) out.add(s);
  }
  return [...out].sort(cmp);
}

/** Integer Jaccard x 10000 between two token arrays. Empty vs anything is 0. */
export function jaccard(a, b) {
  const A = new Set(a), B = new Set(b);
  let overlap = 0;
  for (const t of A) if (B.has(t)) overlap++;
  const union = A.size + B.size - overlap;
  return union === 0 ? 0 : Math.floor((overlap * 10000) / union);
}

export const sha256 = (s) => createHash("sha256").update(s, "utf8").digest("hex");

function topTokens(members) {
  const freq = new Map();
  for (const m of members) for (const t of m.tokens) freq.set(t, (freq.get(t) || 0) + 1);
  return [...freq.entries()].sort((x, y) => y[1] - x[1] || cmp(x[0], y[0])).slice(0, TOP_TOKENS).map(([t]) => t);
}

/** The fingerprint is over topic tokens, never member ids: one new story must not unmatch a reject. */
export const clusterFp = (top) => sha256([...top].sort(cmp).join(" "));

/**
 * records -> { clusters, untokenized }. `rejects` is [{ receipt, tokens }] read from the spine
 * (ADR-1907/1916); a cluster matching one is marked `previously_rejected` and never scored.
 */
export function cluster(records, { rejects = [], threshold = THRESHOLD } = {}) {
  const sorted = [...records].sort(bySourceId);
  const groups = []; // { seed: tokens[], members: [] }
  let untokenized = 0;
  for (const r of sorted) {
    const tk = tokens(r.title);
    if (tk.length === 0) { untokenized++; continue; }
    let best = -1, bestSim = -1;
    groups.forEach((g, i) => {
      const s = jaccard(tk, g.seed);
      if (s >= threshold && s > bestSim) { best = i; bestSim = s; }
    });
    const m = { ...r, tokens: tk };
    if (best === -1) groups.push({ seed: tk, members: [m] });
    else groups[best].members.push(m);
  }
  const sortedRejects = [...rejects].sort((x, y) => cmp(x.receipt, y.receipt));
  const clusters = groups.map((g) => {
    const top = topTokens(g.members);
    const tsList = g.members.map((m) => m.ts).filter((t) => t !== ABSENT);
    const hit = sortedRejects.find((rj) => jaccard(top, rj.tokens) >= threshold);
    return {
      cluster_fp: clusterFp(top),
      top_tokens: top,
      size: g.members.length,
      first_ts: tsList.length ? Math.min(...tsList) : ABSENT,
      previously_rejected: hit ? hit.receipt : null,
      members: g.members.map((m) => ({ source_id: m.source_id, source_url: m.source_url, title: m.title, engagement: m.engagement, ts: m.ts })),
    };
  });
  clusters.sort((a, b) =>
    b.size - a.size
    || (a.first_ts === ABSENT ? Infinity : a.first_ts) - (b.first_ts === ABSENT ? Infinity : b.first_ts)
    || bySourceId(a.members[0], b.members[0]));
  return { clusters, untokenized };
}

/** The clusters document: fixed key order, LF only, trailing newline -- the bytes CI hashes. */
export function clustersDocument(niche, records, skipped, result) {
  const sk = {};
  for (const k of Object.keys(skipped).sort(cmp)) sk[k] = skipped[k];
  const doc = { version: VERSION, niche, threshold: THRESHOLD, records: records.length, skipped: sk, untokenized: result.untokenized, clusters: result.clusters };
  return JSON.stringify(doc, null, 1) + "\n";
}
