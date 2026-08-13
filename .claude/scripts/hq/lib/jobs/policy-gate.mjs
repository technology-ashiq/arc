/**
 * policy-gate.mjs -- the interlock in front of the unattended surface (SCH-G, REQ-04).
 *
 * `register` is the moment arc stops being attended, so it is the moment the policy engine has to
 * be VERIFIED rather than assumed. If policy were ever rolled back, or its enforcement broken by
 * a refactor, the heartbeat's unattended half turns itself OFF rather than running unpoliced --
 * the only safe direction for a gate whose subject is unattended execution.
 *
 * WHY THIS IS A MODULE AND NOT TEN LINES INSIDE THE CLI. A gate that can only be exercised by
 * running the command it guards can only be tested by breaking the repo's real policy file, and a
 * test that has to break the thing it protects is a test nobody runs twice. Here the same
 * function the CLI calls can be handed a throwaway root and asked what it decides -- with no OS,
 * no scheduled task, and nothing to put back afterwards.
 *
 * THE ROOT IS THE CALLER'S, AND THE CLI'S CALLER IS ITSELF. `arc-jobs` passes `policyRoot()` and
 * never an argument, so the production path keeps the property `run-gate` learned the hard way
 * when `ARC_ROOT=/tmp/anywhere` turned out to be a one-variable disarm of the entire policy gate.
 *
 * Zero dependencies, Node 18+.
 */

import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { parseYamlSubset } from "../../../engine/yaml-subset.mjs";
import { parsePolicyYaml } from "../policy/yaml.mjs";
import { authorizeRun } from "../policy/run-gate.mjs";
import { authorizeAction } from "../policy/authorize.mjs";

/** A subject that exists in no policy anywhere. The live negative control's whole point. */
export const UNDECLARED_SUBJECT = "process:__no_such_subject_ever__";

function processDoc(root, name) {
  const p = join(root, "processes", `${name}.process.yaml`);
  if (!existsSync(p)) return null;
  const parsed = parseYamlSubset(readFileSync(p, "utf8"));
  return parsed.ok ? parsed.value : null;
}

/**
 * Returns the list of REASONS the gate is red. Empty means green.
 *
 * WHAT "ENFORCEMENT GREEN" MEANS HERE, and why it is not "the policy file parses". A file that
 * parses proves a parser works. These three prove the engine is still DECIDING:
 *
 *   1. `policy-lint` exits 0 -- the law is valid, hashes and E2 quotes intact.
 *   2. Deny-by-default is ALIVE: a subject nobody declared must be refused. This is the live
 *      negative control, and it is the one that catches an engine reduced to returning `execute`
 *      unconditionally -- a mutation an adversarial pass actually performed on this repo in
 *      Cycle 9, and which every "does the policy file exist" check in the world waves through.
 *   3. This job's own row still authorizes it.
 *
 * `ARC_JOBS_FORCE_POLICY_RED` is the one test seam, AND IT CAN ONLY TIGHTEN. It appends a
 * failure; there is no variable anywhere that can make this gate pass. That asymmetry is the
 * design rather than an accident -- a seam able to green the gate would itself be the
 * one-variable disarm of the unattended surface.
 */
export function policyEnforcementGreen(jobName, {
  root,
  execPath = process.execPath,
  spawn = spawnSync,
  env = process.env,
} = {}) {
  const fails = [];
  if (!root) return ["policy gate called without a root -- refusing rather than guessing one"];

  if (env.ARC_JOBS_FORCE_POLICY_RED)
    fails.push("policy enforcement forced RED by ARC_JOBS_FORCE_POLICY_RED (test seam)");

  const lint = spawn(execPath, [join(root, ".claude/scripts/hq/policy-lint.mjs")], {
    encoding: "utf8", windowsHide: true, cwd: root,
  });
  if (lint.error || lint.status !== 0)
    fails.push(`policy-lint exited ${lint.error ? lint.error.code : lint.status}`);

  try {
    const policy = parsePolicyYaml(readFileSync(join(root, "hq.policy.yaml"), "utf8"));
    const v = authorizeAction(
      { kind: UNDECLARED_SUBJECT, capability: "write", resource: "docs/x.md" },
      { policy, events: [], root },
    );
    if (v.decision !== "deny")
      fails.push(`deny-by-default is NOT enforcing: an undeclared subject got "${v.decision}"`);
  } catch (e) {
    fails.push(`the policy engine could not decide at all: ${e?.message || e}`);
  }

  try {
    const verdict = authorizeRun({ processName: jobName, doc: processDoc(root, jobName), root });
    if (!verdict.mayInvoke)
      fails.push(`${jobName} is not authorized: ${verdict.denials.map((d) => `${d.capability}:${d.level}`).join(", ")}`);
  } catch (e) {
    // A gate that THROWS has not decided, and an undecided gate in front of an unattended surface
    // reads as red. The alternative -- letting the exception escape -- would surface as a crash
    // whose exit code is indistinguishable from a dozen unrelated ones.
    fails.push(`${jobName} could not be authorized at all: ${e?.message || e}`);
  }

  return fails;
}
