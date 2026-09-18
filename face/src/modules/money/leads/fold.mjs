// fold.mjs -- money/leads: every decision the leads room makes, where node can import it with no install
// (face v2 Phase 03, ADR-1320, ADR-1324, ADR-1326).
//
// The port of v0.7's Leads onto the door. What is real: the leads lane's header and the funnel's receipts the
// registry homes here, counted by kind on the page the door sent -- researched, sent, replied, booked, won, lost,
// suppressed -- in the funnel's order. No lead is named on this screen: the lane keys a lead by an HMAC id and
// never a raw contact, and a per-lead view is the door's to fold. What is not served: each lead in its stage,
// the caps against today's sends, and the suppression ledger, which /api/leads will fold. Researching, sending,
// moving a lead along and suppressing one are verbs of the work door (Phase 05).
import { notServed, verbPending } from "../../../lib/registry.mjs";
import { countedOn, hasKind, kindCount, laneBadge, laneKpi, laneRoom } from "../../../lib/lane-room.mjs";

/** @typedef {import("../../../lib/registry.mjs").Payload} Payload */

/**
 * The funnel, in the order a lead moves through it: each stage's kind, and the word the column wears.
 * @type {ReadonlyArray<readonly [string, string]>}
 */
const FUNNEL = Object.freeze([
  ["lead.researched", "researched"],
  ["outreach.sent", "contacted"],
  ["outreach.replied", "replied"],
  ["meeting.booked", "meeting"],
  ["deal.won", "won"],
  ["deal.lost", "lost"],
  ["lead.suppressed", "suppressed"],
]);

/**
 * @typedef {import("../../../lib/lane-room.mjs").LaneRoom & {
 *   badge: string,
 *   kpis: { key: string, v: string, l: string, sub: string }[],
 *   funnel: { key: string, stage: string, kind: string, v: string, isHomed: boolean }[],
 *   funnelNote: string,
 *   researchVerb: { isVerbPending: true, verb: string, sentence: string },
 *   sendVerb: { isVerbPending: true, verb: string, sentence: string },
 *   moveVerb: { isVerbPending: true, verb: string, sentence: string },
 *   suppressVerb: { isVerbPending: true, verb: string, sentence: string },
 *   byLead: import("../../../lib/registry.mjs").NotServed,
 *   caps: import("../../../lib/registry.mjs").NotServed,
 *   ledger: import("../../../lib/registry.mjs").NotServed,
 *   guard: string[],
 * }} Folded
 */

/**
 * @param {Record<string, Payload>} payloads
 * @param {import("../../../lib/registry.mjs").FoldContext} ctx
 * @returns {Folded}
 */
export function fold(payloads, ctx) {
  const base = laneRoom(payloads, ctx);
  return {
    ...base,
    badge: laneBadge(base),
    kpis: [
      laneKpi(base),
      { key: "sent", v: kindCount(base, "outreach.sent"), l: "Outreach sent", sub: countedOn(base, "outreach.sent") },
      { key: "replied", v: kindCount(base, "outreach.replied"), l: "Replies", sub: countedOn(base, "outreach.replied") },
      { key: "won", v: kindCount(base, "deal.won"), l: "Deals won", sub: countedOn(base, "deal.won") },
      { key: "suppressed", v: kindCount(base, "lead.suppressed"), l: "Suppressed", sub: countedOn(base, "lead.suppressed") },
    ],
    // A stage whose kind the registry does not home here was never asked for: it reads unread, never zero.
    funnel: FUNNEL.map(([kind, stage]) => ({ key: kind, stage, kind, v: kindCount(base, kind), isHomed: hasKind(base, kind) })),
    funnelNote: base.trail.isPartial
      ? "Counted on the oldest page of receipts the door sent, with more past it: each count is that page's, never all time."
      : "Counted on the page of receipts the door sent. A receipt is a step one lead took, so a lead that moved twice is counted in two columns.",
    researchVerb: verbPending(
      "Research a lead",
      "lead.researched, with its geography riding on it for the jurisdiction guard, keyed by an HMAC id and never a raw contact. It arrives with the work door.",
    ),
    sendVerb: verbPending(
      "Send today's outreach",
      "A capped daily send, confirmed by your keystroke: approval authorises a send attempt, never a send, and the caps, suppression and jurisdiction are checked at the moment of use.",
    ),
    moveVerb: verbPending(
      "Move a lead along the funnel",
      "Mark a reply, book a meeting, record a win or a loss -- each a receipt, and a reply stops every later touch at once. It arrives with the work door.",
    ),
    suppressVerb: verbPending(
      "Suppress a lead",
      "lead.suppressed is honoured at once and survives every campaign: a suppressed lead is never contacted again, and there is no way to reset it.",
    ),
    byLead: notServed(
      "The funnel by lead",
      "/api/leads",
      "Each lead in its current stage with its touches in the rolling window, folded by the leads lane from its own receipts and keyed by its HMAC id, never a raw contact.",
    ),
    caps: notServed(
      "The caps",
      "/api/leads",
      "The daily send cap and the per-lead touch cap from the leads config, against today's sends counted from receipts -- values in config, enforcement in code, nothing to reset.",
    ),
    ledger: notServed(
      "Suppression ledger",
      "/api/leads",
      "Every suppressed lead, why, and since when -- event-backed and derived, with no way to reset it. A suppressed lead lands here and never leaves.",
    ),
    guard: [
      "Caps, suppression and jurisdiction are checked at the moment of use, not at the moment of approval.",
      "A reply stops every later touch automatically.",
      "Sends stay inside the send window the lane's concepts name.",
      "A first bounce holds the lead; a spam complaint freezes sending and raises an incident.",
    ],
  };
}
