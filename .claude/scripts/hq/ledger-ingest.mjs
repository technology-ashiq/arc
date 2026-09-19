#!/usr/bin/env node
// ledger-ingest.mjs -- record real revenue from a provider's settlement export (face v2 Phase 05 PR 5, ADR-1342).
//
//   ledger-ingest.mjs --export PROVIDER=PATH --venture V [--plan P] [--interval I] [--customer-ref R]
//                     (--dry-run | --expect D)
//
// The ledger's own parser reads the export (lib/ledger/parsers: razorpay, mor) and its own normalizer turns each row into
// a revenue.received payload (lib/ledger/normalize.mjs); each one lands through `arc-event ingest`, whose idem is the
// payment's content, so one payment is one receipt however often it is recorded. Revenue is recorded by a person's hand
// only: the face runs this on the owner's click, and never from a schedule.
//
//   --dry-run   every row this would record, every row already on the spine (skipped, never recorded twice), each
//               payload judged by the spine, and the digest last
//   --expect D  records exactly the planned rows, when the export and the spine still give that digest -- PLAN_STALE
//               otherwise, with nothing recorded
//   (neither)   refused: recording money is bound to a plan
//
// WHEN A ROW COUNTS. The spine stamps a receipt with the moment it is RECORDED, and a closed day takes no new event
// (ADR-0029): a payment settled in an earlier month counts in the month it is recorded. The plan says so, row by row.
//
// Exit: 0 done · 1 some rows recorded and the rest not (said which, and a re-plan skips the recorded ones) · 2 refused,
// nothing recorded.

import { createHash } from "node:crypto";
import { readFileSync, realpathSync, statSync, writeSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { query, spineRoot } from "./spine.mjs";
import { SpineError, formatIst, nowMs } from "./lib/canonical.mjs";
import { formatMinorUnits } from "./lib/ledger/money.mjs";
import { normalizeRows } from "./lib/ledger/normalize.mjs";
import { parseRazorpayExport } from "./lib/ledger/parsers/razorpay.mjs";
import { parseMorExport } from "./lib/ledger/parsers/mor.mjs";
import { parseVentures } from "./lib/ledger/ventures.mjs";
import { venturesPath } from "./lib/ledger/kill-panel.mjs";
import { planDigest, expectLine, staleReason, spineRefusal, emitReceipt, withExclusiveLock } from "../core/plan-expect.mjs";
import { isOneLine } from "../core/one-line.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..", "..");
const ARC_EVENT = join(REPO, ".claude", "scripts", "hq", "arc-event.mjs");
/** Provider -> the ledger's own export parser: the same table arc-pnl's --reconcile-file reads with. */
const PARSERS = Object.freeze({ razorpay: parseRazorpayExport, mor: parseMorExport });
const INTERVALS = Object.freeze(["monthly", "quarterly", "annual", "one_time"]);
const VENTURE_RE = /^[a-z][a-z0-9-]{0,40}$/;
// An export past these is not a month's settlement file: refused rather than spawning an emitter per row for minutes.
const MAX_EXPORT_BYTES = 20 * 1024 * 1024;
const MAX_ROWS = 500;

class Stop extends Error {}
const out = [];
const say = (s = "") => out.push(s);
/** Written synchronously, then the exit code set: a caller parses the receipt lines. */
// SYNCHRONOUS: an asynchronous write's EPIPE arrived after the receipts had landed, as an uncaught error and exit 1
// ("some recorded, the rest not") with a stack of absolute paths (PR 5a round-1 shell attack).
function flush() { if (out.length) { try { writeSync(1, out.join("\n") + "\n"); } catch { /* the lines are lost; the receipts are not */ } out.length = 0; } }
function die(code, msg) { flush(); process.stderr.write(`ledger-ingest: ${msg}\n`); process.exitCode = code; throw new Stop(); }

function parseArgs(argv) {
  const a = { export: "", venture: "", plan: undefined, interval: undefined, "customer-ref": undefined, expect: undefined, dryRun: false };
  const known = ["--export", "--venture", "--plan", "--interval", "--customer-ref", "--expect"];
  const seen = new Set();
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t === "--dry-run") { if (a.dryRun) die(2, "--dry-run given twice"); a.dryRun = true; continue; }
    if (t.startsWith("--dry-run=")) die(2, `--dry-run takes no value; write it bare, not ${t}`);
    if (!known.includes(t)) die(2, `unknown argument ${JSON.stringify(t)} -- known: ${known.join(" ")} --dry-run`);
    if (seen.has(t)) die(2, `${t} given twice; pick one`);
    seen.add(t);
    const v = argv[i + 1];
    if (v === undefined || v === "" || v.startsWith("-")) die(2, `${t} needs a value`);
    a[t.slice(2)] = v;
    i++;
  }
  if (a.dryRun && a.expect !== undefined) die(2, "--dry-run plans and --expect applies; give one");
  if (!a.dryRun && a.expect === undefined) die(2, "recording money is bound to a plan: run it with --dry-run first, then again with the --expect it prints -- nothing was recorded");
  const m = /^([a-z0-9][a-z0-9-]{0,31})=(.+)$/.exec(a.export);
  if (!m) die(2, "--export is PROVIDER=PATH (a lowercase provider, then the export file)");
  if (!Object.hasOwn(PARSERS, m[1])) die(2, `--export names provider ${JSON.stringify(m[1])}, and the ledger has no parser for it (it reads ${Object.keys(PARSERS).join(", ")})`);
  a.provider = m[1];
  a.path = m[2];
  if (!VENTURE_RE.test(a.venture)) die(2, `--venture ${JSON.stringify(a.venture)} is not a venture slug`);
  if (a.interval !== undefined && !INTERVALS.includes(a.interval)) die(2, `--interval is one of ${INTERVALS.join(", ")}`);
  for (const k of ["plan", "customer-ref"]) {
    if (a[k] !== undefined && (!isOneLine(a[k]) || Buffer.byteLength(a[k]) > 128)) die(2, `--${k} is one line of text, up to 128 bytes, with no control or invisible characters`);
  }
  return a;
}

/**
 * The export, read once: its bytes' digest and the rows the ledger's parser makes of them. Named by its provider and its
 * digest, never by its path -- the face withholds a plan from the first absolute path on.
 * @param {{ provider: string, path: string }} a
 */
function readExport(a) {
  let real;
  try { real = realpathSync(a.path); } catch (e) { die(2, `the export cannot be found (${e && e.code ? e.code : "error"}) -- nothing was recorded`); }
  let st;
  try { st = statSync(real); } catch (e) { die(2, `the export cannot be read (${e && e.code ? e.code : "error"}) -- nothing was recorded`); }
  if (!st.isFile()) die(2, "the export is not a regular file -- nothing was recorded");
  if (st.size > MAX_EXPORT_BYTES) die(2, `the export is past ${MAX_EXPORT_BYTES} bytes -- not one settlement file; split it`);
  let bytes;
  try { bytes = readFileSync(real); } catch (e) { die(2, `the export cannot be read (${e && e.code ? e.code : "error"}) -- nothing was recorded`); }
  let text;
  try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
  catch { die(2, "the export is not valid UTF-8 -- the parser reads text, and a lossy read would change what is recorded"); }
  let rows;
  try { rows = PARSERS[a.provider](text); }
  catch (e) { die(2, `the ${a.provider} parser refused the export: ${e instanceof Error ? e.message : String(e)} -- nothing was recorded`); }
  if (!Array.isArray(rows) || rows.length === 0) die(2, "the export holds no rows -- nothing to record");
  if (rows.length > MAX_ROWS) die(2, `the export holds ${rows.length} rows, past the ${MAX_ROWS} one plan records -- split it by date`);
  return { sha: createHash("sha256").update(bytes).digest("hex"), rows };
}

/** A payment's identity on the spine: its provider, its payment id, and what it refunds (a refund is its own row). */
const paymentKey = (p) => `${p.provider}\u0000${p.provider_payment_id}\u0000${p.refund_of ?? ""}`;

/**
 * Everything the apply would record, derived from the export and the spine as they stand: the rows to record, the rows
 * already recorded (skipped), and the digest over what would be recorded.
 * @param {ReturnType<typeof parseArgs>} a
 */
async function derive(a) {
  // The venture must have its kill line: "a venture spending money with no kill line is a finding", and its revenue is
  // recorded against a venture ventures.yaml names.
  const vpath = venturesPath();
  if (vpath === null) die(2, "no ventures.yaml can be found -- a venture is registered before its revenue is recorded");
  let ventures;
  try { ventures = parseVentures(readFileSync(vpath, "utf8")); }
  catch (e) { die(2, `ventures.yaml cannot be read as the ledger reads it (${e instanceof SpineError ? e.code : e && e.code ? e.code : "error"}) -- nothing was recorded`); }
  if (!Object.hasOwn(ventures.ventures, a.venture))
    die(2, `${a.venture} is not a registered venture (ventures.yaml names ${Object.keys(ventures.ventures).join(", ") || "none"}) -- register it, with its kill line, first`);

  const exp = readExport(a);
  const meta = { venture: a.venture };
  if (a.plan !== undefined) meta.plan = a.plan;
  if (a.interval !== undefined) meta.interval = a.interval;
  if (a["customer-ref"] !== undefined) meta.customer_ref = a["customer-ref"];
  let normalized;
  try { normalized = normalizeRows(exp.rows, meta); }
  catch (e) { die(2, `the ledger's normalizer refused a row: ${e instanceof Error ? e.message : String(e)} -- nothing was recorded`); }
  // One payment once in one export: a file listing a payment twice would record one receipt and report two.
  const inFile = new Set();
  for (const n of normalized) {
    const k = paymentKey(n.payload);
    if (inFile.has(k)) die(2, `the export lists payment ${n.payload.provider_payment_id} twice -- one payment is one receipt; fix the export`);
    inFile.add(k);
  }

  // What the spine already holds, read through the spine reader. A day it cannot read is refused, never read as
  // "not recorded": that is how a payment is recorded twice (the pick twin, PR 4).
  // ONE SPINE, resolved once and handed to the emitter as an absolute path: the read and the lock went through this
  // process's folder while the emitter ran in REPO, so a payment was checked on one spine and recorded on another, and a
  // relative ARC_SPINE_ROOT made a spine inside the repo (PR 5a round-1 attacks, the bench twin).
  let root;
  try { root = spineRoot(); } catch (e) { die(2, `the spine cannot be found (${e && e.code ? e.code : "error"}) -- nothing was recorded`); }
  const { events, unreadable, torn } = await query(root, { kind: "revenue.received", engine: "scan" });
  // A torn line may be a payment: "not on the spine" was read from it, and the payment was recorded twice (round 1).
  if (torn && (Array.isArray(torn) ? torn.length : torn > 0)) die(2, "the spine has a torn line, so what is already recorded is unknown -- nothing was recorded; replay the spine first");
  if (unreadable && unreadable.length) die(2, `${unreadable.length} day file(s) of the spine cannot be read, so what is already recorded is unknown -- nothing was recorded`);
  /** @type {Map<string, string>} */
  const onSpine = new Map();
  // The reader returns RECORDS ({ event, day, seq, line }), never bare events: `.payload` on a record is undefined, and a
  // look that matched nothing would record every payment again.
  for (const r of events) {
    const e = r && r.event;
    if (e && e.payload && typeof e.payload.provider_payment_id === "string") onSpine.set(paymentKey(e.payload), String(e.venture));
  }

  const record = [];
  const skipped = [];
  for (const n of normalized) {
    const held = onSpine.get(paymentKey(n.payload));
    if (held === undefined) { record.push(n); continue; }
    if (held !== a.venture) die(2, `payment ${n.payload.provider_payment_id} is already recorded for ${held}, not ${a.venture} -- one payment belongs to one venture; nothing was recorded`);
    skipped.push(n);
  }
  // The MONTH it is recorded in is part of what the plan showed ("counts in YYYY-MM"): a plan made before midnight on a
  // month's last day and applied after it is stale, never a silent move to the next month (PR 5a round 1).
  const month = formatIst(nowMs()).slice(0, 7);
  const digest = planDigest({ venture: a.venture, provider: a.provider, export: exp.sha, month, record: record.map((n) => n.payload) });
  return { exp, record, skipped, digest, root, month };
}

async function main() {
  const a = parseArgs(process.argv.slice(2));
  const d = await derive(a);
  const today = formatIst(nowMs()).slice(0, 10);
  say(`export: ${a.provider}, sha256 ${d.exp.sha.slice(0, 12)}, ${d.exp.rows.length} row(s) for ${a.venture}`);
  for (const n of d.record) {
    const p = n.payload;
    const settled = n.ts.slice(0, 10);
    // Money as money: "100000 INR" was a thousand rupees in minor units (PR 5a round 1).
    let shown;
    try { shown = formatMinorUnits(p.amount, p.currency); } catch { shown = `${p.amount} ${p.currency} minor units`; }
    say(`  record  ${p.provider_payment_id}  ${shown} ex-tax${p.refund_of ? ` (refund of ${p.refund_of})` : ""}  settled ${settled}${settled.slice(0, 7) !== today.slice(0, 7) ? ` -- counts in ${today.slice(0, 7)}, the month it is recorded` : ""}`);
  }
  for (const n of d.skipped) say(`  skip    ${n.payload.provider_payment_id}  already on the spine`);
  if (d.record.length === 0) die(2, `every row of this export is already recorded (${d.skipped.length}) -- nothing to record`);

  // Each payload judged by the spine BEFORE anything is recorded: a row the spine refuses would stop the apply part-way.
  for (const n of d.record) {
    const no = spineRefusal(ARC_EVENT, "revenue.received", n.payload, { cwd: REPO, env: { ...process.env, ARC_SPINE_ROOT: d.root }, command: "ingest", flags: ["--venture", a.venture] });
    if (no) die(2, `the spine would refuse payment ${n.payload.provider_payment_id}: ${no} -- nothing was recorded`);
  }

  if (a.dryRun) {
    say(`would record ${d.record.length} payment(s) as revenue.received, stamped ${today}; ${d.skipped.length} already recorded`);
    say("dry run -- nothing recorded");
    say(expectLine(d.digest));
    flush();
    return;
  }
  const stale = staleReason(a.expect, d.digest);
  if (stale) die(2, stale);

  // ONE INGEST AT A TIME, the re-derivation inside the lock: two applies of one plan would each find nothing recorded.
  const locks = join(d.root, "locks");
  const held = await withExclusiveLock(locks, "ledger-ingest.lock", async () => {
    const again = await derive(a);
    const stale2 = staleReason(a.expect, again.digest);
    if (stale2) die(2, stale2);
    let done = 0;
    for (const n of again.record) {
      // The month the plan showed holds for EVERY receipt: an apply running across midnight on a month's last day split
      // one export over two months (PR 5a round-2 logic attack). Stop at the turn; a new plan says the new month.
      if (formatIst(nowMs()).slice(0, 7) !== again.month) die(done ? 1 : 2, `${done} of ${again.record.length} recorded; the month turned during the apply and the rest would count in a month the plan never showed -- plan again`);
      const got = emitReceipt(ARC_EVENT, "revenue.received", n.payload, { cwd: REPO, env: { ...process.env, ARC_SPINE_ROOT: again.root }, command: "ingest", flags: ["--venture", a.venture], timeoutMs: 60_000 });
      if (got.state === "landed" && got.id) { say(`receipt: revenue.received ${got.id}`); done += 1; continue; }
      const left = again.record.length - done;
      if (got.state === "refused") die(done ? 1 : 2, `${done} of ${again.record.length} recorded; payment ${n.payload.provider_payment_id} was refused (${got.why}) and the ${left - 1} after it were not tried -- plan again: the recorded ones are skipped`);
      die(1, `${done} of ${again.record.length} recorded; whether payment ${n.payload.provider_payment_id} landed is unknown (${got.why}) -- plan again: a landed one is found and skipped`);
    }
    say(`recorded ${done} payment(s)`);
  });
  if (held.busy) die(2, "another ingest is recording right now -- nothing was recorded; plan again when it is done");
  flush();
}

function isMainModule() {
  try { return !!process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); } catch { return false; }
}

if (isMainModule()) {
  try { await main(); }
  catch (e) {
    if (!(e instanceof Stop)) {
      flush();
      process.stderr.write(`ledger-ingest: ${e instanceof Error ? e.message : String(e)}\n`);
      process.exitCode = 2;
    }
  }
}
