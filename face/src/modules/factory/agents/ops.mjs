// ops.mjs -- factory/agents: the verbs this module offers (face v2 Phase 05, ADR-1326, ADR-1341). Op ids only: adding an
// agent is a row in .claude/scripts/hq/face-ops.mjs -- a proposal branch with the four files one agent needs.
/** @type {readonly string[]} */
export const ops = Object.freeze(["agents.add-agent"]);
