#!/usr/bin/env node
// tests/org/interview-spine.mjs -- write a spine holding one role interview (REQ-11).
//
//   interview-spine.mjs DIR ROLE approve|reject|other-role|wrong-subject|twice
//   twice: the approving decision, then a SECOND decision (reject) on the same request -- a spine the emitter refuses (logic attack L5)
// Prints "interview-spine: DECISION_ULID -> DIR" (the ULID a hire must cite); non-zero on failure.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [dir, role, mode] = process.argv.slice(2);
if (!dir || !role || !["approve", "reject", "other-role", "wrong-subject", "twice"].includes(mode)) {
  console.error("usage: interview-spine.mjs DIR ROLE approve|reject|other-role|wrong-subject|twice"); process.exit(2);
}
const ev = (id, kind, process, payload) => ({ v: 1, id, ts: "2026-09-03T11:00:00+05:30", kind, actor: "arc-event", process,
  outcome: "ok", payload, venture: "arc", model: null, cost: null, evidence: null, supersedes: null, run_id: null, idem: null, sha: null });
const reqId = "01M0VEWREQ0000000000000001";
const decId = "01M0VEWDEC0000000000000001";
const req = ev(reqId, "approval.requested", "arc-event@1.0.0", {
  subject: mode === "wrong-subject" ? "org.team" : "org.role",
  role: mode === "other-role" ? "zz-someone-else" : role,
  what: `interview: bench fixtures for ${role}`,
});
const dec = ev(decId, "decision.recorded", "arc-inbox@1.0.0", { decides: reqId, verdict: mode === "reject" ? "reject" : "approve", reason: "fixture verdict" });
mkdirSync(join(dir, "events"), { recursive: true });
const again = mode === "twice"
  ? `${JSON.stringify(ev("01M0VEWDEC0000000000000002", "decision.recorded", "arc-inbox@1.0.0", { decides: reqId, verdict: "reject", reason: "second verdict" }))}\n`
  : "";
writeFileSync(join(dir, "events", "2026-09-03.jsonl"), `${JSON.stringify(req)}\n${JSON.stringify(dec)}\n${again}`);
console.log(`interview-spine: ${decId} -> ${dir}`);
