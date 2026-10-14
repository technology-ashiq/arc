#!/usr/bin/env node
// The owner's one apply for portfolio REQ-08 (ADR-0079), on ADR-1750's pattern: adds the `process:lane-stale` subject
// to hq.policy.yaml (deny floor -- the agent cannot write it), the lane-stale row to hq.jobs.yaml, and the process stub,
// written whole. They land together: jobs-lint fails a job whose policy_kind the live policy does not hold, and the
// birth rule fails a stub with no subject. Idempotent: a second run changes nothing. jobs-lint is the check that follows.
//   node .claude/scripts/core/owner-apply-lane-stale.mjs
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const POLICY = join(ROOT, "hq.policy.yaml");
const JOBS = join(ROOT, "hq.jobs.yaml");
const STUB = join(ROOT, "processes", "lane-stale.process.yaml");
const WIKI = join(ROOT, ".claude", "scripts", "docs", "wiki-build.mjs");
const STUB_TEXT = [
  "name: lane-stale",
  "version: 1.0.0",
  "intent: \"Derive stale for every LIVE lane no receipt has named in 14 days and raise it to needs-you.\"",
  "permissions: declared",
  "job_stub: true",
  "inputs: []",
  "tools:",
  "  - fs.read",
  "  - fs.write",
  "  - shell.run:",
  "      - \"node .claude/scripts/hq/arc-event.mjs:*\"",
  "body: |",
  "",
  "  NOT AN ENGINE PROCESS. This file exists so the lane-stale job has a POLICY SUBJECT (ADR-0504,",
  "  ADR-0802), exactly as launch-watch does (ADR-1750). `job_stub: true` makes `arc-run --process",
  "  lane-stale` a loud refusal.",
  "",
  "  The owner apply `owner-apply-lane-stale.mjs` wrote this file together with its hq.policy.yaml",
  "  subject and its hq.jobs.yaml row: none of the three may land without the others (ADR-0079).",
  "",
  "  The real work lives in `.claude/scripts/hq/jobs/lane-stale.mjs` and is run by `arc-jobs`, never",
  "  from here: daily, it reads the spine, writes `.claude/state/portfolio/lane-stale.json` and raises",
  "  one `incident.raised` `class: lane-stale` per silent LIVE lane (portfolio REQ-08).",
  "",
].join("\n");
const ANCHOR = "  \"process:build-in-public-draft\":\n";
const BLOCK = [
  "  # portfolio REQ-08 (ADR-0079): the daily lane-stale job reads the spine and PROGRESS headers, writes its derivation",
  "  # under .claude/state/portfolio/ and emits incident.raised through arc-event. No network, never a tracked file.",
  "  \"process:lane-stale\":",
  "    e2: []",
  "    read: { level: L3 }",
  "    write: { level: L2, roots: [\".claude/state/portfolio/**\", \".claude/state/hq/**\"] }",
  "    shell: { level: L1, evidence_days: 35 }",
  "    network: { level: L0 }",
  "    message: { level: L0 }",
  "    publish: { level: L0 }",
  "    deploy: { level: L0 }",
  "    spend: { level: L0 }",
  "",
  "",
].join("\n");
const ROW = [
  "",
  "  # The board that notices (portfolio REQ-08, ADR-0079): a LIVE lane no receipt has named in 14 days is derived",
  "  # stale into instance state and raised to needs-you, once per silence episode. Never written into PORTFOLIO.md.",
  "  - name: lane-stale",
  "    type: script",
  "    entry: .claude/scripts/hq/jobs/lane-stale.mjs",
  "    budget:",
  "      min: 5",
  "    policy_kind: process:lane-stale",
  "    cadence: daily@08:00",
  "    enabled: true",
  "    catchup: skip",
  "",
].join("\n");

// A Windows checkout may hold either file with CRLF: match the anchor in either form and write in the file's own EOL.
const eolOf = (text) => (text.includes("\r\n") ? "\r\n" : "\n");
const inEol = (text, eol) => text.replace(/\r?\n/g, eol);

let rc = 0;
const policy = readFileSync(POLICY, "utf8");
const pe = eolOf(policy);
if (policy.includes("\"process:lane-stale\":")) console.log("hq.policy.yaml already holds process:lane-stale -- unchanged");
else if (!policy.includes(inEol(ANCHOR, pe))) { console.log("hq.policy.yaml has no process:build-in-public-draft anchor -- unchanged; add the block by hand"); rc = 2; }
else { writeFileSync(POLICY, policy.replace(inEol(ANCHOR, pe), inEol(BLOCK + ANCHOR, pe))); console.log("hq.policy.yaml: process:lane-stale added (no network, writes under .claude/state only)"); }

// The row waits for the subject: never add a job the policy would leave unable to run.
const jobs = readFileSync(JOBS, "utf8");
const je = eolOf(jobs);
if (/^\s*- name: lane-stale\s*$/m.test(jobs)) console.log("hq.jobs.yaml already holds lane-stale -- unchanged");
else if (rc) console.log("hq.jobs.yaml: lane-stale not added, the policy subject is missing");
else { writeFileSync(JOBS, jobs.replace(/(\r?\n)*$/, je) + inEol(ROW, je)); console.log("hq.jobs.yaml: lane-stale added (daily@08:00, catchup skip)"); }

if (existsSync(STUB)) console.log("processes/lane-stale.process.yaml already exists -- unchanged");
else if (rc) console.log("processes/lane-stale.process.yaml: not written, the policy subject is missing");
else {
  writeFileSync(STUB, inEol(STUB_TEXT, pe));
  console.log("processes/lane-stale.process.yaml: written (fs.read, fs.write, shell.run of arc-event)");
  if (!existsSync(WIKI)) console.log("wiki-build not found beside this checkout -- run it by hand before committing");
  else {
    const w = spawnSync(process.execPath, [WIKI], { cwd: ROOT, stdio: "inherit" });
    if (w.status !== 0) { console.log("wiki-build failed -- run it by hand before committing"); rc = 2; }
  }
}
process.exitCode = rc;
