// kill-distance.mjs -- how far a venture is from each of its kill lines (Phase 01, ADR-1008).
//
// Pure by construction: criteria and observations in, statuses out. No spine read, no file read, no
// clock. A render must emit ZERO events (ADR-1000) and must be identical on a replayed derived
// state; the cheapest way to guarantee both is a module that has nothing to emit with and no
// hidden input to disagree about.
//
// The two v1 criteria approach their lines from OPPOSITE directions -- `days_without_revenue` is a
// ceiling climbed toward from below, `traffic_floor_monthly` is a floor sunk toward from above --
// so every comparison here is written once per POLARITY and the polarity is read from a table
// rather than from the criterion's name. A third criterion must be a row, never a new branch: an
// `if (name === ...)` scattered across four functions is how one of the four gets missed.
//
// Every threshold comparison is integer cross-multiplication. `value / threshold >= 0.8` is not the
// same predicate on every platform once the division is inexact, and a kill switch whose warning
// band is decided by the last bit of a double is a kill switch that fires on one CI leg and not the
// other two.

import { SpineError } from "../canonical.mjs";
// The criterion vocabulary has ONE owner -- the schema that decides what a file may declare.
// See the drift assertion below POLARITY for why this import exists at all.
import { KILL_CRITERIA } from "./ventures.mjs";

// The warning band as one exact fraction (80%). Named once so the 80 in the ceiling branch and the
// 80 in the floor branch cannot drift apart in a later edit -- they are the same policy, and a
// literal repeated in two branches is two policies that currently agree.
export const WARN_NUMERATOR = 80;
export const WARN_DENOMINATOR = 100;

// Cross-multiplication is exact only while the product stays inside the double's integer range.
// Past this ceiling `value * WARN_DENOMINATOR` rounds, and the band would then be decided by a
// rounding artifact instead of by the numbers -- silently, and only on absurd inputs, which is the
// worst possible place for a quietly wrong answer. Refused rather than approximated.
export const MAX_OBSERVATION = Math.floor(Number.MAX_SAFE_INTEGER / WARN_DENOMINATOR);

export const CEILING = "ceiling";
export const FLOOR = "floor";

// Exactly four statuses, exported as ONE frozen object rather than four bare names: money.mjs
// already exports an `ABSENT` (the em-dash it renders), and two different ABSENTs in one renderer's
// import list is a bug waiting for a busy afternoon.
export const STATUS = Object.freeze({
  CROSSED: "CROSSED",
  WARNING: "WARNING",
  OK: "OK",
  ABSENT: "ABSENT",
});

// Severity ranking for `worst`. ABSENT is deliberately NOT ranked -- it is not a degree of danger,
// it is the absence of an answer, and folding it into this scale is exactly how it would come to
// mean "safe" or "crossed" by accident.
export const SEVERITY = Object.freeze({ [STATUS.OK]: 0, [STATUS.WARNING]: 1, [STATUS.CROSSED]: 2 });

// The criterion table. `absentReason` is the KNOWN reason a null observation arrives for that
// criterion in this lane, and it is part of the caller contract: a caller passes null for
// `days_without_revenue` only when the venture has never had a revenue event, never as a shorthand
// for "did not compute it". v1 ships exactly these two (ADR-1008).
export const POLARITY = Object.freeze({
  days_without_revenue: Object.freeze({
    polarity: CEILING,
    unit: "days",
    // NOT 0 and NOT infinity. Zero days reads as "revenue today", the healthiest possible venture,
    // for the venture that has never earned a rupee; infinity reads as already-dead and buries a
    // real crossing under a false one. Ledger does not know a venture's start date -- only its
    // revenue events -- so with no revenue event the clock genuinely has no zero to count from.
    absentReason: "this venture has no revenue event on the spine, and ledger does not know its start date -- the days-without-revenue clock has no zero to count from",
  }),
  traffic_floor_monthly: Object.freeze({
    polarity: FLOOR,
    unit: "visits/month",
    // Structural, not incidental: it is ABSENT for every venture on every render until some lane
    // supplies traffic. Rendering it as OK would silently disable half the kill switch on day one.
    absentReason: "ledger has no traffic data source in this lane -- ledger knows money, and nothing on the spine counts visits",
  }),
});

// Code-unit order, never localeCompare: the rendered P&L is compared byte-for-byte across three CI
// legs, and localeCompare is machine-dependent (canonical.mjs refuses it for the same reason).
function byName(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

// ONE VOCABULARY, ASSERTED RATHER THAN TRUSTED.
//
// `KILL_CRITERIA` in ventures.mjs is the SCHEMA's list of criteria a file may declare; POLARITY
// above is the list this module can EVALUATE. Two hand-maintained lists of the same names is
// exactly the twin-fix shape this lane has already hit twice (retro 2026-08-03, and again a phase
// later in lineage.mjs), and both drift directions fail quietly: a criterion in the schema only
// parses fine and is never evaluated -- a declared kill line nobody watches -- while a criterion
// here only can never be spelled in the file that is supposed to arm it.
//
// Checked at module LOAD, so drift is an import failure on every CI leg the moment it lands,
// rather than a row missing from a render nobody diffs. A third criterion adds one row in each
// place and this assertion is what makes forgetting the second one impossible.
{
  const declared = [...KILL_CRITERIA].sort(byName).join(",");
  const evaluable = Object.keys(POLARITY).sort(byName).join(",");
  if (declared !== evaluable)
    throw new SpineError("BAD_LEDGER_KILL",
      `kill-criterion vocabularies have DRIFTED: ventures.mjs declares [${declared}] but kill-distance.mjs can evaluate [${evaluable}] -- these are one vocabulary in two files and must match exactly`);
}

// Own-property reads only. `observations["constructor"]` on a plain object literal returns a
// function, so a venture or criterion named after an Object.prototype member would otherwise come
// back "observed" with a value that was never recorded anywhere.
function own(obj, key) {
  if (obj === null || obj === undefined) return undefined;
  return Object.prototype.hasOwnProperty.call(obj, key) ? obj[key] : undefined;
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

// JSON.stringify renders NaN and Infinity as `null`, and `null` is the ONE value in this module
// that already means ABSENT. A refusal message claiming a null observation, when what actually
// arrived was NaN, sends the reader to the wrong file with the wrong theory.
function describe(value) {
  return typeof value === "number" && !Number.isFinite(value) ? String(value) : JSON.stringify(value);
}

function criterionRow(criterion) {
  if (typeof criterion !== "string" || !Object.prototype.hasOwnProperty.call(POLARITY, criterion))
    throw new SpineError("BAD_LEDGER_KILL", `kill criterion ${JSON.stringify(criterion)} has no polarity row -- v1 ships exactly ${Object.keys(POLARITY).sort(byName).join(" and ")} (ADR-1008), and a criterion nothing can evaluate is a kill line nobody is watching`);
  return POLARITY[criterion];
}

// A threshold of 0 is refused on BOTH polarities instead of evaluated, because it is the most
// likely parse of an empty or truncated YAML value and it means the opposite wrong thing on each
// side: on a ceiling `value >= 0` marks every venture CROSSED from birth (an alarm that fires on
// everything gets muted within a day), and on a floor `value <= 0` is a line only a venture with
// exactly zero traffic can ever cross (a disabled kill switch spelled as a number). Negatives are
// refused for the same reason. Neither is a line a human drew.
function checkThreshold(criterion, threshold) {
  if (!Number.isSafeInteger(threshold) || threshold < 1)
    throw new SpineError("BAD_LEDGER_KILL", `kill.${criterion} threshold ${describe(threshold)} must be an integer of at least 1 -- 0 marks every venture crossed on a ceiling and can never fire on a floor`);
  if (threshold > MAX_OBSERVATION)
    throw new SpineError("BAD_LEDGER_KILL", `kill.${criterion} threshold ${threshold} is above ${MAX_OBSERVATION}, past which the warning band would be decided by integer rounding`);
}

// A negative observation is REFUSED, never clamped. Clamping invents a fact: -3 days clamped to 0
// reads as "earned revenue today" on a ceiling, and a negative visit count clamped to 0 reads as
// CROSSED on a floor. Both are upstream arithmetic bugs, and the kill meter is the last surface
// that should paper one over. A non-integer is refused for the same reason money is (ADR-1012).
function checkValue(criterion, value) {
  if (!Number.isSafeInteger(value) || value < 0)
    throw new SpineError("BAD_LEDGER_KILL", `observation ${criterion} = ${describe(value)} must be a non-negative integer -- a negative observation is an upstream bug, and clamping it would render as perfect health`);
  if (value > MAX_OBSERVATION)
    throw new SpineError("BAD_LEDGER_KILL", `observation ${criterion} = ${value} is above ${MAX_OBSERVATION}, past which the warning band would be decided by integer rounding`);
}

function absent(criterion, threshold, reason) {
  return { criterion, status: STATUS.ABSENT, threshold, value: null, distance: null, reason };
}

/**
 * criterion -- a key of POLARITY
 * threshold -- the declared line; null/undefined means this venture declares no such line
 * value     -- the observation; null/undefined means ABSENT (see the table's absentReason)
 *
 * Returns { criterion, status, threshold, value, distance, reason }. `distance` is SIGNED and
 * carries the criterion's own unit on both polarities: positive is still short of the line,
 * zero or negative is at or past it. That invariant is what lets a renderer print
 * "31 days to the line" without knowing which direction the line is approached from.
 * `reason` is null unless the status is ABSENT, where it is mandatory.
 */
export function evaluateCriterion({ criterion, threshold, value }) {
  const row = criterionRow(criterion);

  // The threshold is validated BEFORE absence is considered, on purpose: `traffic_floor_monthly` is
  // absent on every render in this lane, so a malformed traffic threshold would otherwise never be
  // looked at by anything, ever.
  const declared = threshold !== null && threshold !== undefined;
  if (declared) checkThreshold(criterion, threshold);
  const line = declared ? threshold : null;

  // An undeclared line is its own absence, not a pass. Returning OK here would mean a venture whose
  // criteria block lost a key renders as healthy against a line that no longer exists.
  if (!declared)
    return absent(criterion, null, `no ${criterion} line is declared for this venture in ventures.yaml -- there is no line to measure a distance to`);

  if (value === null || value === undefined) return absent(criterion, line, row.absentReason);
  checkValue(criterion, value);

  let crossed;
  let warning;
  let distance;
  if (row.polarity === CEILING) {
    // Ceiling: climbed toward from below, crossed AT the line. progress = value / threshold,
    // cross-multiplied so no division is ever performed.
    crossed = value >= line;
    warning = value * WARN_DENOMINATOR >= WARN_NUMERATOR * line;
    distance = line - value;
  } else if (row.polarity === FLOOR) {
    // Floor: sunk toward from above, crossed AT the line. progress = threshold / value, and
    // value === 0 is precisely where that naive form divides by zero. Cross-multiplied there is no
    // division to protect: the crossing test is `0 <= threshold`, which is true, which is the right
    // answer -- no traffic at all is under every positive floor.
    crossed = value <= line;
    warning = line * WARN_DENOMINATOR >= WARN_NUMERATOR * value;
    distance = value - line;
  } else {
    // Unreachable while POLARITY is the only source of polarities, which is the point: this is the
    // guard that makes "a third criterion is one new row" true rather than merely intended.
    throw new SpineError("BAD_LEDGER_KILL", `criterion ${criterion} has polarity ${JSON.stringify(row.polarity)}, which is neither ${CEILING} nor ${FLOOR}`);
  }

  // Crossing is tested first and wins: at 100% of the way to the line both predicates are true, and
  // reporting that as a warning would under-report the one status that needs a human.
  const status = crossed ? STATUS.CROSSED : warning ? STATUS.WARNING : STATUS.OK;
  return { criterion, status, threshold: line, value, distance, reason: null };
}

/**
 * venture      -- the venture name
 * kill         -- that venture's `kill:` block from ventures.yaml (Appendix B); null means no lines
 * observations -- the WHOLE map, venture -> { <criterion>: int|null }. A venture missing from it is
 *                not an error: every criterion is simply ABSENT for it.
 *
 * Returns { venture, criteria, worst, absentCount }. `criteria` covers every criterion in POLARITY,
 * sorted by name, so the row set is identical for every venture on every render -- a criterion that
 * cannot be evaluated stays visible instead of vanishing from the output.
 */
export function evaluateVenture({ venture, kill, observations }) {
  if (typeof venture !== "string" || venture === "")
    throw new SpineError("BAD_LEDGER_KILL", `venture ${JSON.stringify(venture)} must be a non-empty string`);
  if (kill !== null && kill !== undefined && !isPlainObject(kill))
    throw new SpineError("BAD_LEDGER_KILL", `venture ${venture}: kill must be an object of criterion thresholds`);
  if (observations !== null && observations !== undefined && !isPlainObject(observations))
    throw new SpineError("BAD_LEDGER_KILL", "observations must be an object keyed by venture");

  const obs = own(observations, venture);
  if (obs !== undefined && !isPlainObject(obs))
    throw new SpineError("BAD_LEDGER_KILL", `venture ${venture}: observations entry must be an object of criterion values`);

  // Unknown keys on either side are refused rather than skipped. A `kill:` entry no evaluator knows
  // is a line the owner believes is being watched and is not; an observation key that matches
  // nothing is almost always a misspelling of one that does.
  for (const key of Object.keys(kill || {})) criterionRow(key);
  for (const key of Object.keys(obs || {})) criterionRow(key);

  const criteria = Object.keys(POLARITY)
    .sort(byName)
    .map((criterion) =>
      evaluateCriterion({ criterion, threshold: own(kill, criterion), value: own(obs, criterion) })
    );

  // ABSENT is counted, never dropped, so a caller can render "2 criteria could not be evaluated"
  // instead of showing a shorter, healthier-looking list than the one that was asked for.
  const absentCount = criteria.filter((c) => c.status === STATUS.ABSENT).length;
  let worst = null;
  for (const c of criteria) {
    if (c.status === STATUS.ABSENT) continue;
    if (worst === null || SEVERITY[c.status] > SEVERITY[worst]) worst = c.status;
  }
  return { venture, criteria, worst, absentCount };
}

/**
 * ventures     -- the ventures.yaml map, venture -> { kill: {...} } (Appendix B)
 * observations -- venture -> { <criterion>: int|null }
 *
 * Returns one evaluateVenture shape per venture, sorted by venture name.
 */
export function evaluateAll({ ventures, observations }) {
  if (!isPlainObject(ventures))
    throw new SpineError("BAD_LEDGER_KILL", "ventures must be an object keyed by venture name");
  // Observations for a venture ventures.yaml does not declare are ignored: ventures.yaml is the
  // authority on which ventures exist (Appendix B), and letting a stray observation mint a row
  // would put a venture on the board that no receipted file ever named.
  return Object.keys(ventures)
    .sort(byName)
    .map((venture) => {
      const entry = ventures[venture];
      if (entry !== null && entry !== undefined && !isPlainObject(entry))
        throw new SpineError("BAD_LEDGER_KILL", `venture ${venture} must be an object with a kill block`);
      return evaluateVenture({ venture, kill: own(entry, "kill"), observations });
    });
}
