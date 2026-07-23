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

function parseArgs(argv) {
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) throw new SpineError("BAD_ARGS", `unexpected argument "${a}"`);
    const eq = a.indexOf("=");
    if (eq !== -1) { flags[a.slice(2, eq)] = a.slice(eq + 1); continue; }
    const name = a.slice(2);
    if (!VALUE_FLAGS.has(name)) throw new SpineError("BAD_ARGS", `unknown flag --${name}`);
    const next = argv[i + 1];
    if (next === undefined) throw new SpineError("BAD_ARGS", `flag --${name} needs a value`);
    flags[name] = next;
    i++;
  }
  return flags;
}

export function render(day, events, torn) {
  const out = [`brief ${day}`];
  out.push(`events: ${events.length}`);

  const counts = new Map();
  for (const e of events) counts.set(e.event.kind, (counts.get(e.event.kind) || 0) + 1);
  for (const kind of [...counts.keys()].sort()) out.push(`  ${kind}: ${counts.get(kind)}`);

  for (const e of events) out.push(`${e.event.id}  ${e.event.kind}  ${e.event.outcome}`);

  // A damaged line is reported in the brief itself, not only on stderr: "the day looks
  // quiet" and "the day is unreadable" must never render the same.
  if (torn.length) out.push(`UNREADABLE LINES: ${torn.length}`);
  return out.join("\n") + "\n";
}

async function main(argv) {
  const flags = parseArgs(argv);
  const day = flags.date ?? dayOf(formatIst(nowMs()));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new SpineError("BAD_ARGS", `--date "${day}" is not YYYY-MM-DD`);

  const root = spineRoot();
  const { events, torn } = await query(root, { date: day, venture: flags.venture, engine: flags.engine });
  process.stdout.write(render(day, events, torn));
  return 0;
}

main(process.argv.slice(2))
  .then((code) => process.exit(code))
  .catch((err) => {
    const code = err instanceof SpineError ? err.code : "INTERNAL";
    process.stderr.write(`arc-brief: ERROR ${code} -- ${err.message}\n`);
    process.exit(2);
  });
