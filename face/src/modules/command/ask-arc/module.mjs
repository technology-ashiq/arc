// module.mjs -- command/ask-arc: the manifest (face v2 Phase 03, ADR-1320, ADR-1325, REQ-05).
//
// "Ask in words. Every answer carries its receipt." A brain with no hands: `/api/ask` is an act the
// host sends through a read-only handle, and every citation an answer makes is checked by a read of
// the spine, a lane or a file -- the only three routes a claim can be settled by.
export default Object.freeze({
  id: "ask-arc",
  ring: "command",
  routes: Object.freeze(["/api/ask", "/api/spine", "/api/lane/:id", "/api/file/:id"]),
  asOf: false,
});
