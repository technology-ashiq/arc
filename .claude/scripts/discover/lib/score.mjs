// discover/score -- evidence-traced, integer-only scoring from owner-owned weights (ADR-1903).
//
// Every term is an integer 0..100 and lists the evidence ids that moved it. An input that is ABSENT
// (engagement) is named in the row and contributes nothing -- never a silent 0 standing in for data,
// never NaN (REQ-03). Pure apart from `loadWeights`.

import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { parseYamlSubset } from "../../engine/yaml-subset.mjs";
import { ABSENT } from "./normalize.mjs";

export const TERMS = ["pain_frequency", "money_signal", "buildability_2w", "moat_hint"];
export const KICKOFF_DECISION = "kickoff-ADR-1903";
const MONEY = /(\$\s?[0-9]|\b(pay|paid|paying|pricing|price|prices|invoice|invoices|invoicing|revenue|subscription|subscriptions|customers?|buy|cost|costs|expensive|charge|charged|billing|budget|refund)\b)/i;
const BUILD_PLUS = /\b(tool|tools|app|api|cli|extension|plugin|automation|automate|reminder|reminders|dashboard|bot|template|spreadsheet|tracker)\b/i;
const BUILD_MINUS = /\b(hardware|chip|chips|regulation|regulated|bank|banking|medical|satellite|robot|robots|factory|license|licensing)\b/i;
const MOAT = /\b(data|dataset|network|integration|integrations|workflow|workflows|marketplace|compliance|community|proprietary)\b/i;
const AMOUNT = /\$\s?([0-9]{1,6})(?:\.([0-9]{2}))?\b/g;

export class ScoreError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

export const weightsSha = (w) => createHash("sha256").update(TERMS.map((t) => `${t}=${w[t]}`).join("\n"), "utf8").digest("hex");

/** score.yaml -> { weights, decision, weights_sha256 }; refuses a weight edit whose sha was not updated. */
export function loadWeights(path) {
  const r = parseYamlSubset(readFileSync(path, "utf8"));
  if (!r.ok) throw new ScoreError("WEIGHTS_YAML", `${path}:${r.error.line} ${r.error.what}`);
  const doc = r.value || {};
  const w = doc.weights || {};
  for (const t of TERMS) {
    const v = Number(w[t]);
    if (!Number.isSafeInteger(v) || v < 0 || v > 100) throw new ScoreError("WEIGHTS_SHAPE", `weight ${t}=${JSON.stringify(w[t])} must be an integer 0..100`);
    w[t] = v;
  }
  if (TERMS.reduce((s, t) => s + w[t], 0) === 0) throw new ScoreError("WEIGHTS_SHAPE", "all weights are 0");
  const sha = weightsSha(w);
  if (doc.weights_sha256 !== sha) throw new ScoreError("WEIGHTS_UNRECEIPTED", `weights changed without updating weights_sha256 (now ${sha}); a weight change needs a decision.recorded (DIS-C)`);
  if (typeof doc.decision !== "string" || doc.decision === "") throw new ScoreError("WEIGHTS_UNRECEIPTED", "score.yaml names no decision");
  return { weights: w, decision: doc.decision, weights_sha256: sha };
}

const clamp = (n) => Math.max(0, Math.min(100, n));
const textOf = (m) => `${m.title === ABSENT ? "" : m.title} ${m.text === undefined || m.text === ABSENT ? "" : m.text}`;

/** Median of positive integers (lower median on an even count), or ABSENT. */
function median(xs) {
  if (!xs.length) return ABSENT;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor((s.length - 1) / 2)];
}

/** One cluster -> its terms, evidence and money estimate. `members` carry title/text/engagement. */
export function scoreCluster(c, weights) {
  const ids = (pred) => c.members.filter(pred).map((m) => m.source_id);
  const comments = c.members.map((m) => (m.engagement || {}).comments).filter((v) => v !== ABSENT && v !== undefined);
  const terms = {};
  terms.pain_frequency = {
    value: clamp(10 * c.size + (comments.length ? Math.floor(comments.reduce((s, v) => s + v, 0) / 10) : 0)),
    evidence: c.members.map((m) => m.source_id),
    note: comments.length ? "size + comments" : "engagement: ABSENT (size only)",
  };
  const moneyIds = ids((m) => MONEY.test(textOf(m)));
  terms.money_signal = { value: clamp(25 * moneyIds.length), evidence: moneyIds };
  const plus = ids((m) => BUILD_PLUS.test(textOf(m))), minus = ids((m) => BUILD_MINUS.test(textOf(m)));
  terms.buildability_2w = { value: clamp(50 + 15 * plus.length - 25 * minus.length), evidence: [...new Set([...plus, ...minus])].sort() };
  const moatIds = ids((m) => MOAT.test(textOf(m)));
  terms.moat_hint = { value: clamp(20 * moatIds.length), evidence: moatIds };

  // No match is a real 0, not missing data: every term is weighted. Only an INPUT that is ABSENT is
  // named (engagement, in the pain term note above), so a singleton cannot outrank a real pain by
  // having its empty terms renormalised away (found by the 2026-10-06 smoke run).
  const dropped = [];
  const wsum = TERMS.reduce((s, t) => s + weights[t], 0);
  const score = Math.floor(TERMS.reduce((s, t) => s + weights[t] * terms[t].value, 0) / wsum);

  const amounts = [];
  const amountIds = [];
  for (const m of c.members) {
    let hit = false;
    for (const a of textOf(m).matchAll(AMOUNT)) { amounts.push(Number(a[1]) * 100 + Number(a[2] || 0)); hit = true; }
    if (hit) amountIds.push(m.source_id);
  }
  const evidence = [...new Set(TERMS.flatMap((t) => terms[t].evidence))].sort();
  return {
    cluster_fp: c.cluster_fp,
    score,
    dropped,
    terms,
    evidence,
    money_signal: { estimate_minor: median(amounts), currency: "USD", evidence: amountIds },
  };
}

/** clusters.json document -> scores document (string). Previously rejected clusters are never scored. */
export function scoreDocument(clustersDoc, w) {
  const rows = [];
  const skipped = [];
  for (const c of clustersDoc.clusters) {
    if (c.previously_rejected) { skipped.push({ cluster_fp: c.cluster_fp, previously_rejected: c.previously_rejected }); continue; }
    rows.push(scoreCluster(c, w.weights));
  }
  for (const r of rows) if (r.evidence.length === 0) throw new ScoreError("NO_EVIDENCE", `cluster ${r.cluster_fp} scored with no evidence`);
  rows.sort((a, b) => b.score - a.score || (a.cluster_fp < b.cluster_fp ? -1 : a.cluster_fp > b.cluster_fp ? 1 : 0));
  return JSON.stringify({ version: 1, niche: clustersDoc.niche, weights: w.weights, weights_sha256: w.weights_sha256, decision: w.decision, scores: rows, not_scored: skipped }, null, 1) + "\n";
}
