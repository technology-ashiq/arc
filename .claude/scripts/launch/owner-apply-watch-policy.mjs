#!/usr/bin/env node
// The owner's one apply for launch REQ-10 (ADR-1750): adds the `process:launch-watch` subject to hq.policy.yaml, which is
// on the deny floor, so the agent cannot write it, the launch-watch row to hq.jobs.yaml, and the full tools of the
// process stub (then rebuilds the wiki). They land together:
// jobs-lint fails a job whose policy_kind the live policy does not hold, so the row cannot ship ahead of the subject.
// Idempotent: a second run changes nothing. The policy block goes before `process:build-in-public-draft`; the job row
// is appended. jobs-lint is the check that follows.
//   node .claude/scripts/launch/owner-apply-watch-policy.mjs
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const POLICY = join(ROOT, "hq.policy.yaml");
const JOBS = join(ROOT, "hq.jobs.yaml");
const STUB = join(ROOT, "processes", "launch-watch.process.yaml");
const NARROW = "tools:\n  - fs.read\nbody: |\n";
const WIDE = "tools:\n  - fs.read\n  - fs.write\n  - shell.run:\n      - \"node .claude/scripts/launch/arc-launch.mjs:*\"\nbody: |\n";
const ANCHOR = "  \"process:build-in-public-draft\":\n";
const BLOCK = [
  "  # launch REQ-10 (ADR-1750): the weekly watch shells out to arc-launch verify --public-only, which asks the venture's",
  "  # public endpoints (network) and writes the board's last_verify and the watch stamp under .claude/state/.",
  "  \"process:launch-watch\":",
  "    e2: []",
  "    read: { level: L3 }",
  "    write: { level: L2, roots: [\".claude/state/launch/**\", \".claude/state/hq/**\"] }",
  "    shell: { level: L1, evidence_days: 35 }",
  "    network: { level: L1 }",
  "    message: { level: L0 }",
  "    publish: { level: L0 }",
  "    deploy: { level: L0 }",
  "    spend: { level: L0 }",
  "",
  "",
].join("\n");
const ROW = [
  "",
  "  # The weekly watch on every launched venture (launch REQ-10, ADR-1750). Daily cadence, because the grammar has no",
  "  # weekly form; the script acts once every seven days and keeps its last day in instance state.",
  "  - name: launch-watch",
  "    type: script",
  "    entry: .claude/scripts/hq/jobs/launch-watch.mjs",
  "    budget:",
  "      min: 30",
  "    policy_kind: process:launch-watch",
  "    cadence: daily@07:30",
  "    enabled: true",
  "    catchup: skip",
  "",
].join("\n");

// A Windows checkout may hold either file with CRLF: match the anchor in either form and write in the file's own EOL,
// so the apply neither refuses on the owner's own box nor leaves mixed line endings (attack 143525f B7).
const eolOf = (text) => (text.includes("\r\n") ? "\r\n" : "\n");
const inEol = (text, eol) => text.replace(/\r?\n/g, eol);

let rc = 0;
const policy = readFileSync(POLICY, "utf8");
const pe = eolOf(policy);
if (policy.includes("\"process:launch-watch\":")) console.log("hq.policy.yaml already holds process:launch-watch -- unchanged");
else if (!policy.includes(inEol(ANCHOR, pe))) { console.log("hq.policy.yaml has no process:build-in-public-draft anchor -- unchanged; add the block by hand"); rc = 2; }
else { writeFileSync(POLICY, policy.replace(inEol(ANCHOR, pe), inEol(BLOCK + ANCHOR, pe))); console.log("hq.policy.yaml: process:launch-watch added (network L1, writes under .claude/state only)"); }

// The row waits for the subject: never add a job the policy would leave unable to run.
const jobs = readFileSync(JOBS, "utf8");
const je = eolOf(jobs);
if (/^\s*- name: launch-watch\s*$/m.test(jobs)) console.log("hq.jobs.yaml already holds launch-watch -- unchanged");
else if (rc) console.log("hq.jobs.yaml: launch-watch not added, the policy subject is missing");
else { writeFileSync(JOBS, jobs.replace(/(\r?\n)*$/, je) + inEol(ROW, je)); console.log("hq.jobs.yaml: launch-watch added (daily@07:30, acts every 7 days)"); }

// The stub ships declaring fs.read only, because the every-process gate blocks a process that declares more than its
// absent subject allows. Once the subject exists, the stub declares what the job really does, and the wiki that
// renders the stub is rebuilt.
const stub = readFileSync(STUB, "utf8");
const se = eolOf(stub);
if (/shell\.run:/.test(stub)) console.log("processes/launch-watch.process.yaml already declares fs.write and shell.run -- unchanged");
else if (rc) console.log("processes/launch-watch.process.yaml: not widened, the policy subject is missing");
else if (!stub.includes(inEol(NARROW, se))) { console.log("processes/launch-watch.process.yaml: no fs.read-only tools block -- unchanged; widen it by hand"); rc = 2; }
else {
  writeFileSync(STUB, stub.replace(inEol(NARROW, se), inEol(WIDE, se)));
  console.log("processes/launch-watch.process.yaml: tools widened to fs.write and shell.run of arc-launch");
  const w = spawnSync(process.execPath, [join(ROOT, ".claude", "scripts", "docs", "wiki-build.mjs")], { cwd: ROOT, stdio: "inherit" });
  if (w.status !== 0) { console.log("wiki-build failed -- run it by hand before committing"); rc = 2; }
}
process.exitCode = rc;
