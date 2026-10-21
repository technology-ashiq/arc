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
// The process each verb may be credited to: a run inside qa-run cannot sign its receipt as another process (attack
// 09a1c07 B2). The version is the caller's; the NAME is bound to the verb.
const PROCESS_OF = Object.freeze({ qa: "qa-run", ship: "ship-run" });
// The children's environment, without the git location variables a caller could have set: a child resolving the repo
// must resolve THIS one (attack 09a1c07 B10).
const childEnv = () => Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^GIT_(DIR|WORK_TREE|INDEX_FILE|OBJECT_DIRECTORY|COMMON_DIR|NAMESPACE|CEILING_DIRECTORIES)$/i.test(k)));
/** Child text as a refusal may print it: printable ASCII, capped (attack 09a1c07 B6). */
const plain = (t, n) => String(t ?? "").slice(0, n).replace(/[^\x20-\x7e]/g, "?");
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
  if (v["--as-process"] !== undefined && v["--as-process"].split("@")[0] !== PROCESS_OF[verb]) die(2, `${verb} is credited to ${PROCESS_OF[verb]} only, never to ${plain(v["--as-process"].split("@")[0], 64)}`);
  if (verb === "qa") {
    for (const k of ["--url", "--bugs", "--fixed"]) if (v[k] === undefined) die(2, `qa needs ${k}`);
    if (!URL_RE.test(v["--url"]) || v["--url"].length > 300) die(2, "--url is an http(s) URL with no query, at most 300 bytes");
    if (!COUNT_RE.test(v["--bugs"]) || !COUNT_RE.test(v["--fixed"])) die(2, "--bugs and --fixed are whole numbers");
    if (Number(v["--fixed"]) > Number(v["--bugs"])) die(2, "--fixed cannot exceed --bugs");
  } else if (v["--sha"] === undefined || !SHA_RE.test(v["--sha"])) die(2, "ship needs --sha, the full 40-hex commit CI ran on");
  return { verb, v, dryRun };
}

/**
 * CI's verdict for SHA, read per job by ci-digest: 0 every job green, 1 a job red, 3 still running, anything else the
 * read itself failed -- each named apart, so "CI is red" is never said of a CI nobody could reach (attack 09a1c07 B4).
 * ARC_REVIEW_SHIP_CI_DIGEST swaps the reader for a fixture, and is honoured only on a scratch spine (ARC_SPINE_ROOT
 * set): a forged green can never raise a gate on the canonical one.
 * @param {string} sha
 */
function ciVerdict(sha) {
  // The canonical spine is never a scratch one: a fixture reader named beside it is refused, not honoured (attack 2d8afd0 B2).
  const scratch = process.env.ARC_SPINE_ROOT ? resolve(process.env.ARC_SPINE_ROOT) : "";
  const canonical = resolve(REPO, ".claude", "state", "hq");
  if (process.env.ARC_REVIEW_SHIP_CI_DIGEST && (!scratch || scratch.toLowerCase() === canonical.toLowerCase() || scratch.toLowerCase().startsWith(resolve(REPO).toLowerCase())))
    die(2, "ARC_REVIEW_SHIP_CI_DIGEST is a test door for a scratch spine outside this repo; it is never read beside the canonical one");
  const fixture = scratch && process.env.ARC_REVIEW_SHIP_CI_DIGEST ? process.env.ARC_REVIEW_SHIP_CI_DIGEST : null;
  const r = spawnSync(process.execPath, [fixture || CI_DIGEST, "--sha", sha], { cwd: REPO, encoding: "utf8", timeout: 120_000, maxBuffer: 4 << 20, env: childEnv() });
  const tail = plain(String(r.stdout || "").trim().split(/\r?\n/).pop() || "", 200);
  const state = r.error ? `could not be read (${plain(/** @type {any} */ (r.error).code || r.error.message, 40)})`
    : r.status === 0 ? "green" : r.status === 1 ? "red" : r.status === 3 ? "still running"
    : `could not be read (ci-digest ${r.status === null ? `killed by ${r.signal || "a timeout"}` : `exit ${r.status}`})`;
  return { green: state === "green", state, tail };
}

/** The commit this checkout is on, read here, never taken on the caller's word (attack 09a1c07 B3). */
function headSha() {
  const r = spawnSync("git", ["rev-parse", "HEAD"], { cwd: REPO, encoding: "utf8", timeout: 30_000, env: childEnv() });
  const sha = String(r.stdout || "").trim();
  return r.status === 0 && SHA_RE.test(sha) ? sha : null;
}

function main() {
  const { verb, v, dryRun } = parseArgs(process.argv.slice(2));
  const flags = v["--as-process"] ? ["--process", v["--as-process"]] : [];
  let kind, payload;
  if (verb === "qa") {
    kind = "qa.completed";
    // The counts are the session's own report: the writer cannot see the qa-tester run, so the receipt says whose
    // count it is rather than passing it off as measured (attack 2d8afd0 B3).
    payload = { url: v["--url"], bugs: v["--bugs"], fixed: v["--fixed"], counted_by: "session-reported" };
  } else {
    // The gate is for the commit being prepared: a green SHA from another commit raises nothing (attack 09a1c07 B3).
    const head = headSha();
    if (head === null) die(2, "the checkout's HEAD could not be read -- no deploy gate is raised");
    if (v["--sha"] !== head) die(2, `--sha ${v["--sha"].slice(0, 12)} is not this checkout's HEAD (${head.slice(0, 12)}) -- a gate is raised only for the commit being prepared`);
    const ci = ciVerdict(v["--sha"]);
    if (!ci.green) die(2, `CI for ${v["--sha"].slice(0, 12)} is ${ci.state}${ci.tail ? ` (${ci.tail})` : ""} -- no deploy gate is raised`);
    // HEAD again, after the CI read: the branch can move while CI is asked (attack 2d8afd0 B1).
    if (headSha() !== v["--sha"]) die(2, "HEAD moved while CI was read -- no deploy gate is raised; prepare the ship again");
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
