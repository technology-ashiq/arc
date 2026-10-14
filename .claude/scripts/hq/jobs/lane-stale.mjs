#!/usr/bin/env node
/**
 * lane-stale.mjs -- the board that notices (portfolio REQ-08, ADR-0079).
 *
 * Daily: every lane whose PROGRESS machine header reads `status: LIVE` and that no spine receipt has named
 * (`payload.lane`) in the last 14 days is derived STALE. The derivation is written to instance state
 * (`.claude/state/portfolio/lane-stale.json`, read by the board's renderers) and each silent lane is raised once per
 * silence episode as `incident.raised` `class: lane-stale`, which the brief lists under needs-you.
 *
 * Never written into PORTFOLIO.md: the board is a view (ADR-0051), a tracked file rewritten daily would dirty the
 * owner's main clone, and board-lint fails any `stale` field typed there. The job's own incidents carry the lane as
 * `silent_lane`, never `lane`, AND are excluded by class: an alarm must not count as the activity it measures.
 *
 * `--dry-run` derives and prints, writing neither the state file nor a receipt.
 *
 * Zero dependencies, Node 18+. Exit 0 = derived (stale or not); 1 = a receipt could not be written; 2 = no spine or a
 * bad flag.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { formatIst, nowMs, sha256Hex } from "../lib/canonical.mjs";
import { scanAll, spineRoot } from "../spine.mjs";
import { cycleIdentity, readHeader } from "../../plan/kickoff-gates.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..", "..", "..");
const ARC_EVENT = join(REPO, ".claude", "scripts", "hq", "arc-event.mjs");
const STATE_DIR = process.env.ARC_PORTFOLIO_STATE_DIR || join(REPO, ".claude", "state", "portfolio");
export const WINDOW_DAYS = 14;
const LANE = /^[a-z][a-z0-9-]{0,63}$/;
const DAY_MS = 86400000;

const isOwnAlarm = (e) => e.kind === "incident.raised" && e.payload && e.payload.class === "lane-stale";
// A rehearsal, test or fixture receipt is not the lane working, so it must not reset the silence clock. A marker counts
// unless it is literally false; livemode counts unless it is literally true (fixed-defects (f), (k)).
const isRehearsal = (p) =>
  ["rehearsal", "test", "fixture", "simulated"].some((k) => k in p && p[k] !== false) || ("livemode" in p && p.livemode !== true);

// Pure: lanes [{lane, status, cycle}] + events -> {lane: {stale, last_ts, last_id, cycle}} for every LIVE lane.
export function deriveStale(lanes, events, now, windowDays = WINDOW_DAYS) {
  const newest = new Map();
  for (const e of events) {
    if (!e || !e.payload || typeof e.payload.lane !== "string" || isOwnAlarm(e) || isRehearsal(e.payload)) continue;
    const t = Date.parse(e.ts);
    if (!Number.isFinite(t)) continue;
    const cur = newest.get(e.payload.lane);
    if (!cur || t > cur.t) newest.set(e.payload.lane, { t, id: e.id, ts: e.ts });
  }
  const out = {};
  for (const { lane, status, cycle } of lanes) {
    if (String(status ?? "").trim().toUpperCase() !== "LIVE") continue;
    const n = newest.get(lane);
    out[lane] = { stale: !n || now - n.t > windowDays * DAY_MS, last_ts: n ? n.ts : null, last_id: n ? n.id : null, cycle: cycle ?? null };
  }
  return out;
}

function readLanes() {
  const dir = join(REPO, "initiatives");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((n) => LANE.test(n) && existsSync(join(dir, n, "PROGRESS.md")))
    .flatMap((lane) => {
      // One unreadable tracker is that lane's problem, never a reason to judge no lane at all.
      try {
        const h = readHeader(readFileSync(join(dir, lane, "PROGRESS.md"), "utf8"));
        return [{ lane, status: h.status, cycle: cycleIdentity(h.cycle) }];
      } catch {
        process.stderr.write(`lane-stale: ${lane}/PROGRESS.md unreadable -- not judged\n`);
        return [];
      }
    });
}

// The episode: the lane, its cycle and its newest naming receipt. Checked on the spine BEFORE emitting, so a lane that
// stays silent is raised once and a daily run never sends a duplicate the emitter would have to quarantine. The cycle
// is in the key so a lane that goes IDLE and returns LIVE in a new cycle, still never named, is raised again.
const episodeOf = (lane, cycle, lastId) => `${lane}|${cycle ?? "-"}|${lastId ?? "never"}`;
function raisedEpisodes(events) {
  const seen = new Set();
  for (const e of events)
    if (isOwnAlarm(e) && typeof e.payload.silent_lane === "string")
      seen.add(episodeOf(
        e.payload.silent_lane,
        typeof e.payload.cycle === "string" ? e.payload.cycle : null,
        typeof e.payload.last_receipt === "string" ? e.payload.last_receipt : null,
      ));
  return seen;
}

function raise(lane, info) {
  const since = info.last_ts ? info.last_ts.slice(0, 10) : "ever";
  const payload = {
    class: "lane-stale",
    silent_lane: lane,
    cycle: info.cycle,
    last_receipt: info.last_id,
    last_receipt_ts: info.last_ts,
    what: `lane ${lane} is LIVE and no receipt has named it since ${since} (${WINDOW_DAYS}-day window) -- derived by the lane-stale job, never typed by hand`,
  };
  const idem = sha256Hex(`lane-stale|${episodeOf(lane, info.cycle, info.last_id)}`);
  const r = spawnSync(process.execPath, [ARC_EVENT, "emit", "incident.raised", "--payload", JSON.stringify(payload), "--idem", idem, "--strict"],
    { cwd: REPO, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 60000 });
  if (r.status === 0) return "raised";
  // Only the emitter's own duplicate refusal, on its first line, counts as "already": an error that merely echoes the
  // text must stay a failure, or that lane is silently never raised (round 2 B3).
  const first = String(r.stderr || "").trim().split("\n").filter(Boolean)[0] || "";
  if (/\bDUP_IDEM\b/.test(first)) return "already";
  process.stderr.write(`lane-stale: ${lane} not raised -- ${first || `arc-event exited ${r.status}${r.error ? ` (${r.error.code})` : ""}`}\n`);
  return "failed";
}

function main(argv) {
  const unknown = argv.filter((a) => a !== "--dry-run");
  if (unknown.length) {
    process.stderr.write(`lane-stale: unknown argument ${JSON.stringify(unknown[0])}\n`);
    return 2;
  }
  const dry = argv.includes("--dry-run");
  let dir;
  try { dir = spineRoot(); } catch (e) { process.stderr.write(`lane-stale: ${e.message}\n`); return 2; }
  if (!existsSync(join(dir, "events"))) { process.stderr.write(`lane-stale: no spine at ${dir}\n`); return 2; }
  const events = scanAll(dir).events.map((x) => x.event);
  const now = nowMs();
  const lanes = deriveStale(readLanes(), events, now);
  if (dry) {
    for (const l of Object.keys(lanes).sort())
      process.stdout.write(`${l}\tstale=${lanes[l].stale}\tlast=${lanes[l].last_ts ?? "never"}\t${lanes[l].last_id ?? "-"}\n`);
    return 0;
  }
  mkdirSync(STATE_DIR, { recursive: true });
  const file = join(STATE_DIR, "lane-stale.json");
  // A per-process temp name: a manual run beside the scheduled one never shares a half-written file (round 2 B1).
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify({ derived_at: formatIst(now), window_days: WINDOW_DAYS, lanes }, null, 2) + "\n");
  renameSync(tmp, file);
  const stale = Object.keys(lanes).filter((l) => lanes[l].stale).sort();
  const tally = { raised: 0, already: 0, failed: 0 };
  const already = raisedEpisodes(events);
  for (const l of stale) tally[already.has(episodeOf(l, lanes[l].cycle, lanes[l].last_id)) ? "already" : raise(l, lanes[l])]++;
  process.stdout.write(`lane-stale: ${Object.keys(lanes).length} LIVE lane(s), ${stale.length} stale${stale.length ? `: ${stale.join(", ")}` : ""} -- raised ${tally.raised} new, ${tally.already} already raised${tally.failed ? `, ${tally.failed} FAILED` : ""}\n`);
  return tally.failed ? 1 : 0;
}

// Main guard with realpath on BOTH sides: behind a symlink or a macOS /var -> /private/var temp dir, a one-sided compare
// silently no-ops (fixed-defects, distribute (a)).
const real = (p) => { try { return realpathSync(p); } catch { return p; } };
if (process.argv[1] && real(process.argv[1]) === real(fileURLToPath(import.meta.url))) process.exitCode = main(process.argv.slice(2));
