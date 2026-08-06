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
 * ORDER OF CHECKS, and it matters:
 *   1. un-grantable TARGET (ADR-0502) -- before any level is consulted, because the list holds
 *      "regardless of ceiling or cap". You may not even PROPOSE to rewrite the file that binds
 *      you.
 *   2. effective level, with ADR-0507's derivation applied to `shell`.
 *   3. the declared bound, at L2 only.
 *
 * ADR-0507, the rule that closes the bypass an adversarial pass found in this schema's own
 * worked example: `argv0_allow: ["node"]` plus `node -e "fs.writeFileSync('.claude/settings.json')"`
 * carries no chaining metacharacter, offers no discrete path argument to stat, and is not a
 * `write` action -- so nothing else in this file would have caught it. A capability is capped at
 * the minimum of every capability its instruments can reproduce.
 */

import {
  BOUND_KEY, CAPABILITIES, CHAINING, NON_SHELL_CAPABILITIES,
  decisionForLevel, minLevel,
} from "./model.mjs";
import { resolveEffectivePolicy, grantFor } from "./reduce.mjs";
import { buildResourceGuard, guardedEntryFor, withinRoots } from "./resources.mjs";

const verdict = (decision, effective, reason) => ({ decision, effective, reason });

/** Capabilities a kind's shell allowlist can reproduce (ADR-0507). `"*"` = the seven non-shell. */
export function reproducedBy(argv0Allow, argv0Classes) {
  const out = new Set();
  for (const program of argv0Allow || []) {
    const entry = (argv0Classes || {})[program];
    if (!entry) continue; // policy-lint rejects this file; at runtime treat it as opaque
    for (const c of entry.reproduces || []) {
      if (c === "*") NON_SHELL_CAPABILITIES.forEach((x) => out.add(x));
      else if (c !== "shell") out.add(c);
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
  const reproduced = reproducedBy(grant && grant.argv0_allow, ctx.policy && ctx.policy.argv0_classes);
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

export function authorizeAction({ kind, capability, resource } = {}, ctx = {}) {
  if (!CAPABILITIES.includes(capability))
    return verdict("deny", "L0", `unknown capability ${JSON.stringify(capability)}`);

  const policy = ctx.policy || {};
  const events = ctx.events || [];
  const root = ctx.root || process.cwd();

  // 1. Un-grantable targets, before any level is consulted (ADR-0502).
  if (capability === "write" || capability === "shell") {
    const guard = ctx.guard || buildResourceGuard(policy.ungrantable_resources, root);
    const target = capability === "shell" ? shellTarget(resource) : resource;
    if (target) {
      const hit = guardedEntryFor(target, guard);
      if (hit)
        return verdict("deny", "L0",
          `${target} resolves to the un-grantable resource ${hit} -- excluded from every ` +
          `write and file-mutating shell grant regardless of ceiling or cap (ADR-0502)`);
    }
  }

  // 2. The effective level for the pair.
  const resolved = resolveEffectivePolicy(kind, capability, { policy, events });
  let effective = resolved.effective;
  if (capability === "shell")
    effective = effectiveShell(kind, { policy, events }, effective);

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

  // 3. The bound, at L2 only. L3 is unbounded within the capability, by definition.
  if (effective === "L2") {
    const grant = grantFor(policy, kind, capability) || {};
    const key = BOUND_KEY[capability];
    const bound = key ? grant[key] : null;
    if (key && (bound == null || (Array.isArray(bound) && bound.length === 0)))
      return verdict("deny", effective,
        `${kind}/${capability} is at L2 with no declared ${key} -- a bound that admits nothing`);

    if (capability === "write" && !withinRoots(resource, bound, root))
      return verdict("deny", effective, `${resource} is outside the declared write roots`);

    if (capability === "shell") {
      const argv0 = shellArgv0(resource);
      if (argv0 === null)
        return verdict("deny", effective,
          `a chained or redirecting command is refused outright -- argv0-checking ` +
          `${JSON.stringify(resource)} would check the wrong program`);
      if (!(bound || []).includes(argv0))
        return verdict("deny", effective, `${argv0} is not in the declared argv0_allow`);
    }

    if (capability === "network" && !(bound || []).includes(resource))
      return verdict("deny", effective, `${resource} is not in the declared domain allowlist`);

    if (["message", "publish", "deploy"].includes(capability) && !(bound || []).includes(resource))
      return verdict("deny", effective, `${resource} is not a declared ${capability} target`);
  }

  return verdict("execute", effective, `${kind}/${capability} authorized at ${effective}`);
}

/** The file a shell command would mutate, when it is visible as a discrete argument. */
function shellTarget(command) {
  if (typeof command !== "string") return null;
  const parts = command.trim().split(/\s+/);
  for (const part of parts.slice(1)) {
    if (part.startsWith("-")) continue;
    const cleaned = part.replace(/^["']|["']$/g, "");
    if (cleaned.includes("/") || cleaned.includes("\\")) return cleaned;
  }
  return null;
}
