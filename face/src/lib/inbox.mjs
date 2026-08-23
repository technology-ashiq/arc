// inbox.mjs -- every decision the two daily rooms make, in one dependency-free file.
//
// Today.tsx and Inbox.tsx are markup. THIS is where the branches live, for the reason
// README.md gives: CI never runs `npm install`, so a branch inside a .tsx is a branch
// nobody tests. The keyboard model, the reason rules, the "since you left" arithmetic,
// the brief's collapse rules and every read of the door's response shape are here.
//
// It imports door.mjs (also dependency-free) for the refusal vocabulary and the error
// type, and NOTHING else. No React, no vite, no three.
//
// TWO CONTRACTS FROM L2 SHAPE ALMOST EVERYTHING BELOW, and both are worth reading once:
//
//   1. THE DOOR SERVES DISPLAY-SAFE STRINGS. arc-dash's serializer HTML-escapes every
//      string in every response, refusals included (`escapeDeep`, its "representation
//      contract"). React escapes again at render, so a brief that says `isn't` arrives as
//      `isn&#39;t` and would be SHOWN as `isn&#39;t`. `decodeDoorText` undoes exactly the
//      five entities that serializer writes, and every string that reaches a person goes
//      through it. Ids, kinds and ULIDs never contain any of the five, so they are safe
//      either way -- but the owner's own typed reason, read back, is not.
//
//   2. THE DOOR NEVER TOTALS ANYTHING FOR US. Every figure these rooms render is a field
//      the door returned. Where the door has no field -- "how much real revenue" -- the
//      rooms say which kind has never fired instead of inventing a number, because
//      `/api/health` DOES serve `spine.kinds`, and "revenue.received is not in that set"
//      is a fact with a receipt behind it where "0" would be a guess wearing a numeral.

import { DoorError, KNOWN_REFUSALS, unescapeDoorText } from "./door.mjs";

/* ========================================================================== *
 * 0. the two sentences a room opens with
 * ========================================================================== */

// The room registry (`GET /api/rooms`) is the truth for these, and the shell passes the
// registry's own copy in when it has it. These constants are the fallback for a room
// mounted before the registry has answered -- an opening sentence is the first thing on
// the screen and must never be a blank line waiting on a fetch.
export const ROOM_SENTENCE = Object.freeze({
  today: "The company ran all night. Here is what it did.",
  inbox: "A machine may raise it. Only you may decide it.",
});

export const ROOM_LEDE = Object.freeze({
  today: "the brief, the numbers that moved, and what is waiting on you — one screen, forty lines, no route change",
  inbox: "the one write path in this product — a typed reason, no bulk action, no default, no undo",
});

/**
 * Which words a room opens with, in precedence order: what the shell was told explicitly,
 * then the registry's own entry (whose strings arrive escaped, like everything else the
 * door serves), then the constant above. The registry wins over the constant because the
 * registry is generated from the contract and the constant is a copy of it.
 * @param {"today" | "inbox"} id
 * @param {{ sentence?: string, lede?: string } | undefined} room
 * @param {{ sentence?: string, lede?: string }} overrides
 * @returns {{ sentence: string, lede: string }}
 */
export function roomOpening(id, room, overrides = {}) {
  const fromRegistry = room ?? {};
  return {
    sentence: overrides.sentence ?? (typeof fromRegistry.sentence === "string" && fromRegistry.sentence !== ""
      ? decodeDoorText(fromRegistry.sentence)
      : ROOM_SENTENCE[id]),
    lede: overrides.lede ?? (typeof fromRegistry.lede === "string" && fromRegistry.lede !== ""
      ? decodeDoorText(fromRegistry.lede)
      : ROOM_LEDE[id]),
  };
}

/* ========================================================================== *
 * 1. the door's representation contract
 * ========================================================================== */

/**
 * Undo arc-dash's `escapeHtml` -- and only it. The five entities below are the exact five
 * that serializer writes; anything else that looks like an entity came from the spine's
 * own bytes and is left alone, because a general HTML-entity decoder here would silently
 * rewrite a receipt's content.
 *
 * `&amp;` LAST is load-bearing: decoding it first would turn the literal spine bytes
 * `&amp;lt;` into `<` -- the classic double-decode, which is how an escaped `<script>`
 * becomes a live one. React still escapes on render, so this is not the only defence, but
 * a decoder that can manufacture a `<` from text that never held one is wrong on its own
 * terms.
 *
 * A TWIN OF THIS FUNCTION EXISTS: `rooms.mjs` exports `unescapeDoorText` for the generic
 * rooms. Two spellings of one rule is the shape this repo keeps paying for, and the two
 * must not drift -- they are separate today only because this module is imported by the
 * daily rooms' tests and must stand on its own. Folding them into one is a change to
 * rooms.mjs, which this room does not own.
 * @param {string} s
 * @returns {string}
 */
export function decodeDoorText(s) {
  // FOLDED. This was a second spelling of door.mjs's unescapeDoorText -- same five
  // entities, same "&amp; last" ordering, same reasoning written out twice. The name
  // stays because this module's callers use it; the RULE now has one home.
  return unescapeDoorText(s);
}

/* ========================================================================== *
 * 2. reading what the door returned
 *
 * Every reader takes `unknown` and returns a shape the views can render. A field the
 * door did not send comes back `null` -- never 0, never "" -- so that "the door did not
 * say" stays distinguishable from "the door said zero" all the way to the pixel.
 * ========================================================================== */

/** @param {unknown} v @returns {Record<string, unknown>} */
function asObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v)
    ? /** @type {Record<string, unknown>} */ (v)
    : {};
}

/** @param {unknown} v @returns {unknown[]} */
function asArray(v) {
  return Array.isArray(v) ? v : [];
}

/** Display text: decoded. @param {unknown} v @param {string} fallback @returns {string} */
function asText(v, fallback = "") {
  return typeof v === "string" ? decodeDoorText(v) : fallback;
}

/** Machine text (ids, kinds, days): verbatim. @param {unknown} v @param {string} fallback @returns {string} */
function asToken(v, fallback = "") {
  return typeof v === "string" ? v : fallback;
}

/** @param {unknown} v @returns {number | null} */
function asCount(v) {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/**
 * @typedef {object} BriefView
 * @property {string} mode      live | sim
 * @property {string | null} asof
 * @property {string} source    the door's own words about what assembled this
 * @property {string} text      the brief, decoded, exactly as the CLI rendered it
 */

/** @param {unknown} raw @returns {BriefView} */
export function readBrief(raw) {
  const o = asObject(raw);
  return {
    mode: asToken(o["mode"], "unknown"),
    asof: typeof o["asof"] === "string" ? o["asof"] : null,
    source: asText(o["source"], ""),
    text: asText(o["text"], ""),
  };
}

/**
 * @typedef {object} Approval
 * @property {string} id
 * @property {string} day
 * @property {string} ts
 * @property {string} venture
 * @property {string} what   free text, or the profile's subject -- the door's own fallback
 * @property {string} gate
 * @property {Record<string, unknown>} payload
 */

/**
 * @typedef {object} InboxView
 * @property {string} mode
 * @property {string | null} asof
 * @property {number | null} openCount
 * @property {number | null} decidedCount
 * @property {Approval[]} open
 */

/** @param {unknown} raw @returns {InboxView} */
export function readInbox(raw) {
  const o = asObject(raw);
  const open = [];
  for (const item of asArray(o["open"])) {
    const e = asObject(item);
    open.push({
      id: asToken(e["id"], ""),
      day: asToken(e["day"], ""),
      ts: asToken(e["ts"], ""),
      venture: asToken(e["venture"], ""),
      what: asText(e["what"], ""),
      gate: asToken(e["gate"], "?"),
      payload: asObject(e["payload"]),
    });
  }
  return {
    mode: asToken(o["mode"], "unknown"),
    asof: typeof o["asof"] === "string" ? o["asof"] : null,
    openCount: asCount(o["openCount"]),
    decidedCount: asCount(o["decidedCount"]),
    open,
  };
}

/**
 * @typedef {object} HealthView
 * @property {string} mode
 * @property {string} now         the DOOR's clock, IST, not the browser's
 * @property {string | null} cursor
 * @property {number | null} events
 * @property {number | null} days
 * @property {number | null} daysClosed
 * @property {number | null} kindsSeen
 * @property {string[]} kinds     every kind that has EVER fired
 * @property {number | null} quarantined
 * @property {number | null} torn
 */

/** @param {unknown} raw @returns {HealthView} */
export function readHealth(raw) {
  const o = asObject(raw);
  const spine = asObject(o["spine"]);
  const kinds = [];
  for (const k of asArray(spine["kinds"])) if (typeof k === "string") kinds.push(k);
  const torn = spine["torn"];
  return {
    mode: asToken(o["mode"], "unknown"),
    now: asToken(o["now"], ""),
    cursor: typeof o["cursor"] === "string" ? o["cursor"] : null,
    events: asCount(spine["events"]),
    days: asCount(spine["days"]),
    daysClosed: asCount(spine["daysClosed"]),
    kindsSeen: asCount(spine["kindsSeen"]),
    kinds,
    quarantined: asCount(asObject(spine["quarantined"])["total"]),
    torn: Array.isArray(torn) ? torn.length : null,
  };
}

/**
 * @typedef {object} FeedEvent
 * @property {string} id
 * @property {string} ts
 * @property {string} kind
 * @property {string} venture
 * @property {string} actor
 * @property {string} outcome
 * @property {string} day
 * @property {Record<string, unknown>} payload
 */

/**
 * @typedef {object} SpinePage
 * @property {number | null} count
 * @property {boolean} more
 * @property {string | null} next
 * @property {FeedEvent[]} events
 */

/** @param {unknown} raw @returns {SpinePage} */
export function readSpinePage(raw) {
  const o = asObject(raw);
  /** @type {FeedEvent[]} */
  const events = [];
  for (const item of asArray(o["events"])) {
    const wrapper = asObject(item);
    const e = asObject(wrapper["event"]);
    events.push({
      id: asToken(e["id"], ""),
      ts: asToken(e["ts"], ""),
      kind: asToken(e["kind"], ""),
      venture: asToken(e["venture"], ""),
      actor: asToken(e["actor"], ""),
      outcome: asToken(e["outcome"], ""),
      day: asToken(wrapper["day"], ""),
      payload: asObject(e["payload"]),
    });
  }
  return {
    count: asCount(o["count"]),
    more: o["more"] === true,
    next: typeof o["next"] === "string" ? o["next"] : null,
    events,
  };
}

/* ========================================================================== *
 * 3. refusals -- never "something went wrong"
 * ========================================================================== */

/**
 * @typedef {object} Refused
 * @property {string} code   the door's own code, or a named local one. Always shown.
 * @property {string} human  a sentence. Never generic.
 */

/**
 * Turn anything thrown on the way to or from the door into a code and a sentence.
 *
 * A DoorError keeps its code verbatim -- the whole point of the door naming its refusals
 * is that the person sees the name. A thrown TypeError (fetch could not reach anything)
 * is NOT given a door code it never earned: it gets NO_ANSWER and a sentence saying what
 * to check, because "the door refused" and "the door was not there" are different facts
 * and the fix for each is different.
 * @param {unknown} err
 * @returns {Refused}
 */
export function refusalOf(err) {
  if (err instanceof DoorError) {
    // The same precedence DoorError.human uses -- our sentence for a code we have one
    // for, otherwise the door's own words, otherwise the bare code. `||` and not `??`:
    // an empty message must fall through to the code, and "" is not nullish.
    const known = KNOWN_REFUSALS[err.code];
    return { code: err.code, human: known || decodeDoorText(err.message) || err.code };
  }
  const message = err instanceof Error ? err.message : String(err);
  return {
    code: "NO_ANSWER",
    human: `The door did not answer (${message}). It is localhost + token only: check that arc-dash is running, and that this page was opened with the #token=… URL it printed.`,
  };
}

/* ========================================================================== *
 * 4. reserved meanings -- which tone a kind may wear
 *
 * tokens.css makes four hues law: amber = needs-you, green = real money, red = incident,
 * violet = the non-real family. Nothing else may borrow them, so this table is the only
 * place a kind is granted one. Everything the table does not name renders in the
 * product's own colour or in ink, which is why the reserved four still mean something
 * when they do appear.
 * ========================================================================== */

/**
 * The kinds arc-brief files under needs-you (its GROUPS table, `arc-brief.mjs`). This is
 * a SECOND SPELLING of that table and the only one in L3 -- the door serves the brief as
 * rendered text, so there is no route that hands this list over. It is here rather than
 * in a component so the duplication has exactly one address if the vocabulary grows.
 * @type {readonly string[]}
 */
export const NEEDS_YOU_KINDS = Object.freeze([
  "approval.requested",
  "incident.raised",
  "policy.demoted",
  "handoff.ready",
  "slice.stuck",
  "promotion.proposed",
  "meeting.booked",
]);

/**
 * The needs-you kinds that are NOT approvals -- an incident, a handoff, a stuck slice, a
 * demoted grant. They need a human and there is no button in this product that decides
 * one: nothing folds them closed, so the spine records that they were RAISED and never
 * that they were handled. The Inbox shows them as cards with chips and no stamp, and says
 * exactly that (ADR-1303, REQ-03).
 * @type {readonly string[]}
 */
export const RAISED_KINDS = Object.freeze([
  "incident.raised",
  "policy.demoted",
  "handoff.ready",
  "slice.stuck",
  "promotion.proposed",
  "meeting.booked",
]);

/**
 * @typedef {"needs-you" | "real-money" | "incident" | "non-real" | "chrome" | "quiet"} Tone
 */

/**
 * @param {string} kind
 * @returns {Tone}
 */
export function toneForKind(kind) {
  // real money, and ONLY this kind. tokens.css: --green stays unspent until
  // revenue.received fires for the first time. cost.incurred is real and has fired
  // hundreds of times -- and it is not revenue, so it does not get the revenue colour.
  if (kind === "revenue.received") return "real-money";
  // the non-real family. A simulated rupee beside a real one, both green, is the exact
  // lie the Truth Law exists to prevent.
  if (kind === "revenue.simulated") return "non-real";
  if (kind === "incident.raised") return "incident";
  if (NEEDS_YOU_KINDS.indexOf(kind) !== -1) return "needs-you";
  if (kind.indexOf("council.") === 0) return "chrome";
  return "quiet";
}

/* ========================================================================== *
 * 5. the brief
 * ========================================================================== */

/** One screen. arc-brief renders to this budget; Today honours it a second time. */
export const BRIEF_BUDGET = 40;

/** In arc-brief's own render order. */
export const BRIEF_GROUPS = Object.freeze(["needs-you", "money", "progress", "background", "ungrouped"]);

/**
 * The two groups that may NEVER become a count, at either layer. Every line in them is
 * addressed to a person: an approval waiting, a kill line crossed, a job gone silent, a
 * rupee that moved. A count cannot be acted on.
 */
export const NEVER_COLLAPSE = Object.freeze(["needs-you", "money"]);

/**
 * Collapsed BEFORE the budget is even measured, exactly as arc-brief does it: these are
 * noise floors, and a wall of identical note.logged lines is what buries needs-you.
 */
export const ALWAYS_COLLAPSE = Object.freeze(["background", "ungrouped"]);

/**
 * @typedef {object} BriefLine
 * @property {string} text  the line, indent stripped
 * @property {Tone} tone
 * @property {string} kind  the kind this line names, or "" when it names none
 */

/**
 * @typedef {object} BriefSection
 * @property {string} name
 * @property {number | null} count   the head's own number -- the door's, never re-counted
 * @property {BriefLine[]} lines
 * @property {boolean} collapsed     already a count when it arrived, or made one here
 * @property {string} summary        the count line's text, when collapsed
 * @property {boolean} collapsible
 */

/**
 * @typedef {object} ParsedBrief
 * @property {string | null} day
 * @property {BriefSection[]} sections
 * @property {string[]} notices   lines the brief prints outside every group
 * @property {number} lineCount   the door's own line count, before anything here touches it
 */

const HEAD_RE = /^([a-z-]+) \((\d+)\)/;
const COUNT_RE = /^([a-z-]+): (\d+) \(/;
const KIND_RE = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/;

/**
 * Parse the brief the door served into its groups, WITHOUT re-deriving any of it. Every
 * count on screen is the head's own number as arc-brief wrote it; this function never
 * counts lines and calls the result a total.
 * @param {string} text
 * @returns {ParsedBrief}
 */
export function parseBrief(text) {
  const raw = typeof text === "string" ? text : "";
  const lines = raw.replace(/\n+$/, "").split("\n");
  /** @type {BriefSection[]} */
  const sections = [];
  /** @type {string[]} */
  const notices = [];
  let day = null;
  /** @type {BriefSection | null} */
  let current = null;

  for (const line of lines) {
    if (line.trim() === "") continue;
    if (day === null && line.indexOf("brief ") === 0) {
      day = line.slice("brief ".length).trim();
      continue;
    }
    // An indented line belongs to whatever group is open. The money group's spend line
    // and needs-you's derived job/kill lines arrive this way and are NOT events -- which
    // is why they are kept as lines rather than folded into the head's count.
    if (line.indexOf("  ") === 0 && current !== null) {
      const body = line.trim();
      const first = body.split(/\s+/)[0] ?? "";
      const kind = KIND_RE.test(first) ? first : "";
      current.lines.push({ text: body, tone: lineTone(current.name, kind), kind });
      continue;
    }
    const collapsedHead = COUNT_RE.exec(line);
    if (collapsedHead !== null) {
      const name = collapsedHead[1] ?? "";
      const count = Number(collapsedHead[2] ?? "0");
      current = { name, count, lines: [], collapsed: true, summary: line.trim(), collapsible: true };
      sections.push(current);
      continue;
    }
    const head = HEAD_RE.exec(line);
    if (head !== null) {
      const name = head[1] ?? "";
      const count = Number(head[2] ?? "0");
      current = {
        name,
        count,
        lines: [],
        collapsed: false,
        summary: "",
        collapsible: NEVER_COLLAPSE.indexOf(name) === -1,
      };
      sections.push(current);
      continue;
    }
    // Unindented, not a head: the growth feed line and "UNREADABLE LINES: n" ride here.
    // They are printed, never dropped -- "the day looks quiet" and "the day is
    // unreadable" must not render the same.
    current = null;
    notices.push(line.trim());
  }

  return { day, sections, notices, lineCount: lines.length };
}

/**
 * @param {string} section
 * @param {string} kind
 * @returns {Tone}
 */
export function lineTone(section, kind) {
  if (kind !== "") {
    const byKind = toneForKind(kind);
    // money's own lines: only a received rupee is green, only a simulated one is violet,
    // everything else in the group (cost, spend, a month close) is ink.
    if (section === "money") return byKind === "needs-you" ? "quiet" : byKind;
    return byKind;
  }
  // A line in needs-you that names no kind is a DERIVED demand -- a crossed kill line, an
  // overdue job, an unevaluated panel. It is in needs-you by construction, so it wears
  // needs-you.
  if (section === "needs-you") return "needs-you";
  return "quiet";
}

/**
 * @typedef {object} DisplayBrief
 * @property {BriefSection[]} sections
 * @property {string[]} notices
 * @property {string | null} day
 * @property {number} lines        what this render costs, in lines
 * @property {number} budget
 * @property {string[]} collapsedHere  groups this function collapsed that arrived expanded
 * @property {string | null} note      said out loud when the day cannot fit one screen
 */

/**
 * Honour the 40-line budget a second time, with arc-brief's own precedence: background
 * and ungrouped always become counts, progress only if the day still overflows, and
 * needs-you and money never do.
 *
 * When needs-you and money alone exceed the budget, this SAYS SO and renders all of it.
 * Truncating the one group the whole budget mechanism exists to protect would be the
 * exact failure it was built to prevent.
 * @param {ParsedBrief} parsed
 * @param {number} budget
 * @returns {DisplayBrief}
 */
export function collapseBrief(parsed, budget = BRIEF_BUDGET) {
  const sections = parsed.sections.map((s) => ({ ...s, lines: s.lines.slice() }));
  /** @type {string[]} */
  const collapsedHere = [];

  const cost = () => {
    let n = parsed.day === null ? 0 : 1;
    for (const s of sections) n += s.collapsed ? 1 : 1 + s.lines.length;
    return n + parsed.notices.length;
  };

  /** @param {string} name */
  const collapse = (name) => {
    for (const s of sections) {
      if (s.name !== name || s.collapsed) continue;
      if (NEVER_COLLAPSE.indexOf(name) !== -1) continue;
      /** @type {Map<string, number>} */
      const counts = new Map();
      for (const l of s.lines) if (l.kind !== "") counts.set(l.kind, (counts.get(l.kind) ?? 0) + 1);
      const parts = [...counts.keys()].sort().map((k) => `${k} ${counts.get(k)}`).join(" · ");
      s.collapsed = true;
      s.summary = parts === "" ? `${name}: ${s.count ?? s.lines.length}` : `${name}: ${s.count ?? s.lines.length} (${parts})`;
      collapsedHere.push(name);
    }
  };

  for (const name of ALWAYS_COLLAPSE) collapse(name);
  if (cost() > budget) collapse("progress");

  const lines = cost();
  const note = lines > budget
    ? `This day does not fit one screen: ${lines} lines against a budget of ${budget}, and what is left is needs-you and money, which never collapse. Nothing here is hidden.`
    : null;

  return { sections, notices: parsed.notices, day: parsed.day, lines, budget, collapsedHere, note };
}

/* ========================================================================== *
 * 6. since you left -- the cursor diff
 * ========================================================================== */

/** Where this browser keeps the owner's mark. One key, one browser, never the spine. */
export const MARK_KEY = "arc.face.today.mark";

const ULID_RE = /^[0-7][0-9A-HJKMNP-TV-Z]{25}$/;

/** @param {unknown} v @returns {v is string} */
export function isUlid(v) {
  return typeof v === "string" && ULID_RE.test(v);
}

/**
 * @typedef {object} SinceView
 * @property {boolean} known      false = this browser has never set a mark
 * @property {number | null} receipts
 * @property {boolean} atLeast    the page was capped; the real number is higher
 * @property {number | null} needsYou
 * @property {string | null} mark
 * @property {string} sentence
 */

/**
 * "Since you left: N receipts, M need you."
 *
 * N is the door's own `count` for `/api/spine?since=<mark>` -- never a length this file
 * measured. M counts the OPEN approvals whose id sorts after the mark, which works
 * because a ULID's first ten characters are its millisecond timestamp in Crockford
 * base32: lexicographic order IS time order, and no clock in this browser is consulted.
 *
 * A mark that has never been set is not zero and does not render as zero.
 * @param {{ mark: string | null, page: SpinePage | null, open: Approval[] }} input
 * @returns {SinceView}
 */
export function sinceYouLeft({ mark, page, open }) {
  if (!isUlid(mark)) {
    return {
      known: false,
      receipts: null,
      atLeast: false,
      needsYou: null,
      mark: null,
      sentence: "No mark set in this browser yet, so there is nothing to measure a visit against. Set one below and the next visit counts from here.",
    };
  }
  const receipts = page === null ? null : page.count;
  const atLeast = page !== null && page.more;
  const needsYou = open.filter((a) => a.id > mark).length;

  let sentence;
  if (receipts === null) {
    sentence = "The door has not answered for the window since your mark yet.";
  } else if (receipts === 0) {
    sentence = `Since your mark: nothing. The log has not moved, and ${needsYou === 0 ? "nothing new is waiting" : `${needsYou} raised before it still needs you`}.`;
  } else {
    sentence = `Since you left: ${atLeast ? "at least " : ""}${fmtInt(receipts)} receipt${receipts === 1 ? "" : "s"}, ${fmtInt(needsYou)} need${needsYou === 1 ? "s" : ""} you.`;
  }
  return { known: true, receipts, atLeast, needsYou, mark, sentence };
}

/* ========================================================================== *
 * 7. the KPI row
 *
 * Six numbers, each one a field the door returned, each one carrying the route and the
 * field it came from so the owner can get from the number to the thing that caused it.
 * ========================================================================== */

/**
 * @typedef {"measured" | "never-fired" | "fired" | "not-served"} TileState
 */

/**
 * @typedef {object} Tile
 * @property {string} key
 * @property {string} label
 * @property {string} value       already formatted; "" when the state carries the meaning
 * @property {TileState} state
 * @property {Tone} tone
 * @property {string} why         the exact route and field. The *Why?* precedent.
 * @property {string} note        the sentence that keeps a zero from lying
 */

/**
 * @param {{ health: HealthView | null, inbox: InboxView | null }} input
 * @returns {Tile[]}
 */
export function kpiTiles({ health, inbox }) {
  /** @type {Tile[]} */
  const tiles = [];

  /**
   * @param {string} key @param {string} label @param {number | null} n
   * @param {string} why @param {Tone} tone @param {string} note
   */
  const counted = (key, label, n, why, tone = "quiet", note = "") => {
    tiles.push(n === null
      ? { key, label, value: "—", state: "not-served", tone: "quiet", why, note: "the door did not serve this field on this read" }
      : { key, label, value: fmtInt(n), state: "measured", tone, why, note });
  };

  counted("receipts", "receipts on the spine", health === null ? null : health.events,
    "GET /api/health → spine.events", "quiet",
    "counted from the log on every read; a stored total would be a second truth");

  tiles.push(health === null || health.days === null || health.daysClosed === null
    ? { key: "days", label: "days sealed", value: "—", state: "not-served", tone: "quiet", why: "GET /api/health → spine.daysClosed of spine.days", note: "the door did not serve this field on this read" }
    : {
      key: "days", label: "days sealed", value: `${fmtInt(health.daysClosed)}/${fmtInt(health.days)}`,
      state: "measured", tone: "quiet", why: "GET /api/health → spine.daysClosed of spine.days",
      note: "a sealed day is one a day.closed receipt has shut",
    });

  counted("kinds", "kinds have ever fired", health === null ? null : health.kindsSeen,
    "GET /api/health → spine.kindsSeen", "quiet",
    "the door does not serve the vocabulary's size, so this number carries no denominator here — the rest is built, tested, and unexercised");

  counted("open", "waiting on you", inbox === null ? null : inbox.openCount,
    "GET /api/inbox → openCount",
    inbox !== null && inbox.openCount !== null && inbox.openCount > 0 ? "needs-you" : "quiet",
    inbox !== null && inbox.openCount === 0 ? "measured, and it is zero: every approval raised has been decided" : "open approval.requested, folded against decision.recorded on every read");

  tiles.push(moneyTile(health));
  tiles.push(incidentTile(health));
  return tiles;
}

/**
 * REAL MONEY, and the one tile that must not print a numeral.
 *
 * `/api/pnl` exists, but nothing on this route hands Today a total it may render, and a
 * "₹0" assembled here would be a number with no receipt behind it. What the door DOES
 * serve is `spine.kinds` -- so this tile reports the state of the kind that records money,
 * which is a fact with a log entry behind it (or, precisely, the absence of one).
 * @param {HealthView | null} health
 * @returns {Tile}
 */
export function moneyTile(health) {
  const why = "GET /api/health → spine.kinds (the set of kinds that have ever fired)";
  if (health === null) return { key: "money", label: "real revenue", value: "—", state: "not-served", tone: "quiet", why, note: "the door has not answered yet" };
  const fired = health.kinds.indexOf("revenue.received") !== -1;
  return fired
    ? { key: "money", label: "real revenue", value: "recorded", state: "fired", tone: "real-money", why, note: "revenue.received has fired — the Money room holds the amount; this room does not total it" }
    : { key: "money", label: "real revenue", value: "never", state: "never-fired", tone: "quiet", why, note: "revenue.received has never fired. Not zero rupees measured — no measurement exists. The company is proven to work and has not earned." };
}

/**
 * @param {HealthView | null} health
 * @returns {Tile}
 */
export function incidentTile(health) {
  const why = "GET /api/health → spine.kinds (the set of kinds that have ever fired)";
  if (health === null) return { key: "incident", label: "incidents", value: "—", state: "not-served", tone: "quiet", why, note: "the door has not answered yet" };
  const fired = health.kinds.indexOf("incident.raised") !== -1;
  return fired
    ? { key: "incident", label: "incidents", value: "raised", state: "fired", tone: "incident", why, note: "incident.raised has fired — the Spine room holds each one" }
    : { key: "incident", label: "incidents", value: "never", state: "never-fired", tone: "quiet", why, note: "incident.raised has never fired. Nothing has been declared an incident on this spine." };
}

/* ========================================================================== *
 * 8. the keyboard model
 * ========================================================================== */

export const KEYS = Object.freeze({ next: "j", prev: "k", approve: "a", reject: "r", cancel: "Escape" });

export const KEY_HINT = "j / k move · a arms approve · r arms reject · enter records the armed verdict · esc steps back";

/**
 * @typedef {{ type: "move", index: number }
 *   | { type: "arm", verdict: "approve" | "reject" }
 *   | { type: "disarm" }
 *   | { type: "ignore", why: string }} KeyAction
 */

/**
 * The whole keyboard model, as one pure function.
 *
 * `a` and `r` ARM a verdict and put the cursor in the reason field. They do not stamp.
 * The owner's reason is mandatory and nothing may write it for him, so a key that
 * completed the act would have to invent the words -- which is precisely what the
 * reference implementation did ("cleared via keyboard — evidence on the card") and
 * precisely what this product may not do. One keystroke gets him to the field; the
 * sentence he types is the decision.
 *
 * @param {{ key: string, typing: boolean, modified: boolean, index: number, count: number }} ctx
 * @returns {KeyAction}
 */
export function keyAction({ key, typing, modified, index, count }) {
  // ⌘K, ctrl-r, alt-tab: the shell and the browser own those. A room that swallows them
  // is a room that breaks reload.
  if (modified) return { type: "ignore", why: "a modifier is held" };
  if (key === KEYS.cancel) return { type: "disarm" };
  // Every letter typed into the reason box is a letter, not a command. This is the branch
  // that stops `a` inside the word "again" from arming a stamp.
  if (typing) return { type: "ignore", why: "the reason field has focus" };
  if (count === 0) return { type: "ignore", why: "nothing is waiting" };

  if (key === KEYS.next) return { type: "move", index: clamp(index + 1, count) };
  if (key === KEYS.prev) return { type: "move", index: clamp(index - 1, count) };
  if (key === KEYS.approve) return { type: "arm", verdict: "approve" };
  if (key === KEYS.reject) return { type: "arm", verdict: "reject" };
  return { type: "ignore", why: "not a binding in this room" };
}

/**
 * Clamped, never wrapped. Wrapping moves the selection from the last card to the first
 * one, which on a surface whose next keystroke arms a stamp means the target changed
 * under the owner's hand.
 * @param {number} i @param {number} count
 */
export function clamp(i, count) {
  if (count <= 0) return 0;
  if (i < 0) return 0;
  return i > count - 1 ? count - 1 : i;
}

/* ========================================================================== *
 * 9. the reason, and the one write
 * ========================================================================== */

/** The spine's own ceiling (`validate.mjs` MAX_REASON_BYTES), not a number invented here. */
export const MAX_REASON_BYTES = 2000;

/**
 * The placeholder is a promise: nothing will appear in this box that the owner did not
 * type. It says so, because an empty box with a helpful-looking hint is how people learn
 * to expect a draft.
 */
export const REASON_PLACEHOLDER = "Your reason, in your own words — arc will not draft this for you";

/**
 * C0, DEL and C1 -- byte for byte the range `validate.mjs` refuses in a decision reason.
 * A line break is in it, which is why the reason field submits on Enter rather than
 * growing a second line the spine would reject.
 * @param {string} s
 */
export function hasControlChar(s) {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x20 || c === 0x7f || (c >= 0x80 && c <= 0x9f)) return true;
  }
  return false;
}

/** @param {string} s @returns {number} */
export function byteLength(s) {
  return new TextEncoder().encode(s).length;
}

/**
 * @typedef {object} ReasonCheck
 * @property {boolean} ok
 * @property {string} value   trimmed; what would actually be written
 * @property {number} bytes
 * @property {string | null} code
 * @property {string} human
 */

/**
 * Every rule here is the SPINE'S rule, read from `validate.mjs`: non-empty, at most 2000
 * bytes, no control character. None of them is a house style invented in the browser --
 * a face that refuses what the CLI accepts is a second, quieter policy, and the two would
 * drift.
 *
 * It runs before the request leaves, not instead of the door: the door's BAD_REASON stays
 * the authority. Being told the box is empty after a round trip is simply worse.
 * @param {string} raw
 * @returns {ReasonCheck}
 */
export function validateReason(raw) {
  const value = typeof raw === "string" ? raw.trim() : "";
  const bytes = byteLength(value);
  if (value.length === 0) {
    return { ok: false, value, bytes, code: "BAD_REASON", human: KNOWN_REFUSALS["BAD_REASON"] ?? "A reason is required, in your own words." };
  }
  if (hasControlChar(value)) {
    return { ok: false, value, bytes, code: "BAD_REASON", human: "A reason is one line. The spine refuses a control character — a line break included — because it would smuggle terminal escapes into every surface that prints this receipt later." };
  }
  if (bytes > MAX_REASON_BYTES) {
    return { ok: false, value, bytes, code: "BAD_REASON", human: `This reason is ${fmtInt(bytes)} bytes; the spine's ceiling is ${fmtInt(MAX_REASON_BYTES)}.` };
  }
  return { ok: true, value, bytes, code: null, human: "" };
}

/**
 * THE ONE WRITE IN THE PRODUCT.
 *
 * It goes through `door.call` rather than through `Door.decide()` for a reason that is a
 * defect, not a preference: `Door.decide()` posts `{ id, decision, reason }`, and
 * `/api/decide` reads `{ id, verdict, reason }` (`arc-dash.mjs` apiDecide). A stamp sent
 * through that method arrives with `verdict === undefined` and is refused BAD_VERDICT,
 * every time. The room speaks the door's actual language; the client's method needs the
 * field renamed on one side or the other, which is a change to a file this room does not
 * own.
 *
 * There is no retry. A write that may already have landed must never be sent twice --
 * arc-inbox keys a decision's idem to the approval it decides precisely so a second one
 * collides, and a client that hides that by retrying is a client that hides a double
 * stamp.
 *
 * @param {import("./door.mjs").Door} door
 * @param {{ id: string, verdict: "approve" | "reject", reason: string }} stampIt
 * @returns {Promise<unknown>}
 */
export function stamp(door, { id, verdict, reason }) {
  if (!isUlid(id)) throw new DoorError("UNKNOWN_APPROVAL", `${id} is not the id of an approval on this spine`, 0);
  if (verdict !== "approve" && verdict !== "reject") throw new DoorError("BAD_VERDICT", `verdict must be approve or reject, got ${JSON.stringify(verdict)}`, 0);
  const check = validateReason(reason);
  if (!check.ok) throw new DoorError(check.code ?? "BAD_REASON", check.human, 0);
  return door.call("/api/decide", { method: "POST", body: { id, verdict, reason: check.value } });
}

/**
 * @typedef {object} StampResult
 * @property {string} decided    the approval that was decided
 * @property {string} verdict
 * @property {string | null} receipt  the decision.recorded id, when the door returned it
 */

/**
 * What came back from the one write. The door answers with the decision event it just
 * folded back out of the spine, so the receipt id shown to the owner is a real one --
 * read from the response, never assembled here.
 * @param {unknown} raw
 * @returns {StampResult}
 */
export function readStampResult(raw) {
  const o = asObject(raw);
  const decision = asObject(o["decision"]);
  return {
    decided: asToken(o["decided"], ""),
    verdict: asToken(o["verdict"], ""),
    receipt: typeof decision["id"] === "string" ? decision["id"] : null,
  };
}

/* ========================================================================== *
 * 10. the card body
 * ========================================================================== */

/**
 * The fields an approval payload is most often built from, in the order a person reads
 * them. Anything not on this list still renders -- sorted, after these -- because an
 * approval profile this shell has never seen is exactly the case where dropping a field
 * turns a decision into a rubber stamp.
 */
const BODY_FIRST = Object.freeze([
  "subject", "what", "gate", "why", "venture", "lane", "phase",
  "action_kind", "capability", "from_level", "to_level",
  "candidate", "labels", "fixtures", "digest",
  "draft_ref", "draft_sha", "campaign", "lint_status", "evidence_path",
]);

/**
 * @typedef {object} BodyRow
 * @property {string} key
 * @property {string} value
 * @property {"text" | "list" | "json"} shape
 */

/**
 * Render an approval's payload in full. Every key present appears; none is renamed and
 * none is prettified. `approval.requested` is a generic kind with per-gate profiles
 * (ADR-1017), so this file cannot know the shape of the next one -- and an unknown field
 * silently omitted is a fact the owner decided without.
 * @param {Record<string, unknown>} payload
 * @returns {BodyRow[]}
 */
export function approvalBody(payload) {
  const keys = Object.keys(payload ?? {});
  const first = BODY_FIRST.filter((k) => keys.indexOf(k) !== -1);
  const rest = keys.filter((k) => BODY_FIRST.indexOf(k) === -1).sort();
  /** @type {BodyRow[]} */
  const rows = [];
  for (const key of [...first, ...rest]) {
    const v = payload[key];
    if (typeof v === "string") rows.push({ key, value: decodeDoorText(v), shape: "text" });
    else if (typeof v === "number" || typeof v === "boolean") rows.push({ key, value: String(v), shape: "text" });
    else if (v === null) rows.push({ key, value: "null", shape: "text" });
    else if (Array.isArray(v)) rows.push({ key, value: v.map((x) => (typeof x === "string" ? decodeDoorText(x) : JSON.stringify(x))).join(" · "), shape: "list" });
    else rows.push({ key, value: decodeDoorText(JSON.stringify(v, null, 2)), shape: "json" });
  }
  return rows;
}

/* ========================================================================== *
 * 11. small formatters -- shared, so two rooms cannot format one fact two ways
 * ========================================================================== */

/**
 * Thousands grouping, written out rather than delegated to toLocaleString: the locale of
 * the browser is not a property of the log, and the same receipt count must read the same
 * on every machine that opens this door.
 * @param {number} n
 * @returns {string}
 */
export function fmtInt(n) {
  if (typeof n !== "number" || !Number.isFinite(n)) return "—";
  const negative = n < 0;
  const digits = String(Math.abs(Math.trunc(n)));
  let out = "";
  for (let i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 === 0) out += ",";
    out += digits[i] ?? "";
  }
  return negative ? `-${out}` : out;
}

/**
 * The last six of a ULID -- enough to recognise a receipt, short enough to sit in a row.
 * @param {string} id
 * @returns {string}
 */
export function shortId(id) {
  return typeof id === "string" && id.length > 6 ? id.slice(-6) : String(id ?? "");
}

/**
 * HH:MM, sliced rather than parsed. The door's `ts` is already rendered in the company's
 * timezone; handing it to `new Date()` and formatting it back would re-state it in the
 * browser's zone, which is a different claim about when the event happened.
 * @param {string} ts
 */
export function timeOfDay(ts) {
  return typeof ts === "string" && ts.length >= 16 ? ts.slice(11, 16) : "";
}

/** @param {string} iso */
export function dayOf(iso) {
  return typeof iso === "string" && iso.length >= 10 ? iso.slice(0, 10) : "";
}

/**
 * How long an approval has been waiting, against the DOOR's clock rather than this
 * machine's. Both strings carry their offset, so the difference is honest even when the
 * browser's timezone is not the company's. Unparsable input renders nothing at all --
 * a wrong age on a waiting approval is worse than no age.
 * @param {string} ts @param {string} now
 * @returns {string}
 */
export function ageSentence(ts, now) {
  const a = Date.parse(ts);
  const b = Date.parse(now);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return "";
  const mins = Math.floor((b - a) / 60000);
  if (mins < 0) return "";
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

/**
 * The last `n` of a page, for the live timeline. The door pages from the START of the log
 * (`applyFilters` slices `0..limit`), so the newest events are at the END of what it
 * returns -- taking the head would show the owner the oldest events of the day under a
 * heading that says "live".
 * @template T
 * @param {T[]} items @param {number} n
 * @returns {T[]}
 */
export function tail(items, n) {
  return items.length <= n ? items.slice() : items.slice(items.length - n);
}
