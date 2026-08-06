/**
 * The headless gate (REQ-02, phase 01). This is the ONLY thing Phase 1 adds to the decision
 * model: it loads the real policy and the real spine, maps what a process DECLARES onto the
 * capability vocabulary, and answers one question -- may this run invoke a driver at all?
 *
 * NO POLICY LOGIC LIVES HERE. Every decision is `authorizeAction`'s. A second interpretation at
 * the call site is exactly the POL-D violation this phase exists to avoid, and it is the reason
 * the Phase-0 module takes everything by injection: wiring it up must not require changing it.
 *
 * WHAT IT HARDENS. `processes/*.process.yaml` carries `permissions: unrestricted | declared` and
 * a `tools:` list, and until now nothing validated either. The engine cycle's own adversarial
 * pass found the same shape from the other side -- a forged `allowed-tools:` grant, and
 * `permissions: declared` with only `ask.human` meaning unrestricted. A declaration that
 * constrains nothing is not a permission system; it is a comment.
 *
 * effective authority = process-declared INTERSECT policy grant. A process may request LESS than
 * its grant and never more (POL-D), so the intersection is the whole rule: declaring
 * `unrestricted` does not widen anything, it just stops narrowing.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parsePolicyYaml } from "./yaml.mjs";
import { CAPABILITIES, PROCESS_PREFIX } from "./model.mjs";
import { resolveEffectivePolicy, LEVEL_CHANGED, DEMOTED } from "./reduce.mjs";
import { authorizeAction } from "./authorize.mjs";
import { buildResourceGuard } from "./resources.mjs";

/**
 * What each process tool token can reach. `git.op` maps to shell AND network because git
 * fetches and pushes; `agent.invoke` maps to shell because a subagent is a general machine --
 * the same reasoning ADR-0507 applies to an interpreter in an argv0 allowlist.
 */
export const TOOL_CAPABILITIES = Object.freeze({
  "fs.read": ["read"],
  "fs.write": ["write"],
  "shell.run": ["shell"],
  "git.op": ["shell", "network"],
  "agent.invoke": ["shell"],
  "ask.human": [], // a prompt to a human is not a capability the machine holds
});

/**
 * The capabilities a process declares.
 *
 * THE `tools:` LIST IS THE DECLARATION. `permissions:` is a coarse legacy field carrying only
 * `declared` or `unrestricted`, and `unrestricted` means "nobody has narrowed this file yet" --
 * an ABSENCE of information, not a claim to move money. Reading it as "declares all eight" would
 * block every existing process on capabilities it demonstrably never uses, which is a runner
 * that refuses to run rather than a policy engine. The cross-check still warns about it, loudly,
 * because an un-narrowed declaration is a real debt.
 *
 * A tool token nobody has classified DOES declare everything: deny-by-default applied to the
 * declaration itself, so an unclassified token is never the cheapest way to widen a grant.
 */
export function declaredCapabilities(doc) {
  if (!doc || typeof doc !== "object") return new Set(CAPABILITIES);
  const tools = Array.isArray(doc.tools) ? doc.tools : [];
  if (tools.length === 0) return new Set(CAPABILITIES); // nothing to go on -- assume the worst
  const out = new Set();
  for (const raw of tools) {
    // A token appears as `shell.run`, as `shell.run:` (a trailing colon), or -- when it carries
    // a sub-block -- as a one-key mapping. Stringifying that mapping throws, which is how this
    // read a real process file and died rather than denying.
    const token = (raw && typeof raw === "object" && !Array.isArray(raw))
      ? String(Object.keys(raw)[0] ?? "")
      : String(raw ?? "");
    const clean = token.replace(/:$/, "").trim();
    const caps = TOOL_CAPABILITIES[clean];
    if (caps === undefined) return new Set(CAPABILITIES);
    caps.forEach((c) => out.add(c));
  }
  return out;
}

/** Read `hq.policy.yaml`. Absent means deny-by-default, never "no policy so anything goes". */
export function loadPolicyFromDisk(root) {
  const path = join(root, "hq.policy.yaml");
  if (!existsSync(path)) return null;
  return parsePolicyYaml(readFileSync(path, "utf8"));
}

/** The policy transition events on the spine, in append order. */
export function loadPolicyEvents(root) {
  const dir = join(root, ".claude", "state", "hq", "events");
  if (!existsSync(dir)) return [];
  const out = [];
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".jsonl")).sort()) {
    let text;
    try { text = readFileSync(join(dir, file), "utf8"); } catch { continue; }
    for (const line of text.split("\n")) {
      if (!line.trim()) continue;
      let e;
      try { e = JSON.parse(line); } catch { continue; } // a corrupt line is not a transition
      if (e && (e.kind === LEVEL_CHANGED || e.kind === DEMOTED)) out.push(e);
    }
  }
  return out;
}

/**
 * The run gate. Returns every denial rather than the first, so an operator sees the whole
 * shape of what a process asked for and did not get.
 *
 * `probe` is the concrete action tested per capability. It is deliberately the most permissive
 * plausible resource for that capability, so a pass here means "this process could act", not
 * "this specific string was allowed" -- the fixture matrix pins the specific strings.
 */
export function authorizeRun({ processName, doc, root = process.cwd(), policy, events } = {}) {
  const pol = policy !== undefined ? policy : loadPolicyFromDisk(root);
  const evs = events !== undefined ? events : loadPolicyEvents(root);
  const kind = PROCESS_PREFIX + processName;

  /**
   * NO POLICY FILE IN THIS ROOT -> the engine is NOT IN FORCE here, and the run proceeds.
   *
   * This is the one place the deny-by-default reflex is wrong, and it took a broken engine test
   * to see it. Deny-by-default is a rule INSIDE a policy file -- an action kind absent from the
   * file is read-only. It is not a rule about the file's own absence. A root that has never
   * adopted policy has declared nothing, so there is nothing to enforce, and refusing to run
   * would brick every consumer repo and every test fixture that copies the scripts into a temp
   * directory (which is exactly how engine-driver-contract.bats works).
   *
   * What stops this from being the fail-open it looks like: where policy IS in force,
   * `hq.policy.yaml` is on the un-grantable resource list (ADR-0502), so no policed write can
   * delete it to reach this branch. And the caller says so out loud -- the same shape as
   * PreToolUse.sh announcing that a missing dispatcher disarmed its guards. A disarmed guard
   * must never be silent.
   */
  if (!pol)
    return {
      kind, inForce: false, effective: {}, declared: [...declaredCapabilities(doc)].sort(),
      denials: [], spawn: null, mayInvoke: true,
      reason: `no hq.policy.yaml at ${root} -- the policy engine is not in force in this root`,
    };

  const effective = {};
  const declared = declaredCapabilities(doc);
  const denials = [];
  const guard = buildResourceGuard(pol && pol.ungrantable_resources, root);

  for (const capability of CAPABILITIES) {
    const resolved = resolveEffectivePolicy(kind, capability, { policy: pol || {}, events: evs });
    effective[capability] = resolved.effective;
    if (!declared.has(capability)) continue; // the process did not ask for it
    if (resolved.effective === "L0")
      denials.push({ capability, level: "L0", reason: `${kind}/${capability} is denied by policy (ceiling ${resolved.ceiling}, cap ${resolved.cap})` });
  }

  // Starting the driver is the RUNNER's act, not the process's, so it is not authorized as a
  // synthetic `shell` action by the process. Doing that made an absent kind unable to run at
  // all -- which sounds strict until you notice it also blocked every process that simply has
  // no row yet, turning the birth-rule gap (POL-I, Phase 3) into an outage. What the process
  // may DO is the question here, and its declared capabilities are the answer.
  const spawn = authorizeAction(
    { kind, capability: "read", resource: `processes/${processName}.process.yaml` },
    { policy: pol, events: evs, root, guard }
  );

  return {
    kind,
    inForce: true,
    effective,
    declared: [...declared].sort(),
    denials,
    spawn,
    /**
     * A run is BLOCKED when it declares a capability policy denies outright (L0), and permitted
     * at L1 or above.
     *
     * Requiring `execute` here would be the wrong reading of L1 and would deny every run in the
     * repo, since every pair is born at L1 and climbs only by a human decision. L1 means
     * "prepare and record the action, never perform it" -- and a headless run that produces a
     * proposal for a human IS that. What must not happen at L1 is the side effect, and the side
     * effect happens through a TOOL, which `authorizeAction` gates at the tool boundary (the
     * hooks, Phase 2) rather than at process start.
     *
     * So the wrapper answers the coarse question -- may this process exist at all, given what it
     * declares -- and the per-action question stays where the action is. Collapsing the two
     * would either brick the runner or wave through every individual write inside a run that was
     * allowed to start.
     */
    mayInvoke: denials.length === 0,
  };
}

/**
 * POL-D's cross-check: a process may declare LESS than its grant, never more. ADVISORY
 * (WARN-first, in TRIAL) because `policy-lint` is the validator and every other new lint in
 * this cycle starts warning -- and because `processes/*.process.yaml` belongs to the engine
 * lane, so this must surface a problem rather than break their build.
 */
export function crossCheckDeclared({ processName, doc, policy, events, root = process.cwd() }) {
  const warnings = [];
  const kind = PROCESS_PREFIX + processName;
  const pol = policy !== undefined ? policy : loadPolicyFromDisk(root);
  const evs = events !== undefined ? events : loadPolicyEvents(root);
  if (!pol) return warnings;

  if (doc && doc.permissions === "unrestricted")
    warnings.push(`${processName}: permissions: unrestricted declares every capability, so it ` +
      `narrows nothing. Once a policy file exists this is never the honest declaration -- list ` +
      `the tools the process actually uses.`);

  for (const capability of declaredCapabilities(doc)) {
    const { effective } = resolveEffectivePolicy(kind, capability, { policy: pol, events: evs });
    if (effective === "L0")
      warnings.push(`${processName}: declares ${capability} but policy grants it L0 -- the ` +
        `declaration asks for something it can never receive`);
  }
  return warnings;
}
