#!/usr/bin/env node
/**
 * audit-harness.mjs -- drives `deriveAudit` and `needsYouHistory` with synthetic events.
 *
 * It PRINTS DATA and asserts nothing; the assertions live in the bats file where a failure is
 * readable. No spine, no OS, no clock: the derivation is pure, so the fixture can hand it exactly
 * the week it wants to ask about.
 *
 * Usage: node audit-harness.mjs <case>
 */

import { deriveAudit, needsYouHistory, medianLower, INCIDENT_CLASSES, isoSlot } from "../../../.claude/scripts/hq/lib/jobs/audit.mjs";
import { derivePanel } from "../../../.claude/scripts/hq/lib/jobs/panel.mjs";
import { slotMs, istDay } from "../../../.claude/scripts/hq/lib/jobs/cadence.mjs";

const CASE = process.argv[2];
const out = (label, value) => process.stdout.write(`${label}:${JSON.stringify(value)}\n`);

const DAILY = { name: "day-close-roll", cadence: "daily@00:15", enabled: true, type: "script" };
const WEEKDAYS = { name: "brief-materialize", cadence: "weekdays@06:00", enabled: true, type: "script" };

// 2026-08-03 is a Monday, so 03..09 is one clean Mon-Sun week: five weekday slots, seven daily.
const FROM = "2026-08-03";
const TO = "2026-08-09";

const slot = (day, hh, mm) => `${day}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00+05:30`;

/**
 * A run receipt shaped exactly as the wrapper writes one -- INCLUDING an IST-rendered `ts`, which
 * is what `arc-event` canonicalises to. The first version of this helper stamped UTC, and that
 * alone was enough to make every window's first slot read as MISSED, because the audit was
 * cutting the window on the leading ten characters of the timestamp. Keeping the fixture faithful
 * to the real receipt is what turned that into a caught defect rather than a mystery.
 */
const istIso = (ms) => {
  const day = istDay(ms);
  const mins = Math.round((ms - slotMs(day, 0, 0)) / 60_000);
  const p = (n) => String(n).padStart(2, "0");
  return `${day}T${p(Math.floor(mins / 60))}:${p(mins % 60)}:${p(Math.floor(((ms - slotMs(day, 0, 0)) % 60_000) / 1000))}+05:30`;
};

const run = (job, day, hh, mm, { outcome = "ok", actor = null, driftMs = 0, cost = null } = {}) => {
  const scheduled = slotMs(day, hh, mm);
  return {
    kind: "run.completed",
    ts: istIso(scheduled + driftMs),
    actor: actor ?? `scheduler:${job}`,
    outcome,
    cost,
    payload: {
      job,
      scheduled_for: slot(day, hh, mm),
      started_at: istIso(scheduled + driftMs),
      duration_ms: 10,
      outcome,
      type: "script",
    },
  };
};

const incident = (job, day, hh, mm, klass) => ({
  kind: "incident.raised",
  ts: slot(day, hh, mm),
  actor: `scheduler:${job}`,
  outcome: "fail",
  cost: null,
  payload: { job, scheduled_for: slot(day, hh, mm), class: klass },
});

const note = (job, day, hh, mm) => ({
  kind: "note.logged",
  ts: slot(day, hh, mm),
  actor: `scheduler:${job}`,
  outcome: "ok",
  cost: null,
  payload: { job, scheduled_for: slot(day, hh, mm), skipped: "git-state", marker: "MERGE_HEAD" },
});

/** Every daily slot in the window, served cleanly. */
const perfectDaily = () =>
  ["03", "04", "05", "06", "07", "08", "09"].map((d) => run("day-close-roll", `2026-08-${d}`, 0, 15));

const audit = (events, jobs = [DAILY]) =>
  deriveAudit({ from: FROM, to: TO, jobs, events, observedFrom: FROM });

try {
  if (CASE === "perfect-week") {
    const p = audit(perfectDaily());
    out("EXPECTED", p.totals.expected);
    out("COMPLETED", p.totals.completed);
    out("MISSED", p.totals.unexplainedGaps);
    out("MANUAL", p.totals.manualStarts);
    out("DRIFT_P50", p.totals.driftP50Ms);
    out("SPEND", p.totals.spendInr);
  } else if (CASE === "one-missed") {
    // One slot with nothing at all against it. This is the silence the whole cycle exists to see.
    const p = audit(perfectDaily().filter((e) => !e.payload.scheduled_for.startsWith("2026-08-06")));
    out("MISSED", p.totals.unexplainedGaps);
    out("GAPS", p.perJob[0].unexplainedGaps);
  } else if (CASE === "explained-by-incident") {
    // A slot the wrapper REFUSED, and said so. Not a gap: the phase spec asks for "a run.completed
    // or an explained absence", and an incident naming the slot is exactly the second one.
    const evs = perfectDaily().filter((e) => !e.payload.scheduled_for.startsWith("2026-08-06"));
    evs.push(incident("day-close-roll", "2026-08-06", 0, 15, "policy-declined"));
    const p = audit(evs);
    out("MISSED", p.totals.unexplainedGaps);
    out("EXPLAINED", p.totals.explainedGaps);
    out("INCIDENTS", p.totals.incidentsByClass);
  } else if (CASE === "explained-by-note") {
    const evs = perfectDaily().filter((e) => !e.payload.scheduled_for.startsWith("2026-08-07"));
    evs.push(note("day-close-roll", "2026-08-07", 0, 15));
    const p = audit(evs);
    out("MISSED", p.totals.unexplainedGaps);
    out("EXPLAINED", p.totals.explainedGaps);
  } else if (CASE === "failed-run-is-not-a-gap") {
    // Something RAN and reported failure. Counting that as a missed slot would conflate "the
    // scheduler never fired" with "the work failed" -- two different repairs.
    const evs = perfectDaily().filter((e) => !e.payload.scheduled_for.startsWith("2026-08-08"));
    evs.push(run("day-close-roll", "2026-08-08", 0, 15, { outcome: "fail" }));
    const p = audit(evs);
    out("MISSED", p.totals.unexplainedGaps);
    out("FAILED", p.totals.failed);
    out("COMPLETED", p.totals.completed);
  } else if (CASE === "manual-start") {
    // REQ-06 is zero manual starts, and the ONLY field that separates a scheduled fire from an
    // attended one is the actor.
    const evs = perfectDaily();
    evs[2] = run("day-close-roll", "2026-08-05", 0, 15, { actor: "session" });
    const p = audit(evs);
    out("MANUAL", p.totals.manualStarts);
    out("WHO", p.perJob[0].manualStarts.map((m) => m.actor));
    out("COMPLETED", p.totals.completed);
    out("MISSED", p.totals.unexplainedGaps);
  } else if (CASE === "weekend") {
    // A weekdays job expects NOTHING on Saturday and Sunday. The constant-interval version of
    // this arithmetic made every weekdays job overdue every Monday.
    const p = deriveAudit({ from: FROM, to: TO, jobs: [WEEKDAYS], events: [], observedFrom: FROM });
    out("EXPECTED", p.totals.expected);
    out("GAPS", p.perJob[0].unexplainedGaps);
  } else if (CASE === "disabled") {
    // A deliberate off expects nothing, and that is a statement rather than a clean week.
    const p = deriveAudit({ from: FROM, to: TO, jobs: [{ ...DAILY, enabled: false }], events: [], observedFrom: FROM });
    out("EXPECTED", p.totals.expected);
    out("MISSED", p.totals.unexplainedGaps);
  } else if (CASE === "unscheduled-run") {
    // A receipt claiming a slot nobody scheduled. Legitimate for a catch-up -- and also what a
    // task firing on a schedule nobody wrote would look like. Reported, never dropped.
    const evs = perfectDaily();
    evs.push(run("day-close-roll", "2026-08-05", 13, 0));
    const p = audit(evs);
    out("EXTRA", p.perJob[0].unscheduledRuns);
    out("MISSED", p.totals.unexplainedGaps);
  } else if (CASE === "drift") {
    const evs = [
      run("day-close-roll", "2026-08-03", 0, 15, { driftMs: 1000 }),
      run("day-close-roll", "2026-08-04", 0, 15, { driftMs: 5000 }),
      run("day-close-roll", "2026-08-05", 0, 15, { driftMs: 9000 }),
    ];
    const p = deriveAudit({ from: "2026-08-03", to: "2026-08-05", jobs: [DAILY], events: evs, observedFrom: FROM });
    out("DRIFT_P50", p.totals.driftP50Ms);
    out("MEDIAN_EVEN", medianLower([10, 20]));
    out("MEDIAN_ODD", medianLower([10, 20, 30]));
    out("MEDIAN_EMPTY", medianLower([]));
  } else if (CASE === "spend") {
    // Spend-carrying kinds are unschedulable, so any figure here is a finding, not a number.
    const evs = perfectDaily();
    evs[0] = { ...evs[0], cost: { inr: 12 } };
    const p = audit(evs);
    out("SPEND", p.totals.spendInr);
  } else if (CASE === "unknown-incident-class") {
    // A class nobody declared must not be folded into a bucket or dropped: a new failure mode
    // landing silently in a pack that reads "0 incidents" is the metric saying the opposite of
    // the truth.
    const evs = perfectDaily().filter((e) => !e.payload.scheduled_for.startsWith("2026-08-06"));
    evs.push(incident("day-close-roll", "2026-08-06", 0, 15, "something-nobody-declared"));
    const p = audit(evs);
    out("KNOWN", p.totals.incidentsByClass);
    out("UNKNOWN", p.totals.unknownIncidentClasses);
    out("CLASSES", INCIDENT_CLASSES);
  } else if (CASE === "replay") {
    const a = JSON.stringify(audit(perfectDaily()));
    const b = JSON.stringify(audit(perfectDaily()));
    out("IDENTICAL", a === b);
  } else if (CASE === "bad-window") {
    for (const [f, t] of [["2026-08-09", "2026-08-03"], ["nonsense", "2026-08-09"], ["2026-08-03", ""]]) {
      try { deriveAudit({ from: f, to: t, jobs: [DAILY], events: [] }); out("ACCEPTED", [f, t]); }
      catch (e) { out("REFUSED", [f, t]); }
    }
  } else if (CASE === "iso-slot-matches-receipt") {
    // THE GAP AUDIT IS A STRING MATCH. If isoSlot rendered UTC, every served slot would read as an
    // unexplained gap and every run as unscheduled -- a total inversion that still looks like a
    // report.
    out("BUILT", isoSlot(slotMs("2026-08-03", 0, 15)));
    out("RECEIPT", run("day-close-roll", "2026-08-03", 0, 15).payload.scheduled_for);
    out("MATCH", isoSlot(slotMs("2026-08-03", 0, 15)) === run("day-close-roll", "2026-08-03", 0, 15).payload.scheduled_for);
  } else if (CASE === "needs-you-history") {
    // The fire-drill's shape: a job that ran, then went silent. Its OS task is gone but the yaml
    // still says enabled, so there is nothing to read except the absence.
    const evs = [
      run("day-close-roll", "2026-08-03", 0, 15),
      run("day-close-roll", "2026-08-04", 0, 15),
    ];
    const days = needsYouHistory({ from: FROM, to: TO, jobs: [DAILY], events: evs, observedFrom: FROM, derivePanel });
    out("DAYS", days.map((d) => d.day));
    out("FIRST", days[0] ?? null);
  } else if (CASE === "needs-you-quiet") {
    // The negative control: a healthy week writes NOTHING into the history. Without this, a
    // function that reported every day would satisfy the case above.
    const days = needsYouHistory({ from: FROM, to: TO, jobs: [DAILY], events: perfectDaily(), observedFrom: FROM, derivePanel });
    out("DAYS", days.map((d) => d.day));
  } else if (CASE === "needs-you-needs-panel") {
    try { needsYouHistory({ from: FROM, to: TO, jobs: [DAILY], events: [], observedFrom: FROM }); out("ACCEPTED", true); }
    catch (e) { out("REFUSED", String(e.message).slice(0, 60)); }
  } else {
    process.stderr.write(`unknown case ${CASE}\n`);
    process.exit(64);
  }
  process.stdout.write("HARNESS-DONE\n");
} catch (e) {
  process.stderr.write(`harness threw: ${e?.code || ""} ${e?.message || e}\n`);
  process.exit(1);
}
