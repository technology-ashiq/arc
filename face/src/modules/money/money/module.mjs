// module.mjs -- money/money: the manifest (face v2 Phase 03, ADR-1320, ADR-1321, REQ-05).
//
// "Real and simulated are different substances." The kinds that have ever fired (/api/health, the only thing
// that can unspend real money's colour), the real P&L and its kill panel (/api/pnl), and the simulated P&L
// (/api/pnl?simulated=1) -- two reads, never merged.
// asOf is false: the money brain scopes by month, and the door refuses a day as-of on this route by name.
export default Object.freeze({
  id: "money",
  ring: "money",
  routes: Object.freeze(["/api/health", "/api/pnl"]),
  asOf: false,
});
