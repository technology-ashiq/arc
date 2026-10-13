// module.mjs -- money/discover: the manifest (face v2 Phase 17, REQ-21, ADR-1356; ADR-1320).
//
// A served room since Phase 17: it reads discover's own receipts through GET /api/discover. asOf false: the route reads
// the whole spine as it stands and has no day-scoped replay of its own.
export default Object.freeze({
  id: "discover",
  ring: "money",
  routes: Object.freeze(["/api/discover"]),
  asOf: false,
});
