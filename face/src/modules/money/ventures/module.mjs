// module.mjs -- money/ventures: the manifest (face v2 Phase 03, ADR-1320, ADR-1321, REQ-05).
//
// "The factory is not the product." The kinds that have ever fired (/api/health), the real and simulated P&Ls
// with the kill panel (/api/pnl), and ventures.yaml's provenance (/api/file/:id) -- the file the passports will
// be parsed from once /api/ventures exists.
// asOf is false: which ventures exist comes from a file, and what each earned scopes by month, never by day.
export default Object.freeze({
  id: "ventures",
  ring: "money",
  routes: Object.freeze(["/api/health", "/api/pnl", "/api/file/:id"]),
  asOf: false,
});
