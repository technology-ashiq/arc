// ops.mjs -- factory/design-studio: the verbs this module offers (face v2 Phase 05, ADR-1326, ADR-1341). Op ids only:
// opening an explore and recording the pick are rows in .claude/scripts/hq/face-ops.mjs. The critique and the jury are
// session verbs (Phase 06), so their card stays verb-pending.
/** @type {readonly string[]} */
export const ops = Object.freeze(["design-studio.open-brief", "design-studio.record-pick"]);
