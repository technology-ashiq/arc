// ops.mjs -- factory/executor: the verbs this module offers (face v2 Phase 05, ADR-1326, ADR-1341). Op ids only: ending a
// hire is a row in .claude/scripts/hq/face-ops.mjs. Hiring and dispatching are session verbs (Phase 06).
/** @type {readonly string[]} */
export const ops = Object.freeze(["executor.terminate"]);
