#!/usr/bin/env node
// arc-pnl — per-venture P&L, derived from spine receipts at render time and stored nowhere
// (ADR-1000 / LED-A, ADR-1014 / LED-O). Reads through the spine reader only; the grep-lint at
// .claude/scripts/review/spine-reader-lint.sh enforces that and this file is subject to it.
//
// WHY THE ENGINE NAME GOES TO STDERR AND NEVER STDOUT: ADR-1014 requires the determinism proof to
// assert which reader engine each leg actually ran, because a box without sqlite would otherwise
// run `scan` twice, compare a thing to itself, and report the equivalence gate green -- the same
// output a working gate produces. But if the engine name were part of the rendered P&L, the two
// legs would differ by construction and the byte-identity they exist to prove would be impossible.
// So stdout is the P&L and nothing else, and the engine is announced on stderr under
// ARC_SPINE_DEBUG, exactly as spine.mjs already does it. The test reads both streams.

import { SpineError } from "./lib/canonical.mjs";
import { spineRoot } from "./spine.mjs";
import { derivePnl } from "./lib/ledger/pnl.mjs";
import { formatMinorUnits, renderComponent, ABSENT } from "./lib/ledger/money.mjs";

const PROCESS_ID = "arc-pnl@1.0.0";
const VALUE_FLAGS = new Set(["venture", "month", "engine"]);
const BOOL_FLAGS = new Set(["simulated", "help"]);

function parseArgs(argv) {
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) throw new SpineError("BAD_ARGS", `unexpected argument "${a}"`);
    const eq = a.indexOf("=");
    if (eq !== -1) {
      const name = a.slice(2, eq);
      if (!VALUE_FLAGS.has(name)) throw new SpineError("BAD_ARGS", `unknown flag --${name}`);
      flags[name] = a.slice(eq + 1);
      continue;
    }
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

const rupees = (minor) => formatMinorUnits(minor, "INR");

export function render(model) {
  const out = [];
  const scope = model.month ? `${model.month}` : "all time";
  const title = model.mode === "simulated" ? `P&L — ${scope} — SIMULATED` : `P&L — ${scope}`;
  out.push(title);
  // Real and simulated never co-render, and the watermark is on EVERY line rather than the header
  // alone: a header scrolls off, and a screenshot of the middle of a simulated P&L must not be
  // mistakable for the real thing.
  const mark = model.mode === "simulated" ? "SIMULATED " : "";

  if (model.ventures.length === 0) {
    out.push(`${mark}no ${model.mode === "simulated" ? "simulated" : "real"} revenue yet`);
  }

  for (const v of model.ventures) {
    out.push("");
    out.push(`${mark}${v.venture}`);
    out.push(`${mark}  gross ${renderComponent(v.gross, "INR")}   fees ${renderComponent(v.fees, "INR")}   tax ${renderComponent(v.tax, "INR")}   net ${renderComponent(v.net, "INR")}`);
    out.push(`${mark}  cash-in ${rupees(v.cashIn)}   MRR ${v.mrr ? rupees(v.mrr) : ABSENT}`);
    for (const r of sortRows(v.rows)) {
      const foreign = r.currency === "INR" ? "" : `  (${formatMinorUnits(Math.abs(r.amount), r.currency)} ${r.currency} @ ${r.fx ? r.fx.rate : "?"})`;
      const label = r.refundOf ? `refund of ${r.refundOf}` : r.paymentId;
      out.push(`${mark}    ${r.ts}  ${rupees(r.amountInr)}  ${label}${foreign}`);
    }
    // Per-venture costs were computed and never printed, so a cost event could conjure a venture
    // section with no revenue, no costs and no explanation of why it was on screen.
    for (const l of v.costs.slice().sort(byTsId)) out.push(`${mark}    ${costLine(l)}`);
  }

  if (model.overhead.lines.length) {
    out.push("");
    out.push(`${mark}Overhead (venture: arc — never attributed to a product)`);
    for (const l of model.overhead.lines.slice().sort(byTsId)) out.push(`${mark}  ${costLine(l)}`);
  }

  // TOTAL, and the event id is what makes it so. (month, venture, type) ties for four `new`
  // transitions in one venture in one month -- and the comment that used to sit here asserted the
  // order was total while the comparator had no fourth key.
  const t = model.mrr.transitions.slice().sort((a, b) =>
    a.month < b.month ? -1 : a.month > b.month ? 1
      : a.venture < b.venture ? -1 : a.venture > b.venture ? 1
        : a.type < b.type ? -1 : a.type > b.type ? 1
          : a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  if (t.length) {
    out.push("");
    out.push(`${mark}MRR transitions`);
    for (const x of t) out.push(`${mark}  ${x.month}  ${x.venture}  ${x.type}  ${rupees(x.from || 0)} -> ${rupees(x.to)}`);
  }

  if (model.needsYou.length) {
    out.push("");
    out.push(`${mark}needs you (${model.needsYou.length})`);
    for (const f of model.needsYou.slice().sort((a, b) =>
      a.type < b.type ? -1 : a.type > b.type ? 1 : a.detail < b.detail ? -1 : a.detail > b.detail ? 1 : 0))
      out.push(`${mark}  ${f.type}: ${f.detail}`);
  }

  return out.join("\n") + "\n";
}

// A TOTAL order. ULIDs are unique, so (ts, id) never ties -- and a comparator that can tie is a
// comparator whose output depends on the reader's arrival order, which is exactly the difference
// between the scan and sqlite engines.
const byTsId = (a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const sortRows = (rows) => rows.slice().sort(byTsId);

// A cost line never throws. `formatMinorUnits` refuses a currency with no pinned minor-unit
// exponent, and one such cost event used to abort the entire command -- on an append-only spine,
// where the operator cannot delete the offending event, that left the P&L unreadable until someone
// shipped a code change. Unrenderable values arrive here already nulled and flagged by the
// derivation, and render ABSENT.
function costLine(l) {
  const amount = l.amount === null || l.currency === null ? ABSENT : formatMinorUnits(l.amount, l.currency);
  return `${l.ts}  ${amount}  ${l.source || "source unrecorded"}`;
}

async function main(argv) {
  const flags = parseArgs(argv);
  if (flags.help) {
    process.stdout.write("usage: arc-pnl [--venture V] [--month YYYY-MM] [--simulated] [--engine scan|sqlite]\n");
    return 0;
  }
  if (flags.month !== undefined && !/^\d{4}-(0[1-9]|1[0-2])$/.test(flags.month))
    throw new SpineError("BAD_ARGS", `--month "${flags.month}" is not YYYY-MM`);

  const model = await derivePnl(spineRoot(), {
    mode: flags.simulated === true ? "simulated" : "real",
    venture: flags.venture ?? null,
    month: flags.month ?? null,
    engine: flags.engine,
  });
  if (process.env.ARC_SPINE_DEBUG) process.stderr.write(`arc-pnl: engine=${model.engine} process=${PROCESS_ID}\n`);
  process.stdout.write(render(model));
  return 0;
}

main(process.argv.slice(2))
  .then((code) => process.exit(code))
  .catch((err) => {
    const code = err instanceof SpineError ? err.code : "INTERNAL";
    process.stderr.write(`arc-pnl: ERROR ${code} -- ${err.message}\n`);
    process.exit(2);
  });
