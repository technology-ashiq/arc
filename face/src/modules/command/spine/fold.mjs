// fold.mjs -- command/spine: every decision the log screen makes, where node can import it with no
// install (face v2 Phase 03, ADR-1320).
//
// The port of v0.7's SpineRoom onto the door. The filter is the DOOR's (`kind` and `date` on
// /api/spine), so a page is a page of what was asked for, never a page cut down in the browser; the
// families are the reserved meanings spine.mjs already assigns; the laws and the integrity figures are
// the spine's own, from spine.mjs and /api/health.
import { payloadOf } from "../../../lib/registry.mjs";
import { dayOf, decodeDoorText, fmtInt, readHealth, readSpinePage } from "../../../lib/inbox.mjs";
import { SPINE_LAWS, TONE_ORDER, eventRowView, legendRows, readSpineHealth, receiptView } from "../../../lib/spine.mjs";

/** The door's page cap. */
const PAGE = 1000;
/** How many receipts the log draws, newest first. */
const ROWS = 160;

/** @typedef {import("../../../lib/registry.mjs").Payload} Payload */

/**
 * The day before a YYYY-MM-DD, by the calendar alone -- no timezone enters, so no browser clock does.
 * @param {string} day
 */
function dayBefore(day) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!m) return "";
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) - 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

/**
 * @typedef {object} Folded
 * @property {string} sentence
 * @property {string} lede
 * @property {boolean} isSim
 * @property {string} sourceBadge
 * @property {{ key: string, v: string, l: string, sub: string }[]} kpis
 * @property {{ value: string, label: string }[]} scopes
 * @property {string} scope
 * @property {{ value: string, label: string }[]} families
 * @property {string} family
 * @property {{ isReading: boolean, isRefused: boolean, isEmpty: boolean, hasRows: boolean, refusal: { code: string, human: string }, rows: import("../../../lib/spine.mjs").EventRowView[], hint: string, foot: string }} log
 * @property {{ key: string, ink: string, label: string }[]} legend
 * @property {{ adr: string, title: string, law: string }[]} laws
 * @property {{ key: string, title: string, text: string }[]} integrity
 * @property {string} source
 * @property {import("../../../lib/spine.mjs").ReceiptView} receipt
 * @property {import("../../../lib/registry.mjs").Read[]} reads
 */

/**
 * @param {Record<string, Payload>} payloads
 * @param {import("../../../lib/registry.mjs").FoldContext} ctx
 * @returns {Folded}
 */
export function fold(payloads, ctx) {
  /** @type {Record<string, string>} */
  const picks = ctx.picks ?? {};
  /** @type {import("../../../lib/registry.mjs").Read[]} */
  const reads = [{ route: "/api/health", poll: true }];
  const healthP = payloadOf(payloads, { route: "/api/health" });
  const health = healthP.state === "ok" ? readHealth(healthP.data) : null;
  const spineHealth = healthP.state === "ok" ? readSpineHealth(healthP.data) : null;
  const legend = legendRows(spineHealth);

  const today = health === null ? "" : dayOf(health.now);
  const family = TONE_ORDER.some((t) => t === picks.family) ? String(picks.family) : "all";
  const familyRow = legend.find((l) => l.tone === family) ?? null;
  const kinds = familyRow === null ? [] : familyRow.kinds;
  const neverFired = health !== null && family !== "all" && kinds.length === 0;

  /**
   * The read for one scope, or null when there is nothing to ask the door for: a family whose kinds never
   * fired (an empty kind would read the whole log and call it filtered), or a day before the door's clock is read.
   * @param {string} scope
   */
  const readFor = (scope) => {
    if (health === null || neverFired || (scope !== "start" && today === "")) return null;
    /** @type {Record<string, string | number>} */
    const query = { limit: PAGE };
    if (scope === "today") query.date = today;
    if (scope === "yesterday") query.date = dayBefore(today);
    if (family !== "all") query.kind = kinds.join(",");
    return { route: "/api/spine", query };
  };
  /** @param {import("../../../lib/registry.mjs").Read | null} read @returns {Payload} */
  const payloadFor = (read) => (read === null ? (healthP.state === "refused" ? healthP : { state: "loading" }) : payloadOf(payloads, read));

  // A day the owner picked is the day shown. With no pick, today leads -- and a today with no receipt yet falls
  // back to the log's first page, SAID in the hint, rather than opening the log on an empty screen.
  const picked = picks.scope === "today" || picks.scope === "yesterday" || picks.scope === "start" ? picks.scope : null;
  const firstRead = readFor(picked ?? "today");
  if (firstRead !== null) reads.push(firstRead);
  const firstP = payloadFor(firstRead);
  const firstPage = firstP.state === "ok" ? readSpinePage(firstP.data) : null;
  const fellBack = picked === null && firstPage !== null && firstPage.events.length === 0;
  const scope = fellBack ? "start" : picked ?? "today";
  const logRead = fellBack ? readFor("start") : firstRead;
  if (fellBack && logRead !== null) reads.push(logRead);
  const logP = fellBack ? payloadFor(logRead) : firstP;
  const page = logP.state === "ok" ? readSpinePage(logP.data) : null;
  const events = page === null ? [] : page.events;
  const rows = (scope === "start" ? events.slice(0, ROWS) : events.slice(-ROWS)).slice().reverse().map(eventRowView);

  const scopeLabel = fellBack
    ? `today (${today}) has no receipt yet, so the log's first page`
    : scope === "today" ? `today (${today})` : scope === "yesterday" ? `yesterday (${dayBefore(today)})` : "from the start of the log";
  const quarantined = spineHealth === null ? null : spineHealth.quarantine.total;
  const torn = spineHealth === null || !spineHealth.tornRead ? null : spineHealth.tornLines.length;
  // A day FILE the reader could not open is damage the torn list cannot show, and "every line of every day file
  // parsed" over it was the lie round 3 fixed in a helper this room never called (round 4). A door that does not say
  // is unknown, never zero.
  const unopened = spineHealth === null ? null : spineHealth.unreadableDays;
  const tornText = torn === null ? "The door did not report torn lines this read." : [
    torn > 0 ? `${fmtInt(torn)} line${torn === 1 ? " is" : "s are"} UNREADABLE and reported, never skipped.`
      : unopened === 0 ? "Every line of every day file parsed on this read." : "Every line that was read parsed on this read.",
    unopened !== null && unopened > 0 ? `${fmtInt(unopened)} day file${unopened === 1 ? "" : "s"} could not be opened at all -- ${unopened === 1 ? "its" : "their"} receipts are on disk and counted nowhere.` : "",
    unopened === null ? "The door did not say whether every day file opened." : "",
  ].filter((s) => s !== "").join(" ");

  return {
    sentence: decodeDoorText(ctx.room.sentence),
    lede: decodeDoorText(ctx.room.lede),
    isSim: ctx.mode === "sim",
    sourceBadge: health === null ? "spine unread" : ctx.mode === "sim" ? `fixture spine · ${fmtInt(health.events ?? 0)} events` : `real spine · ${fmtInt(health.events ?? 0)} events · read-only`,
    kpis: [
      { key: "shown", v: fmtInt(rows.length), l: "Events shown", sub: "newest first, under this filter" },
      { key: "total", v: health === null || health.events === null ? "—" : fmtInt(health.events), l: "Events on the spine", sub: "counted by the door on every read" },
      { key: "families", v: fmtInt(TONE_ORDER.length), l: "Kind families", sub: "reserved meanings, one ink each" },
      { key: "kinds", v: health === null || health.kindsSeen === null ? "—" : fmtInt(health.kindsSeen), l: "Kinds ever fired", sub: "the closed vocabulary, in use" },
    ],
    scopes: [
      { value: "today", label: "today" },
      { value: "yesterday", label: "yesterday" },
      { value: "start", label: "from the start" },
    ],
    scope,
    families: [{ value: "all", label: "all kinds" }, ...legend.map((l) => ({ value: l.tone, label: l.label }))],
    family,
    log: {
      isReading: logP.state === "loading" && !neverFired,
      isRefused: logP.state === "refused",
      isEmpty: neverFired || (page !== null && rows.length === 0),
      hasRows: rows.length > 0,
      refusal: logP.state === "refused" ? { code: logP.code, human: logP.human } : { code: "", human: "" },
      rows,
      hint: `${scopeLabel} · newest first · ⌗ opens the receipt`,
      foot: neverFired
        ? "No kind in this family has ever fired, so there is nothing to read -- a family that never fired, not a page that failed."
        : page === null ? "" : `${fmtInt(rows.length)} of ${page.more ? "at least " : ""}${fmtInt(page.count ?? events.length)} receipt${page.count === 1 ? "" : "s"} under this filter${page.more ? " (the door pages at 1,000)" : ""}`,
    },
    legend: legend.map((l) => ({ key: l.tone, ink: l.ink, label: l.state === "never-fired" ? `${l.label} · never fired` : `${l.label} · ${fmtInt(l.count)} kind${l.count === 1 ? "" : "s"}` })),
    laws: SPINE_LAWS.map((l) => ({ adr: l.adr, title: l.title, law: l.law })),
    integrity: [
      { key: "replay", title: "Replay determinism", text: "Delete every derived view, replay the log, byte-identical state. CI proves it on the spine's own suite." },
      { key: "quarantine", title: "Quarantine", text: quarantined === null ? "The door did not say how many events were refused this read." : `Invalid events never block work; they quarantine and surface. On this spine: ${fmtInt(quarantined)} held separately by refusal code, never counted as receipts.` },
      { key: "torn", title: "Torn lines", text: tornText },
      { key: "revenue", title: "Revenue truth", text: "revenue.received is real-only; a simulated sale is revenue.simulated. The P&L cannot be polluted by wishes." },
    ],
    source: health === null
      ? "The door has not answered yet."
      : ctx.mode === "sim"
        ? `Rendering a fixture spine through the door: ${fmtInt(health.events ?? 0)} events across ${fmtInt(health.days ?? 0)} day files. No number on this screen is real.`
        : `Reading the canonical spine through the door, read-only: ${fmtInt(health.events ?? 0)} events across ${fmtInt(health.days ?? 0)} day files.`,
    receipt: receiptView(events, picks.receipt),
    reads,
  };
}
