// module.mjs -- command/spine: the manifest (face v2 Phase 03, ADR-1320, REQ-05).
//
// "If it isn't an event, it didn't happen." The log itself, read-only, filtered by the door.
export default Object.freeze({
  id: "spine",
  ring: "command",
  routes: Object.freeze(["/api/health", "/api/spine"]),
  asOf: true,
});
