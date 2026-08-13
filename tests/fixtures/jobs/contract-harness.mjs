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

import { makeFakeScheduler, makeWindowsScheduler, registerVerified, registrationFor, REQUIRED_SETTINGS, PINNED_SETTINGS, TRIGGER_KINDS } from "../../../.claude/scripts/hq/lib/jobs/scheduler-os.mjs";
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
  } else if (CASE === "verify-ok") {
    // THE NEGATIVE CONTROL for every drift case below. A `registerVerified` that rolled back
    // unconditionally would satisfy all of them and leave the machine with no heartbeat at all,
    // so the honest readback must be shown to SURVIVE.
    const s = makeFakeScheduler();
    const reg = registrationFor(scriptJob, REG);
    const back = registerVerified(s, reg.name, reg);
    out("KEPT", s.list());
    out("EXISTS", back.exists);
    out("LOGON_BACK", back.settings.LogonType);
  } else if (CASE === "trigger-grammar") {
    // What `registrationFor` emits for the two cadences this repo actually schedules, plus what
    // it does with a kind the PowerShell side would refuse. The old version emitted
    // `weekly:MON,TUE,WED,THU,FRI@HH:MM`, which the .ps1 rejects -- so no weekdays job could be
    // registered at all -- and mapped every unknown kind silently onto `daily`.
    const mk = (cadence) => registrationFor({ name: "day-close-roll", type: "script", cadence, budget: { min: 2 } }, REG);
    out("KINDS", TRIGGER_KINDS);
    out("DAILY", mk("daily@00:15").trigger);
    out("WEEKDAYS", mk("weekdays@06:00").trigger);
    for (const bad of ["weekly", "hourly", "monthly", "", "daily@bad"]) {
      try { out(`ACCEPTED_${bad || "empty"}`, mk(`${bad}@06:00`).trigger); }
      catch (e) { out(`REFUSED_${bad || "empty"}`, e.code); }
    }
  } else if (CASE === "verify-action-drift" || CASE === "verify-cwd-drift") {
    // The registration is FOUR things, and only the settings used to be verified. A truncated
    // argument line runs a path that does not exist; a dropped redirect throws away the only
    // evidence a failing run leaves; a wrong working directory runs the job somewhere with no
    // repo in it. All three read back GREEN before this.
    const inner = makeFakeScheduler();
    const mutate = CASE === "verify-action-drift"
      ? (q) => ({ ...q, arguments: String(q.arguments).replace(/ >> .*$/, "") })   // the log redirect gone
      : (q) => ({ ...q, cwd: "/somewhere/else" });
    const s = { ...inner, query(name) { const q = inner.query(name); return q.exists ? mutate(q) : q; } };
    const reg = registrationFor(scriptJob, REG);
    try { registerVerified(s, reg.name, reg); out("REFUSED", false); }
    catch (e) { out("REFUSED", { code: e.code, rolledBack: e.rolledBack === true }); }
    out("LEFT_BEHIND", inner.list());
  } else if (CASE === "verify-unpinned-send") {
    // The caller sent the wrong settings and the OS honoured them exactly. Comparing the readback
    // against PINNED_SETTINGS would blame the OS; the fault is the registration itself.
    const s = makeFakeScheduler();
    const reg = registrationFor(scriptJob, REG);
    reg.settings.StartWhenAvailable = false;
    try { registerVerified(s, reg.name, reg); out("REFUSED", false); }
    catch (e) { out("REFUSED", { code: e.code }); }
    out("LEFT_BEHIND", s.list());
  } else if (CASE === "verify-drift" || CASE === "verify-missing" || CASE === "verify-unseen") {
    // A scheduler that ACCEPTS the registration and then reports something else back. This is the
    // failure the readback exists for: the OS is entitled to apply its own value, and a task that
    // exists with an inherited `DisallowStartIfOnBatteries = true` looks perfectly healthy in
    // every list and simply never fires on battery.
    const inner = makeFakeScheduler();
    const mutate = {
      "verify-drift": (q) => ({ ...q, settings: { ...q.settings, DisallowStartIfOnBatteries: true } }),
      "verify-missing": (q) => {
        const settings = { ...q.settings };
        delete settings.StartWhenAvailable;
        return { ...q, settings };
      },
      "verify-unseen": () => ({ exists: false }),
    }[CASE];
    const s = {
      ...inner,
      query(name) { const q = inner.query(name); return q.exists ? mutate(q) : q; },
    };
    const reg = registrationFor(scriptJob, REG);
    try {
      registerVerified(s, reg.name, reg);
      out("REFUSED", false);
    } catch (e) {
      out("REFUSED", { code: e.code, rolledBack: e.rolledBack === true });
    }
    // The assertion that matters. Refusing loudly while leaving the wrong task standing would be
    // the worst of the three outcomes: a heartbeat that looks on and is dead.
    out("LEFT_BEHIND", inner.list());
  } else {
    process.stderr.write(`unknown case ${CASE}\n`);
    process.exit(64);
  }
  process.stdout.write("HARNESS-DONE\n");
} catch (e) {
  process.stderr.write(`harness threw: ${e?.code || ""} ${e?.message || e}\n`);
  process.exit(1);
}
