// module.mjs -- factory/factory: the manifest (face v2 Phase 03, ADR-1320, ADR-1337, REQ-05).
//
// "Cycles, phases, gates -- the floor." The running cycles from the board's lane headers, the phase closings and
// kickoffs the registry homes here from the spine. A served room since the owner's ruling gave it a registry row.
export default Object.freeze({
  id: "factory",
  ring: "factory",
  routes: Object.freeze(["/api/spine", "/api/board"]),
  asOf: true,
});
