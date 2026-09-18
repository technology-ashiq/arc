// fold.mjs -- money/trader: every decision the trader room makes, where node can import it with no install
// (face v2 Phase 03, ADR-1320, ADR-1328).
//
// The port of v0.7's Trader, a PLANNED room -- and the room Cycle 15's sweep caught wearing `● LIVE` (F3):
// its pill measured whether a kind it homes had fired, and day.closed fires company-wide every day. This fold
// reads no receipt at all. The planned line, the seals and what takes the room over come from the
// planned-rooms registry; v0.7's question, strategy, backtest and verdict flows are REHEARSAL cards that write
// nothing, because real-money trading is ungrantable and the trader lane is not born.
import { rehearsal } from "../../../lib/registry.mjs";
import { fmtInt } from "../../../lib/inbox.mjs";
import { plannedFigure, plannedKinds, plannedRoom } from "../../../lib/planned-room.mjs";

/** @typedef {import("../../../lib/registry.mjs").Payload} Payload */

/**
 * @typedef {import("../../../lib/planned-room.mjs").PlannedRoom & {
 *   kpis: { key: string, v: string, l: string, sub: string }[],
 *   flows: { isRehearsal: true, verb: string, sentence: string }[],
 *   why: string[],
 * }} Folded
 */

/**
 * @param {Record<string, Payload>} payloads
 * @param {import("../../../lib/registry.mjs").FoldContext} ctx
 * @returns {Folded}
 */
export function fold(payloads, ctx) {
  const base = plannedRoom(payloads, ctx);
  const flows = [
    rehearsal(
      "Open a question",
      "question.opened: a strategy exists to answer a question, never the other way round. Rehearsed on paper; the trader lane is not born.",
    ),
    rehearsal(
      "Register a strategy in the playground",
      "strategy.registered, exploratory: it can be thrown away without a retro, and it names a paper market only.",
    ),
    rehearsal(
      "Pin a snapshot and backtest it",
      "A pinned snapshot, a backtest, and the honesty battery -- no lookahead, no survivorship, costs included. Paper numbers, and a failed check keeps a strategy on paper.",
    ),
    rehearsal(
      "Record a verdict",
      "CONTINUE or DORMANT, each with a typed reason, and thirty paper days before either. No verdict places an order.",
    ),
  ];
  return {
    ...base,
    kpis: [
      plannedFigure(base, "stations", "Stations on the planned line", "line", "planned-rooms.json · none has run"),
      { key: "flows", v: fmtInt(flows.length), l: "Flows rehearsed here", sub: "each says REHEARSAL · none writes" },
      plannedFigure(base, "seals", "Sealed on this page", "seals", "no control exists for these"),
      plannedKinds(base),
    ],
    flows,
    why: [
      "Real-money trading is ungrantable at every level: no capability, no tier and no stamp in this app can hand it to a process.",
      "The only unlock is a written rule change and a cooldown, with a review-by date -- an amendment, not a toggle. Until that text exists, every number on this page is paper and says so.",
      "A backtest with a failed honesty check cannot leave paper. Thirty paper days end in CONTINUE or DORMANT, never in an order.",
    ],
  };
}
