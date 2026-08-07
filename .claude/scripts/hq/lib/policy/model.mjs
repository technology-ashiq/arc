/**
 * The closed vocabulary of the policy model (POL-A, POL-B, ADR-0504, ADR-0505, ADR-0507).
 *
 * Every set here is CLOSED. Anything not in one of them is a hard error rather than a default,
 * because the failure this whole build exists to remove is "nobody thought about this, so it
 * was allowed".
 */

/** The eight capability verbs. Closed. */
export const CAPABILITIES = Object.freeze([
  "read", "write", "shell", "network", "message", "publish", "deploy", "spend",
]);

/** The seven capabilities other than `shell` -- what `"*"` expands to in argv0_classes. */
export const NON_SHELL_CAPABILITIES = Object.freeze(CAPABILITIES.filter((c) => c !== "shell"));

/**
 * L0-L3, closed. L4 is a parse error, superseding docs/strategy/arc-full-architecture.md:61,217
 * which says L0-L4. The rank is what min() compares.
 */
export const LEVELS = Object.freeze(["L0", "L1", "L2", "L3"]);
const RANK = Object.freeze({ L0: 0, L1: 1, L2: 2, L3: 3 });

export const isLevel = (v) => typeof v === "string" && Object.prototype.hasOwnProperty.call(RANK, v);
export const rank = (level) => {
  if (!isLevel(level)) throw new Error(`not a level: ${JSON.stringify(level)}`);
  return RANK[level];
};
export const minLevel = (...levels) => levels.reduce((a, b) => (rank(a) <= rank(b) ? a : b));
export const maxLevel = (...levels) => levels.reduce((a, b) => (rank(a) >= rank(b) ? a : b));
/** One level down, floored at L0. The demotion bite (POL-C). */
export const oneDown = (level) => LEVELS[Math.max(0, rank(level) - 1)];

/** The birth cap of every (kind, capability) pair: min(ceiling, L1). Trust is earned. */
export const BIRTH_CAP = "L1";

/** Which bound key each capability declares at L2. `read` needs none. */
export const BOUND_KEY = Object.freeze({
  read: null,
  write: "roots",
  shell: "argv0_allow",
  network: "domains",
  message: "targets",
  publish: "targets",
  deploy: "targets",
  spend: "cap",
});

/** The reserved interactive subject. Every other subject is `process:NAME` (ADR-0504). */
export const SESSION_KIND = "session:interactive";
export const PROCESS_PREFIX = "process:";

/** Top-level keys of hq.policy.yaml. Closed -- an unknown key is a hard error. */
export const TOP_LEVEL_KEYS = Object.freeze([
  "version", "constitution", "levels", "ungrantable_actions", "ungrantable_resources",
  "targets", "argv0_classes", "kinds",
]);

/** argv0 classes. `reproduces` may never contain "shell" -- see ADR-0507 for why. */
export const ARGV0_CLASSES = Object.freeze(["interpreter", "vcs", "fetcher", "packager", "narrow"]);

/**
 * Shell metacharacters that chain or substitute. A command carrying any of these is rejected
 * outright rather than parsed: argv0-checking a chained command is theatre, because the argv0
 * of `bats x; rm -rf /` is `bats`.
 */
export const CHAINING = Object.freeze([";", "&&", "||", "|", "`", "$(", "\n", "&"]);

/** The three-valued decision (ADR-0505 consequence of the L1 semantics). */
export const DECISIONS = Object.freeze(["deny", "propose", "execute"]);

/**
 * Map an effective level to its decision, before any bound is consulted.
 * The default is DENY, not execute: no path reaches it today because `isLevel` gates everything
 * upstream, but the one function that turns a level into permission should fail closed if it is
 * ever handed something it does not recognise.
 */
export function decisionForLevel(level) {
  switch (level) {
    case "L0": return "deny";
    case "L1": return "propose";
    case "L2": case "L3": return "execute"; // the bound is checked separately for L2
    default: return "deny";
  }
}
