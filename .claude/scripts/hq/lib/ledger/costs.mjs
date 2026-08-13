// costs.mjs -- the COST side of the P&L (REQ-06, ADR-1006 / LED-G, ADR-1001 / LED-B). Derived from
// spine receipts at render time, stored nowhere, emitting nothing (ADR-1000 / LED-A). The spine is
// read through `query` only; `.claude/scripts/review/spine-reader-lint.sh` scans `lib/ledger/` and
// this file is subject to it.
//
// THERE IS NO COST CONFIG FILE, here or anywhere (ADR-1001). Declared fixed and subscription costs
// are monthly `cost.incurred` events like every other cost, so this module reads exactly one source
// and a second money store cannot exist behind it.
//
// THE TRICHOTOMY IS A SHAPE, NOT A TAG.
//
// measured, declared and allocated are three different claims about money and are never added into
// one number (ADR-1006). That is enforced structurally, twice over:
//
//   1. THREE NAMED FIELDS, NO SEQUENCE OF VALUES. Each bucket carries `.measured`, `.declared`,
//      `.allocated` (and `.unclassified`) as literal fields. There is no array of class values for
//      a caller to reduce over and no cross-class number anywhere on the model. Producing a "total
//      cost" requires inventing a field, which is a reviewable act rather than a one-line reduce.
//   2. EVERY SUBTOTAL IS PER CURRENCY. `cost.incurred` payloads carry no `fx` block, so there is no
//      recorded rate to convert a USD cost at, and ADR-1003 forbids looking one up -- a rate is a
//      receipt, not a variable. A class total is therefore a list of (currency, amount) pairs, and
//      adding two classes would first require picking a rate that does not exist.
//
// WHERE THE CLASS COMES FROM, and what is REALLY on the event.
//
// `cost.incurred`'s PAYLOAD is not validated by `validateEvent`: `assertMoney` covers the two
// revenue kinds only, `assertLedgerRevenue` covers the same two, and no other assertion claims this
// kind. So `payload.source` is a free-form string, and the class vocabulary is unenforced at ingest.
//
// The one closed cost-source vocabulary in the repo -- `COST_SOURCES` in validate.mjs, checked by
// `assertCost` -- is measured|estimated|manual, and it governs the ENVELOPE field `event.cost`.
// That field describes what the AGENT RUN THAT EMITTED THIS EVENT cost; it is not a statement about
// the money the event records. Two different facts sharing one word. It is deliberately not read
// here, and it could not express this trichotomy anyway: it has no `declared` and no `allocated`.
//
// So the gap is named rather than papered over, and the module is built to be safe inside it:
// classification is CASE-EXACT and never normalizes. "Measured", " measured" and "estimated" all
// land in `unclassified`, which renders as its own labelled block and raises a needs-you item.
// Trimming or case-folding a near-miss is how a cost silently changes what it claims -- the same
// rule the near-miss subject checks apply to `ledger.criteria` and `absorb.ab-judgement`.
//
// ABSENT STAYS ABSENT (MP-F, ADR-1006). A cost whose amount is not an integer count of minor units,
// or whose currency has no pinned exponent, renders ABSENT WITH ITS SOURCE STILL SHOWN and is
// counted in the section's `absent`. It is never coerced to 0 and never dropped: a subtotal that
// silently omits what it could not read is shorter, greener, and indistinguishable from the truth.

import { query } from "../../spine.mjs";
import { isSupportedCurrency, formatMinorUnits, ABSENT } from "./money.mjs";

const COST_KIND = "cost.incurred";
// Same constant, same rule, same spelling as pnl.mjs: `venture: arc` is Overhead and is never
// attributed to a product venture. Building the factory is not a cost of any product made in it.
const OVERHEAD_VENTURE = "arc";

export const MEASURED = "measured";
export const DECLARED = "declared";
export const ALLOCATED = "allocated";
export const UNCLASSIFIED = "unclassified";

// Render order, and NAMES ONLY. Reducing over this array yields strings, never money -- the values
// live in named fields precisely so that no loop can reach them as a sequence.
export const COST_CLASSES = Object.freeze([MEASURED, DECLARED, ALLOCATED]);
const CLASS_SET = new Set(COST_CLASSES);

// Every `ts` on this spine matches IST_TS_RE and carries +05:30 (canonical.mjs), so a slice IS the
// IST month/day with no conversion and no zone library -- the same reasoning pnl.mjs records.
const monthOf = (ts) => String(ts).slice(0, 7);
const dayOf = (ts) => String(ts).slice(0, 10);

// CODE-UNIT COMPARE, never localeCompare: this output is byte-compared across three CI legs and
// localeCompare answers differently depending on the box's ICU data.
const byCode = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const byTsId = (a, b) => byCode(a.ts, b.ts) || byCode(a.id, b.id);

// C0, DEL and C1. C1 includes NEL and CSI, a single-character terminal-escape introducer -- and
// nothing validates a `cost.incurred` payload string, so an escape sequence can reach a renderer
// through `source` or `label` unless it is stopped here. Checked by code point so no control byte
// is ever written literally into this file.
function hasControlChar(s) {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x20 || c === 0x7f || (c >= 0x80 && c <= 0x9f)) return true;
  }
  return false;
}

// For a needs-you detail, where the operator has to SEE the exact spelling that failed to classify
// -- including the trailing space or the capital M that caused it.
function escapeControls(s) {
  let out = "";
  for (const ch of s) {
    const c = ch.codePointAt(0);
    out += (c < 0x20 || c === 0x7f || (c >= 0x80 && c <= 0x9f))
      ? "\\u" + c.toString(16).padStart(4, "0")
      : ch;
  }
  return out;
}

// A payload string is carried to the render only if it is safe to print and bounded. Otherwise it
// becomes null, which `arc-pnl`'s `costLine` already renders as "source unrecorded" -- the honest
// answer, rather than a line the terminal reinterprets.
function safeText(v) {
  return typeof v === "string" && v.length > 0 && v.length <= 64 && !hasControlChar(v) ? v : null;
}

/**
 * The class of one `cost.incurred`, decided from what is really on the payload.
 *
 * CASE-EXACT, NO TRIM. Anything outside the three is `unclassified` and stays visible.
 */
export function classifyCost(event) {
  const p = event && event.payload;
  const s = p && typeof p === "object" ? p.source : undefined;
  return typeof s === "string" && CLASS_SET.has(s) ? s : UNCLASSIFIED;
}

// The render line, shaped exactly like the one pnl.mjs already builds so `arc-pnl`'s existing
// `costLine` renders it unchanged -- one line format for costs, not two.
function lineOf(e) {
  const p = e.payload && typeof e.payload === "object" ? e.payload : {};
  const currency = typeof p.currency === "string" && isSupportedCurrency(p.currency) ? p.currency : null;
  // An amount in a currency with no pinned minor-unit exponent cannot be rendered at all, so it is
  // absent rather than a number in unknown units.
  const amount = currency !== null && Number.isSafeInteger(p.amount) ? p.amount : null;
  return {
    id: e.id,
    ts: e.ts,
    source: safeText(p.source),
    amount,
    currency,
    label: safeText(p.label),
  };
}

const emptySection = (source) => ({ source, lines: [], totals: [], absent: 0 });

// FOUR LITERAL FIELDS. This object is the anti-sum guard: there is no `[class]` list here to walk.
const emptyBucket = () => ({
  measured: emptySection(MEASURED),
  declared: emptySection(DECLARED),
  allocated: emptySection(ALLOCATED),
  unclassified: emptySection(UNCLASSIFIED),
});

// Integer addition only, and per currency. Two costs in different currencies never meet in one
// accumulator, so no total can be the sum of things that were never comparable.
function addLine(section, line) {
  section.lines.push(line);
  if (line.amount === null || line.currency === null) {
    section.absent += 1;
    return;
  }
  const t = section.totals.find((x) => x.currency === line.currency);
  if (t) t.amount += line.amount;
  else section.totals.push({ currency: line.currency, amount: line.amount });
}

// Sort and freeze. Freezing is not decoration: it is what stops a downstream edit from quietly
// attaching a `total` to a model whose whole point is that it has none.
function seal(bucket) {
  for (const name of [MEASURED, DECLARED, ALLOCATED, UNCLASSIFIED]) {
    const s = bucket[name];
    s.lines.sort(byTsId);
    s.totals.sort((a, b) => byCode(a.currency, b.currency));
    Object.freeze(s.lines);
    Object.freeze(s.totals);
    Object.freeze(s);
  }
  return bucket;
}

/**
 * One class section as a rendered amount: per-currency totals, or ABSENT when nothing in it could
 * be read, with the absent count appended whenever any line could not be read.
 *
 * The count is the point. "1,234.00 INR" over a section that also holds two unreadable lines is a
 * subtotal presenting itself as complete.
 */
export function renderSectionTotal(section) {
  const money = section.totals.length === 0
    ? ABSENT
    : section.totals.map((t) => `${formatMinorUnits(t.amount, t.currency)} ${t.currency}`).join(" + ");
  return section.absent === 0 ? money : `${money} (${section.absent} absent)`;
}

/**
 * The daily spend view, PURE, over bare events (records are `{event, day, seq, line}` -- unwrap
 * with `res.events.map((r) => r.event)` before calling).
 *
 * Returns null when the day holds no `cost.incurred` at all, so a caller renders NOTHING rather
 * than a zero. A rendered "spend 0.00" on a day nobody spent anything is a claim, and it is
 * indistinguishable from a day whose ingest never ran.
 *
 * Overhead is INCLUDED here and not broken out: this is company-wide money leaving on one day, and
 * it is attributed to nothing. Attribution is the P&L's job, and the Overhead section is where it
 * is shown.
 */
export function dailySpend(events, { day = null, venture = null } = {}) {
  const bucket = emptyBucket();
  let seen = 0;
  for (const e of events || []) {
    if (!e) continue;
    // A RECORD HANDED IN AS AN EVENT IS LOUD, never a quiet zero. The reader yields
    // {event, day, seq, line}; `record.kind` is undefined, every comparison misses, and this
    // function would return null -- "no spend today" -- on a day full of spend. kill-panel.mjs
    // carries the scar of the same mistake, so it is refused here rather than commented about.
    if (e.kind === undefined && e.event && typeof e.event === "object")
      throw new TypeError("dailySpend takes BARE EVENTS -- unwrap the reader's records first with res.events.map((r) => r.event)");
    if (e.kind !== COST_KIND) continue;
    if (day !== null && dayOf(e.ts) !== day) continue;
    if (e.venture !== OVERHEAD_VENTURE && venture !== null && e.venture !== venture) continue;
    addLine(bucket[classifyCost(e)], lineOf(e));
    seen += 1;
  }
  if (seen === 0) return null;
  return Object.freeze({ day, ...seal(bucket) });
}

/**
 * The one-line daily spend for `arc brief`. Null when there is no spend, so the caller pushes
 * nothing at all.
 *
 * Classes are separated by three spaces, matching the P&L's own `gross X   fees Y` spacing. A
 * separator that reads as arithmetic (a plus, a slash) would undo in the render what the model
 * spent two structural guards preventing.
 */
export function renderSpendLine(view, { indent = "  " } = {}) {
  if (!view) return null;
  const parts = [];
  for (const name of [MEASURED, DECLARED, ALLOCATED, UNCLASSIFIED]) {
    const s = view[name];
    if (!s || s.lines.length === 0) continue;
    parts.push(`${name} ${renderSectionTotal(s)}`);
  }
  return parts.length === 0 ? null : `${indent}spend  ${parts.join("   ")}`;
}

/**
 * The cost model for one scope.
 *
 * Returns, frozen:
 *   { engine, month, ventureFilter,
 *     ventures: [ { venture, measured, declared, allocated, unclassified } ],   sorted by name
 *     overhead:   { venture: "arc", measured, declared, allocated, unclassified },
 *     daily:    [ { day, measured, declared, allocated, unclassified } ],       sorted by day
 *     needsYou: [ { type, venture, detail } ],
 *     counts:     { costs } }
 *
 * Every section is `{ source, lines, totals, absent }` -- see renderSectionTotal.
 */
export async function deriveCosts(root, { month = null, venture = null, engine } = {}) {
  const res = await query(root, { engine });
  // The reader yields RECORDS -- {event, day, seq, line} -- not bare events. Reading `.kind` off a
  // record yields undefined for every event, and a filter on undefined quietly matches nothing.
  const all = res.events.map((r) => r.event);

  // THE VENTURE FILTER APPLIES TO COSTS, and Overhead is exempt from it. Same rule as pnl.mjs: an
  // unfiltered cost event conjures a venture the operator never asked for, and a filtered-out
  // Overhead line would make `--venture X` quietly under-report the company's spend.
  const scoped = [];
  for (const e of all) {
    if (e.kind !== COST_KIND) continue;
    if (month !== null && monthOf(e.ts) !== month) continue;
    if (e.venture !== OVERHEAD_VENTURE && venture !== null && e.venture !== venture) continue;
    scoped.push(e);
  }

  const ventures = new Map();
  const overhead = emptyBucket();
  const byDay = new Map();
  // ONE FLAG PER (venture, spelling), carrying a count -- not one per event. A spine holding a
  // thousand mis-sourced costs would otherwise push a thousand identical lines into needs-you,
  // which is how the group everyone must read becomes the group nobody reads.
  const unknown = new Map();

  for (const e of scoped) {
    const cls = classifyCost(e);
    const line = lineOf(e);
    const bucket = e.venture === OVERHEAD_VENTURE ? overhead : bucketFor(ventures, e.venture);
    addLine(bucket[cls], line);

    const day = dayOf(e.ts);
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day).push(e);

    if (cls === UNCLASSIFIED) {
      const raw = e.payload && typeof e.payload === "object" ? e.payload.source : undefined;
      // JSON-quoted so a trailing space or an empty string is visible AS ITSELF -- " measured "
      // and "measured" are one character apart on screen and the quotes are what separate them.
      // The venture is a slug and the quoted spelling cannot contain a bare pipe, so the key
      // cannot collide.
      const spelling = typeof raw === "string" ? JSON.stringify(escapeControls(raw)) : null;
      const key = e.venture + "|" + (spelling === null ? "(no source)" : spelling);
      const prior = unknown.get(key);
      if (prior) prior.count += 1;
      else unknown.set(key, { venture: e.venture, spelling, sortKey: key, count: 1 });
    }
  }

  const needsYou = [...unknown.values()]
    .sort((a, b) => byCode(a.venture, b.venture) || byCode(a.sortKey, b.sortKey))
    .map((u) => {
      // A MISSING source and a MISSPELLED one are different mistakes and read as different
      // sentences. One phrasing covering both produced "carry source no source at all".
      const what = u.spelling === null ? "carry no source at all" : `carry source ${u.spelling}`;
      return {
        type: "COST_SOURCE_UNCLASSIFIED",
        venture: u.venture,
        detail: `${u.count} cost event(s) ${what}, which is none of ${COST_CLASSES.join("|")} ` +
          "(exact case). They render in their own unclassified block and are never folded into a " +
          "class -- cost.incurred has no payload validator, so trimming or case-folding a " +
          "near-miss here would silently change what the cost claims.",
      };
    });

  // The daily view is built by calling the exported `dailySpend`, not by a second accumulation
  // loop. One implementation means the brief's line and the P&L's day view can never disagree.
  const daily = [...byDay.keys()].sort(byCode)
    .map((day) => dailySpend(byDay.get(day), { day }))
    .filter((v) => v !== null);

  return Object.freeze({
    engine: res.engine,
    month,
    ventureFilter: venture,
    ventures: [...ventures.keys()].sort(byCode)
      .map((v) => Object.freeze({ venture: v, ...seal(ventures.get(v)) })),
    overhead: Object.freeze({ venture: OVERHEAD_VENTURE, ...seal(overhead) }),
    daily: Object.freeze(daily),
    needsYou: Object.freeze(needsYou),
    counts: Object.freeze({ costs: scoped.length }),
  });
}

function bucketFor(map, name) {
  if (!map.has(name)) map.set(name, emptyBucket());
  return map.get(name);
}
