// module.mjs -- money/money: the manifest (face v2 Phase 02, ADR-1320, ADR-1321).
//
// CARRIED: this module draws the Cycle 15 MoneyRoom renderer through the module frame until Phase 03's
// money ring ports v0.7's Money into this folder. It declares no route because the carried
// renderer reads the door itself.
// asOf is false: this room's numbers are not day-scoped, and the door refuses a day as-of for them by
// name -- the shell's scrub says so here instead of silently doing nothing.
export default Object.freeze({
  id: "money",
  ring: "money",
  routes: Object.freeze([]),
  asOf: false,
});
