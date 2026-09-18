// module.mjs -- money/growth: the manifest (face v2 Phase 03, ADR-1320, REQ-05).
//
// "Reach is capped before it is measured." The growth lane's own header and the publish and metric receipts
// the registry homes here.
export default Object.freeze({
  id: "growth",
  ring: "money",
  routes: Object.freeze(["/api/lane/:id", "/api/spine", "/api/growth"]),
  asOf: true,
});
