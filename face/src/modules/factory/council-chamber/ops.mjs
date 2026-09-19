// ops.mjs -- factory/council-chamber: the verbs this module offers (face v2 Phase 05, ADR-1326, ADR-1341). Op ids only:
// sending a question is a row in .claude/scripts/hq/face-ops.mjs. Convening itself is a session verb (Phase 06), so its
// card stays verb-pending.
/** @type {readonly string[]} */
export const ops = Object.freeze(["council-chamber.send-to-council"]);
