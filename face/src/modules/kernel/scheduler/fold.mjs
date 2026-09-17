// fold.mjs -- kernel/scheduler: every decision the scheduler room makes, where node can import it with no
// install (face v2 Phase 03, ADR-1320, ADR-1324, ADR-1326).
//
// The port of v0.7's Scheduler onto the door. The lede promises four things, and each is either shown or
// named NOT SERVED (Cycle 15 finding F2): the JOBS are the registry's, and every job a run receipt names;
// the LAST OUTCOME is each job's newest run.completed on the page the door sent; the NEXT FIRE needs the
// cadence parsed from hq.jobs.yaml, and the HEARTBEAT needs the clock's own judgement of overdue -- both
// arrive with /api/jobs. What the door does hold is the last fire any job recorded, and the room shows it
// as exactly that, never as a heartbeat. Firing, pausing and registering are work-door verbs (Phase 05).
import { notServed, verbPending } from "../../../lib/registry.mjs";
import { fmtInt } from "../../../lib/inbox.mjs";
import { holdsList } from "../../../lib/spine.mjs";
import { kindCount, laneBadge, laneKpi, laneRoom, runsBy } from "../../../lib/lane-room.mjs";

/** @typedef {import("../../../lib/registry.mjs").Payload} Payload */
/** @typedef {import("../../../lib/lane-room.mjs").RunRow} RunRow */

/**
 * @typedef {import("../../../lib/lane-room.mjs").LaneRoom & {
 *   badge: string,
 *   kpis: { key: string, v: string, l: string, sub: string }[],
 *   jobs: RunRow[],
 *   jobsTitle: string,
 *   showJobsEmpty: boolean,
 *   nextFire: import("../../../lib/registry.mjs").NotServed,
 *   fireVerb: { isVerbPending: true, verb: string, sentence: string },
 *   register: { isVerbPending: true, verb: string, sentence: string },
 *   lastFire: { hasFire: boolean, line: string, detail: string },
 *   heartbeat: import("../../../lib/registry.mjs").NotServed,
 * }} Folded
 */

/**
 * @param {Record<string, Payload>} payloads
 * @param {import("../../../lib/registry.mjs").FoldContext} ctx
 * @returns {Folded}
 */
export function fold(payloads, ctx) {
  const base = laneRoom(payloads, ctx, { files: ["hq-jobs"] });
  const ran = runsBy(base.trail.events, "job", ["exit_code", "duration_ms", "scheduled_for"]);
  const registered = holdsList(ctx.room, "jobs");
  const byName = new Map(ran.map((r) => [r.key, r]));
  /** @type {RunRow[]} */
  const jobs = registered.map((name) => byName.get(name) ?? {
    key: name, name, runs: "0 runs", last: base.trail.isDrawn ? "none on the page the door sent" : "reading its runs", when: "", detail: "",
  });
  // A job a receipt names that the registry does not is shown, and says so, rather than dropped.
  for (const r of ran) if (!registered.includes(r.key)) jobs.push({ ...r, detail: `not in the served registry · ${r.detail}` });
  const runTotal = base.trail.events.filter((e) => e.kind === "run.completed" && typeof e.payload["job"] === "string" && e.payload["job"] !== "").length;
  const newest = ran[0];

  return {
    ...base,
    badge: laneBadge(base),
    kpis: [
      laneKpi(base),
      { key: "jobs", v: fmtInt(registered.length), l: "Jobs on the clock", sub: "in the served registry" },
      { key: "runs", v: base.trail.isDrawn ? `${fmtInt(runTotal)}${base.trail.isPartial ? "+" : ""}` : "—", l: "Job runs recorded", sub: "run.completed naming a job" },
      { key: "last", v: newest === undefined ? "—" : newest.when, l: "Last fire recorded", sub: newest === undefined ? "no job run on the page" : newest.name },
      { key: "incidents", v: kindCount(base, "incident.raised"), l: "Incidents raised", sub: "incident.raised, all time" },
    ],
    jobs,
    jobsTitle: `The jobs — ${fmtInt(jobs.length)} on the clock`,
    showJobsEmpty: jobs.length === 0,
    nextFire: notServed(
      "Next fire and cadence",
      "/api/jobs",
      "Each job's cadence — daily or weekdays at a time, in IST — its next fire, and its overdue mark at twice the cadence, parsed from hq.jobs.yaml.",
    ),
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
        ? (base.trail.isDrawn ? "No job run on the page the door sent." : "")
        : `${newest.name} fired at ${newest.when} · ${newest.last}`,
      detail: newest === undefined ? "" : newest.detail,
    },
    heartbeat: notServed(
      "The heartbeat",
      "/api/jobs",
      "The clock's own proof of life: each job judged against its cadence, and a silent clock raised as an incident rather than inferred from the newest receipt.",
    ),
  };
}
