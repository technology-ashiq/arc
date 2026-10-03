// module.mjs -- company/org: the manifest (face v2 Phase 03, company ring, ADR-1320, REQ-05).
//
// "Every lane and every role." The roster from the board's lane headers, and the ADR
// century map from PORTFOLIO.md's band table (F1: it names lanes).
// org Cycle 19 (ADR-1624, ADR-1625): and below them, the company's roles, scorecards and teams, from /api/org.
export default Object.freeze({
  id: "org",
  ring: "company",
  routes: Object.freeze(["/api/board", "/api/file/:id", "/api/org"]),
  asOf: false,
});
