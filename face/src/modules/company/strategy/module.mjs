// module.mjs -- company/strategy: the manifest (face v2 Phase 03, company ring, ADR-1320, REQ-05).
//
// "One plan is live per lane. The rest are history." The live plans from the board's lane headers; the shelf from
// the served registry; the ADR index NOT SERVED until /api/adrs.
export default Object.freeze({
  id: "strategy",
  ring: "company",
  routes: Object.freeze(["/api/board", "/api/adrs"]),
  asOf: false,
});
