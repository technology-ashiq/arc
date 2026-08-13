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

/**
 * The POSITIVE controls, and they exist because the negative one alone was not enough.
 *
 * An adversarial pass mutated `reduce.mjs`'s `BIRTH_CAP` from L1 to L3 -- every DECLARED subject
 * jumps propose -> execute, which is the two-key state machine switching itself off -- and the
 * undeclared-subject control did not notice, because an absent kind has ceiling L0 and
 * `min(L0, L3)` still denies. A gate that only ever asks about a subject nobody declared cannot
 * see a change that only affects subjects somebody did.
 *
 * So the gate now also asserts what the engine must say about THIS JOB:
 *   write   -> `propose`, never `execute`  (the birth cap is L1 and nothing has promoted it)
 *   network -> `deny`                      (the ceiling is L0 and a ceiling is not negotiable)
 * Measured against the live policy rather than assumed.
 */
const POSITIVE_CONTROLS = Object.freeze([
  { capability: "write", resource: "docs/x.md", expect: "propose" },
  { capability: "network", resource: "https://example.invalid/", expect: "deny" },
]);

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
  // TEST-ONLY, and it cannot weaken the gate. A fixture hands in a deliberately WRONG expectation
  // to prove the comparison is live rather than decorative -- a positive control that can never
  // fire is worth exactly as much as no positive control. Emptying the list is itself a failure,
  // so the obvious way to disarm this is the one thing it refuses to do quietly. The CLI never
  // passes it.
  controls = POSITIVE_CONTROLS,
} = {}) {
  const fails = [];
  if (!root) return ["policy gate called without a root -- refusing rather than guessing one"];
  if (!Array.isArray(controls) || controls.length === 0)
    fails.push("the positive controls were emptied -- a gate with no positive control cannot see an over-granting engine");

  if (env.ARC_JOBS_FORCE_POLICY_RED)
    fails.push("policy enforcement forced RED by ARC_JOBS_FORCE_POLICY_RED (test seam)");

  const lint = spawn(execPath, [join(root, ".claude/scripts/hq/policy-lint.mjs")], {
    encoding: "utf8", windowsHide: true, cwd: root,
  });
  if (lint.error || lint.status !== 0)
    fails.push(`policy-lint exited ${lint.error ? lint.error.code : lint.status}`);

  // READ THE LAW ONCE, from the root this gate was handed, and hand that same object to every
  // check below. Previously check 3 called `authorizeRun` without a policy, and `authorizeRun`
  // loads from `policyRoot()` rather than from its `root` argument -- so the third check judged a
  // DIFFERENT file from the first two. That is "validate one read, compare another", the defect
  // this lane already closed once in `verdict.mjs` and left open in `lineage.mjs`.
  let policy = null;
  let policyErr = null;
  try { policy = parsePolicyYaml(readFileSync(join(root, "hq.policy.yaml"), "utf8")); }
  catch (e) { policyErr = e; }

  if (policyErr) {
    fails.push(`the policy engine could not decide at all: ${policyErr?.message || policyErr}`);
  } else {
    const decide = (kind, capability, resource) =>
      authorizeAction({ kind, capability, resource }, { policy, events: [], root }).decision;

    try {
      // The negative control: a subject that exists nowhere must be refused a write.
      const undeclared = decide(UNDECLARED_SUBJECT, "write", "docs/x.md");
      if (undeclared !== "deny")
        fails.push(`deny-by-default is NOT enforcing: an undeclared subject got "${undeclared}"`);

      // The positive controls: what the engine must still say about a subject that DOES exist.
      for (const c of (Array.isArray(controls) ? controls : [])) {
        const got = decide(`process:${jobName}`, c.capability, c.resource);
        if (got !== c.expect)
          fails.push(`the engine is not enforcing: ${jobName}/${c.capability} came back "${got}", wanted "${c.expect}"`);
      }
    } catch (e) {
      fails.push(`the policy engine threw while deciding: ${e?.message || e}`);
    }
  }

  try {
    if (!policy) {
      // `authorizeRun` returns mayInvoke:true for a root that has never adopted policy, which is
      // correct for consumer repos and WRONG as an answer to "is enforcement live here". Asking
      // it anyway would turn an unreadable law into a permission.
      fails.push(`${jobName} is not authorized: this root has no readable policy, so nothing is in force to authorize it`);
    } else {
      const verdict = authorizeRun({
        processName: jobName,
        doc: processDoc(root, jobName),
        root,
        policy,        // <- the law from THIS root, not from policyRoot()
        events: [],
      });
      if (!verdict.mayInvoke)
        fails.push(`${jobName} is not authorized: ${verdict.denials.map((d) => `${d.capability}:${d.level}`).join(", ")}`);
    }
  } catch (e) {
    // A gate that THROWS has not decided, and an undecided gate in front of an unattended surface
    // reads as red. The alternative -- letting the exception escape -- would surface as a crash
    // whose exit code is indistinguishable from a dozen unrelated ones.
    fails.push(`${jobName} could not be authorized at all: ${e?.message || e}`);
  }

  return fails;
}
