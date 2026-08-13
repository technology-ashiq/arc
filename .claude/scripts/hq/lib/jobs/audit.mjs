/**
 * audit.mjs -- the proving week's instrument, and it is being written BEFORE the week has any
 * data in it.
 *
 * That ordering is the point. A measurement built after looking at the results can be tuned,
 * without anyone intending to, into one that flatters them: a threshold nudged here, a category
 * widened there, an awkward slot reclassified as "expected". The phase spec names this rabbit
 * hole outright ("grading the week on vibes") and answers it by pre-declaring the metric pack in
 * the PLAN. Writing the code blind is the strongest available form of that promise -- there is no
 * data yet to tune against.
 *
 * IT IS A DERIVATION, NOT A STATUS READ. `Date.now()` is absent rather than discouraged: the
 * window is `[from, to]` and comes from the caller, so the same spine and the same range produce
 * byte-identical output forever. That is what makes the metric pack re-checkable by anyone later,
 * instead of a number someone once saw.
 *
 * WHAT IT REFUSES TO DO. It never asks the OS anything. "Was the task registered" is not a
 * question the spine can answer, and mixing a live OS read into a replayable derivation would
 * make the same command return different answers on different days -- exactly the property the
 * panel gave up `Date.now()` to avoid. The fire-drill is therefore visible here as SILENCE, which
 * is the honest shape: a job whose OS task was removed emits nothing at all.
 *
 * Zero dependencies, Node 18+.
 */

import { parseCadence, slotsBetween, slotMs, istDay } from "./cadence.mjs";

/** Every incident class the wrapper can raise. Pinned so a NEW class cannot land uncounted. */
export const INCIDENT_CLASSES = Object.freeze([
  "policy-declined",
  "overlap",
  "receipt-write-failure",
  "timeout",
  "crash",
]);

const isDay = (d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d));

/** The end of the named day in IST, matching the panel's cut exactly. */
const endOfDay = (day) => slotMs(day, 23, 59) + 59_000;

/**
 * The median, stated as a rule rather than left to a library.
 *
 * Even-length lists take the LOWER of the two middles, not their mean. Drift is measured in whole
 * milliseconds against a wall clock; inventing a value that no run actually had would put a
 * number in the metric pack that no receipt can be pointed at, and every figure in this pack has
 * to be traceable to a line on the spine.
 */
export function medianLower(values) {
  const xs = [...values].filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (!xs.length) return null;
  return xs[Math.ceil(xs.length / 2) - 1];
}

/** The event out of whatever wrapper shape the spine reader hands back. */
const unwrap = (w) => (w && w.event ? w.event : w);

/**
 * The audit for one window.
 *
 * `events` must be every event the spine holds -- the caller does NOT pre-filter by date, because
 * this needs to see runs on both sides of the window to tell "no run yet" from "ran outside the
 * range".
 */
export function deriveAudit({ from, to, jobs, events, observedFrom = null }) {
  if (!isDay(from) || !isDay(to))
    throw new Error(`audit: window must be two YYYY-MM-DD days, got ${JSON.stringify(from)}..${JSON.stringify(to)}`);
  if (from > to)
    throw new Error(`audit: window ${from}..${to} runs backwards -- refusing rather than returning an empty pack`);

  const fromMs = slotMs(from, 0, 0);
  const toMs = endOfDay(to);

  // Everything in the window, bucketed once. Two passes over the same list would be two chances
  // to disagree about what "in the window" means.
  // THE WINDOW IS CUT ON THE IST DAY, PARSED -- never on `ts.slice(0, 10)`.
  //
  // Slots live in IST and this window is a range of IST days, so cutting on the leading ten
  // characters of the timestamp only works while every producer happens to render IST. A receipt
  // stamped in UTC puts `2026-08-03T00:15+05:30` on `2026-08-02`, which drops it out of the
  // window entirely -- and a dropped run does not read as an error, it reads as a MISSED SLOT.
  // The instrument would report a failure that never happened, on the very first slot of every
  // window. Found by this module's own fixture before any real data existed, which is the whole
  // argument for building the instrument blind.
  const inWindow = [];
  for (const w of events || []) {
    const e = unwrap(w);
    if (!e || typeof e.ts !== "string") continue;
    const at = Date.parse(e.ts);
    if (!Number.isFinite(at)) continue;
    const d = istDay(at);
    if (d < from || d > to) continue;
    inWindow.push(e);
  }

  const runs = inWindow.filter((e) => e.kind === "run.completed" && e.payload && e.payload.job);
  const incidents = inWindow.filter((e) => e.kind === "incident.raised" && e.payload && e.payload.job);
  const notes = inWindow.filter((e) => e.kind === "note.logged" && e.payload && e.payload.job);

  const perJob = [];
  for (const job of jobs || []) {
    const name = String(job.name);
    const cadence = parseCadence(job.cadence);
    const row = {
      name,
      cadence: String(job.cadence ?? ""),
      enabled: job.enabled === true,
      expected: 0,
      completed: 0,
      failed: 0,
      unexplainedGaps: [],
      explainedGaps: [],
      unscheduledRuns: [],
      manualStarts: [],
      driftMs: [],
      driftP50Ms: null,
    };

    if (!cadence) {
      // An unreadable cadence cannot be audited, and reporting zero expected slots for it would
      // read as a clean week. jobs-lint refuses this at commit time; if one reaches here the
      // audit says so instead of scoring it.
      row.unreadableCadence = true;
      perJob.push(row);
      continue;
    }

    const mine = runs.filter((e) => e.payload.job === name);
    const myIncidents = incidents.filter((e) => e.payload.job === name);
    const myNotes = notes.filter((e) => e.payload.job === name);

    for (const e of mine) {
      if (e.outcome === "ok") row.completed++; else row.failed++;
      // A job has TWO legitimate actors: `scheduler:<name>` when the OS fired it, and the session
      // actor when a human did. REQ-06 is "zero manual starts", so the second kind is counted
      // rather than filtered -- and counted by actor, which is the only field that distinguishes
      // them. Matching on anything else would make the claim unfalsifiable.
      if (String(e.actor || "") !== `scheduler:${name}`)
        row.manualStarts.push({ ts: e.ts, actor: e.actor ?? null, slot: e.payload.scheduled_for ?? null });
    }

    // DISABLED JOBS EXPECT NOTHING, and that is a statement rather than a zero. A deliberate off
    // and a job with a clean week are different facts; scoring them identically is how a
    // deliberate off starts reading as health.
    const expectedSlots = row.enabled ? slotsBetween(cadence, fromMs, toMs) : [];
    row.expected = expectedSlots.length;

    // Slot -> the receipts that claim it. `scheduled_for` is what the wrapper writes, so this is
    // an exact string match rather than a time-window guess: a run that claims a slot names it.
    const bySlot = new Map();
    for (const e of mine) {
      const s = e.payload.scheduled_for;
      if (typeof s !== "string") continue;
      if (!bySlot.has(s)) bySlot.set(s, []);
      bySlot.get(s).push(e);
    }
    const explainedFor = new Set([
      ...myIncidents.map((e) => e.payload.scheduled_for).filter((s) => typeof s === "string"),
      ...myNotes.map((e) => e.payload.scheduled_for).filter((s) => typeof s === "string"),
    ]);

    const expectedIso = new Set();
    for (const t of expectedSlots) {
      const iso = isoSlot(t);
      expectedIso.add(iso);
      const served = bySlot.get(iso) || [];
      if (served.some((e) => e.outcome === "ok")) {
        for (const e of served) {
          const started = Date.parse(String(e.payload.started_at ?? ""));
          if (Number.isFinite(started)) row.driftMs.push(started - t);
        }
        continue;
      }
      // A slot with a failed run is NOT a gap: something ran and said so. A slot with an incident
      // or a skip note is an EXPLAINED absence, which is the phase spec's own wording. Anything
      // else is the silence this whole cycle exists to make visible.
      if (served.length) { row.explainedGaps.push({ slot: iso, why: "a run reported failure" }); continue; }
      if (explainedFor.has(iso)) { row.explainedGaps.push({ slot: iso, why: "an incident or skip note names this slot" }); continue; }
      row.unexplainedGaps.push(iso);
    }

    // A run whose slot is not an expected one is REPORTED, never discarded. Catch-ups and
    // attended runs land here legitimately; so would a task firing on a schedule nobody wrote,
    // and dropping the category would hide the second inside the first.
    for (const [iso, served] of bySlot)
      if (!expectedIso.has(iso)) row.unscheduledRuns.push({ slot: iso, count: served.length });

    row.driftP50Ms = medianLower(row.driftMs);
    perJob.push(row);
  }

  const incidentsByClass = {};
  for (const c of INCIDENT_CLASSES) incidentsByClass[c] = 0;
  const unknownClasses = {};
  for (const e of incidents) {
    const c = String(e.payload.class ?? "");
    if (Object.prototype.hasOwnProperty.call(incidentsByClass, c)) incidentsByClass[c]++;
    // AN UNRECOGNISED CLASS IS COUNTED SEPARATELY, never folded into a bucket or dropped. A new
    // incident class landing silently in a pack that reads "0 incidents" is the metric telling
    // the opposite of the truth.
    else unknownClasses[c] = (unknownClasses[c] || 0) + 1;
  }

  // Money. Expected to be exactly zero: spend-carrying kinds are unschedulable by jobs-lint on
  // top of policy's own money law, so any figure here is a finding rather than a number.
  let spendInr = 0;
  for (const e of inWindow) {
    const c = e.cost;
    if (c && Number.isFinite(Number(c.inr))) spendInr += Number(c.inr);
  }

  const totals = {
    windowDays: Math.round((slotMs(to, 0, 0) - slotMs(from, 0, 0)) / 86_400_000) + 1,
    expected: perJob.reduce((n, r) => n + r.expected, 0),
    completed: perJob.reduce((n, r) => n + r.completed, 0),
    failed: perJob.reduce((n, r) => n + r.failed, 0),
    unexplainedGaps: perJob.reduce((n, r) => n + r.unexplainedGaps.length, 0),
    explainedGaps: perJob.reduce((n, r) => n + r.explainedGaps.length, 0),
    manualStarts: perJob.reduce((n, r) => n + r.manualStarts.length, 0),
    unscheduledRuns: perJob.reduce((n, r) => n + r.unscheduledRuns.length, 0),
    driftP50Ms: medianLower(perJob.flatMap((r) => r.driftMs)),
    incidentsByClass,
    unknownIncidentClasses: unknownClasses,
    spendInr,
    observedFrom,
  };

  return { window: { from, to }, perJob, totals };
}

/**
 * The slot instant as the wrapper writes it into `scheduled_for`.
 *
 * Built from the IST day and the slot's own hour and minute rather than from `toISOString`, which
 * would render UTC and never match a receipt. The two must agree exactly, because the gap audit
 * is a STRING match: a formatting difference here would report every served slot as an
 * unexplained gap and every run as unscheduled -- a total inversion that still looks like a
 * report.
 */
export function isoSlot(ms) {
  const day = istDay(ms);
  const mins = Math.round((ms - slotMs(day, 0, 0)) / 60_000);
  const hh = String(Math.floor(mins / 60)).padStart(2, "0");
  const mm = String(mins % 60).padStart(2, "0");
  return `${day}T${hh}:${mm}:00+05:30`;
}

/**
 * The needs-you history: which days the panel WOULD have shown a line, replayed day by day.
 *
 * The brief's needs-you lines are derived rather than emitted, so there is no receipt to count.
 * What makes this answerable at all is that `derivePanel` is pure and its `--date D` is a replay:
 * running it once per day of the window reconstructs exactly what the panel said on each of those
 * days, from today's spine, without anyone having had to watch.
 *
 * The fire-drill has to appear here as at least one true positive. It cannot be faked into
 * appearing: removing a job's OS task makes it emit nothing, and silence is the only input this
 * derivation has.
 */
export function needsYouHistory({ from, to, jobs, events, observedFrom, derivePanel }) {
  if (typeof derivePanel !== "function")
    throw new Error("audit: needsYouHistory needs derivePanel injected -- it will not import a renderer to reason about one");
  const days = [];
  let cursor = from;
  let guard = 0;
  while (cursor <= to && guard++ < 400) {
    const upTo = endOfDay(cursor);
    const visible = (events || [])
      .map(unwrap)
      .filter((e) => e && typeof e.ts === "string" && Date.parse(e.ts) <= upTo);
    const rows = derivePanel({ day: cursor, jobs, events: visible, observedFrom });
    const overdue = rows.filter((r) => r.overdue).map((r) => ({ name: r.name, missed: r.missed }));
    if (overdue.length) days.push({ day: cursor, overdue });
    cursor = istDay(slotMs(cursor, 12, 0) + 86_400_000);
  }
  if (guard >= 400)
    throw new Error("audit: needs-you replay walked past 400 days -- refusing to report a truncated history as a complete one");
  return days;
}
