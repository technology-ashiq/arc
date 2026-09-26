// ops.mjs -- kernel/evolve: the verbs this module offers (face v2 Phase 05 kernel ring, ADR-1339, ADR-1340). Op ids
// only: each is a row in .claude/scripts/hq/face-ops.mjs. Each prints its receipt's emit from the spine and the
// module's evolve section (arc-evolve open|measure|conclude); on a tree where no module declares one, each refuses
// by name, and the dock shows that refusal as the tool said it.
/** @type {readonly string[]} */
export const ops = Object.freeze(["evolve.open-experiment", "evolve.measure", "evolve.conclude"]);
