// spine.mjs -- every decision the Spine room and the Board room make.
//
// Two rooms, one module, for the reason face/README.md gives and does not hedge: CI never
// runs `npm install` at the repo root, so a branch that lives in a .tsx is a branch nothing
// can exercise. `node` imports this file directly, with no install and no build, which is
// why the paging arithmetic, the refusal taxonomy, the appetite parser and the kill-line
// meter are all HERE and the two .tsx files below are wiring.
//
// It imports only its peers in src/lib -- door.mjs, inbox.mjs, rooms.mjs -- and nothing from
// React, Vite or three.
//
// ─────────────────────────────────────────────────────────────────────────────
// WHAT THE DOOR ACTUALLY DOES, WHICH IS NOT WHAT limit= LOOKS LIKE IT DOES
//
// `GET /api/spine?limit=40` does NOT give you the newest 40 receipts. It gives you the
// OLDEST 40. Read `apiSpine` in .claude/scripts/hq/arc-dash.mjs against `applyFilters` in
// .claude/scripts/hq/spine.mjs and the whole contract falls out:
//
//   readAll()      returns every envelope in APPEND ORDER -- oldest first (sqlite: `ORDER
//                  BY seq ASC`; scan: day files in order).
//   applyFilters() `since` is POSITIONAL, not temporal: it finds the line carrying that
//                  ULID and slices everything AFTER it. A cursor the spine has never seen
//                  is CURSOR_NOT_FOUND, never an empty 200.
//   apiSpine()     `filtered.slice(0, limit)` -- the HEAD of the filtered stream.
//                  `next` = the id of the LAST event on the page, i.e. the cursor that
//                  opens the following page. `more` = whether anything remains after it.
//
// So paging runs oldest → newest, one direction only, and there is no route that hands
// back the tail. A log room that wants to open on the newest receipt has to walk to it.
//
// That is what `newSeek` / `seekAbsorb` do, and the walk is cheap because the door's page
// CAP is 1000 (`PAGE_CAP` in arc-dash.mjs) against a spine of roughly 1,150 receipts: two
// round trips reach the end today. The walk keeps only a LADDER of cursors -- one ULID
// every PAGE_ROWS events, read out of the pages as they stream past -- plus a rolling
// buffer of the last PAGE_ROWS events, which IS the tail rung and costs no extra request.
// Thereafter every page the owner asks for is one small `since=` call.
//
// The alternative -- ask for `limit=50` and render it -- is the bug this comment exists to
// stop someone reintroducing. It shows the owner the first fifty things arc ever did,
// under a heading that says "the log".
// ─────────────────────────────────────────────────────────────────────────────

import { unescapeDoorText } from "./door.mjs";
import {
  fmtInt, readSpinePage, refusalOf, shortId, tail, timeOfDay, toneForKind,
} from "./inbox.mjs";
import { displayValue } from "./rooms.mjs";

// Re-exported so the two rooms have ONE import and cannot reach past this module for a
// formatter. `refusalOf` rather than rooms.mjs's `errorSentence` on purpose: both return
// `{ code, human }`, but only `refusalOf` distinguishes "the door refused, by name" from
// "the door was not there at all" (NO_ANSWER), and those are different facts with
// different fixes. The bespoke rooms Today and Inbox already use it; a third spelling of
// "what went wrong" in this product would be one too many.
export { fmtInt, refusalOf, shortId, tail, timeOfDay, toneForKind, displayValue, unescapeDoorText };

/**
 * @typedef {import("./inbox.mjs").Tone} Tone
 * @typedef {import("./inbox.mjs").Refused} Refused
 * @typedef {import("./inbox.mjs").FeedEvent} FeedEvent
 */

/* ========================================================================== *
 * 0. narrowing helpers -- private, deliberately tiny
 *
 * inbox.mjs keeps its own copies of these and does not export them. Three lines each is
 * the price of not editing a module this phase does not own; they are private here so
 * neither copy can become an API that has to be kept in step.
 * ========================================================================== */

/** @param {unknown} v @returns {Record<string, unknown>} */
function asObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v) ? /** @type {Record<string, unknown>} */ (v) : {};
}
/** @param {unknown} v @returns {unknown[]} */
function asArray(v) {
  return Array.isArray(v) ? v : [];
}
/** @param {unknown} v @returns {string|null} */
function asText(v) {
  return typeof v === "string" && v.length > 0 ? v : null;
}
/** @param {unknown} v @returns {number|null} */
function asCount(v) {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/* ========================================================================== *
 * 1. the two sentences each room opens with
 *
 * Same precedence as inbox.mjs's `roomOpening`, and it is a deliberate second spelling
 * rather than a reuse: that function's tables are frozen object literals keyed by the two
 * literal strings "today" and "inbox", so `ROOM_SENTENCE["spine"]` does not type-check,
 * and widening it means editing a module Phase 06 does not own. The duplication has
 * exactly one address -- this block -- and the constants below are copies of
 * initiatives/face/contracts/room-copy.json, which the registry is generated from.
 * ========================================================================== */

/** @type {Record<string, string>} */
export const ROOM_SENTENCE = {
  spine: "If it isn't an event, it didn't happen.",
  board: "Every lane, its phase, and what it is burning.",
};

/** @type {Record<string, string>} */
export const ROOM_LEDE = {
  spine: "append-only, canonical JSONL, a closed vocabulary of 46 kinds — corrections supersede, nothing is edited",
  board: "the portfolio view — appetite spent against appetite bought, and how far each lane is from its own kill line",
};

/**
 * Which words a room opens with: what the shell was told explicitly, then the registry's
 * own entry (escaped on the wire like everything the door serves), then the constant.
 * The registry wins over the constant because the registry is generated from the contract
 * and the constant is a copy of it.
 * @param {string} id
 * @param {{ sentence?: string, lede?: string } | undefined} room
 * @param {{ sentence?: string, lede?: string }} [overrides]
 * @returns {{ sentence: string, lede: string }}
 */
export function openingFor(id, room, overrides = {}) {
  const reg = room ?? {};
  const fromReg = (/** @type {string|undefined} */ v) =>
    typeof v === "string" && v.trim() !== "" ? unescapeDoorText(v) : null;
  return {
    sentence: overrides.sentence ?? fromReg(reg.sentence) ?? ROOM_SENTENCE[id] ?? "",
    lede: overrides.lede ?? fromReg(reg.lede) ?? ROOM_LEDE[id] ?? "",
  };
}

/* ========================================================================== *
 * 2. reserved colour, as data rather than as taste
 *
 * tokens.css makes four hues law: --amber is needs-you, --green is real money, --red is
 * an incident, --violet is the non-real family. --accent carries no meaning at all, which
 * is the whole reason the four survive. A fifth meaning does not get a fifth hue; it gets
 * a label.
 *
 * The table lives in a .mjs rather than beside the JSX because a table in a .mjs can be
 * ASSERTED: a test can walk every ink this module hands out and prove no reserved hue was
 * spent on a meaning the brief never granted it -- which is exactly the check that would
 * have caught the three collisions tokens.css documents in the owner's own reference.
 * Today.tsx carries an inline copy of the tone half of this; it is not this phase's file
 * to edit, and when it is, it should import from here.
 * ========================================================================== */

/** @type {Record<Tone, string>} */
export const TONE_INK = {
  "needs-you": "var(--amber)",
  "real-money": "var(--green)",
  incident: "var(--red)",
  "non-real": "var(--sim-fg)",
  chrome: "var(--accent-dim)",
  quiet: "var(--prose)",
};

/** @type {readonly Tone[]} */
export const TONE_ORDER = ["needs-you", "real-money", "incident", "non-real", "chrome", "quiet"];

/** @type {Record<Tone, { label: string, rule: string }>} */
export const TONE_RULE = {
  "needs-you": {
    label: "needs you",
    rule: "--amber, and nothing else in this product may wear it. A receipt in this family is addressed to a person; only the Inbox can answer one.",
  },
  "real-money": {
    label: "real money",
    rule: "--green, reserved for revenue.received and no other kind. cost.incurred is real and is not revenue, so it does not borrow this colour.",
  },
  incident: {
    label: "incident",
    rule: "--red, reserved for incident.raised. A torn line, a failed outcome and a refused read are all wrong, and none of them is an incident.",
  },
  "non-real": {
    label: "not real",
    rule: "--violet over a hatch, worn by the whole non-real family — SIMULATED, REHEARSAL, DRILL, EXPLORATORY. Hue alone is not enough, so the texture carries it too.",
  },
  chrome: {
    label: "council",
    rule: "--accent-dim. A council verdict is as real as any other receipt; colouring it violet would say the opposite.",
  },
  quiet: {
    label: "everything else",
    rule: "ink. Most of the log is the company working, and work is not an alert.",
  },
};

/**
 * The legend, against what has ACTUALLY fired.
 *
 * A family whose kinds have never once fired renders "never fired" and not "0" — the
 * difference is the whole Truth Law, and this is where it bites hardest: --green sits
 * unspent because revenue.received has fired zero times, and a legend that printed a green
 * `0` beside it would be claiming a measurement nobody took.
 * @param {SpineHealth|null} health
 * @returns {{ tone: Tone, ink: string, label: string, rule: string, kinds: string[],
 *             count: number, state: "fired"|"never-fired"|"unread" }[]}
 */
export function legendRows(health) {
  const kinds = health === null ? [] : health.kinds;
  const read = health !== null && health.kindsSeen !== null;
  return TONE_ORDER.map((tone) => {
    const wearing = kinds.filter((k) => toneForKind(k) === tone);
    const rule = TONE_RULE[tone];
    return {
      tone,
      ink: TONE_INK[tone],
      label: rule.label,
      rule: rule.rule,
      kinds: wearing,
      count: wearing.length,
      state: !read ? /** @type {const} */ ("unread") : wearing.length > 0 ? /** @type {const} */ ("fired") : /** @type {const} */ ("never-fired"),
    };
  });
}

/* ========================================================================== *
 * 3. the eight spine laws
 *
 * They belong on this screen as TEXT because they are the reason the screen is trustworthy
 * at all. Each is the Decision section of its ADR, compressed to a sentence a person can
 * read in the room the law governs.
 * ========================================================================== */

/** @type {readonly { adr: string, letter: string, title: string, law: string }[]} */
export const SPINE_LAWS = [
  {
    adr: "ADR-0024", letter: "A", title: "append-only canonical JSONL is truth",
    law: "Truth is the JSONL, in canonical serialization: UTF-8, LF, sorted keys, no insignificant whitespace. sha is SHA-256 over the canonical event with the sha field excluded. sqlite is an optional accelerator behind a byte-identity gate, never a second truth.",
  },
  {
    adr: "ADR-0025", letter: "B", title: "the spine lives in the instance",
    law: "Spine data lives at .claude/state/hq/ in this instance and is never synced, never shipped, never part of a payload. The module's CODE ships; the module's DATA does not leave.",
  },
  {
    adr: "ADR-0026", letter: "C", title: "the kind vocabulary is closed",
    law: "The event-kind vocabulary is closed. A kind outside it is refused at emit and quarantined; extending the set takes an ADR, not a commit. That is why a count of kinds means something.",
  },
  {
    adr: "ADR-0027", letter: "D", title: "brief and inbox are CLI-first",
    law: "The brief and the inbox are CLIs under .claude/scripts/hq/. This screen is a CONSUMER of the same reader they use — it is not a second implementation of them, and it can show you nothing they could not.",
  },
  {
    adr: "ADR-0028", letter: "E", title: "secret redaction at emit, fail-safe",
    law: "Redaction runs at emit and fails safe. A deny-pattern hit is refused: strict mode exits 2, hook mode drops the payload loudly, and the quarantine record for that class is STUB-ONLY — the secret bytes are never persisted, so they can never be re-surfaced here.",
  },
  {
    adr: "ADR-0029", letter: "F", title: "immutability windows — supersedes, never edit",
    law: "The active day is append-only; a closed day is immutable forever, pinned by the sha in its day.closed receipt. A correction is a NEW event carrying supersedes. Nothing is edited and nothing is deleted, ever.",
  },
  {
    adr: "ADR-0030", letter: "G", title: "the spine is arc's only public API",
    law: "One reader, filters kind / since / venture, and every consumer keeps its own cursor. Reaching into events/*.jsonl or state.db outside the reader is a lint violation. There is no bus, no daemon, no watcher — consumers poll their cursor, which is what this room is doing.",
  },
  {
    adr: "ADR-0031", letter: "H", title: "the emitter is dual-mode",
    law: "One validator core, two modes. Hook mode never blocks a session: an invalid event is quarantined, a loud SKIP is printed, exit 0. Strict mode — CI, revenue ingest, tests — exits 2 on the identical input. The PAIR is the contract, not either half.",
  },
];

/* ========================================================================== *
 * 4. reading the door
 * ========================================================================== */

/**
 * @typedef {object} LogRecord
 * @property {string} id
 * @property {string} ts
 * @property {string} kind
 * @property {string} venture
 * @property {string} actor
 * @property {string} outcome
 * @property {string} day
 * @property {Record<string, unknown>} payload
 * @property {number|null} seq
 * @property {string|null} sha
 * @property {string|null} supersedes
 * @property {string|null} idem
 * @property {Record<string, unknown>} envelope  the whole event object, verbatim
 *
 * @typedef {object} LogPage
 * @property {string} mode
 * @property {string|null} asof
 * @property {string|null} engine
 * @property {number|null} count
 * @property {boolean} more
 * @property {string|null} next
 * @property {number|null} torn
 * @property {LogRecord[]} records
 */

/** Envelope fields the drawer names itself. Anything else in the event is surfaced as an
 *  extra row rather than dropped — a field the door grew and this shell swallowed is the
 *  same class of defect as a room that renders empty. */
export const IDENTITY_FIELDS = Object.freeze(["id", "ts", "kind", "venture", "actor", "outcome", "payload", "sha", "supersedes", "idem"]);

/**
 * One page of the log, with the envelope kept whole.
 *
 * The six fields Today's timeline needs are narrowed ONCE, by inbox.mjs's `readSpinePage`
 * — not re-narrowed here, because two spellings of "what /api/spine returns" is the drift
 * this repo keeps paying for. What is added is what that reader deliberately discards and
 * a receipt drawer cannot do without: seq, sha, supersedes, idem and the untouched
 * envelope, which is what gets serialised back to canonical form.
 *
 * The two passes walk the SAME array and push exactly one entry per item, so index i in
 * one is index i in the other by construction. The guard is there for the day that stops
 * being true: a drawer that attaches the wrong receipt's sha to an event is worse than a
 * drawer with no sha at all, so a length mismatch drops the extras rather than guessing.
 * @param {unknown} raw
 * @returns {LogPage}
 */
export function readLogPage(raw) {
  const o = asObject(raw);
  const base = readSpinePage(raw);
  const items = asArray(o["events"]);
  const aligned = items.length === base.events.length;

  /** @type {LogRecord[]} */
  const records = base.events.map((e, i) => {
    const wrapper = aligned ? asObject(items[i]) : {};
    const envelope = asObject(wrapper["event"]);
    return {
      id: e.id, ts: e.ts, kind: e.kind, venture: e.venture, actor: e.actor,
      outcome: e.outcome, day: e.day, payload: e.payload,
      seq: asCount(wrapper["seq"]),
      sha: asText(envelope["sha"]),
      supersedes: asText(envelope["supersedes"]),
      idem: asText(envelope["idem"]),
      envelope,
    };
  });

  return {
    mode: asText(o["mode"]) ?? "unknown",
    asof: asText(o["asof"]),
    engine: asText(o["engine"]),
    count: asCount(o["count"]),
    more: base.more,
    next: base.next,
    torn: asCount(o["torn"]),
    records,
  };
}

/**
 * @typedef {object} QuarantineRow
 * @property {string} code
 * @property {number} count
 * @property {string} family
 *
 * @typedef {object} SpineHealth
 * @property {string} mode
 * @property {string} now            the DOOR's clock, not the browser's
 * @property {string|null} cursor    the newest receipt on the spine
 * @property {string|null} root
 * @property {string|null} journal
 * @property {number|null} events
 * @property {number|null} days
 * @property {number|null} daysClosed
 * @property {number|null} kindsSeen
 * @property {string[]} kinds
 * @property {number|null} idemIndex
 * @property {{ day: string, line: number }[]} tornLines
 * @property {boolean} tornRead
 * @property {{ measured: boolean, total: number|null, stubOnly: number|null,
 *              unreadable: number|null, rows: QuarantineRow[] }} quarantine
 */

/**
 * Spine health, with the quarantine kept BY CODE.
 *
 * inbox.mjs's `readHealth` flattens `quarantined` to a total and `torn` to a count, which
 * is right for a KPI tile and wrong for this room: a single "243 quarantined" number reads
 * as catastrophe, and almost all of it is the same receipt arriving twice. This reader
 * keeps the byCode map and the torn lines themselves. It is not a twin of that one — it
 * answers a question that one deliberately does not.
 * @param {unknown} raw
 * @returns {SpineHealth}
 */
export function readSpineHealth(raw) {
  const o = asObject(raw);
  const spine = asObject(o["spine"]);
  const q = asObject(spine["quarantined"]);
  const byCode = asObject(q["byCode"]);

  /** @type {string[]} */
  const kinds = [];
  for (const k of asArray(spine["kinds"])) if (typeof k === "string") kinds.push(k);

  /** @type {QuarantineRow[]} */
  const rows = [];
  for (const code of Object.keys(byCode)) {
    const n = asCount(byCode[code]);
    if (n === null) continue;
    rows.push({ code, count: n, family: refusalFamily(code) });
  }
  // Loudest first, then by name so two codes with the same count do not swap places
  // between reads. localeCompare is avoided everywhere in this repo: its order depends on
  // the runtime's ICU data, and a table that reorders itself between CI legs is a diff
  // nobody can read.
  rows.sort((a, b) => (a.count === b.count ? (a.code < b.code ? -1 : a.code > b.code ? 1 : 0) : b.count - a.count));

  const rawTorn = spine["torn"];
  /** @type {{ day: string, line: number }[]} */
  const tornLines = [];
  for (const t of asArray(rawTorn)) {
    const row = asObject(t);
    const day = asText(row["day"]);
    const line = asCount(row["line"]);
    if (day !== null && line !== null) tornLines.push({ day, line });
  }

  const rootRaw = asObject(o["spine"])["root"];

  return {
    mode: asText(o["mode"]) ?? "unknown",
    now: asText(o["now"]) ?? "",
    cursor: asText(o["cursor"]),
    root: asText(rootRaw),
    journal: asText(o["journal"]),
    events: asCount(spine["events"]),
    days: asCount(spine["days"]),
    daysClosed: asCount(spine["daysClosed"]),
    kindsSeen: asCount(spine["kindsSeen"]),
    kinds,
    idemIndex: asCount(spine["idemIndex"]),
    tornLines,
    tornRead: Array.isArray(rawTorn),
    quarantine: {
      // "the door served a quarantine block" and "the quarantine is empty" are different
      // facts. Only the first makes a zero on this panel a measurement.
      measured: asCount(q["total"]) !== null,
      total: asCount(q["total"]),
      stubOnly: asCount(q["stubOnly"]),
      unreadable: asCount(q["unreadable"]),
      rows,
    },
  };
}

/* ========================================================================== *
 * 5. quarantine -- mostly dedup, not loss
 *
 * This is the single most misreadable number the door serves. `spineHealth` counts every
 * line in events/_quarantine/ into one total, and the overwhelming majority of them are
 * DUP_IDEM: the same receipt offered a second time and correctly refused, so that the
 * first stays the only one. Nothing was lost. A handful are refusals where something
 * genuinely did not land.
 *
 * Grouping BY CODE is therefore not a nicety. A screen that says "243 quarantined" is
 * telling the owner the company is on fire; the same 243, grouped, says the idempotency
 * guard did its job 239 times and four inputs were rejected.
 * ========================================================================== */

/** @type {Record<string, string>} */
const FAMILY_OF_CODE = {
  DUP_IDEM: "dedup",
  DUP_KEY: "dedup",
  SECRET: "secret",
  REDACT_FAIL: "secret",
  UNKNOWN_KIND: "vocabulary",
  UNKNOWN_FIELD: "vocabulary",
  BAD_VERSION: "vocabulary",
  DAY_CLOSED: "sealed",
  SHA_MISMATCH: "sealed",
  BAD_SUPERSEDES: "sealed",
  INDEX_UNREADABLE: "reader",
  NO_STATE_DB: "reader",
  NO_SQLITE: "reader",
  LOCK_FAILED: "reader",
  LOCK_TIMEOUT: "reader",
  LOCK_LOST: "reader",
};

/** @type {Record<string, { label: string, loss: "none"|"withheld"|"lost"|"unknown", sentence: string }>} */
export const REFUSAL_FAMILY = {
  dedup: {
    label: "deduplication",
    loss: "none",
    sentence: "The same receipt was offered twice and the second copy was refused, so the first stays the only one. NOTHING WAS LOST — this is the idempotency guard working, and it is almost always the bulk of this panel.",
  },
  secret: {
    label: "withheld by design",
    loss: "withheld",
    sentence: "The input tripped a deny pattern. It was refused at emit and — uniquely — its bytes were never persisted, so the quarantine record is a stub (ADR-0028). This shell could not show you what was in it even if you asked.",
  },
  vocabulary: {
    label: "outside the vocabulary",
    loss: "lost",
    sentence: "A kind or a field the closed vocabulary does not contain (ADR-0026). Something tried to record a fact arc has no word for, and it did not land. Extending the set is an ADR.",
  },
  sealed: {
    label: "against a sealed day",
    loss: "lost",
    sentence: "A write aimed at a day the spine has already closed, or a correction whose supersedes did not resolve. A closed day is immutable forever (ADR-0029), so this did not land and could not have.",
  },
  malformed: {
    label: "refused by the validator",
    loss: "lost",
    sentence: "The input did not satisfy the event contract — a bad timestamp, a bad amount, a shape the canonical serializer will not accept. It did not land, and the fix is at whatever emitted it.",
  },
  reader: {
    label: "the reader itself",
    loss: "unknown",
    sentence: "The refusal is about reading the spine rather than about an event — a lock, a missing index, an unusable engine. What it means for the log depends on which, and this shell will not guess.",
  },
  unclassified: {
    label: "not classified here",
    loss: "unknown",
    sentence: "This shell has no sentence for that refusal code. The door's own name for it is shown verbatim above, which is the part that is actionable; inventing an explanation for it would be worse than admitting there is none.",
  },
};

/**
 * Which family a refusal code belongs to. Prefix rules after the table, because the
 * validator's codes are overwhelmingly BAD_* and enumerating ninety of them here would be
 * a list that goes stale rather than a rule that holds.
 * @param {string} code
 * @returns {string}
 */
export function refusalFamily(code) {
  const known = FAMILY_OF_CODE[code];
  if (known !== undefined) return known;
  if (/^(BAD_|CANON_|MISSING_|EMPTY_|NEGATIVE_|NONFINITE|OVERSIZE|DEPTH_|NUMBER_|BOM|CR_BYTE|NO_INPUT|NO_DAY|WRONG_KIND)/.test(code)) return "malformed";
  return "unclassified";
}

/**
 * @typedef {object} QuarantineView
 * @property {boolean} measured
 * @property {number|null} total
 * @property {number} dedup      records that are the same receipt twice
 * @property {number} withheld   records whose bytes were never kept
 * @property {number} lost       records where something genuinely did not land
 * @property {number} unknown    records this shell will not classify
 * @property {string} headline
 * @property {{ family: string, label: string, loss: string, sentence: string, count: number,
 *              codes: QuarantineRow[] }[]} families
 * @property {number|null} stubOnly
 * @property {number|null} unreadable
 */

/**
 * The quarantine, grouped so it can be read honestly.
 * @param {SpineHealth|null} health
 * @returns {QuarantineView}
 */
export function quarantineView(health) {
  const q = health === null
    ? { measured: false, total: null, stubOnly: null, unreadable: null, rows: /** @type {QuarantineRow[]} */ ([]) }
    : health.quarantine;

  /** @type {Map<string, QuarantineRow[]>} */
  const buckets = new Map();
  for (const row of q.rows) {
    let b = buckets.get(row.family);
    if (b === undefined) { b = []; buckets.set(row.family, b); }
    b.push(row);
  }

  const families = [...buckets.entries()].map(([family, codes]) => {
    const meta = REFUSAL_FAMILY[family] ?? REFUSAL_FAMILY["unclassified"];
    const label = meta === undefined ? family : meta.label;
    const loss = meta === undefined ? "unknown" : meta.loss;
    const sentence = meta === undefined ? "" : meta.sentence;
    return { family, label, loss, sentence, count: codes.reduce((n, c) => n + c.count, 0), codes };
  });
  // dedup first: it is the reassuring one and it is nearly always the largest, so leading
  // with it is what stops the panel reading as an incident.
  const RANK = /** @type {Record<string, number>} */ ({ dedup: 0, withheld: 1, unknown: 2, lost: 3 });
  families.sort((a, b) => {
    const ra = RANK[a.loss] ?? 4, rb = RANK[b.loss] ?? 4;
    return ra === rb ? b.count - a.count : ra - rb;
  });

  const sum = (/** @type {string} */ loss) =>
    families.filter((f) => f.loss === loss).reduce((n, f) => n + f.count, 0);
  const dedup = sum("none"), withheld = sum("withheld"), lost = sum("lost"), unknown = sum("unknown");

  return {
    measured: q.measured,
    total: q.total,
    dedup, withheld, lost, unknown,
    families,
    stubOnly: q.stubOnly,
    unreadable: q.unreadable,
    headline: quarantineHeadline({ measured: q.measured, total: q.total, dedup, withheld, lost, unknown }),
  };
}

/**
 * The sentence that stands in front of the number, so the number is never read alone.
 * @param {{ measured: boolean, total: number|null, dedup: number, withheld: number, lost: number, unknown: number }} v
 * @returns {string}
 */
export function quarantineHeadline(v) {
  if (!v.measured || v.total === null)
    return "The door did not serve a quarantine block, so this shell does not know how many inputs have been refused. That is an unread panel, not an empty one.";
  if (v.total === 0)
    return "No input has ever been refused. That is a measured zero — the quarantine directory was read and it is empty.";
  /** @type {string[]} */
  const parts = [];
  if (v.dedup > 0) parts.push(`${fmtInt(v.dedup)} the same receipt arriving twice, which is deduplication and not loss`);
  if (v.withheld > 0) parts.push(`${fmtInt(v.withheld)} withheld at emit and never persisted`);
  if (v.lost > 0) parts.push(`${fmtInt(v.lost)} where something genuinely did not land`);
  if (v.unknown > 0) parts.push(`${fmtInt(v.unknown)} this shell will not classify`);
  const tail_ = parts.length === 0 ? "and none of it is classified here" : `— ${parts.join(", ")}`;
  return `${fmtInt(v.total)} input${v.total === 1 ? "" : "s"} refused and held separately, never counted as receipts ${tail_}.`;
}

/**
 * Torn lines: bytes on the spine that could not be parsed back. Not an incident, and not
 * a zero either — a spine with no torn lines was READ and found clean, which is a
 * different claim from a health block that never carried the field.
 * @param {SpineHealth|null} health
 * @returns {{ state: "clean"|"torn"|"unread", count: number|null, sentence: string }}
 */
export function tornView(health) {
  if (health === null || !health.tornRead)
    return { state: "unread", count: null, sentence: "The door did not serve a torn-line list, so nothing is claimed about the readability of the log." };
  const n = health.tornLines.length;
  if (n === 0)
    return { state: "clean", count: 0, sentence: "Every line of the log parsed. Measured, not assumed — the reader walked the day files and found nothing it could not read." };
  return {
    state: "torn",
    count: n,
    sentence: `${fmtInt(n)} line${n === 1 ? "" : "s"} on the spine could not be parsed back. Those bytes are on disk and are not receipts, so nothing on any screen counts them. This is a defect to repair, and it is not an incident: --red is reserved for incident.raised and stays unspent.`,
  };
}

/**
 * The honesty number: how many kinds have EVER fired. Derived from the log by the door,
 * never copied from a doc — a copied count is the exact defect ADR-0107's derive-it rule
 * exists to prevent.
 * @param {SpineHealth|null} health
 * @returns {{ known: boolean, sentence: string }}
 */
export function kindsView(health) {
  if (health === null || health.kindsSeen === null)
    return { known: false, sentence: "The door did not say how many kinds have fired." };
  const closed = health.daysClosed, days = health.days;
  const sealed = closed !== null && days !== null
    ? ` ${fmtInt(closed)} of ${fmtInt(days)} day${days === 1 ? "" : "s"} are sealed and immutable forever.`
    : "";
  return {
    known: true,
    sentence: `${fmtInt(health.kindsSeen)} distinct kind${health.kindsSeen === 1 ? " has" : "s have"} ever fired, counted from the log rather than from the vocabulary. A kind that has never fired has no count at all — not a zero.${sealed}`,
  };
}

/* ========================================================================== *
 * 6. the walk -- how this room reaches the newest receipt
 *
 * See the header comment for WHY. What follows is the mechanism:
 *
 *   newSeek(filters)         a fresh walk, positioned at the start of the log
 *   seekQuery(seek)          the next door call, or null when the walk is finished
 *   seekAbsorb(seek, page)   fold one page in; returns the next state
 *   rungQuery(seek, index)   the door call for one page of rows, once the walk is done
 *
 * The walk is pure state in, pure state out, so `node` can drive the whole protocol
 * against a fake page array with no browser and no door.
 * ========================================================================== */

/** How many receipts one screen of the log shows. Also the rung spacing of the ladder. */
export const PAGE_ROWS = 50;

/**
 * The page size the WALK asks for. 1000 is `PAGE_CAP` in arc-dash.mjs — the largest the
 * door will serve, and therefore the fewest round trips to reach the tail. Every
 * /api/spine call re-scans the whole log, so the number of requests is the cost that
 * matters here, not the number of bytes. If the door ever lowers its cap, this asks for
 * more than it allows and the door answers LIMIT_INVALID by name, which is the failure
 * mode to want: a named refusal, not a silently short walk.
 */
export const SEEK_LIMIT = 1000;

/**
 * The walk stops here rather than paging forever. At SEEK_LIMIT that is forty million
 * receipts, so it is not a limit the company will meet by working; it is the limit that
 * stops a cursor bug from turning into an infinite request loop. Hitting it sets
 * `truncated`, and the room says so instead of presenting a window as the whole log.
 */
export const MAX_SEEK_REQUESTS = 40;

/**
 * @typedef {object} SeekFilters
 * @property {string[]} kinds   an empty array means every kind
 * @property {string|null} day  YYYY-MM-DD, or null
 *
 * @typedef {object} SeekState
 * @property {"walking"|"done"} phase
 * @property {SeekFilters} filters
 * @property {(string|null)[]} rungs   rungs[i] is the `since` cursor that opens page i; rungs[0] is null
 * @property {string|null} cursor      where the walk has got to
 * @property {number} total            filtered receipts counted so far
 * @property {number} requests         round trips spent
 * @property {boolean} truncated       the walk stopped at MAX_SEEK_REQUESTS, short of the end
 * @property {LogRecord[]} tailBuffer  a rolling window of the last PAGE_ROWS records seen
 * @property {string} mode
 * @property {string|null} engine
 * @property {number|null} torn
 */

const DAY_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

/** @param {unknown} v @returns {boolean} */
export function isDay(v) {
  return typeof v === "string" && DAY_RE.test(v);
}

/**
 * A fresh walk. Filters are part of the state because the LADDER is filter-specific: a
 * rung cursor is a position in the filtered stream, so changing the kind set invalidates
 * every rung and the walk has to run again. That is a real cost and the room says it out
 * loud rather than paging a stale ladder.
 * @param {Partial<SeekFilters>} [filters]
 * @returns {SeekState}
 */
export function newSeek(filters = {}) {
  const kinds = Array.isArray(filters.kinds) ? [...filters.kinds].filter((k) => typeof k === "string" && k !== "") : [];
  kinds.sort();
  return {
    phase: "walking",
    filters: { kinds, day: isDay(filters.day) ? /** @type {string} */ (filters.day) : null },
    rungs: [null],
    cursor: null,
    total: 0,
    requests: 0,
    truncated: false,
    tailBuffer: [],
    mode: "unknown",
    engine: null,
    torn: null,
  };
}

/**
 * The door query a set of filters produces. `kind` is comma-joined because that is what
 * `applyFilters` splits on; an empty selection omits the parameter entirely rather than
 * sending an empty string, which would filter everything out.
 * @param {SeekFilters} filters
 * @returns {{ kind?: string, date?: string }}
 */
export function filterQuery(filters) {
  /** @type {{ kind?: string, date?: string }} */
  const q = {};
  if (filters.kinds.length > 0) q.kind = filters.kinds.join(",");
  if (filters.day !== null) q.date = filters.day;
  return q;
}

/**
 * The next call of the walk, or null when there is nothing left to ask for.
 * @param {SeekState} seek
 * @returns {{ since?: string, kind?: string, date?: string, limit: number }|null}
 */
export function seekQuery(seek) {
  if (seek.phase === "done") return null;
  if (seek.requests >= MAX_SEEK_REQUESTS) return null;
  const q = { ...filterQuery(seek.filters), limit: SEEK_LIMIT };
  return seek.cursor === null ? q : { since: seek.cursor, ...q };
}

/**
 * Fold one page of the walk in.
 *
 * Two things are harvested and the events themselves are then dropped: a rung cursor at
 * every PAGE_ROWS-th record, read straight out of the ids the door already sent, and a
 * rolling buffer of the last PAGE_ROWS records, which turns out to BE the final rung and
 * so costs no extra request to display.
 * @param {SeekState} seek
 * @param {LogPage} page
 * @returns {SeekState}
 */
export function seekAbsorb(seek, page) {
  const rungs = [...seek.rungs];
  let total = seek.total;
  for (const rec of page.records) {
    total++;
    // total is now the 1-based index of this record. When it lands exactly on a rung
    // boundary, THIS record's id is the `since` that opens the next page.
    if (total % PAGE_ROWS === 0) rungs.push(rec.id);
  }

  const buffer = tail([...seek.tailBuffer, ...page.records], PAGE_ROWS);
  const requests = seek.requests + 1;
  const more = page.more === true && page.next !== null;
  const truncated = more && requests >= MAX_SEEK_REQUESTS;

  if (!more || truncated) {
    // A total that is an exact multiple of PAGE_ROWS pushed a rung that opens onto
    // nothing. Drop it rather than offering the owner an empty page.
    if (total > 0 && total % PAGE_ROWS === 0) rungs.pop();
  }

  return {
    phase: !more || truncated ? "done" : "walking",
    filters: seek.filters,
    rungs,
    cursor: page.next ?? seek.cursor,
    total,
    requests,
    truncated,
    tailBuffer: buffer,
    mode: page.mode,
    engine: page.engine ?? seek.engine,
    torn: page.torn ?? seek.torn,
  };
}

/** How many pages of rows the finished walk found. Always at least 1: a filter that
 *  matches nothing still gets a page, which says so. @param {SeekState} seek */
export function rungCount(seek) {
  return Math.max(1, seek.rungs.length);
}

/** The last rung — the newest receipts, and the page the room opens on. @param {SeekState} seek */
export function tailRung(seek) {
  return rungCount(seek) - 1;
}

/**
 * The newest page, free.
 *
 * The walk already streamed every record past this module on its way to the end, so the
 * rolling buffer holds the final PAGE_ROWS of them — and the last rung is never longer
 * than that. The room opens on the tail without spending a request on it.
 * @param {SeekState} seek
 * @returns {LogRecord[]}
 */
export function tailRecords(seek) {
  const w = rungWindow(seek, tailRung(seek));
  if (w.total === 0) return [];
  return tail(seek.tailBuffer, w.last - w.first + 1);
}

/**
 * The door call for one page of rows. Returns null for a rung the walk never found, which
 * is a caller bug rather than a thing to paper over with an empty page.
 * @param {SeekState} seek
 * @param {number} index
 * @returns {{ since?: string, kind?: string, date?: string, limit: number }|null}
 */
export function rungQuery(seek, index) {
  if (!Number.isInteger(index) || index < 0 || index >= rungCount(seek)) return null;
  const since = seek.rungs[index] ?? null;
  const q = { ...filterQuery(seek.filters), limit: PAGE_ROWS };
  return since === null ? q : { since, ...q };
}

/**
 * Which slice of the log a rung is, in the owner's terms.
 * @param {SeekState} seek
 * @param {number} index
 * @returns {{ first: number, last: number, total: number, label: string, newest: boolean, oldest: boolean }}
 */
export function rungWindow(seek, index) {
  const total = seek.total;
  const first = total === 0 ? 0 : index * PAGE_ROWS + 1;
  const last = Math.min(total, (index + 1) * PAGE_ROWS);
  const newest = index >= rungCount(seek) - 1;
  return {
    first, last, total, newest, oldest: index === 0,
    label: total === 0
      ? "no receipt matches"
      : `${fmtInt(first)}–${fmtInt(last)} of ${fmtInt(total)}${seek.truncated ? "+" : ""}`,
  };
}

/**
 * What the walk did, stated rather than implied. The owner is looking at a page of a log
 * and is entitled to know whether it is the whole log, and what it cost to find out.
 * @param {SeekState} seek
 * @returns {string}
 */
export function seekSentence(seek) {
  const scope = seek.filters.kinds.length === 0 && seek.filters.day === null
    ? "the whole log"
    : `the log filtered to ${seek.filters.kinds.length === 0 ? "every kind" : `${fmtInt(seek.filters.kinds.length)} kind${seek.filters.kinds.length === 1 ? "" : "s"}`}${seek.filters.day === null ? "" : ` on ${seek.filters.day}`}`;
  if (seek.phase === "walking")
    return `Walking ${scope} from its first receipt — the door pages forward only, so the newest receipt is at the far end. ${fmtInt(seek.requests)} request${seek.requests === 1 ? "" : "s"} so far.`;
  if (seek.truncated)
    return `The walk stopped after ${fmtInt(MAX_SEEK_REQUESTS)} requests with more log still ahead of it. What is below is a WINDOW, not the end — the counts are a floor, not a total.`;
  if (seek.total === 0)
    return `Nothing matched. ${scope} was walked end to end in ${fmtInt(seek.requests)} request${seek.requests === 1 ? "" : "s"}, and the read succeeded — this is an empty answer, not a missing one.`;
  return `${fmtInt(seek.total)} receipt${seek.total === 1 ? "" : "s"} in ${scope}, reached in ${fmtInt(seek.requests)} request${seek.requests === 1 ? "" : "s"}. The door pages forward from the first receipt, so this walked to the end; the page below is the newest one.`;
}

/**
 * Toggle a kind in the filter set, returning a NEW array. Sorted, so the same selection
 * always produces the same `kind=` parameter and therefore the same ladder.
 * @param {readonly string[]} selected @param {string} kind
 * @returns {string[]}
 */
export function toggleKind(selected, kind) {
  const next = selected.indexOf(kind) === -1 ? [...selected, kind] : selected.filter((k) => k !== kind);
  next.sort();
  return next;
}

/**
 * The kinds the filter menu may offer: the ones that have EVER fired, which is what the
 * door serves. A kind in the vocabulary that has never fired is not here, and offering it
 * would be offering a filter guaranteed to return nothing.
 * @param {SpineHealth|null} health
 * @returns {{ kind: string, tone: Tone, ink: string }[]}
 */
export function kindMenu(health) {
  if (health === null) return [];
  return [...health.kinds].sort().map((kind) => {
    const tone = toneForKind(kind);
    return { kind, tone, ink: TONE_INK[tone] };
  });
}

/* ========================================================================== *
 * 7. the receipt drawer
 * ========================================================================== */

/**
 * Canonical JSON: sorted keys, no insignificant whitespace. This is the shape ADR-0024
 * defines truth in, and it is deterministic on every leg — `JSON.stringify` alone is not,
 * because it preserves insertion order.
 *
 * It is NOT a verification. The `sha` on an event is SHA-256 over the canonical event with
 * the sha field removed, and nothing in L3 hashes anything: the drawer SHOWS the sha the
 * spine recorded and says that is what it is doing. A client that implied it had checked
 * would be the second spelling of the integrity guarantee, and the wrong one to trust.
 * @param {unknown} value
 * @returns {string}
 */
export function canonicalJson(value) {
  if (value === null) return "null";
  const t = typeof value;
  if (t === "string" || t === "boolean") return JSON.stringify(value);
  if (t === "number") return Number.isFinite(value) ? JSON.stringify(value) : "null";
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (t === "object") {
    const o = /** @type {Record<string, unknown>} */ (value);
    return `{${Object.keys(o).sort().map((k) => `${JSON.stringify(k)}:${canonicalJson(o[k])}`).join(",")}}`;
  }
  // undefined, function, symbol -- none can survive JSON.parse, so this is unreachable
  // through the door. It answers rather than throwing, because a drawer that crashes on
  // one odd receipt takes the whole log down with it.
  return "null";
}

/**
 * The same value, in the same key order, laid out to be read. The ORDER is canonical; the
 * BYTES are not — the sha was taken over the compact form above, and the drawer offers
 * both so nobody has to take that on trust.
 * @param {unknown} value
 * @param {number} [depth]
 * @returns {string}
 */
export function prettyJson(value, depth = 0) {
  const pad = "  ".repeat(depth + 1);
  const close = "  ".repeat(depth);
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    return `[\n${value.map((v) => `${pad}${prettyJson(v, depth + 1)}`).join(",\n")}\n${close}]`;
  }
  if (value !== null && typeof value === "object") {
    const o = /** @type {Record<string, unknown>} */ (value);
    const keys = Object.keys(o).sort();
    if (keys.length === 0) return "{}";
    return `{\n${keys.map((k) => `${pad}${JSON.stringify(k)}: ${prettyJson(o[k], depth + 1)}`).join(",\n")}\n${close}}`;
  }
  return canonicalJson(value);
}

/**
 * @typedef {object} ReceiptField
 * @property {string} key
 * @property {string} value
 * @property {boolean} missing
 * @property {string} note
 */

/**
 * The identity half of a receipt: what the envelope says about itself, with every field
 * that is absent saying MISSING rather than rendering blank.
 *
 * Anything in the envelope this shell does not name is appended as an extra row. A field
 * the door grew and the drawer swallowed is the same defect as a room that renders empty,
 * and the whole product exists so that nothing goes missing quietly.
 * @param {LogRecord} rec
 * @returns {ReceiptField[]}
 */
export function receiptFields(rec) {
  /** @type {ReceiptField[]} */
  const rows = [
    { key: "id", value: rec.id, note: "the ULID. Lexicographically sortable, so append order IS time order.", missing: false },
    { key: "ts", value: rec.ts, note: "the emitter's clock, in the company's timezone. Never restated in the browser's.", missing: false },
    { key: "day", value: rec.day, note: "the day file this line lives in.", missing: false },
    { key: "seq", value: rec.seq === null ? "" : String(rec.seq), note: "position in the reader's walk of the whole log.", missing: rec.seq === null },
    { key: "kind", value: rec.kind, note: "one word from the closed vocabulary (ADR-0026).", missing: false },
    { key: "venture", value: rec.venture, note: "which venture this happened in.", missing: false },
    { key: "actor", value: rec.actor, note: "who emitted it.", missing: false },
    { key: "outcome", value: rec.outcome, note: "how it ended.", missing: false },
    { key: "sha", value: rec.sha ?? "", note: "SHA-256 over the canonical event, sha excluded. Shown as recorded — nothing in this shell recomputes it.", missing: rec.sha === null },
    { key: "idem", value: rec.idem ?? "", note: "the idempotency key. A second event with this key is refused, which is why the quarantine is mostly duplicates.", missing: rec.idem === null },
    { key: "supersedes", value: rec.supersedes ?? "", note: "the id this event corrects. A correction is an append; nothing is ever edited (ADR-0029).", missing: rec.supersedes === null },
  ].map((r) => {
    const v = displayValue(r.value === "" ? null : r.value);
    return { key: r.key, value: v.text, missing: v.missing, note: r.note };
  });

  for (const key of Object.keys(rec.envelope).sort()) {
    if (IDENTITY_FIELDS.indexOf(key) !== -1) continue;
    const raw = rec.envelope[key];
    rows.push({
      key,
      value: typeof raw === "string" ? unescapeDoorText(raw) : canonicalJson(raw),
      missing: false,
      note: "a field this shell does not name. Shown rather than dropped — the envelope grew and nothing here is entitled to hide that.",
    });
  }
  return rows;
}

/**
 * What the payload panel says when there is nothing in it. An event with an empty payload
 * is a real, valid receipt — `{}` is a measurement, not an absence — and saying so is the
 * difference between an honest drawer and one that looks broken.
 * @param {LogRecord} rec
 * @returns {{ empty: boolean, sentence: string, canonical: string, pretty: string }}
 */
export function payloadView(rec) {
  const keys = Object.keys(rec.payload);
  return {
    empty: keys.length === 0,
    sentence: keys.length === 0
      ? "This receipt carries no payload. That is the recorded fact — an empty object, not a payload that failed to load."
      : `${fmtInt(keys.length)} field${keys.length === 1 ? "" : "s"}, in canonical key order.`,
    canonical: canonicalJson(rec.payload),
    pretty: prettyJson(rec.payload),
  };
}

/* ========================================================================== *
 * 8. the board
 *
 * `GET /api/board` serves `{ mode, badge, updated, lanes: [{ lane, header }] }`, and the
 * header is whatever `laneHeader` parsed out of the lane's PROGRESS.md — every `key: value`
 * line above the first `##`. That is the ONLY source of a value on this screen.
 *
 * ROW ORDER is the board's own: `apiBoard` walks PORTFOLIO.md's table in file order, which
 * is the owner's priority ordering (ADR-0051). This module does not re-sort. A lane's
 * position on that board is a decision the owner made, and re-ranking it by status would
 * be this screen quietly overruling him.
 * ========================================================================== */

/**
 * @typedef {object} Measure
 * @property {number|null} days
 * @property {string} text            what the header actually said
 * @property {"measured"|"missing"|"unreadable"} state
 *
 * @typedef {object} BoardRow
 * @property {string} lane
 * @property {{ value: string|null, label: string, tone: string, ink: string, note: string }} status
 * @property {{ number: string|null, note: string|null }} phase
 * @property {string|null} cycle
 * @property {string|null} blockedOn
 * @property {string|null} dependsOn
 * @property {Measure} appetite
 * @property {Measure} burn
 * @property {Meter} meter
 * @property {string[]} unread        header keys this shell has no column for
 *
 * @typedef {object} Meter
 * @property {"measured"|"no-appetite"|"burn-unrecorded"|"unreadable"} state
 * @property {number|null} fraction   burn / appetite, uncapped; 1.2 means 20% past the line
 * @property {number|null} fill       fraction clamped to 1, for the bar up to the line
 * @property {number|null} over       fraction beyond 1, clamped to 1, for the bar past it
 * @property {number|null} remaining  days left before the line, negative once past it
 * @property {boolean} past
 * @property {boolean} atLine
 * @property {string} label
 * @property {string} sentence
 *
 * @typedef {object} BoardView
 * @property {string} mode
 * @property {string} badge
 * @property {string|null} updated
 * @property {BoardRow[]} rows
 */

/** The header spellings that mean "no value recorded". Em dash is what every lane uses. */
const NO_VALUE = new Set(["—", "–", "-", "--", "", "n/a", "N/A", "none", "TBD", "tbd", "?"]);

/** Days, as this repo spells them: `8d`, `6.5d`, `7.25d`, `0d`. */
const DAYS_RE = /^(\d+(?:\.\d+)?)\s*d$/i;

/**
 * One appetite or burn figure, in three states rather than two.
 *
 * "the header said —" and "the header said something this shell cannot parse" are
 * different facts, and both are different from a measured `0d`. `legal` is at `burn: 0d`
 * and `design` is at `burn: —`; the first is a lane that has bought five days and spent
 * none of them, the second is a lane with no cycle running. Rendering both as 0 would be
 * the same lie twice.
 * @param {unknown} raw
 * @returns {Measure}
 */
export function parseDays(raw) {
  const text = typeof raw === "string" ? unescapeDoorText(raw).trim() : "";
  if (NO_VALUE.has(text)) return { days: null, text, state: "missing" };
  const m = DAYS_RE.exec(text);
  if (m === null || m[1] === undefined) return { days: null, text, state: "unreadable" };
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n < 0) return { days: null, text, state: "unreadable" };
  return { days: n, text, state: "measured" };
}

/**
 * A day count, formatted the same way on every machine. `toLocaleString` is avoided for
 * the reason it is avoided everywhere in this tree: the browser's locale is not a property
 * of the lane.
 * @param {number} n
 * @returns {string}
 */
export function fmtDays(n) {
  if (typeof n !== "number" || !Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  const rounded = Math.round(abs * 100) / 100;
  let body = String(rounded);
  if (body.indexOf(".") !== -1) body = body.replace(/0+$/, "").replace(/\.$/, "");
  return `${n < 0 ? "-" : ""}${body}d`;
}

/**
 * `phase: 04` and `phase: — (cycle closed, merged as 17473e7 / PR #100)` are both real
 * header values. The leading token is the phase; whatever follows it in parentheses is a
 * note, and it is kept rather than truncated away.
 * @param {unknown} raw
 * @returns {{ number: string|null, note: string|null }}
 */
export function parsePhase(raw) {
  const text = typeof raw === "string" ? unescapeDoorText(raw).trim() : "";
  if (text === "") return { number: null, note: null };
  const m = /^(\S+)\s*(.*)$/.exec(text);
  const head = m === null ? text : (m[1] ?? text);
  const rest = m === null ? "" : (m[2] ?? "");
  const note = rest.replace(/^\(/, "").replace(/\)$/, "").trim();
  return {
    number: NO_VALUE.has(head) ? null : head,
    note: note === "" ? null : note,
  };
}

/**
 * The status facet, and the colour question this screen has to get right.
 *
 * NONE of the reserved four appears here. A lane that is BLOCKED is not an incident and is
 * not an approval waiting in the inbox — no receipt was raised, nothing on this screen can
 * be decided, and borrowing --amber for it would invent a needs-you signal the spine never
 * emitted. LIVE takes --mode-live, which is --accent and carries no meaning: it is a
 * statement about the lane's own header, not about money, urgency or reality-class.
 * @param {string|null} status
 * @returns {{ value: string|null, label: string, tone: string, ink: string, note: string }}
 */
export function statusFacet(status) {
  if (status === null || NO_VALUE.has(status))
    return {
      value: null, label: "MISSING", tone: "missing", ink: "var(--faint)",
      note: "this lane's machine header carries no status line. The board is a view; the header is the truth, and this one is silent (ADR-0051).",
    };
  const up = status.toUpperCase();
  if (up === "LIVE")
    return { value: status, label: "LIVE", tone: "live", ink: "var(--mode-live)", note: "a cycle is running in this lane." };
  if (up === "BLOCKED")
    return {
      value: status, label: "BLOCKED", tone: "blocked", ink: "var(--prose)",
      note: "the lane cannot move until what its header names is cleared. Not an incident and not an approval — nothing on this screen can decide it, which is why it wears no reserved colour.",
    };
  if (up === "IDLE")
    return { value: status, label: "IDLE", tone: "idle", ink: "var(--faint)", note: "no cycle is running in this lane." };
  return {
    value: status, label: up, tone: "other", ink: "var(--meta)",
    note: "a status this shell does not recognise, shown verbatim rather than folded into one it does.",
  };
}

/**
 * Appetite bought against appetite spent, and the distance to the kill line.
 *
 * The appetite IS the kill line: it is a budget, fixed at kickoff, and crossing it is the
 * event the lane is supposed to notice. So the meter is burn over appetite and the line
 * sits at 1.0.
 *
 * A LANE PAST ITS LINE DOES NOT GO RED. --red is incident.raised and nothing else; a lane
 * over its appetite is a scheduling fact, not an incident, and the moment a fifth meaning
 * takes a reserved hue the other four stop meaning anything. It gets a LABEL and a mark on
 * the meter — which is also the accessible answer, because a label survives a reader who
 * cannot see the hue at all.
 *
 * And a lane with no burn recorded is NOT a lane burning zero. There is no meter for it,
 * and the room says which of the two it is looking at.
 * @param {Measure} appetite @param {Measure} burn
 * @returns {Meter}
 */
export function burnMeter(appetite, burn) {
  const none = { fraction: null, fill: null, over: null, remaining: null, past: false, atLine: false };
  if (appetite.state === "unreadable" || burn.state === "unreadable")
    return {
      ...none, state: "unreadable",
      label: "UNREADABLE",
      sentence: `This lane's header spells its appetite "${appetite.text || "—"}" and its burn "${burn.text || "—"}", and this shell reads days as \`8d\` or \`6.5d\`. It will not convert what it cannot parse, so no meter is drawn.`,
    };
  if (appetite.state === "missing")
    return {
      ...none, state: "no-appetite",
      label: "NO APPETITE BOUGHT",
      sentence: "No appetite is recorded, so this lane has no kill line to be near. That is not a lane at 0% — it is a lane with nothing bought, and the two are different facts.",
    };
  if (burn.state === "missing")
    return {
      ...none, state: "burn-unrecorded",
      label: "BURN NOT RECORDED",
      sentence: `${fmtDays(appetite.days ?? 0)} of appetite is bought and no burn is recorded against it. NOT a lane burning zero — nothing has been measured here, and a zero would be a claim nobody made.`,
    };

  const bought = appetite.days ?? 0;
  const spent = burn.days ?? 0;
  if (bought === 0)
    return {
      ...none, state: "no-appetite",
      label: "APPETITE 0d",
      sentence: `The header records an appetite of 0d and a burn of ${fmtDays(spent)}. A budget of nothing has no line to cross, so there is no meter to draw — the numbers are shown as recorded.`,
    };

  const fraction = spent / bought;
  const remaining = bought - spent;
  const atLine = Math.abs(remaining) < 0.005;
  const past = remaining < -0.005;
  const pct = Math.round(fraction * 100);

  return {
    state: "measured",
    fraction,
    fill: Math.min(1, fraction),
    over: Math.max(0, Math.min(1, fraction - 1)),
    remaining,
    past,
    atLine,
    label: past ? `OVER BY ${fmtDays(-remaining)}` : atLine ? "AT THE LINE" : `${fmtDays(remaining)} LEFT`,
    sentence: past
      ? `${fmtDays(spent)} spent against ${fmtDays(bought)} bought — ${fmtInt(pct)}% of the appetite, ${fmtDays(-remaining)} past the kill line. Named, not coloured: a lane over its line is a scheduling fact, and --red belongs to incident.raised.`
      : atLine
        ? `${fmtDays(spent)} spent against ${fmtDays(bought)} bought. Exactly on the kill line.`
        : `${fmtDays(spent)} spent against ${fmtDays(bought)} bought — ${fmtInt(pct)}% of the appetite, ${fmtDays(remaining)} from the kill line.`,
  };
}

/**
 * How far past the kill line the meter can draw before it clamps. The track is this many
 * appetites wide, so the line always sits at the SAME x on every row — a tick that moved
 * with each lane's overrun would make two rows impossible to compare, which is the one
 * thing a board of sixteen lanes has to get right.
 */
export const METER_SCALE = 1.25;

/**
 * The meter's geometry, as percentages of the track.
 *
 * Here rather than in the JSX because it is arithmetic with an edge — a lane more than a
 * quarter past its appetite clamps, and `clamped` is what tells the room to say the true
 * number in words instead of pretending the bar is the measurement.
 * @param {Meter} meter
 * @returns {{ drawable: boolean, linePct: number, fillPct: number, overPct: number, clamped: boolean }}
 */
export function meterGeometry(meter) {
  const linePct = (1 / METER_SCALE) * 100;
  if (meter.state !== "measured" || meter.fraction === null)
    return { drawable: false, linePct, fillPct: 0, overPct: 0, clamped: false };
  const f = meter.fraction;
  const fillPct = (Math.min(f, 1) / METER_SCALE) * 100;
  const overPct = (Math.max(0, Math.min(f, METER_SCALE) - 1) / METER_SCALE) * 100;
  return { drawable: true, linePct, fillPct, overPct, clamped: f > METER_SCALE };
}

/**
 * One part as a whole-number share of a total. Returns null rather than 0 when there is
 * no total to be a share OF — a "0%" derived from a division by nothing is a number the
 * data never supported.
 * @param {number} part @param {number|null} total
 * @returns {number|null}
 */
export function sharePct(part, total) {
  if (total === null || !Number.isFinite(total) || total <= 0) return null;
  return Math.round((part / total) * 100);
}

/** Header keys this screen gives a column of its own. Everything else is surfaced as an
 *  extra rather than dropped, for the reason `receiptFields` gives. */
const HEADER_FIELDS = Object.freeze(["status", "phase", "cycle", "appetite", "burn", "blocked-on", "depends-on"]);

/** @param {Record<string, unknown>} header @param {string} key @returns {string|null} */
function headerText(header, key) {
  const v = header[key];
  if (typeof v !== "string") return null;
  const t = unescapeDoorText(v).trim();
  return t === "" || NO_VALUE.has(t) ? null : t;
}

/**
 * The board, in the board's own order.
 *
 * Takes the RAW `/api/board` body rather than a pre-dug field, so the narrowing of an
 * untrusted response is asserted in a file `node` can run rather than inside a component
 * nothing can.
 * @param {unknown} payload
 * @returns {BoardView|Refused}
 */
export function boardRows(payload) {
  const body = asObject(payload);
  const raw = body["lanes"];
  if (!Array.isArray(raw))
    return {
      code: "BAD_BODY",
      human: "The board answered without a lane list. No roster is drawn from that — a company with no lanes is not what happened here; a read is.",
    };

  const rows = raw.map((entry) => {
    const e = asObject(entry);
    const header = asObject(e["header"]);
    const appetite = parseDays(header["appetite"]);
    const burn = parseDays(header["burn"]);
    /** @type {string[]} */
    const unread = [];
    for (const k of Object.keys(header).sort()) if (HEADER_FIELDS.indexOf(k) === -1) unread.push(k);
    return /** @type {BoardRow} */ ({
      lane: typeof e["lane"] === "string" ? e["lane"] : "",
      status: statusFacet(headerText(header, "status")),
      phase: parsePhase(header["phase"]),
      cycle: headerText(header, "cycle"),
      blockedOn: headerText(header, "blocked-on"),
      dependsOn: headerText(header, "depends-on"),
      appetite,
      burn,
      meter: burnMeter(appetite, burn),
      unread,
    });
  });

  return {
    mode: asText(body["mode"]) ?? "unknown",
    badge: asText(body["badge"]) ?? "file, not log",
    updated: headerText(body, "updated"),
    rows,
  };
}

/**
 * @typedef {object} BoardTotals
 * @property {number} lanes
 * @property {number} live
 * @property {number} blocked
 * @property {number} idle
 * @property {number} other
 * @property {number} statusMissing
 * @property {number} bought
 * @property {number} spent
 * @property {number} measured    lanes whose appetite AND burn both parsed
 * @property {number} unmeasured  lanes left out of the two sums
 * @property {number} past        lanes over their own kill line
 * @property {string} sentence
 */

/**
 * The totals, with the lanes that are NOT in them counted out loud.
 *
 * This is the lesson `.claude/rules/lanes.md` records against a real merge: six files came
 * out of it with no entry at all and rode a default, because a missing entry is a default
 * rather than an error. A total that silently omits four lanes is that defect with a
 * bigger blast radius, so the count of what was left out is part of the answer.
 * @param {readonly BoardRow[]} rows
 * @returns {BoardTotals}
 */
export function boardTotals(rows) {
  let live = 0, blocked = 0, idle = 0, other = 0, statusMissing = 0;
  let bought = 0, spent = 0, measured = 0, past = 0;
  for (const r of rows) {
    if (r.status.tone === "live") live++;
    else if (r.status.tone === "blocked") blocked++;
    else if (r.status.tone === "idle") idle++;
    else if (r.status.tone === "missing") statusMissing++;
    else other++;
    if (r.meter.state === "measured" && r.appetite.days !== null && r.burn.days !== null) {
      bought += r.appetite.days;
      spent += r.burn.days;
      measured++;
      if (r.meter.past) past++;
    }
  }
  const unmeasured = rows.length - measured;
  return {
    lanes: rows.length, live, blocked, idle, other, statusMissing,
    bought: Math.round(bought * 100) / 100,
    spent: Math.round(spent * 100) / 100,
    measured, unmeasured, past,
    sentence: rows.length === 0
      ? "The board served no lanes at all."
      : `${fmtDays(spent)} spent against ${fmtDays(bought)} bought across ${fmtInt(measured)} of ${fmtInt(rows.length)} lanes.${unmeasured > 0 ? ` ${fmtInt(unmeasured)} lane${unmeasured === 1 ? " is" : "s are"} NOT in those totals because ${unmeasured === 1 ? "its header records" : "their headers record"} no appetite or no burn — left out and counted, never summed as zero.` : ""}${past > 0 ? ` ${fmtInt(past)} ${past === 1 ? "lane is" : "lanes are"} past ${past === 1 ? "its" : "their"} own kill line.` : ""}`,
  };
}

/**
 * Where every value on this screen comes from, in one sentence, because the board and the
 * lane files disagree often enough that it matters. `PORTFOLIO.md` supplies the ORDER;
 * `initiatives/<lane>/PROGRESS.md` supplies every value (ADR-0051, and the door reads the
 * truth directly rather than the view).
 * @param {BoardView} view
 * @returns {string}
 */
export function boardProvenance(view) {
  return `Row order is PORTFOLIO.md's own, which is the owner's priority ordering. Every VALUE is read from that lane's machine header in initiatives/<lane>/PROGRESS.md — the board is a view and the lane files are the truth (ADR-0051), so where the two disagree, what you are reading here is the lane. ${view.updated === null ? "The board carries no Updated line." : `The board says it was updated ${view.updated}.`} This panel is ${view.badge}: it has no day-granular history and as-of does not apply to it.`;
}
