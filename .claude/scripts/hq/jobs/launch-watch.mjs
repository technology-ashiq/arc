#!/usr/bin/env node
/**
 * launch-watch.mjs -- the weekly watch on every launched venture (launch REQ-10, ADR-1716, ADR-1750).
 *
 * The schedule grammar has only `daily@` and `weekdays@` (ADR-0802), so the job runs daily and acts once every seven
 * days: the last run's IST day is kept in instance state, never in the repo. Acting means one
 * `arc-launch verify --all --public-only` per venture board on this box. A slot whose token is not here is
 * skipped(env) and stays out of the brief; a regression is raised once as incident.raised by the runner itself.
 *
 * IT SHELLS OUT TO arc-launch RATHER THAN RE-PROBING: the runner owns verify, receipts and the needs-you line, and a
 * second prober here would be a second truth about what "watched" means. Zero dependencies, Node 18+.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { formatIst, dayOf, nowMs } from "../lib/canonical.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..", "..", "..");
const ARC_LAUNCH = join(REPO, ".claude", "scripts", "launch", "arc-launch.mjs");
const STATE_DIR = process.env.ARC_LAUNCH_STATE_DIR || join(REPO, ".claude", "state", "launch");
const STAMP = join(STATE_DIR, ".watch-last");
const EVERY_DAYS = 7;
const SLUG = /^[a-z][a-z0-9-]{1,63}$/;

function daysBetween(a, b) {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
}

function main() {
  const today = dayOf(formatIst(nowMs()));
  const last = existsSync(STAMP) ? readFileSync(STAMP, "utf8").trim() : "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(last) && daysBetween(last, today) < EVERY_DAYS) {
    process.stdout.write(`launch-watch: last ran ${last}; next on or after ${EVERY_DAYS - daysBetween(last, today)} more day(s)\n`);
    return 0;
  }
  const boards = existsSync(STATE_DIR) ? readdirSync(STATE_DIR).filter((f) => f.endsWith(".json") && !f.startsWith(".")).map((f) => f.slice(0, -5)).filter((s) => SLUG.test(s)) : [];
  let failed = 0;
  for (const slug of boards.sort()) {
    const r = spawnSync(process.execPath, [ARC_LAUNCH, "verify", "--all", "--public-only", "--venture", slug, "--state-dir", STATE_DIR],
      { encoding: "utf8", windowsHide: true, maxBuffer: 16 * 1024 * 1024, timeout: 3600 * 1000, killSignal: "SIGKILL" });
    process.stdout.write(`launch-watch: ${slug} exit ${r.status}\n${(r.stdout || "").split("\n").slice(-3).join("\n")}\n`);
    // Exit 1 is a regression the runner already raised to needs-you; anything else non-zero is the watch failing.
    if (r.status !== 0 && r.status !== 1) failed++;
  }
  mkdirSync(STATE_DIR, { recursive: true });
  writeFileSync(STAMP, `${today}\n`);
  process.stdout.write(`launch-watch: ${boards.length} board(s) watched on ${today}${failed ? ` · ${failed} watch run(s) failed` : ""}\n`);
  return failed ? 1 : 0;
}

process.exitCode = main();
