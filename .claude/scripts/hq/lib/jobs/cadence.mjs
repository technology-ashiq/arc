/**
 * cadence.mjs -- the closed cadence grammar and every slot computation derived from it.
 *
 * SCH-B freezes the grammar at two forms, `daily@HH:MM` and `weekdays@HH:MM`, both IST. Full
 * cron is rejected by name: it is a parser-class surface for zero v1 need, and the spine's own
 * timestamps are +05:30 by schema, so there is no timezone knob to misconfigure.
 *
 * EVERY conversion between a slot and an epoch goes through canonical.mjs's `formatIst`, or
 * through a `+05:30` string this module builds and hands to Date.parse. There is deliberately
 * no offset constant here. A second copy of "IST is 330 minutes" is a second thing to get
 * wrong, and the failure it produces is the worst kind: a `daily@00:15` slot computed against
 * a UTC system clock lands on the WRONG DATE, so the idem key `job@slot` names a slot that
 * never existed and the receipt is unmatchable forever after. That hazard is on the plan's
 * assumptions ledger and it is answered here, once.
 *
 * Zero dependencies, Node 18+.
 */

import { formatIst, dayOf } from "../canonical.mjs";

/** `daily@HH:MM` | `weekdays@HH:MM`. Anchored: a trailing anything is a different string. */
const CADENCE_RE = /^(daily|weekdays)@([0-9]{2}):([0-9]{2})$/;

export const CADENCE_KINDS = Object.freeze(["daily", "weekdays"]);

/**
 * Parse a cadence, or return null. Null is the ONLY failure mode -- callers decide whether an
 * unparseable cadence is a lint failure or a skip, and neither wants an exception here.
 *
 * The hour/minute range check is part of parsing, not a later validation step: `daily@25:00`
 * matches the shape and is not a time, and letting it through to be range-checked somewhere
 * else is how a two-stage validator ends up with a stage nobody calls.
 */
export function parseCadence(text) {
  if (typeof text !== "string") return null;
  const m = CADENCE_RE.exec(text);
  if (!m) return null;
  const hh = Number(m[2]);
  const mm = Number(m[3]);
  if (!Number.isInteger(hh) || hh < 0 || hh > 23) return null;
  if (!Number.isInteger(mm) || mm < 0 || mm > 59) return null;
  return { kind: m[1], hh, mm, text };
}

/** `YYYY-MM-DD` + HH:MM in IST -> epoch ms. Built as a `+05:30` string on purpose (see header). */
export function slotMs(day, hh, mm) {
  const p = (n) => String(n).padStart(2, "0");
  const ms = Date.parse(`${day}T${p(hh)}:${p(mm)}:00+05:30`);
  if (!Number.isFinite(ms)) throw new Error(`cadence: ${day} is not a date this slot can sit on`);
  return ms;
}

/** The IST calendar day a moment falls in -- never the host's local day. */
export function istDay(ms) {
  return dayOf(formatIst(ms));
}

/**
 * IST day-of-week, 0=Sunday. Derived from the IST day string rather than from the raw epoch,
 * so a host running in UTC-8 cannot make Monday 00:15 IST look like Sunday.
 */
export function istWeekday(ms) {
  const [y, mo, d] = istDay(ms).split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1, d)).getUTCDay();
}

/** Does this cadence fire on this IST day at all? weekdays = Mon..Fri. */
export function firesOnDay(cadence, day) {
  if (cadence.kind === "daily") return true;
  const [y, mo, d] = day.split("-").map(Number);
  const dow = new Date(Date.UTC(y, mo - 1, d)).getUTCDay();
  return dow >= 1 && dow <= 5;
}

/** The canonical slot identity written into receipts and into the idem key. */
export function slotId(cadence, ms) {
  return formatIst(ms);
}

/** Shift an IST day string by N days. Pure calendar arithmetic, no DST anywhere in IST. */
function addDays(day, n) {
  const [y, mo, d] = day.split("-").map(Number);
  const t = Date.UTC(y, mo - 1, d) + n * 86_400_000;
  const dt = new Date(t);
  const p = (x) => String(x).padStart(2, "0");
  return `${dt.getUTCFullYear()}-${p(dt.getUTCMonth() + 1)}-${p(dt.getUTCDate())}`;
}

/**
 * The most recent slot at or before `ms`, or null when the cadence has never fired by then.
 *
 * Walks back at most 8 days, which covers the worst `weekdays` case (a Sunday afternoon looks
 * back to Friday) with margin. Bounded on purpose: an unbounded search over a corrupt cadence
 * is a hang, and a hang inside a scheduled job is invisible until someone reads the brief.
 */
export function floorSlot(cadence, ms) {
  let day = istDay(ms);
  for (let back = 0; back <= 8; back++) {
    const candidate = back === 0 ? day : addDays(day, -back);
    if (!firesOnDay(cadence, candidate)) continue;
    const t = slotMs(candidate, cadence.hh, cadence.mm);
    if (t <= ms) return t;
  }
  return null;
}

/** The next slot strictly after `ms`. Same bounded walk, forwards. */
export function nextSlot(cadence, ms) {
  const day = istDay(ms);
  for (let ahead = 0; ahead <= 8; ahead++) {
    const candidate = ahead === 0 ? day : addDays(day, ahead);
    if (!firesOnDay(cadence, candidate)) continue;
    const t = slotMs(candidate, cadence.hh, cadence.mm);
    if (t > ms) return t;
  }
  return null;
}

/** The next `count` slots after `ms`, for `arc-jobs list --next N`. */
export function nextSlots(cadence, ms, count) {
  const out = [];
  let cursor = ms;
  for (let i = 0; i < count; i++) {
    const t = nextSlot(cadence, cursor);
    if (t === null) break;
    out.push(t);
    cursor = t;
  }
  return out;
}

/**
 * Every slot in [fromMs, toMs], oldest first. The gap audit and the overdue derivation both
 * need "what SHOULD have run", which silence cannot tell them.
 */
export function slotsBetween(cadence, fromMs, toMs) {
  const out = [];
  if (!(fromMs <= toMs)) return out;
  let day = istDay(fromMs);
  const lastDay = istDay(toMs);
  for (let guard = 0; guard <= 4000; guard++) {
    if (firesOnDay(cadence, day)) {
      const t = slotMs(day, cadence.hh, cadence.mm);
      if (t >= fromMs && t <= toMs) out.push(t);
    }
    if (day === lastDay) break;
    day = addDays(day, 1);
  }
  return out;
}

/**
 * The nominal gap between consecutive fires, in ms -- the unit SCH-F's "overdue > 2x cadence"
 * is measured in. `weekdays` uses one day rather than the real 3-day weekend gap: taking the
 * weekend as the cadence would make a job that died on Monday look healthy until Thursday.
 */
export function cadenceIntervalMs(cadence) {
  return 86_400_000;
}
