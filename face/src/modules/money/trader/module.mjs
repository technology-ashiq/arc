// module.mjs -- money/trader: the manifest (face v2 Phase 03, ADR-1320, ADR-1328, REQ-05).
//
// A PLANNED room: the trader lane is not born, so no manifest of the lane's is invented. The room reads one
// allow-listed file, the planned-rooms registry, and draws its planned line from it, dotted.
// asOf is false: a file has no day-granular history to scrub to.
export default Object.freeze({
  id: "trader",
  ring: "money",
  routes: Object.freeze(["/api/file/:id"]),
  asOf: false,
});
