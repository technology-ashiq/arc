#!/usr/bin/env node
// tests/org/team-spine.mjs -- write a spine that governs (or fails to govern) one team digest.
//
//   team-spine.mjs DIR VENTURE DIGEST approve|reject|none|near-miss
//     approve    an org.team approval.requested over DIGEST, decided approve
//     reject     the same request, decided reject
//     none       the request only, never decided
//     near-miss  subject "Org.team" (case differs) decided approve -- must NOT govern
//     twice      decided approve, then decided AGAIN reject -- a spine the emitter refuses; must NOT govern (logic attack L1)
//
// Prints "team-spine: N event(s) -> DIR"; any failure exits non-zero.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [dir, venture, digest, mode] = process.argv.slice(2);
if (!dir || !venture || !/^[0-9a-f]{64}$/.test(digest || "") || !["approve", "reject", "none", "near-miss", "twice"].includes(mode)) {
  console.error("usage: team-spine.mjs DIR VENTURE DIGEST approve|reject|none|near-miss|twice"); process.exit(2);
}
let n = 0;
const id = () => `01M0TEAMSPINE${String(++n).padStart(13, "0")}`;
const ev = (kind, process, payload) => ({ v: 1, id: id(), ts: `2026-09-02T09:0${n}:00+05:30`, kind, actor: "arc-event", process,
  outcome: "ok", payload, venture: "arc", model: null, cost: null, evidence: null, supersedes: null, run_id: null, idem: null, sha: null });
const subject = mode === "near-miss" ? "Org.team" : "org.team";
const req = ev("approval.requested", "arc-event@1.0.0", { subject, venture, digest, what: "staff the team" });
const events = [req];
if (mode === "approve" || mode === "near-miss" || mode === "twice") events.push(ev("decision.recorded", "arc-inbox@1.0.0", { decides: req.id, verdict: "approve", reason: "ok" }));
if (mode === "reject" || mode === "twice") events.push(ev("decision.recorded", "arc-inbox@1.0.0", { decides: req.id, verdict: "reject", reason: "no" }));
mkdirSync(join(dir, "events"), { recursive: true });
writeFileSync(join(dir, "events", "2026-09-02.jsonl"), events.map((e) => JSON.stringify(e)).join("\n") + "\n");
console.log(`team-spine: ${events.length} event(s) -> ${dir}`);
