// kill-panel.mjs — the kill-distance view (REQ-03), derived at RENDER from `ventures.yaml` plus
// spine receipts, and emitting NOTHING (ADR-1000 / LED-A). A crossing is a fact about data that
// already exists; recording a second fact saying so would make the meter part of the history it
// measures, and a replay would then re-derive crossings that a later replay disagrees with.
//
// Three separable jobs live here and are kept separable on purpose:
//   1. WHERE the criteria file is, and whether there is one at all
//   2. WHETHER the criteria currently in it are receipted (ADR-1008 / LED-I, ADR-1017 / LED-R)
//   3. WHAT the observations are, handed to kill-distance.mjs which owns the arithmetic
//
// This module reads through the spine reader only; `.claude/scripts/review/spine-reader-lint.sh`
// enforces that and this file is subject to it.

import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { SpineError, formatIst, nowMs } from "../canonical.mjs";
import { query } from "../../spine.mjs";
import { parseVentures } from "./ventures.mjs";
import { evaluateAll, STATUS } from "./kill-distance.mjs";
import { isCriteriaChange } from "../validate-ledger.mjs";

export const UNRECEIPTED = "UNRECEIPTED CRITERIA CHANGE";

// WHERE `ventures.yaml` LIVES, and why this is not a second walk-up.
//
// `spineRoot()` already owns the "find the repo" question and has a scar on it: walking up for
// `.claude` alone once found the user's HOME config and wrote one project's receipts into a global
// spine. Rather than repeat that walk with the same bug surface, the repo root is DERIVED from the
// spine root -- `<repo>/.claude/state/hq` is three levels down, by construction.
//
// When ARC_SPINE_ROOT is set the spine has been pointed somewhere with no repo above it, so that
// derivation is meaningless and the file must be named explicitly with ARC_VENTURES_FILE. That is
// the tests' door, and it is the same shape as the spine's own: name it, or there isn't one.
export function venturesPath(spineRootPath) {
  if ("ARC_VENTURES_FILE" in process.env) {
    const named = process.env.ARC_VENTURES_FILE;
    if (typeof named !== "string" || named.trim() === "")
      throw new SpineError("NO_VENTURES",
        "ARC_VENTURES_FILE is set but empty -- refusing to fall back to a criteria file nobody named, because reading the wrong kill lines answers the question confidently and wrongly (unset it, or give it a path)");
    return resolve(named);
  }
  if ("ARC_SPINE_ROOT" in process.env) return null;
  return join(resolve(spineRootPath, "..", "..", ".."), "ventures.yaml");
}

// Calendar days between two YYYY-MM-DD strings, computed in UTC on the DATE PARTS alone. The parts
// come from IST timestamps that already carry +05:30, so no zone conversion happens here -- doing
// one would be the second zone conversion in this lane, and normalize.mjs owns the only one.
function daysBetween(fromDay, toDay) {
  const parse = (d) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
    if (!m) throw new SpineError("BAD_TS", `${JSON.stringify(d)} is not a YYYY-MM-DD day`);
    return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  };
  return Math.round((parse(toDay) - parse(fromDay)) / 86400000);
}

/**
 * The receipt fold. A digest is honored iff some `approval.requested` carrying it under subject
 * "ledger.criteria" has a `decision.recorded` deciding it with verdict "approve".
 *
 * Both halves are REQUIRED. An approval alone is a request, not a decision -- and a criteria change
 * that counted its own request as its receipt would be a control that authorises itself, which is
 * the entire failure ADR-1008 exists to prevent.
 */
function isReceipted(events, digest) {
  const approvedIds = new Set();
  for (const e of events) {
    if (e.kind !== "decision.recorded") continue;
    if (e.payload && e.payload.verdict === "approve" && typeof e.payload.decides === "string")
      approvedIds.add(e.payload.decides);
  }
  for (const e of events) {
    // Reuse the validator's own predicate rather than re-testing `subject` here: a second spelling
    // of "is this a criteria approval" is a second thing to keep in step, and the near-miss subject
    // rule lives in that predicate's file.
    if (!isCriteriaChange(e)) continue;
    if (e.payload.digest === digest && approvedIds.has(e.id)) return true;
  }
  return false;
}

/**
 * Observations, per venture, for the criteria v1 declares.
 *
 * `days_without_revenue` is measured from the LAST REAL revenue event. `revenue.simulated` is
 * excluded structurally rather than filtered at the end (REQ-01): a simulated payment must never be
 * able to reset a real kill clock, which is precisely the shape of lie the kill line exists to catch.
 *
 * Null means ABSENT and never zero. See ADR-1018: a venture with no revenue event has no zero for
 * this clock to count from, because ledger knows revenue and not a venture's start date.
 */
function observe(events, ventureNames, todayIst) {
  const lastRealDay = new Map();
  for (const e of events) {
    if (e.kind !== "revenue.received") continue;
    const venture = e.payload && e.payload.venture;
    if (typeof venture !== "string") continue;
    const day = String(e.ts).slice(0, 10);
    const prior = lastRealDay.get(venture);
    if (prior === undefined || day > prior) lastRealDay.set(venture, day);
  }

  const observations = {};
  for (const name of ventureNames) {
    const last = lastRealDay.get(name);
    let days = null;
    if (last !== undefined) {
      days = daysBetween(last, todayIst);
      // A revenue event dated after today is a clock disagreement, not a negative age. Clamping to
      // 0 would silently report "revenue today" for a spine whose timestamps are ahead of this box;
      // kill-distance refuses a negative observation, so surface it as absent with the reason.
      if (days < 0) days = null;
    }
    observations[name] = {
      days_without_revenue: days,
      // Structurally absent on every render until some lane supplies traffic (ADR-1018). Written as
      // an explicit null rather than omitted, so the reason comes from the polarity table instead of
      // from a key that happens to be missing.
      traffic_floor_monthly: null,
    };
  }
  return observations;
}

/**
 * Build the kill panel. Returns one of three shapes, and the caller renders each differently:
 *
 *   { present: false }                                   no ventures.yaml -- no panel, P&L unaffected
 *   { present: true, receipted: false, digest }          UNRECEIPTED CRITERIA CHANGE -- refuse
 *   { present: true, receipted: true, digest, ... }      the panel
 *
 * The absent case matters for consumers: `ventures.yaml` is arc's own company organ and is NOT in
 * the sync set, so every consumer install has none. Refusing to render a P&L because a file that
 * was never shipped is missing would break every one of them.
 */
export async function deriveKillPanel(spineRootPath, { engine } = {}) {
  const path = venturesPath(spineRootPath);
  if (path === null || !existsSync(path)) return { present: false };

  // A malformed criteria file is refused LOUDLY and never partially honored: a parser that skips a
  // line it cannot read is a parser that silently disables the kill switch that line arms.
  const parsed = parseVentures(readFileSync(path, "utf8"));

  const res = await query(spineRootPath, { engine });
  // The reader returns RECORDS -- {event, day, seq, line} -- not bare events. Reading `.kind` off a
  // record yields undefined for every event, and a filter on undefined quietly matches nothing.
  const events = res.events.map((r) => r.event);

  if (!isReceipted(events, parsed.digest))
    return { present: true, receipted: false, digest: parsed.digest, engine: res.engine, path };

  const names = Object.keys(parsed.ventures);
  const todayIst = formatIst(nowMs()).slice(0, 10);
  const evaluated = evaluateAll({ ventures: parsed.ventures, observations: observe(events, names, todayIst) });

  const crossings = [];
  const warnings = [];
  let absentCount = 0;
  for (const v of evaluated) {
    absentCount += v.absentCount;
    for (const c of v.criteria) {
      if (c.status === STATUS.CROSSED) crossings.push({ venture: v.venture, ...c });
      else if (c.status === STATUS.WARNING) warnings.push({ venture: v.venture, ...c });
    }
  }

  return {
    present: true,
    receipted: true,
    digest: parsed.digest,
    engine: res.engine,
    path,
    asOf: todayIst,
    ventures: evaluated,
    crossings,
    warnings,
    absentCount,
  };
}
