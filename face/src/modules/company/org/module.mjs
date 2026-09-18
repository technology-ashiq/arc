// module.mjs -- company/org: the manifest (face v2 Phase 03, company ring, ADR-1320, REQ-05).
//
// "Sixteen lanes. Who is awake, who is idle, who is blocked." The roster from the board's lane headers, and the ADR
// century map from PORTFOLIO.md's band table (F1: it names lanes).
export default Object.freeze({
  id: "org",
  ring: "company",
  routes: Object.freeze(["/api/board", "/api/file/:id"]),
  asOf: false,
});
