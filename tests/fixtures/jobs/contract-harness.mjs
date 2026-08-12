#!/usr/bin/env node
/**
 * contract-harness.mjs -- drives the OS-scheduler fake and the process-job delegation builder.
 *
 * It PRINTS DATA and asserts nothing. The assertions belong in the bats file where they are
 * visible; a harness that judged its own output would be a test whose failures nobody can read.
 *
 * Usage: node contract-harness.mjs <case>
 *   roundtrip    -- register, query, unregister against the fake; prints each step as JSON
 *   incomplete   -- register while omitting one pinned setting; prints the refusal code
 *   idempotent   -- register twice; prints the task count
 *   neverrun     -- prints lastTaskResult before any run (Task Scheduler reports a code, not null)
 *   delegate     -- prints the scheduled and manual argv for one process-job
 */

import { makeFakeScheduler, registrationFor, REQUIRED_SETTINGS, PINNED_SETTINGS } from "../../../.claude/scripts/hq/lib/jobs/scheduler-os.mjs";
import { processRunArgv, manualRunArgv } from "../../../.claude/scripts/hq/lib/jobs/delegate.mjs";

const CASE = process.argv[2];
const out = (label, value) => process.stdout.write(`${label}:${JSON.stringify(value)}\n`);

const scriptJob = { name: "day-close-roll", type: "script", cadence: "daily@00:15", budget: { min: 2 } };
const weekdayJob = { name: "brief-materialize", type: "script", cadence: "weekdays@06:00", budget: { min: 2 } };
const procJob = { name: "some-proc", type: "process", entry: "kickoff-plan", cadence: "daily@09:00", budget: { min: 5, inr: 40 } };

const REG = { repoRoot: "/repo", nodePath: "/usr/bin/node", logDir: "/repo/logs" };

try {
  if (CASE === "roundtrip") {
    const s = makeFakeScheduler();
    const reg = registrationFor(scriptJob, REG);
    out("REGISTRATION", reg);
    s.register(reg.name, reg);
    out("QUERY", s.query("day-close-roll"));
    out("LIST", s.list());
    s.unregister("day-close-roll");
    out("AFTER_UNREGISTER", s.query("day-close-roll"));
    out("REQUIRED", REQUIRED_SETTINGS);
    out("WEEKDAY_TRIGGER", registrationFor(weekdayJob, REG).trigger);
  } else if (CASE === "incomplete") {
    const s = makeFakeScheduler();
    const reg = registrationFor(scriptJob, REG);
    delete reg.settings.StartWhenAvailable;
    try { s.register(reg.name, reg); out("REFUSED", false); }
    catch (e) { out("REFUSED", { code: e.code, mentions: /StartWhenAvailable/.test(e.message) }); }
  } else if (CASE === "idempotent") {
    const s = makeFakeScheduler();
    const reg = registrationFor(scriptJob, REG);
    s.register(reg.name, reg);
    s.register(reg.name, reg);
    out("COUNT", s.list().length);
  } else if (CASE === "neverrun") {
    const s = makeFakeScheduler();
    const reg = registrationFor(scriptJob, REG);
    s.register(reg.name, reg);
    out("BEFORE", s.query("day-close-roll").lastTaskResult);
    s._simulateRun("day-close-roll", { lastTaskResult: 0 });
    out("AFTER", s.query("day-close-roll").lastTaskResult);
  } else if (CASE === "delegate") {
    const scheduled = processRunArgv(procJob, { arcRunPath: "/repo/arc-run.mjs" });
    const manual = manualRunArgv(procJob, { arcRunPath: "/repo/arc-run.mjs" });
    out("SCHEDULED", scheduled);
    out("MANUAL", manual);
    out("IDENTICAL", JSON.stringify(scheduled) === JSON.stringify(manual));
    out("PINNED", PINNED_SETTINGS);
  } else {
    process.stderr.write(`unknown case ${CASE}\n`);
    process.exit(64);
  }
  process.stdout.write("HARNESS-DONE\n");
} catch (e) {
  process.stderr.write(`harness threw: ${e?.code || ""} ${e?.message || e}\n`);
  process.exit(1);
}
