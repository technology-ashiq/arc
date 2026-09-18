// module.mjs -- kernel/bench: the manifest (face v2 Phase 03, ADR-1320, REQ-05).
//
// "Drivers are compared, never trusted." The bench lane's own header and the run and promotion receipts
// the registry homes here.
export default Object.freeze({
  id: "bench",
  ring: "kernel",
  routes: Object.freeze(["/api/lane/:id", "/api/spine"]),
  asOf: true,
});
