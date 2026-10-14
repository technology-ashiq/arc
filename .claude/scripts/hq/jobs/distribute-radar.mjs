#!/usr/bin/env node
/**
 * distribute-radar.mjs -- the weekly look at every project arc is installed in (distribute REQ-19, ADR-2026).
 *
 * The schedule grammar has only `daily@` and `weekdays@` (ADR-0802), so the job runs daily and acts once every seven
 * days, keeping the last day it acted in instance state, as launch-watch does. Acting means `arc outdated --all` over
 * the local consumer registry (`~/.arc-private/consumers.json`, or ARC_PRIVATE_DIR) and one `metric.observed`
 * receipt: value = projects behind, unit_count = projects registered. No path, name or commit of a consumer enters the
 * receipt; the spine is a tracked file on a public repo. The per-project lines go to stdout, i.e. the job log.
 *
 * IT ONLY READS. `outdated` never writes inside a consumer; nothing here calls `upgrade`, which is one project at a time
 * and the owner's command. ₹0: no model is called.
 *
 * ARC_RADAR_STATE_DIR and ARC_RADAR_FORCE=1 are test doors (the state location; act today regardless of the stamp).
 * Exit 0 acted or not due · 1 the registry could not be read, or the receipt could not be emitted. Zero deps, Node 18+.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { formatIst, dayOf, nowMs } from "../lib/canonical.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..", "..", "..");
const STATE_DIR = process.env.ARC_RADAR_STATE_DIR || join(REPO, ".claude", "state", "distribute");
const STAMP = join(STATE_DIR, ".radar-last");
const EVERY_DAYS = 7;

const daysBetween = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);

async function main() {
  const now = formatIst(nowMs());
  const today = dayOf(now);
  let last = null;
  try { last = readFileSync(STAMP, "utf8").trim(); } catch { last = null; }
  // A stamp in the future (clock skew, a hand edit) is no stamp: it would skip the radar for ever.
  const age = last && /^\d{4}-\d{2}-\d{2}$/.test(last) ? daysBetween(last, today) : NaN;
  if (process.env.ARC_RADAR_FORCE !== "1" && age >= 0 && age < EVERY_DAYS) {
    process.stdout.write(`distribute-radar: not due (last acted ${last}, every ${EVERY_DAYS} days)\n`);
    return 0;
  }
  const L = await import(pathToFileURL(join(REPO, ".claude", "scripts", "engine", "install-targets", "lifecycle.mjs")).href);
  const r = L.outdatedAll(REPO);
  for (const l of r.lines) process.stdout.write(`${l}\n`);
  if (!r.counts) { process.stdout.write("distribute-radar: registry unreadable -- nothing emitted, retried next run\n"); return 1; }
  // The window is the seven days this run looks back over, ending now; both ends are IST like every spine time.
  const start = formatIst(nowMs() - EVERY_DAYS * 86400000);
  const payload = {
    module: "distribute", surface: "consumers", metric: "behind",
    value: r.counts.behind, unit_count: r.counts.consumers,
    window_start: start, window_end: now, source_id: `radar-${today}`,
  };
  const e = spawnSync("bash", [join(REPO, ".claude", "scripts", "hq", "arc-event.sh"), "emit", "metric.observed", "--payload", JSON.stringify(payload)], { cwd: REPO, encoding: "utf8", windowsHide: true });
  if (e.status !== 0) { process.stdout.write(`distribute-radar: emit failed (exit ${e.status}): ${(e.stderr || "").trim().split("\n").pop()}\n`); return 1; }
  process.stdout.write(`distribute-radar: metric.observed ${(e.stdout || "").trim().split("\n").pop()} · ${r.counts.behind} of ${r.counts.consumers} behind · ${r.counts.unmeasurable} unmeasurable · ${r.counts.missing ?? 0} missing\n`);
  mkdirSync(STATE_DIR, { recursive: true });
  writeFileSync(STAMP, `${today}\n`);
  return 0;
}

main().then((c) => { process.exitCode = c; });
