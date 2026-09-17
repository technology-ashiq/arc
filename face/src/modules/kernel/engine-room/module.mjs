// module.mjs -- kernel/engine-room: the manifest (face v2 Phase 03, ADR-1320, REQ-05).
//
// "The model is a swappable part. The process is not." The engine lane's own header, the run receipts
// the registry homes here, and the router file the driver table will be parsed from.
export default Object.freeze({
  id: "engine-room",
  ring: "kernel",
  routes: Object.freeze(["/api/lane/:id", "/api/spine", "/api/file/:id"]),
  asOf: false,
});
