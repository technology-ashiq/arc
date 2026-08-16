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

/**
 * The trigger kinds `scheduler-task.ps1` accepts, named here so the Node side cannot emit a spec
 * the PowerShell side will refuse. Both halves are pinned together by a fixture that reads the
 * accepted kinds back OUT of the .ps1 -- a constant copied by hand into two files is a constant
 * that will disagree with itself eventually, and this one already did.
 */
export const TRIGGER_KINDS = Object.freeze(["daily", "weekdays"]);

export class SchedulerError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

const winPath = (p) => String(p).replace(/\//g, "\\");
const quoted = (s) => `"${String(s)}"`;

/**
 * THE TASK ACTION, BUILT IN ONE PLACE -- here, in Node, where it can be tested without an OS.
 *
 * It used to be assembled inside `scheduler-task.ps1` from a pre-joined argument string, and that
 * split cost three separate defects:
 *
 *   - `args.join(" ")` flattened the argv, so a repo path containing a SPACE registered a task
 *     that ran a truncated path every slot forever. Each argument is quoted individually now.
 *   - `cmd.exe` interprets `&`, `%VAR%`, `^`, `<`, `>` and `|`; a path carrying one of them could
 *     run a second command. `registrationFor` refuses those characters outright, and this
 *     function quotes everything it does accept.
 *   - the log directory was created at REGISTER time only. Delete it afterwards and cmd fails
 *     opening the redirect BEFORE the job starts -- exit 1, no log, no receipt, and Task
 *     Scheduler discards the reason. The mechanism added to make failures visible was the one
 *     making that failure invisible. The action now creates the directory each run.
 *
 * The PowerShell side is correspondingly dumber: it registers the execute/argument pair it is
 * handed and builds no command line of its own.
 */
export function taskActionLine({ command, args = [], logPath } = {}) {
  if (typeof command !== "string" || !command)
    throw new SchedulerError("BAD_COMMAND", "a task action needs an absolute command");
  const argv = (args || []).map((a) => quoted(winPath(a))).join(" ");
  if (!logPath) return { execute: command, argument: argv };

  const dir = winPath(String(logPath)).replace(/\\[^\\]*$/, "");
  const prog = `${quoted(winPath(command))}${argv ? ` ${argv}` : ""}`;
  return {
    execute: "cmd.exe",
    // NO CONDITIONAL IN THE COMMAND LINE, and this line cost a proving week.
    //
    // It used to read `if not exist DIR md DIR & PROG`. `cmd` binds the ENTIRE remainder of the
    // line to the IF, so once the directory existed -- which is every run after the first -- the
    // program never ran and cmd exited **0**. Task Scheduler recorded a successful run, no log
    // was written because nothing wrote one, and no receipt landed because nothing executed. A
    // job that reports success and does nothing is the precise failure this whole cycle exists to
    // detect, shipped inside the fix for a different one.
    //
    // Parenthesising the IF does not help: measured, `if not exist DIR (md DIR) & PROG` fails the
    // same way. The conditional has to go. `md` on an existing directory errors, `2>nul` swallows
    // that, and `&` then runs the program unconditionally -- there is nothing left for the parser
    // to bind.
    //
    // The fixture that missed it tested the directory-MISSING branch only, which is the first run
    // and never happens again. Both states are pinned now.
    argument: `/c "md ${quoted(dir)} 2>nul & ${prog} >> ${quoted(winPath(logPath))} 2>&1"`,
  };
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

    register(name, reg) {
      const { command, args = [], cwd, settings, trigger, logPath } = reg || {};
      assertTaskName(name);
      assertSettings(settings);
      if (typeof command !== "string" || !command)
        throw new SchedulerError("BAD_COMMAND", "register needs an absolute command to run");
      if (typeof cwd !== "string" || !cwd)
        throw new SchedulerError("BAD_CWD", "register needs an explicit working directory -- a task inheriting one runs somewhere nobody chose");
      if (typeof trigger !== "string" || !trigger)
        throw new SchedulerError("BAD_TRIGGER", "register needs a trigger");
      // THE FAKE STORES WHAT THE OS WOULD STORE: the built action line, not the argv. Task
      // Scheduler has no memory of an argument array -- it keeps one command line -- so a fake
      // that echoed the argv back would let `registerVerified`'s action check pass against the
      // double and fail against the machine, which is the exact drift the fake exists to prevent.
      const action = taskActionLine({ command, args, logPath });
      tasks.set(name, {
        name, cwd, trigger,
        command: action.execute,
        args: [...args],
        argumentLine: action.argument,
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
        // `arguments`, spelled the way `Get-ScheduledTask` spells it. The array is kept too, for
        // tests that want to look at the argv, but the string is what the contract compares.
        arguments: t.argumentLine,
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
      const action = taskActionLine({ command, args, logPath });
      return run([
        "-Action", "register", "-TaskName", name,
        "-Command", action.execute, "-Arguments", action.argument,
        "-WorkingDir", cwd, "-Trigger", trigger,
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
      // A shape that is not a list is a FAILED READ, never an empty machine. Coercing it to `[]`
      // made `arc-jobs unregister` print "0 arc task(s) remain -- the heartbeat is off" on a read
      // that had told it nothing: the same shape as `arc-event` exiting 0 on failure, which this
      // lane already paid for once.
      if (!Array.isArray(r?.tasks))
        throw new SchedulerError("BAD_OUTPUT", `list returned no task array: ${JSON.stringify(r).slice(0, 200)}`);
      return r.tasks;
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
  // The settings we SENT must themselves be the pinned six. Comparing the readback straight
  // against PINNED_SETTINGS would validate one thing and compare another: a caller that sent the
  // wrong settings and an OS that honoured them exactly would be reported as OS drift, and the
  // real fault -- the caller -- would never be named.
  const sent = reg?.settings || {};
  const mis = REQUIRED_SETTINGS.filter((k) => String(sent[k]) !== String(PINNED_SETTINGS[k]));
  if (mis.length)
    throw new SchedulerError(
      "UNPINNED_REGISTRATION",
      `refusing to register ${name}: the registration itself carries ${mis.join(", ")} differing from the pinned values`,
    );

  os.register(name, reg);

  const undo = (code, message) => {
    let removed = false;
    let why = "";
    try { removed = os.unregister(name).existed === true; }
    catch (e) { removed = false; why = ` (rollback failed: ${e?.code || ""} ${e?.message || e})`; }
    const err = new SchedulerError(code, message + why);
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
    .filter((k) => String(back.settings?.[k]) !== String(sent[k]))
    .map((k) => `${k}=${back.settings?.[k]} (wanted ${sent[k]})`);
  if (wrong.length)
    undo(
      "SETTINGS_DRIFT",
      `${name} came back off the OS with ${wrong.join(", ")} -- the task has been UNREGISTERED rather than left ` +
        `running with a setting nobody chose, because a job that looks scheduled and never fires is the one ` +
        `failure mode this readback exists to catch`,
    );

  // A REGISTRATION IS FOUR THINGS, NOT ONE. Verifying only the settings left the other three
  // unchecked, and each of them kills the job just as quietly:
  //   - a truncated argument line runs `arc-jobs.mjs` at a path that does not exist
  //   - a wrong working directory runs the job somewhere with no repo in it
  //   - a dropped log redirect throws away the only evidence a failing run leaves behind
  // The OS already returns all three from `query`; ignoring them was the omission.
  //
  // CONTAINMENT, not equality, and deliberately so: the action is wrapped in `cmd.exe /c` to get
  // the redirect, so what comes back is the wrapper's command line rather than the argv we sent.
  // Asserting equality against a string we did not construct here would pin this check to the
  // exact shape of that wrapper and break on the next honest change to it.
  // SEPARATORS ARE NORMALISED ON BOTH SIDES, and this is not cosmetic. `taskActionLine` writes
  // Windows separators into the command line because cmd.exe needs them, while `reg.args` carry
  // the forward slashes Node produced -- so a raw `includes` compares two spellings of the same
  // path and reports drift on every correct registration. The first version of this check did
  // exactly that, and it is the same "validate one read, compare another" shape the lane has
  // already paid for twice.
  const norm = (p) => String(p ?? "").replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
  const argline = norm(back.arguments ?? "");
  const missing = [];
  for (const a of reg.args || []) if (!argline.includes(norm(a))) missing.push(String(a));
  if (reg.logPath && !argline.includes(norm(reg.logPath))) missing.push(`the log redirect to ${reg.logPath}`);
  if (missing.length)
    undo(
      "ACTION_DRIFT",
      `${name} came back off the OS with an action missing ${missing.join(", ")} -- read back as ${JSON.stringify(String(back.arguments ?? "")).slice(0, 200)}`,
    );

  // Task Scheduler echoes back a Windows working directory even when it was handed a
  // forward-slash one, so this is compared normalised too.
  if (norm(back.cwd) !== norm(reg.cwd))
    undo("CWD_DRIFT", `${name} came back with working directory ${JSON.stringify(back.cwd)}, sent ${JSON.stringify(reg.cwd)}`);

  return back;
}

/**
 * The registration a job turns into. Pure, so the contract test can compare it byte-for-byte
 * without an OS anywhere near it -- and so Phase 2's real implementation is handed exactly the
 * same object the fake was.
 */
export function registrationFor(job, { repoRoot, nodePath, logDir }) {
  const [kind, hhmm] = String(job.cadence).split("@");

  // THE TRIGGER GRAMMAR IS CLOSED ON BOTH SIDES OF THE BOUNDARY, and this line is why.
  //
  // It used to emit `weekly:MON,TUE,WED,THU,FRI@HH:MM` for a weekdays job. `scheduler-task.ps1`
  // splits the spec on `@` and matches the part before it against exactly `daily` and `weekdays`,
  // so that string threw -- meaning NO weekdays job could ever be registered, and since
  // `arc-jobs register` with no name walks the enabled jobs in file order and the first one is
  // `brief-materialize`, the whole unattended surface was unregisterable.
  //
  // It survived a real-OS smoke because the smoke hand-typed `-Trigger daily@23:33` and never
  // went through this function, and it survived the contract test because that test asserted the
  // wrong string back. Two green checks, both looking away from the join.
  //
  // The other half of the old bug: `kind === "weekdays" ? ... : daily` mapped EVERY other kind
  // silently onto daily, so an unknown cadence became a plausible-looking wrong schedule instead
  // of a refusal.
  if (!TRIGGER_KINDS.includes(kind))
    throw new SchedulerError(
      "BAD_TRIGGER",
      `cadence kind ${JSON.stringify(kind)} is outside the closed grammar (${TRIGGER_KINDS.join(" | ")}) -- ` +
        `scheduler-task.ps1 refuses anything else, so emitting it here would fail at the OS boundary`,
    );
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(hhmm)))
    throw new SchedulerError("BAD_TRIGGER", `cadence time ${JSON.stringify(hhmm)} is not HH:MM`);

  // The task action is handed to `cmd.exe /c` on the PowerShell side so stdout and stderr can be
  // redirected -- Task Scheduler discards both otherwise, and there is no capture feature. That
  // makes cmd's metacharacters live: `&` would run a second command, `%VAR%` would be expanded,
  // and a `"` would end the quoting early. None of them can appear in a path we accept.
  for (const [label, value] of [["repoRoot", repoRoot], ["nodePath", nodePath], ["logDir", logDir]]) {
    if (typeof value !== "string" || !value)
      throw new SchedulerError("BAD_CONFIG", `registrationFor needs a ${label}`);
    const bad = String(value).match(/["%&^<>|\r\n]/);
    if (bad)
      throw new SchedulerError(
        "UNSAFE_PATH",
        `${label} contains ${JSON.stringify(bad[0])}, which cmd.exe would interpret rather than pass through -- ` +
          `refusing to build a task action around it`,
      );
  }

  return {
    name: job.name,
    command: nodePath,
    args: [`${repoRoot}/.claude/scripts/hq/arc-jobs.mjs`, "run", job.name, "--scheduled"],
    cwd: repoRoot,
    trigger: `${kind}@${hhmm}`,
    settings: { ...PINNED_SETTINGS },
    // Task Scheduler DISCARDS stdout and stderr unless the action redirects them; there is no
    // capture feature. Without this a failing job's only trace is an exit code.
    logPath: `${logDir}/${job.name}.log`,
  };
}
