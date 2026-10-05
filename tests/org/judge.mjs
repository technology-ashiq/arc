// judge.mjs -- org-judge's decision and the scorecard arm it feeds (org Cycle 20 Phase 01, REQ-03, ADR-1627).
// Pure: in-memory cards, team, spine and placements. Prints "RAN judge N checks" first-class; exits 1 on any failure.
import { judge, parseArgs } from "../../.claude/scripts/org/org-judge.mjs";
import { scorecard, placeAll } from "../../.claude/scripts/org/lib/attribution.mjs";

let checks = 0;
let failed = 0;
const ok = (cond, what) => { checks += 1; if (!cond) { failed += 1; console.log(`FAIL ${what}`); } };

const card = (id, dept, reports_to, staffed = true) => ({ id, dept, reports_to, seat: staffed ? "agent" : "vacant", legitimacy: staffed ? "genesis" : "" });
const cards = new Map([
  ["lead", card("lead", "e-engineering", "ceo")],
  ["w1", card("w1", "e-engineering", "lead")],
  ["w2", card("w2", "e-engineering", "lead")],
  ["w3", card("w3", "e-engineering", "lead", false)],
]);
const team = (heads, shift) => ({ stem: "acme", doc: { venture: "acme", heads, on_shift: { build: shift } } });
const goodTeam = team({ "e-engineering": "lead" }, ["lead", "w1", "w2"]);
const H = "01M0JDGEX00000000000000001";
const R = "01M0JDGEX00000000000000002";
const events = [
  { id: H, kind: "handoff.ready", ts: "2026-10-05T10:00:00+05:30", payload: { role: "w1" } },
  { id: R, kind: "run.completed", ts: "2026-10-05T10:01:00+05:30", outcome: "ok", payload: { role: "w1" } },
];
const roleIds = new Set(cards.keys());
const placements = placeAll(events, [], roleIds).placements;
const base = { head: "lead", receipt: H, verdict: "accept", reason: "clean diff, tests named", team: null, dryRun: false };
const run = (over = {}, extra = {}) => judge({ o: { ...base, ...over }, cards, events: extra.events || events, placements: extra.placements || placements, teams: extra.teams || [goodTeam] });
const refusedWith = (d, code) => d.refusals.some((x) => x.startsWith(`${code}:`));

// happy path: exactly the five fields plus the team
let d = run();
ok(d.refusals.length === 0, `happy path refused: ${JSON.stringify(d.refusals)}`);
ok(d.payload && d.payload.role === "lead" && d.payload.subject_role === "w1" && d.payload.subject_receipt === H && d.payload.verdict === "accept" && d.payload.team === "acme", `payload: ${JSON.stringify(d.payload)}`);

// the six named mutants of REQ-03, each refusing by name
ok(refusedWith(run({ receipt: R }), "NOT_HANDOFF"), "a run.completed is not judged");
ok(refusedWith(run({}, { teams: [team({ "e-engineering": "lead" }, ["lead", "w2", "w3"])] }), "NO_TEAM")
  || refusedWith(run({}, { teams: [team({ "e-engineering": "lead" }, ["lead", "w2", "w3"])] }), "NOT_WORKER"), "a worker not on the head's team is refused");
ok(refusedWith(run({}, { teams: [team({ "e-engineering": "lead" }, ["lead", "w1", "w3"])] }), "ORG_O"), "one staffed worker is not enough (ORG-O)");
const selfEv = [{ id: H, kind: "handoff.ready", ts: "x", payload: { role: "lead" } }];
ok(refusedWith(run({}, { events: selfEv, placements: placeAll(selfEv, [], roleIds).placements }), "SELF_JUDGE"), "a head cannot judge itself");
const twice = [...events, { id: "01M0JDGEX00000000000000003", kind: "review.completed", ts: "y", payload: { role: "lead", subject_receipt: H, subject_role: "w1", verdict: "accept" } }];
ok(refusedWith(run({}, { events: twice, placements: placeAll(twice, [], roleIds).placements }), "ALREADY_JUDGED"), "a second verdict on one receipt is refused");
ok(refusedWith(run({ reason: "line one\nline two" }), "BAD_REASON"), "a two-line reason is refused");
ok(refusedWith(run({ reason: "x".repeat(2001) }), "BAD_REASON"), "a reason over 2000 bytes is refused");
ok(refusedWith(run({ reason: "approve\u202Ereject" }), "BAD_REASON"), "a bidi override in the reason is refused");

// more refusals, each by name, and ALL of them listed rather than the first
ok(refusedWith(run({ verdict: "Accept" }), "BAD_VERDICT"), "the verdict is case-exact");
ok(refusedWith(run({ receipt: "01M0JDGEX00000000000000009" }), "NO_RECEIPT"), "an unknown receipt is refused");
ok(refusedWith(run({}, { teams: [] }), "NO_TEAM"), "no team manifest refuses NO_TEAM");
ok(refusedWith(run({}, { teams: [goodTeam, { ...goodTeam, stem: "other" }] }), "AMBIGUOUS_TEAM"), "two fitting teams are ambiguous, never a pick");
ok(refusedWith(run({ head: "w2" }), "NO_TEAM") || refusedWith(run({ head: "w2" }), "NOT_HEAD"), "a worker named as head is refused");
d = run({ verdict: "maybe", reason: "" });
ok(refusedWith(d, "BAD_VERDICT") && refusedWith(d, "BAD_REASON"), `every failed condition listed: ${JSON.stringify(d.refusals)}`);

// argument strictness
let threw = false;
try { parseArgs(["--head", "a", "--head", "b", "--receipt", H, "--verdict", "accept", "--reason", "r"]); } catch { threw = true; }
ok(threw, "a flag given twice is an operator error");
threw = false;
try { parseArgs(["--head", "a", "--receipt", "--verdict", "accept", "--reason", "r"]); } catch { threw = true; }
ok(threw, "a flag swallowing the next flag is an operator error");

// the scorecard arm: a placed verdict judges the WORKER, and stays the head's receipt
const judged = [...events, { id: "01M0JDGEX00000000000000004", kind: "review.completed", ts: "2026-10-05T11:00:00+05:30", payload: { role: "lead", subject_role: "w1", subject_receipt: H, verdict: "rework" } }];
const p2 = placeAll(judged, [], roleIds).placements;
const w1 = scorecard("w1", judged, p2);
ok(w1.evidence && w1.rejects === 1 && w1.accepts === 0, `worker scorecard counts the verdict: ${JSON.stringify(w1)}`);
const lead = scorecard("lead", judged, p2);
ok(lead.evidence && lead.receipts === 1 && lead.rejects === 0, `the head holds the receipt, not the verdict: ${JSON.stringify(lead)}`);
const w2 = scorecard("w2", [{ id: "01M0JDGEX00000000000000005", kind: "review.completed", ts: "z", payload: { subject_role: "w2", verdict: "accept" } }], new Map());
ok(w2.evidence === false, "an unplaced verdict judges nobody");

console.log(`RAN judge ${checks} checks, ${failed} failed`);
process.exit(failed ? 1 : 0);
