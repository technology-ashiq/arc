// module.mjs -- command/board: the manifest (face v2 Phase 03, ADR-1320, REQ-05).
//
// "Every lane, its phase, and what it is burning." Read from each lane's PROGRESS header through the
// board route; the pipeline is today's receipts by kind.
export default Object.freeze({
  id: "board",
  ring: "command",
  routes: Object.freeze(["/api/board", "/api/health", "/api/spine"]),
  asOf: false,
});
