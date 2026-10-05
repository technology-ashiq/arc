// discover/judge -- the council's question for each finalist, fixed in form (ADR-1910). Pure.
//
// council.verdict is closed to session_id|question_hash|call|confidence, so the ONLY thread from a
// verdict back to a cluster is the question's sha256. The question is therefore built from fields
// fixed at cluster time -- the candidate slug and the owner's signal -- and never re-worded later.

import { sha256 } from "./cluster.mjs";

export const FINALISTS = 2;
const SLUG_MAX_BASE = 30;

/** niche + cluster_fp -> the candidate slug the exporter will also write (launch's grammar). */
export function candidateSlug(niche, clusterFp) {
  let base = niche.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, SLUG_MAX_BASE).replace(/-+$/, "");
  if (!/^[a-z]/.test(base)) base = `v-${base}`;
  return `${base}-${clusterFp.slice(0, 6)}`;
}

export function question(slug, signal) {
  return `Within 90 days of the owner running arc launch new for ${slug}, will it reach ${signal}?`;
}

/**
 * scores document -> up to FINALISTS finalists, highest score first, tie by cluster_fp.
 * A previously rejected cluster never reaches here: the scorer did not score it.
 */
export function finalists(scoresDoc, clustersDoc, signal) {
  const byFp = new Map(clustersDoc.clusters.map((c) => [c.cluster_fp, c]));
  return scoresDoc.scores.slice(0, FINALISTS).map((s) => {
    const c = byFp.get(s.cluster_fp);
    if (!c) throw new Error(`scored cluster ${s.cluster_fp} is not in clusters.json`);
    const slug = candidateSlug(clustersDoc.niche, s.cluster_fp);
    const q = question(slug, signal);
    return { cluster_fp: s.cluster_fp, slug, score: s.score, top_tokens: c.top_tokens, question: q, question_hash: sha256(q), evidence: s.evidence };
  });
}
