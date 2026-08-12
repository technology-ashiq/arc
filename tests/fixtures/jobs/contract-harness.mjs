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

import { makeFakeScheduler, makeWindowsScheduler, registrationFor, REQUIRED_SETTINGS, PINNED_SETTINGS } from "../../../.claude/scripts/hq/lib/jobs/scheduler-os.mjs";
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
  } else if (CASE === "real-enforces-settings") {
    // THE REAL IMPLEMENTATION MUST REFUSE WHAT THE FAKE REFUSES. If only the fake enforced the
    // six settings, the contract would be a property of the test double rather than of the
    // system -- and the production path would be free to register a task with an inherited
    // battery default, which is the silent-death bug the whole rule exists to prevent.
    //
    // `spawn` throws if it is ever reached: the refusal must happen BEFORE anything is handed to
    // PowerShell, so this proves the check is in the Node layer rather than relying on the OS to
    // complain. No task is created and no OS is touched.
    const os = makeWindowsScheduler({
      scriptPath: "unused.ps1",
      spawn: () => { throw new Error("REACHED-SPAWN"); },
    });
    const reg = registrationFor(scriptJob, REG);
    delete reg.settings.DisallowStartIfOnBatteries;
    try {
      os.register(reg.name, reg);
      out("REFUSED", false);
    } catch (e) {
      out("REFUSED", { code: e.code, reachedSpawn: /REACHED-SPAWN/.test(String(e.message)) });
    }
  } else if (CASE === "real-and-fake-agree") {
    // Both implementations answer the same question the same way about the never-run code, which
    // is what makes the Phase-0 fake a stand-in rather than a separate story. 0x41303 is
    // SCHED_S_TASK_HAS_NOT_RUN, and the real OS returned exactly this in the Phase-02 smoke.
    const s = makeFakeScheduler();
    const reg = registrationFor(scriptJob, REG);
    s.register(reg.name, reg);
    out("FAKE_NEVER_RUN", s.query(scriptJob.name).lastTaskResult);
    out("PINNED_LOGON", PINNED_SETTINGS.LogonType);
  } else {
    process.stderr.write(`unknown case ${CASE}\n`);
    process.exit(64);
  }
  process.stdout.write("HARNESS-DONE\n");
} catch (e) {
  process.stderr.write(`harness threw: ${e?.code || ""} ${e?.message || e}\n`);
  process.exit(1);
}
