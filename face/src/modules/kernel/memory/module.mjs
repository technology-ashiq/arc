// module.mjs -- kernel/memory: the manifest (face v2 Phase 03, ADR-1320, REQ-05).
//
// "A correction made twice becomes a rule." The memory lane's own header, and the retro log and trial
// ledger the lessons will be parsed from. The registry homes no receipt kind here, so it reads no spine.
export default Object.freeze({
  id: "memory",
  ring: "kernel",
  routes: Object.freeze(["/api/lane/:id", "/api/file/:id"]),
  asOf: false,
});
