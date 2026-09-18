// module.mjs -- kernel/model-policy: the manifest (face v2 Phase 03, ADR-1320, REQ-05).
//
// "Tiers are law, not taste." The model-policy lane's own header and the router file the tier table will
// be parsed from. The registry homes no receipt kind here, so the module reads no spine.
export default Object.freeze({
  id: "model-policy",
  ring: "kernel",
  routes: Object.freeze(["/api/lane/:id", "/api/file/:id", "/api/model-policy"]),
  asOf: false,
});
