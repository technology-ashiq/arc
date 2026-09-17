// module.mjs -- kernel/absorb: the manifest (face v2 Phase 03, ADR-1320, REQ-05).
//
// "What arrives from outside is quarantined before it is believed." The absorb lane's own header and the
// decision receipts the registry homes here.
export default Object.freeze({
  id: "absorb",
  ring: "kernel",
  routes: Object.freeze(["/api/lane/:id", "/api/spine"]),
  asOf: true,
});
