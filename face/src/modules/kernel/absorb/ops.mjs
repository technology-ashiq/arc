// ops.mjs -- kernel/absorb: the verbs this module offers (face v2 Phase 05 kernel ring, ADR-1339, ADR-1340). Op ids
// only: each is a row in .claude/scripts/hq/face-ops.mjs. Both write a proposal branch (the report, the sealed
// commitment) and raise an approval; a sim door plans them and refuses the apply.
/** @type {readonly string[]} */
export const ops = Object.freeze(["absorb.pin-source", "absorb.trial"]);
