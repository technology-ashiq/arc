/**
 * panel.mjs -- the jobs panel derivation (SCH-F, REQ-03). This is where SILENCE BECOMES VISIBLE.
 *
 * A job that dies emits nothing. There is no event for "did not run", so the detector cannot
 * live at the emitter -- it has to be a READER-SIDE DERIVATION, computed from what should have
 * happened against what did.
 *
 * PURE BY CONSTRUCTION: `derivePanel` is a function of (day, jobs, events) and nothing else.
 * `Date.now()` is not merely discouraged here, it is absent -- the brief's `--date D` replay
 * must be byte-identical on every run and every leg, and one wall-clock read would break both
 * that and the golden fixture that proves it. The caller supplies the day; the panel never asks
 * what time it is.
 *
 * `enabled: false` renders as DISABLED and is NEVER counted overdue. A deliberate off is not a
 * silent death, and conflating them is what teaches a needs-you group to be ignored -- which is
 * pre-mortem row 5, trust collapse from spam.
 *
 * Zero dependencies, Node 18+.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { query } from "../../spine.mjs";
import { parseCadence, floorSlot, nextSlot, missedSlots, slotMs, istDay } from "./cadence.mjs";
import { parseYamlSubset } from "../../../engine/yaml-subset.mjs";

/** SCH-F: overdue is "more than 2x cadence", measured in SLOTS that should have fired. */
export const OVERDUE_SLOTS = 2;

/** The schedule, or [] when this root has none. A repo without jobs has an empty panel. */
export function loadJobs(repoRoot) {
  const p = join(repoRoot, "hq.jobs.yaml");
  if (!existsSync(p)) return [];
  const parsed = parseYamlSubset(readFileSync(p, "utf8"));
  if (!parsed.ok || !parsed.value || !Array.isArray(parsed.value.jobs)) return [];
  return parsed.value.jobs;
}

/**
 * Every `run.completed` on or before `day`, across ALL day files rather than one.
 *
 * The panel's question is "when did this last run", and the answer is routinely days old -- a
 * weekly-silent job is exactly the case the detector exists for, and reading only today's file
 * would report every healthy job as never-run. The cut at `day` is what makes `--date D` a
 * REPLAY: the panel must not be able to see past the day it is rendering.
 */
export async function loadRunEventsUpTo(spineDir, day) {
  return (await loadPanelInputs(spineDir, day)).events;
}

/**
 * The events AND the window they were observed over.
 *
 * `observedFrom` is the earliest day this spine can speak to, and it exists because a job that
 * has NEVER run cannot otherwise be judged: there is no last run to measure from, and the
 * schedule carries no "added on" date. Anchoring the count at the last slot made every
 * never-run job report exactly one missed slot forever, so a job that had never fired in a
 * month looked identical to one registered an hour ago -- the detector reporting health for
 * the loudest possible failure.
 *
 * The honest measure is what the spine can actually witness: over the days it holds, this job
 * should have fired N times and did not. A young spine says little and a long one says a lot,
 * which is the correct amount of confidence in both cases.
 */
export async function loadPanelInputs(spineDir, day) {
  const { events, observedFrom } = await loadSpineEvents(spineDir, day);
  return { events: events.filter((e) => e.kind === "run.completed"), observedFrom };
}

/**
 * EVERY event the spine holds, unwrapped, optionally cut at a day -- and the earliest day it can
 * speak to.
 *
 * The panel wants only `run.completed`; the audit needs incidents and skip notes too, because an
 * "explained absence" is precisely a slot that has one of those instead of a run. Both go through
 * this one reader rather than each walking the spine its own way.
 *
 * READ THROUGH THE SPINE'S OWN READER, never by walking events/*.jsonl. SPINE-G (ADR-0030) makes
 * the spine the only public API, and a second reader is not a shortcut -- it is a second opinion
 * about torn lines, quarantine and ordering, which would let the panel, the brief and the audit
 * disagree about the same day while all three looked correct.
 */
export async function loadSpineEvents(spineDir, day = null) {
  const { events } = await query(spineDir, {});
  const out = [];
  let observedFrom = null;
  for (const wrapped of events) {
    // The reader yields wrapped records; the event itself is what carries kind and ts.
    const e = wrapped && wrapped.event ? wrapped.event : wrapped;
    if (!e || typeof e.ts !== "string") continue;
    const d = e.ts.slice(0, 10);
    if (day !== null && d > day) continue;
    if (observedFrom === null || d < observedFrom) observedFrom = d;
    out.push(e);
  }
  return { events: out, observedFrom };
}

/**
 * Every `run.completed` this job has, newest first, from the injected event list.
 *
 * Matched on `payload.job` rather than on the actor, because a job has TWO legitimate actors --
 * `scheduler:<name>` when the OS fired it and the session actor when a human did -- and the
 * panel must count both as "this job ran". Matching on actor would make every attended run
 * invisible and every catch-up look like a miss.
 */
function runsFor(jobName, events) {
  return events
    .filter((e) => e && e.kind === "run.completed" && e.payload && e.payload.job === jobName)
    .sort((a, b) => String(b.ts).localeCompare(String(a.ts)));
}

/**
 * The panel for one day.
 *
 * `events` must already be filtered to events at or before `day` -- the caller owns that cut,
 * because "the spine as it stood on day D" is the thing being replayed and the panel must not
 * be able to see past it.
 */
export function derivePanel({ day, jobs, events, observedFrom = null }) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(day)))
    throw new Error(`panel: day must be YYYY-MM-DD, got ${JSON.stringify(day)}`);

  // The end of the named day in IST. Every "as of" question is asked against this instant, never
  // against now.
  const asOf = slotMs(day, 23, 59) + 59_000;
  const rows = [];

  for (const job of jobs || []) {
    const name = String(job.name);
    const cadence = parseCadence(job.cadence);
    const enabled = job.enabled === true;

    const row = {
      name,
      enabled,
      cadence: String(job.cadence ?? ""),
      lastRun: null,
      lastOutcome: null,
      nextExpected: null,
      missed: 0,
      overdue: false,
      state: enabled ? "enabled" : "disabled",
    };

    if (!cadence) {
      // An unparseable cadence cannot be reasoned about, and guessing would be worse than
      // saying so. jobs-lint refuses this at commit time; if one reaches the panel, the panel
      // reports it rather than quietly treating the job as healthy.
      row.state = "unreadable-cadence";
      rows.push(row);
      continue;
    }

    const runs = runsFor(name, events);
    const last = runs[0] || null;
    if (last) {
      row.lastRun = String(last.ts);
      row.lastOutcome = last.outcome ?? (last.payload && last.payload.outcome) ?? null;
    }

    row.nextExpected = (() => {
      const t = nextSlot(cadence, asOf);
      return t === null ? null : t;
    })();

    if (!enabled) {
      // Deliberately off: no overdue arithmetic at all. Not "zero missed" -- the question is
      // not asked, which is a different statement and renders differently.
      rows.push(row);
      continue;
    }

    // NEVER RUN AT ALL is its own case, and the hard one: there is no last run to measure from
    // and the schedule carries no "added on" date. Counting from epoch would drown the panel in
    // thousands of missed slots; counting from the LAST slot -- which the first version did --
    // reported exactly one missed slot forever, so a job that had never fired in a month read
    // identically to one registered an hour ago. That is the detector reporting health for the
    // loudest failure it exists to catch.
    //
    // The measure is the window the SPINE CAN WITNESS: over the days it actually holds, this job
    // should have fired N times and did not. A young spine says little and a long one says a
    // lot, which is the right amount of confidence in each case. With no window at all, a
    // never-run job is reported as never-run and not judged, because nothing has been observed.
    if (!last) {
      const from = observedFrom && /^\d{4}-\d{2}-\d{2}$/.test(observedFrom)
        ? slotMs(observedFrom, 0, 0)
        : null;
      row.state = "never-run";
      if (from !== null) {
        row.missed = missedSlots(cadence, from - 1, asOf);
        row.overdue = row.missed > OVERDUE_SLOTS;
      }
      rows.push(row);
      continue;
    }

    const since = Date.parse(String(last.ts));
    if (!Number.isFinite(since)) {
      row.state = "unreadable-receipt";
      rows.push(row);
      continue;
    }

    row.missed = missedSlots(cadence, since, asOf);
    row.overdue = row.missed > OVERDUE_SLOTS;
    if (row.overdue) row.state = "overdue";
    rows.push(row);
  }

  return rows;
}

/**
 * The needs-you lines, if any. Deliberately returns STRINGS rather than printing: the brief owns
 * rendering, and a derivation that prints cannot be golden-tested.
 */
export function needsYouLines(rows) {
  return rows
    .filter((r) => r.overdue)
    .map((r) => {
      const since = r.lastRun ? `silent since ${r.lastRun}` : "has never run";
      return `job ${r.name} ${since} -- ${r.missed} scheduled slots missed (${r.cadence})`;
    });
}
