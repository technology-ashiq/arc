/**
 * scheduler-os.mjs -- the OS scheduler behind ONE interface, with a fake that cannot drift.
 *
 * This is the plan's single external dependency. Phase 0 ships the interface and the FAKE and
 * proves the contract against it; Phase 2 ships the real Windows implementation and proves the
 * same contract against the live OS. That ordering is the fake-drift firewall: the fake is
 * written against the contract, not against whatever the real thing happened to do.
 *
 * THE FAKE'S ONE JOB IS TO BE STRICT ABOUT THE SETTINGS.
 * ADR-0803 pins five power/logon settings that must be written EXPLICITLY on every register,
 * and the reason is not tidiness -- the documented default of `DisallowStartIfOnBatteries` is
 * TRUE (a task simply does not start on battery), `StartWhenAvailable` defaults to FALSE (a
 * missed run is never caught up), and Microsoft's own pages CONTRADICT EACH OTHER on
 * `StopIfGoingOnBatteries`. A setting whose documented default is self-contradictory cannot be
 * inherited by anything claiming to be deterministic.
 *
 * So the fake REFUSES a registration that omits any of them. A fake that accepted a partial
 * registration would let the silent-death bug through in Phase 0 and hand it to Phase 2, where
 * it costs a real week of a real proving run to find.
 *
 * Zero dependencies, Node 18+.
 */

/** Every setting that must appear on every register. Omission is a refusal, not a default. */
export const REQUIRED_SETTINGS = Object.freeze([
  "DisallowStartIfOnBatteries",
  "StopIfGoingOnBatteries",
  "StartWhenAvailable",
  "WakeToRun",
  "LogonType",
  "RunLevel",
]);

/**
 * The values this lane pins, and why each one is not a default (ADR-0803, ADR-0804).
 * WakeToRun is false because `powercfg -a` on the host machine reports S0 Low Power Idle as the
 * ONLY available sleep state -- no S3, no hibernate -- and WakeToRun has no documented behaviour
 * on Modern Standby at all. A guarantee nobody specified is not a guarantee.
 */
export const PINNED_SETTINGS = Object.freeze({
  DisallowStartIfOnBatteries: false,
  StopIfGoingOnBatteries: false,
  StartWhenAvailable: true,
  WakeToRun: false,
  LogonType: "S4U",
  RunLevel: "Limited",
});

export class SchedulerError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

function assertTaskName(name) {
  if (typeof name !== "string" || !/^[a-z][a-z0-9-]*$/.test(name))
    throw new SchedulerError("BAD_NAME", `task name ${JSON.stringify(name)} is not a job name`);
}

function assertSettings(settings) {
  if (!settings || typeof settings !== "object")
    throw new SchedulerError("BAD_SETTINGS", "settings must be an object naming every pinned value");
  const missing = REQUIRED_SETTINGS.filter((k) => !Object.prototype.hasOwnProperty.call(settings, k));
  if (missing.length)
    throw new SchedulerError(
      "INCOMPLETE_SETTINGS",
      `register omitted ${missing.join(", ")} -- every power and logon setting is written explicitly on every ` +
        `registration, because the documented default of DisallowStartIfOnBatteries is TRUE and of ` +
        `StartWhenAvailable is FALSE, and the official pages contradict each other on StopIfGoingOnBatteries. ` +
        `An inherited default is the silent-death bug this refusal exists to prevent`,
    );
}

/**
 * The in-memory fake. Same surface as the real implementation, and deliberately stricter than a
 * permissive stub: it enforces the settings contract, is idempotent on re-register, and reports
 * a never-run task the way Task Scheduler does.
 */
export function makeFakeScheduler() {
  const tasks = new Map();
  return {
    kind: "fake",

    register(name, { command, args = [], cwd, settings, trigger }) {
      assertTaskName(name);
      assertSettings(settings);
      if (typeof command !== "string" || !command)
        throw new SchedulerError("BAD_COMMAND", "register needs an absolute command to run");
      if (typeof cwd !== "string" || !cwd)
        throw new SchedulerError("BAD_CWD", "register needs an explicit working directory -- a task inheriting one runs somewhere nobody chose");
      if (typeof trigger !== "string" || !trigger)
        throw new SchedulerError("BAD_TRIGGER", "register needs a trigger");
      // Idempotent by overwrite, which is what `Register-ScheduledTask -Force` does. A register
      // that appended would leave two tasks firing the same job at the same minute.
      tasks.set(name, {
        name, command, args: [...args], cwd, trigger,
        settings: { ...settings },
        lastRunTime: null,
        lastTaskResult: 0x41303, // SCHED_S_TASK_HAS_NOT_RUN, exactly as the real API reports it
      });
      return { ok: true, created: true };
    },

    unregister(name) {
      assertTaskName(name);
      const had = tasks.delete(name);
      return { ok: true, existed: had };
    },

    query(name) {
      assertTaskName(name);
      const t = tasks.get(name);
      if (!t) return { exists: false };
      return {
        exists: true,
        command: t.command,
        args: [...t.args],
        cwd: t.cwd,
        trigger: t.trigger,
        settings: { ...t.settings },
        lastRunTime: t.lastRunTime,
        lastTaskResult: t.lastTaskResult,
      };
    },

    list() { return [...tasks.keys()].sort(); },

    /** Test-only: pretend the OS fired the task and recorded a result. */
    _simulateRun(name, { lastTaskResult = 0, lastRunTime = "2026-08-12T00:15:00+05:30" } = {}) {
      const t = tasks.get(name);
      if (!t) throw new SchedulerError("NO_TASK", `no task named ${name}`);
      t.lastRunTime = lastRunTime;
      t.lastTaskResult = lastTaskResult;
    },
  };
}

/**
 * The registration a job turns into. Pure, so the contract test can compare it byte-for-byte
 * without an OS anywhere near it -- and so Phase 2's real implementation is handed exactly the
 * same object the fake was.
 */
export function registrationFor(job, { repoRoot, nodePath, logDir }) {
  const [kind, hhmm] = String(job.cadence).split("@");
  return {
    name: job.name,
    command: nodePath,
    args: [`${repoRoot}/.claude/scripts/hq/arc-jobs.mjs`, "run", job.name, "--scheduled"],
    cwd: repoRoot,
    trigger: kind === "weekdays" ? `weekly:MON,TUE,WED,THU,FRI@${hhmm}` : `daily@${hhmm}`,
    settings: { ...PINNED_SETTINGS },
    // Task Scheduler DISCARDS stdout and stderr unless the action redirects them; there is no
    // capture feature. Without this a failing job's only trace is an exit code.
    logPath: `${logDir}/${job.name}.log`,
  };
}
