// ops.mjs -- kernel/model-policy: the verbs this module offers (face v2 Phase 05 kernel ring, ADR-1339, ADR-1340). Op
// ids only: each is a row in .claude/scripts/hq/face-ops.mjs. A tier change is a proposal branch plus an approval; the
// class keeps its tier until a human merges the branch.
/** @type {readonly string[]} */
export const ops = Object.freeze(["model-policy.tier-proposal"]);
