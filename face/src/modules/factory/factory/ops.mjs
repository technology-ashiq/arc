// ops.mjs -- factory/factory: the verbs this module offers (face v2 Phase 05, ADR-1326, ADR-1341). Op ids only: asking to
// switch the profile is a row in .claude/scripts/hq/face-ops.mjs; the key itself is the owner's edit (ADR-0502).
/** @type {readonly string[]} */
export const ops = Object.freeze(["factory.switch-profile"]);
