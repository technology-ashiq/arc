// ops.mjs -- money/money: the verbs this module offers (face v2 Phase 05, ADR-1326, ADR-1339). Op ids only: each is a
// row in .claude/scripts/hq/face-ops.mjs. Setting criteria and closing a month are live; recording real revenue is
// still a verb-pending card (the money ring's PR).
/** @type {readonly string[]} */
export const ops = Object.freeze(["money.criteria", "money.close-month"]);
