// fold.mjs -- company/learn: every decision the learn room makes, where node can import it with no install
// (face v2 Phase 03, company ring, ADR-1320, ADR-1324).
//
// The port of v0.7's Learn onto the door. What is real: the two files the learning loop writes -- the retro log, one
// line per pattern that must not repeat, and the trial ledger, the evidence a gate is promoted on -- by their
// provenance through the door; the command and the concepts the registry homes here; and the way to the evolve room,
// where the retro is generalised into experiments; and -- through /api/learn (Phase 04) -- the playbook's rules, read
// from the retro log by the memory lane's own adapter. What is still NOT SERVED: the jurors' calibration, because no
// receipt or file records a verdict per juror (the council's calibration is per confidence bucket, and is drawn in the
// council chamber), and the sleeping queue, which is prose in the plans index that no parser reads.
// v0.7's champion/challenger preview was a simulated experiment; the real ones are the evolve room's.
import { notServed } from "../../../lib/registry.mjs";
import { asArray, field, projected, servedRead, servedTable } from "../../../lib/served.mjs";

/** How many rules the panel draws, newest first; the note says how many there are in all. */
const RULE_ROWS = 20;
import { holdsCount, laneRoom, roomLink } from "../../../lib/lane-room.mjs";

/** @typedef {import("../../../lib/registry.mjs").Payload} Payload */

/**
 * @typedef {import("../../../lib/lane-room.mjs").LaneRoom & {
 *   badge: string,
 *   kpis: { key: string, v: string, l: string, sub: string }[],
 *   rules: import("../../../lib/served.mjs").ServedTable,
 *   calibration: import("../../../lib/registry.mjs").NotServed,
 *   sleeping: import("../../../lib/registry.mjs").NotServed,
 *   evolve: { canOpen: boolean, room: string, line: string },
 *   loop: string[],
 * }} Folded
 */

/**
 * @param {Record<string, Payload>} payloads
 * @param {import("../../../lib/registry.mjs").FoldContext} ctx
 * @returns {Folded}
 */
export function fold(payloads, ctx) {
  const base = laneRoom(payloads, ctx, { files: ["retro-log", "trial-ledger"] });
  /** @param {string} id */
  const size = (id) => {
    const s = base.sources.find((x) => x.id === id);
    return s !== undefined && s.isRead ? s.size : "—";
  };
  const evolve = roomLink(ctx, "evolve");
  const st = servedRead(payloads, ctx, base.reads, "/api/learn");
  const all = asArray(st.body["rules"]).length;
  return {
    ...base,
    badge: "the learning loop · files, not log",
    kpis: [
      { key: "retro", v: size("retro-log"), l: "The retro log", sub: "one line per pattern · its size, as served" },
      { key: "trial", v: size("trial-ledger"), l: "The trial ledger", sub: "the evidence a gate is promoted on" },
      { key: "concepts", v: holdsCount(base, "concepts"), l: "Concepts", sub: "homed here by the registry" },
      { key: "rules", v: st.isRead ? String(all) : "—", l: "Playbook rules", sub: st.isRead ? "lessons in the retro log" : "reading /api/learn" },
    ],
    rules: servedTable(projected(st, "rules", (b) => (Array.isArray(b["rules"]) ? b["rules"].slice(-RULE_ROWS).reverse() : undefined)), {
      panel: "Playbook rules",
      route: "/api/learn",
      columns: ["logged", "the pattern", "the rule it became"],
      listKey: "rules",
      empty: "The retro log holds no rule yet.",
      row: (r) => {
        const id = field(r, "id");
        return id === "" ? null : { key: id, cells: [field(r, "date"), field(r, "pattern"), field(r, "prevention")] };
      },
      note: [
        st.isRead ? `the newest ${Math.min(RULE_ROWS, all)} of ${all}` : "",
        "recall over them is a search, and a search is a verb of the work door",
      ].filter((n) => n !== "").join(" · "),
    }),
    calibration: notServed(
      "Juror calibration",
      "/api/learn",
      "Each council juror's hit rate, Brier-scored against how the verdict turned out, and the weight that earns it -- no figure at all below the scoring floor. No receipt or file records a verdict per juror: the council's calibration is per confidence bucket, drawn in the council chamber -- filed to the evolve lane.",
    ),
    sleeping: notServed(
      "The sleeping queue",
      "/api/learn",
      "Every capability asleep until something pulls it, and the alarm that would wake it -- earn before build (A8), an alarm rather than a deadline. The queue is prose in docs/strategy/plans/README.md, and no parser reads it -- filed to the plan lane.",
    ),
    evolve: { canOpen: evolve.canOpen, room: evolve.room, line: "The retro, generalised: measure, a weekly scoreboard, bounded experiments, and a winner promoted only by a reviewed diff and your stamp." },
    loop: [
      "A correction given once is a note; given twice, it is a retro-log line (/arc-retro).",
      "A line that recurs becomes a rule, and a rule becomes a gate that can fail -- never a sentence someone has to remember.",
      "A gate is promoted from WARN to FAIL only on trial-ledger evidence (A1).",
    ],
  };
}
