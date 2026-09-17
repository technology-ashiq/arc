// module.mjs -- command/spine: the manifest (face v2 Phase 02, ADR-1320, ADR-1321).
//
// CARRIED: this module draws the Cycle 15 SpineRoom renderer through the module frame until Phase 03's
// command ring ports v0.7's SpineRoom into this folder. It declares no route because the carried
// renderer reads the door itself.
export default Object.freeze({
  id: "spine",
  ring: "command",
  routes: Object.freeze([]),
  asOf: true,
});
