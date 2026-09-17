// module.mjs -- factory/develop: the manifest (face v2 Phase 03, ADR-1320, REQ-05).
//
// "A phase closes on evidence, or it does not close." The develop lane's own header and phase specs,
// and the slice receipts the registry homes here.
export default Object.freeze({
  id: "develop",
  ring: "factory",
  routes: Object.freeze(["/api/lane/:id", "/api/spine"]),
  asOf: true,
});
