// ops.mjs -- kernel/engine-room: the verbs this module offers (face v2 Phase 05 kernel ring, ADR-1339, ADR-1340). Op
// ids only: each is a row in .claude/scripts/hq/face-ops.mjs. A driver switch is a proposal branch plus an approval;
// nothing routes differently until a human merges the branch.
/** @type {readonly string[]} */
export const ops = Object.freeze(["engine-room.driver-switch"]);
