#!/usr/bin/env node
// The owner's one apply for launch REQ-10 (ADR-1750): adds the `process:launch-watch` subject to hq.policy.yaml, which is
// on the deny floor, so the agent cannot write it, and the launch-watch row to hq.jobs.yaml. The two land together:
// jobs-lint fails a job whose policy_kind the live policy does not hold, so the row cannot ship ahead of the subject.
// Idempotent: a second run changes nothing. The policy block goes before `process:build-in-public-draft`; the job row
// is appended. jobs-lint is the check that follows.
//   node .claude/scripts/launch/owner-apply-watch-policy.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const POLICY = join(ROOT, "hq.policy.yaml");
const JOBS = join(ROOT, "hq.jobs.yaml");
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

let rc = 0;
const policy = readFileSync(POLICY, "utf8");
if (policy.includes("\"process:launch-watch\":")) console.log("hq.policy.yaml already holds process:launch-watch -- unchanged");
else if (!policy.includes(ANCHOR)) { console.log("hq.policy.yaml has no process:build-in-public-draft anchor -- unchanged; add the block by hand"); rc = 2; }
else { writeFileSync(POLICY, policy.replace(ANCHOR, BLOCK + ANCHOR)); console.log("hq.policy.yaml: process:launch-watch added (network L1, writes under .claude/state only)"); }

// The row waits for the subject: never add a job the policy would leave unable to run.
const jobs = readFileSync(JOBS, "utf8");
if (/^\s*- name: launch-watch\s*$/m.test(jobs)) console.log("hq.jobs.yaml already holds launch-watch -- unchanged");
else if (rc) console.log("hq.jobs.yaml: launch-watch not added, the policy subject is missing");
else { writeFileSync(JOBS, jobs.replace(/\n*$/, "\n") + ROW); console.log("hq.jobs.yaml: launch-watch added (daily@07:30, acts every 7 days)"); }
process.exit(rc);
