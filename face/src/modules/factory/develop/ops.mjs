// ops.mjs -- factory/develop: the verbs this module offers (face v2 Phase 05, ADR-1326, ADR-1339). Op ids only: each
// is a row in .claude/scripts/hq/face-ops.mjs, which holds its fields and its command. Opening a slice and closing a
// phase are still verb-pending cards (the factory ring's PR).
/** @type {readonly string[]} */
export const ops = Object.freeze(["develop.checkpoint"]);
