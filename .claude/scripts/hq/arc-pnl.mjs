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
import { SpineError, sha256Hex } from "./lib/canonical.mjs";
import { spineRoot } from "./spine.mjs";
import { derivePnl } from "./lib/ledger/pnl.mjs";
import { formatMinorUnits, renderComponent, ABSENT } from "./lib/ledger/money.mjs";
import { deriveKillPanel, venturesPath, UNRECEIPTED } from "./lib/ledger/kill-panel.mjs";
import { parseVentures } from "./lib/ledger/ventures.mjs";
import { deriveCosts, renderSectionTotal, COST_CLASSES, UNCLASSIFIED } from "./lib/ledger/costs.mjs";
import { deriveRails, reconcile, closePayload, inputSha, canonicalTotalText } from "./lib/ledger/reconcile.mjs";
import { parseRazorpayExport } from "./lib/ledger/parsers/razorpay.mjs";
import { parseMorExport } from "./lib/ledger/parsers/mor.mjs";

// Provider -> its export parser. A rail whose provider is not here can still be reconciled with
// `--reconcile-total`; what it must NOT do is fall through to some default parser and produce a
// number from a format nobody claimed to understand.
const EXPORT_PARSERS = Object.freeze({ razorpay: parseRazorpayExport, mor: parseMorExport });

const PROCESS_ID = "arc-pnl@1.0.0";
const VALUE_FLAGS = new Set(["venture", "month", "engine", "close", "reconcile-file", "reconcile-total"]);
const BOOL_FLAGS = new Set(["simulated", "help", "criteria-digest"]);
// `--reconcile-file` and `--reconcile-total` are REPEATABLE: a month has one rail per provider
// account, and a close reconciles all of them at once. Everything else is last-wins as before.
const REPEATABLE_FLAGS = new Set(["reconcile-file", "reconcile-total"]);

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
      // The `=` spelling accumulates too. Two spellings of one flag that disagree about whether it
      // repeats is how `--reconcile-file=a --reconcile-file=b` silently reconciles only b.
      if (REPEATABLE_FLAGS.has(name)) (flags[name] = flags[name] || []).push(a.slice(eq + 1));
      else flags[name] = a.slice(eq + 1);
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
    if (REPEATABLE_FLAGS.has(name)) (flags[name] = flags[name] || []).push(next);
    else flags[name] = next;
    i++;
  }
  return flags;
}

const rupees = (minor) => formatMinorUnits(minor, "INR");

export function render(model, panel = null, costs = null) {
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

  // THE UNION of ventures with revenue and ventures with only costs, in code-unit order. Iterating
  // the P&L's own list alone drops a venture whose only cost is in an unpinned currency: pnl.mjs
  // skips that bucket before it exists, so the very section that says the cost could not be
  // rendered would itself vanish -- absent hiding its own absence.
  const costOf = new Map((costs ? costs.ventures : []).map((c) => [c.venture, c]));
  const names = [...new Set([...model.ventures.map((v) => v.venture), ...costOf.keys()])]
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const revenueOf = new Map(model.ventures.map((v) => [v.venture, v]));

  for (const name of names) {
    const v = revenueOf.get(name);
    if (!v) {
      // Costs and no revenue is a real month for a venture that has not sold anything yet. It gets
      // its name and its cost sections, and no fabricated zero revenue row.
      out.push("");
      out.push(`${mark}${name}`);
      out.push(...costSections(costOf.get(name), "    ", mark));
      continue;
    }
    out.push("");
    out.push(`${mark}${v.venture}`);
    out.push(`${mark}  gross ${renderComponent(v.gross, "INR")}   fees ${renderComponent(v.fees, "INR")}   tax ${renderComponent(v.tax, "INR")}   net ${renderComponent(v.net, "INR")}`);
    out.push(`${mark}  cash-in ${rupees(v.cashIn)}   MRR ${v.mrr ? rupees(v.mrr) : ABSENT}`);
    for (const r of sortRows(v.rows)) {
      const foreign = r.currency === "INR" ? "" : `  (${formatMinorUnits(Math.abs(r.amount), r.currency)} ${r.currency} @ ${r.fx ? r.fx.rate : "?"})`;
      const label = r.refundOf ? `refund of ${r.refundOf}` : r.paymentId;
      out.push(`${mark}    ${r.ts}  ${rupees(r.amountInr)}  ${label}${foreign}`);
    }
    // The cost side comes from costs.mjs when it is available, which is where the trichotomy lives.
    // pnl.mjs's own flat cost list is the fallback for a caller that did not derive costs -- it
    // renders the same lines without the class labels rather than nothing at all.
    if (costs) out.push(...costSections(costOf.get(name), "    ", mark));
    else for (const l of v.costs.slice().sort(byTsId)) out.push(`${mark}    ${costLine(l)}`);
  }

  const overheadLines = costs
    ? costSections(costs.overhead, "  ", mark)
    : model.overhead.lines.slice().sort(byTsId).map((l) => `${mark}  ${costLine(l)}`);
  if (overheadLines.length) {
    out.push("");
    out.push(`${mark}Overhead (venture: arc — never attributed to a product)`);
    out.push(...overheadLines);
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
  const needsYou = [...model.needsYou, ...(costs ? costs.needsYou : []), ...kill, ...future];
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
// The cost trichotomy (REQ-06, ADR-1006). Three sources, each its own labelled block with its own
// subtotal, and there is NO code path that adds two of them together -- the model keeps them in
// separate named fields and every subtotal is per currency, so summing across classes would first
// require an exchange rate the cost payload does not carry (ADR-1003 forbids looking one up).
// `unclassified` renders beside the three rather than being folded into any of them: a cost whose
// source nobody recognises is a fact about the data, and normalizing it away would hide it.
function costSections(bucket, indent, mark) {
  const out = [];
  if (!bucket) return out;
  for (const cls of [...COST_CLASSES, UNCLASSIFIED]) {
    const s = bucket[cls];
    if (!s || !s.lines || s.lines.length === 0) continue;
    out.push(`${mark}${indent}costs (${s.source})`);
    for (const l of s.lines.slice().sort(byTsId)) out.push(`${mark}${indent}  ${costLine(l)}`);
    out.push(`${mark}${indent}  subtotal ${s.source} ${renderSectionTotal(s)}`);
  }
  return out;
}

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

// `PROVIDER:CURRENCY=VALUE` for both input flags. One spelling, because two spellings of "which
// rail" is two things to keep in step -- and a rail named one way in the file flag and another way
// in the total flag would surface as INPUT-CONFLICT on rails that are actually the same one.
const RAIL_SPEC_RE = /^([a-z0-9][a-z0-9-]{0,31}):([A-Z]{3})=(.+)$/;

function parseReconcileInputs(flags, month) {
  const inputs = [];
  const add = (spec, kind) => {
    const m = RAIL_SPEC_RE.exec(spec);
    if (!m) throw new SpineError("BAD_ARGS", `--reconcile-${kind} ${JSON.stringify(spec)} must be PROVIDER:CURRENCY=${kind === "file" ? "PATH" : "MINOR_UNITS"} (lowercase provider, ISO-4217 currency)`);
    const [, provider, currency, value] = m;
    if (kind === "file") {
      if (!existsSync(value)) throw new SpineError("BAD_ARGS", `--reconcile-file names ${value}, and there is no file there`);
      // A DIRECTORY HERE WAS `ERROR INTERNAL -- EISDIR`, which is a raw errno presented to the
      // operator as an internal fault. The identical guard sits 75 lines away on --criteria-digest,
      // naming EISDIR in its own comment, and was not applied here: the twin-fix miss inside a
      // single file.
      if (!statSync(value).isFile())
        throw new SpineError("BAD_ARGS", `--reconcile-file names ${value}, which is not a regular file`);
      const bytes = readFileSync(value);
      const parser = EXPORT_PARSERS[provider];
      if (!parser)
        throw new SpineError("BAD_ARGS", `--reconcile-file has no export parser for provider ${JSON.stringify(provider)} (have ${Object.keys(EXPORT_PARSERS).sort().join(", ")}) -- use --reconcile-total for a rail whose export nothing here can read, rather than having the gate guess at a format`);
      // THE PARSERS THROW PLAIN Errors, and everything non-SpineError maps to `ERROR INTERNAL`. So
      // the most carefully engineered refusals in the lane -- "data follows a closing quote", the
      // 100x shape this repo has actually shipped -- reached the operator as internal faults.
      // Re-thrown with a name, message preserved verbatim.
      let rows;
      try {
        rows = parser(bytes.toString("utf8"));
      } catch (err) {
        if (err instanceof SpineError) throw err;
        throw new SpineError("BAD_RECONCILE_FILE", `--reconcile-file ${value}: ${err && err.message ? err.message : err}`);
      }
      // SUM THE SAME QUANTITY INGEST WOULD HAVE PUT ON THE SPINE, so file-vs-spine is an identity
      // check on the ingest rather than a comparison between two different definitions of revenue.
      // normalize.mjs owns that definition (`amount` = gross - tax); it is not exported, so the one
      // line is repeated here and this comment is the reason a reader should suspect drift if the
      // two ever disagree. Rows whose currency is not this rail's are excluded rather than added:
      // an export covering two currencies is two rails, and summing across them would compare a
      // number to a total that includes a conversion nobody made.
      //
      // AND THE ROWS MUST BE IN THE MONTH BEING CLOSED. The first version filtered on currency
      // alone and summed every row in the file, so the repo's own fixture -- every row settled in
      // SEPTEMBER -- closed JULY green, and a twelve-month export closed a single month green. The
      // receipt then pinned a September document as the evidence for July, permanently. That is a
      // gate that can detect a MISSING input and not a WRONG one, which is the shape this lane has
      // a written rule about.
      //
      // `settled_at` is IST by construction (the parsers normalize to +05:30), so the month is the
      // first seven characters and no zone conversion happens here.
      let total_minor = 0;
      let counted = 0;
      let wrongMonth = 0;
      let wrongCurrency = 0;
      let positive = 0;
      for (const r of rows) {
        if (r.currency !== currency) { wrongCurrency += 1; continue; }
        if (String(r.settled_at).slice(0, 7) !== month) { wrongMonth += 1; continue; }
        const ex = r.gross - r.tax;
        // A ROW THAT INGEST WOULD REFUSE MUST NOT COUNT AS EVIDENCE. `normalize.mjs` requires a
        // POSITIVE ex-tax amount, so a row with gross === tax can never be on the spine -- yet it
        // parses cleanly (net = gross - tax - fees still holds at 0) and used to make `counted`
        // non-zero while contributing nothing. A file of nothing but such rows therefore summed to
        // 0 and closed a net-zero rail GREEN, carrying the FILE receipt, which this gate prefers
        // precisely because it is meant to be the stronger evidence. The old guard counted ROWS;
        // what makes an input evidence is MONEY.
        if (ex > 0) positive += 1;
        total_minor += ex;
        counted += 1;
      }
      if (counted > 0 && positive === 0)
        throw new SpineError("BAD_RECONCILE_FILE",
          `--reconcile-file ${value} has ${counted} row(s) in ${currency}/${month} and NOT ONE with a positive ex-tax amount -- every one of them is a row ingest would refuse, so this file is evidence of nothing`);
      if (counted === 0)
        throw new SpineError("BAD_ARGS",
          `--reconcile-file ${value} has ${rows.length} row(s) and NONE that are both ${currency} and settled in ${month} ` +
          `(${wrongCurrency} in another currency, ${wrongMonth} in another month) -- an empty sum would reconcile as a real zero, which is the shape that closes a month against nothing`);
      if (wrongMonth > 0)
        process.stderr.write(`arc-pnl: ${value} carries ${wrongMonth} row(s) settled outside ${month}; they are excluded from this rail's total\n`);
      // The sha is over the FILE BYTES, so the receipt pins the document rather than a number
      // someone read out of it.
      inputs.push({ provider, currency, source: "file", total_minor, input_sha: inputSha(bytes) });
      return;
    }
    // Integer minor units, refused rather than parsed loosely: "1180.50" is the shape that becomes
    // a 100x error, and this lane has already shipped one of those.
    if (!/^(0|[1-9]\d*)$/.test(value))
      throw new SpineError("BAD_ARGS", `--reconcile-total ${JSON.stringify(spec)} must end in a non-negative INTEGER of minor units (ADR-1012) -- a decimal here is the 100x error this lane has already paid for once`);
    const total_minor = Number(value);
    if (!Number.isSafeInteger(total_minor)) throw new SpineError("BAD_ARGS", `--reconcile-total ${value} is outside the safe integer range`);
    // THE PREIMAGE CARRIES THE RAIL AND THE MONTH, not just the number. `sha256("100000")` is a
    // constant: two different spines, two different months and two different rails all sealed the
    // IDENTICAL input_sha, so the field was a restatement of the `provider_minor` sitting beside it
    // -- and the comment above it says a receipt naming a number without pinning where it came from
    // is a receipt of nothing. A typed total has no bytes to pin, so what gets pinned is WHICH
    // number was typed for WHICH rail in WHICH month.
    inputs.push({
      provider, currency, source: "total", total_minor,
      input_sha: inputSha(`month.reconcile.total|${month}|${provider}|${currency}|${canonicalTotalText(total_minor)}`),
    });
  };
  for (const spec of flags["reconcile-file"] || []) add(spec, "file");
  for (const spec of flags["reconcile-total"] || []) add(spec, "total");
  return inputs;
}

function renderClose(month, derived, verdict) {
  const out = [`close ${month}  ${verdict.ok ? "GREEN" : "BLOCKED"}`];
  for (const r of verdict.rails) {
    const prov = r.provider_minor === null ? ABSENT : String(r.provider_minor);
    out.push(`  ${r.provider}/${r.currency}  spine ${r.net_minor === undefined ? r.spine_minor : r.net_minor}  provider ${prov}  ${r.status}`);
  }
  if (verdict.blockers.length) {
    out.push("");
    out.push(`blocked (${verdict.blockers.length})`);
    // The blocker's own fields, rendered as they are. A prose summary here would be a second
    // spelling of the gate's verdict, and the fields are what a human acts on.
    for (const b of verdict.blockers) out.push(`  ${b.kind}  ${JSON.stringify(b)}`);
  }
  return out.join("\n") + "\n";
}

async function main(argv) {
  const flags = parseArgs(argv);
  if (flags.help) {
    process.stdout.write(
      "usage: arc-pnl [--venture V] [--month YYYY-MM] [--simulated] [--engine scan|sqlite] [--criteria-digest]\n" +
      "       arc-pnl --close YYYY-MM (--reconcile-file PROVIDER:CURRENCY=PATH | --reconcile-total PROVIDER:CURRENCY=MINOR)...\n");
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
  // Reconciliation input only means anything against a close. Silently ignoring it would let
  // `arc-pnl --reconcile-total ...` (the --close forgotten) look like it did the work.
  if (flags.close === undefined && (flags["reconcile-file"] || flags["reconcile-total"]))
    throw new SpineError("BAD_ARGS", "--reconcile-file/--reconcile-total are reconciliation input for --close, and there is no --close here");
  // AN UNKNOWN ENGINE NAME MUST NOT FALL BACK TO `scan`. This file's own header explains why the
  // engine is announced at all: a box without sqlite would otherwise run scan twice, compare a
  // thing to itself, and report the equivalence gate green. A typo'd `--engine sqlite3` produced
  // exactly that -- two scan legs, byte-identical by construction, gate green -- because the value
  // was silently ignored. The announcement existed; nothing refused the bad value.
  if (flags.engine !== undefined && flags.engine !== "scan" && flags.engine !== "sqlite")
    throw new SpineError("BAD_ARGS", `--engine ${JSON.stringify(flags.engine)} is neither "scan" nor "sqlite" -- an unrecognised engine used to fall back to scan silently, which is how an equivalence gate compares a thing to itself and passes`);

  const root = spineRoot();

  // THE MONTH CLOSE (REQ-05). It renders the gate's verdict and NOTHING ELSE -- it never emits.
  // Month-close is human-run, always (a lane non-negotiable): this command tells you whether the
  // month MAY be closed and prints the exact receipt to seal, and a human seals it. Wiring the
  // emission in here is how a gate becomes a daemon by accident.
  if (flags.close !== undefined) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(flags.close))
      throw new SpineError("BAD_ARGS", `--close "${flags.close}" is not YYYY-MM`);
    // FLAGS THE CLOSE DOES NOT HONOUR ARE AN OPERATOR ERROR, NOT A NO-OP. `--simulated` was
    // accepted and silently dropped, so an operator who believed they were running a simulation got
    // a REAL green verdict with no watermark on any line and a real sealable payload -- the exact
    // shape this file's own argv parser carries a scar comment about, reintroduced from the other
    // direction. `--month` and `--venture` were validated and then discarded the same way.
    for (const f of ["simulated", "month", "venture"])
      if (flags[f] !== undefined)
        throw new SpineError("BAD_ARGS", `--${f} is not honoured by --close and was being silently ignored; the close reconciles one month across every rail, and ${f === "simulated" ? "a close is never simulated" : `the month comes from --close ${flags.close}`}`);
    const inputs = parseReconcileInputs(flags, flags.close);
    const derived = await deriveRails(root, { month: flags.close, engine: flags.engine });
    const verdict = reconcile({ rails: derived.rails, inputs });

    // THE P&L's OWN NEEDS-YOU FLAGS ARE BLOCKERS HERE. They were computed and thrown away, and
    // three separate adversarial findings came out of that one omission: an OVER_REFUND netted a
    // 200000 refund against a 100000 charge and closed GREEN while `arc pnl` printed "Never
    // silently netted" for the same month; a DUPLICATE_PAYMENT straddling two months closed GREEN
    // over a month whose own P&L rendered "no real revenue yet"; and every unlinked-refund flag was
    // invisible on the green path. A gate that ignores what the renderer already knows is wrong is
    // not a gate.
    const pnlFlags = await derivePnl(root, { mode: "real", venture: null, month: flags.close, engine: flags.engine });
    const scoped = pnlFlags.needsYou || [];
    if (scoped.length) {
      verdict.ok = false;
      for (const f of scoped) verdict.blockers.push({ kind: "PNL-FLAG", rail: null, type: f.type, detail: f.detail });
    }

    process.stdout.write(renderClose(flags.close, derived, verdict));
    if (!verdict.ok) return 4;
    // The payload a human seals. PRINTED, never emitted -- month-close is human-run, always.
    //
    // The instruction below is a WORKING one, checked by running it. The first version told the
    // operator to pipe stdout into `arc-event --payload-file -`, and neither half was true:
    // arc-event has no stdin path at all, and stdout carries the human verdict table above the
    // JSON, so the emitter would have been fed prose. An instruction nobody ran is documentation
    // of an intention.
    const payload = closePayload({ month: flags.close, rails: verdict.rails, paymentCount: derived.paymentCount });
    process.stdout.write(`\n${JSON.stringify(payload)}\n`);
    process.stderr.write(
      `arc-pnl: gate GREEN for ${flags.close}. Seal it in two steps -- the JSON is the LAST line of stdout:\n` +
      `  arc-pnl --close ${flags.close} <the same --reconcile flags> | tail -1 > /tmp/close.json\n` +
      `  arc-event emit month.closed --payload-file /tmp/close.json --idem ${sha256Hex(`month.closed|${flags.close}`)} --strict --outcome ok\n`);
    return 0;
  }

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
  // There is no `cost.simulated` kind, so a simulated P&L has no cost side at all. Derived only for
  // the real view, and the simulated view says so out loud below rather than showing nothing --
  // "no cost section" would otherwise read as "costs are zero".
  const costs = flags.simulated === true ? null : await deriveCosts(root, {
    month: flags.month ?? null, venture: flags.venture ?? null, engine: flags.engine,
  });
  const body = render(model, panel, costs);
  process.stdout.write(flags.simulated === true
    ? body.replace(/\n$/, "\nSIMULATED costs are not simulated -- there is no cost.simulated kind; run without --simulated for the cost side\n")
    : body);
  return 0;
}

main(process.argv.slice(2))
  .then((code) => process.exit(code))
  .catch((err) => {
    const code = err instanceof SpineError ? err.code : "INTERNAL";
    process.stderr.write(`arc-pnl: ERROR ${code} -- ${err.message}\n`);
    process.exit(2);
  });
