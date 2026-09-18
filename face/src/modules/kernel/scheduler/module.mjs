// module.mjs -- kernel/scheduler: the manifest (face v2 Phase 03, ADR-1320, REQ-05).
//
// "Nothing runs because someone remembered." The scheduler lane's own header, the run and incident
// receipts the registry homes here, and the jobs file the cadences will be parsed from.
export default Object.freeze({
  id: "scheduler",
  ring: "kernel",
  routes: Object.freeze(["/api/lane/:id", "/api/spine", "/api/file/:id"]),
  asOf: true,
});
