// ops.mjs -- money/legal: the verbs this module offers (face v2 Phase 05, ADR-1326, ADR-1344). Op ids only: each is a
// row in .claude/scripts/hq/face-ops.mjs. Raising the full-read gate is live -- the stamp itself is the inbox decision;
// a gate's mode and the legal lints are still verb-pending cards.
/** @type {readonly string[]} */
export const ops = Object.freeze(["legal.full-read"]);
