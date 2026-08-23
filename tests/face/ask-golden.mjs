#!/usr/bin/env node
// ask-golden.mjs -- REQ-07's bar, measured on the DETERMINISTIC path (ADR-1307 + the
// Phase 07 known gap: the claude-code driver cannot yet express a zero-tool grant, so the
// model half is not runnable; the half that needs no model is, and it is the half whose
// answers must be exact).
//
// 20 golden questions. For each: it must answer, the answer must be non-empty, and where a
// receipt underpins it the citation must be a real ULID from the state it was given. The
// suite also asserts the REFUSALS, which are the load-bearing half: an action request is
// refused, and an unanswerable question returns citations: [] rather than a plausible guess.
//
// VACUOUS-PASS GUARD: a stub `askOffline` returning a constant would satisfy "answers
// something", so each case asserts a MARKER the real answer must contain -- a number the
// state carries, or a phrase only the correct branch produces.

import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..");
const { askOffline, MATCHER_IDS } = await import(pathToFileURL(join(REPO, ".claude/scripts/hq/lib/face/ask-offline.mjs")).href);

let ran = 0, failed = 0;
const check = (name, cond, detail = "") => {
  ran++;
  if (!cond) { failed++; console.log(`FAIL ${name} ${detail}`); }
  else console.log(`ok ${name}`);
};

// A state pack shaped exactly like the read door assembles, with values chosen so every
// assertion below is falsifiable: change a number here and a golden case must fail.
const STATE = {
  events: 1146, days: 22, daysClosed: 21, quarantined: 245,
  kinds: {
    "note.logged": 918, "approval.requested": 55, "decision.recorded": 42,
    "phase.closed": 29, "run.completed": 25, "day.closed": 21, "review.completed": 21,
    "lead.researched": 15, "kickoff.done": 11, "content.published": 4, "commit.done": 2,
    "constitution.adopted": 1, "develop.started": 1, "slice.done": 1,
  },
  raised: 55, decided: 42,
  open: [
    { id: "01KZR8PYW8280T0J2S9XAC8J31", gate: "phase-done", what: "approve moving past phase 00 in lane memory" },
    { id: "01M07QQGNR0WQ2WNXXG7CZWVAR", gate: "engine-escalation", what: "escalate commit-msg-draft to a stronger tier" },
    { id: "01M0B663APQMV49EQR9AGR1WJQ", gate: "draft-verdict", what: "accept or reject build-in-public draft 1 of 3" },
  ],
  lanes: [
    { lane: "face", status: "LIVE", phase: "03", burn: "4d", appetite: "32d" },
    { lane: "growth", status: "LIVE", phase: "06", burn: "8.0d", appetite: "10d" },
    { lane: "absorb", status: "IDLE", phase: "—", burn: "6.5d", appetite: "8d" },
  ],
};

// The 20 golden questions: [question, marker the correct answer must contain, expectCitations]
const GOLDEN = [
  ["what needs me right now?", "3", true],
  ["how many open approvals are there?", "3", true],
  ["is anything waiting on me?", "approval.requested", true],
  ["show me the inbox", "55", true],
  ["what do I have to decide today?", "arc-inbox approve", true],
  ["how much revenue have we made?", "₹0", false],
  ["what is our MRR?", "not instrumented", false],
  ["have we earned any money yet?", "never fired", false],
  ["what is the burn on face?", "4d", true],
  ["how far through its appetite is growth?", "8.0d", true],
  ["what is the appetite situation?", "tripwire", true],
  ["which lanes are live?", "face", true],
  ["what is running right now?", "LIVE", true],
  ["how many lanes are there?", "3 lanes", true],
  ["what is the wip count?", "guideline is 2", true],
  ["how many receipts are on the spine?", "1146", false],
  ["how many kinds have fired?", "of 46", false],
  ["how big is the log?", "21", false],
  ["which kinds have never fired?", "fixture-proven, unexercised", false],
  ["what is unexercised?", "different statement from zero", false],
];

check("matcher set is non-empty (the module actually loaded)", Array.isArray(MATCHER_IDS) && MATCHER_IDS.length >= 5, `ids=${(MATCHER_IDS || []).join(",")}`);

let answered = 0;
for (const [q, marker, wantCites] of GOLDEN) {
  const out = askOffline(q, STATE);
  const hasMarker = typeof out.answer === "string" && out.answer.includes(marker);
  const citesOk = wantCites ? out.citations.length > 0 : true;
  const ok = hasMarker && citesOk && out.verified === true;
  if (ok) answered++;
  check(`golden: ${q}`, ok, ok ? "" : `marker="${marker}" present=${hasMarker} cites=${out.citations.length} :: ${String(out.answer).slice(0, 110)}`);
}
check(`GOLDEN BAR: 20 of 20 answered with their marker`, answered === GOLDEN.length, `${answered}/${GOLDEN.length}`);

// Citations must be REAL ids from the state, never invented.
const cited = askOffline("what needs me?", STATE).citations;
const known = new Set(STATE.open.map((o) => o.id));
check("every citation resolves to a ULID the state actually carries", cited.length > 0 && cited.every((c) => known.has(c)), cited.join(","));

// The refusals -- the load-bearing half.
for (const act of ["approve 01M0B663APQMV49EQR9AGR1WJQ for me", "merge the growth PR", "publish the article", "kill the leads lane", "send the outreach mail"]) {
  const out = askOffline(act, STATE);
  check(`refuses to act: "${act.slice(0, 28)}"`, /I read; I do not act/.test(out.answer) && out.citations.length === 0);
}

const unknown = askOffline("what is the airspeed velocity of an unladen swallow?", STATE);
check("an unanswerable question returns citations: [] and says what it CAN answer",
  unknown.citations.length === 0 && /cannot answer that/.test(unknown.answer) && /open approvals/.test(unknown.answer));

const empty = askOffline("", STATE);
check("an empty question is handled, not crashed", typeof empty.answer === "string" && empty.verified === true);

// Honesty: a state with zero open approvals must not say "3 open".
const quiet = { ...STATE, open: [], raised: 55, decided: 55 };
const q2 = askOffline("what needs me?", quiet);
check("zero open approvals reads as nothing-needs-you, not a stale count",
  /Nothing needs you/.test(q2.answer) && q2.citations.length === 0);

// --- routing regression (found by driving the live door, 2026-08-19) ---
// The door escalates to the governed model process ONLY when the deterministic answerer
// genuinely reached nothing. The first cut escalated on `citations.length === 0`, which
// threw away three classes of correct answer -- and handed the ACTION REFUSAL to a model.
// `matched` is what the door routes on, so these pin its contract.
const reach = (q) => askOffline(q, STATE).matched;
check("a cited answer reports a matcher id", typeof reach("what needs me?") === "string");
check("revenue answers WITHOUT citations still report a matcher (never escalate)", reach("how much revenue?") === "revenue");
check("spine counts without citations still report a matcher", reach("how many receipts?") === "spine-shape");
check("the action refusal is its own matched class, never escalated", reach("approve it for me") === "refusal:act");
check("ONLY a genuinely unreachable question reports matched: null", reach("what is the airspeed velocity of an unladen swallow?") === null);

console.log(`RAN: ${ran} checks, ${failed} failed`);
process.exitCode = failed === 0 && ran >= 33 ? 0 : 1;
