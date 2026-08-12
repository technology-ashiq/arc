#!/usr/bin/env node
/**
 * jobs-lint.mjs -- the validator for `hq.jobs.yaml` (SCH-B, REQ-01).
 *
 * A VALIDATOR, NOT AN ADVISORY LINT. It exits 2 from birth on any violation, for the same
 * reason `policy-lint` does: a schedule file that parses when it should not is a job nobody
 * authorised, running unattended, on a timer.
 *
 * The rules live in lib/jobs/schema.mjs and take their world by injection. This file only
 * loads that world, decides an exit code, and prints. Keeping the two apart is what lets the
 * hostile corpus drive the rules directly with a synthetic policy file instead of the live one.
 *
 * Usage:
 *   node .claude/scripts/hq/jobs-lint.mjs [--file PATH] [--bill] [--json]
 *
 * Exit codes: 0 clean · 2 findings · 1 the lint could not run at all (missing file, unreadable
 * policy). 1 and 2 are deliberately different: "this schedule is illegal" and "I could not tell"
 * are not the same answer, and collapsing them lets a broken checkout read as a clean one.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { lintJobs } from "./lib/jobs/schema.mjs";
import { parsePolicyYaml } from "./lib/policy/yaml.mjs";
import { processNames } from "./lib/policy/subjects.mjs";
import { policyRoot } from "./lib/policy/run-gate.mjs";

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const valueOf = (f) => {
  const i = argv.indexOf(f);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : null;
};

if (has("--help") || has("-h")) {
  process.stdout.write("usage: jobs-lint [--file PATH] [--bill] [--json]\n");
  process.exit(0);
}

// THE GOVERNING ROOT IS THIS MODULE'S OWN, never a caller-supplied one. `run-gate.mjs` learned
// this the hard way: `ARC_ROOT=/tmp/anywhere` was a one-variable disarm of the whole policy
// gate. A schedule validator has exactly the same shape, so it borrows the same resolver
// rather than growing a second, weaker one.
const root = policyRoot();
const jobsPath = valueOf("--file") || join(root, "hq.jobs.yaml");

if (!existsSync(jobsPath)) {
  process.stderr.write(`jobs-lint: no hq.jobs.yaml at ${jobsPath} -- nothing is scheduled here\n`);
  process.exit(1);
}

let text;
try {
  text = readFileSync(jobsPath, "utf8");
} catch (e) {
  process.stderr.write(`jobs-lint: cannot read ${jobsPath}: ${e?.message || e}\n`);
  process.exit(1);
}

// The LIVE policy file, not a copy. An absent policy file is fatal here rather than permissive:
// unlike `arc-run`, which must keep working in consumer repos that never adopted policy, a
// schedule only exists in a root that has one -- so "no policy" means the checkout is broken,
// and a validator that shrugs at that is a validator that stops validating.
let policy = null;
const policyPath = join(root, "hq.policy.yaml");
if (!existsSync(policyPath)) {
  process.stderr.write(`jobs-lint: no hq.policy.yaml at ${policyPath} -- every policy_kind would be unverifiable, so this is a refusal rather than a pass\n`);
  process.exit(1);
}
try {
  policy = parsePolicyYaml(readFileSync(policyPath, "utf8"));
} catch (e) {
  process.stderr.write(`jobs-lint: hq.policy.yaml does not parse: ${e?.message || e}\n`);
  process.exit(1);
}

let known = null;
try {
  known = processNames(root);
} catch (e) {
  process.stderr.write(`jobs-lint: processes/ exists but cannot be read: ${e?.message || e}\n`);
  process.exit(1);
}

const { findings, bill } = lintJobs(text, { root, policy, processNames: known });

if (has("--json")) {
  process.stdout.write(`${JSON.stringify({ findings, bill }, null, 2)}\n`);
  process.exit(findings.length ? 2 : 0);
}

if (has("--bill")) {
  const rows = bill?.rows ?? [];
  process.stdout.write("worst-case month (the ceiling, not an average -- a budget check that passes on a typical month is not a budget check)\n");
  if (rows.length === 0) {
    process.stdout.write("  no job carries a rupee budget: every scheduled job is a deterministic script, so the worst case is INR 0 by construction\n");
  } else {
    for (const r of rows)
      process.stdout.write(`  ${r.name.padEnd(24)} ${r.cadence.padEnd(18)} INR ${r.inr} x ${r.slots} slots = INR ${r.monthly}\n`);
  }
  const declared = bill?.ceiling;
  process.stdout.write(`  ${"TOTAL".padEnd(24)} ${"".padEnd(18)} INR ${bill?.worstCaseInr ?? 0}${declared === null || declared === undefined ? "" : ` of a declared ceiling of INR ${declared}`}\n`);
}

if (findings.length === 0) {
  if (!has("--bill")) process.stdout.write("jobs-lint: clean\n");
  process.exit(0);
}

for (const f of findings) process.stderr.write(`FAIL  [${f.code}] ${f.where}: ${f.message}\n`);
process.stderr.write(`\njobs-lint: ${findings.length} finding(s) -- this schedule does not run.\n`);
process.exit(2);
