#!/usr/bin/env node
// tests/org/spine-fixture.mjs -- write a small spine the org scorecard can be proven against.
//
//   spine-fixture.mjs DIR [full|weak]
//     full: receipts that place on >= 3 seated roles through rules that NAME their source
//     weak: only scheduler heartbeats and kind-only receipts -- the checkpoint's negative control
//
// Prints "spine-fixture: N event(s) -> DIR" and exits non-zero on any failure, so a caller can
// assert the fixture exists and is non-empty before trusting anything read from it.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [dir, shape = "full"] = process.argv.slice(2);
if (!dir || !["full", "weak"].includes(shape)) { console.error("usage: spine-fixture.mjs DIR [full|weak]"); process.exit(2); }

let n = 0;
const id = () => `01M0FIXTURE${String(++n).padStart(15, "0")}`;
const ev = (kind, actor, process, payload, outcome = "ok") => ({
  v: 1, id: id(), ts: `2026-09-01T10:${String(n).padStart(2, "0")}:00+05:30`, kind, actor, process,
  outcome, payload, venture: "arc", model: null, cost: null, evidence: null, supersedes: null, run_id: null, idem: null, sha: null,
});

const events = [];
if (shape === "full") {
  events.push(ev("run.completed", "arc-event", "commit-msg-draft@1.0.0", { process: "commit-msg-draft" }, "ok"));
  events.push(ev("run.completed", "arc-event", "commit-msg-draft@1.0.0", { process: "commit-msg-draft" }, "fail"));
  events.push(ev("run.completed", "arc-event", "council-convene@1.0.0", { process: "council-convene" }, "ok"));
  const ask = ev("approval.requested", "arc-leads", "arc-event@1.0.0", { what: "send 1 message" });
  events.push(ask);
  events.push(ev("decision.recorded", "arc-event", "arc-inbox@1.0.0", { decides: ask.id, verdict: "approve", reason: "ok" }));
  const ask2 = ev("approval.requested", "arc-event", "build-in-public-draft@1.0.0", { what: "post a draft" });
  events.push(ask2);
  events.push(ev("decision.recorded", "arc-event", "arc-inbox@1.0.0", { decides: ask2.id, verdict: "reject", reason: "no" }));
  // payload.role wins over the map, and a disagreement is printed, never resolved in silence
  events.push(ev("run.completed", "arc-event", "commit-msg-draft@1.0.0", { process: "commit-msg-draft", role: "qa-tester" }, "ok"));
}
events.push(ev("run.completed", "scheduler:day-close-roll", "arc-event@1.0.0", { process: "day-close-roll" }, "ok"));
events.push(ev("review.completed", "arc-event", "arc-event@1.0.0", { what: "diff" }));
events.push(ev("note.logged", "arc-event", "arc-event@1.0.0", { text: "unplaced" }));

const days = join(dir, "events");
mkdirSync(days, { recursive: true });
writeFileSync(join(days, "2026-09-01.jsonl"), events.map((e) => JSON.stringify(e)).join("\n") + "\n");
if (!events.length) { console.error("spine-fixture: wrote nothing"); process.exit(1); }
console.log(`spine-fixture: ${events.length} event(s) -> ${dir}`);
