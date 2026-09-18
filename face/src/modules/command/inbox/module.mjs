// module.mjs -- command/inbox: the manifest (face v2 Phase 03, ADR-1320, REQ-05).
//
// "A machine may raise it. Only you may decide it." The one write path: `/api/decide` is declared as
// an act, reached only through the host, and byte-parity with arc-inbox stays the door's (ADR-1302).
export default Object.freeze({
  id: "inbox",
  ring: "command",
  routes: Object.freeze(["/api/health", "/api/inbox", "/api/spine", "/api/decide"]),
  asOf: true,
});
