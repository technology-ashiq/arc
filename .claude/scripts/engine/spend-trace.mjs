#!/usr/bin/env node
/**
 * spend-trace.mjs -- the reverse trace of engine spend (ADR-0230).
 *
 *   node .claude/scripts/engine/spend-trace.mjs [--spine PATH] [--json]
 *
 * arc-run writes run.completed first and its cost.incurred second, so a run killed between the two leaves a receipt
 * with a spend and no money row: the Money room then under-reports, and nothing says so. This names that gap as a
 * count. `unbookedRuns` lists every run.completed whose `spend` is a figure and that no cost.incurred names by
 * `run_ref` in that currency. Exit 0 when every spent run is booked, 1 when one is not, 2 on a usage error or an
 * unreadable spine, 3 when the spine holds no run.completed at all (a trace that looked at nothing is not a pass).
 * Read-only; reads the spine only through `query` (spine-reader-lint).
 */
import { resolve } from "node:path";
import { existsSync, realpathSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { isSpend } from "./drivers/common.mjs";

/**
 * @param {{ id?: string, kind?: string, payload?: Record<string, unknown> }[]} events  bare events, any order
 * @returns {{ id: string, currency: string, amount: number }[]}
 */
export function unbookedRuns(events) {
  const booked = new Set();
  for (const e of events) {
    if (e && e.kind === "cost.incurred" && e.payload && typeof e.payload.run_ref === "string") {
      booked.add(`${e.payload.run_ref}|${e.payload.currency}`);
    }
  }
  const out = [];
  for (const e of events) {
    if (!e || e.kind !== "run.completed" || !e.payload || typeof e.id !== "string") continue;
    const p = e.payload;
    // A multi-currency run carries its figures in `spend_by_currency`; each one is owed its own row.
    const spends = [p.spend, ...(Array.isArray(p.spend_by_currency) ? p.spend_by_currency : [])].filter(isSpend);
    for (const s of spends) {
      if (!booked.has(`${e.id}|${s.currency}`)) out.push({ id: e.id, currency: s.currency, amount: s.amount });
    }
  }
  return out;
}

async function main(argv) {
  for (const a of argv) {
    if (!["--spine", "--json"].includes(a) && a.startsWith("--")) { console.error(`spend-trace: unknown flag ${a}`); return 2; }
  }
  const at = argv.indexOf("--spine");
  const named = at >= 0 ? argv[at + 1] : undefined;
  // A flag where the path belongs is a usage error, never a path: `--spine --json` read a spine named "--json", found
  // nothing, and said every run was booked (attack e2dc399 B3).
  if (at >= 0 && (named === undefined || named.startsWith("--"))) { console.error("spend-trace: --spine needs a path"); return 2; }
  // One spine per trace: a second --spine would be silently ignored, typo and all (attack 3e5fc9e B5).
  if (argv.filter((a) => a === "--spine").length > 1) { console.error("spend-trace: --spine given twice"); return 2; }
  if (named !== undefined && !(existsSync(named) && statSync(named).isDirectory())) { console.error(`spend-trace: no spine directory at ${named}`); return 2; }
  const { query, spineRoot } = await import("../hq/spine.mjs");
  // The SPINE root, resolved the way the emitter resolves it (ARC_SPINE_ROOT, else the repo's own, refusing a linked
  // worktree whose state dir is an empty copy) -- never the cwd, which made a worktree trace read nothing (B2).
  const root = named !== undefined ? resolve(named) : spineRoot();
  const res = await query(root, {});
  if (res.unreadable.length) {
    console.error(`spend-trace: ${res.unreadable.length} spine day file(s) unreadable — the trace would be partial, refusing`);
    return 2;
  }
  const events = res.events.map((r) => r.event);
  const scanned = events.filter((e) => e && e.kind === "run.completed").length;
  // Nothing scanned is not "everything booked": it is a trace that never looked (B2).
  if (!scanned) { console.error(`spend-trace: no run.completed on the spine at ${root} — nothing was traced`); return 3; }
  const missing = unbookedRuns(events);
  if (argv.includes("--json")) console.log(JSON.stringify({ spine: root, scanned, unbooked: missing }));
  else if (!missing.length) console.log(`spend-trace: ${scanned} run.completed scanned at ${root}; every spent run has its cost.incurred`);
  else for (const m of missing) console.log(`spend-trace: UNBOOKED run.completed ${m.id} spent ${m.amount} ${m.currency} minor units with no cost.incurred`);
  return missing.length ? 1 : 0;
}

// Both sides realpath-ed: a symlinked checkout otherwise makes this a silent no-op.
const self = (() => { try { return realpathSync(fileURLToPath(import.meta.url)); } catch { return ""; } })();
const invoked = (() => { try { return process.argv[1] ? realpathSync(process.argv[1]) : ""; } catch { return ""; } })();
if (self && self === invoked) {
  main(process.argv.slice(2)).then((code) => { process.exitCode = code; }, (e) => { console.error(`spend-trace: ${e.message}`); process.exitCode = 2; });
}
