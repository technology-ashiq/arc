#!/usr/bin/env node
/**
 * lane-resolve.mjs — Node twin of lane-resolve.sh. Same contract, same bytes.
 * Cycle 4 (arc-portfolio), ADR-0054 / PORT-E. Zero deps, offline, read-only:
 * resolution NEVER creates, moves or writes anything. It reports a decision.
 *
 * Two implementations exist on purpose, not by accident:
 *   - the hooks are bash and must not spawn node (spawn is the expensive thing on
 *     Windows, and a box without node must still get its SessionStart heads-up)
 *   - kickoff-lint is zero-dep Node and must not require bash on PATH
 * Drift is the obvious risk, so it is gated: tests/lane-resolver.bats runs both
 * across every decision branch and requires identical bytes AND identical exit
 * codes — the same deal node:sqlite gets against the canonical JSONL scan.
 * EDIT BOTH FILES TOGETHER. The equivalence gate will fail loudly if you don't.
 *
 * Importable (resolveLane / renderHuman / renderMachine) and runnable as a CLI.
 * Usage / exits as a CLI: see lane-resolve.sh (identical).
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// ---------- lane-name grammar (PORT-A) ----------
// [a-z][a-z0-9-]*, length-capped, and never a Windows reserved device name: `con`
// passes the grammar but mkdir fails on exactly one of the three CI legs, so it is
// rejected everywhere rather than becoming a one-OS surprise.
const RESERVED = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])$/;
export const validLaneName = (n) =>
  typeof n === "string" && n.length > 0 && n.length <= 64 &&
  /^[a-z][a-z0-9-]*$/.test(n) && !RESERVED.test(n);

// ---------- PROGRESS machine header (ADR-0051 source grammar) ----------
// Tolerant DETECTION (case, bold, leading space), STRICT value grammar — the
// council-v2/v3 markdown-contract checklist. Header block only (stops at the first
// level-2+ heading), fenced blocks skipped, LAST value wins when a key repeats.
export function laneStatus(file) {
  let text;
  try { text = readFileSync(file, "utf8"); } catch { return ""; }
  let fence = false, v = "";
  for (const raw of text.split("\n")) {
    const line = raw.replace(/\r$/, "");
    const t = line.replace(/^[ \t]+/, "");
    if (t.slice(0, 3) === "```") { fence = !fence; continue; }
    if (fence) continue;
    if (/^##/.test(t)) break;
    const low = t.toLowerCase().replace(/\*/g, "");
    if (/^status[ \t]*:/.test(low)) {
      const p = line.indexOf(":");
      v = line.slice(p + 1).replace(/\*/g, "").replace(/`/g, "").replace(/^[ \t]+|[ \t]+$/g, "");
    }
  }
  return v;
}

const isEligible = (s) => s === "LIVE" || s === "BLOCKED";
const byBytes = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const commas = (list) => list.join(", ");

/** Pure resolution. `root` is required — defaulting it would hide a spawn in an import. */
export function resolveLane({ root, lane = "", laneGiven = false, surface = "command" }) {
  const lanes = [], skipped = [], eligible = [];
  let hasInitiatives = false, entries = null;
  try { entries = readdirSync(join(root, "initiatives")); hasInitiatives = true; } catch { entries = null; }
  if (entries) {
    for (const b of entries) {
      let isDir = false;
      try { isDir = statSync(join(root, "initiatives", b)).isDirectory(); } catch { isDir = false; }
      if (!isDir) continue;
      // Membership is decided against what the directory listing actually returned,
      // compared exactly. On a case-insensitive filesystem `initiatives/Design` would
      // otherwise answer to `--lane design` on Windows/macOS and not on Linux.
      if (validLaneName(b)) {
        lanes.push(b);
        if (isEligible(laneStatus(join(root, "initiatives", b, "PROGRESS.md")))) eligible.push(b);
      } else {
        skipped.push(b);
      }
    }
  }
  lanes.sort(byBytes); skipped.sort(byBytes); eligible.sort(byBytes);
  const counted = eligible.length;

  let mode = "lane", status = "ok", selected = "", via = "none", tracker = "", reason = "";
  if (laneGiven) {
    if (!validLaneName(lane)) { status = "invalid"; reason = "bad-name"; }
    else if (lanes.includes(lane)) { selected = lane; via = "arg"; tracker = `initiatives/${lane}`; }
    else if (surface === "kickoff") { status = "create"; selected = lane; via = "arg"; tracker = `initiatives/${lane}`; reason = "new-lane"; }
    else { status = "unknown"; reason = "no-such-lane"; }
  } else if (!hasInitiatives) {
    mode = "root"; tracker = ".";
  } else if (counted === 1) {
    selected = eligible[0]; via = "auto"; tracker = `initiatives/${selected}`;
  } else {
    status = "ambiguous"; reason = `eligible-count-${counted}`;
  }

  const code = { ok: 0, create: 0, ambiguous: 3, unknown: 4, invalid: 5 }[status];
  return { mode, status, lane: selected, via, tracker, lanes, eligible, counted, skipped, reason, code, requested: lane };
}

export function renderMachine(r) {
  return [
    `mode=${r.mode}`, `status=${r.status}`, `lane=${r.lane}`, `via=${r.via}`, `tracker=${r.tracker}`,
    `lanes=${r.lanes.join(" ")}`, `eligible=${r.eligible.join(" ")}`, `counted=${r.counted}`,
    `skipped=${r.skipped.join(" ")}`, `reason=${r.reason}`,
  ];
}

export function renderHuman(r) {
  const out = [];
  if (r.status === "ok" && r.mode === "lane") out.push(`Selected lane: ${r.lane} (via ${r.via})`);
  else if (r.status === "create") out.push(`Selected lane: ${r.lane} (via arg · new lane)`);
  else if (r.status === "ambiguous") {
    out.push(r.counted === 0
      ? "Lane not specified and no lane is eligible (LIVE or BLOCKED)."
      : `Lane not specified and ${r.counted} lanes are eligible: ${commas(r.eligible)}`);
    out.push(`Known lanes: ${commas(r.lanes)}`);
    out.push("Pick one: --lane <name>");
  } else if (r.status === "unknown") {
    out.push(`STOP: unknown lane '${r.requested}'.`);
    out.push(`Known lanes: ${commas(r.lanes)}`);
    out.push("Lanes are created by /arc-kickoff only — no other command creates one.");
  } else if (r.status === "invalid") {
    out.push(`STOP: invalid lane name '${r.requested}'.`);
    out.push("Grammar: lowercase letters, digits and dashes, starting with a letter ([a-z][a-z0-9-]*), max 64 chars.");
    out.push("Reserved device names (con, prn, aux, nul, com0-9, lpt0-9) are refused on every OS.");
  }
  return out;
}

/**
 * Parse a command line the way every arc surface must: --lane is the ONLY way to
 * name a lane, and every unrecognised token belongs to the CALLING command (a phase
 * number, a route, a goal sentence). That is why PORT-E round 6 dropped positional
 * lane tokens — `/arc-design design` read double, and free text is ambiguous.
 */
export function parseLaneArgs(argv) {
  let lane = "", laneGiven = false, root = "", surface = "command", print = "machine";
  const positionals = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const val = (name) => {
      if (a === name) return i + 1 < argv.length ? argv[++i] : "";
      if (a.startsWith(name + "=")) return a.slice(name.length + 1);
      return null;
    };
    if (a === "--lane" || a.startsWith("--lane=")) { laneGiven = true; lane = val("--lane") ?? ""; continue; }
    let v;
    if ((v = val("--root")) !== null) { root = v; continue; }
    if ((v = val("--for")) !== null) { surface = v; continue; }
    if ((v = val("--print")) !== null) { print = v; continue; }
    if ((v = val("--text")) !== null) { continue; }
    positionals.push(a);
  }
  return { lane, laneGiven, root, surface, print, positionals };
}

// ---------- CLI ----------
if (process.argv[1] && /lane-resolve\.mjs$/.test(process.argv[1].replace(/\\/g, "/"))) {
  const { lane, laneGiven, root: rootArg, surface, print } = parseLaneArgs(process.argv.slice(2));
  let root = rootArg;
  if (!root) {
    try {
      const { execFileSync } = await import("node:child_process");
      root = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    } catch { root = ""; }
    if (!root) root = process.cwd();
  }
  const r = resolveLane({ root, lane, laneGiven, surface });
  const out = print === "human" ? renderHuman(r) : renderMachine(r);
  if (out.length) process.stdout.write(out.join("\n") + "\n");
  process.exit(r.code);
}
