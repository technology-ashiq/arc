#!/usr/bin/env node
// tests/org/dispatch-spine.mjs -- a governed team's spine, in one of several states, for org-dispatch.
//
//   dispatch-spine.mjs DIR VENTURE DIGEST SCENARIO
//     governed     the team's org.team approval, decided approve -- nothing else
//     demand2      + two prior vacancy-demand notes for pain-point-miner (the third call hires)
//     queuefull    + 7 org.dispatch proposals already raised today (2026-09-30)
//     budget       + a cost.incurred of 500 minor INR placed on board-advisors this month (line is 0)
//     stage-exit   + one idea.captured and one council.verdict for the venture
//     open         + an undecided proposal to board-advisors for board-verdict
// Prints "dispatch-spine: N event(s) -> DIR".
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [dir, venture, digest, scenario] = process.argv.slice(2);
const SCEN = ["governed", "demand2", "queuefull", "budget", "stage-exit", "open"];
if (!dir || !venture || !/^[0-9a-f]{64}$/.test(digest || "") || !SCEN.includes(scenario)) {
  console.error(`usage: dispatch-spine.mjs DIR VENTURE DIGEST ${SCEN.join("|")}`); process.exit(2);
}
let n = 0;
const id = () => `01M0DSPATCH${String(++n).padStart(15, "0")}`;
const ev = (kind, payload, extra = {}) => ({ v: 1, id: id(), ts: "2026-09-30T08:00:00+05:30", kind, actor: "arc-event", process: "arc-event@1.0.0",
  outcome: "ok", payload, venture: "arc", model: null, cost: null, evidence: null, supersedes: null, run_id: null, idem: null, sha: null, ...extra });

const events = [];
const gov = ev("approval.requested", { subject: "org.team", venture, digest, what: "staff the team" });
events.push(gov, ev("decision.recorded", { decides: gov.id, verdict: "approve", reason: "ok" }));
if (scenario === "demand2")
  for (let i = 0; i < 2; i++) events.push(ev("note.logged", { signal: "org.vacancy-demand", role: "pain-point-miner", venture, criterion: "discover.problem-captured", demand: i + 1 }, { actor: "scheduler:org-dispatch", ts: `2026-09-2${8 + i}T08:00:00+05:30` }));
if (scenario === "queuefull")
  for (let i = 0; i < 7; i++) events.push(ev("approval.requested", { subject: "org.dispatch", venture, role: "board-advisors", criterion: `x${i}`, what: "t", why_now: "t" }, { actor: "scheduler:org-dispatch", ts: "2026-09-30T06:00:00+05:30" }));
if (scenario === "budget")
  events.push(ev("cost.incurred", { amount: 500, currency: "INR", role: "board-advisors" }, { venture, ts: "2026-09-15T08:00:00+05:30" }));
if (scenario === "stage-exit") {
  events.push(ev("idea.captured", { text: "exporters wait 90 days for money" }, { venture }));
  events.push(ev("council.verdict", { decision: "YES" }, { venture }));
}
if (scenario === "open")
  events.push(ev("approval.requested", { subject: "org.dispatch", venture, role: "board-advisors", criterion: "board-verdict", what: "t", why_now: "t" }, { actor: "scheduler:org-dispatch", ts: "2026-09-29T06:00:00+05:30" }));

mkdirSync(join(dir, "events"), { recursive: true });
writeFileSync(join(dir, "events", "2026-09-30.jsonl"), events.map((e) => JSON.stringify(e)).join("\n") + "\n");
console.log(`dispatch-spine: ${events.length} event(s) -> ${dir}`);
