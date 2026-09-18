// module.mjs -- money/legal: the manifest (face v2 Phase 03, ADR-1320, REQ-05).
//
// "Nothing ships under his name without a human hand." The legal lane's own header, the receipts the registry
// homes here, and the constitution's provenance -- the file the five seals will be parsed from.
export default Object.freeze({
  id: "legal",
  ring: "money",
  routes: Object.freeze(["/api/lane/:id", "/api/spine", "/api/file/:id"]),
  asOf: true,
});
