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
import { istDayOf, outcomeOf } from "./panel.mjs";

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
  // THE WINDOW IS CUT ON THE PARSED IST DAY, shared with the panel via `istDayOf`.
  //
  // Slots live in IST and this window is a range of IST days, so cutting on the leading ten
  // characters of a timestamp only works while every producer happens to render IST. A receipt
  // stamped in UTC puts `2026-08-03T00:15+05:30` on `2026-08-02`, which drops it out of the
  // window entirely -- and a dropped run does not read as an error, it reads as a MISSED SLOT.
  // The instrument would report a failure that never happened, on the first slot of every window.
  //
  // The helper lives in `panel.mjs` rather than here so ONE function does this for both readers.
  // Fixing it in this file alone was the first attempt, and it left the identical construct live
  // in the panel's own loader -- the twin-fix recurrence this repo has now produced three times.
  const inWindow = [];
  const undatedEvents = [];
  for (const w of events || []) {
    const e = unwrap(w);
    if (!e || typeof e.ts !== "string") continue;
    const d = istDayOf(e);
    // AN EVENT WITH AN UNREADABLE TIMESTAMP IS COUNTED, never dropped. Silently discarding it is
    // how a real run disappears and its slot reads as silence.
    if (d === null) { undatedEvents.push(e.kind ?? "unknown"); continue; }
    if (d < from || d > to) continue;
    inWindow.push(e);
  }

  const runs = inWindow.filter((e) => e.kind === "run.completed" && e.payload && e.payload.job);
  const incidents = inWindow.filter((e) => e.kind === "incident.raised" && e.payload && e.payload.job);
  const notes = inWindow.filter((e) => e.kind === "note.logged" && e.payload && e.payload.job);

  // A REPEATED JOB NAME DOUBLES EVERY TOTAL while still reading clean -- expected 14, completed
  // 14, nothing wrong anywhere. Refusing is the only honest answer to a schedule that names the
  // same job twice; jobs-lint bans it at commit time and this refuses to score it.
  const seenNames = new Set();
  for (const job of jobs || []) {
    const n = String(job?.name);
    if (seenNames.has(n)) throw new Error(`audit: ${JSON.stringify(n)} appears twice in the schedule -- every total would silently double`);
    seenNames.add(n);
  }

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
      failedSlots: [],
      unscheduledRuns: [],
      manualStarts: [],
      unknownOutcomes: [],
      unmatchableReceipts: [],
      driftMs: [],
      driftUnparsed: 0,
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

    // `String()` on BOTH sides. Stringifying one only made a numeric job name compare unequal to
    // its own receipts, producing a full window of phantom gaps for a job that ran perfectly.
    const mine = runs.filter((e) => String(e.payload.job) === name);
    const myIncidents = incidents.filter((e) => String(e.payload.job) === name);
    const myNotes = notes.filter((e) => String(e.payload.job) === name);

    for (const e of mine) {
      const oc = outcomeOf(e);
      if (oc === "ok") row.completed++;
      else if (oc === "fail") row.failed++;
      // AN OUTCOME THAT IS NEITHER GETS ITS OWN BUCKET. Folding it into `failed` invents a fact,
      // and folding it into `completed` hides one; both make the count say something no receipt
      // does. `INCIDENT_CLASSES` already sets this precedent for incidents.
      else row.unknownOutcomes.push({ ts: e.ts, outcome: e.outcome ?? null });
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

    // SLOTS ARE MATCHED BY PARSED INSTANT, not by raw string.
    //
    // `2026-08-06T00:15:00+05:30` and `2026-08-06T00:15:00.000+05:30` are the same moment and two
    // different strings, so a string match put one real run into `unexplainedGaps` AND
    // `unscheduledRuns` at the same time -- a single run reported in two mutually exclusive
    // categories. And a `scheduled_for` that is null, a number, or absent vanished from every
    // category with no flag at all, so a slot that WAS served read as missed.
    const bySlot = new Map();
    for (const e of mine) {
      const at = Date.parse(String(e.payload.scheduled_for ?? ""));
      if (!Number.isFinite(at)) {
        // A receipt that cannot be placed is a FINDING, never a discard. It ran; we simply cannot
        // say when, and pretending its slot is silent would be the instrument inventing a failure.
        row.unmatchableReceipts.push({ ts: e.ts, scheduled_for: e.payload.scheduled_for ?? null });
        continue;
      }
      if (!bySlot.has(at)) bySlot.set(at, []);
      bySlot.get(at).push(e);
    }

    // AN EXPLANATION MUST COME FROM THE SCHEDULER ITSELF.
    //
    // Without this, seven hand-written `note.logged` events with a session actor turned a
    // completely dead scheduler into a CLEAN week -- and would let the fire-drill's required true
    // positive be erased by hand. Who emitted the explanation is part of whether it explains
    // anything, so the actor is checked and then RECORDED, because an explanation nobody can
    // attribute is not evidence.
    const explainedBy = new Map();
    for (const e of [...myIncidents, ...myNotes]) {
      if (String(e.actor || "") !== `scheduler:${name}`) continue;
      const at = Date.parse(String(e.payload.scheduled_for ?? ""));
      if (!Number.isFinite(at)) continue;
      if (!explainedBy.has(at))
        explainedBy.set(at, { actor: e.actor, kind: e.kind, why: e.payload.class ?? e.payload.skipped ?? e.kind });
    }

    const expectedMs = new Set();
    for (const t of expectedSlots) {
      expectedMs.add(t);
      const served = bySlot.get(t) || [];
      const ok = served.filter((e) => outcomeOf(e) === "ok");
      if (ok.length) {
        // Drift from the FIRST successful receipt only. A double fire that both landed would
        // otherwise contribute two samples for one slot and quietly skew the median.
        const started = Date.parse(String(ok[0].payload.started_at ?? ""));
        // Bounded: `Date.parse("12345")` succeeds as the YEAR 12345 and yields a finite,
        // plausible-shaped, wholly wrong drift. A sample outside a day either way is not drift,
        // it is a broken timestamp, and it is counted as one.
        if (Number.isFinite(started) && Math.abs(started - t) <= 86_400_000) row.driftMs.push(started - t);
        else row.driftUnparsed++;
        continue;
      }
      // A slot whose only receipts FAILED is not an absence at all -- something ran and said so.
      // It used to be filed under `explainedGaps`, a name that reads as health, which let a week
      // where every single run crashed grade CLEAN.
      if (served.length) { row.failedSlots.push(isoSlot(t)); continue; }
      const ex = explainedBy.get(t);
      if (ex) { row.explainedGaps.push({ slot: isoSlot(t), why: ex.why, by: ex.actor }); continue; }
      row.unexplainedGaps.push(isoSlot(t));
    }

    // A run whose slot is not an expected one is REPORTED, never discarded. Catch-ups and
    // attended runs land here legitimately; so would a task firing on a schedule nobody wrote,
    // and dropping the category would hide the second inside the first.
    for (const [at, served] of bySlot)
      if (!expectedMs.has(at)) row.unscheduledRuns.push({ slot: isoSlot(at), count: served.length });

    // SORTED, because the pack must be byte-identical for the same events in ANY order. Both of
    // these were emitted in input order, so reversing the event list produced a different report
    // from the same spine -- and the replay fixture could not see it, because it compared two
    // calls with the same ordering.
    row.unscheduledRuns.sort((a, b) => a.slot.localeCompare(b.slot));
    row.manualStarts.sort((a, b) => String(a.ts).localeCompare(String(b.ts)));
    row.unknownOutcomes.sort((a, b) => String(a.ts).localeCompare(String(b.ts)));
    row.unmatchableReceipts.sort((a, b) => String(a.ts).localeCompare(String(b.ts)));
    row.explainedGaps.sort((a, b) => a.slot.localeCompare(b.slot));
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

  // MONEY, AND IT DOES NOT CANCEL.
  //
  // Expected to be exactly zero: spend-carrying kinds are unschedulable by jobs-lint on top of
  // policy's own money law, so any figure here is a finding rather than a number. Summing signed
  // values let +1000 and -1000 net to a clean 0 while a thousand rupees had moved, so the total
  // is of ABSOLUTE values. A non-finite or negative `inr` is not coerced to zero either -- that
  // is the "coerced invalid read reported as a successful zero" shape, and it is counted.
  let spendInr = 0;
  let badCosts = 0;
  for (const e of inWindow) {
    const c = e.cost;
    if (!c || c.inr === undefined || c.inr === null) continue;
    const n = typeof c.inr === "number" ? c.inr : Number(c.inr);
    if (typeof c.inr === "boolean" || !Number.isFinite(n) || n < 0) { badCosts++; continue; }
    spendInr += Math.abs(n);
    if (!Number.isFinite(spendInr)) { badCosts++; spendInr = Number.MAX_SAFE_INTEGER; break; }
  }

  const totals = {
    windowDays: Math.round((slotMs(to, 0, 0) - slotMs(from, 0, 0)) / 86_400_000) + 1,
    expected: perJob.reduce((n, r) => n + r.expected, 0),
    completed: perJob.reduce((n, r) => n + r.completed, 0),
    failed: perJob.reduce((n, r) => n + r.failed, 0),
    unexplainedGaps: perJob.reduce((n, r) => n + r.unexplainedGaps.length, 0),
    explainedGaps: perJob.reduce((n, r) => n + r.explainedGaps.length, 0),
    failedSlots: perJob.reduce((n, r) => n + r.failedSlots.length, 0),
    manualStarts: perJob.reduce((n, r) => n + r.manualStarts.length, 0),
    unscheduledRuns: perJob.reduce((n, r) => n + r.unscheduledRuns.length, 0),
    unknownOutcomes: perJob.reduce((n, r) => n + r.unknownOutcomes.length, 0),
    unmatchableReceipts: perJob.reduce((n, r) => n + r.unmatchableReceipts.length, 0),
    driftP50Ms: medianLower(perJob.flatMap((r) => r.driftMs)),
    driftUnparsed: perJob.reduce((n, r) => n + r.driftUnparsed, 0),
    incidents: incidents.length,
    incidentsByClass,
    unknownIncidentClasses: unknownClasses,
    spendInr,
    badCosts,
    undatedEvents: undatedEvents.length,
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
  // The SAME window validation `deriveAudit` does. Without it a malformed bound surfaced three
  // frames down as a `cadence:` error about a date nobody typed.
  if (!isDay(from) || !isDay(to))
    throw new Error(`audit: needs-you window must be two YYYY-MM-DD days, got ${JSON.stringify(from)}..${JSON.stringify(to)}`);
  if (from > to)
    throw new Error(`audit: needs-you window ${from}..${to} runs backwards`);
  const days = [];
  let cursor = from;
  let guard = 0;
  // `guard++ < 400` lets exactly 400 iterations run and leaves `guard === 400`, so the check
  // below had to be `>` and not `>=`: a correctly completed 400-day walk was being reported as a
  // truncated one. An off-by-one inside the guard that exists to prevent silent truncation.
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
  if (guard > 400)
    throw new Error("audit: needs-you replay walked past 400 days -- refusing to report a truncated history as a complete one");
  return days;
}
