// ops.mjs -- command/today: the verbs this module offers (face v2 Phase 05, ADR-1326, ADR-1339). Op ids only: each is
// a row in .claude/scripts/hq/face-ops.mjs, which holds its fields and its command, and face-coverage holds the two
// lists equal both ways.
/** @type {readonly string[]} */
export const ops = Object.freeze(["today.capture-idea"]);
