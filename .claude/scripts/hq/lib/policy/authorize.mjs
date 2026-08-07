/**
 * authorizeAction -- the decision function. Everything is INJECTED: this module opens no file
 * and reads no global state, which is precisely what makes Phase 1 wiring rather than a rewrite.
 *
 *   authorizeAction({ kind, capability, resource }, { policy, events })
 *     -> { decision, reason, effective }
 *
 * The decision is THREE-VALUED. A boolean would collapse L1 into either a synonym for deny --
 * killing the born-at-L1 climb the entire trust model rests on -- or into a lie:
 *   deny     L0, or a bound that excludes the resource, or an un-grantable target
 *   propose  L1: prepare and record the action, never execute it
 *   execute  L2 inside its declared bound, or L3
 *
 * ORDER OF CHECKS, and it matters. Steps 1 and 2 run BEFORE any level is consulted, because
 * both hold "regardless of ceiling or cap" -- an adversarial pass proved that putting the
 * command-integrity check inside the L2 branch meant `cat x > .claude/settings.json` executed
 * at L3, where the branch never runs:
 *   1. command integrity -- a chained or redirecting shell command is refused outright
 *   2. un-grantable TARGETS (ADR-0502) -- you may not even PROPOSE to rewrite the file that
 *      binds you
 *   3. the effective level, with ADR-0507's derivation applied to `shell`
 *   4. the declared bound, at L2 only
 *
 * EVERY operand is checked in step 2, not the first one carrying a slash. The first version
 * looked at one argument and stopped, so `git checkout -- tmp/decoy .claude/settings.json`
 * executed: one extra word ahead of the real target and ADR-0502 was gone. The pinned fixture
 * happened to use the one argument order that worked, which is the "attack the test that
 * protects the rule" failure in miniature.
 */

import {
  BIRTH_CAP, BOUND_KEY, CAPABILITIES, CHAINING, NON_SHELL_CAPABILITIES,
  decisionForLevel, minLevel, rank,
} from "./model.mjs";
import { resolveEffectivePolicy, grantFor } from "./reduce.mjs";
import { buildResourceGuard, guardedEntryFor, withinRoots } from "./resources.mjs";

const has = (o, k) => o != null && Object.prototype.hasOwnProperty.call(o, k);
const verdict = (decision, effective, reason) => ({ decision, effective, reason });

/**
 * Programs that mutate a file when handed one. A shell action naming one of these must resolve
 * every operand, and an unresolvable operand denies rather than skips.
 */
const FILE_MUTATORS = new Set([
  "cp", "mv", "rm", "sed", "tee", "install", "truncate", "chmod", "chown", "ln", "touch",
  "dd", "shred", "patch", "git", "gh", "npm", "node", "python", "python3", "bash", "sh", "attrib",
]);

/**
 * Capabilities a kind's shell allowlist can reproduce (ADR-0507). `"*"` = the seven non-shell.
 *
 * An UNCLASSIFIED program reproduces EVERYTHING. The first version skipped it with a comment
 * saying policy-lint would have rejected the file -- but authorizeAction is also called by hooks
 * that never ran the lint, so "skip" was an implicit `narrow`, which is the exact opposite of
 * what ADR-0507 says in words: "an unclassified program is an error, never an implicit narrow.
 * That is deny-by-default applied to the allowlist itself."
 */
export function reproducedBy(argv0Allow, argv0Classes) {
  const out = new Set();
  // An empty or absent allowlist reproduces NOTHING, and that is the honest answer for this
  // function -- no program is permitted, so no capability is reachable through one. The hole it
  // opened lives in the caller, not here: see effectiveShell.
  for (const program of argv0Allow || []) {
    if (!has(argv0Classes, program)) {
      NON_SHELL_CAPABILITIES.forEach((x) => out.add(x));
      continue;
    }
    const entry = argv0Classes[program];
    const reproduces = entry && Array.isArray(entry.reproduces) ? entry.reproduces : ["*"];
    for (const c of reproduces) {
      if (c === "*") NON_SHELL_CAPABILITIES.forEach((x) => out.add(x));
      else if (c !== "shell" && CAPABILITIES.includes(c)) out.add(c);
      // "shell" itself, and any unknown token, are both malformed -- and the malformed case
      // must widen, never narrow. The previous version excluded "shell" from BOTH arms, so the
      // one token ADR-0507 forbids was the one that made the derivation add nothing at all:
      // `reproduces: ["shell"]` returned an empty set and uncapped the grant. The lint rejects
      // that token, but this function is also called by hooks that never ran the lint -- which
      // is the reasoning already written above for the unclassified program, applied one branch
      // further down where it had been dropped.
      else NON_SHELL_CAPABILITIES.forEach((x) => out.add(x));
    }
  }
  return out;
}

/**
 * effective(shell) = min( declared(shell), min over reproduced of declared(c) ).
 * declared(c) is a plain min(ceiling, cap) with no derivation of its own, which is what makes
 * the recursion impossible rather than merely unlikely -- and why `shell` may never appear in a
 * `reproduces` list.
 */
function effectiveShell(kind, ctx, declaredShell) {
  const grant = grantFor(ctx.policy, kind, "shell");
  const allow = grant && grant.argv0_allow;
  const reproduced = reproducedBy(allow, ctx.policy && ctx.policy.argv0_classes);

  // AN EXECUTING SHELL WITH NO ALLOWLIST IS UNBOUNDED, and it was the one shape that skipped
  // ADR-0507 entirely. `shell: { level: L3 }` with no `argv0_allow:` reproduces nothing, so the
  // loop below mins over an EMPTY set and the level stays exactly as declared -- and the L3
  // branch of authorizeAction never consults an allowlist either, so nothing downstream caught
  // it. A Phase 04 attacker raised one kind's shell to L3 and got unbounded network and an
  // unbounded interpreter out of a kind whose write and network were both L1, with policy-lint
  // printing "is law" over the file.
  //
  // Scoped to levels that EXECUTE, deliberately. At L0 and L1 nothing runs, so an absent
  // allowlist decides nothing there -- and every kind in the shipped policy holds shell at L1
  // with no allowlist, so failing closed unconditionally would silently move all of them to L0
  // and change behaviour the finding never asked to change. `decisionForLevel` is the library's
  // own answer to "would this level have executed" (POL-D), never a rank comparison.
  if (decisionForLevel(declaredShell) === "execute" && (!Array.isArray(allow) || allow.length === 0)) {
    return BIRTH_CAP;
  }

  let level = declaredShell;
  for (const capability of reproduced) {
    const other = resolveEffectivePolicy(kind, capability, ctx).effective;
    level = minLevel(level, other);
  }
  return level;
}

/** argv0 of a shell command, or null when the command chains and must be refused outright. */
export function shellArgv0(command) {
  if (typeof command !== "string" || command.trim() === "") return null;
  for (const token of CHAINING) if (command.includes(token)) return null;
  if (/[<>]/.test(command)) return null; // redirection writes files without a write grant
  const first = command.trim().split(/\s+/)[0];
  return first.split(/[\\/]/).pop() || null;
}

/**
 * EVERY non-flag operand of a shell command, so the guard sees all of them. `--flag=value` is
 * split so the value is inspected too. The first version returned only the first operand
 * containing a separator, and a decoy operand ahead of the real target defeated it.
 */
export function shellTargets(command) {
  if (typeof command !== "string") return [];
  const out = [];
  for (const raw of command.trim().split(/\s+/).slice(1)) {
    if (raw === "--") continue;
    let part = raw;
    if (part.startsWith("--") && part.includes("=")) part = part.slice(part.indexOf("=") + 1);
    else if (part.startsWith("-")) continue;
    const cleaned = part.replace(/^["']|["']$/g, "");
    if (cleaned !== "") out.push(cleaned);
  }
  return out;
}

export function authorizeAction({ kind, capability, resource } = {}, ctx = {}) {
  if (!CAPABILITIES.includes(capability))
    return verdict("deny", "L0", `unknown capability ${JSON.stringify(capability)}`);

  const policy = ctx.policy || {};
  const events = ctx.events || [];
  const root = ctx.root || process.cwd();

  // 1. Command integrity, at EVERY level. Chaining and redirection are not a "bound" that L3
  //    outgrows -- they defeat the argv0 model itself, so the refusal cannot live in the L2
  //    branch.
  let argv0 = null;
  if (capability === "shell") {
    argv0 = shellArgv0(resource);
    if (argv0 === null)
      return verdict("deny", "L0",
        `a chained or redirecting command is refused outright at any level -- argv0-checking ` +
        `${JSON.stringify(resource)} would check the wrong program`);
  }

  // 2. Un-grantable targets, before any level is consulted (ADR-0502).
  if (capability === "write" || capability === "shell") {
    const guard = ctx.guard || buildResourceGuard(policy.ungrantable_resources, root);
    const targets = capability === "shell" ? shellTargets(resource) : [resource];
    for (const target of targets) {
      const hit = guardedEntryFor(target, guard);
      if (hit)
        return verdict("deny", "L0",
          `${target} resolves to the un-grantable resource ${hit} -- excluded from every ` +
          `write and file-mutating shell grant regardless of ceiling or cap (ADR-0502)`);
    }
    // An unresolvable target on a file-mutating program denies. `git clean -xdf .claude` and
    // `sed -i s@a@b@ settings.json` name no operand the guard can resolve, and skipping the
    // check because nothing looked like a path is how the guard gets walked past quietly.
    if (capability === "shell" && targets.length === 0 && FILE_MUTATORS.has(argv0))
      return verdict("deny", "L0",
        `${argv0} can mutate a file and this command names no operand the guard can resolve -- ` +
        `unresolvable is denied, never skipped`);
  }

  // 3. The effective level for the pair.
  const resolved = resolveEffectivePolicy(kind, capability, { policy, events });
  let effective = resolved.effective;
  if (capability === "shell")
    effective = effectiveShell(kind, { policy, events }, effective);

  // v1 has no reservation ledger, so nothing may SPEND above propose. POL-F bans real money
  // above L1 in v1 and reserveSpend does not land until Phase 1; without this an L2 spend
  // reached `execute` with its cap never consulted, because the L2 branch below has no spend arm.
  if (capability === "spend" && rank(effective) > rank("L1"))
    return verdict("deny", effective,
      `spend is capped at propose in v1: no reservation ledger exists until Phase 1, and POL-F ` +
      `bans real-money movement above L1 regardless of the declared cap`);

  const base = decisionForLevel(effective);
  if (base === "deny")
    return verdict("deny", effective,
      effective === resolved.effective
        ? `${kind}/${capability} is at L0 (ceiling ${resolved.ceiling}, cap ${resolved.cap})`
        : `${kind}/shell is capped at ${effective} by ADR-0507: its allowlist reproduces a ` +
          `capability granted no higher`);
  if (base === "propose")
    return verdict("propose", effective,
      `${kind}/${capability} is at L1 -- prepare and record it, never execute it`);

  // 4. The bound, at L2 only. L3 is unbounded within the capability, by definition -- but note
  //    that steps 1 and 2 have already run, so "unbounded" never means "unchecked".
  if (effective === "L2") {
    const grant = grantFor(policy, kind, capability) || {};
    const key = BOUND_KEY[capability];
    const bound = key && has(grant, key) ? grant[key] : null;
    if (key && (bound == null || (Array.isArray(bound) && bound.length === 0)))
      return verdict("deny", effective,
        `${kind}/${capability} is at L2 with no declared ${key} -- a bound that admits nothing`);

    if (capability === "write" && !withinRoots(resource, bound, root))
      return verdict("deny", effective, `${resource} is outside the declared write roots`);

    if (capability === "shell" && !(bound || []).includes(argv0))
      return verdict("deny", effective, `${argv0} is not in the declared argv0_allow`);

    if (capability === "network" && !(bound || []).includes(resource))
      return verdict("deny", effective, `${resource} is not in the declared domain allowlist`);

    if (["message", "publish", "deploy"].includes(capability) && !(bound || []).includes(resource))
      return verdict("deny", effective, `${resource} is not a declared ${capability} target`);
  }

  return verdict("execute", effective, `${kind}/${capability} authorized at ${effective}`);
}

/** The one predicate every caller should use, so nobody re-implements the comparison. */
export const mayExecute = (v) => v != null && v.decision === "execute";
