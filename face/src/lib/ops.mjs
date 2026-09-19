// ops.mjs -- the work door, on the face's side (face v2 Phase 05; ADR-1326 · ADR-1339 · REQ-07).
//
// Every decision the ops dock makes lives here, where node can import it with no install: which of a room's op ids
// the door serves, what a card holds at each step, what the plan card and the run card say, and what apply sends.
// shell/OpsDock.tsx runs the effects -- the door calls and the poll -- and draws what these functions return.
//
// The door owns the truth. Nothing here validates a field the door would accept, builds a command, estimates a cost or
// decides that a run worked: a plan's command, estimate and diff are the door's words; a run's receipt is what the door
// read off the spine. A refusal is shown in the tool's own words (ADR-1326: "a tool's own guard refuses in its own
// words and the face renders that verbatim").

import { unescapeDoorText } from "./door.mjs";

/** @typedef {{ name: string, label: string, placeholder: string, type: "text" | "select" | "int", options: string[], required: boolean, maxBytes: number }} OpField */
/**
 * @typedef {{ id: string, state: "loading" } | { id: string, state: "absent", why: string } |
 *   { id: string, state: "ready", label: string, hint: string, humanRun: boolean, spends: boolean, touchesFiles: boolean, touchesOs: boolean, touchesTree: boolean, receiptKind: string, fields: OpField[] }} OpCard
 */
/**
 * @typedef {{ planId: string, command: string, apply: string, estimate: string, diff: string, output: string[], notes: string[], outputDropped: number, receiptKind: string, humanRun: boolean }} PlanView
 * @typedef {{ exit: number | null, stderr: string[], stdout: string[], dropped: number }} RefusalView
 * @typedef {{ id: string, kind: string, ts: string, outcome: string }} ReceiptView
 * @typedef {{ state: string, lines: { s: string, t: string }[], linesDropped: number, bytesDropped: number, done: boolean, ok: boolean, receipt: ReceiptView | null, refusal: RefusalView | null, noReceipt: string, error: string }} RunView
 * @typedef {{ phase: "idle" } | { phase: "planning" } | { phase: "planned", plan: PlanView, error?: string } |
 *   { phase: "plan-refused", refusal: RefusalView } | { phase: "error", code: string, human: string } |
 *   { phase: "applying", plan: PlanView } | { phase: "running", plan: PlanView, run: RunView } | { phase: "done", plan: PlanView, run: RunView }} OpState
 */

/** @param {unknown} v @returns {string} */
const text = (v) => unescapeDoorText(typeof v === "string" ? v : "");
/** @param {unknown} v @returns {string[]} */
const lines = (v) => text(v).split(/\r?\n/).filter((l) => l !== "");

/**
 * The dock's cards: the op ids a module names in its ops.mjs, each matched to the door's registry row. A room that
 * names an op the door does not serve says so on the card -- it is never a button that plans nothing.
 * @param {readonly unknown[]} moduleOps @param {unknown} registry  the body of GET /api/ops, or null while it loads
 * @returns {OpCard[]}
 */
export function opCards(moduleOps, registry) {
  const ids = (Array.isArray(moduleOps) ? moduleOps : []).filter((x) => typeof x === "string");
  const rows = registry && typeof registry === "object" && Array.isArray(/** @type {any} */ (registry).ops) ? /** @type {any[]} */ (/** @type {any} */ (registry).ops) : null;
  return ids.map((id) => {
    if (rows === null) return { id, state: "loading" };
    const row = rows.find((r) => r && r.id === id);
    if (!row) return { id, state: "absent", why: `this room names ${id}, and the door does not serve it` };
    return {
      id, state: "ready",
      label: text(row.label), hint: text(row.hint),
      humanRun: row.humanRun === true, spends: row.spends === true,
      // An effect past the spine, said on the card before the owner plans (ADR-1340): a proposal branch, or the scheduler.
      touchesFiles: row.touchesFiles === true, touchesOs: row.touchesOs === true, touchesTree: row.touchesTree === true,
      receiptKind: row.receipt && typeof row.receipt.kind === "string" ? row.receipt.kind : "",
      fields: (Array.isArray(row.fields) ? row.fields : []).map((/** @type {any} */ f) => ({
        name: String(f.name), label: text(f.label), placeholder: text(f.placeholder),
        type: f.type === "select" || f.type === "int" ? f.type : "text",
        options: Array.isArray(f.options) ? f.options.map(String) : [],
        required: f.required === true,
        // A text field's cap is in BYTES (the door's unit on the wire and in the receipt); 0 = no cap to show.
        maxBytes: (f.type === "select" || f.type === "int") ? 0 : (Number.isInteger(f.max) && f.max > 0 ? f.max : 0),
      })),
    };
  });
}

/** @type {OpState} */
export const IDLE = Object.freeze({ phase: "idle" });

/**
 * The fields a plan sends: every field the card names, trimmed of nothing (the door refuses edge whitespace itself, and
 * a client that trimmed would send something other than what the owner typed), empty ones left out.
 * @param {OpCard} card @param {Record<string, string>} values
 */
export function planInput(card, values) {
  /** @type {Record<string, string>} */
  const out = {};
  if (card.state !== "ready") return out;
  for (const f of card.fields) {
    const v = values[f.name];
    if (typeof v === "string" && v !== "") out[f.name] = v;
  }
  return out;
}

/**
 * A text field's size as the owner types it, in the door's unit. The cap is bytes, and 110 Tamil letters are 330 of
 * them: with no count on screen the owner met "longer than 300 bytes" having typed 110 characters (face v2 Phase 05
 * round-2 logic attack). Empty when the field has no cap to show.
 * @param {OpField} field @param {string | undefined} value
 */
export function fieldCount(field, value) {
  if (!field.maxBytes) return "";
  const bytes = new TextEncoder().encode(typeof value === "string" ? value : "").length;
  return bytes > field.maxBytes ? `${bytes} / ${field.maxBytes} bytes -- over the cap` : `${bytes} / ${field.maxBytes} bytes`;
}

/**
 * Why the plan button is not live yet, or null. A courtesy only -- required fields left empty -- because the door's
 * refusal is the authority and says more.
 * @param {OpCard} card @param {Record<string, string>} values
 */
export function planBlocked(card, values) {
  if (card.state !== "ready") return card.state === "absent" ? card.why : "the door's op list is still loading";
  const missing = card.fields.filter((f) => f.required && !(typeof values[f.name] === "string" && values[f.name] !== ""));
  return missing.length ? `fill in ${missing.map((f) => f.label).join(", ")}` : null;
}

/** @param {any} r @returns {RefusalView} */
function refusalView(r) {
  return { exit: r && typeof r.exit === "number" ? r.exit : null, stderr: lines(r && r.stderr), stdout: lines(r && r.stdout), dropped: r && typeof r.dropped === "number" ? r.dropped : 0 };
}

/** @param {any} p @returns {PlanView} */
function planView(p) {
  return {
    planId: String(p.planId), command: text(p.command), apply: text(p.apply),
    estimate: text(p.estimate), diff: text(p.diff),
    output: lines(p.output), notes: lines(p.notes),
    outputDropped: typeof p.outputDropped === "number" ? p.outputDropped : 0,
    receiptKind: p.receipt && typeof p.receipt.kind === "string" ? p.receipt.kind : "",
    humanRun: p.humanRun === true,
  };
}

/** @returns {OpState} */
export function planStarted() { return { phase: "planning" }; }

/**
 * What a plan answer means for the card: a held plan, or the tool's refusal in its own words.
 * @param {any} payload the body of POST /api/op/:id/plan @returns {OpState}
 */
export function planSettled(payload) {
  if (payload && payload.ok === true && typeof payload.planId === "string") return { phase: "planned", plan: planView(payload) };
  return { phase: "plan-refused", refusal: refusalView(payload && payload.refusal) };
}

/**
 * A door refusal (a DoorError, or anything thrown) as the card shows it: the door's code and its sentence.
 * @param {any} err @returns {{ code: string, human: string }}
 */
export function refusalOf(err) {
  const code = err && typeof err.code === "string" ? err.code : "UNREACHABLE";
  const human = err && typeof err.human === "string" ? err.human : (err && typeof err.message === "string" ? err.message : "the door did not answer");
  return { code, human: text(human) };
}

/** @param {any} err @returns {OpState} */
export function callFailed(err) { return { phase: "error", ...refusalOf(err) }; }

/**
 * The body apply sends: the plan id, and -- only for a human-run op the owner confirmed -- the op's own id as the
 * confirmation the door requires. An unconfirmed human-run op sends none, and the door refuses it.
 * @param {OpCard} card @param {PlanView} plan @param {boolean} confirmed
 * @returns {{ planId: string, confirm: string | null }}
 */
export function applyArgs(card, plan, confirmed) {
  return { planId: plan.planId, confirm: card.state === "ready" && card.humanRun && confirmed ? card.id : null };
}

/**
 * Why the apply button is not live, or null.
 * @param {OpCard} card @param {OpState} st @param {boolean} confirmed @param {string | null} asOf
 */
export function applyBlocked(card, st, confirmed, asOf) {
  if (st.phase !== "planned") return "plan it first, and read the plan";
  // An op runs NOW. With the face scrubbed to a past day the owner is reading history, and a click that changes the
  // present from that view is the wrong affordance.
  if (asOf) return `the face is showing ${asOf}; ops run on today -- return to live to run one`;
  if (card.state === "ready" && card.humanRun && !confirmed) return "this op is human-run: tick the confirmation first";
  return null;
}

/** @param {OpState} st @returns {OpState} */
export function applyStarted(st) {
  return st.phase === "planned" ? { phase: "applying", plan: st.plan } : st;
}

/** @param {any} run @returns {RunView} */
function runView(run) {
  const r = run && run.result && typeof run.result === "object" ? run.result : null;
  const receipt = r && r.receipt && typeof r.receipt === "object"
    ? { id: String(r.receipt.id), kind: String(r.receipt.kind), ts: String(r.receipt.ts), outcome: String(r.receipt.outcome) }
    : null;
  return {
    state: String(run && run.state), done: run && run.state === "done",
    lines: (Array.isArray(run && run.lines) ? run.lines : []).map((/** @type {any} */ l) => ({ s: l && l.s === "err" ? "err" : "out", t: text(l && l.t) })),
    linesDropped: run && typeof run.linesDropped === "number" ? run.linesDropped : 0,
    bytesDropped: run && typeof run.bytesDropped === "number" ? run.bytesDropped : 0,
    ok: r !== null && r.ok === true,
    receipt,
    refusal: r && r.refusal ? refusalView(r.refusal) : null,
    noReceipt: r && typeof r.noReceipt === "string" ? text(r.noReceipt) : "",
    error: r && typeof r.error === "string" ? `${r.error}: ${text(r.message)}` : "",
  };
}

/**
 * A run answer (from apply, a replay, or the poll) folded into the card. Only a run of THIS card's plan is taken: a
 * late poll for an older plan must not overwrite a newer one.
 * @param {OpState} st @param {any} run @returns {OpState}
 */
export function runSettled(st, run) {
  if (!("plan" in st) || !run || run.planId !== st.plan.planId) return st;
  const view = runView(run);
  return view.done ? { phase: "done", plan: st.plan, run: view } : { phase: "running", plan: st.plan, run: view };
}

/**
 * An apply the door refused (no confirmation, an expired plan): the plan stays on the card with the refusal under it.
 * Only for the plan it was sent for -- a late refusal of an older plan must not land under a newer one.
 * @param {OpState} st @param {any} err @param {string} planId  the plan the refused apply was for @returns {OpState}
 */
export function applyFailed(st, err, planId) {
  if ("plan" in st && st.plan.planId !== planId) return st;
  // An apply is only ever sent from a card holding a plan, so a refusal reaching a card with NONE is late by
  // construction: the card moved on (planning again, a plan refused, cleared) and the refusal is not its news. It
  // replaced the tool's own refusal with a stale error (face v2 Phase 05 round-2 logic attack).
  if (!("plan" in st)) return st;
  const r = refusalOf(err);
  return { phase: "planned", plan: st.plan, error: `${r.code}: ${r.human}` };
}

/** Whether the dock should read the run again. @param {OpState} st */
export const polling = (st) => st.phase === "applying" || st.phase === "running";

/** The poll's pace: fast enough to read as live, slow enough not to crowd the door. */
export const RUN_POLL_MS = 700;

/**
 * The one line a finished run ends on. A receipt is named by its kind and id; a refusal quotes the tool's first line;
 * exit 0 with no receipt is said as exactly that, never as success.
 * @param {RunView} run
 */
export function runVerdict(run) {
  if (!run.done) return "running";
  if (run.ok && run.receipt) return `done -- ${run.receipt.kind} ${run.receipt.id}`;
  if (run.error) return `failed -- ${run.error}`;
  if (run.noReceipt) return `no receipt -- ${run.noReceipt}`;
  const first = run.refusal ? (run.refusal.stderr[0] || run.refusal.stdout[run.refusal.stdout.length - 1] || "") : "";
  const tail = run.receipt ? ` (it still wrote ${run.receipt.kind} ${run.receipt.id})` : "";
  return `refused -- exit ${run.refusal ? run.refusal.exit : "?"}${first ? `: ${first}` : ""}${tail}`;
}
