// ops.mjs -- kernel/bench: the verbs this module offers (face v2 Phase 05, ADR-1326, ADR-1339). Op ids only: each is a
// row in .claude/scripts/hq/face-ops.mjs. Running the bench is live; proposing a promotion is the kernel ring's PR, so
// the "Add a model to the bench" card stays until that half ships.
/** @type {readonly string[]} */
export const ops = Object.freeze(["bench.run-model"]);
