#!/usr/bin/env node
/**
 * action-line-harness.mjs -- runs the task action line THIS REPO WOULD REGISTER, on this machine,
 * without registering anything.
 *
 * Task Scheduler concatenates the action's Execute and Arguments into one command line and hands
 * it to CreateProcess untouched. So does this harness, via `windowsVerbatimArguments` -- without
 * it Node applies its own backslash-escaping of the inner quotes, which cmd.exe does not
 * understand, and the failure would be the harness rather than the line under test. That
 * distinction cost one confusing red before it was spotted.
 *
 * THE PATH IT USES CONTAINS A SPACE, deliberately. The old builder joined argv with spaces into
 * one unquoted string, so a repo under a path with a space registered a task that ran a truncated
 * path every slot, forever, with the OS reporting nothing but an exit code.
 *
 * AND IT DELETES THE LOG DIRECTORY FIRST. The directory used to be created at register time only;
 * remove it afterwards and cmd fails opening the redirect BEFORE the job starts -- so the job
 * never runs and the mechanism added to make failures visible is the one hiding this one.
 *
 * Windows only. It creates and removes a directory under TEMP and starts one short-lived node
 * process. It never touches Task Scheduler.
 *
 * Usage: node action-line-harness.mjs
 */

import { spawnSync } from "node:child_process";
import { existsSync, rmSync, readFileSync } from "node:fs";
import { taskActionLine, registrationFor } from "../../../.claude/scripts/hq/lib/jobs/scheduler-os.mjs";

const out = (label, value) => process.stdout.write(`${label}:${JSON.stringify(value)}\n`);

try {
  if (process.platform !== "win32") {
    out("SKIPPED", "not win32");
    process.stdout.write("HARNESS-DONE\n");
    process.exit(0);
  }

  const base = `${String(process.env.TEMP).replace(/\\/g, "/")}/arc probe dir`;
  const logDir = `${base}/job-logs`;
  const common = { repoRoot: `${base}/repo`, nodePath: process.execPath, logDir };

  // The two triggers this repo actually registers, built by the real function.
  out("DAILY_TRIGGER", registrationFor(
    { name: "day-close-roll", type: "script", cadence: "daily@00:15", budget: { min: 2 } }, common).trigger);
  out("WEEKDAY_TRIGGER", registrationFor(
    { name: "brief-materialize", type: "script", cadence: "weekdays@06:00", budget: { min: 2 } }, common).trigger);

  // `String.fromCharCode` rather than a literal: the marker must not be a word this file could be
  // matched on by accident, and no apostrophe or backtick goes anywhere near a command line here.
  const probe = taskActionLine({
    command: process.execPath,
    args: ["-e", "console.log(String.fromCharCode(104,105))"],
    logPath: `${logDir}/probe.log`,
  });
  out("EXECUTE", probe.execute);

  const logFile = `${logDir}/probe.log`;
  const fire = () => {
    if (existsSync(logFile)) rmSync(logFile, { force: true });
    const r = spawnSync(probe.execute, [probe.argument], {
      encoding: "utf8", windowsHide: true, shell: false, windowsVerbatimArguments: true,
    });
    return {
      exit: r.error ? `spawn:${r.error.code}` : r.status,
      stderr: String(r.stderr || "").trim().slice(0, 160),
      dir: existsSync(logDir),
      body: existsSync(logFile) ? readFileSync(logFile, "utf8").trim() : null,
    };
  };

  // FIRST RUN -- the log directory does not exist. The action has to create it.
  if (existsSync(base)) rmSync(base, { recursive: true, force: true });
  out("LOGDIR_BEFORE", existsSync(logDir));
  const first = fire();
  out("FIRST", first);

  // EVERY RUN AFTER THAT -- the directory is already there. This is the case the original fixture
  // never asked about, and it is the one that shipped: `if not exist DIR md DIR & PROG` binds the
  // whole line to the IF, so the program never ran and cmd still exited 0. Task Scheduler
  // recorded a successful run of a job that did nothing, every slot, for three days.
  const second = fire();
  out("SECOND", second);

  rmSync(base, { recursive: true, force: true });
  process.stdout.write("HARNESS-DONE\n");
} catch (e) {
  process.stderr.write(`harness threw: ${e?.code || ""} ${e?.message || e}\n`);
  process.exit(1);
}
