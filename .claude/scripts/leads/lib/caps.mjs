// caps.mjs — config with hard ceilings, IST day bucketing, and the rolling touch window
// (ADR-0403).
//
// Values live in config; ENFORCEMENT lives in code; ceilings sit above config. Config can
// LOWER a limit and can never raise one past its ceiling. That asymmetry is the whole
// ask-to-exceed defence: "just bump the number in the JSON" has to fail, or the cap is a
// suggestion.
//
// Two things here look like details and are not:
//
//   1. The daily cap buckets by the JOURNAL INTENT's `submitted_at`, never by the spine emit
//      time. ADR-0411 can emit a recovery receipt arbitrarily later, so a receipt written at
//      00:10 would otherwise move a 23:55 send onto the next IST day and free a slot on BOTH.
//   2. The touch window is ROLLING, not a calendar week. A calendar week lets two touches
//      land Sunday and Monday and calls it two weeks.

import { existsSync, readFileSync } from "node:fs";

export const DEFAULTS = Object.freeze({
  per_ist_day: 20,
  touches_per_lead: 2,
  rolling_window_days: 7,
  send_window_ist: { days: [1, 2, 3, 4, 5], start: "09:30", end: "18:00" },
});

// Hard ceilings. Config may never exceed these, whatever it says.
export const CEILINGS = Object.freeze({
  per_ist_day: 20,
  touches_per_lead: 2,
  rolling_window_days: 31,
});

export class CapError extends Error {
  constructor(code, message) { super(message); this.name = "CapError"; this.code = code; }
}

export function loadCaps(path = process.env.LEADS_CONFIG || ".claude/config/leads.json") {
  const cfg = existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : {};
  const caps = { ...DEFAULTS, ...(cfg.caps || {}) };

  // The ask-to-exceed refusal. Note it fires on the CONFIG, before any send is attempted:
  // a raised value must be an error the operator sees now, not a limit that silently
  // clamps and lets them believe the higher number took effect.
  for (const key of Object.keys(CEILINGS)) {
    const v = Number(caps[key]);
    if (!Number.isFinite(v) || v < 0)
      throw new CapError("BAD_CAP", `caps.${key} must be a non-negative number (got ${JSON.stringify(caps[key])})`);
    if (v > CEILINGS[key])
      throw new CapError(
        "CAP_ABOVE_CEILING",
        `caps.${key} = ${v} exceeds the hard ceiling of ${CEILINGS[key]}. Config can LOWER a cap and can never raise one past its ceiling (ADR-0403) — ` +
          `raising it requires an ADR, not an edit. This is the ask-to-exceed class and it refuses by design.`
      );
    caps[key] = v;
  }
  return caps;
}

// Env and CLI overrides are refused outright rather than merged. A cap that can be raised by
// an env var for "just this once" is not a cap, and "just this once" is how every ceiling
// ends. There is deliberately no flag that reaches this function.
export function assertNoCapOverrides(env = process.env, argv = process.argv) {
  for (const k of Object.keys(env))
    if (/^LEADS_(CAP|MAX|LIMIT)_/i.test(k))
      throw new CapError("CAP_OVERRIDE_REFUSED", `environment variable ${k} attempts to override a cap — caps are code, not environment (ADR-0403)`);
  for (const a of argv)
    if (/^--(cap|max-per-day|force|ignore-cap|no-cap)\b/i.test(a))
      throw new CapError("CAP_OVERRIDE_REFUSED", `flag ${a} attempts to bypass a cap — there is no such flag, by design (ADR-0403)`);
}

// ---------- IST bucketing ----------
//
// `submitted_at` already carries +05:30 (the house grammar), so the IST date is the first ten
// characters. No timezone library, no conversion, no chance of a DST-style off-by-one --
// which is exactly why the payload grammar was pinned to +05:30 rather than UTC-Z.
export function istDay(ts) {
  const day = String(ts).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day))
    throw new CapError("BAD_TS", `cannot derive an IST day from ${JSON.stringify(ts)}`);
  return day;
}

const minutesOf = (hhmm) => {
  const m = /^(\d{2}):(\d{2})$/.exec(String(hhmm));
  if (!m) throw new CapError("BAD_WINDOW", `send window bound ${JSON.stringify(hhmm)} must be HH:MM`);
  return Number(m[1]) * 60 + Number(m[2]);
};

export function inSendWindow(ts, window = DEFAULTS.send_window_ist) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(String(ts));
  if (!m) throw new CapError("BAD_TS", `cannot read a send time from ${JSON.stringify(ts)}`);
  // Date.UTC on the IST wall-clock date gives the correct weekday without a timezone shift:
  // the date part is already local, so treating it as UTC only for day-of-week is exact.
  const dow = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).getUTCDay();
  if (!window.days.includes(dow)) return false;
  const mins = Number(m[4]) * 60 + Number(m[5]);
  return mins >= minutesOf(window.start) && mins < minutesOf(window.end);
}

// A touch counts against a lead if it landed within the rolling window ENDING at `now`.
// Inclusive of the boundary: a touch exactly 7 days ago still counts, because the honest
// reading of "2 touches in any 7-day window" is that the window is closed.
export function withinRollingWindow(touchTs, nowTs, days) {
  const a = Date.parse(touchTs), b = Date.parse(nowTs);
  if (!Number.isFinite(a) || !Number.isFinite(b)) throw new CapError("BAD_TS", "unparseable timestamp in the rolling-window check");
  return b - a <= days * 24 * 60 * 60 * 1000 && b >= a;
}
