#!/usr/bin/env node
// review-ship-record.mjs -- the one writer for the review-ship room's two sessions (face Cycle 17 P02, REQ-06, ADR-1366).
//
//   review-ship-record.mjs qa   --url URL --bugs N --fixed N [--as-process qa-run@X.Y.Z] [--dry-run]
//   review-ship-record.mjs ship --sha SHA [--as-process ship-run@X.Y.Z] [--dry-run]
//
// `qa` seals what a QA pass found as qa.completed. `ship` reads CI per job for SHA itself, through ci-digest.mjs, and
// only when every job is green raises approval.requested{gate: deploy}: the owner's go to deploy, never a deploy. This
// file deploys, publishes and pushes nothing, and approving the gate triggers nothing (ADR-1366) -- the deploy is
// still the owner's own command. A model in the session cannot vouch for CI: the writer reads it, so a run that says
// "green" over a red tree raises nothing.
import { spawnSync } from "node:child_process";
import { realpathSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { emitReceipt, spineRefusal } from "../core/plan-expect.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..", "..");
const ARC_EVENT = join(REPO, ".claude", "scripts", "hq", "arc-event.mjs");
const CI_DIGEST = join(REPO, ".claude", "scripts", "review", "ci-digest.mjs");
const PROCESS_RE = /^[a-z][a-z0-9-]{0,63}@[0-9]+\.[0-9]+\.[0-9]+$/;
const SHA_RE = /^[0-9a-f]{40}$/;
const URL_RE = /^https?:\/\/[A-Za-z0-9.-]+(:[0-9]{1,5})?(\/[A-Za-z0-9._~\/-]*)?$/;
const COUNT_RE = /^(0|[1-9][0-9]{0,4})$/;

class Stop extends Error {}
function die(code, msg) { process.stderr.write(`review-ship-record: ${msg}\n`); process.exitCode = code; throw new Stop(); }

/** @param {string[]} argv */
export function parseArgs(argv) {
  const verb = argv[0];
  if (verb !== "qa" && verb !== "ship") die(2, "usage: review-ship-record.mjs qa --url URL --bugs N --fixed N | ship --sha SHA  [--as-process NAME@VER] [--dry-run]");
  const known = verb === "qa" ? ["--url", "--bugs", "--fixed", "--as-process"] : ["--sha", "--as-process"];
  /** @type {Record<string, string>} */
  const v = {};
  let dryRun = false;
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") { if (dryRun) die(2, "--dry-run given twice"); dryRun = true; continue; }
    if (!known.includes(a)) die(2, `unknown argument ${JSON.stringify(a).slice(0, 80)} -- ${verb} takes ${known.join(" ")} --dry-run`);
    if (Object.hasOwn(v, a)) die(2, `${a} given twice; pick one`);
    const val = argv[i + 1];
    if (typeof val !== "string" || val === "" || val.startsWith("--")) die(2, `${a} needs a value`);
    v[a] = val;
    i++;
  }
  if (v["--as-process"] !== undefined && !PROCESS_RE.test(v["--as-process"])) die(2, "--as-process is <process>@<major.minor.patch>");
  if (verb === "qa") {
    for (const k of ["--url", "--bugs", "--fixed"]) if (v[k] === undefined) die(2, `qa needs ${k}`);
    if (!URL_RE.test(v["--url"]) || v["--url"].length > 300) die(2, "--url is an http(s) URL with no query, at most 300 bytes");
    if (!COUNT_RE.test(v["--bugs"]) || !COUNT_RE.test(v["--fixed"])) die(2, "--bugs and --fixed are whole numbers");
    if (Number(v["--fixed"]) > Number(v["--bugs"])) die(2, "--fixed cannot exceed --bugs");
  } else if (v["--sha"] === undefined || !SHA_RE.test(v["--sha"])) die(2, "ship needs --sha, the full 40-hex commit CI ran on");
  return { verb, v, dryRun };
}

/** CI's verdict for SHA, read per job by ci-digest (exit 0 = every job green). @param {string} sha */
function ciVerdict(sha) {
  const r = spawnSync(process.execPath, [CI_DIGEST, "--sha", sha], { cwd: REPO, encoding: "utf8", timeout: 120_000 });
  const tail = String(r.stdout || "").trim().split(/\r?\n/).pop() || "";
  return { green: r.status === 0, status: r.status, tail: tail.slice(0, 200) };
}

function main() {
  const { verb, v, dryRun } = parseArgs(process.argv.slice(2));
  const flags = v["--as-process"] ? ["--process", v["--as-process"]] : [];
  let kind, payload;
  if (verb === "qa") {
    kind = "qa.completed";
    payload = { url: v["--url"], bugs: v["--bugs"], fixed: v["--fixed"] };
  } else {
    const ci = ciVerdict(v["--sha"]);
    if (!ci.green) die(2, `CI for ${v["--sha"].slice(0, 12)} is not green (ci-digest exit ${ci.status}: ${ci.tail}) -- no deploy gate is raised`);
    kind = "approval.requested";
    payload = { gate: "deploy", sha: v["--sha"], what: `deploy ${v["--sha"].slice(0, 12)}: CI green on every job; nothing deploys until you run the deploy yourself` };
  }
  const refused = spineRefusal(ARC_EVENT, kind, payload, { cwd: REPO, flags });
  if (refused) die(2, `the ${kind} receipt would be refused by the spine, so nothing is written: ${refused}`);
  if (dryRun) { process.stdout.write(`review-ship-record: would emit ${kind} ${JSON.stringify(payload)}\nreview-ship-record: dry run -- no receipt\n`); return; }
  const got = emitReceipt(ARC_EVENT, kind, payload, { cwd: REPO, timeoutMs: 60_000, flags });
  if (got.state !== "landed" || !got.id) die(1, `the ${kind} receipt did not land -- ${got.why}`);
  process.stdout.write(`receipt: ${kind} ${got.id}\n`);
}

function isMainModule() {
  const invoked = process.argv[1];
  if (!invoked) return false;
  try { return realpathSync(invoked) === realpathSync(fileURLToPath(import.meta.url)); } catch { return false; }
}

if (isMainModule()) {
  try { main(); } catch (e) {
    if (!(e instanceof Stop)) { process.stderr.write(`review-ship-record: nothing was written: ${e instanceof Error ? e.message.split("\n")[0] : String(e)}\n`); process.exitCode = 2; }
  }
}
