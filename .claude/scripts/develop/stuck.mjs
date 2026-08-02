#!/usr/bin/env node
/**
 * stuck.mjs -- the stuck protocol (Phase 03). Deterministic backstops under a judgement call.
 *
 * The design source's primary signal is hypothesis-based: the same error recurring with no new
 * evidence-backed hypothesis means flailing, while three failures fixing three different causes
 * is just work. But **hypothesis novelty is claimable** -- a model under pressure will always
 * feel like it has a new idea -- so the counters below are the floor beneath that judgement,
 * not a replacement for it.
 *
 *   same fingerprint 3x   -> forced root-cause mode (read the real error, build a minimal
 *                            repro, THEN fix). Not a suggestion.
 *   5 attempts on a slice -> escalate to Ashiq with a one-screen diagnosis.
 *
 * State lives in `.claude/state/develop/` keyed by lane and slice. It is disposable local
 * runtime by design (design source §3), which is exactly why every backstop firing also emits
 * a `slice.stuck` receipt (ADR-0107) -- the counters vanish, the record must not.
 *
 * Usage:
 *   node stuck.mjs record <slice> --error <text> [--hypothesis <text>] [--lane NAME] [--root PATH]
 *   node stuck.mjs show   <slice> [--lane NAME] [--root PATH]
 *   node stuck.mjs clear  <slice> [--lane NAME] [--root PATH]
 *
 * Zero dependencies, Node 18+.
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { parseLaneArgs, renderHuman, resolveLane } from "../core/lane-resolve.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ARC_ROOT = resolve(HERE, "..", "..", "..");

export const FINGERPRINT_LIMIT = 3;   // same failure, three times -> root-cause mode
export const ATTEMPT_LIMIT = 5;       // any five attempts on one slice -> escalate

/**
 * Normalise an error into a fingerprint.
 *
 * The balance here is the whole design: too specific and the same failure never looks like
 * itself, so the backstop never fires and the protocol is decoration. Paths, line and column
 * numbers, hex addresses, uuids, timestamps and standalone digits all vary run to run while
 * meaning the same thing, so they go. What is left is the shape of the failure.
 */
export function fingerprint(errorText) {
  const norm = String(errorText || "")
    .replace(/\r\n?/g, "\n")
    .replace(/[A-Za-z]:[\\/][^\s:]+|(?:\/[\w.@-]+){2,}/g, "<path>")   // win + posix paths
    .replace(/\b0x[0-9a-f]+\b/gi, "<addr>")
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, "<uuid>")
    .replace(/\b\d{4}-\d{2}-\d{2}[T ][\d:.]+Z?\b/g, "<ts>")
    .replace(/:\d+:\d+\b/g, ":<line>:<col>")
    .replace(/\b\d+\b/g, "<n>")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  return createHash("sha256").update(norm).digest("hex").slice(0, 12);
}

const statePath = (root, lane, slice) =>
  join(root, ".claude", "state", "develop", lane || "_root", `slice-${slice}.json`);

const readState = (p) => {
  try { return JSON.parse(readFileSync(p, "utf8")); } catch { return { attempts: [], fingerprints: {} }; }
};

/**
 * Record one attempt. Returns the state plus which backstop (if any) fired on THIS attempt.
 *
 * A hypothesis is recorded but never trusted as an escape: repeating a fingerprint with a
 * "new" hypothesis still counts toward the limit. That is the point of a floor.
 */
export function record({ root, lane, slice, error, hypothesis }) {
  const p = statePath(root, lane, slice);
  const s = readState(p);
  const fp = fingerprint(error);

  s.attempts.push({ fp, hypothesis: hypothesis || null });
  s.fingerprints[fp] = (s.fingerprints[fp] || 0) + 1;

  const fired = [];
  if (s.fingerprints[fp] >= FINGERPRINT_LIMIT && s.fingerprints[fp] % FINGERPRINT_LIMIT === 0) fired.push("fingerprint-3x");
  if (s.attempts.length >= ATTEMPT_LIMIT && s.attempts.length % ATTEMPT_LIMIT === 0) fired.push("attempts-5");

  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(s, null, 2) + "\n", "utf8");
  return { state: s, fp, count: s.fingerprints[fp], attempts: s.attempts.length, fired };
}

/** The one-screen diagnosis the escalation must carry. Tried · current hypothesis · options. */
export function diagnosis(slice, s) {
  const out = [`Slice ${slice} — ${s.attempts.length} attempts, escalating.`, ""];
  const byFp = new Map();
  for (const a of s.attempts) byFp.set(a.fp, (byFp.get(a.fp) || 0) + 1);
  out.push("Tried:");
  for (const [fp, n] of byFp) out.push(`  ${fp}  ×${n}`);
  const hyps = s.attempts.map((a) => a.hypothesis).filter(Boolean);
  out.push("", `Current hypothesis: ${hyps.length ? hyps[hyps.length - 1] : "(none recorded — that is itself the finding)"}`);
  out.push("", "Options:");
  out.push("  1. Root-cause mode: read the actual error and the actual file, build a minimal repro, then fix.");
  out.push("  2. Cut the slice: is this the smallest useful increment, or is it two slices?");
  out.push("  3. Record it as debt with a pay-down trigger and move on.");
  return out.join("\n");
}

// ---------- CLI ----------
if (process.argv[1] && /stuck\.mjs$/.test(process.argv[1].replace(/\\/g, "/"))) {
  const cli = parseLaneArgs(process.argv.slice(2));
  const [mode, slice] = cli.positionals;
  const valOf = (name) => {
    const i = process.argv.indexOf(name);
    return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : "";
  };

  let root = cli.root;
  if (!root) {
    try {
      const { execFileSync } = await import("node:child_process");
      root = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    } catch { root = ""; }
    if (!root) root = process.cwd();
  }
  root = resolve(root);

  const r = resolveLane({ root, lane: cli.lane, laneGiven: cli.laneGiven, laneDup: cli.laneDup, surface: "develop" });
  if (r.code !== 0) { for (const l of renderHuman(r)) console.log(l); process.exit(r.code); }

  if (!mode || !slice) {
    console.log("usage: stuck.mjs <record|show|clear> <slice> [--error TEXT] [--hypothesis TEXT] [--lane NAME] [--root PATH]");
    process.exit(2);
  }

  const p = statePath(root, r.lane, slice);

  if (mode === "show") {
    const s = readState(p);
    console.log(`slice ${slice}: ${s.attempts.length} attempt(s), ${Object.keys(s.fingerprints).length} distinct failure(s)`);
    for (const [fp, n] of Object.entries(s.fingerprints)) console.log(`  ${fp}  ×${n}`);
    process.exit(0);
  }

  if (mode === "clear") {
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, JSON.stringify({ attempts: [], fingerprints: {} }, null, 2) + "\n", "utf8");
    console.log(`slice ${slice}: stuck counters cleared`);
    process.exit(0);
  }

  const res = record({ root, lane: r.lane, slice, error: valOf("--error"), hypothesis: valOf("--hypothesis") });
  console.log(`slice ${slice}: attempt ${res.attempts}, fingerprint ${res.fp} ×${res.count}`);

  for (const backstop of res.fired) {
    // The receipt is the durable half: the counters under .claude/state/ are disposable, so
    // without this a retro asking "where did the time go" would find nothing (ADR-0107).
    try {
      const { execFileSync } = await import("node:child_process");
      execFileSync(process.execPath, [
        join(ARC_ROOT, ".claude", "scripts", "hq", "arc-event.mjs"), "emit", "slice.stuck",
        "--payload", JSON.stringify({
          lane: r.mode === "root" ? null : r.lane, slice,
          fingerprint: res.fp, attempts: res.attempts, backstop,
        }),
      ], { stdio: ["ignore", "ignore", "ignore"] });
    } catch { /* a spine failure never changes this command's exit code */ }
  }

  if (res.fired.includes("fingerprint-3x")) {
    console.log("");
    console.log(`BACKSTOP fingerprint-3x — the same failure ${res.count} times. Root-cause mode is now forced:`);
    console.log("  read the actual error and the actual file · build a minimal repro · THEN fix.");
    console.log("  Three failures fixing three different causes is work. One failure three times is flailing.");
  }
  if (res.fired.includes("attempts-5")) {
    console.log("");
    console.log("BACKSTOP attempts-5 — escalating.");
    console.log("");
    console.log(diagnosis(slice, res.state));
  }
  process.exit(0);
}
