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
  // Interactive, NOT S4U -- and this was measured rather than chosen. ADR-0803 pinned S4U on the
  // documented grounds that it runs unattended with no stored password; registering it on this
  // machine fails `HRESULT 0x80070005` (access denied) because S4U needs elevation, while the
  // same registration under Interactive succeeds. See ADR-0803 Amendment 1.
  //
  // The honest consequence, stated rather than buried: these jobs run only while the user is
  // LOGGED ON. On this machine that costs less than it sounds -- it is Modern-Standby-only and is
  // never woken for a slot (ADR-0804), so it is asleep whenever nobody is at it, and
  // StartWhenAvailable plus `catchup: run` is already the mechanism that makes a missed slot
  // land later rather than vanish.
  LogonType: "Interactive",
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
 * The REAL Windows implementation, behind the identical surface the fake presents.
 *
 * Everything Windows-facing lives in `scheduler-task.ps1` and is invoked with `-File` plus typed
 * parameters. Nothing is interpolated into a command line: a program embedded in a shell string
 * carries no apostrophes, PowerShell is full of them, and this repo has shipped that bug twice
 * in one file -- the second time inside the comment explaining the first.
 *
 * `schtasks.exe` is deliberately not used. Its documented parameter table has NO switch for
 * battery, wake, or run-when-missed, so the settings that decide whether a job ever fires cannot
 * be expressed through it at all.
 */
export function makeWindowsScheduler({ psBin = "powershell", scriptPath, spawn } = {}) {
  if (!scriptPath) throw new SchedulerError("BAD_CONFIG", "the Windows scheduler needs the path to scheduler-task.ps1");
  const run = (args) => {
    const r = spawn(psBin, ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", scriptPath, ...args], {
      encoding: "utf8", windowsHide: true, maxBuffer: 8 * 1024 * 1024,
    });
    if (r.error) throw new SchedulerError("SPAWN_FAILED", `${psBin}: ${r.error.code || r.error.message}`);
    if (r.status !== 0)
      throw new SchedulerError("PS_FAILED", String(r.stderr || r.stdout || "").trim().slice(0, 600));
    const out = String(r.stdout || "").trim();
    // A PowerShell command that printed nothing has NOT succeeded quietly -- it has failed to
    // report, and treating that as an empty success is how a registration nobody made reads as
    // a registration that exists.
    if (!out) throw new SchedulerError("NO_OUTPUT", "the PowerShell side returned no JSON at all");
    try { return JSON.parse(out.split("\n").pop()); }
    catch { throw new SchedulerError("BAD_OUTPUT", `unparseable output: ${out.slice(0, 300)}`); }
  };

  return {
    kind: "windows",

    register(name, { command, args = [], cwd, settings, trigger, logPath }) {
      assertTaskName(name);
      // The SAME refusal the fake makes, on the same six names. If only the fake enforced it, the
      // contract would be a property of the test double rather than of the system.
      assertSettings(settings);
      if (typeof command !== "string" || !command) throw new SchedulerError("BAD_COMMAND", "register needs an absolute command");
      if (typeof cwd !== "string" || !cwd) throw new SchedulerError("BAD_CWD", "register needs an explicit working directory");
      if (typeof trigger !== "string" || !trigger) throw new SchedulerError("BAD_TRIGGER", "register needs a trigger");
      return run([
        "-Action", "register", "-TaskName", name, "-Command", command,
        "-Arguments", args.join(" "), "-WorkingDir", cwd, "-Trigger", trigger,
        ...(logPath ? ["-LogPath", logPath] : []),
      ]);
    },

    unregister(name) {
      assertTaskName(name);
      return run(["-Action", "unregister", "-TaskName", name]);
    },

    query(name) {
      assertTaskName(name);
      return run(["-Action", "query", "-TaskName", name]);
    },

    list() {
      const r = run(["-Action", "list"]);
      return Array.isArray(r.tasks) ? r.tasks : [];
    },
  };
}

/**
 * REGISTER, THEN READ THE SETTINGS BACK OFF THE OS -- and if they disagree, take the task away
 * again. Asserting what we SENT would prove only that we sent it.
 *
 * The rollback is the point, and it is the fail-closed direction for this surface. Three outcomes
 * are possible after a register, and they are not equally bad:
 *
 *   registered and correct   -- the heartbeat is on
 *   not registered at all    -- the heartbeat is off, and visibly so
 *   registered and WRONG     -- the heartbeat looks on and is dead
 *
 * The third is the silent-death bug the whole settings rule exists to prevent, so a drifted
 * readback must not be left standing on the machine with a warning printed next to it. A warning
 * on an unattended surface is a thing nobody reads at 00:15.
 *
 * Both callers get the same behaviour because there is one function: the CLI and the contract
 * test drive THIS, not two copies of it.
 */
export function registerVerified(os, name, reg) {
  os.register(name, reg);

  const undo = (code, message) => {
    let removed = false;
    try { removed = os.unregister(name).existed === true; } catch { removed = false; }
    const err = new SchedulerError(code, message);
    err.rolledBack = removed;
    throw err;
  };

  let back;
  try { back = os.query(name); }
  catch (e) { undo("READBACK_FAILED", `${name} was registered and could not be read back: ${e?.message || e}`); }

  if (!back || back.exists !== true)
    undo("NOT_REPORTED", `${name} was registered and the OS does not report it -- a registration nobody can see is not a registration`);

  // String() on both sides: the PowerShell boundary hands back JSON booleans, and a setting that
  // came back MISSING stringifies to "undefined", which is a mismatch rather than a pass.
  const wrong = REQUIRED_SETTINGS
    .filter((k) => String(back.settings?.[k]) !== String(PINNED_SETTINGS[k]))
    .map((k) => `${k}=${back.settings?.[k]} (wanted ${PINNED_SETTINGS[k]})`);
  if (wrong.length)
    undo(
      "SETTINGS_DRIFT",
      `${name} came back off the OS with ${wrong.join(", ")} -- the task has been UNREGISTERED rather than left ` +
        `running with a setting nobody chose, because a job that looks scheduled and never fires is the one ` +
        `failure mode this readback exists to catch`,
    );

  return back;
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
