// The canonical ranking engine: a pure-JS inverted index with BM25F scoring.
//
// ADR-0701 makes this the REFERENCE implementation, not a fallback. The node:sqlite FTS5 engine
// that arrives in Phase 2 is measured against this one, and where they disagree this one is right
// by definition.
//
// BM25F rather than plain BM25 because ADR-0709 asks for tag-weighted ranking: a lesson tagged
// `silent-failure` should answer a query about silent failures more strongly than one that merely
// says the words in passing. Fields are weighted at index time into a single weighted term
// frequency, which is the standard BM25F formulation and keeps query time to one pass.
//
// Zero dependencies, Node >= 18.

import { tokenize } from "./tokenize.mjs";

// Weights are a DECISION, so they are stated here rather than tuned by feel. Tags are the
// strongest signal because a tag is a human's own classification of the lesson; a title is the
// lesson's own sentence; the body includes prevention text and is the largest and noisiest field.
// ADR-0709 forbids retuning these to make the golden set pass -- misses are fixed with alias
// edits recorded beside the miss.
export const FIELD_WEIGHTS = { tags: 4, title: 3, body: 1 };

export const K1 = 1.2;
export const B = 0.75;

/** Build the postings. Called at index time so query time is one pass over matched postings. */
export function buildPostings(records) {
  const terms = Object.create(null); // term -> Map(docIndex -> weighted tf)
  const lengths = new Array(records.length).fill(0);

  for (const [i, r] of records.entries()) {
    const fields = {
      tags: Array.isArray(r.tags) ? r.tags.join(" ") : "",
      title: r.title ?? "",
      body: r.body ?? "",
    };
    for (const [field, weight] of Object.entries(FIELD_WEIGHTS)) {
      const toks = tokenize(fields[field]);
      lengths[i] += weight * toks.length;
      for (const t of toks) {
        const m = terms[t] ?? (terms[t] = new Map());
        m.set(i, (m.get(i) ?? 0) + weight);
      }
    }
  }

  // Serialize deterministically: terms sorted, postings sorted by doc index. The index is a
  // derived artifact that must be byte-reproducible from the same records on three OSes, and
  // Object key order plus Map insertion order are not the same thing as sorted.
  const out = Object.create(null);
  for (const t of Object.keys(terms).sort()) {
    out[t] = [...terms[t].entries()].sort((a, b) => a[0] - b[0]);
  }
  const avgdl = lengths.length ? lengths.reduce((a, b) => a + b, 0) / lengths.length : 0;
  return { terms: out, lengths, avgdl };
}

/**
 * Score every record that carries at least one query token.
 *
 * Returns [{ index, score }] sorted by score DESCENDING, then by the record's doc id ASCENDING.
 * The tie-break is documented, deliberate and load-bearing: ADR-0701's equivalence gate compares
 * ORDERED ids between two engines, and this corpus is tag-heavy with many short similar bodies,
 * so exact ties are the common case rather than a curiosity. Two engines that are both correct
 * but sort ties differently would be reported as drift on every run.
 */
export function search(postings, records, queryTokens, { limit = 10, allow = null } = {}) {
  const N = records.length;
  if (N === 0 || queryTokens.length === 0) return [];
  const { terms, lengths, avgdl } = postings;
  const scores = new Map();

  // Duplicate query tokens must not double-count: "gate gate gate" is the same question as
  // "gate", and without this a repeated word silently becomes a relevance multiplier.
  for (const t of new Set(queryTokens)) {
    const plist = terms[t];
    if (!plist) continue;
    const df = plist.length;
    const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
    for (const [i, wtf] of plist) {
      // The filter is applied HERE, before scoring, not after. Ranking globally and filtering the
      // top-N afterwards let a filter starve the result set: `--source retro-log --limit 5
      // "trial"` printed "no recorded lesson matched" while a matching retro-log record existed,
      // because the global top-20 held none of that source. A confident zero is the worst
      // possible wrong answer, and raising --limit as a workaround is undiscoverable.
      if (allow && !allow.has(i)) continue;
      const norm = avgdl > 0 ? 1 - B + (B * lengths[i]) / avgdl : 1;
      scores.set(i, (scores.get(i) ?? 0) + idf * ((wtf * (K1 + 1)) / (wtf + K1 * norm)));
    }
  }

  return [...scores.entries()]
    .map(([index, score]) => ({ index, score }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      // id-ascending on equal score. Comparing the ID, not the array index, so the order is a
      // property of the DATA and survives any change in how records were collected.
      const ai = records[a.index].id;
      const bi = records[b.index].id;
      return ai < bi ? -1 : ai > bi ? 1 : 0;
    })
    .slice(0, limit);
}
