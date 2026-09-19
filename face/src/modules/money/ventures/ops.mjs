// ops.mjs -- money/ventures: the verbs this module offers (face v2 Phase 05, ADR-1326, ADR-1342). Op ids only: each is
// a row in .claude/scripts/hq/face-ops.mjs. Registering a venture and proposing a kill review are live; staging one is
// still a verb-pending card.
/** @type {readonly string[]} */
export const ops = Object.freeze(["ventures.register", "ventures.kill-review"]);
