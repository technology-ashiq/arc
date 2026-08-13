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

import { existsSync, readFileSync, statSync } from "node:fs";
import { SpineError } from "./lib/canonical.mjs";
import { spineRoot } from "./spine.mjs";
import { derivePnl } from "./lib/ledger/pnl.mjs";
import { formatMinorUnits, renderComponent, ABSENT } from "./lib/ledger/money.mjs";
import { deriveKillPanel, venturesPath, UNRECEIPTED } from "./lib/ledger/kill-panel.mjs";
import { parseVentures } from "./lib/ledger/ventures.mjs";

const PROCESS_ID = "arc-pnl@1.0.0";
const VALUE_FLAGS = new Set(["venture", "month", "engine"]);
const BOOL_FLAGS = new Set(["simulated", "help", "criteria-digest"]);

function parseArgs(argv) {
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) throw new SpineError("BAD_ARGS", `unexpected argument "${a}"`);
    const eq = a.indexOf("=");
    if (eq !== -1) {
      const name = a.slice(2, eq);
      // A KNOWN flag given a value it does not take must say THAT, not "unknown flag". The old
      // message sent the reader looking for a typo in a flag that is spelled correctly.
      if (BOOL_FLAGS.has(name)) throw new SpineError("BAD_ARGS", `flag --${name} takes no value`);
      if (!VALUE_FLAGS.has(name)) throw new SpineError("BAD_ARGS", `unknown flag --${name}`);
      flags[name] = a.slice(eq + 1);
      continue;
    }
    const name = a.slice(2);
    if (BOOL_FLAGS.has(name)) { flags[name] = true; continue; }
    if (!VALUE_FLAGS.has(name)) throw new SpineError("BAD_ARGS", `unknown flag --${name}`);
    const next = argv[i + 1];
    if (next === undefined) throw new SpineError("BAD_ARGS", `flag --${name} needs a value`);
    // A VALUE THAT IS ITSELF A FLAG IS AN UNQUOTED EMPTY VARIABLE, and this repo has the scar:
    // `.claude/rules/lanes.md` records an unquoted empty value eating the next flag. Here
    // `--venture $EMPTY --simulated` consumed `--simulated` as the venture name, so a SIMULATED
    // render came out with no watermark on it at all -- real-looking kill lines in a view that
    // exists to be obviously fake. `--month` survived only because a regex happened to catch it.
    if (typeof next === "string" && next.startsWith("--"))
      throw new SpineError("BAD_ARGS", `flag --${name} was given ${JSON.stringify(next)}, which is another flag -- an unquoted empty variable swallows the flag after it, and this one changes what the output MEANS`);
    flags[name] = next;
    i++;
  }
  return flags;
}

const rupees = (minor) => formatMinorUnits(minor, "INR");

export function render(model, panel = null) {
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

  // A CROSSING IS A NEEDS-YOU ITEM HERE TOO, not only in the brief. The first version computed
  // `crossings`, `warnings` and `worst` and discarded all three: a crossed kill line exited 0,
  // raised nothing, and was detectable only by string-matching the middle of the P&L body. A
  // WARNING is deliberately NOT here -- it is on its own line in the panel, and a needs-you that
  // fires before anything has happened is how the group stops being read.
  const kill = (panel && panel.receipted ? panel.crossings : []).map((c) =>
    ({ type: "kill line CROSSED", detail: `${c.venture} ${c.criterion} ${c.value} of ${c.threshold} ${c.unit || ""}`.trimEnd() }));
  // A future-dated revenue event cannot be allowed to go quiet: it is excluded from the age clock
  // (it would otherwise erase a crossing), so the exclusion itself has to be visible.
  const future = (panel && panel.receipted ? panel.futureRevenue || [] : []).map((f) =>
    ({ type: "revenue dated in the future", detail: `${f.venture} has ${f.count} revenue event(s) after today, excluded from the days-without-revenue clock` }));
  const needsYou = [...model.needsYou, ...kill, ...future];
  if (needsYou.length) {
    out.push("");
    out.push(`${mark}needs you (${needsYou.length})`);
    for (const f of needsYou.slice().sort((a, b) =>
      a.type < b.type ? -1 : a.type > b.type ? 1 : a.detail < b.detail ? -1 : a.detail > b.detail ? 1 : 0))
      out.push(`${mark}  ${f.type}: ${f.detail}`);
  }

  out.push(...renderKill(panel, mark));

  return out.join("\n") + "\n";
}

// The kill panel (REQ-03). Rendered under the P&L, in the same watermarked stream, because a
// simulated view must not be able to show a real kill line without the mark on it.
//
// ABSENT rows are PRINTED, never dropped. A list that silently omits what it could not evaluate is
// shorter and greener than the truth, and indistinguishable from a healthy venture (ADR-1018).
export function renderKill(panel, mark = "") {
  if (!panel || !panel.present || !panel.receipted) return [];
  // PROVENANCE ON THE SUCCESS PATH, not only on the refusal. The refusal named the file and the
  // digest; a successful render named neither, so two renders on one box against two different
  // criteria files produced panels indistinguishable in origin -- which is what made a vanished
  // panel invisible rather than merely possible.
  //
  // THE DIGEST, NOT THE PATH. A path is different bytes on ubuntu, macos and windows, and REQ-01
  // compares this stdout against a golden on all three; the digest identifies the criteria exactly
  // and is identical everywhere. The path is announced on stderr under ARC_SPINE_DEBUG, which is
  // the same split the engine name already uses and for the same reason.
  const out = ["", `${mark}kill lines (as of ${panel.asOf})  criteria ${panel.digest}`];
  for (const v of panel.ventures) {
    out.push(`${mark}  ${v.venture}`);
    for (const c of v.criteria) {
      if (c.status === "ABSENT") {
        out.push(`${mark}    ${c.criterion}  ${ABSENT}  not evaluated: ${c.reason}`);
        continue;
      }
      const line = `${mark}    ${c.criterion}  ${c.value} of ${c.threshold} ${c.unit ?? ""}`.trimEnd();
      if (c.status === "CROSSED") out.push(`${line}  CROSSED`);
      else if (c.status === "WARNING") out.push(`${line}  WARNING ${c.distance} to the line`);
      else out.push(`${line}  ${c.distance} to the line`);
    }
  }
  // A count, not a silence. "2 criteria could not be evaluated" is the sentence that stops a reader
  // concluding the panel is complete.
  if (panel.absentCount > 0)
    out.push(`${mark}  ${panel.absentCount} criteri${panel.absentCount === 1 ? "on" : "a"} could not be evaluated`);
  return out;
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
    process.stdout.write("usage: arc-pnl [--venture V] [--month YYYY-MM] [--simulated] [--engine scan|sqlite] [--criteria-digest]\n");
    return 0;
  }

  // The digest a criteria receipt has to carry. Deliberately does NOT read the spine: it is the
  // command you run BEFORE the receipt exists, and a version of it that needed a green receipt to
  // print the digest that would make the receipt green could never be run for the first edit.
  if (flags["criteria-digest"] === true) {
    const path = venturesPath();
    if (path === null) throw new SpineError("NO_VENTURES", "no ventures.yaml resolvable -- set ARC_VENTURES_FILE to name one");
    // Guarded rather than left to readFileSync, which reported ENOENT and EISDIR as `ERROR INTERNAL`
    // -- a raw errno and a machine path presented to the operator as an internal fault, when the
    // actual situation is an ordinary configuration mistake with a name.
    if (!existsSync(path))
      throw new SpineError("NO_VENTURES", `no criteria file at ${path}`);
    if (!statSync(path).isFile())
      throw new SpineError("NO_VENTURES", `${path} is not a regular file`);
    process.stdout.write(`${parseVentures(readFileSync(path, "utf8")).digest}\n`);
    return 0;
  }

  if (flags.month !== undefined && !/^\d{4}-(0[1-9]|1[0-2])$/.test(flags.month))
    throw new SpineError("BAD_ARGS", `--month "${flags.month}" is not YYYY-MM`);
  // AN UNKNOWN ENGINE NAME MUST NOT FALL BACK TO `scan`. This file's own header explains why the
  // engine is announced at all: a box without sqlite would otherwise run scan twice, compare a
  // thing to itself, and report the equivalence gate green. A typo'd `--engine sqlite3` produced
  // exactly that -- two scan legs, byte-identical by construction, gate green -- because the value
  // was silently ignored. The announcement existed; nothing refused the bad value.
  if (flags.engine !== undefined && flags.engine !== "scan" && flags.engine !== "sqlite")
    throw new SpineError("BAD_ARGS", `--engine ${JSON.stringify(flags.engine)} is neither "scan" nor "sqlite" -- an unrecognised engine used to fall back to scan silently, which is how an equivalence gate compares a thing to itself and passes`);

  const root = spineRoot();
  const model = await derivePnl(root, {
    mode: flags.simulated === true ? "simulated" : "real",
    venture: flags.venture ?? null,
    month: flags.month ?? null,
    engine: flags.engine,
  });
  const panel = await deriveKillPanel(root, { engine: flags.engine });

  // THE REFUSAL, and it refuses the WHOLE render rather than the panel alone (ADR-1008). A P&L that
  // still printed while the kill lines were unreceipted would be the goalpost moved and the report
  // carrying on as if nothing had, which is the exact thing the receipt requirement exists to make
  // impossible. stdout stays EMPTY so nothing downstream can consume a partial answer.
  if (panel.present && !panel.receipted) {
    process.stderr.write(
      `arc-pnl: ${UNRECEIPTED} -- ${panel.path} has criteria digest ${panel.digest}, and no approved ` +
      `approval.requested[ledger.criteria] on the spine carries it.\n` +
      `  A kill line may not move without a receipt (ADR-1008 / ADR-1017). To honor the current file:\n` +
      `    1. emit approval.requested with subject "ledger.criteria" and digest ${panel.digest}\n` +
      `    2. approve it through arc-inbox\n`);
    return 3;
  }

  if (process.env.ARC_SPINE_DEBUG) {
    process.stderr.write(`arc-pnl: engine=${model.engine} process=${PROCESS_ID}\n`);
    // The path lives here rather than on stdout: it is machine-specific bytes, and stdout is
    // compared against a golden on three operating systems.
    if (panel.present) process.stderr.write(`arc-pnl: criteria=${panel.path} digest=${panel.digest}\n`);
  }
  process.stdout.write(render(model, panel));
  return 0;
}

main(process.argv.slice(2))
  .then((code) => process.exit(code))
  .catch((err) => {
    const code = err instanceof SpineError ? err.code : "INTERNAL";
    process.stderr.write(`arc-pnl: ERROR ${code} -- ${err.message}\n`);
    process.exit(2);
  });
