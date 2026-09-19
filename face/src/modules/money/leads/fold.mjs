// fold.mjs -- money/leads: every decision the leads room makes, where node can import it with no install
// (face v2 Phase 03, ADR-1320, ADR-1324, ADR-1326).
//
// The port of v0.7's Leads onto the door. What is real: the leads lane's header and the funnel's receipts the
// registry homes here, counted by kind on the page the door sent -- researched, sent, replied, booked, won, lost,
// suppressed -- in the funnel's order. No lead is named on this screen: the lane keys a lead by an HMAC id and
// never a raw contact. Through /api/leads (Phase 04), folded by the leads lane's own guard: each lead by its HMAC id
// with its touches in the rolling window, the caps against today's sends, and the suppressed. The lane's state fold
// keeps a suppressed lead's id and not why or since when, and records no stage beyond sent, replied and suppressed,
// so the panels say that instead of inventing either. Researching, sending, moving a lead along and suppressing one
// are verbs of the work door (Phase 05).
import { verbPending } from "../../../lib/registry.mjs";
import { asArray, asObject, cell, field, projected, servedRead, servedTable } from "../../../lib/served.mjs";
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
 *   moveVerb: { isVerbPending: true, verb: string, sentence: string },
 *   suppressVerb: { isVerbPending: true, verb: string, sentence: string },
 *   byLead: import("../../../lib/served.mjs").ServedTable,
 *   caps: import("../../../lib/served.mjs").ServedTable,
 *   ledger: import("../../../lib/served.mjs").ServedTable,
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
  const st = servedRead(payloads, ctx, base.reads, "/api/leads");
  const capsBody = asObject(st.body["caps"]);
  const sends = asObject(st.body["sendsToday"]);
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
    // A refused or unread trail counted nothing: the note says so rather than describing a page that never came.
    funnelNote: base.trail.isRefused
      ? `Nothing is counted: ${base.trail.refusal.human}.`
      : base.trail.isUnread
        ? "Nothing is counted: the registry's kinds for this room were not read."
        : base.trail.isReading
          ? "Reading the funnel's receipts from the door."
          : base.trail.isPartial
            ? "Counted on the oldest page of receipts the door sent, with more past it: each count is that page's, never all time."
            : "Counted on the page of receipts the door sent. A receipt is a step one lead took, so a lead that moved twice is counted in two columns.",
    researchVerb: verbPending(
      "Research a lead",
      "lead.researched, with its geography riding on it for the jurisdiction guard, keyed by an HMAC id and never a raw contact. It arrives with the work door.",
    ),
    // "Send today's outreach" is LIVE since face v2 Phase 05 (ADR-1344): the work door's leads.daily-send op, drawn
    // under this room by the host, bound to the plan the owner read. Its card is retired.
    moveVerb: verbPending(
      "Move a lead along the funnel",
      "Mark a reply, book a meeting, record a win or a loss -- each a receipt, and a reply stops every later touch at once. It arrives with the work door.",
    ),
    suppressVerb: verbPending(
      "Suppress a lead",
      "lead.suppressed is honoured at once and survives every campaign: a suppressed lead is never contacted again, and there is no way to reset it.",
    ),
    byLead: servedTable(st, {
      panel: "The funnel by lead",
      route: "/api/leads",
      columns: ["lead, by its HMAC id", "where it stands", "touches in the window", "last touch"],
      listKey: "leads",
      empty: "No lead has been touched, replied or suppressed on this spine.",
      row: (l) => {
        const id = field(l, "lead_id");
        const after = typeof l["afterNow"] === "number" ? l["afterNow"] : 0;
        const unreadable = typeof l["unreadable"] === "number" ? l["unreadable"] : 0;
        // Suppressed outranks everything, then a reply; a touch stamped after the door's clock is what the guard refuses
        // as clock skew, and is said so -- never counted as a touch outside the window (Phase 04 attack).
        const stands = l["suppressed"] === true ? "suppressed" : l["replied"] === true ? "replied"
          : after > 0 ? `refused by the guard: ${after} touch${after === 1 ? "" : "es"} stamped after the door's clock`
            : unreadable > 0 ? `refused by the guard: ${unreadable} touch${unreadable === 1 ? "" : "es"} with no readable time` : "sent to";
        return id === "" ? null : { key: id, cells: [id, stands, `${cell(l["inWindow"])} of ${cell(capsBody["touches_per_lead"]) || "?"} · ${cell(l["touches"])} in all`, field(l, "last").slice(0, 16) || "never touched"] };
      },
      note: [
        `the window is the last ${cell(capsBody["rolling_window_days"]) || "?"} days; the lane's own fold records sent, replied and suppressed, and no later stage`,
        typeof st.body["idsWithheld"] === "number" && st.body["idsWithheld"] > 0 ? `${cell(st.body["idsWithheld"])} receipt id${st.body["idsWithheld"] === 1 ? "" : "s"} that are not an HMAC lead id withheld -- a lead is never shown by anything else` : "",
      ].filter((n) => n !== "").join(" · "),
    }),
    caps: servedTable(projected(st, "rows", (b) => {
      const c = asObject(b["caps"]);
      const t = asObject(b["sendsToday"]);
      if (!Object.hasOwn(c, "per_ist_day")) return undefined;
      return [
        { cap: "sends per IST day", value: c["per_ist_day"], today: `${cell(t["real"])} real · ${cell(t["rehearsal"])} rehearsal` },
        { cap: "touches per lead", value: c["touches_per_lead"], today: "per lead, in the funnel above" },
        { cap: "rolling window", value: `${cell(c["rolling_window_days"])} days`, today: "" },
      ];
    }), {
      panel: "The caps",
      route: "/api/leads",
      columns: ["cap", "from the config", "today"],
      listKey: "rows",
      empty: "The leads config carries no cap.",
      row: (r) => (field(r, "cap") === "" ? null : { key: field(r, "cap"), cells: [field(r, "cap"), cell(r["value"]), field(r, "today") || "—"] }),
      note: st.isRead ? [
        `today is ${field(st.body, "today")} in IST; the caps come from ${field(st.body, "capsFrom") || "an unnamed source"}`,
        `${cell(sends["unmarked"])} send${sends["unmarked"] === 1 ? "" : "s"} carried no rehearsal mark and counted as real`,
        // The lane counts an unplaceable send in EVERY window, today's included, so an unreadable time never escapes a
        // cap (guard.mjs foldSends); the note says it is IN today's figures, not beside them (Phase 04 re-attack).
        typeof sends["unplaceable"] === "number" && sends["unplaceable"] > 0 ? `${cell(sends["unplaceable"])} of today's sends ha${sends["unplaceable"] === 1 ? "s" : "ve"} no placeable time: the lane counts ${sends["unplaceable"] === 1 ? "it" : "them"} in every window, today's included, so no unreadable time escapes a cap` : "",
      ].filter((n) => n !== "").join(" · ") : "",
    }),
    ledger: servedTable(projected(st, "rows", (b) => (Array.isArray(b["suppressed"]) ? b["suppressed"].map((id) => ({ lead_id: id })) : undefined)), {
      panel: "Suppression ledger",
      route: "/api/leads",
      columns: ["suppressed lead, by its HMAC id"],
      listKey: "rows",
      empty: "No lead is suppressed on this spine.",
      row: (r) => (field(r, "lead_id") === "" ? null : { key: field(r, "lead_id"), cells: [field(r, "lead_id")] }),
      note: [
        st.isRead ? `${cell(st.body["bounces"])} bounce${st.body["bounces"] === 1 ? "" : "s"} and ${cell(st.body["complaints"])} spam complaint${st.body["complaints"] === 1 ? "" : "s"} on the spine` : "",
        "why and since when are on each lead.suppressed receipt, and the lane's state fold keeps only the id",
      ].filter((n) => n !== "").join(" · "),
    }),
    guard: [
      "Caps, suppression and jurisdiction are checked at the moment of use, not at the moment of approval.",
      "A reply stops every later touch automatically.",
      "Sends stay inside the send window the lane's concepts name.",
      "A first bounce holds the lead; a spam complaint freezes sending and raises an incident.",
    ],
  };
}
