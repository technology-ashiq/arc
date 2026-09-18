// fold.mjs -- money/growth: every decision the growth room makes, where node can import it with no install
// (face v2 Phase 03, ADR-1320, ADR-1324, ADR-1326).
//
// The port of v0.7's Growth onto the door. What is real: the growth lane's header, the content.published and
// metric.observed receipts the registry homes here, the published pieces counted by the channel each receipt
// names (v0.7's channel scoreboard, from the log rather than from a typed channel list), and the lints the
// registry says are on duty, and -- through /api/growth (Phase 04) -- the pipeline as the receipts carry it: each
// published piece at the head of its supersede chain (the growth lane's own chain check), and each cluster plan with
// its approval. A draft and a review pack are not receipted by the lane, so a piece enters the table at publication,
// and the panel says so. Drafting, sending the review pack and publishing are verbs of the work door (Phase 05);
// publishing under the owner's name stays a person's act for ever.
import { verbPending } from "../../../lib/registry.mjs";
import { asArray, asObject, field, projected, servedRead, servedTable } from "../../../lib/served.mjs";
import { countedBy, countedOn, hasKind, holdsCount, kindCount, laneBadge, laneKpi, laneRoom } from "../../../lib/lane-room.mjs";

/** @typedef {import("../../../lib/registry.mjs").Payload} Payload */

/**
 * @typedef {import("../../../lib/lane-room.mjs").LaneRoom & {
 *   badge: string,
 *   kpis: { key: string, v: string, l: string, sub: string }[],
 *   draftVerb: { isVerbPending: true, verb: string, sentence: string },
 *   packVerb: { isVerbPending: true, verb: string, sentence: string },
 *   publishVerb: { isVerbPending: true, verb: string, sentence: string },
 *   pipeline: import("../../../lib/served.mjs").ServedTable,
 *   channels: import("../../../lib/lane-room.mjs").CountRow[],
 *   showChannelsEmpty: boolean,
 *   channelsEmpty: string,
 *   lints: string[],
 *   showLintsEmpty: boolean,
 *   lintsEmpty: string,
 *   gates: { key: string, name: string, line: string }[],
 * }} Folded
 */

/**
 * @param {Record<string, Payload>} payloads
 * @param {import("../../../lib/registry.mjs").FoldContext} ctx
 * @returns {Folded}
 */
export function fold(payloads, ctx) {
  const base = laneRoom(payloads, ctx);
  const st = servedRead(payloads, ctx, base.reads, "/api/growth");
  const superseded = typeof st.body["superseded"] === "number" ? st.body["superseded"] : 0;
  const publishedHomed = hasKind(base, "content.published");
  const channels = publishedHomed && base.trail.isDrawn ? countedBy(base.trail.events, "content.published", "channel", base.trail.isPartial) : [];
  const lints = base.held.lints ?? [];
  // A lints list the registry carried unreadably is not "no lint in this room" beside a KPI that says unread --
  // two readers of one question (money ring attack).
  const lintsUnread = base.unreadable.includes("lints") || base.unreadable.includes("holds");
  return {
    ...base,
    badge: laneBadge(base),
    kpis: [
      laneKpi(base),
      { key: "published", v: kindCount(base, "content.published"), l: "Pieces published", sub: countedOn(base, "content.published") },
      { key: "observed", v: kindCount(base, "metric.observed"), l: "Metrics observed", sub: countedOn(base, "metric.observed") },
      { key: "lints", v: holdsCount(base, "lints"), l: "Lints on duty", sub: "the served registry's list" },
    ],
    draftVerb: verbPending(
      "Draft a piece",
      "content.drafted, with the slop lint run as you type: it catches bad patterns and never prescribes a style. It arrives with the work door.",
    ),
    packVerb: verbPending(
      "Send the review pack to your inbox",
      "Gate one: one inbox item bundling the preview, the lint results and the diff; your stamp pins the draft's sha. It arrives with the work door.",
    ),
    publishVerb: verbPending(
      "Merge and publish",
      "Gate two: a person merges, and content.published carries the sha read from the merged tree -- unedited means the approved sha and the published sha match. The machine writes the branch; it never merges.",
    ),
    pipeline: servedTable(projected(st, "rows", (b) => (Array.isArray(b["published"]) && Array.isArray(b["clusters"])
      ? [
        ...b["clusters"].map((c) => ({ ...asObject(c), stage: "cluster plan" })),
        ...b["published"].map((x) => ({ ...asObject(x), stage: "published" })),
      ]
      : undefined)), {
      panel: "The pipeline",
      route: "/api/growth",
      columns: ["piece", "stage", "status", "sha, as the receipt carries it"],
      listKey: "rows",
      empty: "No cluster plan and no published piece is on this spine.",
      row: (r) => {
        const id = field(r, "id");
        const isPiece = field(r, "stage") === "published";
        return id === "" ? null : {
          key: id,
          cells: isPiece
            ? [`${field(r, "site")}/${field(r, "slug")} · ${field(r, "title")}`, "published", field(r, "pr") || "no pr named", field(r, "content_sha").slice(0, 12)]
            : [field(r, "what") || id, "cluster plan", field(r, "verdict") === "open" ? "waiting on your stamp" : field(r, "verdict"), "—"],
        };
      },
      note: [
        superseded > 0 ? `${superseded} earlier publication${superseded === 1 ? "" : "s"} superseded by a correction, and not drawn` : "",
        "a draft and a review pack are not receipted by the growth lane, so a piece enters this table when it is published; the approved sha beside it is not recorded either",
      ].filter((n) => n !== "").join(" · "),
    }),
    channels,
    showChannelsEmpty: publishedHomed && base.trail.isDrawn && channels.length === 0,
    channelsEmpty: "No content.published receipt on the page the door sent names a channel. A channel that has never published has no receipt, so it is not listed as a zero.",
    lints,
    showLintsEmpty: lints.length === 0,
    lintsEmpty: lintsUnread
      ? "The served registry carried this room's lints in a shape this shell could not read -- unread, not none."
      : "The served registry homes no lint in this room.",
    gates: [
      { key: "gate-1", name: "gate 1 -- the review pack", line: "one inbox item bundling the preview, the lints and the diff. Your stamp pins the draft's sha." },
      { key: "gate-2", name: "gate 2 -- the merge", line: "a person merges; content.published carries the sha read from the merged tree. Unedited means the two shas match." },
    ],
  };
}
