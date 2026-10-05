#!/usr/bin/env node
// tests/org/judge-spine.mjs -- a spine holding one worker handoff for org-judge to rule on (org Cycle 20 Phase 01).
//
//   judge-spine.mjs DIR
//
// Writes one handoff.ready emitted by review-diff (placed on code-reviewer by the attribution map) and one
// run.completed from the same process. Prints "judge-spine: HANDOFF=<id> RUN=<id>"; any failure exits non-zero.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [dir] = process.argv.slice(2);
if (!dir) { console.error("usage: judge-spine.mjs DIR"); process.exit(2); }
const HANDOFF = "01M0JUDGESPINE000000000001";
const RUN = "01M0JUDGESPINE000000000002";
const ev = (id, kind, ts, payload) => ({ v: 1, id, ts, kind, actor: "arc-run", process: "review-diff@1.0.0",
  outcome: "ok", payload, venture: "arc", model: null, cost: null, evidence: null, supersedes: null, run_id: null, idem: null, sha: null });
const events = [
  ev(HANDOFF, "handoff.ready", "2026-10-05T09:00:00+05:30", { what: "a reviewed diff", artifact: "docs/reviews/probe.md" }),
  ev(RUN, "run.completed", "2026-10-05T09:01:00+05:30", { process: "review-diff" }),
];
mkdirSync(join(dir, "events"), { recursive: true });
writeFileSync(join(dir, "events", "2026-10-05.jsonl"), events.map((e) => JSON.stringify(e)).join("\n") + "\n");
console.log(`judge-spine: HANDOFF=${HANDOFF} RUN=${RUN}`);
