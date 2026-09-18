// module.mjs -- factory/executor: the manifest (face v2 Phase 03, ADR-1320, ADR-1327, REQ-05).
//
// "The credential is the leash." Not a room arc serves: the shell draws it from its exemption row (ADR-1327,
// ADR-1337). It reads engine/router.yaml's provenance through the door's allow-listed file route.
export default Object.freeze({
  id: "executor",
  ring: "factory",
  routes: Object.freeze(["/api/file/:id"]),
  asOf: false,
});
