// ops.mjs -- kernel/scheduler: the verbs this module offers (face v2 Phase 05 kernel ring, ADR-1339, ADR-1340). Op ids
// only: each is a row in .claude/scripts/hq/face-ops.mjs. Registering a job hands a task to the machine's scheduler,
// so a sim door plans it and refuses the apply.
/** @type {readonly string[]} */
export const ops = Object.freeze(["scheduler.register-job"]);
