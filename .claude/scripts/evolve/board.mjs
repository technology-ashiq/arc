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
//  3. REPLAY-IDENTICAL. The fold sorts on a TOTAL ORDER key (ts, then id) rather than on the
//     order lines happen to sit in a day file. Two emitters in the same millisecond produce two
//     receipts whose file order is an accident of scheduling; a board that depended on it would
//     differ between a live spine and a replayed one, which is the one thing REQ-02 forbids.

import { query } from "../hq/spine.mjs";
import { nowMs } from "../hq/lib/canonical.mjs";

export const MISSING = "MISSING";

// ---------- fold ----------

// Total order over events. `ts` is the primary key and `id` breaks ties: a ULID embeds its
// millisecond, so equal-ts events still order deterministically, and two emitters that collide
// on the same millisecond get a stable order that survives a replay into a different file order.
function totalOrder(a, b) {
  if (a.ts !== b.ts) return a.ts < b.ts ? -1 : 1;
  if (a.id !== b.id) return a.id < b.id ? -1 : 1;
  return 0;
}

/**
 * Drop every event that a later event supersedes. Corrections ride `supersedes` (ADR-0304), so
 * the superseded original must not also be counted — that would double a measurement rather
 * than correct it.
 */
export function applySupersedes(events) {
  const superseded = new Set();
  for (const e of events) if (e.supersedes) superseded.add(e.supersedes);
  return events.filter((e) => !superseded.has(e.id));
}

const windowKey = (p) => `${p.window_start}..${p.window_end}`;

/**
 * Fold experiment receipts into per-experiment state. Pure: same events in, same state out,
 * regardless of the order they arrived in.
 */
export function foldExperiments(rawEvents) {
  const events = applySupersedes([...rawEvents].sort(totalOrder));
  const byId = new Map();

  const ensure = (id) => {
    if (!byId.has(id)) {
      byId.set(id, {
        experiment_id: id, module: null, surface: null, target_path: null, base_sha: null,
        split: null, ttl_days: null, arms: [], opened_ts: null,
        assigned: new Map(),   // arm -> Set(unit_id)
        windows: new Map(),    // windowKey -> Map(arm -> {units:Set, metric:string})
        last_measured_ts: null,
        verdict: null, closed: null, proposals: [], promoted: [], rolled_back: [],
      });
    }
    return byId.get(id);
  };

  for (const e of events) {
    const p = e.payload || {};
    switch (e.kind) {
      case "experiment.opened": {
        const x = ensure(p.experiment_id);
        Object.assign(x, {
          module: p.module, surface: p.surface, target_path: p.target_path,
          base_sha: p.base_sha, split: p.split, ttl_days: p.ttl_days,
          arms: [...p.arms], opened_ts: e.ts,
        });
        for (const a of p.arms) if (!x.assigned.has(a)) x.assigned.set(a, new Set());
        break;
      }
      case "experiment.assigned": {
        const x = ensure(p.experiment_id);
        if (!x.assigned.has(p.arm)) x.assigned.set(p.arm, new Set());
        x.assigned.get(p.arm).add(p.unit_id);
        break;
      }
      case "experiment.measured": {
        const x = ensure(p.experiment_id);
        const k = windowKey(p);
        if (!x.windows.has(k)) x.windows.set(k, new Map());
        const w = x.windows.get(k);
        if (!w.has(p.arm)) w.set(p.arm, { units: new Set(), metric: p.metric });
        w.get(p.arm).units.add(p.unit_id);
        x.last_measured_ts = e.ts;
        break;
      }
      case "experiment.verdict": { ensure(p.experiment_id).verdict = { ...p, ts: e.ts }; break; }
      case "experiment.closed": { ensure(p.experiment_id).closed = { ...p, ts: e.ts }; break; }
      case "promotion.proposed": { ensure(p.experiment_id).proposals.push({ ...p, ts: e.ts }); break; }
      default: break;
    }
  }
  return byId;
}

/**
 * Classify every window of an experiment. A window is MISSING when ANY declared arm has no
 * measurement in it — and a MISSING window contributes to NO arm's count. Counting the arm that
 * did report, while its opposite reported nothing, is exactly the asymmetry that manufactures a
 * winner out of a collection gap.
 */
export function classifyWindows(x) {
  const out = [];
  for (const k of [...x.windows.keys()].sort()) {
    const w = x.windows.get(k);
    const missingArms = x.arms.filter((a) => !w.has(a) || w.get(a).units.size === 0);
    out.push({ window: k, missing: missingArms.length > 0, missingArms, byArm: w });
  }
  return out;
}

/** Units per arm, counting COMPLETE windows only. */
export function countPerArm(x, windows) {
  const n = {};
  for (const a of x.arms) n[a] = 0;
  for (const w of windows) {
    if (w.missing) continue;
    for (const a of x.arms) {
      const cell = w.byArm.get(a);
      if (cell) n[a] += cell.units.size;
    }
  }
  return n;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days between an event ts and now. Null when there is nothing to age. */
export function ageDays(ts, now) {
  if (!ts) return null;
  const t = Date.parse(ts);
  if (!Number.isFinite(t)) return null;
  return Math.floor((now - t) / DAY_MS);
}

// ---------- render ----------

const pad = (s, n) => String(s).padEnd(n);

/**
 * Render the board. Deterministic by construction: fixed section order, experiments sorted by
 * id, arms in their declared order, windows sorted by key.
 *
 * @param {object[]} events      every event from the reader
 * @param {object[]} modules     [{name, metrics:[{name, role, ...}], per_arm_floor}]
 * @param {number}   now         epoch ms (injected so the render is testable and replayable)
 */
export function renderBoard(events, modules, now) {
  const lines = [];
  const experiments = foldExperiments(events);

  lines.push("arc evolve board");
  lines.push("");

  // ---- baseline panels ----
  // These read `metric.observed`, which is the CLIENT's kind (ADR-0308) and deliberately absent
  // from this repo's closed vocabulary. So every baseline row is MISSING, and that is the
  // honest answer rather than a defect: the feed does not exist, so it is not rendered as zero,
  // not faked, and not quietly omitted. A row that vanished would read as "nothing to report".
  lines.push("BASELINE");
  if (modules.length === 0) {
    lines.push("  (no module declares an evolve section)");
  } else {
    for (const m of [...modules].sort((a, b) => (a.name < b.name ? -1 : 1))) {
      lines.push(`  module ${m.name}`);
      const metrics = [...(m.metrics || [])].sort((a, b) => (a.name < b.name ? -1 : 1));
      if (metrics.length === 0) lines.push("    (no metrics declared)");
      for (const met of metrics) {
        const observed = events.filter((e) => e.kind === "metric.observed" && e.payload?.metric === met.name);
        const state = observed.length === 0
          ? `${MISSING}  no metric.observed receipts (the client's kind, ADR-0308 - not implemented in this lane)`
          : `${observed.length} observation(s)`;
        lines.push(`    ${pad(met.name, 24)} ${pad(met.role, 10)} ${state}`);
      }
    }
  }
  lines.push("");

  // ---- experiment panels ----
  lines.push("EXPERIMENTS");
  const ids = [...experiments.keys()].sort();
  if (ids.length === 0) {
    lines.push("  (no experiments opened)");
  }
  for (const id of ids) {
    const x = experiments.get(id);
    const windows = classifyWindows(x);
    const n = countPerArm(x, windows);
    const floor = floorFor(modules, x.module);

    let state;
    if (x.closed) state = `CLOSED  ${x.closed.outcome}`;
    else if (x.verdict) state = `VERDICT ${x.verdict.outcome}`;
    else if (floor === null) state = "PENDING  no per-arm floor declared";
    else if (x.arms.every((a) => n[a] >= floor)) state = "READY   both arms at floor, no verdict computed";
    else state = "PENDING";

    lines.push(`  experiment ${id}`);
    lines.push(`    module        ${x.module ?? MISSING}`);
    lines.push(`    surface       ${x.surface ?? MISSING}`);
    lines.push(`    target        ${x.target_path ?? MISSING}`);
    lines.push(`    base_sha      ${x.base_sha ? x.base_sha.slice(0, 12) : MISSING}`);
    lines.push(`    state         ${state}`);
    lines.push(`    floor         ${floor === null ? MISSING : `${floor} per arm`}`);

    // Progress reads "counted/floor", and `counted` deliberately excludes MISSING windows, so a
    // surface cannot inch toward its floor on half-collected data.
    const armCells = x.arms.map((a) => `${a} ${n[a]}${floor === null ? "" : "/" + floor}`);
    lines.push(`    arms          ${armCells.length ? armCells.join(" | ") : MISSING}`);

    if (windows.length === 0) {
      lines.push(`    windows       ${MISSING}  no measurements`);
    } else {
      for (const w of windows) {
        const note = w.missing ? `${MISSING}  no data for ${w.missingArms.join(", ")}` : "complete";
        lines.push(`    window        ${pad(w.window, 24)} ${note}`);
      }
      const missingCount = windows.filter((w) => w.missing).length;
      lines.push(`    windows       ${windows.length} total, ${missingCount} ${MISSING}`);
    }

    // Staleness is printed with its AGE, not as a boolean. "stale" alone tells an operator to
    // go looking; "last metric 12d ago" tells them whether to worry.
    const age = ageDays(x.last_measured_ts, now);
    lines.push(`    last metric   ${age === null ? `${MISSING}  never measured` : `${age}d ago`}`);

    if (floor !== null && windows.length > 0) {
      const below = x.arms.filter((a) => n[a] < floor);
      if (below.length) lines.push(`    evidence      insufficient evidence: ${below.map((a) => `${a} ${n[a]}<${floor}`).join(", ")}`);
    }
    lines.push("");
  }

  return lines.join("\n").replace(/\n+$/, "\n");
}

function floorFor(modules, moduleName) {
  const m = modules.find((x) => x.name === moduleName);
  const f = m?.per_arm_floor;
  return Number.isSafeInteger(f) && f > 0 ? f : null;
}

/**
 * Read every event through the reader, then render.
 *
 * `torn` is surfaced, not swallowed: the reader reports lines it could not parse (a partial
 * write, a truncated append). A board that silently skipped them would render a confident
 * number over a spine it had only partly read, which is the same class of lie as counting an
 * absent window as zero.
 */
export async function board(root, modules, opts = {}) {
  // The reader yields ROWS of {event, day, seq, line} — `day`+`seq` are the physical append
  // position. They are deliberately dropped here: the fold sorts on (ts, id) instead, so the
  // board cannot depend on where a line happens to sit in a day file.
  const { events: rows, torn } = await query(root, {});
  const text = renderBoard(rows.map((r) => r.event), modules, opts.now ?? nowMs());
  // `torn` is an ARRAY. `if (torn)` was true for an empty one and printed a warning about zero
  // bad lines on every clean spine — a gate that cries wolf is a gate operators learn to skim.
  const n = Array.isArray(torn) ? torn.length : Number(torn || 0);
  if (n > 0) return `${text}\nWARNING  ${n} unreadable line(s) on the spine - this board is derived from an incomplete read\n`;
  return text;
}
