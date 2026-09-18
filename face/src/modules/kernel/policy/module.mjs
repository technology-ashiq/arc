// module.mjs -- kernel/policy: the manifest (face v2 Phase 03, ADR-1320, REQ-05).
//
// "Deny by default. Every capability earns its level." The policy lane's own header, the receipts the
// registry homes here (demotions, level changes, spend reservations, incidents), and the policy file the
// subject table will be parsed from.
export default Object.freeze({
  id: "policy",
  ring: "kernel",
  routes: Object.freeze(["/api/lane/:id", "/api/spine", "/api/file/:id", "/api/policy"]),
  asOf: true,
});
