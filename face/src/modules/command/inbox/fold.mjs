// fold.mjs -- command/inbox: every decision the one write path makes, where node can import it with
// no install (face v2 Phase 03, ADR-1320, REQ-08).
//
// The port of v0.7's Inbox onto the door. Arm, then stamp: the View picks a card and a verdict, types a
// reason, and stamps through the host; every rule about that reason is the SPINE's (inbox.mjs
// validateReason), checked here before the request leaves and again by the door, which stays the
// authority. The figures are counted from what the door serves: the open approvals, and the
// decision.recorded and approval.requested receipts on the spine.
import { payloadOf } from "../../../lib/registry.mjs";
import {
  MAX_REASON_BYTES, REASON_PLACEHOLDER, ageSentence, approvalBody, byteLength, decodeDoorText, fmtInt, readHealth,
  readInbox, readSpinePage, readStampResult, shortId, validateReason,
} from "../../../lib/inbox.mjs";
import { eventRowView, receiptView } from "../../../lib/spine.mjs";

/** The door's page cap. A log longer than a page says so rather than counting a page as the whole. */
const LOG_LIMIT = 1000;
/** How many decisions the log panel draws, newest first. */
const LOG_ROWS = 40;

/** @typedef {import("../../../lib/registry.mjs").Payload} Payload */
/** @param {Payload} p */
const refusal = (p) => (p.state === "refused" ? { code: p.code, human: p.human } : { code: "", human: "" });

/**
 * @typedef {object} Card
 * @property {string} id
 * @property {string} title
 * @property {string} gate
 * @property {string} age
 * @property {{ k: string, v: string, isJson: boolean }[]} facts
 * @property {boolean} isArmed
 * @property {boolean} isApproveArmed
 * @property {"approve" | "reject"} verdict
 * @property {string} armedLabel
 * @property {string} armedInk
 * @property {"primary" | "ghost"} stampTone
 * @property {string} edge
 *
 * @typedef {object} Folded
 * @property {string} sentence
 * @property {string} lede
 * @property {{ key: string, v: string, l: string, tone: "amber" | undefined, sub: string }[]} kpis
 * @property {{ isReading: boolean, isRefused: boolean, isZero: boolean, refusal: { code: string, human: string }, chip: string, tone: "amber" | undefined, cards: Card[] }} waiting
 * @property {{ reason: string, placeholder: string, bytes: string, bytesInk: string, isEmpty: boolean, canStamp: boolean, isStamping: boolean, stampLabel: string, hasRefusal: boolean, refusal: { code: string, human: string } }} armed
 * @property {boolean} hasStamped
 * @property {string} stamped
 * @property {{ view: string, options: { value: string, label: string }[], isWaitingView: boolean, isReading: boolean, isRefused: boolean, isEmpty: boolean, hasRows: boolean, refusal: { code: string, human: string }, rows: { id: string, short: string, time: string, label: string, ink: string, reason: string, decides: string }[], foot: string }} log
 * @property {{ isReading: boolean, hasRows: boolean, rows: { gate: string, count: string }[], foot: string }} sources
 * @property {string} lawReason
 * @property {import("../../../lib/spine.mjs").ReceiptView} receipt
 * @property {import("../../../lib/registry.mjs").Read[]} reads
 */

/**
 * @param {Record<string, Payload>} payloads  the declared routes' payloads
 * @param {import("../../../lib/registry.mjs").FoldContext} ctx
 * @returns {Folded}
 */
export function fold(payloads, ctx) {
  /** @type {Record<string, string>} */
  const picks = ctx.picks ?? {};
  const decidedRead = { route: "/api/spine", query: { kind: "decision.recorded", limit: LOG_LIMIT } };
  const raisedRead = { route: "/api/spine", query: { kind: "approval.requested", limit: LOG_LIMIT } };
  /** @type {import("../../../lib/registry.mjs").Read[]} */
  const reads = [{ route: "/api/health", poll: true }, { route: "/api/inbox", poll: true }, { ...decidedRead, poll: true }, raisedRead];

  // An approval's age is measured on the DOOR's clock, never this browser's.
  const healthP = payloadOf(payloads, { route: "/api/health" });
  const now = healthP.state === "ok" ? readHealth(healthP.data).now : "";

  const inboxP = payloadOf(payloads, { route: "/api/inbox" });
  const inbox = inboxP.state === "ok" ? readInbox(inboxP.data) : null;
  const decidedP = payloadOf(payloads, decidedRead);
  const decidedPage = decidedP.state === "ok" ? readSpinePage(decidedP.data) : null;
  const raisedP = payloadOf(payloads, raisedRead);
  const raisedPage = raisedP.state === "ok" ? readSpinePage(raisedP.data) : null;
  const decisions = decidedPage === null ? [] : decidedPage.events;
  const open = inbox === null ? [] : inbox.open;

  // What the View armed: "<approval id>|approve" or "<approval id>|reject". An id no longer open is not armed.
  const [armedId = "", armedVerdict = ""] = String(picks.armed ?? "").split("|");
  const armedOpen = open.some((a) => a.id === armedId) && (armedVerdict === "approve" || armedVerdict === "reject");
  const check = validateReason(picks.reason ?? "");

  const actP = payloadOf(payloads, { route: "/api/decide", act: true });
  /** @type {import("../../../lib/registry.mjs").ActRecord[]} */
  const acts = actP.state === "ok" && Array.isArray(actP.data) ? actP.data : [];
  const last = acts.at(-1) ?? null;
  const lastForArmed = last !== null && last.body.id === armedId ? last : null;
  const lastResult = lastForArmed === null ? null : lastForArmed.result;
  const isStamping = lastResult !== null && lastResult.state === "pending";
  const lastRefused = lastResult !== null && lastResult.state === "refused" ? lastResult : null;
  const okActs = acts.filter((a) => a.result.state === "ok");
  const lastOk = okActs.at(-1) ?? null;
  const lastOkResult = lastOk === null ? null : lastOk.result;
  const lastReceipt = lastOkResult !== null && lastOkResult.state === "ok" ? readStampResult(lastOkResult.data).receipt : null;

  const approved = decisions.filter((e) => e.payload.verdict === "approve").length;
  const reasonBytes = decisions.map((e) => byteLength(typeof e.payload.reason === "string" ? e.payload.reason : ""));
  const avgReason = reasonBytes.length === 0 ? null : Math.round(reasonBytes.reduce((a, b) => a + b, 0) / reasonBytes.length);
  const openCount = inbox === null ? null : inbox.openCount;
  const logMore = decidedPage !== null && decidedPage.more;

  const view = picks.log === "decided" ? "decided" : "waiting";
  const logRows = decisions.slice(-LOG_ROWS).reverse().map((e) => {
    const verdict = typeof e.payload.verdict === "string" ? e.payload.verdict : "";
    return {
      id: e.id, short: shortId(e.id), time: eventRowView(e).time,
      label: verdict === "approve" ? "approved" : verdict === "reject" ? "rejected" : verdict || "decided",
      // A verdict is neither money nor an incident: approve wears the product's own ink, reject plain ink (ADR-1308).
      ink: verdict === "approve" ? "var(--accent)" : "var(--text-2)",
      reason: decodeDoorText(typeof e.payload.reason === "string" ? e.payload.reason : ""),
      decides: typeof e.payload.decides === "string" ? `decides ⌗ ${shortId(e.payload.decides)}` : "",
    };
  });

  /** @type {Map<string, number>} */
  const gates = new Map();
  for (const e of raisedPage === null ? [] : raisedPage.events) {
    const gate = typeof e.payload.gate === "string" && e.payload.gate !== "" ? e.payload.gate : "(no gate named)";
    gates.set(gate, (gates.get(gate) ?? 0) + 1);
  }
  const sourceRows = [...gates.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)).map(([gate, n]) => ({ gate, count: `${fmtInt(n)} raised` }));

  const room = ctx.room;
  return {
    sentence: decodeDoorText(room.sentence),
    lede: decodeDoorText(room.lede),
    kpis: [
      { key: "waiting", v: openCount === null ? "—" : fmtInt(openCount), l: "Waiting for you", sub: openCount === null ? "not on this read" : openCount > 0 ? "arm, then stamp" : "inbox zero", tone: openCount !== null && openCount > 0 ? "amber" : undefined },
      { key: "ever", v: inbox === null || inbox.decidedCount === null ? "—" : fmtInt(inbox.decidedCount), l: "Decisions ever", sub: "decision.recorded, folded by the door", tone: undefined },
      { key: "rate", v: decisions.length === 0 ? "never-fired" : `${Math.round((approved / decisions.length) * 100)}%`, l: "Approve rate", sub: logMore ? `the first ${fmtInt(decisions.length)} decisions` : "", tone: undefined },
      { key: "reason", v: avgReason === null ? "never-fired" : `${fmtInt(avgReason)} B`, l: "Average reason", sub: "bytes · under ten is a smell", tone: undefined },
      { key: "here", v: fmtInt(okActs.length), l: "Stamped from this screen", sub: "this visit · the rest came from arc-inbox", tone: undefined },
    ],
    waiting: {
      isReading: inboxP.state === "loading",
      isRefused: inboxP.state === "refused",
      isZero: inbox !== null && open.length === 0,
      refusal: refusal(inboxP),
      chip: openCount === null ? "unread" : `${fmtInt(openCount)} waiting`,
      tone: open.length > 0 ? "amber" : undefined,
      cards: open.map((a) => {
        const isArmed = armedOpen && a.id === armedId;
        const approve = isArmed && armedVerdict === "approve";
        return {
          id: a.id,
          title: decodeDoorText(a.what),
          gate: a.gate,
          age: now === "" ? "" : ageSentence(a.ts, now),
          facts: approvalBody(a.payload).map((r) => ({ k: r.key, v: r.value, isJson: r.shape === "json" })),
          isArmed,
          isApproveArmed: approve,
          verdict: /** @type {"approve" | "reject"} */ (approve ? "approve" : "reject"),
          armedLabel: approve ? "Armed · approve" : "Armed · reject",
          armedInk: approve ? "var(--accent)" : "var(--text-1)",
          stampTone: /** @type {"primary" | "ghost"} */ (approve ? "primary" : "ghost"),
          edge: isArmed ? (approve ? "var(--accent)" : "var(--line-2)") : "var(--line-1)",
        };
      }),
    },
    armed: {
      reason: picks.reason ?? "",
      placeholder: REASON_PLACEHOLDER,
      bytes: `${fmtInt(check.bytes)} / ${fmtInt(MAX_REASON_BYTES)} bytes`,
      bytesInk: check.bytes > MAX_REASON_BYTES ? "var(--text-1)" : "var(--text-3)",
      isEmpty: check.value === "",
      canStamp: armedOpen && check.ok && !isStamping,
      isStamping,
      stampLabel: isStamping ? "Stamping…" : "Stamp",
      hasRefusal: lastRefused !== null,
      refusal: lastRefused === null ? { code: "", human: "" } : { code: lastRefused.code, human: lastRefused.human },
    },
    hasStamped: lastReceipt !== null,
    stamped: lastReceipt === null ? "" : `Stamped. The receipt is decision.recorded ⌗ ${shortId(lastReceipt)} -- read back from the spine, not assembled here.`,
    log: {
      view,
      options: [
        { value: "waiting", label: `waiting ${openCount === null ? "—" : fmtInt(openCount)}` },
        { value: "decided", label: `decided ${fmtInt(decisions.length)}${logMore ? "+" : ""}` },
      ],
      isWaitingView: view === "waiting",
      isReading: view === "decided" && decidedP.state === "loading",
      isRefused: view === "decided" && decidedP.state === "refused",
      isEmpty: view === "decided" && decidedPage !== null && decisions.length === 0,
      hasRows: view === "decided" && logRows.length > 0,
      refusal: refusal(decidedP),
      rows: logRows,
      foot: logMore ? `the first ${fmtInt(decisions.length)} decisions on the spine; the newest ${fmtInt(logRows.length)} of them here` : `${fmtInt(logRows.length)} of ${fmtInt(decisions.length)} shown, newest first`,
    },
    sources: {
      isReading: raisedP.state === "loading",
      hasRows: sourceRows.length > 0,
      rows: sourceRows,
      foot: raisedP.state === "refused" ? `${raisedP.code}: ${raisedP.human}` : "the gate each approval.requested receipt named, counted from the spine",
    },
    lawReason: `A typed reason is mandatory, at most ${fmtInt(MAX_REASON_BYTES)} bytes, one line; an empty reason cannot stamp.`,
    receipt: receiptView(decisions, picks.receipt),
    reads,
  };
}
