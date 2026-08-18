#!/usr/bin/env node
/**
 * lane-resolve.mjs — Node twin of lane-resolve.sh. Same contract, same bytes.
 * Cycle 4 (arc-portfolio), ADR-0054 / PORT-E. Zero deps, offline, read-only:
 * resolution NEVER creates, moves or writes anything. It reports a decision.
 *
 * Two implementations exist on purpose, not by accident:
 *   - a SessionStart hook must still work on a box with no node on PATH; the
 *     heads-up is core UX and the spine already treats a missing node as SKIP
 *   - kickoff-lint is zero-dep Node and must not require bash on PATH
 * It is NOT a speed argument: measured on Git Bash the two interpreters' startup
 * costs are within ~30ms of each other and node runs the resolution itself faster.
 * Drift is the real risk, so it is gated: every case in tests/lane-resolver.bats
 * runs BOTH and requires identical bytes AND identical exit codes — the same deal
 * node:sqlite gets against the canonical JSONL scan.
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
// A JS character class is codepoint-ranged and locale-blind, so `[a-z]` is safe HERE
// and is not safe in the bash twin, where the same notation goes through the locale's
// collation table. That asymmetry is why lane-resolve.sh spells the characters out
// instead of mirroring this line: do not "simplify" it back. (macOS CI, 2026-07-30:
// bash accepted `Design`, this function refused it, the equivalence gate caught it.)
export const validLaneName = (n) =>
  typeof n === "string" && n.length > 0 && n.length <= 64 &&
  /^[a-z][a-z0-9-]*$/.test(n) && !RESERVED.test(n);

// ---------- PROGRESS machine header (ADR-0051 source grammar) ----------
// Tolerant DETECTION (case, bold, leading space), STRICT value grammar — the
// council-v2/v3 markdown-contract checklist. Header block only (stops at the first
// level-2+ heading), fenced blocks skipped, LAST value wins when a key repeats.
// The FULL machine header as an object -- every `key: value` line above the first `##`,
// with the same fence/CR/FIFO guards as laneStatus below (kept as a sibling rather than
// refolding laneStatus, whose exact behaviour the lane resolver load-bears; the two walk
// the same grammar and a change to one is a change to grep for in the other -- twin rule).
// Exported for the L2 read door (face lane, ADR-1301): the board is a view, the machine
// header is the truth, and this is the ONE parser that reads it.
export function laneHeader(file) {
  let text;
  try { if (!statSync(file).isFile()) return {}; text = readFileSync(file, "utf8"); } catch { return {}; }
  const out = {};
  let fence = false, fchar = "";
  for (const raw of text.split("\n")) {
    const line = raw.replace(/\r$/, "");
    const t = line.replace(/^[ \t]+/, "");
    const f3 = t.slice(0, 3);
    if (f3 === "```" || f3 === "~~~") {
      if (!fence) { fence = true; fchar = f3; } else if (f3 === fchar) { fence = false; fchar = ""; }
      continue;
    }
    if (fence) continue;
    if (/^##/.test(t)) break;
    const m = t.replace(/\*/g, "").match(/^([a-z][a-z-]*)[ \t]*:[ \t]*(.*)$/);
    if (m && !(m[1] in out)) out[m[1]] = m[2].trim();
  }
  return out;
}

export function laneStatus(file) {
  let text;
  // statSync first: readFileSync on a FIFO blocks forever, and bash's `[ -f ]`
  // guard would have skipped it — a hang is not a decision.
  try { if (!statSync(file).isFile()) return ""; text = readFileSync(file, "utf8"); } catch { return ""; }
  let fence = false, fchar = "", v = "";
  for (const raw of text.split("\n")) {
    const line = raw.replace(/\r$/, "");
    const t = line.replace(/^[ \t]+/, "");
    const f3 = t.slice(0, 3);
    if (f3 === "```" || f3 === "~~~") {
      if (!fence) { fence = true; fchar = f3; } else if (f3 === fchar) { fence = false; fchar = ""; }
      continue;
    }
    if (fence) continue;
    if (/^##/.test(t)) break;
    const low = t.toLowerCase().replace(/\*/g, "");
    if (/^status[ \t]*:/.test(low)) {
      const p = line.indexOf(":");
      v = line.slice(p + 1)
        .replace(/\*/g, "").replace(/`/g, "")
        .replace(/[\u0000-\u001F\u007F]/g, "")
        .replace(/^[ \t]+|[ \t]+$/g, "");
    }
  }
  return v;
}

const isEligible = (s) => s === "LIVE" || s === "BLOCKED";
// Byte order, not UTF-16 code-unit order: an astral character's lead surrogate
// sorts below U+F900 in JS but above it as UTF-8 bytes, and `LC_ALL=C sort` in the
// twin is byte order. Same name for the same thing on both sides.
const byBytes = (a, b) => Buffer.compare(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
const commas = (list) => list.join(", ");
// Non-printable-ASCII bytes render as `?` so both twins echo the same bytes for a
// name that was never valid anyway.
const safeName = (s) => String(s).replace(/[^\x20-\x7E]/g, "?");

/** Pure resolution. `root` is required — defaulting it would hide a spawn in an import. */
export function resolveLane({ root, lane = "", laneGiven = false, surface = "command", laneDup = false }) {
  const lanes = [], skipped = [], eligible = [];
  let entries = null;
  try { entries = readdirSync(join(root, "initiatives")); } catch { entries = null; }
  if (entries) {
    for (const b of entries) {
      if (b.startsWith(".")) continue;   // dot-entries (.git, .DS_Store) are not workspaces
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
  // An `initiatives/` directory holding no valid lane is not lane-mode. Git does not
  // track empty directories, so a stray mkdir or a partial checkout would otherwise
  // strand every surface in an un-answerable "pick a lane" with nothing to pick.
  const hasLanes = lanes.length > 0;

  let mode = "lane", status = "ok", selected = "", via = "none", tracker = "", reason = "";
  if (laneGiven) {
    if (laneDup) { status = "invalid"; reason = "duplicate-lane"; }
    else if (!validLaneName(lane)) { status = "invalid"; reason = "bad-name"; }
    else if (lanes.includes(lane)) { selected = lane; via = "arg"; tracker = `initiatives/${lane}`; }
    else if (surface === "kickoff") { status = "create"; selected = lane; via = "arg"; tracker = `initiatives/${lane}`; reason = "new-lane"; }
    else { status = "unknown"; reason = "no-such-lane"; }
  } else if (!hasLanes) {
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
    out.push(`STOP: unknown lane '${safeName(r.requested)}'.`);
    out.push(`Known lanes: ${commas(r.lanes)}`);
    out.push("Lanes are created by /arc-kickoff only — no other command creates one.");
  } else if (r.status === "invalid") {
    if (r.reason === "duplicate-lane") {
      out.push("STOP: --lane given more than once with different values.");
      out.push("Name exactly one lane; a second --lane is an operator error, not an override.");
    } else {
      out.push(`STOP: invalid lane name '${safeName(r.requested)}'.`);
      out.push("Grammar: lowercase letters, digits and dashes, starting with a letter ([a-z][a-z0-9-]*), max 64 chars.");
      out.push("Reserved device names (con, prn, aux, nul, com0-9, lpt0-9) are refused on every OS.");
    }
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
  let lane = "", laneGiven = false, laneDup = false, root = "", surface = "command", print = "machine";
  const positionals = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const val = (name) => {
      if (a === name) return i + 1 < argv.length ? argv[++i] : "";
      if (a.startsWith(name + "=")) return a.slice(name.length + 1);
      return null;
    };
    if (a === "--lane" || a.startsWith("--lane=")) {
      const nv = val("--lane") ?? "";
      // Two different --lane values is an operator error, not a last-wins override:
      // silently picking one of two named lanes is exactly the "never guess" failure.
      if (laneGiven && nv !== lane) laneDup = true;
      laneGiven = true; lane = nv; continue;
    }
    let v;
    if ((v = val("--root")) !== null) { root = v; continue; }
    if ((v = val("--for")) !== null) { surface = v; continue; }
    if ((v = val("--print")) !== null) { print = v; continue; }
    if ((v = val("--text")) !== null) { continue; }
    positionals.push(a);
  }
  return { lane, laneGiven, laneDup, root, surface, print, positionals };
}

// ---------- CLI ----------
if (process.argv[1] && /lane-resolve\.mjs$/.test(process.argv[1].replace(/\\/g, "/"))) {
  const { lane, laneGiven, laneDup, root: rootArg, surface, print } = parseLaneArgs(process.argv.slice(2));
  let root = rootArg;
  if (!root) {
    try {
      const { execFileSync } = await import("node:child_process");
      root = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    } catch { root = ""; }
    if (!root) root = process.cwd();
  }
  const r = resolveLane({ root, lane, laneGiven, surface, laneDup });
  const out = print === "human" ? renderHuman(r) : renderMachine(r);
  if (out.length) process.stdout.write(out.join("\n") + "\n");
  process.exit(r.code);
}
