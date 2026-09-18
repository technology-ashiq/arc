// module.mjs -- company/story: the manifest (face v2 Phase 03, company ring, ADR-1320, ADR-1337, REQ-05).
//
// "How it got here." The company's logbook, docs/HISTORY.md, read from the file the door serves it as (PLAN-face-v2
// section 5.2). A served room since the owner's section 13 item 5 ruling gave it a registry row (ADR-1337).
export default Object.freeze({
  id: "story",
  ring: "company",
  routes: Object.freeze(["/api/file/:id"]),
  asOf: false,
});
