#!/usr/bin/env node
/**
 * ci-digest.mjs -- the CI law as a script (ADR-0226): read CI per JOB, for the commit you are on.
 *
 *   node .claude/scripts/review/ci-digest.mjs [--sha SHA] [--tail N]
 *
 * CLAUDE.md: "After a push, read CI per-JOB before reporting the work done ... confirm the run's
 * head SHA is the local HEAD." That law was prose, so every building session polled CI by hand
 * and re-read its whole context on each poll. This is one call, run OUTSIDE the building session.
 *
 * What it does, in order:
 *   1. the runs GitHub has for the commit (`gh run list --commit`), newest attempt per workflow;
 *   2. each run's head SHA re-read from `gh run view` and ASSERTED equal to the local commit --
 *      the list is asked by SHA, and the view is checked by SHA, because "validate one read, use
 *      another" is the repo's most repeated defect;
 *   3. a per-job conclusion table -- never the workflow's rolled-up status alone;
 *   4. for every failed job, the last N lines of its failed-step log (default 40, max 200).
 *
 * Exit: 0 every job green · 1 at least one job red (reported even while others still run) ·
 * 2 usage / gh unavailable · 3 pending (no run yet, or jobs still running) · 4 SHA mismatch
 * (GitHub's newest run on this branch is for a different commit than local HEAD).
 */
import { execFileSync } from "node:child_process";
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

const GREEN = new Set(["success", "skipped", "neutral"]);
const RED = new Set(["failure", "cancelled", "timed_out", "action_required", "startup_failure", "stale"]);
const SHA_RE = /^[0-9a-f]{40}$/;

// A CI log is written by the code under test, so it is untrusted text. A bare CR let a failing step
// print "RED: 999 job(s) failed." over its own prefix, indistinguishable from this script's verdict
// (round-2 boundary attack B9). ANSI sequences go first, then every control character except TAB
// (gh separates job, step and text with tabs). Built from code points, never typed escapes.
const ESC = String.fromCharCode(27);
const ANSI = new RegExp(`${ESC}\\[[0-9;?]*[ -/]*[@-~]`, "g");
const CONTROL = new RegExp(`[${String.fromCharCode(0)}-${String.fromCharCode(8)}${String.fromCharCode(10)}-${String.fromCharCode(31)}${String.fromCharCode(127, 0x2028, 0x2029)}]`, "g");
export const safeLine = (s) => String(s ?? "").replace(ANSI, "").replace(CONTROL, " ");

/**
 * Pure: everything GitHub-shaped arrives through `gh(args) -> stdout string`, so a test hands in
 * recorded JSON and the exact code path the CLI runs is the one under test.
 * Returns { code, lines }.
 */
export function digest({ gh, head, branch, tail = 40 }) {
  const lines = [];
  const say = (s) => lines.push(s);
  if (!SHA_RE.test(head)) return { code: 2, lines: [`ci-digest: \`${head}\` is not a full commit SHA`] };

  const listFields = "databaseId,headSha,status,conclusion,workflowName,createdAt,attempt";
  const runs = JSON.parse(gh(["run", "list", "--commit", head, "--limit", "50", "--json", listFields]) || "[]");
  // Asked by SHA; still checked by SHA. A list that returned another commit's run is not this one.
  const mine = runs.filter((r) => r.headSha === head);

  if (mine.length === 0) {
    // No run for HEAD. Either CI has not picked the push up yet (pending), or the newest run on
    // the branch is for a DIFFERENT commit -- which is the mismatch this law exists to catch.
    if (branch) {
      const onBranch = JSON.parse(gh(["run", "list", "--branch", branch, "--limit", "1", "--json", listFields]) || "[]");
      if (onBranch.length && onBranch[0].headSha !== head) {
        say(`SHA MISMATCH: the newest run on ${branch} is for ${onBranch[0].headSha.slice(0, 12)}, local HEAD is ${head.slice(0, 12)}.`);
        say("Push HEAD, or check out the commit CI ran -- a green run on another commit says nothing about this one.");
        return { code: 4, lines };
      }
    }
    say(`PENDING: no CI run exists yet for ${head.slice(0, 12)}.`);
    say("(arc's CI runs on pull requests and workflow_dispatch only -- a commit on main gets a run only when one is dispatched.)");
    return { code: 3, lines };
  }

  // Newest attempt per workflow: a re-run supersedes the attempt it re-ran.
  const latest = new Map();
  for (const r of mine) {
    const prev = latest.get(r.workflowName);
    if (!prev || String(r.createdAt) > String(prev.createdAt) || (r.createdAt === prev.createdAt && (r.attempt ?? 1) > (prev.attempt ?? 1))) latest.set(r.workflowName, r);
  }

  let anyRed = false, anyPending = false;
  const failed = [];
  for (const run of [...latest.values()].sort((a, b) => String(a.workflowName).localeCompare(String(b.workflowName)))) {
    const view = JSON.parse(gh(["run", "view", String(run.databaseId), "--json", "headSha,status,conclusion,jobs,url"]));
    if (view.headSha !== head) {
      say(`SHA MISMATCH: run ${run.databaseId} (${safeLine(run.workflowName)}) reports head ${String(view.headSha).slice(0, 12)}, local HEAD is ${head.slice(0, 12)}.`);
      return { code: 4, lines };
    }
    const jobs = Array.isArray(view.jobs) ? view.jobs : [];
    say(`${safeLine(run.workflowName)} -- run ${run.databaseId} @ ${head.slice(0, 12)} -- ${jobs.length} job(s)${view.url ? ` -- ${view.url}` : ""}`);
    if (jobs.length === 0) {
      // A run with no jobs listed yet is not a green run with nothing in it.
      anyPending = true;
      say("  (no jobs reported yet)");
      continue;
    }
    for (const j of jobs) {
      const state = j.status !== "completed" ? j.status || "unknown" : j.conclusion || "unknown";
      let mark;
      if (j.status !== "completed") { mark = "…"; anyPending = true; }
      else if (GREEN.has(j.conclusion)) mark = "✓";
      else if (RED.has(j.conclusion)) { mark = "✗"; anyRed = true; failed.push({ run, job: j }); }
      // An unknown conclusion is neither green nor red, and is never counted as green.
      else { mark = "?"; anyPending = true; }
      say(`  ${mark} ${safeLine(j.name)} -- ${safeLine(state)}`);
    }
  }

  for (const { run, job } of failed) {
    let log = "";
    try { log = gh(["run", "view", String(run.databaseId), "--job", String(job.databaseId), "--log-failed"]); }
    catch (e) { log = `(could not fetch the failed log: ${String(e.message).split("\n")[0]})`; }
    const rows = String(log).replace(/\s+$/, "").split(/\r?\n/);
    // THE FAILING TESTS, FROM ANYWHERE IN THE LOG. bats prints `not ok N` mid-run and its summary
    // last, so on the first real red run (PR #265) the 40-line tail held none of the five failures
    // and the full log had to be fetched by hand -- the exact step this script exists to remove.
    const notOk = rows.filter((l) => /\bnot ok \d+\b/.test(l));
    if (notOk.length) {
      say(`--- ${safeLine(job.name)}: ${notOk.length} failing test line(s)${notOk.length > 20 ? ", first 20" : ""}`);
      for (const l of notOk.slice(0, 20)) say(`  ${safeLine(l)}`);
    }
    say(`--- ${safeLine(job.name)}: last ${Math.min(tail, rows.length)} of ${rows.length} failed-log line(s)`);
    for (const l of rows.slice(-tail)) say(`  ${safeLine(l)}`);
  }

  if (anyRed) { say(`RED: ${failed.length} job(s) failed.`); return { code: 1, lines }; }
  if (anyPending) { say("PENDING: jobs are still running (or reported a state that is not a conclusion)."); return { code: 3, lines }; }
  say("GREEN: every job concluded green.");
  return { code: 0, lines };
}

export function parseArgs(argv) {
  const o = { sha: null, tail: 40 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.includes("=") && a.startsWith("--")) return { error: `\`${a}\`: write the value as a separate argument (--flag VALUE)` };
    if (a !== "--sha" && a !== "--tail") return { error: `unknown argument \`${a}\`` };
    const v = argv[i + 1];
    if (v === undefined || v === "" || v.startsWith("--")) return { error: `${a} needs a value` };
    i++;
    if (a === "--sha") {
      // One argv element to git, but git's own option parser still reads a leading `-`.
      if (!/^[A-Za-z0-9][A-Za-z0-9._/@{}~^-]*$/.test(v)) return { error: `\`${v}\` is not a revision this script will hand to git` };
      o.sha = v;
    }
    else {
      if (!/^[1-9][0-9]{0,2}$/.test(v) || Number(v) > 200) return { error: `--tail must be 1-200 (got \`${v}\`)` };
      o.tail = Number(v);
    }
  }
  return { opts: o };
}

function realGh(args) {
  return execFileSync("gh", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });
}

function main(argv) {
  const p = parseArgs(argv);
  if (p.error) {
    process.stderr.write(`ci-digest: ${p.error}\nusage: ci-digest.mjs [--sha SHA] [--tail N]\n`);
    return 2;
  }
  let head, branch = null;
  try {
    // A short or symbolic --sha is resolved to the full commit, so the comparison is exact.
    head = execFileSync("git", ["rev-parse", "--verify", "--quiet", `${p.opts.sha || "HEAD"}^{commit}`], { encoding: "utf8" }).trim();
    const b = execFileSync("git", ["branch", "--show-current"], { encoding: "utf8" }).trim();
    branch = b || null;
  } catch {
    process.stderr.write(`ci-digest: \`${p.opts.sha || "HEAD"}\` does not name a commit here\n`);
    return 2;
  }
  let out;
  try { out = digest({ gh: realGh, head, branch, tail: p.opts.tail }); }
  catch (e) {
    process.stderr.write(`ci-digest: gh failed: ${String(e.message).split("\n")[0]}\n`);
    return 2;
  }
  for (const l of out.lines) process.stdout.write(`${l}\n`);
  return out.code;
}

function isMainModule() {
  try { return !!process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); } catch { return false; }
}

if (isMainModule()) process.exitCode = main(process.argv.slice(2));
