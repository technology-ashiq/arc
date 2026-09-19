// ops.mjs -- kernel/bench: the verbs this module offers (face v2 Phase 05, ADR-1326, ADR-1339, ADR-1340). Op ids only:
// each is a row in .claude/scripts/hq/face-ops.mjs. Running the bench spends (a sim door runs only the mock driver);
// proposing a promotion runs nothing -- it compares a run that already happened with the champion's.
/** @type {readonly string[]} */
export const ops = Object.freeze(["bench.run-model", "bench.propose"]);
