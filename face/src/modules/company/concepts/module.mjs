// module.mjs -- company/concepts: the manifest (face v2 Phase 03, company ring, ADR-1320, REQ-05).
//
// "Every word arc uses, and the room it lives in." The glossary is the contract itself, read through the door's
// allow-listed file route (PLAN-face-v2 section 5.2).
export default Object.freeze({
  id: "concepts",
  ring: "company",
  routes: Object.freeze(["/api/file/:id"]),
  asOf: false,
});
