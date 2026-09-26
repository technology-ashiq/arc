// module.mjs -- factory/toolbelt: the manifest (face v2 Phase 03, ADR-1320, REQ-05).
//
// "Every command, every agent, every rule -- one place to look." The catalogue is the served registry
// itself, which the shell already read, so this module asks the door for its lane -- and for the pins, which are
// note.logged receipts on the spine (face v2 Phase 05, ADR-1341 §5).
export default Object.freeze({
  id: "toolbelt",
  ring: "factory",
  routes: Object.freeze(["/api/lane/:id", "/api/spine"]),
  // /api/spine is a route the shell's as-of scrub reaches, so the pins replay as of the moment scrubbed to.
  asOf: true,
});
