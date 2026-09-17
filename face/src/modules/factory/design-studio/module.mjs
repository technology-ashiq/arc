// module.mjs -- factory/design-studio: the manifest (face v2 Phase 03, ADR-1320, REQ-05).
//
// "A rule unbroken is not the same as work worth shipping." The design lane's own header and the
// receipts the registry homes here.
export default Object.freeze({
  id: "design-studio",
  ring: "factory",
  routes: Object.freeze(["/api/lane/:id", "/api/spine"]),
  asOf: true,
});
