#!/usr/bin/env node
// ops-logic.mjs -- the ops dock's decisions, exercised WITHOUT a build (face v2 Phase 05; REQ-07, ADR-1339).
//
// face/src/lib/ops.mjs holds every decision the dock makes; shell/OpsDock.tsx only runs effects and draws. So the
// rules are asserted here, straight from the app's own source: which op ids a room shows, what a plan and a run fold
// to, when Plan and Run are live, what apply sends, and the one line a finished run ends on.
//
// VACUOUS-PASS GUARD: the module is proven loaded with its exports before any behaviour is trusted, and the last line
// is "RAN: <n> checks", which the bats wrapper requires.

import { join, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..");

let ran = 0, failed = 0;
const check = (name, cond, detail = "") => {
  ran++;
  if (!cond) { failed++; console.log(`FAIL ${name} ${detail}`); }
  else console.log(`ok ${name}`);
};

const O = await import(pathToFileURL(join(REPO, "face", "src", "lib", "ops.mjs")).href);
const FNS = ["opCards", "planInput", "planBlocked", "planStarted", "planSettled", "refusalOf", "callFailed", "applyArgs", "applyBlocked", "applyStarted", "runSettled", "applyFailed", "polling", "runVerdict"];
check("ops.mjs loads and carries its exports (vacuous-pass guard)", FNS.every((k) => typeof O[k] === "function") && O.IDLE && O.IDLE.phase === "idle", FNS.filter((k) => typeof O[k] !== "function").join(","));

// The door's registry answer, escaped as the door serves every string.
const registry = {
  ops: [
    { id: "money.close-month", label: "Close a month", hint: "It&#39;s human-run", humanRun: true, spends: false, receipt: { kind: "month.closed" },
      fields: [{ name: "month", label: "Month", placeholder: "YYYY-MM", type: "text", required: true }, { name: "totals", label: "Totals", placeholder: "a &amp; b", type: "text", required: false }] },
    { id: "today.capture-idea", label: "Capture", hint: "", humanRun: false, spends: false, receipt: { kind: "idea.captured" }, fields: [{ name: "text", label: "The idea", placeholder: "one line", type: "text", required: true }] },
  ],
};

// ---- opCards ----
{
  const loading = O.opCards(["money.close-month"], null);
  check("opCards: before the registry answers, every card is loading", loading.length === 1 && loading[0].state === "loading");
  const cards = O.opCards(["money.close-month", "ghost.op", 7], registry);
  check("opCards: a non-string id is dropped, an id the door does not serve is absent and says so",
    cards.length === 2 && cards[1].state === "absent" && /does not serve/.test(cards[1].why), JSON.stringify(cards));
  const c = cards[0];
  check("opCards: a served op is ready, its door text unescaped once", c.state === "ready" && c.hint === "It's human-run" && c.fields[1].placeholder === "a & b" && c.humanRun === true && c.receiptKind === "month.closed", JSON.stringify(c));
}
const close = O.opCards(["money.close-month"], registry)[0];
const idea = O.opCards(["today.capture-idea"], registry)[0];

// ---- planning ----
check("planBlocked: a required field left empty keeps Plan off, naming the field", /Month/.test(O.planBlocked(close, {}) || ""));
check("planBlocked: an optional field may stay empty", O.planBlocked(close, { month: "2026-08" }) === null);
check("planInput: empty fields are left out, typed ones sent exactly as typed", JSON.stringify(O.planInput(close, { month: " 2026-08", totals: "" })) === JSON.stringify({ month: " 2026-08" }));
check("planStarted is the planning phase", O.planStarted().phase === "planning");

const planPayload = { ok: true, planId: "p".repeat(24), command: "node x --a &amp; b", apply: "node y", estimate: "₹0", diff: "no file changes", output: "line one\nline &lt;two&gt;", notes: "", receipt: { kind: "month.closed" }, humanRun: true };
const planned = O.planSettled(planPayload);
check("planSettled: an ok plan is held, its text unescaped and its output split into lines",
  planned.phase === "planned" && planned.plan.command === "node x --a & b" && planned.plan.output.length === 2 && planned.plan.output[1] === "line <two>", JSON.stringify(planned));
const refused = O.planSettled({ ok: false, refusal: { exit: 4, stderr: "arc-pnl: gate RED &amp; blocked", stdout: "NO-RAILS" } });
check("planSettled: a refused plan keeps the tool's own words, unescaped", refused.phase === "plan-refused" && refused.refusal.exit === 4 && refused.refusal.stderr[0] === "arc-pnl: gate RED & blocked" && refused.refusal.stdout[0] === "NO-RAILS");
check("callFailed: a door refusal keeps its code and its sentence", (() => { const s = O.callFailed({ code: "BAD_INPUT", human: "Month is required" }); return s.phase === "error" && s.code === "BAD_INPUT" && s.human === "Month is required"; })());
check("callFailed: a thrown non-door error still says something", O.callFailed(new Error("fetch failed")).human === "fetch failed");

// ---- applying ----
check("applyBlocked: nothing to run before a plan", /plan it first/.test(O.applyBlocked(close, O.IDLE, true, null) || ""));
check("applyBlocked: a human-run op waits for the tick", /tick the confirmation/.test(O.applyBlocked(close, planned, false, null) || ""));
check("applyBlocked: with the face scrubbed to a past day, no op runs", /showing 2026-08-01/.test(O.applyBlocked(close, planned, true, "2026-08-01") || ""));
check("applyBlocked: planned, confirmed, live -> Run is on", O.applyBlocked(close, planned, true, null) === null);
check("applyBlocked: an op that is not human-run needs no tick", O.applyBlocked(idea, O.planSettled({ ...planPayload, humanRun: false }), false, null) === null);
check("applyArgs: a confirmed human-run op sends its own id as the confirmation", JSON.stringify(O.applyArgs(close, planned.plan, true)) === JSON.stringify({ planId: "p".repeat(24), confirm: "money.close-month" }));
check("applyArgs: an unconfirmed human-run op sends none (the door then refuses)", O.applyArgs(close, planned.plan, false).confirm === null);
check("applyArgs: an op that is not human-run never sends one, ticked or not", O.applyArgs(idea, planned.plan, true).confirm === null);
const applying = O.applyStarted(planned);
check("applyStarted: a planned card starts applying and keeps its plan", applying.phase === "applying" && applying.plan.planId === planned.plan.planId);
check("applyStarted: from any other phase it changes nothing", O.applyStarted(O.IDLE) === O.IDLE);
check("polling: the dock reads the run while applying or running, and only then", O.polling(applying) && !O.polling(planned) && !O.polling(O.IDLE));

// ---- the run ----
const running = O.runSettled(applying, { planId: "p".repeat(24), state: "running", lines: [{ s: "out", t: "step &amp; one" }], linesDropped: 0, result: null });
check("runSettled: a run still going streams its lines, unescaped", running.phase === "running" && running.run.lines[0].t === "step & one" && O.runVerdict(running.run) === "running");
check("runSettled: an answer for ANOTHER plan changes nothing", O.runSettled(applying, { planId: "q".repeat(24), state: "done", lines: [], result: { ok: true } }) === applying);
const done = O.runSettled(running, { planId: "p".repeat(24), state: "done", lines: [], linesDropped: 0, result: { ok: true, exit: 0, receipt: { id: "01M2W8JR7SJF15ZFXYZXKZN0HK", kind: "month.closed", ts: "t", outcome: "ok" } } });
check("runSettled + runVerdict: a finished run with its receipt names it", done.phase === "done" && O.runVerdict(done.run) === "done -- month.closed 01M2W8JR7SJF15ZFXYZXKZN0HK");
const noReceipt = O.runSettled(running, { planId: "p".repeat(24), state: "done", lines: [], result: { ok: false, exit: 0, receipt: null, noReceipt: "the tool exited 0 and no new month.closed is on the spine" } });
check("runVerdict: exit 0 with no receipt is said as that, never as success", /^no receipt -- the tool exited 0/.test(O.runVerdict(noReceipt.run)));
const partial = O.runSettled(running, { planId: "p".repeat(24), state: "done", lines: [], result: { ok: false, exit: 1, receipt: { id: "R", kind: "run.completed", ts: "t", outcome: "partial" }, refusal: { exit: 1, stderr: "arc-bench: 1 attempt left no receipt", stdout: "" } } });
check("runVerdict: a refusal quotes the tool's first line, and names a receipt it still wrote", /^refused -- exit 1: arc-bench: 1 attempt left no receipt \(it still wrote run.completed R\)$/.test(O.runVerdict(partial.run)), O.runVerdict(partial.run));
const failedApply = O.applyFailed(planned, { code: "CONFIRM_REQUIRED", human: "money.close-month is human-run" });
check("applyFailed: the plan stays on the card with the door's refusal under it", failedApply.phase === "planned" && failedApply.plan.planId === planned.plan.planId && /^CONFIRM_REQUIRED: /.test(failedApply.error || ""));
check("applyFailed: with no plan held it is a plain error", O.applyFailed(O.IDLE, { code: "X", human: "y" }).phase === "error");

console.log(`RAN: ${ran} checks, ${failed} failed`);
process.exit(failed === 0 && ran > 30 ? 0 : 1);
