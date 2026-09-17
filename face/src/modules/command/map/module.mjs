// module.mjs -- command/map: the manifest (face v2 Phase 03, ADR-1320, REQ-05).
//
// "If it is not on this map, it is not in the company." Every served room a station, drawn from the
// registry the shell already read; the day's receipts decide which station is live today.
export default Object.freeze({
  id: "map",
  ring: "command",
  routes: Object.freeze(["/api/health", "/api/spine"]),
  asOf: true,
});
