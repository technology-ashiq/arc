// sessions.mjs -- the session door, on the face's side (face v2 Phase 06; REQ-08 · ADR-1326).
//
// Every decision the session dock makes lives here, where node can import it with no install: which session verbs a
// room carries, whether its Start button is live, what a start sends, and what an attached run shows. The dock
// (shell/SessionDock.tsx) runs the effects and draws.
//
// THE RULE THIS FILE EXISTS TO HOLD: a session starts from the owner's click and from nothing else. Nothing here
// starts one; `startBody` is the only thing that shapes a start, and the dock makes its one start call from its Start
// button's handler alone. Mounting the room, reloading it and attaching to a run are reads (door.sessions,
// door.sessionRun) -- and the browser flow counts the door's start requests across all three to prove it (0).
//
// The door owns the truth: whether a verb is shippable, what its command is, whether a receipt landed. A refusal is
// shown in the door's own words.

import { unescapeDoorText } from "./door.mjs";

/** @typedef {import("./ops.mjs").OpField} OpField */
/**
 * @typedef {{ id: string, label: string, process: string, receiptKind: string, fields: OpField[], droppedFields: number, spends: boolean,
 *   ready: boolean, why: string, pickProcess: boolean }} SessionCard
 * @typedef {{ sid: string, session: string, state: string, startedAt: number }} RunRow
 * @typedef {{ id: string, kind: string, ts: string }} SessionReceipt
 * @typedef {{ sid: string, state: string, lines: string[], linesDropped: number, bytesDropped: number, receipts: SessionReceipt[],
 *   unattributed: string[], note: string, branchMoved: string, command: string, done: boolean }} SessionRun
 * @typedef {{ phase: "idle" } | { phase: "starting" } | { phase: "error", code: string, human: string } |
 *   { phase: "attached", run: SessionRun }} SessionState
 */

/** How often an attached, running session is read again. */
export const SESSION_POLL_MS = 1500;
/** @type {SessionState} */
export const SESSION_IDLE = Object.freeze({ phase: "idle" });
/** The states after which a run's answer no longer changes. "unknown" and "running" are read again. */
const FINAL = new Set(["done", "ended", "stale"]);

/** @param {unknown} v */
const text = (v) => unescapeDoorText(typeof v === "string" ? v : "");

/**
 * The session verbs THIS room carries, from the door's registry (GET /api/sessions). A verb the door says is not
 * shippable is a card that says why, never a button that starts something the door will refuse.
 * @param {string} roomId @param {unknown} registry @returns {SessionCard[]}
 */
export function sessionCards(roomId, registry) {
  const rows = registry && typeof registry === "object" && Array.isArray(/** @type {any} */ (registry).sessions) ? /** @type {any[]} */ (/** @type {any} */ (registry).sessions) : [];
  // A row the door served malformed is skipped, and a malformed field is dropped and counted -- never a throw at render,
  // which would take down every room the dock mounts under (attack a320d86 B11).
  const isField = (/** @type {any} */ f) => f !== null && typeof f === "object" && !Array.isArray(f) && typeof f.name === "string" && f.name !== "";
  return rows.filter((r) => r && typeof r === "object" && r.room === roomId && typeof r.id === "string" && (r.fields === undefined || Array.isArray(r.fields))).map((r) => {
    const ready = r.processReady === true;
    const all = Array.isArray(r.fields) ? r.fields : [];
    const good = all.filter(isField);
    return {
      id: r.id, label: text(r.label), process: typeof r.process === "string" ? r.process : "",
      receiptKind: r.receipt && typeof r.receipt.kind === "string" ? r.receipt.kind : "",
      spends: r.spends === true, pickProcess: r.pickProcess === true, ready,
      why: ready ? "" : r.confirmStep ? `stops for your confirmation before its ${text(r.confirmStep)} step -- not shippable until that stop is enforced` : `processes/${text(r.process)}.process.yaml is not on this tree yet -- not shippable`,
      droppedFields: all.length - good.length,
      fields: good.map((/** @type {any} */ f) => ({
        name: String(f.name), label: text(f.label), placeholder: text(f.placeholder),
        type: f.type === "select" || f.type === "int" ? f.type : "text",
        options: Array.isArray(f.options) ? f.options.map(String) : [],
        required: f.required === true,
        maxBytes: Number.isInteger(f.max) && f.max > 0 ? f.max : 0,
      })),
    };
  });
}

/** The drivers the door offers, "auto" first. @param {unknown} registry @returns {string[]} */
export function driverChoices(registry) {
  const d = registry && typeof registry === "object" && Array.isArray(/** @type {any} */ (registry).drivers) ? /** @type {any[]} */ (/** @type {any} */ (registry).drivers).filter((x) => typeof x === "string") : [];
  return d.length ? d : ["auto"];
}

/** The recent runs of this room's verbs, newest first, from the same registry read. @param {string} roomId @param {unknown} registry @returns {RunRow[]} */
export function roomRuns(roomId, registry) {
  const ids = new Set(sessionCards(roomId, registry).map((c) => c.id));
  const runs = registry && typeof registry === "object" && Array.isArray(/** @type {any} */ (registry).runs) ? /** @type {any[]} */ (/** @type {any} */ (registry).runs) : [];
  return runs.filter((r) => r && ids.has(r.session) && typeof r.sid === "string")
    .map((r) => ({ sid: r.sid, session: r.session, state: String(r.state || ""), startedAt: typeof r.startedAt === "number" ? r.startedAt : 0 }));
}

/**
 * Why Start is not live, or null. A courtesy -- the door's refusal is the authority.
 * @param {SessionCard} card @param {Record<string, string>} values @param {string} process
 */
export function startBlocked(card, values, process) {
  if (!card.ready) return card.why;
  if (card.pickProcess && !process) return "pick the process to dispatch";
  const missing = card.fields.filter((f) => f.required && !(typeof values[f.name] === "string" && values[f.name] !== ""));
  return missing.length ? `fill in ${missing.map((f) => f.label).join(", ")}` : null;
}

/**
 * What a start sends, beside the click token the door client fetches itself: the fields the owner typed (empty ones
 * left out, nothing trimmed -- the door refuses edge whitespace in its own words), the driver, and dispatch's process.
 * @param {SessionCard} card @param {Record<string, string>} values @param {string} driver @param {string} process
 */
export function startBody(card, values, driver, process) {
  /** @type {Record<string, string>} */
  const input = {};
  for (const f of card.fields) { const v = values[f.name]; if (typeof v === "string" && v !== "") input[f.name] = v; }
  return { input, driver: driver || "auto", ...(card.pickProcess ? { process } : {}) };
}

/** A door refusal as the card shows it. @param {any} err @returns {SessionState} */
export function sessionFailed(err) {
  const code = err && typeof err.code === "string" ? err.code : "UNREACHABLE";
  const human = err && typeof err.human === "string" ? err.human : (err && typeof err.message === "string" ? err.message : "the door did not answer");
  return { phase: "error", code, human: text(human) };
}

/**
 * An attached run, as the card draws it: the door's lines, its state and note, the receipts it credited and the ids it
 * would not. `done` says no further read can change it.
 * @param {any} p the body of GET /api/session-run/:sid @returns {SessionRun}
 */
export function sessionRunView(p) {
  const state = p && typeof p.state === "string" ? p.state : "unknown";
  const moved = p && p.branchMoved && typeof p.branchMoved === "object" ? `the checkout moved from ${text(p.branchMoved.from)} to ${text(p.branchMoved.to)} while this ran` : "";
  return {
    sid: p && typeof p.sid === "string" ? p.sid : "",
    state,
    lines: Array.isArray(p && p.lines) ? p.lines.map((/** @type {unknown} */ l) => text(l)) : [],
    linesDropped: p && typeof p.linesDropped === "number" ? p.linesDropped : 0,
    bytesDropped: p && typeof p.bytesDropped === "number" ? p.bytesDropped : 0,
    receipts: Array.isArray(p && p.receipts) ? p.receipts.filter((/** @type {any} */ r) => r && typeof r.id === "string").map((/** @type {any} */ r) => ({ id: r.id, kind: text(r.kind), ts: text(r.ts) })) : [],
    unattributed: Array.isArray(p && p.unattributed) ? p.unattributed.filter((/** @type {unknown} */ x) => typeof x === "string") : [],
    note: text(p && p.note),
    branchMoved: moved,
    command: Array.isArray(p && p.command) ? p.command.map((/** @type {unknown} */ a) => text(a)).join(" ") : "",
    done: FINAL.has(state),
  };
}

/** Is an attached run still worth reading again? @param {SessionState} st */
export function sessionPolling(st) {
  return st.phase === "attached" && !st.run.done;
}

/** Refusals that no later read can change: the run is gone, or never was this door's. */
const TERMINAL = new Set(["UNKNOWN_RUN", "BAD_RUN_ID", "RUN_OUTSIDE", "UNAUTHORIZED", "BAD_TOKEN"]);
/** @param {string} code */
export function terminalRefusal(code) { return TERMINAL.has(code); }

/**
 * The wait before the next read of an attached run: the base interval, doubled per failed read in a row, capped --
 * a door that stopped answering is not asked every 1.5 s forever (attack a320d86 B13).
 * @param {number} failures
 */
export function pollDelay(failures) {
  const n = Math.max(0, Math.min(Number.isInteger(failures) ? failures : 0, 5));
  return Math.min(SESSION_POLL_MS * 2 ** n, 30_000);
}

/** The run's state, in the owner's words. @param {SessionRun} run */
export function sessionVerdict(run) {
  if (run.state === "running") return "running -- its lines stream in as it writes them";
  if (run.state === "done") return run.receipts.length ? `ended; ${run.receipts.length} receipt(s) read back off the spine` : "ended with no receipt credited to it";
  if (run.state === "stale") return `stale -- ${run.note}`;
  if (run.state === "ended") return `ended -- ${run.note}`;
  return run.note || "reading it again";
}
