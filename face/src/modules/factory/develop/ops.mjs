// ops.mjs -- factory/develop: the verbs this module offers (face v2 Phase 05, ADR-1326, ADR-1339, ADR-1341). Op ids
// only: each is a row in .claude/scripts/hq/face-ops.mjs, which holds its fields and its command. Closing a phase on
// evidence is still a verb-pending card: proving a slice and the close are session verbs (Phase 06).
/** @type {readonly string[]} */
export const ops = Object.freeze(["develop.checkpoint", "develop.slice"]);
