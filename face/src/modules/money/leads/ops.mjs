// ops.mjs -- money/leads: the verbs this module offers (face v2 Phase 05, ADR-1326, ADR-1344). Op ids only: each is a
// row in .claude/scripts/hq/face-ops.mjs. Sending today's outreach is live; researching, moving a lead and suppressing
// one are still verb-pending cards.
/** @type {readonly string[]} */
export const ops = Object.freeze(["leads.daily-send"]);
