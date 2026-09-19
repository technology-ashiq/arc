// ops.mjs -- money/money: the verbs this module offers (face v2 Phase 05, ADR-1326, ADR-1339, ADR-1342). Op ids only:
// each is a row in .claude/scripts/hq/face-ops.mjs. Setting criteria, closing a month and recording real revenue are
// live; the room has no verb-pending card left.
/** @type {readonly string[]} */
export const ops = Object.freeze(["money.criteria", "money.close-month", "money.ingest"]);
