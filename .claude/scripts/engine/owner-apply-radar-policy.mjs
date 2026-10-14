#!/usr/bin/env node
// owner-apply-radar-policy.mjs -- the owner's one command that births the distribute-radar job (distribute REQ-19,
// ADR-2026), the way owner-apply-watch-policy.mjs birthed launch-watch (ADR-1750).
//
// hq.policy.yaml is a ceiling file: a change to it is a human edit in a reviewed diff (POL-A), so the agent never
// writes it. This script writes the three files that must land together -- the policy subject, the job row and the
// job stub -- and nothing else, idempotently; the owner runs it once from the arc checkout and commits the result.
//
//   cd <arc checkout> && node .claude/scripts/engine/owner-apply-radar-policy.mjs && git add hq.policy.yaml hq.jobs.yaml processes/distribute-radar.process.yaml docs/wiki && git commit -m "feat(distribute): birth the distribute-radar job (REQ-19, ADR-2026)"
//
// The radar reads the registry under the owner's home and the arc checkout, writes only its own stamp under
// .claude/state/ and one receipt, and calls no model and no network.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const POLICY = join(ROOT, "hq.policy.yaml");
const JOBS = join(ROOT, "hq.jobs.yaml");
const STUB = join(ROOT, "processes", "distribute-radar.process.yaml");
const STUB_TEXT = [
  "name: distribute-radar",
  "version: 1.0.0",
  "intent: \"Report weekly how far every project arc is installed in is behind arc, without writing to any of them.\"",
  "permissions: declared",
  "job_stub: true",
  "inputs: []",
  "tools:",
  "  - fs.read",
  "  - fs.write",
  "  - shell.run:",
  "      - \"bash .claude/scripts/hq/arc-event.sh:*\"",
  "body: |",
  "",
  "  NOT AN ENGINE PROCESS. This file exists so the distribute-radar job has a POLICY SUBJECT (ADR-0504,",
  "  ADR-0802), exactly as launch-watch does. `job_stub: true` makes `arc-run --process distribute-radar`",
  "  a loud refusal.",
  "",
  "  The owner apply `owner-apply-radar-policy.mjs` wrote this file together with its hq.policy.yaml subject and",
  "  its hq.jobs.yaml row: none of the three may land without the others (ADR-2026).",
  "",
  "  The real work lives in `.claude/scripts/hq/jobs/distribute-radar.mjs` and is run by `arc-jobs`: once every",
  "  seven days, `arc outdated --all` over the local consumer registry and one `metric.observed` receipt.",
  "",
].join("\n");
const ANCHOR = "  \"process:launch-watch\":\n";
const BLOCK = [
  "  # distribute REQ-19 (ADR-2026): the weekly radar reads the consumer registry and each project's manifest, writes only",
  "  # its stamp under .claude/state/ and one receipt, and calls no network and no model.",
  "  \"process:distribute-radar\":",
  "    e2: []",
  "    read: { level: L3 }",
  "    write: { level: L2, roots: [\".claude/state/distribute/**\", \".claude/state/hq/**\"] }",
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
  "  # The weekly radar over every project arc is installed in (distribute REQ-19, ADR-2026). Daily cadence, because the",
  "  # grammar has no weekly form; the script acts once every seven days and keeps its last day in instance state.",
  "  - name: distribute-radar",
  "    type: script",
  "    entry: .claude/scripts/hq/jobs/distribute-radar.mjs",
  "    budget:",
  "      min: 10",
  "    policy_kind: process:distribute-radar",
  "    cadence: daily@07:45",
  "    enabled: true",
  "    catchup: skip",
  "",
].join("\n");

const eolOf = (text) => (text.includes("\r\n") ? "\r\n" : "\n");
const inEol = (text, eol) => text.replace(/\r?\n/g, eol);

let rc = 0;
const policy = readFileSync(POLICY, "utf8");
const pe = eolOf(policy);
if (policy.includes("\"process:distribute-radar\":")) console.log("hq.policy.yaml already holds process:distribute-radar -- unchanged");
else if (!policy.includes(inEol(ANCHOR, pe))) { console.log("hq.policy.yaml has no process:launch-watch anchor -- unchanged; add the block by hand"); rc = 2; }
else { writeFileSync(POLICY, policy.replace(inEol(ANCHOR, pe), inEol(BLOCK + ANCHOR, pe))); console.log("hq.policy.yaml: process:distribute-radar added (network L0, writes under .claude/state only)"); }

const jobs = readFileSync(JOBS, "utf8");
const je = eolOf(jobs);
if (/^\s*- name: distribute-radar\s*$/m.test(jobs)) console.log("hq.jobs.yaml already holds distribute-radar -- unchanged");
else if (rc) console.log("hq.jobs.yaml: distribute-radar not added, the policy subject is missing");
else { writeFileSync(JOBS, jobs.replace(/(\r?\n)*$/, je) + inEol(ROW, je)); console.log("hq.jobs.yaml: distribute-radar added (daily@07:45, acts every 7 days)"); }

if (existsSync(STUB)) console.log("processes/distribute-radar.process.yaml already exists -- unchanged");
else if (rc) console.log("processes/distribute-radar.process.yaml: not written, the policy subject is missing");
else {
  writeFileSync(STUB, inEol(STUB_TEXT, pe));
  console.log("processes/distribute-radar.process.yaml: written (fs.read, fs.write, shell.run of arc-event)");
  const w = spawnSync(process.execPath, [join(ROOT, ".claude", "scripts", "docs", "wiki-build.mjs")], { cwd: ROOT, stdio: "inherit" });
  if (w.status !== 0) { console.log("wiki-build failed -- run it by hand before committing"); rc = 2; }
}
process.exitCode = rc;
