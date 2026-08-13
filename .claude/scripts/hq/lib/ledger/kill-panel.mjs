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

import { existsSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { SpineError, formatIst, nowMs } from "../canonical.mjs";
import { repoRoot } from "../spine-io.mjs";
import { query } from "../../spine.mjs";
import { parseVentures } from "./ventures.mjs";
import { evaluateAll, STATUS } from "./kill-distance.mjs";
import { isCriteriaChange } from "../validate-ledger.mjs";

export const UNRECEIPTED = "UNRECEIPTED CRITERIA CHANGE";

// WHERE `ventures.yaml` LIVES.
//
// IT BELONGS TO THE REPOSITORY, NOT TO THE SPINE. An earlier version of this derived the repo root
// from the spine root by going up three levels, and returned null whenever ARC_SPINE_ROOT was set,
// on the premise that a named spine has no repo above it. That premise is never checkable -- a
// spine pointed at its OWN repo is indistinguishable from one pointed at a scratch dir -- and an
// adversarial pass showed the cost: with ARC_SPINE_ROOT set, the panel AND the
// UNRECEIPTED CRITERIA CHANGE refusal both vanished, exit 0, no marker of any kind on stdout.
// In a LINKED WORKTREE, where the bare invocation refuses outright, that was the only way to run
// this command at all -- so the kill switch was off by default in the checkout it was written in.
//
// So the repo is found the way the repo is always found, through the one walk `spine-io` owns.
// ARC_VENTURES_FILE still overrides, which is how a test names a criteria file (or names a missing
// one to test the absent case) without depending on where the spine happens to be pointed.
export function venturesPath() {
  if ("ARC_VENTURES_FILE" in process.env) {
    const named = process.env.ARC_VENTURES_FILE;
    if (typeof named !== "string" || named.trim() === "")
      throw new SpineError("NO_VENTURES",
        "ARC_VENTURES_FILE is set but empty -- refusing to fall back to a criteria file nobody named, because reading the wrong kill lines answers the question confidently and wrongly (unset it, or give it a path)");
    // TRIM WHAT WE TEST AND RESOLVE THE SAME BYTES. The first version tested `named.trim()` and
    // resolved the raw `named`, so " " was refused while " /path/ventures.yaml" was accepted and
    // resolved WITH the leading space in the filename -- and `$(cat pathfile)` carrying a newline
    // did the same. A value that fails the emptiness test in one spelling and passes it in another
    // is two different values wearing one name.
    return resolve(named.trim());
  }
  const root = repoRoot();
  return root === null ? null : join(root, "ventures.yaml");
}

// NAMED-BUT-MISSING IS AN OPERATOR ERROR. UNSET-AND-ABSENT IS THE CONSUMER CONTRACT.
//
// These were the same branch, and the cost was that a mistyped ARC_VENTURES_FILE -- a typo, a
// trailing newline from `$(cat …)`, a relative path read from the wrong cwd, a case difference that
// resolves on Windows and not on Linux -- disarmed the entire kill panel at exit 0 with ZERO bytes
// on stderr. The output was a clean, healthy-looking P&L with the panel simply absent.
//
// `venturesPath`'s own refusal text says it will not "fall back to a criteria file nobody named".
// Naming a file that is not there was getting exactly the treatment it refuses for the empty
// string. So: if the operator NAMED a path, a missing file is loud. If nobody named one and the
// repo has none, that is every consumer install (ventures.yaml is arc's own organ and is not in
// the sync set) and it stays silent.
function assertNamedFileExists(path) {
  if (!("ARC_VENTURES_FILE" in process.env)) return;
  if (!existsSync(path))
    throw new SpineError("NO_VENTURES",
      `ARC_VENTURES_FILE names ${path}, and there is no file there -- a named-but-missing criteria file is a typo, not an absence, and treating it as an absence disarms the kill panel silently`);
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
  // THE CLOCK IGNORES FUTURE-DATED REVENUE, and says so out loud instead of going quiet.
  //
  // The first version took the MAX revenue day and nulled the observation when it was ahead of
  // today. An adversarial pass showed what that buys: one revenue event dated 2027 turned a
  // venture that was 224 days past a 90-day line from CROSSED into ABSENT, under the reason
  // "this venture has no revenue event on the spine" -- printed directly beneath a P&L listing
  // that venture's revenue rows. The render contradicted itself, and a crossing disappeared, and
  // `revenue.received` is not a criteria change so it needs no approval at all. Clock skew on one
  // box does this without anyone acting maliciously.
  //
  // So the age is measured from the newest revenue day that is NOT in the future, which is the
  // most conservative reading of the data actually present, and the future-dated events are
  // surfaced as their own flag rather than being allowed to erase a line.
  const lastRealDay = new Map();
  const futureDated = new Map();
  for (const e of events) {
    if (e.kind !== "revenue.received") continue;
    const venture = e.payload && e.payload.venture;
    if (typeof venture !== "string") continue;
    const day = String(e.ts).slice(0, 10);
    if (day > todayIst) {
      futureDated.set(venture, (futureDated.get(venture) || 0) + 1);
      continue;
    }
    const prior = lastRealDay.get(venture);
    if (prior === undefined || day > prior) lastRealDay.set(venture, day);
  }

  const observations = {};
  for (const name of ventureNames) {
    const last = lastRealDay.get(name);
    observations[name] = {
      days_without_revenue: last === undefined ? null : daysBetween(last, todayIst),
      // Structurally absent on every render until some lane supplies traffic (ADR-1018). Written as
      // an explicit null rather than omitted, so the reason comes from the polarity table instead of
      // from a key that happens to be missing.
      traffic_floor_monthly: null,
    };
  }
  return { observations, futureDated };
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
  const path = venturesPath();
  if (path === null) return { present: false };
  assertNamedFileExists(path);
  if (!existsSync(path)) return { present: false };

  // A DIRECTORY at this path used to surface as `ERROR INTERNAL -- EISDIR`, which is outside the
  // SpineError vocabulary and therefore indistinguishable, to any assertion, from a crash. Named
  // here so a refusal stays a refusal: an unclassified crash is the shape that scores as a pass.
  if (!statSync(path).isFile())
    throw new SpineError("NO_VENTURES", `${path} is not a regular file -- the criteria file must be a file, and a directory here means the path is wrong rather than the criteria missing`);

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
  const { observations, futureDated } = observe(events, names, todayIst);
  const evaluated = evaluateAll({ ventures: parsed.ventures, observations });

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

  // Sorted by venture, because this array reaches a byte-compared render.
  const futureRevenue = [...futureDated.keys()].sort()
    .map((venture) => ({ venture, count: futureDated.get(venture) }));

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
    futureRevenue,
  };
}
