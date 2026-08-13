#!/usr/bin/env node
/**
 * gate-harness.mjs -- drives the SCH-G policy interlock directly.
 *
 * It PRINTS DATA and asserts nothing; the assertions live in the bats file where a failure is
 * readable. No OS scheduler is constructed here and no task is ever created -- this harness asks
 * the gate what it decides, which is the whole reason the gate was extracted from the CLI.
 *
 * Usage: node gate-harness.mjs <case>
 *   real-green   -- the gate against THIS repo, unforced. Must be green, and that is the negative
 *                   control for every red case: a gate that is red anyway proves nothing.
 *   forced-red   -- the same call with the tightening-only seam set
 *   no-policy    -- a throwaway root with no policy file at all
 *   lint-red     -- policy-lint made to exit non-zero, everything else real
 *   no-root      -- called without a root
 */

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { policyEnforcementGreen } from "../../../.claude/scripts/hq/lib/jobs/policy-gate.mjs";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const REPO = join(HERE, "..", "..", "..");
const CASE = process.argv[2];
const JOB = "day-close-roll";
const out = (label, value) => process.stdout.write(`${label}:${JSON.stringify(value)}\n`);

try {
  if (CASE === "real-green") {
    // `env: {}` rather than the inherited environment: if the seam happened to be exported in the
    // shell that started this, the control would silently become a second red case.
    out("FAILS", policyEnforcementGreen(JOB, { root: REPO, env: {} }));
  } else if (CASE === "forced-red") {
    out("FAILS", policyEnforcementGreen(JOB, { root: REPO, env: { ARC_JOBS_FORCE_POLICY_RED: "1" } }));
  } else if (CASE === "no-policy") {
    const sandbox = mkdtempSync(join(tmpdir(), "arc-gate-"));
    out("FAILS", policyEnforcementGreen(JOB, { root: sandbox, env: {} }));
  } else if (CASE === "lint-red") {
    // Everything real except the lint's exit code. This is the check most likely to rot into a
    // decoration, because a lint that is never red looks identical to one that is never read.
    out("FAILS", policyEnforcementGreen(JOB, {
      root: REPO,
      env: {},
      spawn: () => ({ status: 1, stdout: "", stderr: "policy-lint: pretend failure" }),
    }));
  } else if (CASE === "no-root") {
    out("FAILS", policyEnforcementGreen(JOB, { env: {} }));
  } else {
    process.stderr.write(`unknown case ${CASE}\n`);
    process.exit(64);
  }
  process.stdout.write("HARNESS-DONE\n");
} catch (e) {
  process.stderr.write(`harness threw: ${e?.code || ""} ${e?.message || e}\n`);
  process.exit(1);
}
