// module.mjs -- factory/agents: the manifest (face v2 Phase 03, ADR-1320, ADR-1327, REQ-05).
//
// "A roster, not a crowd." Not a room arc serves: the shell draws it from its exemption row (ADR-1327, ADR-1337).
// It reads no route -- the roster is the served registry the shell already holds.
export default Object.freeze({
  id: "agents",
  ring: "factory",
  routes: Object.freeze([]),
  asOf: false,
});
