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

import { existsSync, lstatSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { KINDS, validateEvent } from "../validate.mjs";
import { eventSha } from "../canonical.mjs";
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
export const TOOL_CAPABILITIES = Object.freeze(Object.assign(Object.create(null), {
  "fs.read": ["read"],
  "fs.write": ["write"],
  "shell.run": ["shell"],
  "git.op": ["shell", "network"],
  "agent.invoke": ["shell"],
  "ask.human": [], // a prompt to a human is not a capability the machine holds
}));

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
    //
    // A mapping with MORE than one key declares everything: `- fs.read: a` with `shell.run: b`
    // indented under it parses as two keys, and taking only the first meant `shell.run` was on
    // the page and invisible to the gate -- fewer declared capabilities means fewer denials, so
    // silence there widened the grant. Silence on a shape you do not understand is the
    // deny-by-default violation this module exists to close.
    let clean;
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      const keys = Object.keys(raw);
      if (keys.length !== 1) return new Set(CAPABILITIES);
      clean = String(keys[0]);
    } else {
      clean = String(raw ?? "");
    }
    clean = clean.replace(/:$/, "").trim();
    // Own-property only: `constructor`, `toString` and friends are inherited, so a plain lookup
    // returned a function and the deny-by-default arm never fired -- it threw instead.
    const caps = Object.prototype.hasOwnProperty.call(TOOL_CAPABILITIES, clean)
      ? TOOL_CAPABILITIES[clean] : undefined;
    if (!Array.isArray(caps)) return new Set(CAPABILITIES);
    caps.forEach((c) => out.add(c));
  }
  return out;
}

/**
 * THE ROOT THAT GOVERNS IS THE ONE THIS CODE LIVES IN, never the caller's `--root`.
 *
 * `arc-run` takes `--root`, falling back to `$ARC_ROOT` and then git's toplevel, and used that
 * same value to find the policy. So `ARC_ROOT=/tmp/anywhere` produced an unpoliced run of an
 * attacker-authored process and driver -- a one-variable disarm of the whole gate, which makes
 * "enforcement lives in code paths agents cannot bypass" false as written.
 *
 * The policy root is derived from this module's own location: walk up until a directory
 * containing `.claude/scripts/hq/lib/policy/` is found. A consumer repo that copies the scripts
 * in still resolves to its own root and stays not-in-force if it has no policy file; the arc
 * repo resolves to itself no matter what `--root` says.
 */
export function policyRoot() {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let up = 0; up < 12; up++) {
    if (dir.endsWith(`${sep}.claude${sep}scripts${sep}hq${sep}lib${sep}policy`)) {
      // .../ROOT/.claude/scripts/hq/lib/policy -> five segments below ROOT
      return resolve(dir, "..", "..", "..", "..", "..");
    }
    const next = dirname(dir);
    if (next === dir) break;
    dir = next;
  }
  return process.cwd();
}

/**
 * Read `hq.policy.yaml` from the governing root.
 *
 * ONLY A TRUE ABSENCE returns null. `existsSync` conflates ENOENT with ENOTDIR, ELOOP, a
 * dangling symlink and an unreadable parent -- and every one of those used to land in the
 * not-in-force branch, so making the file merely UNREADABLE disarmed the gate as thoroughly as
 * deleting it (which ADR-0502 does prevent). Anything that exists in any form must be read, and
 * a read or parse failure throws so the caller's fail-closed catch takes it.
 */
export function loadPolicyFromDisk(root = policyRoot()) {
  const path = join(root, "hq.policy.yaml");
  let stat = null;
  try { stat = lstatSync(path); } catch (e) {
    if (e && e.code === "ENOENT") return null; // genuinely not adopted here
    throw e;                                   // ENOTDIR, EACCES, ELOOP -> fail-closed
  }
  if (!stat) return null;
  return parsePolicyYaml(readFileSync(path, "utf8"));
}

/**
 * The policy transition events on the spine, in append order -- EVERY ONE VALIDATED BY THE
 * SPINE'S OWN VALIDATOR.
 *
 * The first version JSON.parsed each line and accepted it on `kind` alone: no sha recomputation,
 * no key-set check, no ULID, no idem. An adversarial pass appended ONE hand-written line to a
 * jsonl file and lifted `session:interactive` write from the L1 birth cap to its L2 ceiling --
 * `propose` became `execute` -- which then authorized writing a driver script and a process file
 * that a second finding could run. A cap is only as trustworthy as the chain it is folded from,
 * and this loader was reading an unvalidated file as if it were the spine.
 *
 * AND UNTIL THE KINDS EXIST, EVERY READABLE EVENT IS FORGED BY CONSTRUCTION.
 * `policy.level.changed` and `policy.demoted` do not enter the closed vocabulary until Phase 2's
 * ADR, so the sanctioned emitter quarantines them as UNKNOWN_KIND today. Anything sitting in a
 * jsonl file under those kinds got there some other way. So this returns nothing at all until
 * the vocabulary carries them -- reading a kind the spine cannot emit is reading only forgeries.
 */
export function loadPolicyEvents(root) {
  const vocabularyHasPolicyKinds = KINDS.includes(LEVEL_CHANGED) && KINDS.includes(DEMOTED);
  if (!vocabularyHasPolicyKinds) return [];

  const dir = join(root, ".claude", "state", "hq", "events");
  if (!existsSync(dir)) return [];
  const out = [];
  const seen = new Set();
  // THE PROMOTION CHAIN, resolved rather than assumed. A `policy.level.changed` carries a
  // `decision_ref`, and until now that field was written, shape-checked and hashed into the idem
  // -- and NEVER dereferenced anywhere in the repo. Two independent day-two attackers built a
  // fully self-consistent, correctly-sealed line naming an approval that does not exist and
  // raised a cap L1 -> L2 with it. The sha check added earlier proves a line was not EDITED after
  // sealing; it says nothing about whether a human ever authorised it, because `eventSha` and
  // `policyIdem` are exported and pure, so an attacker seals their own forgery.
  //
  // Collected in a first pass because the decision may live in an earlier day file than the
  // promotion that cites it. A demotion is NOT gated this way: it is raised by the engine on an
  // incident, cites an `incident_ref` rather than a decision, and refusing to fold demotions on a
  // missing reference would fail OPEN -- the cap would stay high, which is the one direction this
  // must never fail in.
  const decisionIds = new Set();
  const files = readdirSync(dir).filter((f) => f.endsWith(".jsonl")).sort();
  for (const file of files) {
    let text;
    try { text = readFileSync(join(dir, file), "utf8"); } catch { continue; }
    for (const line of text.split("\n")) {
      if (!line.trim() || !line.includes("decision.recorded")) continue;
      let e;
      try { e = JSON.parse(line); } catch { continue; }
      if (!e || e.kind !== "decision.recorded" || typeof e.id !== "string") continue;
      try { validateEvent(e); } catch { continue; }
      let sealed;
      try { sealed = eventSha(e); } catch { continue; }
      if (typeof e.sha !== "string" || e.sha !== sealed) continue;
      decisionIds.add(e.id);
    }
  }
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".jsonl")).sort()) {
    let text;
    try { text = readFileSync(join(dir, file), "utf8"); } catch { continue; }
    for (const line of text.split("\n")) {
      if (!line.trim()) continue;
      let e;
      try { e = JSON.parse(line); } catch { continue; } // a corrupt line is not a transition
      if (!e || (e.kind !== LEVEL_CHANGED && e.kind !== DEMOTED)) continue;
      // The spine's own validator, not a second opinion that can drift from it (POL-D).
      try { validateEvent(e); } catch { continue; }
      // ...but validateEvent checks SHAPE. It never recomputes the content hash — `eventSha` is
      // exported by canonical.mjs and nothing on the read path called it — so a hand-written line
      // with a plausible shape was accepted and folded. A Phase 04 attacker raised a cap L1 → L2
      // with ONE appended line carrying a deliberately wrong sha, a `decision_ref` naming no
      // event that exists, and a zeroed `policy_hash`. Shape is not integrity.
      //
      // The sha covers every field except itself, so this refuses any line edited after it was
      // sealed, including one that copied a real receipt and changed the level. It does NOT
      // prove the promotion was AUTHORISED — that needs `decision_ref` resolved to a real
      // approval, a chain walk this loader cannot do alone. Recorded as still-owed rather than
      // implied by this check.
      let sealed;
      try { sealed = eventSha(e); } catch { continue; }
      if (typeof e.sha !== "string" || e.sha !== sealed) continue;
      // A transition counts ONCE, by event id. Every *.jsonl in the directory is folded in
      // order and `policy.level.changed` is an ABSOLUTE set in the reducer, so a genuine,
      // correctly-sealed, already-applied promotion appearing a second time RESTORES a cap a
      // later demotion took away. No forgery needed: copying one day file is enough, and the
      // attacker did exactly that. "A demotion that vanishes is a cap that never drops" was
      // closed once for a preclaimed idem; this is the same sentence reached with `cp`.
      // DEDUP ON `idem`, WHICH IS THE SPINE'S OWN IDENTITY, not on `id`. The spine quarantines a
      // duplicate on DUP_IDEM; this loader re-implemented dedup over raw jsonl and keyed on the
      // ULID instead. Two consequences, both measured by a day-two attacker: a later event
      // REUSING a prior id suppressed a genuine demotion (fail-open -- the cap stayed high), and
      // a re-sealed copy of a promotion with a FRESH id but the same idem folded a second time,
      // so the "a copied line cannot undo a demotion" fix only ever covered exact-id copies.
      // Validate one read, compare another, on the read path.
      // A PROMOTION MUST CITE A DECISION THAT EXISTS. Demotions are exempt (see above): they are
      // engine-raised on an incident and only ever LOWER a cap.
      if (e.kind === LEVEL_CHANGED) {
        const ref = e.payload && e.payload.decision_ref;
        if (typeof ref !== "string" || !decisionIds.has(ref)) continue;
      }
      const key = typeof e.idem === "string" && e.idem ? e.idem
        : (typeof e.id === "string" ? e.id : sealed);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(e);
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
export function authorizeRun({ processName, doc, root, policy, events } = {}) {
  // The GOVERNING root, not the caller's. `--root` says where the work happens; it does not get
  // to say which law applies.
  const govRoot = policyRoot();
  const pol = policy !== undefined ? policy : loadPolicyFromDisk(govRoot);
  const evs = events !== undefined ? events : loadPolicyEvents(govRoot);
  root = root || govRoot;
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
