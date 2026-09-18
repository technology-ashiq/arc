// module.mjs -- command/today: the manifest (face v2 Phase 03, ADR-1320, REQ-05).
//
// v0.7's Overview on the door: the figures, the brief, the day's receipts and what waits for the
// owner, each from a route this list declares. What the door does not serve yet is a NOT SERVED
// panel, never a route declared in hope.
export default Object.freeze({
  id: "today",
  ring: "command",
  routes: Object.freeze(["/api/health", "/api/brief", "/api/inbox", "/api/spine", "/api/policy", "/api/learn"]),
  asOf: true,
});
