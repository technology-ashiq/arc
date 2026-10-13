// fold.mjs -- money/discover: every decision the discover room makes, where node can import it with no install
// (face v2 Phase 17, REQ-21, ADR-1356; first ported as a planned room in Phase 03, ADR-1328).
//
// The discover lane was born (ADR-1900) and writes real receipts, so this room stopped being planned: no dotted line, no
// REHEARSAL card. It reads ONE door route, GET /api/discover, which selects discover's receipts through discover's own
// constants -- this fold never spells the winner gate or the process, so there is no second grammar here. What it shows:
// the ideas captured, the last hunt and the last judge, and each winner the lane proposed with its state. A spine day the
// door could not read makes every figure unknown, naming the day, never 0; a spine with no discover receipt says no hunt
// has run yet. Running a hunt stays /arc-hunt: the room reads, and its ops.mjs is empty.
import { asArray, asObject, cell, field, servedRead, servedTable } from "../../../lib/served.mjs";
import { fmtInt } from "../../../lib/inbox.mjs";

/** @typedef {import("../../../lib/registry.mjs").Payload} Payload */

/**
 * @typedef {object} Folded
 * @property {string} sentence
 * @property {string} lede
 * @property {string} badge
 * @property {{ key: string, v: string, l: string, sub: string }[]} kpis
 * @property {import("../../../lib/served.mjs").ServedTable} winners
 * @property {boolean} showNoHunt
 * @property {string} noHunt
 * @property {string[]} rules
 * @property {import("../../../lib/registry.mjs").Read[]} reads
 */

/** @param {unknown} v @returns {Record<string, unknown> | null} */
const orNull = (v) => (v === null || v === undefined ? null : asObject(v));

/**
 * One run as a figure: its day, "none yet" when the lane never ran it, "—" when not read.
 * @param {boolean} isRead @param {Record<string, unknown> | null} run
 */
const runFigure = (isRead, run) => (!isRead ? "—" : run === null ? "none yet" : field(run, "day"));
/** @param {boolean} isRead @param {Record<string, unknown> | null} run @param {string} what */
const runSub = (isRead, run, what) => (!isRead ? "not on this read" : run === null ? `no ${what} has run` : `outcome ${field(run, "outcome") || "unstated"} · ⌗ ${field(run, "id").slice(-6)}`);

/**
 * @param {Record<string, Payload>} payloads
 * @param {import("../../../lib/registry.mjs").FoldContext} ctx
 * @returns {Folded}
 */
export function fold(payloads, ctx) {
  /** @type {import("../../../lib/registry.mjs").Read[]} */
  const reads = [];
  const st = servedRead(payloads, ctx, reads, "/api/discover");
  // The door read the spine and could not open a day: nothing here is counted, and the panel says which day. Drawn as a
  // refusal so the table's availability is unknown (REQ-19), never a zero.
  const unknown = st.isRead && field(st.body, "availability") === "unknown";
  const days = asArray(st.body["unreadable"]).map(cell).filter((d) => d !== "");
  const shown = unknown
    ? { ...st, isRead: false, isRefused: true, refusal: { code: field(st.body, "failure") || "UNREADABLE_DAY", human: `the door could not read the spine day(s) ${days.join(", ") || "it did not name"}, so no figure here is counted` } }
    : st;
  const isRead = shown.isRead;
  const captures = asObject(st.body["captures"]);
  const runs = asObject(st.body["runs"]);
  const hunt = orNull(runs["hunt"]);
  const judge = orNull(runs["judge"]);
  const winnerRows = asArray(st.body["winners"]).map(asObject);
  const open = winnerRows.filter((w) => field(w, "state") === "open").length;
  const latest = orNull(captures["latest"]);
  const captureCount = typeof captures["count"] === "number" ? captures["count"] : null;
  const droppedRaw = st.body["droppedTotal"];
  const skipped = typeof droppedRaw === "number" && Number.isFinite(droppedRaw) ? droppedRaw : 0;
  const room = ctx.room;
  return {
    sentence: String(room.sentence ?? ""),
    lede: String(room.lede ?? ""),
    badge: "discover's own receipts",
    kpis: [
      { key: "captured", v: isRead && captureCount !== null ? fmtInt(captureCount) : "—", l: "Ideas captured", sub: !isRead ? "not on this read" : latest === null ? "none yet" : `latest ${field(latest, "day")} · ${field(latest, "source_id") || "no source named"}` },
      { key: "hunt", v: runFigure(isRead, hunt), l: "Last hunt", sub: runSub(isRead, hunt, "hunt") },
      { key: "judge", v: runFigure(isRead, judge), l: "Last judge", sub: runSub(isRead, judge, "judge") },
      { key: "open", v: isRead ? fmtInt(open) : "—", l: "Winners waiting for you", sub: isRead ? `of ${fmtInt(winnerRows.length)} proposed` : "not on this read" },
    ],
    winners: servedTable(shown, {
      panel: "Winners",
      route: "/api/discover",
      owner: "discover",
      columns: ["venture", "score", "its tokens", "state", "your decision"],
      listKey: "winners",
      empty: "No winner has been proposed yet.",
      // What the door skipped is said, by count: a receipt it could not read is never a quietly shorter list.
      note: skipped > 0 ? `${fmtInt(skipped)} discover receipt(s) the door could not read are not counted here` : "",
      row: (w) => {
        const d = orNull(w["decision"]);
        const tokens = asArray(w["cluster_tokens"]).map(cell).filter((t) => t !== "").join(", ");
        return field(w, "id") === "" ? null : {
          key: field(w, "id"),
          cells: [field(w, "slug"), cell(w["score"]) || "unscored", tokens || "none named", field(w, "state"), d === null ? "not decided" : `${field(d, "verdict")} -- ${field(d, "reason")}`],
        };
      },
    }),
    showNoHunt: isRead && hunt === null && captureCount === 0 && winnerRows.length === 0,
    noHunt: "No hunt has run yet. Run /arc-hunt to capture pains; this room reads what it records and never runs one itself.",
    rules: [
      "A pain with too little distribution never reaches the shortlist: flagged, not argued with.",
      "A duplicate pain is refused at capture, not merged later.",
      "The shortlist is exactly two. The council debates them; you stamp one.",
      "A kickoff is a separate venture: its own repo and its own kill criteria, one-pager first.",
    ],
    reads,
  };
}
