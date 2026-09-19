// ops.mjs -- company/org: the verbs this module offers (face v2 Phase 05, ADR-1326, ADR-1343). Op ids only: each is a
// row in .claude/scripts/hq/face-ops.mjs. Setting a lane's status is live; birthing a lane stays /arc-kickoff's, drawn
// as a verb-pending card.
/** @type {readonly string[]} */
export const ops = Object.freeze(["org.lane-status"]);
