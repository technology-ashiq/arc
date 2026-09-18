// module.mjs -- kernel/evolve: the manifest (face v2 Phase 03, ADR-1320, REQ-05).
//
// "Measured, or it did not improve." The evolve lane's own header and the experiment, promotion and
// council receipts the registry homes here.
export default Object.freeze({
  id: "evolve",
  ring: "kernel",
  routes: Object.freeze(["/api/lane/:id", "/api/spine", "/api/evolve"]),
  asOf: true,
});
