// module.mjs -- company/learn: the manifest (face v2 Phase 03, company ring, ADR-1320, REQ-05).
//
// "Correct it twice, it becomes impossible." The learning loop's two files by their provenance; what /api/learn will
// fold is NOT SERVED (PLAN-face-v2 section 5.2).
export default Object.freeze({
  id: "learn",
  ring: "company",
  routes: Object.freeze(["/api/file/:id", "/api/learn"]),
  asOf: false,
});
