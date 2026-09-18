// fold.mjs -- command/today: every decision the daily screen makes, where node can import it with no
// install (face v2 Phase 03, ADR-1320, ADR-1324).
//
// The port of v0.7's Overview. Its figures, brief, tape and approval list read the door; the policy
// ladder is read from /api/policy and "learned this week" from /api/learn (Phase 04) -- both files, not
// the log, so neither moves with the as-of scrub, and each says so. Approvals are listed, never stamped,
// here: the one write lives in the inbox module, with its typed reason.
import { LOADING, payloadOf, roomHoldingKind } from "../../../lib/registry.mjs";
import { asArray, asObject, field, projected, servedRead, servedTable } from "../../../lib/served.mjs";
import {
  BRIEF_BUDGET, ageSentence, approvalBody, collapseBrief, dayOf, decodeDoorText, fmtInt, kpiTiles,
  parseBrief, readBrief, readHealth, readInbox, readSpinePage, tail,
} from "../../../lib/inbox.mjs";
import { TONE_INK, eventRowView, receiptView } from "../../../lib/spine.mjs";

/** How many of the day's receipts the tape draws; the whole log is the spine module's. */
const FEED_ROWS = 40;
/** The door's page cap: a day is read from its start, and the tape takes the tail. */
const FEED_LIMIT = 1000;
/** How many facts of an approval the daily screen shows; the inbox shows them all. */
const CARD_FACTS = 3;

/** @typedef {"amber" | "green" | "red" | "violet" | "accent" | undefined} KitTone */

/**
 * The inbox module's word for a meaning, as the kit's tone.
 * @param {import("../../../lib/inbox.mjs").Tone} tone
 * @returns {KitTone}
 */
function kitTone(tone) {
  if (tone === "needs-you") return "amber";
  if (tone === "real-money") return "green";
  if (tone === "incident") return "red";
  if (tone === "non-real") return "violet";
  return undefined;
}

/** @param {import("../../../lib/registry.mjs").Payload} p */
const refusal = (p) => (p.state === "refused" ? { code: p.code, human: p.human } : { code: "", human: "" });

/**
 * @typedef {object} Folded
 * @property {string} sentence
 * @property {string} lede
 * @property {string} modeLabel
 * @property {boolean} isSim
 * @property {{ key: string, v: string, l: string, tone: KitTone, sub: string }[]} kpis
 * @property {{ isReading: boolean, isRefused: boolean, isShown: boolean, isQuiet: boolean, refusal: { code: string, human: string }, hint: string, lines: { key: string, tag: string, ink: string, text: string }[], foot: string }} brief
 * @property {{ isReading: boolean, isRefused: boolean, isEmpty: boolean, hasRows: boolean, refusal: { code: string, human: string }, hint: string, rows: import("../../../lib/spine.mjs").EventRowView[] }} feed
 * @property {{ isReading: boolean, isRefused: boolean, isZero: boolean, hasWaiting: boolean, refusal: { code: string, human: string }, chip: string, tone: "amber" | undefined, cards: { id: string, title: string, tag: string, age: string, facts: { k: string, v: string }[] }[], decided: { id: string, short: string, label: string, ink: string, title: string }[], hasDecided: boolean }} inbox
 * @property {boolean} canOpenInbox
 * @property {string} inboxRoom
 * @property {boolean} canOpenSpine
 * @property {string} spineRoom
 * @property {import("../../../lib/served.mjs").ServedTable} policy
 * @property {import("../../../lib/served.mjs").ServedTable} learned
 * @property {import("../../../lib/spine.mjs").ReceiptView} receipt
 * @property {import("../../../lib/registry.mjs").Read[]} reads
 */

/**
 * @param {Record<string, import("../../../lib/registry.mjs").Payload>} payloads  the declared routes' payloads
 * @param {import("../../../lib/registry.mjs").FoldContext} ctx
 * @returns {Folded}
 */
export function fold(payloads, ctx) {
  const room = ctx.room;
  /** @type {Record<string, string>} */
  const picks = ctx.picks ?? {};
  /** @type {import("../../../lib/registry.mjs").Read[]} */
  const reads = [{ route: "/api/health", poll: true }, { route: "/api/brief" }, { route: "/api/inbox", poll: true }];

  const healthP = payloadOf(payloads, { route: "/api/health" });
  const health = healthP.state === "ok" ? readHealth(healthP.data) : null;
  const inboxP = payloadOf(payloads, { route: "/api/inbox" });
  const inbox = inboxP.state === "ok" ? readInbox(inboxP.data) : null;
  const briefP = payloadOf(payloads, { route: "/api/brief" });

  // The day the DOOR is in, never the browser's: a machine in another timezone must not ask the company
  // for the wrong day and be told it was quiet.
  const day = health === null ? "" : dayOf(health.now);
  /** @type {import("../../../lib/registry.mjs").Read | null} */
  const feedRead = day === "" ? null : { route: "/api/spine", query: { date: day, limit: FEED_LIMIT }, poll: true };
  if (feedRead !== null) reads.push(feedRead);
  const policySt = servedRead(payloads, ctx, reads, "/api/policy");
  const learnSt = servedRead(payloads, ctx, reads, "/api/learn");
  /** @type {import("../../../lib/registry.mjs").Payload} */
  const feedP = feedRead === null ? (healthP.state === "refused" ? healthP : LOADING) : payloadOf(payloads, feedRead);
  const page = feedP.state === "ok" ? readSpinePage(feedP.data) : null;
  const events = page === null ? [] : page.events;

  const tiles = kpiTiles({ health, inbox });
  const kpis = tiles.map((t) => ({
    key: t.key,
    v: t.state === "never-fired" ? "never" : t.value,
    l: t.label,
    tone: kitTone(t.tone),
    sub: t.state === "not-served" ? "not on this read" : t.state === "never-fired" ? "never fired · honest" : "",
  }));

  /** @type {{ key: string, tag: string, ink: string, text: string }[]} */
  const lines = [];
  let foot = "";
  let isQuiet = false;
  if (briefP.state === "ok") {
    const view = readBrief(briefP.data);
    const shown = collapseBrief(parseBrief(view.text), BRIEF_BUDGET);
    for (const s of shown.sections) {
      if (s.collapsed) lines.push({ key: `${s.name}:count`, tag: s.name, ink: "var(--text-3)", text: s.summary });
      else s.lines.forEach((l, i) => lines.push({ key: `${s.name}:${i}`, tag: s.name, ink: TONE_INK[l.tone] ?? "var(--text-3)", text: l.text }));
    }
    shown.notices.forEach((n, i) => lines.push({ key: `notice:${i}`, tag: "notice", ink: "var(--text-3)", text: n }));
    isQuiet = lines.length === 0;
    foot = shown.note === null ? `${fmtInt(shown.lines)} of ${fmtInt(shown.budget)} lines · ${decodeDoorText(view.source)}` : shown.note;
  }

  const rows = tail(events, FEED_ROWS).map(eventRowView).reverse();
  const open = inbox === null ? [] : inbox.open;
  const decided = events.filter((e) => e.kind === "decision.recorded").slice(-4).reverse().map((e) => {
    const verdict = typeof e.payload.verdict === "string" ? e.payload.verdict : "";
    return {
      id: e.id, short: e.id.slice(-6),
      label: verdict === "reject" ? "rejected" : verdict === "approve" ? "approved" : verdict || "decided",
      ink: verdict === "approve" ? "var(--accent)" : "var(--text-2)",
      title: eventRowView(e).text,
    };
  });
  const openCount = inbox === null ? null : inbox.openCount;
  const inboxRoom = roomHoldingKind({ rooms: ctx.rooms }, "approval.requested") ?? "";
  const spineRoom = (ctx.rooms || []).some((r) => r.id === "spine" && r.status !== "template") ? "spine" : "";

  return {
    sentence: decodeDoorText(typeof room.sentence === "string" ? room.sentence : ""),
    lede: decodeDoorText(typeof room.lede === "string" ? room.lede : ""),
    modeLabel: ctx.mode === "sim" ? "simulated day · real vocabulary" : ctx.mode === "live" ? "real spine · read-only" : "mode unstated",
    isSim: ctx.mode === "sim",
    kpis,
    brief: {
      isReading: briefP.state === "loading" || briefP.state === "pending",
      isRefused: briefP.state === "refused",
      isShown: briefP.state === "ok" && !isQuiet,
      isQuiet: briefP.state === "ok" && isQuiet,
      refusal: refusal(briefP),
      hint: `noise budget: whole day ≤ ${BRIEF_BUDGET} lines${day === "" ? "" : ` · ${day}`}`,
      lines,
      foot,
    },
    feed: {
      isReading: feedP.state === "loading" || feedP.state === "pending",
      isRefused: feedP.state === "refused",
      isEmpty: page !== null && rows.length === 0,
      hasRows: rows.length > 0,
      refusal: refusal(feedP),
      hint: page === null ? "everything the company did today · ⌗ opens the receipt" : `${page.more ? "the first " : ""}${fmtInt(page.count ?? events.length)} receipt${page.count === 1 ? "" : "s"} today · the last ${fmtInt(rows.length)} here · ⌗ opens the receipt`,
      rows,
    },
    inbox: {
      isReading: inboxP.state === "loading" || inboxP.state === "pending",
      isRefused: inboxP.state === "refused",
      isZero: inbox !== null && open.length === 0,
      hasWaiting: open.length > 0,
      refusal: refusal(inboxP),
      chip: openCount === null ? "unread" : `${fmtInt(openCount)} waiting`,
      tone: open.length > 0 ? "amber" : undefined,
      cards: open.map((a) => ({
        id: a.id,
        title: decodeDoorText(a.what),
        tag: a.gate,
        age: health === null ? "" : ageSentence(a.ts, health.now),
        facts: approvalBody(a.payload).slice(0, CARD_FACTS).map((r) => ({ k: r.key, v: r.value })),
      })),
      decided,
      hasDecided: decided.length > 0,
    },
    canOpenInbox: inboxRoom !== "",
    inboxRoom,
    canOpenSpine: spineRoom !== "",
    spineRoom,
    policy: servedTable(projected(policySt, "capabilities", (b) => {
      const caps = b["capabilities"];
      const subjects = b["subjects"];
      if (!Array.isArray(caps) || !Array.isArray(subjects)) return undefined;
      const ORDER = ["L0", "L1", "L2", "L3"];
      return caps.map((cap) => {
        let best = "";
        /** @type {string[]} */
        const holders = [];
        for (const sub of subjects) {
          const cellOf = asArray(asObject(sub)["cells"]).map(asObject).find((c) => field(c, "capability") === cap);
          const eff = cellOf === undefined ? "" : field(cellOf, "effective");
          if (ORDER.indexOf(eff) > ORDER.indexOf(best)) { best = eff; holders.length = 0; }
          if (eff !== "" && eff === best) holders.push(field(asObject(sub), "subject"));
        }
        return { capability: cap, level: best, holders: holders.join(", ") };
      });
    }), {
      panel: "Policy",
      route: "/api/policy",
      columns: ["capability", "highest level held", "held by"],
      listKey: "capabilities",
      empty: "hq.policy.yaml names no capability.",
      row: (c) => {
        const cap = field(c, "capability");
        return cap === "" ? null : { key: cap, cells: [cap, field(c, "level") || "—", field(c, "holders") || "no subject"] };
      },
      note: "each level is the effective one: the ceiling in hq.policy.yaml, capped by what the spine's level changes earned",
    }),
    learned: servedTable(learnSt, {
      panel: "Learned this week",
      route: "/api/learn",
      columns: ["logged", "the pattern", "the rule it became"],
      listKey: "thisWeek",
      empty: "No lesson was logged to the retro log this week.",
      row: (l) => {
        const id = field(l, "id");
        return id === "" ? null : { key: id, cells: [field(l, "date"), field(l, "pattern"), field(l, "prevention")] };
      },
      note: learnSt.isRead ? `the retro log's rows dated ${field(learnSt.body, "weekFrom")} to ${field(learnSt.body, "today")} -- a file, so it does not move with the as-of scrub` : "",
    }),
    receipt: receiptView(events, picks.receipt),
    reads,
  };
}
