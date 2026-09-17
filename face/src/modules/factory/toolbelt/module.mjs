// module.mjs -- factory/toolbelt: the manifest (face v2 Phase 03, ADR-1320, REQ-05).
//
// "Every command, every agent, every rule -- one place to look." The catalogue is the served registry
// itself, which the shell already read, so this module asks the door for nothing but its lane.
export default Object.freeze({
  id: "toolbelt",
  ring: "factory",
  routes: Object.freeze(["/api/lane/:id"]),
  asOf: false,
});
