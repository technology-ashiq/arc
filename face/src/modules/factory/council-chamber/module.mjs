// module.mjs -- factory/council-chamber: the manifest (face v2 Phase 03, ADR-1320, REQ-05).
//
// "Twelve seats. No rubber stamps." The council receipts the registry homes here. The registry gives
// this room no lane: the council is a company organ, not a lane's work.
export default Object.freeze({
  id: "council-chamber",
  ring: "factory",
  routes: Object.freeze(["/api/spine"]),
  asOf: true,
});
