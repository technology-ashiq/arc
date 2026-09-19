#!/usr/bin/env node
// profile-request.mjs -- ask to switch the strictness profile (face v2 Phase 05 factory ring, ADR-1341 §3).
//
//   profile-request.mjs --to starter|standard|strict --why TEXT [--dry-run | --expect D]
//
// The profile is `.arc.profile` in .claude/settings.json (ADR-0008: one key switches every gate as a set), and that
// file is an un-grantable target (ADR-0502): nothing writes it, and this tool does not route around that. It reads the
// profile in force through arc-profile.sh -- the reader every gate uses -- refuses a switch to the profile already in
// force, and raises approval.requested {gate: profile, from, to, why, adr: ADR-0008}. The approval is the record that
// the owner asked; the edit to settings is the owner's.
//
//   --dry-run   the approval it would raise, judged by the spine, and as its LAST line the digest an apply is bound to
//   --expect D  raises it only if that digest still holds -- the profile in force moved -> PLAN_STALE, nothing raised
//   (neither)   refused: an apply is bound to a plan, by hand as by the door
//
// Exit: 0 done · 1 the approval's write is in doubt (said so) · 2 refused, nothing raised.

import { spawnSync } from "node:child_process";
import { realpathSync, writeSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isOneLine } from "./one-line.mjs";
import { planDigest, expectLine, staleReason, spineRefusal, withExclusiveLock } from "./plan-expect.mjs";
import { spawnBounded } from "./spawn-bounded.mjs";
import { query } from "../hq/spine.mjs";
import { spineRoot } from "../hq/lib/spine-io.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..", "..");
const ARC_EVENT = join(REPO, ".claude", "scripts", "hq", "arc-event.mjs");
const ARC_PROFILE = join(HERE, "arc-profile.sh");
export const PROFILES = Object.freeze(["starter", "standard", "strict"]);
const ULID_RE = /^[0-9A-HJKMNP-TV-Z]{26}$/;

class Stop extends Error {}
const out = [];
const say = (s) => out.push(s);
function die(code, msg) { process.stderr.write(`profile-request: ${msg}\n`); process.exitCode = code; throw new Stop(); }

function parseArgs(argv) {
  const a = { to: "", why: "", expect: undefined, dryRun: false };
  const seen = new Set();
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t === "--dry-run") { if (a.dryRun) die(2, "--dry-run given twice"); a.dryRun = true; continue; }
    if (t.startsWith("--dry-run=")) die(2, `--dry-run takes no value; write it bare, not ${t}`);
    if (!["--to", "--why", "--expect"].includes(t)) die(2, `unknown argument ${JSON.stringify(t)} -- known: --to --why --expect --dry-run`);
    if (seen.has(t)) die(2, `${t} given twice; pick one`);
    seen.add(t);
    const v = argv[i + 1];
    if (v === undefined || v === "" || v.startsWith("-")) die(2, `${t} needs a value`);
    a[t.slice(2)] = v;
    i++;
  }
  if (a.dryRun && a.expect !== undefined) die(2, "--dry-run plans and --expect applies; give one");
  if (!PROFILES.includes(a.to)) die(2, `--to is one of ${PROFILES.join(", ")} (ADR-0008); got ${JSON.stringify(a.to)}`);
  // The reason is required: "loosening is a profile switch, never a flag somebody remembers" -- with the why written down.
  if (!a.why) die(2, "--why is required: a profile switch carries its reason, in writing (ADR-0008)");
  if (!isOneLine(a.why)) die(2, "--why is one line of text, with no control or invisible characters");
  return a;
}

/** The environment names that move where the profile is READ: with one set, the request names a profile the tree's own settings do not hold. */
const PROFILE_OVERRIDES = ["ARC_PROFILE", "ARC_SETTINGS", "GIT_DIR", "GIT_WORK_TREE", "GIT_COMMON_DIR"];

/** The profile in force, as every gate reads it. */
async function profileInForce() {
  // An override wins over the settings key, so an edit to settings would change nothing here: said, not raised as a
  // request that cannot take effect. ARC_SETTINGS and git's location names are the same class as ARC_PROFILE -- a
  // request said "from strict" while the tree's settings said standard (PR 4 attacks, both).
  const set = Object.keys(process.env).find((k) => PROFILE_OVERRIDES.includes(k.toUpperCase()));
  if (set) die(2, `${set} is set in this environment and moves where the profile is read -- an edit to .arc.profile would not be the profile in force here; unset it`);
  // Bounded, and a failure named: a missing bash, WSL's bash, or a slow one read as "exited null" (PR 4 shell attack).
  let out = "", err = "";
  const r = await spawnBounded("bash", [ARC_PROFILE, "name"], { cwd: REPO, env: process.env, timeoutMs: 20_000,
    onData: (stream, chunk) => { if (stream === "out") out += chunk.toString("utf8"); else if (err.length < 4096) err += chunk.toString("utf8"); } });
  if (r.timedOut) die(2, "the profile in force could not be read: arc-profile.sh did not finish in 20 s");
  if (r.exit === null) die(2, `the profile in force could not be read: arc-profile.sh could not be run (${r.error || r.signal || "no exit"}) -- is Git Bash on PATH?`);
  const name = out.trim();
  if (r.exit !== 0 || !PROFILES.includes(name)) die(2, `the profile in force could not be read (arc-profile.sh exited ${r.exit}): ${err.trim().split(/\r?\n/)[0] || name}`);
  return name;
}

/** An OPEN request to switch to `to`: raised and not yet decided. One plan was applied three times (PR 4 logic attack). */
async function openRequestFor(to) {
  const root = spineRoot();
  const asked = await query(root, { kind: "approval.requested", engine: "scan" });
  const decided = await query(root, { kind: "decision.recorded", engine: "scan" });
  const unreadable = [...(asked.unreadable || []), ...(decided.unreadable || [])];
  if (unreadable.length) die(2, `the spine has a day file it could not read (${unreadable[0].day}: ${unreadable[0].code}) -- it cannot tell whether this was already asked; try again`);
  const done = new Set(decided.events.map((e) => e.event && e.event.payload && e.event.payload.decides).filter(Boolean));
  const open = asked.events.find((e) => e.event && e.event.payload && e.event.payload.gate === "profile" && e.event.payload.to === to && !done.has(e.event.id));
  return open ? open.event.id : null;
}

async function main() {
  const a = parseArgs(process.argv.slice(2));
  const from = await profileInForce();
  if (from === a.to) die(2, `the profile in force is already ${from} -- the request would change nothing`);
  const pending = await openRequestFor(a.to);
  if (pending) die(2, `a request to switch to ${a.to} is already in your inbox (${pending}) -- decide that one`);
  const loosening = PROFILES.indexOf(a.to) < PROFILES.indexOf(from);
  const payload = {
    what: `switch the strictness profile from ${from} to ${a.to}${loosening ? " (loosening every gate as a set)" : ""}`,
    gate: "profile", adr: "ADR-0008", from, to: a.to, why: a.why,
    edit: ".arc.profile in .claude/settings.json -- the owner's edit; nothing writes it (ADR-0502)",
  };
  const refused = spineRefusal(ARC_EVENT, "approval.requested", payload, { cwd: REPO });
  if (refused) die(2, `the spine would refuse this request, so nothing is raised: ${refused}`);
  const digest = planDigest({ kind: "approval.requested", payload });
  say(`profile-request: ${payload.what}`);
  say(`profile-request: the approval goes to your inbox; the edit to ${payload.edit.split(" -- ")[0]} stays yours`);
  if (a.dryRun) {
    say("profile-request: dry run -- nothing was raised");
    say(expectLine(digest));
    return;
  }
  if (a.expect === undefined) die(2, "an apply is bound to a plan: run it with --dry-run first, then again with the --expect it prints");
  const stale = staleReason(a.expect, digest);
  if (stale) die(2, stale);
  // The open-request check and the emit, one holder at a time: two applies of one plan both landed (PR 4 logic attack).
  const held = await withExclusiveLock(join(spineRoot(), "locks"), `profile-request-${a.to}.lock`, async () => {
    const again = await openRequestFor(a.to);
    if (again) die(2, `a request to switch to ${a.to} was raised a moment ago (${again}) -- decide that one`);
    const r = spawnSync(process.execPath, [ARC_EVENT, "emit", "approval.requested", "--payload", JSON.stringify(payload), "--strict"], { cwd: REPO, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    const id = String(r.stdout || "").trim();
    if (r.status !== 0 || !ULID_RE.test(id)) die(1, `the approval may not have been raised -- ${String(r.stderr || "").trim().split(/\r?\n/).filter(Boolean)[0] || `the emitter exited ${r.status}`}; look in your inbox before asking again`);
    return id;
  });
  if (held.busy) die(2, `another request to switch to ${a.to} is being raised right now -- nothing was raised; read your inbox`);
  say(`receipt: approval.requested ${held.value}`);
}

function isMainModule() {
  try { return !!process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); } catch { return false; }
}

if (isMainModule()) {
  try { await main(); }
  catch (e) {
    if (!(e instanceof Stop)) { process.stderr.write(`profile-request: ${e instanceof Error ? e.message : e}\n`); process.exitCode = 2; }
  }
  // Written synchronously, then the exit code stands: the door parses the last line.
  // A reader that closed its end loses these lines, never the outcome: the exit code is already set (PR 3b, arc-event twin).
  if (out.length) { try { writeSync(1, out.join("\n") + "\n"); } catch { /* the lines are lost; the effect and its exit are not */ } }
}
