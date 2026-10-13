#!/usr/bin/env node
/**
 * spend-trace.mjs -- the reverse trace of engine spend (ADR-0230).
 *
 *   node .claude/scripts/engine/spend-trace.mjs [--root PATH] [--json]
 *
 * arc-run writes run.completed first and its cost.incurred second, so a run killed between the two leaves a receipt
 * with a spend and no money row: the Money room then under-reports, and nothing says so. This names that gap as a
 * count. `unbookedRuns` lists every run.completed whose `spend` is a figure and that no cost.incurred names by
 * `run_ref` in that currency. Exit 0 when every spent run is booked, 1 when one is not, 2 when the spine is unreadable.
 * Read-only; reads the spine only through `query` (spine-reader-lint).
 */
import { resolve } from "node:path";
import { realpathSync } from "node:fs";
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
  const at = argv.indexOf("--root");
  const root = resolve(at >= 0 && argv[at + 1] ? argv[at + 1] : process.cwd());
  const { query } = await import("../hq/spine.mjs");
  const res = await query(root, {});
  if (res.unreadable.length) {
    console.error(`spend-trace: ${res.unreadable.length} spine day file(s) unreadable — the trace would be partial, refusing`);
    return 2;
  }
  const missing = unbookedRuns(res.events.map((r) => r.event));
  if (argv.includes("--json")) console.log(JSON.stringify({ unbooked: missing }));
  else if (!missing.length) console.log("spend-trace: every spent run has its cost.incurred");
  else for (const m of missing) console.log(`spend-trace: UNBOOKED run.completed ${m.id} spent ${m.amount} ${m.currency} minor units with no cost.incurred`);
  return missing.length ? 1 : 0;
}

// Both sides realpath-ed: a symlinked checkout otherwise makes this a silent no-op.
const self = (() => { try { return realpathSync(fileURLToPath(import.meta.url)); } catch { return ""; } })();
const invoked = (() => { try { return process.argv[1] ? realpathSync(process.argv[1]) : ""; } catch { return ""; } })();
if (self && self === invoked) {
  main(process.argv.slice(2)).then((code) => { process.exitCode = code; }, (e) => { console.error(`spend-trace: ${e.message}`); process.exitCode = 2; });
}
