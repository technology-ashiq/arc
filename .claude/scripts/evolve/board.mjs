// board.mjs — the honest state of every module's optimisation, folded from the spine.
//
// SPINE-G (ADR-0030): every byte below comes from the spine READER. There is no path to
// events/*.jsonl and no path to state.db in this file — `spine-reader-lint.sh` greps for exactly
// that, and Cycle 7 widened its glob to cover this directory.
//
// The three rules that shape every line of output:
//
//  1. ABSENT DATA IS `MISSING`, NEVER ZERO. A window with no measurement for an arm is not a
//     window where that arm scored 0 — it is a window nobody measured, and summing it as zero
//     is how a challenger "wins" on data that was never collected.
//  2. NO INVENTED NUMBERS. Every figure printed here is counted from receipts or read from a
//     manifest. Nothing is estimated, interpolated or defaulted.
//  3. REPLAY-IDENTICAL. The fold sorts on a TOTAL ORDER key, never on the order lines happen to
//     sit in a day file.
//
// ---------------------------------------------------------------------------------------------
// THE READ PATH IS NOT THE WRITE PATH. The emitter validates; the reader replays what was
// written and does NOT re-validate. So a line that arrived by replay, by a merge, or from
// another emitter reaches this fold unchecked. A fresh-agent pass broke the first version of
// this file 15 ways through exactly that gap — forging experiment panels out of newlines in an
// id, counting one unit three times by measuring it in three windows, summing guardrail units
// into the primary metric's n, and deleting a MISSING window with an unrelated receipt that
// merely named its id in `supersedes`.
//
// So every event crosses a QUARANTINE BOUNDARY here (`admit`): envelope shape, field grammars,
// and per-kind sanity are re-asserted, and anything that fails is counted as DAMAGED and
// rendered as a number rather than silently dropped. A consumer that trusts the writer is a
// consumer with no defence against the one line the writer never saw.
// ---------------------------------------------------------------------------------------------

import { query } from "../hq/spine.mjs";
import { nowMs } from "../hq/lib/canonical.mjs";
import { GRAMMAR } from "../hq/lib/validate-experiment.mjs";

export const MISSING = "MISSING";

const TS_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?\+05:30$/;
const ULID_RE = /^[0-9A-HJKMNP-TV-Z]{26}$/;
const EXPERIMENT_KINDS = new Set([
  "experiment.opened", "experiment.assigned", "experiment.measured", "experiment.verdict",
  "promotion.proposed", "experiment.promoted", "experiment.rolled_back", "experiment.closed",
]);

const isPlainObject = (v) =>
  v !== null && typeof v === "object" && !Array.isArray(v) &&
  (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);

const str = (v, re) => typeof v === "string" && re.test(v);

// ---------- the quarantine boundary ----------

/**
 * Re-assert on READ what the emitter asserted on WRITE. Returns {ok:[], damaged:n}.
 * Nothing here trusts a field it has not matched against a grammar.
 */
export function admit(events) {
  const ok = [];
  let damaged = 0;
  for (const e of events) {
    // A `null` line used to crash the whole board on `e.ts`; a number, a string, an array and
    // `{}` were all folded silently and never counted. Only JSON.parse failures reached `torn`.
    if (!isPlainObject(e) || !str(e.ts, TS_RE) || !str(e.id, ULID_RE) || typeof e.kind !== "string") { damaged++; continue; }
    if (e.supersedes !== null && e.supersedes !== undefined && !str(e.supersedes, ULID_RE)) { damaged++; continue; }
    if (!EXPERIMENT_KINDS.has(e.kind)) { ok.push(e); continue; } // non-experiment kinds pass through untouched
    if (!isPlainObject(e.payload)) { damaged++; continue; }
    if (!admitPayload(e.kind, e.payload)) { damaged++; continue; }
    ok.push(e);
  }
  return { ok, damaged };
}

function admitPayload(kind, p) {
  switch (kind) {
    case "experiment.opened":
      return str(p.experiment_id, GRAMMAR.experiment_id) && str(p.module, GRAMMAR.module) &&
             str(p.surface, GRAMMAR.slug) && str(p.base_sha, GRAMMAR.sha) &&
             Array.isArray(p.arms) && p.arms.length >= 2 && p.arms.every((a) => str(a, GRAMMAR.arm)) &&
             Number.isSafeInteger(p.ttl_days) && p.ttl_days > 0;
    case "experiment.assigned":
      return str(p.experiment_id, GRAMMAR.experiment_id) && str(p.arm, GRAMMAR.arm) &&
             typeof p.unit_id === "string" && p.unit_id.length > 0 && p.unit_id.length <= 64;
    case "experiment.measured":
      return str(p.experiment_id, GRAMMAR.experiment_id) && str(p.arm, GRAMMAR.arm) &&
             str(p.metric, GRAMMAR.metric) && str(p.window_start, GRAMMAR.day) && str(p.window_end, GRAMMAR.day) &&
             p.window_start <= p.window_end &&
             typeof p.unit_id === "string" && p.unit_id.length > 0 && p.unit_id.length <= 64 &&
             Number.isSafeInteger(p.unit_count) && p.unit_count >= 0;
    case "experiment.verdict":
      return str(p.experiment_id, GRAMMAR.experiment_id) && (p.outcome === "verdict" || p.outcome === "no-verdict");
    case "experiment.closed":
      return str(p.experiment_id, GRAMMAR.experiment_id) &&
             ["winner", "no-verdict", "killed"].includes(p.outcome);
    case "promotion.proposed":
      return str(p.proposal_id, GRAMMAR.proposal_id) && str(p.experiment_id, GRAMMAR.experiment_id) &&
             (p.kind === "promote" || p.kind === "revert");
    case "experiment.promoted":
    case "experiment.rolled_back":
      return str(p.proposal_id, GRAMMAR.proposal_id) && str(p.commit_ref, GRAMMAR.commit_ref);
    default:
      return false;
  }
}

// ---------- total order ----------

// `ts` is compared as a PARSED INSTANT, not as a string: a foreign line carrying a numeric ts
// made `a.ts < b.ts` false in both directions, which is an INCONSISTENT comparator — V8's sort
// then returns different orders for different inputs, and the board stopped being replayable.
// `admit` now rejects such a line outright, and comparing instants keeps the comparator total
// even if a future ts format widens. `sha` is the third key so the order stays total when two
// lines share an id (a duplicate id is damage, but damage must still order deterministically).
function orderKey(e) {
  return [Date.parse(e.ts), e.id, e.sha ?? ""];
}
function totalOrder(a, b) {
  const ka = orderKey(a), kb = orderKey(b);
  for (let i = 0; i < ka.length; i++) {
    if (ka[i] < kb[i]) return -1;
    if (ka[i] > kb[i]) return 1;
  }
  return 0;
}

/**
 * Honour `supersedes` only from a receipt that is entitled to supersede.
 *
 * The first version matched on id alone, so ANY strict-valid receipt could delete ANY other —
 * an `experiment.closed` for a different experiment erased the one measurement that made a
 * window MISSING, and the gap disappeared from the board. A correction must be a correction:
 * same kind, same experiment, not older, and not itself.
 *
 * Returns {kept, dropped, refused} — `refused` is rendered, because a supersedes that did NOT
 * take effect is exactly as interesting as one that did.
 */
export function applySupersedes(events) {
  const byId = new Map(events.map((e) => [e.id, e]));
  const dropped = new Set();
  let refused = 0;
  for (const sup of events) {
    if (!sup.supersedes) continue;
    const victim = byId.get(sup.supersedes);
    if (!victim) { refused++; continue; }                       // points at nothing on this spine
    if (victim.id === sup.id) { refused++; continue; }           // self-supersede annihilated the line
    if (victim.kind !== sup.kind) { refused++; continue; }
    if (subjectOf(victim) !== subjectOf(sup)) { refused++; continue; }
    if (Date.parse(sup.ts) < Date.parse(victim.ts)) { refused++; continue; } // an older line cannot correct a newer one
    dropped.add(victim.id);
  }
  // A 2-cycle (A supersedes B, B supersedes A) would drop BOTH and erase real receipts without
  // trace. If a superseder is itself dropped, its own supersede does not take effect.
  for (const sup of events) {
    if (sup.supersedes && dropped.has(sup.id) && dropped.has(sup.supersedes)) {
      dropped.delete(sup.supersedes);
      refused++;
    }
  }
  return { kept: events.filter((e) => !dropped.has(e.id)), dropped: dropped.size, refused };
}

const subjectOf = (e) => e.payload?.experiment_id ?? e.payload?.proposal_id ?? null;

// A window is identified by its METRIC as well as its dates. Without the metric in the key, a
// guardrail measurement landed in the same bucket as the primary one and its units were summed
// into the primary metric's n — two units of guardrail evidence pushed a surface to its floor.
const windowKey = (p) => `${p.metric} ${p.window_start}..${p.window_end}`;
const windowLabel = (k) => { const [m, w] = k.split(" "); return { metric: m, window: w }; };

// ---------- fold ----------

export function foldExperiments(rawEvents) {
  const sorted = [...rawEvents].sort(totalOrder);
  const { kept, dropped, refused } = applySupersedes(sorted);
  const byId = new Map();

  const ensure = (id) => {
    if (!byId.has(id)) {
      byId.set(id, {
        experiment_id: id, module: null, surface: null, target_path: null, base_sha: null,
        split: null, ttl_days: null, arms: [], opened_ts: null, armsRedeclared: false,
        assigned: new Map(),   // unit_id -> arm  (the AUTHORITY on which arm a unit is in)
        windows: new Map(),    // metric\0window -> Map(arm -> Map(unit_id -> unit_count))
        strayArms: new Set(), conflicts: new Set(),
        last_measured_ts: null,
        verdict: null, closed: null, proposals: [], promoted: [], rolled_back: [],
      });
    }
    return byId.get(id);
  };

  for (const e of kept) {
    const p = e.payload;
    switch (e.kind) {
      case "experiment.opened": {
        const x = ensure(p.experiment_id);
        // A SECOND opened that declares a different arm set used to turn MISSING windows into
        // complete ones — data nobody collected stopped being missing because the declaration
        // changed. The arm set is now the UNION of every declaration (fail closed: more arms
        // means more windows can be MISSING) and the redeclaration is rendered.
        if (x.arms.length && x.arms.join(",") !== [...p.arms].join(",")) x.armsRedeclared = true;
        const union = new Set([...x.arms, ...p.arms]);
        Object.assign(x, {
          module: p.module, surface: p.surface, target_path: p.target_path ?? x.target_path,
          base_sha: p.base_sha, split: p.split, ttl_days: p.ttl_days,
          arms: [...union].sort(), opened_ts: x.opened_ts ?? e.ts,
        });
        break;
      }
      case "experiment.assigned": {
        const x = ensure(p.experiment_id);
        x.assigned.set(p.unit_id, p.arm);
        break;
      }
      case "experiment.measured": {
        const x = ensure(p.experiment_id);
        const k = windowKey(p);
        if (!x.windows.has(k)) x.windows.set(k, new Map());
        const w = x.windows.get(k);
        // The ASSIGNMENT decides which arm a unit belongs to, not the measurement. A unit
        // measured under two different arms otherwise counted in both, because `arm` is not
        // part of the measured idem and a differing `source_id` makes the two receipts distinct.
        const assigned = x.assigned.get(p.unit_id);
        if (assigned && assigned !== p.arm) { x.conflicts.add(p.unit_id); break; }
        const arm = assigned ?? p.arm;
        if (x.arms.length && !x.arms.includes(arm)) { x.strayArms.add(arm); break; }
        if (!w.has(arm)) w.set(arm, new Map());
        // Per-unit MAX, never a sum: one unit measured in one window is one unit, however many
        // receipts describe it.
        const cur = w.get(arm).get(p.unit_id) ?? 0;
        w.get(arm).set(p.unit_id, Math.max(cur, p.unit_count));
        if (!x.last_measured_ts || e.ts > x.last_measured_ts) x.last_measured_ts = e.ts;
        break;
      }
      case "experiment.verdict": { ensure(p.experiment_id).verdict = { ...p, ts: e.ts }; break; }
      case "experiment.closed": { ensure(p.experiment_id).closed = { ...p, ts: e.ts }; break; }
      case "promotion.proposed": { ensure(p.experiment_id).proposals.push({ ...p, ts: e.ts }); break; }
      case "experiment.promoted": { attachToProposal(byId, p, "promoted", e.ts); break; }
      case "experiment.rolled_back": { attachToProposal(byId, p, "rolled_back", e.ts); break; }
      default: break;
    }
  }
  return { experiments: byId, superseded: dropped, refusedSupersedes: refused };
}

// promoted / rolled_back name a proposal, not an experiment. Resolve through the proposal so a
// promoted experiment actually shows its promotion — the first version folded both into fields
// nothing ever rendered.
function attachToProposal(byId, p, field, ts) {
  for (const x of byId.values())
    if (x.proposals.some((pr) => pr.proposal_id === p.proposal_id)) { x[field].push({ ...p, ts }); return; }
}

/**
 * Classify every window. A window is MISSING when ANY declared arm has no unit in it — and a
 * MISSING window contributes to NO arm's count.
 *
 * When the arm set is UNKNOWN (no `experiment.opened` on this spine) every window is MISSING:
 * `x.arms.filter(...)` over an empty array is empty, so the first version concluded "nothing is
 * missing" and printed `complete` for measurements it could not possibly have checked.
 */
export function classifyWindows(x) {
  const out = [];
  for (const k of [...x.windows.keys()].sort()) {
    const w = x.windows.get(k);
    const { metric, window } = windowLabel(k);
    if (x.arms.length === 0) {
      out.push({ key: k, metric, window, missing: true, missingArms: [], armsUnknown: true, byArm: w });
      continue;
    }
    const missingArms = x.arms.filter((a) => !w.has(a) || countUnits(w.get(a)) === 0);
    out.push({ key: k, metric, window, missing: missingArms.length > 0, missingArms, armsUnknown: false, byArm: w });
  }
  return out;
}

// Units that actually contributed an observation. A receipt declaring `unit_count: 0` says it
// observed nothing; counting the receipt row anyway let four zero-observation receipts reach a
// floor of two.
const countUnits = (unitMap) => [...unitMap.values()].filter((c) => c > 0).length;

/**
 * n per arm for one metric, over COMPLETE windows only, counting DISTINCT units.
 *
 * Summing per-window sizes counted one unit once per window it appeared in — three windows made
 * one unit look like three, and overlapping windows counted the same unit over the same days.
 */
export function countPerArm(x, windows, metric) {
  const n = {};
  const obs = {};
  for (const a of x.arms) { n[a] = new Set(); obs[a] = 0; }
  for (const w of windows) {
    if (w.missing || w.metric !== metric) continue;
    for (const a of x.arms) {
      const cell = w.byArm.get(a);
      if (!cell) continue;
      for (const [unit, count] of cell) if (count > 0) { n[a].add(unit); obs[a] += count; }
    }
  }
  const out = {};
  for (const a of x.arms) out[a] = { units: n[a].size, observations: obs[a] };
  return out;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days between an event ts and now. `ahead` when the receipt post-dates the clock. */
export function ageDays(ts, now) {
  if (!ts) return null;
  const t = Date.parse(ts);
  if (!Number.isFinite(t)) return null;
  // A machine with a fast clock produced "-47d ago", which sorts to the freshest end of any
  // staleness sweep. An age that runs backwards is not an age.
  if (now < t) return "ahead";
  return Math.floor((now - t) / DAY_MS);
}

// ---------- render ----------

// Every interpolated value passes through here. A crafted `experiment_id` carrying newlines
// forged an entire experiment panel — nine complete windows nobody measured — on a board whose
// header promises every figure is counted. `admit` already refuses that receipt; this is the
// second wall, because the grammars will widen one day and the render must not depend on them.
function safe(v, max = 80) {
  let s = String(v ?? "");
  s = s.replace(/[\p{Cc}\p{Cf}]/gu, "?");
  return s.length > max ? s.slice(0, max - 1) + "…".replace("…", "~") : s;
}
const pad = (s, n) => safe(s).padEnd(n);

export function renderBoard(events, modules, now) {
  const lines = [];
  const { ok, damaged } = admit(events);
  const { experiments, superseded, refusedSupersedes } = foldExperiments(ok);

  lines.push("arc evolve board");
  lines.push("");

  lines.push("BASELINE");
  if (modules.length === 0) {
    lines.push("  (no module declares a valid evolve section)");
  } else {
    for (const m of [...modules].sort((a, b) => (a.name < b.name ? -1 : 1))) {
      lines.push(`  module ${pad(m.name, 0)}`);
      const metrics = [...(m.metrics || [])].sort((a, b) => (String(a.name) < String(b.name) ? -1 : 1));
      if (metrics.length === 0) lines.push("    (no metrics declared)");
      for (const met of metrics) {
        const observed = ok.filter((e) => e.kind === "metric.observed" && e.payload?.metric === met.name).length;
        const state = observed === 0
          ? `${MISSING}  no metric.observed receipts (the client's kind, ADR-0308 - not implemented in this lane)`
          : `${observed} observation(s)`;
        lines.push(`    ${pad(met.name, 24)} ${pad(met.role, 10)} ${state}`);
      }
    }
  }
  lines.push("");

  lines.push("EXPERIMENTS");
  const ids = [...experiments.keys()].sort();
  if (ids.length === 0) lines.push("  (no experiments opened)");

  for (const id of ids) {
    const x = experiments.get(id);
    const windows = classifyWindows(x);
    const floor = floorFor(modules, x.module);
    const primary = primaryMetric(modules, x.module);
    const counts = countPerArm(x, windows, primary);

    let state;
    if (x.closed) state = `CLOSED  ${safe(x.closed.outcome)}`;
    else if (x.verdict) state = `VERDICT ${safe(x.verdict.outcome)}`;
    else if (x.arms.length === 0) state = `PENDING  no experiment.opened on this spine`;
    else if (floor === null) state = "PENDING  no per-arm floor declared";
    else if (primary === null) state = `PENDING  ${MISSING} no primary metric declared`;
    else if (x.arms.every((a) => counts[a].units >= floor)) state = "READY   every arm at floor, no verdict computed";
    else state = "PENDING";

    lines.push(`  experiment ${safe(id)}`);
    lines.push(`    module        ${x.module ? safe(x.module) : MISSING}`);
    lines.push(`    surface       ${x.surface ? safe(x.surface) : MISSING}`);
    lines.push(`    target        ${x.target_path ? safe(x.target_path, 120) : MISSING}`);
    lines.push(`    base_sha      ${x.base_sha ? safe(x.base_sha.slice(0, 12)) : MISSING}`);
    lines.push(`    state         ${state}`);
    lines.push(`    primary       ${primary ? safe(primary) : MISSING}`);
    lines.push(`    floor         ${floor === null ? MISSING : `${floor} per arm`}`);

    if (x.arms.length === 0) {
      lines.push(`    arms          ${MISSING}  no experiment.opened, so no arm set to check against`);
    } else {
      const cells = x.arms.map((a) => {
        const c = counts[a];
        return `${safe(a, 34)} ${c.units}${floor === null ? "" : "/" + floor} (${c.observations} obs)`;
      });
      lines.push(`    arms          ${cells.join(" | ")}`);
    }
    if (x.armsRedeclared) lines.push(`    arms          ARMS REDECLARED - the union of every declaration is used, so no window stops being MISSING`);
    if (x.strayArms.size) lines.push(`    stray arms    ${[...x.strayArms].sort().map((a) => safe(a, 34)).join(", ")} - measured but never declared; those units are NOT counted`);
    if (x.conflicts.size) lines.push(`    conflicts     ${x.conflicts.size} unit(s) measured under an arm they were not assigned to - NOT counted`);

    if (windows.length === 0) {
      lines.push(`    windows       ${MISSING}  no measurements`);
    } else {
      for (const w of windows) {
        const note = w.armsUnknown ? `${MISSING}  arms unknown (no experiment.opened)`
          : w.missing ? `${MISSING}  no data for ${w.missingArms.map((a) => safe(a, 34)).join(", ")}`
          : "complete";
        lines.push(`    window        ${pad(w.metric, 20)} ${pad(w.window, 24)} ${note}`);
      }
      lines.push(`    windows       ${windows.length} total, ${windows.filter((w) => w.missing).length} ${MISSING}`);
    }

    const age = ageDays(x.last_measured_ts, now);
    lines.push(`    last metric   ${age === null ? `${MISSING}  never measured`
      : age === "ahead" ? `${MISSING}  receipt post-dates this clock`
      : `${age}d ago`}`);

    if (floor !== null && primary !== null && x.arms.length > 0) {
      const below = x.arms.filter((a) => counts[a].units < floor);
      if (below.length) lines.push(`    evidence      insufficient evidence: ${below.map((a) => `${safe(a, 34)} ${counts[a].units}<${floor}`).join(", ")}`);
    }
    for (const pr of x.proposals) lines.push(`    proposal      ${safe(pr.proposal_id)} ${safe(pr.kind)}`);
    for (const pm of x.promoted) lines.push(`    promoted      ${safe(pm.commit_ref)}`);
    for (const rb of x.rolled_back) lines.push(`    rolled back   ${safe(rb.commit_ref)}`);
    lines.push("");
  }

  const notes = [];
  if (damaged > 0) notes.push(`${damaged} receipt(s) refused on read (bad envelope or field grammar)`);
  if (superseded > 0) notes.push(`${superseded} receipt(s) superseded`);
  if (refusedSupersedes > 0) notes.push(`${refusedSupersedes} supersedes refused (wrong kind, wrong experiment, older, self, or cyclic)`);
  if (notes.length) { lines.push("INTEGRITY"); for (const n of notes) lines.push(`  ${n}`); lines.push(""); }

  return lines.join("\n").replace(/\n+$/, "\n");
}

function moduleOf(modules, name) { return modules.find((m) => m.name === name); }

function floorFor(modules, name) {
  const f = moduleOf(modules, name)?.per_arm_floor;
  return Number.isSafeInteger(f) && f > 0 ? f : null;
}

// The verdict is computed on ONE metric, so the board counts against ONE metric. Without this,
// guardrail units were summed into the primary's n and pushed a surface to its floor.
function primaryMetric(modules, name) {
  const ms = moduleOf(modules, name)?.metrics ?? [];
  const p = ms.filter((m) => m.role === "primary");
  return p.length === 1 && typeof p[0].name === "string" ? p[0].name : null;
}

export async function board(root, modules, opts = {}) {
  // The reader yields ROWS of {event, day, seq, line} — `day`+`seq` are the physical append
  // position and are deliberately dropped, so the board cannot depend on where a line sits.
  const { events: rows, torn } = await query(root, {});
  const text = renderBoard(rows.map((r) => r.event), modules, opts.now ?? nowMs());
  // `torn` is an ARRAY. `if (torn)` was true for an empty one and warned about zero bad lines
  // on every clean spine — a gate that cries wolf is a gate operators learn to skim.
  const n = Array.isArray(torn) ? torn.length : Number(torn || 0);
  if (n > 0) return `${text}\nWARNING  ${n} unparseable line(s) on the spine - this board is derived from an incomplete read\n`;
  return text;
}
