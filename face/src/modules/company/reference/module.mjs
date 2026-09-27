// module.mjs -- company/reference: the manifest (ADR-1320, ADR-1321, ADR-1346).
//
// One read: the docs wiki's own extract, served by the door (Phase 07 PR A). Build-time facts only, so the as-of scrub
// never reaches it (ADR-1509): the tree a page describes does not change with the day the face is replaying.
export default Object.freeze({
  id: "reference",
  ring: "company",
  routes: Object.freeze(["/api/reference"]),
  asOf: false,
});
