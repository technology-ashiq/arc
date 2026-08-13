#!/usr/bin/env node
/**
 * lint-harness.mjs -- drives lib/jobs/schema.mjs directly for the hostile corpus.
 *
 * WHY A FILE AND NOT `node -e`. A program embedded in a shell string carries no apostrophes,
 * and this repo has shipped that bug twice in one file -- the second time inside the comment
 * explaining the first. The moment an embedded program wants an apostrophe it belongs in its
 * own file, so here it is.
 *
 * WHY IT DRIVES THE MODULE RATHER THAN THE CLI. `lintJobs` takes its whole world by injection,
 * which is the only reason the corpus can hand it a policy that grants spend, or a write root
 * that reaches the code -- neither of which exists in the live `hq.policy.yaml`, and neither of
 * which should. The CLI path (real YAML, real policy file) is covered separately end to end.
 *
 * Usage: node lint-harness.mjs <jobs.yaml> <policy.json> [--root DIR]
 *
 * Output: one `CODE:<finding-code>` line per finding, then `HARNESS-DONE <count>`. That trailing
 * marker is emitted ONLY on the path that ran the linter to completion, so a test can assert the
 * harness RAN before asserting what it found -- a crash prints no marker, and "output does not
 * contain X" is satisfied by a crash.
 */

import { readFileSync } from "node:fs";
import { lintJobs } from "../../../.claude/scripts/hq/lib/jobs/schema.mjs";

const [jobsPath, policyPath, ...rest] = process.argv.slice(2);
if (!jobsPath || !policyPath) {
  process.stderr.write("usage: lint-harness.mjs <jobs.yaml> <policy.json> [--root DIR]\n");
  process.exit(64);
}

const rootIdx = rest.indexOf("--root");
const root = rootIdx >= 0 && rest[rootIdx + 1] ? rest[rootIdx + 1] : process.cwd();

const text = readFileSync(jobsPath, "utf8");

// The literal `NONE` injects NO policy at all, so the corpus can assert that a validator which
// cannot read its own law refuses rather than passes. That case has no file to point at.
const policy = policyPath === "NONE" ? null : JSON.parse(readFileSync(policyPath, "utf8"));

// `__processNames` absent means null -- "cannot check" -- which is a DIFFERENT world from `[]`,
// "checked, there are none". subjects.mjs states that contract in its own header and the first
// version of schema.mjs conflated them.
const processNames = policy && Object.prototype.hasOwnProperty.call(policy, "__processNames")
  ? policy.__processNames
  : null;

const { findings, bill } = lintJobs(text, { root, policy, processNames });

for (const f of findings) process.stdout.write(`CODE:${f.code}\n`);
if (bill) process.stdout.write(`BILL:${bill.worstCaseInr}\n`);
process.stdout.write(`HARNESS-DONE ${findings.length}\n`);
