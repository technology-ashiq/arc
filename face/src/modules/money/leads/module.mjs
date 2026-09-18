// module.mjs -- money/leads: the manifest (face v2 Phase 03, ADR-1320, REQ-05).
//
// "An offer, not a broadcast." The leads lane's own header and the funnel receipts the registry homes here --
// counted by kind, never a lead named on this screen.
export default Object.freeze({
  id: "leads",
  ring: "money",
  routes: Object.freeze(["/api/lane/:id", "/api/spine", "/api/leads"]),
  asOf: true,
});
