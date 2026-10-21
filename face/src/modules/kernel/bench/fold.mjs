// fold.mjs -- kernel/bench: every decision the bench room makes, where node can import it with no install
// (face v2 Phase 03, ADR-1320, ADR-1324, ADR-1326).
//
// The port of v0.7's Bench onto the door. What is real: the bench lane's header, the run.completed
// receipts grouped by the driver that ran them, the promotion proposals counted, and -- through /api/bench
// (Phase 04) -- every scored bench run, class by class, with NO PROPOSAL drawn as the result it is. Which run
// was the champion is not recorded on any receipt, so the table never labels one. Running a model and proposing a
// promotion from a run's evidence are the room's ops (face v2 Phase 05, ADR-1339, ADR-1340): the ops dock draws them.
import { asArray, asObject, field, servedRead, servedTable } from "../../../lib/served.mjs";
import { fmtInt } from "../../../lib/inbox.mjs";
import { countedOn, hasKind, kindCount, laneBadge, laneKpi, laneRoom, roomLink, runsBy } from "../../../lib/lane-room.mjs";

/** @typedef {import("../../../lib/registry.mjs").Payload} Payload */

/**
 * @typedef {import("../../../lib/lane-room.mjs").LaneRoom & {
 *   badge: string,
 *   kpis: { key: string, v: string, l: string, sub: string }[],
 *   scorecards: import("../../../lib/served.mjs").ServedTable,
 *   bench: BenchTable,
 *   drivers: import("../../../lib/lane-room.mjs").RunRow[],
 *   showDriversEmpty: boolean,
 *   policy: { canOpen: boolean, room: string },
 * }} Folded
 */

/**
 * @typedef {{ key: string, label: string, status: string, title: string, color: string, border: string, background: string }} ClassChip
 * @typedef {{ key: string, when: string, subject: string, outcome: string, chips: ClassChip[], showNoClass: boolean }} BenchRow
 * @typedef {{ route: string, availability: string, failure: string | undefined, isReading: boolean, isRefused: boolean,
 *   refusal: { code: string, human: string }, showEmpty: boolean, empty: string, isDrawn: boolean, showHead: boolean,
 *   columns: string[], rows: BenchRow[], note: string, source: string, showNote: boolean, showSource: boolean,
 *   showToggle: boolean, toggleLabel: string, toggleValue: string }} BenchTable
 */

/** How many runs the bench table draws before it folds the rest behind "show all". */
export const BENCH_ROWS = 8;

/** One task class of one run, as a chip: its name, a short status, and the bench's full sentence as the title.
 * @param {Record<string, unknown>} k @param {number} i @returns {ClassChip} */
export function classChip(k, i) {
  const name = field(k, "task_class") || `class ${i + 1}`;
  const reason = field(k, "reason");
  const isEligible = k["eligible"] === true;
  const isProposing = isEligible && k["proposes"] === true;
  const status = isProposing ? "proposes" : isEligible ? "eligible" : shortReason(reason);
  const full = isEligible ? `${name}: ${status}` : `${name}: ${reason || "not eligible"}`;
  const tone = isProposing
    ? { color: "var(--accent)", border: "1px solid var(--accent-line)", background: "var(--accent-wash)" }
    : isEligible
      ? { color: "var(--text-2)", border: "1px solid var(--line-2)", background: "var(--bg-2)" }
      : { color: "var(--text-3)", border: "1px solid var(--line-1)", background: "transparent" };
  return { key: `${name}-${i}`, label: name, status, title: full, ...tone };
}

/** The bench's NO PROPOSAL sentence, said short: "no proposal 1/5" from "NO PROPOSAL - evidence insufficient (1 of 5 fixtures)".
 * @param {string} reason @returns {string} */
export function shortReason(reason) {
  const text = reason.trim();
  if (text === "") return "not eligible";
  const frac = text.match(/(\d+)\s*(?:of|\/)\s*(\d+)/);
  const isNoProposal = /no proposal/i.test(text);
  const [first = text] = text.split(/\s*[:(]\s*|\s+[-–—]\s+/);
  const head = isNoProposal ? "no proposal" : first.toLowerCase();
  const short = head.length > 24 ? `${head.slice(0, 23)}…` : head;
  const [, got = "", of = ""] = frac ?? [];
  return frac ? `${short} ${got}/${of}` : short;
}

/**
 * The bench table as the View draws it: chips per class, and at most BENCH_ROWS runs unless the owner picked "all".
 * @param {import("../../../lib/served.mjs").ServedTable} t @param {import("../../../lib/registry.mjs").FoldContext} ctx
 * @returns {BenchTable}
 */
export function benchTable(t, ctx) {
  const picks = ctx.picks ?? {};
  const isAll = picks.runs === "all";
  /** @type {BenchRow[]} */
  const all = t.rows.map((r) => {
    const x = /** @type {Record<string, unknown>} */ (/** @type {unknown} */ (r));
    return {
      key: r.key,
      when: typeof x["when"] === "string" ? x["when"] : r.cells[0] ?? "",
      subject: typeof x["subject"] === "string" ? x["subject"] : r.cells[1] ?? "",
      outcome: typeof x["outcome"] === "string" ? x["outcome"] : r.cells[2] ?? "",
      chips: Array.isArray(x["chips"]) ? /** @type {ClassChip[]} */ (x["chips"]) : [],
      showNoClass: x["showNoClass"] === true,
    };
  });
  const isLong = all.length > BENCH_ROWS;
  return {
    route: t.route,
    availability: t.avail.availability,
    failure: t.avail.failure || undefined,
    isReading: t.isReading,
    isRefused: t.isRefused,
    refusal: t.refusal,
    showEmpty: t.showEmpty,
    empty: t.empty,
    isDrawn: t.isDrawn,
    showHead: t.isDrawn && all.length > 0,
    columns: t.columns,
    rows: isAll ? all : all.slice(0, BENCH_ROWS),
    note: t.note,
    source: t.source,
    showNote: t.note !== "",
    showSource: t.source !== "",
    showToggle: isLong,
    toggleLabel: isAll ? `show the latest ${BENCH_ROWS}` : `show all ${fmtInt(all.length)}`,
    toggleValue: isAll ? "" : "all",
  };
}

/**
 * @param {Record<string, Payload>} payloads
 * @param {import("../../../lib/registry.mjs").FoldContext} ctx
 * @returns {Folded}
 */
export function fold(payloads, ctx) {
  const base = laneRoom(payloads, ctx);
  const runsHomed = hasKind(base, "run.completed");
  const drivers = runsHomed ? runsBy(base.trail.events, "driver", ["process", "model", "duration_ms"], base.trail.isPartial) : [];
  const st = servedRead(payloads, ctx, base.reads, "/api/bench");
  const scorecards = servedTable(st, {
    panel: "The bench",
    route: "/api/bench",
    columns: ["run", "subject", "outcome", "per task class"],
    listKey: "runs",
    empty: "No bench run has been scored on this spine.",
    row: (r) => {
      const id = field(r, "id");
      const chips = asArray(r["classes"]).map((c, i) => classChip(asObject(c), i));
      const when = `${field(r, "ts").slice(0, 16)} · ${id.slice(-6)}`;
      const subject = `${field(r, "subject")}${field(r, "model") !== "" ? ` (${field(r, "model")})` : ""}`;
      // NO PROPOSAL is a result, drawn in the bench's own words -- never an empty cell: the chip says it short, its title in full.
      return id === "" ? null : { key: id, cells: [when, subject, field(r, "outcome"), chips.map((k) => k.title).join(" · ") || "no class scored"], when, subject, outcome: field(r, "outcome"), chips, showNoClass: chips.length === 0 };
    },
    note: "each row is one scored run, from its run.completed receipt; which run is the champion is not written to any receipt, so no row is labelled one",
  });
  return {
    ...base,
    badge: laneBadge(base),
    kpis: [
      laneKpi(base),
      { key: "runs", v: kindCount(base, "run.completed"), l: "Runs completed", sub: countedOn(base, "run.completed") },
      { key: "drivers", v: runsHomed && base.trail.isDrawn ? `${fmtInt(drivers.length)}${base.trail.isPartial ? "+" : ""}` : "—", l: "Drivers seen", sub: runsHomed ? countedOn(base, "a driver named by a run receipt") : "the registry homes no run receipt here" },
      { key: "proposed", v: kindCount(base, "promotion.proposed"), l: "Promotions proposed", sub: countedOn(base, "promotion.proposed") },
    ],
    scorecards,
    bench: benchTable(scorecards, ctx),
    drivers,
    showDriversEmpty: runsHomed && base.trail.isDrawn && drivers.length === 0,
    policy: roomLink(ctx, "model-policy"),
  };
}
