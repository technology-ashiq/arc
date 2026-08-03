/**
 * metrics.mjs -- does the harness actually make things better? (Phase 08)
 *
 * Every phase before this one builds machinery. This is the one that lets the machinery be
 * judged, and without it the design source's Feature Admission Rule has nothing to admit
 * features against: *"if a gate adds time without reducing escaped misses or rework, it is
 * removed or downgraded -- data decides, not vibes."*
 *
 * THE ONE RULE THAT SHAPES ALL OF THIS: a metric is COMPUTED from committed records, or it is
 * reported as `not derivable` WITH THE REASON. Never estimated, never inferred, never rounded
 * up from a feeling. A plausible figure in a metrics report is worse than a blank, because a
 * blank invites a question and a figure invites a decision.
 *
 * Nothing here writes. The calibration record is derived from ledgers that already exist; it
 * stores no new state, so it cannot drift from what it describes.
 *
 * Zero dependencies, Node 18+.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { PREDICTION_FIELDS, VERDICTS, isFilled, parseLedger } from "./ledger.mjs";
import { INVENTED_DURATION } from "./quality.mjs";

/** Round to at most 2 decimals without inventing precision: 0.75 stays 0.75, 1.0 becomes 1. */
const num = (n) => Math.round(n * 100) / 100;

const readSafe = (p) => { try { return readFileSync(p, "utf8"); } catch { return null; } };
const listSafe = (d) => { try { return readdirSync(d); } catch { return []; } };
const isDir = (p) => { try { return statSync(p).isDirectory(); } catch { return false; } };

/** A metric that could not be computed. The reason is the whole point of the shape. */
const absent = (name, reason) => ({ name, value: null, unit: null, reason });
const derived = (name, value, unit, reason) => ({ name, value: num(value), unit, reason });

// ---------------------------------------------------------------------------
// Sources
// ---------------------------------------------------------------------------

/** Every slice ledger in a tracker, parsed. */
function ledgers(tracker) {
  const dir = join(tracker, "phases");
  return listSafe(dir)
    .filter((f) => /^phase-\d+-tasks\.md$/i.test(f))
    .sort()
    .map((f) => ({ file: f, phase: (f.match(/phase-(\d+)/) || [, "??"])[1], ...parseLedger(readSafe(join(dir, f)) ?? "") }));
}

/** Every spine event, oldest first. The spine is flat: `.claude/state/hq/events/<date>.jsonl`. */
function spine(root) {
  const dir = join(root, ".claude", "state", "hq", "events");
  if (!isDir(dir)) return null;
  const out = [];
  for (const f of listSafe(dir).filter((f) => f.endsWith(".jsonl")).sort()) {
    for (const line of (readSafe(join(dir, f)) ?? "").split("\n")) {
      if (!line.trim()) continue;
      try { out.push(JSON.parse(line)); } catch { /* a torn line is not a crash */ }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// The six
// ---------------------------------------------------------------------------

/**
 * Escaped spec misses: fidelity reports that found drift.
 *
 * `spec-fidelity` reads only the spec and the diff, so a finding it raises is something the
 * build missed about its own spec. Counting reports rather than findings on purpose: a report
 * with five findings and one with one are both a phase that drifted, and weighting them would
 * be a judgement dressed as arithmetic.
 */
function escapedSpecMisses(tracker) {
  const evDir = join(tracker, "evidence");
  if (!isDir(evDir)) return absent("escaped-spec-misses", "no evidence directory — nothing has been handed off yet");
  let reports = 0, drifted = 0;
  for (const phase of listSafe(evDir)) {
    const text = readSafe(join(evDir, phase, "spec-fidelity.md"));
    if (text === null) continue;
    reports++;
    if (/FIDELITY:\s*drift found/i.test(text)) drifted++;
  }
  if (!reports) return absent("escaped-spec-misses", "no spec-fidelity report has been filed in any evidence pack");
  return derived("escaped-spec-misses", drifted, "phases", `${drifted} of ${reports} filed fidelity report(s) found drift`);
}

/** Rework: `slice.stuck` receipts. Every firing of a backstop is time a slice cost twice. */
function reworkStuck(events) {
  if (events === null) return absent("rework-stuck", "no spine at .claude/state/hq/events — receipts are where this is recorded");
  const stuck = events.filter((e) => e && e.kind === "slice.stuck");
  const byBackstop = {};
  for (const e of stuck) {
    const b = e.payload?.backstop ?? "unnamed";
    byBackstop[b] = (byBackstop[b] ?? 0) + 1;
  }
  const detail = Object.entries(byBackstop).map(([b, n]) => `${b} ${n}`).join(", ");
  return derived("rework-stuck", stuck.length, "receipts", stuck.length ? `by backstop: ${detail}` : "no backstop has fired");
}

/**
 * Time to first proven slice: `develop.started` to the first `slice.done` of that phase.
 *
 * Reported as the mean across phases, with each phase's own figure in the reason — one number
 * hides which phase was slow, and which phase was slow is the only actionable half.
 */
function timeToFirstProven(events) {
  if (events === null) return absent("time-to-first-proven-slice", "no spine at .claude/state/hq/events — receipts carry the timestamps");
  const started = new Map();
  const firstDone = new Map();
  for (const e of events) {
    if (!e || !e.ts) continue;
    const t = Date.parse(e.ts);
    if (Number.isNaN(t)) continue;
    const phase = e.payload?.phase;
    if (e.kind === "develop.started" && phase && !started.has(phase)) started.set(phase, t);
    if (e.kind === "slice.done" && phase && !firstDone.has(phase)) firstDone.set(phase, t);
  }
  const spans = [];
  for (const [phase, t0] of started) {
    const t1 = firstDone.get(phase);
    if (t1 === undefined || t1 < t0) continue;
    spans.push([phase, Math.round((t1 - t0) / 60000)]);
  }
  if (!spans.length) {
    return absent("time-to-first-proven-slice",
      started.size
        ? "a develop.started receipt exists but no slice.done carries the same phase — the pair is what makes this measurable"
        : "no develop.started receipt has landed");
  }
  const mean = spans.reduce((a, [, m]) => a + m, 0) / spans.length;
  return derived("time-to-first-proven-slice", mean, "minutes",
    `mean of ${spans.length} phase(s): ${spans.map(([p, m]) => `phase ${p} ${m}m`).join(", ")}`);
}

/**
 * False-block rate: adjudicated false positives over logged gate runs.
 *
 * Read from the trial ledger, which is the only place a firing is adjudicated by a person.
 * A gate's own logs cannot answer this: whether a block was WRONG is exactly the judgement the
 * gate could not make, which is why the ledger exists.
 */
function falseBlockRate(root) {
  const text = readSafe(join(root, "docs", "trial-ledger.md"));
  if (text === null) return absent("false-block-rate", "no docs/trial-ledger.md — adjudicated firings are recorded there");
  let logged = 0, falsePositives = 0;
  for (const line of text.split(/\r?\n/)) {
    // Outer pipes dropped first. Leaving them made the last cell the empty string after the
    // trailing `|`, so the adjudication was never read and every rate came back 0 — a metric
    // reporting a clean record it had not looked at.
    const cells = line.split("|").map((c) => c.trim())
      .filter((c, i, a) => !(c === "" && (i === 0 || i === a.length - 1)));
    if (cells.length < 5) continue;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(cells[0])) continue;      // a dated run row
    logged++;
    // "false positive" as the adjudication's verdict, not merely the words appearing in prose:
    // the ledger's own entries discuss false positives at length while recording true ones.
    if (/^\**false[- ]positive/i.test(cells[cells.length - 1])) falsePositives++;
  }
  if (!logged) return absent("false-block-rate", "the trial ledger logs no dated gate run yet");
  return derived("false-block-rate", falsePositives / logged, "ratio",
    `${falsePositives} adjudicated false positive(s) in ${logged} logged run(s)`);
}

/**
 * Evidence completeness: ticked slices carrying proof + tier + commit, over ticked slices.
 *
 * A slice is ticked when it claims to be done. This asks how many of those claims are backed,
 * which is a different question from whether the gate passed — the gate can only see the
 * slices it was pointed at.
 */
function evidenceCompleteness(all) {
  let ticked = 0, complete = 0;
  for (const led of all) {
    for (const s of led.slices ?? []) {
      const f = s.fields ?? {};
      if (!(isFilled(f.result) && isFilled(f.commit))) continue;
      ticked++;
      if (isFilled(f.proof) && isFilled(f.tier) && isFilled(f.commit)) complete++;
    }
  }
  if (!ticked) return absent("evidence-completeness", "no slice in any ledger is ticked yet — there is nothing whose evidence could be complete");
  return derived("evidence-completeness", complete / ticked, "ratio", `${complete} of ${ticked} ticked slice(s) carry proof, tier and commit`);
}

/**
 * Ceremony cost per proven slice: recorded ceremony artifacts over proven slices.
 *
 * WHAT THIS DOES NOT COUNT, stated because a measure that omits something and does not say so
 * reads as complete: **agent invocations**. Nothing records them — the spine's kind vocabulary
 * is closed (ADR-0026) and none of its 22 kinds is an agent call — so counting them would mean
 * inventing a number, which is the one thing this file exists to refuse. Widening it needs a
 * new receipt kind and therefore a new ADR.
 */
function ceremonyCost(tracker, all, events) {
  const proven = all.reduce((n, led) =>
    n + (led.slices ?? []).filter((s) => isFilled(s.fields?.result) && isFilled(s.fields?.commit)).length, 0);
  if (!proven) return absent("ceremony-cost", "no slice is proven yet — the denominator is zero");

  const dir = join(tracker, "phases");
  let sections = 0;
  for (const f of listSafe(dir).filter((f) => /^phase-\d+-quality\.md$/i.test(f))) {
    const text = readSafe(join(dir, f)) ?? "";
    let fence = false;
    for (const line of text.split(/\r?\n/)) {
      if (/^[ \t]*(```|~~~)/.test(line)) { fence = !fence; continue; }
      if (!fence && /^[ \t]*#{1,6}[ \t]*(Pattern Annex|Approach sketches)\b/i.test(line)) sections++;
    }
  }
  const stuck = events === null ? 0 : events.filter((e) => e && e.kind === "slice.stuck").length;
  const spineNote = events === null ? "; the spine is absent, so backstop firings are not in this count" : "";
  return derived("ceremony-cost", (sections + stuck) / proven, "artifacts per proven slice",
    `${sections} annex/sketch section(s) + ${stuck} backstop firing(s) over ${proven} proven slice(s). ` +
    `It does NOT count agent invocations: nothing records them, and inventing that number is the one thing this report refuses${spineNote}`);
}

/** All six, in a fixed order, computed or absent. */
export function metrics(root, tracker) {
  const all = ledgers(tracker);
  const events = spine(root);
  return [
    escapedSpecMisses(tracker),
    reworkStuck(events),
    timeToFirstProven(events),
    falseBlockRate(root),
    evidenceCompleteness(all),
    ceremonyCost(tracker, all, events),
  ];
}

// ---------------------------------------------------------------------------
// The calibration record
// ---------------------------------------------------------------------------

/**
 * Every prediction scored at every handoff, aggregated.
 *
 * Not a score. A pattern in where judgement is reliably wrong — which is why it breaks down by
 * FIELD as well as in total: "riskiest-file was wrong twice, both times naming the gate rather
 * than the parser underneath it" is actionable, and "70%" is not.
 */
export function calibration(tracker) {
  const byField = {};
  const totals = Object.fromEntries(VERDICTS.map((v) => [v, 0]));
  const phases = [];
  for (const led of ledgers(tracker)) {
    let scored = 0;
    for (const [field, value] of Object.entries(led.scores ?? {})) {
      const verdict = String(value).trim().split(/[\s—–-]+/)[0]?.toLowerCase();
      if (!VERDICTS.includes(verdict)) continue;
      byField[field] ??= Object.fromEntries(VERDICTS.map((v) => [v, 0]));
      byField[field][verdict]++;
      totals[verdict]++;
      scored++;
    }
    if (scored) phases.push({ phase: led.phase, scored });
  }
  const total = VERDICTS.reduce((n, v) => n + totals[v], 0);
  return { ...totals, total, phases, byField, fields: PREDICTION_FIELDS };
}

// ---------------------------------------------------------------------------
// Suggestions
// ---------------------------------------------------------------------------

const SUGGESTION_FIELDS = ["what", "evidence", "maintenance", "operational-surface", "deletion-opportunity", "default"];

/**
 * Validate the suggestions in a quality file.
 *
 * Suggestions batch at SLICE BOUNDARIES only. An interruption during implementation is a cost
 * paid on every slice for a benefit that lands on few, so a section that does not say
 * `boundary` is refused rather than accepted with a note — the batching rule is the feature.
 *
 * Each carries evidence, the same economics as an approach sketch, and A DEFAULT, so declining
 * costs one word. A suggestion without a default is a question, and a question mid-build is
 * the interruption this was designed to avoid.
 */
export function validateSuggestions(text) {
  const fails = [];
  const lines = String(text ?? "").split(/\r?\n/);
  let fence = false;
  const sections = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/^[ \t]*(```|~~~)/.test(l)) { fence = !fence; continue; }
    if (fence) continue;
    const m = l.match(/^[ \t]*(#{1,6})[ \t]*Suggestions\b(.*)$/i);
    if (m) { sections.push({ at: i + 1, level: m[1].length, rest: m[2], body: [] }); continue; }
    const h = l.match(/^[ \t]*(#{1,6})[ \t]+\S/);
    const cur = sections[sections.length - 1];
    if (!cur) continue;
    if (h && h[1].length <= cur.level) { sections.push({ closed: true }); continue; }
    if (!cur.closed) cur.body.push(l);
  }

  for (const sec of sections.filter((s) => !s.closed)) {
    if (!/\bboundary\b/i.test(sec.rest)) {
      fails.push({ at: sec.at, msg: `a Suggestions section that is not at a slice boundary — suggestions batch at boundaries only, because an interruption mid-slice is a cost paid on every slice for a benefit that lands on few` });
    }
    const body = sec.body.join("\n");
    const rewritten = body.replace(
      /^([ \t]*(?:[-*+][ \t]+)?(?:#{1,6}[ \t]*)?(?:\*{1,2}|_{1,2})?[ \t]*)suggestion[ \t]*:[ \t]*([0-9][0-9a-z-]*)/gim,
      (_m, lead, id) => `${lead}slice: ${id}`,
    );
    const { slices: items } = parseLedger(rewritten);
    if (!items.length) {
      fails.push({ at: sec.at, msg: "a Suggestions section holding no suggestion — an empty section records that nothing was suggested, which is not what it says" });
      continue;
    }
    for (const it of items) {
      const f = it.fields ?? {};
      for (const k of SUGGESTION_FIELDS) {
        if (!isFilled(f[k])) {
          fails.push({ at: sec.at, id: it.id, msg: `suggestion ${it.id} has no \`${k}:\`` + (k === "default" ? " — a default is what makes declining cost one word" : "") });
        }
      }
      // The same ban as an approach sketch, for the same reason and over the same fields.
      const econ = ["maintenance", "operational-surface", "deletion-opportunity"].map((k) => String(f[k] ?? "")).join(" ");
      const m = econ.match(INVENTED_DURATION);
      if (m) {
        fails.push({ at: sec.at, id: it.id, msg: `suggestion ${it.id} prices itself in time ("${m[0].trim()}") — an invented duration reads as measurement and is a vibe` });
      }
    }
  }
  return { fails };
}

/** The report `develop-lint --metrics` prints. */
export function renderMetrics(root, tracker) {
  const out = ["Outcome metrics — computed from committed records, or not at all", ""];
  for (const m of metrics(root, tracker)) {
    out.push(m.value === null
      ? `  ${m.name}: not derivable — ${m.reason}`
      : `  ${m.name}: ${m.value}${m.unit && m.unit !== "ratio" ? " " + m.unit : ""} — ${m.reason}`);
  }
  const c = calibration(tracker);
  out.push("", `Calibration — ${c.total} scored prediction(s): ${VERDICTS.map((v) => `${c[v]} ${v}`).join(" · ")}`);
  for (const [field, counts] of Object.entries(c.byField)) {
    out.push(`  ${field}: ${VERDICTS.map((v) => `${counts[v]} ${v}`).join(" · ")}`);
  }
  if (!c.total) out.push("  (no prediction has been scored yet — the record is derived, so it is empty rather than wrong)");
  return out;
}
