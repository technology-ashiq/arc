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

const BOARD_MS = 8 * 60 * 1000;
const RUN_MS = 25 * 60 * 1000;

function daysBetween(a, b) {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
}

// One board's watch counts as done only when the runner finished and named every regression it raised: a timeout, a
// kill or a lost raise is the watch failing (attack 143525f B3, B4).
function watched(r) {
  if (r.error || r.signal || r.status === null) return false;
  if (r.status === 0) return true;
  if (r.status !== 1) return false;
  const last = (r.stdout || "").split("\n").map((l) => l.trim()).filter(Boolean).pop() || "";
  const m = /^watch-result failed=(\d+) raised=(\d+)$/.exec(last);
  return !!m && Number(m[1]) > 0 && m[1] === m[2];
}

// The stamp is per board: {slug: day}. One board that keeps failing retries daily on its own, and the boards that were
// watched wait their seven days instead of re-raising their regressions every day (attack 530c056 B2).
function readStamps() {
  try {
    const v = JSON.parse(readFileSync(STAMP, "utf8"));
    return v && typeof v === "object" && !Array.isArray(v) ? v : {};
  } catch {
    return {};
  }
}

function main() {
  const today = dayOf(formatIst(nowMs()));
  const stamps = readStamps();
  const boards = existsSync(STATE_DIR) ? readdirSync(STATE_DIR).filter((f) => f.endsWith(".json") && !f.startsWith(".")).map((f) => f.slice(0, -5)).filter((s) => SLUG.test(s)) : [];
  // A stamp in the future (clock skew, a hand edit) is no stamp: it would otherwise skip that board for ever (B6).
  const ageOf = (slug) => (typeof stamps[slug] === "string" && /^\d{4}-\d{2}-\d{2}$/.test(stamps[slug]) ? daysBetween(stamps[slug], today) : NaN);
  const due = boards.sort().filter((slug) => !(ageOf(slug) >= 0 && ageOf(slug) < EVERY_DAYS));
  const until = Date.now() + RUN_MS;
  let failed = 0;
  for (const slug of due) {
    // Each board gets at most BOARD_MS and the run stays inside the job's 30-minute budget; a board the clock left
    // unwatched counts as failed and is not stamped (B5).
    const left = until - Date.now();
    if (left < 60 * 1000) { process.stdout.write(`launch-watch: ${slug} not watched -- the run's time is spent\n`); failed++; continue; }
    const r = spawnSync(process.execPath, [ARC_LAUNCH, "verify", "--all", "--public-only", "--venture", slug, "--state-dir", STATE_DIR],
      { encoding: "utf8", windowsHide: true, maxBuffer: 16 * 1024 * 1024, timeout: Math.min(BOARD_MS, left), killSignal: "SIGKILL" });
    const how = r.error ? `error ${r.error.code || "spawn"}` : r.signal ? `signal ${r.signal}` : `exit ${r.status}`;
    process.stdout.write(`launch-watch: ${slug} ${how}\n${(r.stdout || "").split("\n").slice(-3).join("\n")}\n`);
    // A board is stamped only when it was watched; a failed one retries tomorrow, not in seven days (B5).
    if (watched(r)) stamps[slug] = today;
    else failed++;
  }
  // Boards that no longer exist leave the stamp file.
  const kept = Object.fromEntries(boards.filter((s) => typeof stamps[s] === "string").map((s) => [s, stamps[s]]));
  mkdirSync(STATE_DIR, { recursive: true });
  writeFileSync(STAMP, `${JSON.stringify(kept)}\n`);
  process.stdout.write(`launch-watch: ${due.length} of ${boards.length} board(s) due on ${today}${failed ? ` · ${failed} not watched, retried next run` : " · all due boards watched"}\n`);
  return failed ? 1 : 0;
}

process.exitCode = main();
