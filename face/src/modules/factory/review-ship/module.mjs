// module.mjs -- factory/review-ship: the manifest (face v2 Phase 03, ADR-1320, REQ-05).
//
// "Every gate blocks by default." The review, qa, commit and ship receipts the registry homes here. The
// registry gives this room no lane: every lane passes through these gates.
export default Object.freeze({
  id: "review-ship",
  ring: "factory",
  routes: Object.freeze(["/api/spine"]),
  asOf: true,
});
