/**
 * The ONE policy library (POL-D). Both consumers import from here -- the `arc-run` wrapper for
 * headless runs (Phase 1) and the PreToolUse fragments for interactive sessions (Phase 2). Two
 * interpretations of policy is guaranteed drift, so there is exactly one, and this barrel is how
 * a caller is stopped from reaching past it into a half of the model.
 *
 * ADR-0500 puts this inside `hq` rather than a separate `products/policy`: `engine` already
 * declares requires ["core","hq"], so there is no reachable configuration in which `arc-run`
 * exists and this library does not. An optional policy engine is a fail-open at install time.
 */

export { parsePolicyYaml, PolicyParseError } from "./yaml.mjs";
export {
  CAPABILITIES, NON_SHELL_CAPABILITIES, LEVELS, BIRTH_CAP, BOUND_KEY, CHAINING, DECISIONS,
  SESSION_KIND, PROCESS_PREFIX, TOP_LEVEL_KEYS, ARGV0_CLASSES,
  isLevel, rank, minLevel, maxLevel, oneDown, decisionForLevel,
} from "./model.mjs";
export { encode, preimageHash, policyHash, EncodeError } from "./encode.mjs";
export {
  verifyConstitution, checkConstitutionHash, parseE2, checkE2Quote, ConstitutionError,
} from "./constitution.mjs";
export { buildResourceGuard, guardedEntryFor, withinRoots, hasShortName } from "./resources.mjs";
export {
  resolveEffectivePolicy, resolveVector, ceilingFor, grantFor, LEVEL_CHANGED, DEMOTED,
} from "./reduce.mjs";
export { authorizeAction, mayExecute, reproducedBy, shellArgv0, shellTargets } from "./authorize.mjs";
export { lintPolicy } from "./lint.mjs";
export {
  reservationLedger, spendCap, checkReservation, reserveAndSpend, stuckReservations,
  RESERVED, RELEASED, SETTLED,
} from "./spend.mjs";
export {
  authorizeRun, crossCheckDeclared, declaredCapabilities, loadPolicyFromDisk, loadPolicyEvents,
  TOOL_CAPABILITIES,
} from "./run-gate.mjs";
export {
  buildPromotionRequest, applyDecision, buildDemotion, levelAfterDemotion, PROMOTION_SUBJECT,
} from "./promotion.mjs";
export { recordOverreach } from "./incident.mjs";
