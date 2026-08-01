#!/usr/bin/env node
// arc-brief -- the day in one screen.
//
// ckpt B ships the MINIMAL renderer only, because REQ-04's acceptance invokes
// `arc brief --date D` to prove replay determinism and Phase 2 does not exist yet. The
// one-screen noise budget, the needs-you/money/progress/background grouping and the
// overflow-to-counts behaviour (REQ-05) are Phase 2's work, not a missing piece here.
//
// SPINE-G (ADR-0030): every byte below comes from the spine reader. This file contains no
// path to events/*.jsonl and no path to state.db, which is what REQ-09's grep-lint checks.
//
// Output is deterministic by construction: fixed field order, counts sorted by kind name,
// events in append order. That is what makes it byte-comparable across a rebuild and across
// engines.
//
// Usage: arc-brief [--date YYYY-MM-DD] [--venture V] [--engine scan|sqlite]

import { SpineError, dayOf, formatIst, nowMs } from "./lib/canonical.mjs";
import { spineRoot } from "./lib/spine-io.mjs";
import { query } from "./spine.mjs";

const VALUE_FLAGS = new Set(["date", "venture", "engine"]);
const BOOL_FLAGS = new Set(["full"]);

// REQ-05: every kind maps to exactly one group; the order here is the render order. needs-you
// and money are never collapsed; background then progress collapse to counts when a day
// overflows the line budget.
const GROUPS = [
  ["needs-you", ["approval.requested", "incident.raised"]],
  ["money",     ["revenue.received", "revenue.simulated", "cost.incurred"]],
  ["progress",  ["kickoff.done", "phase.closed", "review.completed", "qa.completed", "commit.done",
                 "ship.done", "run.completed", "decision.recorded", "council.verdict"]],
  ["background",["note.logged", "redaction.applied", "day.closed", "idea.captured"]],
];
const GROUP_OF = new Map();
for (const [g, kinds] of GROUPS) for (const k of kinds) GROUP_OF.set(k, g);

// Money is stored in MINOR units (paise); a receipt shows major.minor. Non-money lines are
// just the kind -- the group + its count is the signal; per-event detail lives in the feed.
function moneyLine(ev) {
  const p = ev.payload || {};
  if (Number.isInteger(p.amount) && typeof p.currency === "string")
    return `  ${ev.kind}  ${p.currency} ${Math.floor(p.amount / 100)}.${String(p.amount % 100).padStart(2, "0")}  ${ev.venture}`;
  return `  ${ev.kind}`;
}

function parseArgs(argv) {
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) throw new SpineError("BAD_ARGS", `unexpected argument "${a}"`);
    const eq = a.indexOf("=");
    if (eq !== -1) { flags[a.slice(2, eq)] = a.slice(eq + 1); continue; }
    const name = a.slice(2);
    if (BOOL_FLAGS.has(name)) { flags[name] = true; continue; }
    if (!VALUE_FLAGS.has(name)) throw new SpineError("BAD_ARGS", `unknown flag --${name}`);
    const next = argv[i + 1];
    if (next === undefined) throw new SpineError("BAD_ARGS", `flag --${name} needs a value`);
    flags[name] = next;
    i++;
  }
  return flags;
}

export function render(day, events, torn, { full = false } = {}) {
  // Test-only door; production budget is 40 lines (one screen).
  const budget = Number(process.env.ARC_BRIEF_MAX_LINES || 40);

  const buckets = new Map(GROUPS.map(([g]) => [g, []]));
  for (const e of events) {
    const g = GROUP_OF.get(e.event.kind);
    if (g) buckets.get(g).push(e.event); // every closed-vocabulary kind maps to a group
  }
  const collapsed = new Set();

  const groupLines = (g) => {
    const evs = buckets.get(g);
    if (!evs.length) return [];
    if (collapsed.has(g)) {
      const c = new Map();
      for (const ev of evs) c.set(ev.kind, (c.get(ev.kind) || 0) + 1);
      const parts = [...c.keys()].sort().map((k) => `${k} ${c.get(k)}`).join(" · ");
      return [`${g}: ${evs.length} (${parts})`];
    }
    return [`${g} (${evs.length})`, ...evs.map((ev) => (g === "money" ? moneyLine(ev) : `  ${ev.kind}`))];
  };

  const assemble = () => {
    const out = [`brief ${day}`];
    for (const [g] of GROUPS) {
      const gl = groupLines(g);
      if (gl.length) out.push("", ...gl);
    }
    // A damaged line is reported in the brief itself: "the day looks quiet" and "the day is
    // unreadable" must never render the same.
    if (torn.length) out.push("", `UNREADABLE LINES: ${torn.length}`);
    return out;
  };

  let out = assemble();
  if (!full) {
    // background is the noise floor -- ALWAYS a count, never a wall of note.logged lines.
    // progress then collapses too only when the day STILL overflows one screen. needs-you and
    // money always stay expanded.
    if (buckets.get("background").length) { collapsed.add("background"); out = assemble(); }
    if (out.length > budget && buckets.get("progress").length) { collapsed.add("progress"); out = assemble(); }
    if (collapsed.size)
      for (let i = 0; i < out.length; i++)
        if (/^(background|progress): \d+ \(/.test(out[i])) { out[i] += "   — --full to expand"; break; }
  }
  return out.join("\n") + "\n";
}

async function main(argv) {
  const flags = parseArgs(argv);
  const day = flags.date ?? dayOf(formatIst(nowMs()));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new SpineError("BAD_ARGS", `--date "${day}" is not YYYY-MM-DD`);

  const root = spineRoot();
  const { events, torn } = await query(root, { date: day, venture: flags.venture, engine: flags.engine });
  process.stdout.write(render(day, events, torn, { full: flags.full === true }));
  return 0;
}

main(process.argv.slice(2))
  .then((code) => process.exit(code))
  .catch((err) => {
    const code = err instanceof SpineError ? err.code : "INTERNAL";
    process.stderr.write(`arc-brief: ERROR ${code} -- ${err.message}\n`);
    process.exit(2);
  });
