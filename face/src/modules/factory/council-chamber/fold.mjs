// fold.mjs -- factory/council-chamber: every decision the council room makes, where node can import it
// with no install (face v2 Phase 03, ADR-1320, ADR-1322, ADR-1324, ADR-1326).
//
// The port of v0.7's Council onto the door. What is real: the council receipts the registry homes here,
// counted by kind and drawn as a trail, and the twelve seats -- which are the agents the served registry
// homes in this room, not a list typed here. Through /api/council (Phase 04): the verdict ledger -- each call
// with its confidence and, once recorded, its outcome -- and the calibration the evolve lane measures from them,
// which reports no figure below its scoring floor. A verdict's points, dissent and review-by date live in the
// session files, which only a lint that cannot be imported reads, so the ledger says so rather than inventing
// them. Convening a council and scoring a call are work-door verbs (Phase 05).
//
// ADR-1322: the council renders in the accent and dim, and violet stays the non-real class -- no seat,
// verdict or score wears a reserved colour here.
import { verbPending } from "../../../lib/registry.mjs";
import { asObject, cell, field, projected, servedRead, servedTable } from "../../../lib/served.mjs";
import { countedOn, holdsCount, kindCount, laneBadge, laneRoom } from "../../../lib/lane-room.mjs";

/** @typedef {import("../../../lib/registry.mjs").Payload} Payload */

/**
 * @typedef {import("../../../lib/lane-room.mjs").LaneRoom & {
 *   badge: string,
 *   kpis: { key: string, v: string, l: string, sub: string }[],
 *   convene: { isVerbPending: true, verb: string, sentence: string },
 *   ledger: import("../../../lib/served.mjs").ServedTable,
 *   calibration: import("../../../lib/served.mjs").ServedTable,
 *   seats: { key: string, name: string }[],
 *   hasSeats: boolean,
 *   seatsNote: string,
 * }} Folded
 */

/**
 * @param {Record<string, Payload>} payloads
 * @param {import("../../../lib/registry.mjs").FoldContext} ctx
 * @returns {Folded}
 */
export function fold(payloads, ctx) {
  const base = laneRoom(payloads, ctx);
  // Each seat once, and an unreadable list is not an empty one (Phase 03 attack).
  const seatsUnread = base.unreadable.includes("agents");
  const seats = [...new Set(base.held.agents ?? [])].map((name) => ({ key: name, name }));
  const st = servedRead(payloads, ctx, base.reads, "/api/council");
  const cal = asObject(st.body["calibration"]);
  return {
    ...base,
    badge: laneBadge(base, `${seatsUnread ? "seats unread" : `${holdsCount(base, "agents")} seats`} · a company organ, not a lane`),
    kpis: [
      { key: "seats", v: holdsCount(base, "agents"), l: "Seats", sub: "the agents the registry homes here" },
      { key: "verdicts", v: kindCount(base, "council.verdict"), l: "Verdicts", sub: countedOn(base, "council.verdict") },
      { key: "outcomes", v: kindCount(base, "council.outcome"), l: "Outcomes scored", sub: countedOn(base, "council.outcome") },
      { key: "decisions", v: kindCount(base, "decision.recorded"), l: "Decisions recorded", sub: countedOn(base, "decision.recorded") },
    ],
    convene: verbPending(
      "Convene the council",
      "Seats argue blind and in parallel, a verifier grades every point, one bounded rebuttal follows, and the verdict commits with its dissent. Convening arrives with the work door.",
    ),
    ledger: servedTable(st, {
      panel: "The verdict ledger",
      route: "/api/council",
      columns: ["session", "the call", "confidence", "outcome"],
      listKey: "verdicts",
      empty: "No council verdict is on this spine.",
      row: (v) => {
        const id = field(v, "id");
        const outcome = field(v, "outcome");
        return id === "" ? null : { key: id, cells: [field(v, "session"), field(v, "call"), field(v, "confidence"), outcome === "" ? "not scored yet" : `${outcome}${field(v, "observed") !== "" ? ` · ${field(v, "observed").slice(0, 10)}` : ""}`] };
      },
      note: "a verdict's points, its dissent and its review-by date live in its session file, which no importable parser reads yet, so they are not drawn here",
    }),
    calibration: servedTable(projected(st, "buckets", (b) => asObject(b["calibration"])["buckets"]), {
      panel: "Calibration",
      route: "/api/council",
      columns: ["confidence", "stated", "scored", "hits"],
      listKey: "buckets",
      empty: "No confidence bucket is defined.",
      row: (b) => {
        const bucket = field(b, "bucket");
        return bucket === "" ? null : { key: bucket, cells: [bucket, cell(b["prob"]), cell(b["n"]), cell(b["hits"])] };
      },
      // In the lane's own order and with its own lines (calibrate.mjs renderCalibration): scored against the floor,
      // excluded, pending -- always, above the floor as below it -- then the figure or its absence. Round 3 drew the
      // excluded count after the figure and round 4 found the pending count dropped above the floor.
      note: st.isRead
        ? [
          `${cell(cal["scored"])} scored of a floor of ${cell(cal["floor"])}`,
          `${cell(cal["excluded"]) || "0"} excluded -- an outcome the lane does not score, NOT counted as a miss`,
          `${cell(cal["pending"]) || "0"} pending -- no outcome recorded yet`,
          cal["brier"] === null || cal["brier"] === undefined
            ? "below the floor no calibration figure is reported at all"
            : `Brier ${cell(cal["brier"])} · ${field(cal, "verdict")}`,
        ].join(" · ")
        : "",
    }),
    seats,
    hasSeats: seats.length > 0,
    seatsNote: seatsUnread
      ? "the served registry carried this room's agents in a shape this shell could not read"
      : seats.length === 0 ? "the served registry homes no agent in this room" : "",
  };
}
