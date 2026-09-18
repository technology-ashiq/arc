// fold.mjs -- kernel/scheduler: every decision the scheduler room makes, where node can import it with no
// install (face v2 Phase 03, ADR-1320, ADR-1324, ADR-1326).
//
// The port of v0.7's Scheduler onto the door. The lede promises four things, and each is either shown or
// named NOT SERVED (Cycle 15 finding F2): the JOBS are the registry's, and every job a run receipt names;
// the LAST OUTCOME is each job's newest run.completed on the page the door sent; the NEXT FIRE and the
// HEARTBEAT come from /api/jobs (Phase 04), which runs the brief's own jobs panel -- the cadence parsed from
// hq.jobs.yaml, each job judged against it across every day the spine holds. What the trail holds is the last
// fire ON THE PAGE IT SENT, and the room says exactly that: the door pages from the oldest receipt, so a page
// with more past it is never called the newest (Phase 03 attack). Firing, pausing and registering are
// work-door verbs (Phase 05).
import { verbPending } from "../../../lib/registry.mjs";
import { field, servedRead, servedTable } from "../../../lib/served.mjs";
import { fmtInt } from "../../../lib/inbox.mjs";
import { countedOn, hasKind, kindCount, laneBadge, laneKpi, laneRoom, runsBy } from "../../../lib/lane-room.mjs";

/** @typedef {import("../../../lib/registry.mjs").Payload} Payload */
/** @typedef {import("../../../lib/lane-room.mjs").RunRow} RunRow */

/**
 * @typedef {import("../../../lib/lane-room.mjs").LaneRoom & {
 *   badge: string,
 *   kpis: { key: string, v: string, l: string, sub: string }[],
 *   jobs: RunRow[],
 *   jobsTitle: string,
 *   showJobsEmpty: boolean,
 *   nextFire: import("../../../lib/served.mjs").ServedTable,
 *   fireVerb: { isVerbPending: true, verb: string, sentence: string },
 *   register: { isVerbPending: true, verb: string, sentence: string },
 *   lastFire: { hasFire: boolean, line: string, detail: string },
 *   heartbeat: import("../../../lib/served.mjs").ServedTable,
 * }} Folded
 */

/**
 * @param {Record<string, Payload>} payloads
 * @param {import("../../../lib/registry.mjs").FoldContext} ctx
 * @returns {Folded}
 */
export function fold(payloads, ctx) {
  const base = laneRoom(payloads, ctx, { files: ["hq-jobs"] });
  const runsHomed = hasKind(base, "run.completed");
  const isRead = runsHomed && base.trail.isDrawn;
  const ran = runsBy(base.trail.events, "job", ["exit_code", "duration_ms", "scheduled_for"], base.trail.isPartial);
  // The registry's list, read from the copy the fold already took, each name once: a name listed twice
  // would draw the same job twice, once with its runs and once without (Phase 03 attack).
  const registered = [...new Set(base.held.jobs ?? [])];
  const byName = new Map(ran.map((r) => [r.key, r]));
  /** @type {RunRow[]} */
  const jobs = registered.map((name) => byName.get(name) ?? {
    key: name,
    name,
    runs: "0 runs",
    last: isRead
      ? "none on the page the door sent"
      : base.trail.isRefused
        ? "the door refused this room's receipts"
        : runsHomed ? "reading its runs" : "the registry homes no run receipt here",
    when: "",
    detail: "",
  });
  // A job a receipt names that the registry does not is shown, and says so, rather than dropped.
  for (const r of ran) if (!registered.includes(r.key)) jobs.push({ ...r, detail: ["not in the served registry", r.detail].filter((s) => s !== "").join(" · ") });
  const runTotal = base.trail.events.filter((e) => e.kind === "run.completed" && typeof e.payload["job"] === "string" && e.payload["job"] !== "").length;
  const newest = ran[0];
  const jobsSt = servedRead(payloads, ctx, base.reads, "/api/jobs");
  const slots = typeof jobsSt.body["overdueSlots"] === "number" ? jobsSt.body["overdueSlots"] : null;
  const observedFrom = field(jobsSt.body, "observedFrom");

  return {
    ...base,
    badge: laneBadge(base),
    kpis: [
      laneKpi(base),
      { key: "jobs", v: fmtInt(registered.length), l: "Jobs on the clock", sub: "in the served registry" },
      { key: "runs", v: isRead ? `${fmtInt(runTotal)}${base.trail.isPartial ? "+" : ""}` : "—", l: "Job runs recorded", sub: runsHomed ? countedOn(base, "run.completed naming a job") : "the registry homes no run receipt here" },
      {
        key: "last",
        v: newest === undefined ? "—" : newest.when,
        l: base.trail.isPartial ? "Last fire on that page" : "Last fire recorded",
        sub: newest === undefined ? (isRead ? "no job run on the page the door sent" : "reading the page") : newest.name,
      },
      { key: "incidents", v: kindCount(base, "incident.raised"), l: "Incidents raised", sub: countedOn(base, "incident.raised") },
    ],
    jobs,
    jobsTitle: `The jobs — ${fmtInt(jobs.length)} on the clock`,
    showJobsEmpty: jobs.length === 0,
    nextFire: servedTable(jobsSt, {
      panel: "Next fire and cadence",
      route: "/api/jobs",
      columns: ["job", "cadence", "next fire", "on the clock"],
      listKey: "jobs",
      empty: "hq.jobs.yaml registers no job.",
      row: (j) => {
        const name = field(j, "name");
        return name === "" ? null : { key: name, cells: [name, field(j, "cadence"), field(j, "nextExpected") || "—", j["enabled"] === true ? "enabled" : "disabled"] };
      },
      note: slots === null ? "" : `overdue is more than ${slots} slots missed, measured in IST`,
    }),
    fireVerb: verbPending(
      "Fire now, pause or resume a job",
      "A fire is idempotent per slot, and a pause lets the slot pass with no catch-up. Both are verbs of the work door; today the clock runs from hq.jobs.yaml alone.",
    ),
    register: verbPending(
      "Register a job",
      "A job is a reviewed diff to hq.jobs.yaml that names a policy subject, and jobs-lint refuses an illegal schedule before anything runs unattended.",
    ),
    lastFire: {
      hasFire: newest !== undefined,
      line: newest === undefined
        ? (isRead
          ? "No job run on the page the door sent."
          : base.trail.isRefused
            ? "The door refused this room's receipts, so no fire can be read."
            : runsHomed ? "" : "The served registry homes no run receipt in this room.")
        : `${newest.name} fired at ${newest.when} · ${newest.last}${base.trail.isPartial ? " — the newest on the page the door sent, which has more past it" : ""}`,
      detail: newest === undefined ? "" : newest.detail,
    },
    heartbeat: servedTable(jobsSt, {
      panel: "The heartbeat",
      route: "/api/jobs",
      columns: ["job", "state", "slots missed", "last run"],
      listKey: "jobs",
      empty: "hq.jobs.yaml registers no job, so nothing is judged.",
      row: (j) => {
        const name = field(j, "name");
        const missed = typeof j["missed"] === "number" ? String(j["missed"]) : "—";
        return name === "" ? null : { key: name, cells: [name, j["overdue"] === true ? "overdue" : field(j, "state"), missed, field(j, "lastRun") || "never on this spine"] };
      },
      note: [
        observedFrom !== "" ? `each job judged against its cadence across every day the spine holds, from ${observedFrom}` : "",
        "the operating system's own clock check is not read through the door, so a silent clock shows here as missed slots, not as an incident",
      ].filter((x) => x !== "").join(" · "),
    }),
  };
}
