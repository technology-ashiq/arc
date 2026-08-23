// ask.mjs -- every decision the Council chamber and Ask arc make.
//
// Two rooms, one module, for the reason face/README.md gives and the reason phase-07's own
// spec turns on: CI never runs `npm install` at the repo root, so a branch inside a .tsx is
// a branch nobody can exercise. The branch that decides whether an answer is VERIFIED is the
// single most load-bearing branch in this product -- "a citation that does not resolve to a
// ULID via L2 marks the answer *unverified* (never silently kept)" is a DoD line, not a
// nicety -- so it lives here, in plain ESM, where `node` can hold it with no build step.
//
// The two rooms share a module because they share the thing that makes them the same room in
// two moods: BOTH ARE READS. The Council chamber renders a verdict a panel of agents earned;
// Ask arc renders an answer a brain assembled. Neither may act, and the audit that proves it
// (`noHandsAudit`) is one function used by both.
//
// Nothing here imports React, Vite, three, or anything under `.claude/**` (README: face/'s
// only contract with arc is HTTP). It imports the door client and rooms.mjs, which are peers.

import { unescapeDoorText } from "./door.mjs";
import { displayValue } from "./rooms.mjs";

/* ========================================================================== *
 * 0. vocabulary the spine and the council command already fixed
 *
 * Every constant below is a SECOND SPELLING of something that lives in the arc
 * repo, and that is a debt, not a design. It is unavoidable: `face/` may not
 * import `.claude/**`, and the sanctioned endpoint set is closed (phase-06:
 * "any new L2 endpoint" is out of scope), so there is no route that serves the
 * council's own vocabulary. Every constant therefore NAMES ITS SOURCE FILE, and
 * each is the kind of value a cross-layer test can pin against that file the
 * way `door.decide`'s wire field is pinned against arc-dash's source.
 * ========================================================================== */

/** Crockford base32 x26. Source: `.claude/scripts/hq/lib/canonical.mjs` ULID_RE. */
export const ULID_RE = /^[0-7][0-9A-HJKMNP-TV-Z]{25}$/;

/** The same shape, scanned out of prose. See `ulidsIn` for why the boundaries matter. */
const ULID_IN_TEXT = /\b[0-7][0-9A-HJKMNP-TV-Z]{25}\b/g;

/** Source: `initiatives/face/contracts/rooms.generated.json`, room `council-chamber`. */
export const COUNCIL_KINDS = Object.freeze(["council.verdict", "council.outcome", "decision.recorded"]);

/** The two kinds this room DERIVES from. `decision.recorded` is homed here too but is the
 *  Inbox's act; it is counted, never re-rendered as if the council had stamped it. */
export const COUNCIL_PAIR = Object.freeze(["council.verdict", "council.outcome"]);

/** Closed enums. Source: `assertCouncil` in `.claude/scripts/hq/lib/validate.mjs`. Case-exact
 *  there and case-exact here: "high" is not "High", and a normalised bucket is a bucket whose
 *  probability was picked by the normaliser rather than by the juror. */
export const COUNCIL_CALLS = Object.freeze(["proceed", "hold"]);
export const COUNCIL_OUTCOMES = Object.freeze(["happened", "did-not-happen", "unresolved"]);

/** ADR-0009's buckets: the probabilities the council's words CLAIM to mean. Source:
 *  `BUCKETS` in `.claude/scripts/evolve/calibrate.mjs`. */
export const CONFIDENCE_BUCKETS = Object.freeze({ High: 0.85, Medium: 0.65, Low: 0.5 });

/** Below this many SCORED sessions no figure is reported at all. Source: `DEFAULT_FLOOR`,
 *  same file. Three scored sessions produce a Brier score to four decimal places and it means
 *  nothing; the floor is what stops a precise-looking number being read as a reliable one. */
export const CALIBRATION_FLOOR = 20;

/** The words used instead of a number below the floor. Source: `INSUFFICIENT`, same file. */
export const INSUFFICIENT = "insufficient evidence";

/**
 * How a verdict is EARNED, in the order the council walks it. Source: the numbered steps of
 * `.claude/commands/arc-council.md` ("Full council", steps 1-6 plus the emit).
 *
 * This is the room's spine: the owner opening the Council chamber is not asking what the
 * council concluded, he is asking why a conclusion from a pile of language models is worth
 * anything at all. The answer is the method, so the method is the page.
 */
export const COUNCIL_STAGES = Object.freeze([
  Object.freeze({
    key: "intake",
    n: 1,
    title: "Intake, and a prediction before any evidence",
    line: "One decision statement, load-bearing ambiguity graded away, the domain roster announced — and the Chair's own one-line PREDICTION recorded BEFORE any research runs, so the run can be checked against what it expected to find.",
    guard: "an ambiguous term left ungraded is a run where the members talk past each other",
  }),
  Object.freeze({
    key: "evidence",
    n: 2,
    title: "Evidence first — one shared brief",
    line: "The question is decomposed into 3-5 sub-questions and one researcher takes each. Their FACT PACKs assemble into ONE neutral Evidence Brief, facts only, renumbered F1…",
    guard: "every member argues from the same brief, so a disagreement is about the reading and not about who was told what",
  }),
  Object.freeze({
    key: "convene",
    n: 3,
    title: "Blind parallel debate",
    line: "The stance members and every matched expert are spawned in a SINGLE message, each given the same statement and the same brief. Never sequentially, and never one member's answer inside another's prompt. Each output is persisted VERBATIM to a file.",
    guard: "no Chair summary may compress or distort a claim before it is graded",
  }),
  Object.freeze({
    key: "points",
    n: 4,
    title: "Every claim gets an id",
    line: "Each key point is labelled by its member — Advocate A1…, Skeptic S1…, Neutral N1…, and each expert by its own prefix. From here on the debate is addressable.",
    guard: "an unlabelled point cannot be graded, rebutted, or cited in the verdict",
  }),
  Object.freeze({
    key: "cross-examine",
    n: 5,
    title: "Cross-examination grades every point",
    line: "The verifier reads the member files and the fact packs — the files, never a summary — and rates every POINT-ID Supported / Plausible / Weak / Contested, then returns CONTRADICTIONS, CONSENSUS, DISPUTED and DROP THESE.",
    guard: "it grades the EVIDENCE behind a point, not whether it agrees with the conclusion",
  }),
  Object.freeze({
    key: "rebuttal",
    n: 6,
    title: "One bounded rebuttal — and only one",
    line: "The rebuttal set is every id rated Contested plus everything under DISPUTED. Each gets ONE targeted rebuttal, then the verifier re-grades ONLY those ids. An id whose evidence still does not carry stays Contested or Weak and appears under UNRESOLVED.",
    guard: "bounded at one round on purpose — an unbounded rebuttal is a debate that ends when someone gets tired",
  }),
  Object.freeze({
    key: "verdict",
    n: 7,
    title: "A verdict that commits, carrying its dissent",
    line: "Weak points are dropped, the survivors weighed, and the call is made — with the DISSENT printed beside it, a Review-by date, and the falsifiable criterion that will later count this verdict HIT or MISS.",
    guard: "every id cited in the reasons or the dissent must be one the verifier rated Supported or Plausible",
  }),
  Object.freeze({
    key: "receipt",
    n: 8,
    title: "The call becomes a receipt",
    line: "A deep run emits `council.verdict` — the call and the confidence bucket it was made at. What actually happened is a distinct later fact and gets its own kind, `council.outcome`, recorded when reality answers.",
    guard: "a Markdown session file is a claim; a receipt is a fact — calibration is computed only from the receipts",
  }),
]);

/**
 * The verifier's four grades and what each one COSTS a point. Source: steps 5, 5b and 6 of
 * `.claude/commands/arc-council.md`.
 *
 * Rendered as a table rather than as prose because the grade is the mechanism: "Weak" is not
 * a hedge, it is a deletion, and a reader who does not know that reads the verdict wrong.
 */
export const GRADES = Object.freeze([
  Object.freeze({ grade: "Supported", means: "the evidence behind the point carries it", fate: "survives; may be cited in the verdict and in the dissent" }),
  Object.freeze({ grade: "Plausible", means: "reasonable, but the evidence does not close it", fate: "survives, weighed lower; may be cited" }),
  Object.freeze({ grade: "Weak", means: "the evidence does not support the claim", fate: "DROPPED before deliberation — it cannot reach the verdict" }),
  Object.freeze({ grade: "Contested", means: "the evidence is disputed by other evidence in the brief", fate: "enters the rebuttal set; re-graded once, and if it still does not carry it lands under UNRESOLVED" }),
]);

/**
 * The twelve seats, by the agent id the contract homes in this room. Source: the "Domain
 * roster" table and steps 2/3/5 of `.claude/commands/arc-council.md`.
 *
 * `when` is the honest half: four of the twelve are convened for EVERY run and seven are
 * convened only when the question touches their domain, ceiling four. A seat map that showed
 * twelve chairs always filled would be a picture of a council that does not exist.
 * @type {Readonly<Record<string, Readonly<{ seat: string, prefix: string|null, when: string }>>>}
 */
export const SEATS = Object.freeze({
  "council-researcher": Object.freeze({ seat: "Researcher", prefix: "F", when: "every run — one per sub-question, cap 5" }),
  "council-advocate": Object.freeze({ seat: "Advocate", prefix: "A", when: "every run" }),
  "council-skeptic": Object.freeze({ seat: "Skeptic", prefix: "S", when: "every run" }),
  "council-neutral": Object.freeze({ seat: "Neutral", prefix: "N", when: "every run" }),
  "council-verifier": Object.freeze({ seat: "Verifier", prefix: null, when: "every non-quick run — it grades, it does not argue" }),
  "council-strategist": Object.freeze({ seat: "Strategist", prefix: "ST", when: "startup · business · product-market · GTM" }),
  "council-risk-analyst": Object.freeze({ seat: "Risk analyst", prefix: "RK", when: "finance · investment · budget · valuation" }),
  "council-marketer": Object.freeze({ seat: "Marketer", prefix: "MK", when: "marketing · growth · positioning · brand" }),
  "council-designer": Object.freeze({ seat: "Designer", prefix: "DS", when: "design · UX · usability · product-feel" }),
  "council-engineer": Object.freeze({ seat: "Engineer", prefix: "EN", when: "development · architecture · engineering" }),
  "council-policy-analyst": Object.freeze({ seat: "Policy analyst", prefix: "PO", when: "politics · policy · regulation · societal" }),
  "council-life-counselor": Object.freeze({ seat: "Life counselor", prefix: "LC", when: "career · relationship · life choice" }),
});

/** Seats convened on every run, as opposed to the domain roster the Chair selects from. */
const STANDING_SEATS = new Set(["council-researcher", "council-advocate", "council-skeptic", "council-neutral", "council-verifier"]);

/* ========================================================================== *
 * 1. room copy
 * ========================================================================== */

/** Source: `initiatives/face/contracts/room-copy.json`. The registry serves these over the
 *  door and wins; the constants below exist so a room still opens with its own words if the
 *  registry read is the thing that failed. */
export const ROOM_SENTENCE = Object.freeze({
  "council-chamber": "Twelve seats. No rubber stamps.",
  "ask-arc": "Ask in words. Every answer carries its receipt.",
});

export const ROOM_LEDE = Object.freeze({
  "council-chamber": "blind parallel debate, a verifier grading every point, one bounded rebuttal, then a verdict that commits with its dissent",
  "ask-arc": "a brain with no hands — it reads the live state, cites the ULID, and cannot stamp anything",
});

/**
 * Which words a room opens with, in precedence order: what the shell was told explicitly,
 * then the registry's own entry (escaped, like everything the door serves), then the constant.
 * @param {"council-chamber" | "ask-arc"} id
 * @param {{ sentence?: string, lede?: string } | undefined} room
 * @param {{ sentence?: string, lede?: string }} [overrides]
 * @returns {{ sentence: string, lede: string }}
 */
export function roomOpening(id, room, overrides = {}) {
  const reg = room ?? {};
  return {
    sentence: overrides.sentence ?? (typeof reg.sentence === "string" && reg.sentence !== ""
      ? unescapeDoorText(reg.sentence) : ROOM_SENTENCE[id]),
    lede: overrides.lede ?? (typeof reg.lede === "string" && reg.lede !== ""
      ? unescapeDoorText(reg.lede) : ROOM_LEDE[id]),
  };
}

/* ========================================================================== *
 * 2. the no-hands boundary, computed rather than promised
 *
 * REQ-07's rule is "zero write tools", and a room can honour that in two ways:
 * by not drawing a button, or by not HOLDING the method. Only the second can be
 * shown to a reader. `readOnly` hands each room a handle carrying exactly the
 * routes it needs, and `noHandsAudit` enumerates that handle's real methods and
 * classifies each against the door's own route table. The panel prints what the
 * audit computed -- so if a later edit passes the raw Door, the panel changes
 * by itself instead of continuing to claim a boundary that has gone.
 * ========================================================================== */

/**
 * The door's route table, as the two rooms need to describe it. Mirrors `ROUTES` in
 * `.claude/scripts/hq/arc-dash.mjs`, including its `spineEffect` vocabulary:
 *   write    this door writes the spine itself. There is exactly one.
 *   receipt  a GOVERNED subprocess writes under policy, budgeted and tier-pinned.
 *   none     reads only; nothing about the route can reach the spine's writer.
 * @type {Readonly<Record<string, Readonly<{ route: string, spineEffect: "write"|"receipt"|"none", writes: boolean, note: string }>>>}
 */
export const ROUTE_EFFECT = Object.freeze({
  health: Object.freeze({ route: "GET /api/health", spineEffect: "none", writes: false, note: "spine health and the cursor" }),
  spine: Object.freeze({ route: "GET /api/spine", spineEffect: "none", writes: false, note: "the log, cursor-paged — this is how a cited ULID is resolved" }),
  inbox: Object.freeze({ route: "GET /api/inbox", spineEffect: "none", writes: false, note: "what is waiting on the owner, read-only" }),
  lane: Object.freeze({ route: "GET /api/lane/:id", spineEffect: "none", writes: false, note: "one lane's header" }),
  file: Object.freeze({ route: "GET /api/file/:id", spineEffect: "none", writes: false, note: "allow-listed files only" }),
  board: Object.freeze({ route: "GET /api/board", spineEffect: "none", writes: false, note: "the lane board" }),
  rooms: Object.freeze({ route: "GET /api/rooms", spineEffect: "none", writes: false, note: "the room registry" }),
  brief: Object.freeze({ route: "GET /api/brief", spineEffect: "none", writes: false, note: "today's brief" }),
  pnl: Object.freeze({ route: "GET /api/pnl", spineEffect: "none", writes: false, note: "money, real and simulated held apart" }),
  ask: Object.freeze({
    route: "POST /api/ask", spineEffect: "receipt", writes: false,
    note: "asking is a READ of the company. When the governed process runs it emits one `run.completed` under policy — that is the subprocess's receipt, not a write by this room, and naming it is the difference between a contract and a comfortable label.",
  }),
  decide: Object.freeze({
    route: "POST /api/decide", spineEffect: "write", writes: true,
    note: "THE ONE WRITE PATH in this product. It belongs to the Inbox and to the owner's own hand. No room on this page holds it.",
  }),
  call: Object.freeze({
    route: "(the raw caller)", spineEffect: "write", writes: true,
    note: "the generic method can be pointed at POST /api/decide, so it counts as write-capable whatever it is used for.",
  }),
});

/** What Ask arc is granted. Nothing here can write; `ask` costs a governed receipt and says so. */
export const ASK_GRANTS = Object.freeze(["ask", "spine", "inbox", "lane", "file"]);

/**
 * What the Council chamber is granted. It does not even hold `ask`.
 *
 * `rooms` is here so the chamber can read its OWN registry entry rather than depending on the
 * shell to hand it one. The twelve seats come from the contract's agent list, and a room that
 * fell back to a hard-coded twelve when the prop was absent would be carrying a second
 * spelling of the contract — which is the exact failure ADR-1306 names: a renamed agent
 * silently keeps its chair.
 */
export const COUNCIL_GRANTS = Object.freeze(["spine", "rooms"]);

/**
 * Every function-valued key reachable on a handle, own properties and prototype chain alike.
 *
 * The chain walk is the whole point: a `Door` INSTANCE carries its methods on the prototype,
 * so `Object.keys(door)` returns `base`, `token`, `fetchImpl` and no methods at all — an
 * audit built on own keys would look at the raw, fully-armed door client and report a clean
 * bill of health. That is the exact shape of the vacuous pass this repo keeps paying for.
 * @param {object} handle
 * @returns {string[]} sorted, deduplicated
 */
export function methodsOf(handle) {
  /** @type {Set<string>} */
  const found = new Set();
  /** @type {object|null} */
  let node = handle;
  while (node && node !== Object.prototype) {
    for (const key of Object.getOwnPropertyNames(node)) {
      if (key === "constructor") continue;
      const desc = Object.getOwnPropertyDescriptor(node, key);
      // Read the DESCRIPTOR, never the property: touching a getter would run it, and an
      // audit whose act of measuring can execute the thing it is measuring is not an audit.
      if (desc && typeof desc.value === "function") found.add(key);
    }
    node = Object.getPrototypeOf(node);
  }
  return [...found].sort();
}

/**
 * @typedef {object} HandsAudit
 * @property {string[]} granted        read methods reachable on this handle
 * @property {string[]} writeReachable methods that can reach a spine write. MUST be empty.
 * @property {string[]} unclassified   methods the door's route table does not name
 * @property {string[]} withheld       write-capable door methods this handle does NOT carry
 * @property {boolean}  clean          true only when nothing write-capable is reachable
 * @property {string}   line           the sentence the room prints
 */

/**
 * Classify what a handle can actually do. FAILS CLOSED: a method the route table does not
 * name is counted as write-capable, because the alternative is a new door method quietly
 * inheriting a clean audit — the same circularity arc-dash's own route fixture was rebuilt
 * to close ("a new write route labelled mutates:false passed it").
 * @param {object} handle
 * @returns {HandsAudit}
 */
export function noHandsAudit(handle) {
  const methods = methodsOf(handle);
  /** @type {string[]} */ const granted = [];
  /** @type {string[]} */ const writeReachable = [];
  /** @type {string[]} */ const unclassified = [];
  for (const m of methods) {
    const effect = ROUTE_EFFECT[m];
    if (!effect) { unclassified.push(m); writeReachable.push(m); continue; }
    if (effect.writes) writeReachable.push(m); else granted.push(m);
  }
  const withheld = Object.keys(ROUTE_EFFECT).filter((k) => {
    const e = ROUTE_EFFECT[k];
    return Boolean(e && e.writes) && !methods.includes(k);
  }).sort();
  const clean = writeReachable.length === 0;
  return {
    granted, writeReachable, unclassified, withheld, clean,
    line: clean
      ? `${granted.length} read route${granted.length === 1 ? "" : "s"} reachable from this room · 0 write routes · ${withheld.join(", ") || "none"} withheld`
      : `THIS ROOM CAN REACH A WRITE: ${writeReachable.join(", ")}. That is a defect in the wiring, not a feature of the page.`,
  };
}

/**
 * A handle carrying only the named door methods, bound to the door.
 *
 * Bound, not merely referenced, for the reason door.mjs already learned the hard way about
 * `fetch`: a method plucked off an object and called without its receiver loses `this`, and
 * every test that runs it as a plain function passes while the browser throws.
 *
 * An unknown grant is a THROW rather than a silently-missing method: a room that asked for a
 * route the door does not have should fail at construction, not render an empty panel later.
 * @template {object} T
 * @param {T} door
 * @param {readonly string[]} grants
 * @returns {Record<string, (...args: unknown[]) => Promise<unknown>>}
 */
export function readOnly(door, grants) {
  /** @type {Record<string, (...args: unknown[]) => Promise<unknown>>} */
  const handle = {};
  const source = /** @type {Record<string, unknown>} */ (/** @type {unknown} */ (door));
  for (const name of grants) {
    const effect = ROUTE_EFFECT[name];
    if (!effect) throw new Error(`readOnly: "${name}" is not a route this shell knows`);
    if (effect.writes) throw new Error(`readOnly: "${name}" is write-capable and may never be granted to a reading room`);
    const fn = source[name];
    if (typeof fn !== "function") throw new Error(`readOnly: the door has no "${name}" method`);
    handle[name] = /** @type {(...args: unknown[]) => Promise<unknown>} */ (fn.bind(door));
  }
  // Frozen so nothing can bolt a write back on after the fact.
  return Object.freeze(handle);
}

/**
 * Call a granted route by name, or refuse by name.
 *
 * The rooms never index the handle themselves. That is not ceremony: `readOnly` builds the
 * handle from a runtime list, so as far as the type system is concerned every method on it
 * may be absent — and a component that answered that with `?.` would silently do nothing when
 * a grant was missing, which is the empty-panel lie with a fashionable operator. Here the
 * missing grant becomes a refusal with a code, and the room draws it like any other refusal.
 * @param {Record<string, (...args: unknown[]) => Promise<unknown>>} handle
 * @param {string} name
 * @param {...unknown} args
 * @returns {Promise<unknown>}
 */
export function invoke(handle, name, ...args) {
  const fn = handle[name];
  if (typeof fn !== "function") {
    const err = new Error(`this room holds no "${name}" grant`);
    return Promise.reject(Object.assign(err, {
      code: "NOT_GRANTED",
      human: `This room was not granted the ${name} route, so the read was never made. Nothing is drawn in its place.`,
    }));
  }
  return fn(...args);
}

/* ========================================================================== *
 * 3. narrowing what came off the wire
 * ========================================================================== */

/** @typedef {{ code: string, human: string }} Refused */

/**
 * @typedef {object} SpineEnvelope
 * @property {string} day
 * @property {number} seq
 * @property {string} id
 * @property {string} kind
 * @property {string} ts
 * @property {Record<string, unknown>} payload
 */

/** @typedef {{ ok: true, count: number, more: boolean, next: string|null, events: SpineEnvelope[] } | { ok: false } & Refused} SpinePage */

/** @param {unknown} v @returns {Record<string, unknown>|null} */
function asObject(v) {
  return v && typeof v === "object" && !Array.isArray(v) ? /** @type {Record<string, unknown>} */ (v) : null;
}

/** @param {unknown} v @returns {string|null} */
function asText(v) {
  return typeof v === "string" && v.length > 0 ? unescapeDoorText(v) : null;
}

/**
 * The `/api/spine` page, narrowed once, here — not re-dug at each render site.
 * A body without an `events` array is a REFUSAL, never an empty page: "silently returning
 * nothing is how a consumer sleeps through its own broken state" is the spine reader's own
 * comment, and it applies with equal force to the client.
 * @param {unknown} raw
 * @returns {SpinePage}
 */
export function readSpinePage(raw) {
  const body = asObject(raw);
  const list = body && Array.isArray(body.events) ? body.events : null;
  if (!list) {
    return {
      ok: false,
      code: "BAD_BODY",
      human: "The door answered without an event list. Nothing is drawn from that — an empty page and an unreadable one are different things, and only one of them is a fact about the company.",
    };
  }
  /** @type {SpineEnvelope[]} */
  const events = [];
  for (const entry of list) {
    const env = asObject(entry);
    const ev = env ? asObject(env.event) : null;
    if (!ev) continue;
    const id = typeof ev.id === "string" ? ev.id : "";
    const kind = typeof ev.kind === "string" ? ev.kind : "";
    if (!id || !kind) continue;
    events.push({
      day: (env && typeof env.day === "string" ? env.day : ""),
      seq: (env && typeof env.seq === "number" ? env.seq : 0),
      id,
      kind,
      ts: typeof ev.ts === "string" ? ev.ts : "",
      payload: asObject(ev.payload) ?? {},
    });
  }
  const page = body ?? {};
  return {
    ok: true,
    count: typeof page.count === "number" ? page.count : events.length,
    more: page.more === true,
    next: typeof page.next === "string" ? page.next : null,
    events,
  };
}

/**
 * The sentence and the code to show when a read fails. Duck-typed for the same reason
 * `rooms.errorSentence` is: a refusal this shell raises itself must surface through the same
 * path as one the door raised, and the two modules are peers rather than a stack.
 * @param {unknown} err
 * @returns {Refused}
 */
export function refusalOf(err) {
  const e = asObject(err) ?? {};
  const code = typeof e.code === "string" && e.code.length ? e.code : "UNCAUGHT";
  const human = typeof e.human === "string" && e.human.length ? e.human
    : typeof e.message === "string" && e.message.length ? e.message
      : "the read failed and said nothing about why, which is itself the defect";
  return { code, human: unescapeDoorText(human) };
}

/* ========================================================================== *
 * 4. the Council chamber
 * ========================================================================== */

/**
 * @typedef {{ sentence?: string, lede?: string, holds?: { agents?: string[] }, mode?: string }} RoomEntry
 */

/**
 * One room's own entry out of the served registry.
 *
 * The chamber uses this when the shell did not hand it a `room` prop. The registry is the
 * contract as the door serves it, so the seats are read from the same list `face-coverage`
 * validates — never from a copy kept in this file.
 * @param {unknown} raw   the raw GET /api/rooms body
 * @param {string} id
 * @returns {{ ok: true, room: RoomEntry, mode: string|null } | { ok: false } & Refused}
 */
export function roomFromRegistry(raw, id) {
  const body = asObject(raw);
  const list = body && Array.isArray(body.rooms) ? body.rooms : null;
  if (!list) {
    return { ok: false, code: "REGISTRY_ABSENT", human: "The door answered without a room list, so this room cannot read its own entry. The seats are not drawn from a guess." };
  }
  for (const entry of list) {
    const r = asObject(entry);
    if (!r || r.id !== id) continue;
    const holds = asObject(r.holds);
    const agents = holds && Array.isArray(holds.agents)
      ? holds.agents.filter(/** @returns {a is string} */ (a) => typeof a === "string")
      : [];
    return {
      ok: true,
      mode: body && typeof body.mode === "string" ? body.mode : null,
      room: {
        sentence: typeof r.sentence === "string" ? r.sentence : undefined,
        lede: typeof r.lede === "string" ? r.lede : undefined,
        holds: { agents },
      },
    };
  }
  return { ok: false, code: "UNKNOWN_ROOM", human: `The registry the door served carries no room called "${id}". Nothing is drawn in its place.` };
}

/**
 * @typedef {object} Seat
 * @property {string} agent
 * @property {string} seat
 * @property {string|null} prefix
 * @property {string} when
 * @property {boolean} standing  convened on every run, rather than by domain
 * @property {boolean} mapped    false when the contract homes an agent this shell cannot name
 */

/**
 * The twelve seats, from the CONTRACT's agent list rather than from the table above.
 *
 * The contract is the authority on which agents this room homes; `SEATS` only supplies the
 * words. An agent the table cannot name is still rendered — labelled unmapped — because a
 * seat quietly dropped from this page is exactly the missing-room failure the whole product
 * exists to prevent. A seat in the table that the contract no longer homes is reported too.
 * @param {{ holds?: { agents?: string[] } } | null | undefined} room
 * @returns {{ seats: Seat[], counted: number, expected: number, unmapped: string[], retired: string[] }}
 */
export function councilSeats(room) {
  const agents = room && room.holds && Array.isArray(room.holds.agents) ? room.holds.agents : [];
  /** @type {Seat[]} */
  const seats = [];
  /** @type {string[]} */
  const unmapped = [];
  for (const agent of agents) {
    if (typeof agent !== "string" || !agent) continue;
    const known = SEATS[agent];
    if (known) {
      seats.push({ agent, seat: known.seat, prefix: known.prefix, when: known.when, standing: STANDING_SEATS.has(agent), mapped: true });
    } else {
      unmapped.push(agent);
      seats.push({
        agent,
        seat: agent,
        prefix: null,
        when: "this shell has no seat description for this agent — it is drawn anyway rather than dropped",
        standing: false,
        mapped: false,
      });
    }
  }
  // Standing seats first, then the domain roster: that is the order a run fills them in.
  seats.sort((a, b) => (a.standing === b.standing ? 0 : a.standing ? -1 : 1));
  const homed = new Set(agents);
  const retired = Object.keys(SEATS).filter((a) => !homed.has(a));
  return { seats, counted: seats.length, expected: Object.keys(SEATS).length, unmapped, retired };
}

/**
 * @typedef {object} CouncilSession
 * @property {string} sessionId
 * @property {string|null} questionHash
 * @property {string|null} call          "proceed" | "hold"
 * @property {string|null} confidence    "High" | "Medium" | "Low"
 * @property {number|null} claimedProb   what that confidence word claims, per ADR-0009
 * @property {string|null} verdictId     the ULID of the council.verdict receipt
 * @property {string|null} verdictDay
 * @property {string|null} outcome       "happened" | "did-not-happen" | "unresolved"
 * @property {string|null} observedAt
 * @property {string|null} sourceId
 * @property {string|null} outcomeId
 * @property {"hit"|"miss"|"excluded"|"pending"|"orphan"} standing
 * @property {string} reading            the sentence explaining that standing
 */

/**
 * Pair every `council.verdict` with its `council.outcome`, newest first.
 *
 * A `proceed` call is right when the thing HAPPENED; a `hold` call is right when it did not.
 * Scoring both as "happened equals hit" would mark every correct hold as a miss — the defect
 * `calibrate.mjs` names in its own comment, and the reason this pairing is a function rather
 * than an expression inside a component.
 *
 * `orphan` is a real standing: an outcome whose verdict is not on this page (paged out, or
 * never emitted) is reported, not silently dropped into the pending bucket.
 * @param {SpineEnvelope[]} events
 * @returns {{ sessions: CouncilSession[], kindCounts: Record<string, number> }}
 */
export function councilSessions(events) {
  /** @type {Record<string, number>} */
  const kindCounts = {};
  for (const kind of COUNCIL_KINDS) kindCounts[kind] = 0;
  /** @type {Map<string, CouncilSession>} */
  const byId = new Map();
  /** @type {string[]} */
  const order = [];

  /** @param {string} sid */
  const slot = (sid) => {
    const found = byId.get(sid);
    if (found) return found;
    /** @type {CouncilSession} */
    const fresh = {
      sessionId: sid, questionHash: null, call: null, confidence: null, claimedProb: null,
      verdictId: null, verdictDay: null, outcome: null, observedAt: null, sourceId: null,
      outcomeId: null, standing: "pending", reading: "",
    };
    byId.set(sid, fresh);
    order.push(sid);
    return fresh;
  };

  for (const e of events) {
    if (Object.hasOwn(kindCounts, e.kind)) kindCounts[e.kind] = (kindCounts[e.kind] ?? 0) + 1;
    const p = e.payload;
    const sid = typeof p.session_id === "string" ? p.session_id : null;
    if (!sid) continue;
    if (e.kind === "council.verdict") {
      const s = slot(sid);
      s.questionHash = typeof p.question_hash === "string" ? p.question_hash : null;
      s.call = typeof p.call === "string" ? p.call : null;
      s.confidence = typeof p.confidence === "string" ? p.confidence : null;
      s.claimedProb = s.confidence !== null && Object.hasOwn(CONFIDENCE_BUCKETS, s.confidence)
        ? (CONFIDENCE_BUCKETS[/** @type {keyof typeof CONFIDENCE_BUCKETS} */ (s.confidence)] ?? null)
        : null;
      s.verdictId = e.id;
      s.verdictDay = e.day || null;
    } else if (e.kind === "council.outcome") {
      const s = slot(sid);
      s.outcome = typeof p.outcome === "string" ? p.outcome : null;
      s.observedAt = typeof p.observed_at === "string" ? p.observed_at : null;
      s.sourceId = typeof p.source_id === "string" ? p.source_id : null;
      s.outcomeId = e.id;
    }
  }

  for (const s of byId.values()) {
    if (s.call === null) {
      s.standing = "orphan";
      s.reading = "An outcome with no verdict on this page. The call it is scoring is not here — paged out, or never emitted. It is shown rather than folded into the counts.";
    } else if (s.outcome === null) {
      s.standing = "pending";
      s.reading = "The call is on the record and reality has not answered yet. Pending is not a miss and is never scored as one.";
    } else if (s.outcome === "unresolved") {
      s.standing = "excluded";
      s.reading = "Nobody followed this up. `unresolved` is EXCLUDED from the score, not counted as a miss — scoring an absence as zero would manufacture a calibration number out of nothing.";
    } else {
      const happened = s.outcome === "happened";
      const hit = s.call === "proceed" ? happened : !happened;
      s.standing = hit ? "hit" : "miss";
      s.reading = hit
        ? `The council called \`${s.call}\` and reality returned \`${s.outcome}\`. That is a HIT at ${s.confidence ?? "an unrecorded"} confidence.`
        : `The council called \`${s.call}\` and reality returned \`${s.outcome}\`. That is a MISS at ${s.confidence ?? "an unrecorded"} confidence, and it is on the record beside the hits.`;
    }
  }

  // Newest first: a ULID sorts lexicographically by time, so the verdict id is the clock.
  const sessions = order.map((sid) => byId.get(sid)).filter(/** @returns {s is CouncilSession} */ (s) => Boolean(s));
  sessions.sort((a, b) => {
    const ka = a.verdictId ?? a.outcomeId ?? "";
    const kb = b.verdictId ?? b.outcomeId ?? "";
    return ka < kb ? 1 : ka > kb ? -1 : 0;
  });
  return { sessions, kindCounts };
}

/**
 * @typedef {object} Calibration
 * @property {number} scored
 * @property {number} excluded
 * @property {number} pending
 * @property {number} floor
 * @property {{ bucket: string, prob: number, n: number, hits: number, hitRate: number|null }[]} buckets
 * @property {number|null} brier      null below the floor. NEVER a number computed from too little.
 * @property {string} verdict         "calibrated" | INSUFFICIENT
 * @property {string} line            the sentence the room prints instead of a number
 */

/**
 * Is the council's confidence worth anything?
 *
 * A council that says "High confidence" and is right 55 % of the time is not a council with a
 * good record; it is a council whose confidence label means nothing. Two rules, both taken
 * from `.claude/scripts/evolve/calibrate.mjs` and neither of them negotiable:
 *
 *   1. `unresolved` IS NOT A MISS. It is excluded from the score and REPORTED as excluded.
 *   2. BELOW FLOOR IS A SENTENCE, NOT A NUMBER. `brier` stays null and the room says how far
 *      short it is. A hit rate over zero sessions is not 0 % — there is nothing to rate.
 *
 * This is a second implementation of a rule that already exists in the arc repo, which is a
 * debt this module carries knowingly: `face/` may not import `.claude/**` and the sanctioned
 * endpoint set is closed, so there is no third option. The constants name their source.
 * @param {CouncilSession[]} sessions
 * @param {number} [floor]
 * @returns {Calibration}
 */
export function calibration(sessions, floor = CALIBRATION_FLOOR) {
  /** @type {Record<string, { prob: number, n: number, hits: number }>} */
  const acc = {};
  for (const bucket of Object.keys(CONFIDENCE_BUCKETS)) {
    acc[bucket] = { prob: CONFIDENCE_BUCKETS[/** @type {keyof typeof CONFIDENCE_BUCKETS} */ (bucket)], n: 0, hits: 0 };
  }
  let scored = 0, excluded = 0, pending = 0, brierSum = 0;
  for (const s of sessions) {
    if (s.standing === "orphan") continue;
    if (s.standing === "pending") { pending++; continue; }
    if (s.standing === "excluded") { excluded++; continue; }
    const bucket = s.confidence !== null ? acc[s.confidence] : undefined;
    // A verdict whose confidence word is outside the closed set cannot be scored against a
    // probability it never claimed. It is excluded and counted as excluded, not as a miss.
    if (!bucket) { excluded++; continue; }
    const hit = s.standing === "hit";
    bucket.n++;
    if (hit) bucket.hits++;
    brierSum += (bucket.prob - (hit ? 1 : 0)) ** 2;
    scored++;
  }
  const enough = scored >= floor;
  const buckets = Object.keys(CONFIDENCE_BUCKETS).map((bucket) => {
    const b = acc[bucket] ?? { prob: 0, n: 0, hits: 0 };
    return { bucket, prob: b.prob, n: b.n, hits: b.hits, hitRate: b.n === 0 ? null : b.hits / b.n };
  });
  return {
    scored, excluded, pending, floor, buckets,
    brier: enough ? brierSum / scored : null,
    verdict: enough ? "calibrated" : INSUFFICIENT,
    line: enough
      ? `Brier over ${displayValue(scored).text} scored sessions. Lower is better; 0.25 is what a coin scores.`
      : `PENDING ${displayValue(scored).text}/${displayValue(floor).text} — no figure is reported at all below the floor. ${displayValue(scored).text} scored session${scored === 1 ? "" : "s"} would produce a number to four decimal places and it would mean nothing.`,
  };
}

/**
 * @typedef {object} CouncilState
 * @property {SpinePage} page
 * @property {CouncilSession[]} sessions
 * @property {Record<string, number>} kindCounts
 * @property {Calibration} calibration
 * @property {{ kind: string, count: number, state: "live"|"unexercised", note: string }[]} kindRows
 * @property {boolean} everConvened
 */

/**
 * The whole Council chamber in one function, so a test can assert the room without React.
 * @param {unknown} raw  the raw GET /api/spine body, filtered to the council kinds
 * @returns {CouncilState}
 */
export function councilState(raw) {
  const page = readSpinePage(raw);
  const events = page.ok ? page.events : [];
  const { sessions, kindCounts } = councilSessions(events);
  const kindRows = COUNCIL_KINDS.map((kind) => {
    const count = kindCounts[kind] ?? 0;
    return {
      kind,
      count,
      // Never a bare zero. A kind that has not run has no count at all, and collapsing the
      // two is the whole thing the Truth Law turns on.
      state: /** @type {"live"|"unexercised"} */ (count > 0 ? "live" : "unexercised"),
      note: count > 0
        ? `${displayValue(count).text} receipt${count === 1 ? "" : "s"} on this page`
        : "fixture-proven, unexercised — built and tested, never fired. That is a different statement from zero.",
    };
  });
  return {
    page,
    sessions,
    kindCounts,
    calibration: calibration(sessions),
    kindRows,
    everConvened: sessions.length > 0,
  };
}

/**
 * One page of council receipts. The whole spine is on the order of a thousand events, so the
 * door's page cap is a ceiling rather than a paging strategy — and when it is not, `page.more`
 * is rendered rather than a list that looks complete and is not.
 */
export const COUNCIL_PAGE = 1000;

/**
 * Read the chamber. The room calls this and nothing else; the kind filter, the page size and
 * the derivation all live on this side of the line.
 * @param {Record<string, (...args: unknown[]) => Promise<unknown>>} handle
 * @param {AbortSignal} [signal]
 * @returns {Promise<CouncilState>}
 */
export async function readCouncil(handle, signal) {
  const raw = await invoke(handle, "spine", { kind: COUNCIL_KINDS.join(","), limit: COUNCIL_PAGE }, signal);
  return councilState(raw);
}

/**
 * Read one room's own entry out of the served registry, turning a thrown refusal into the
 * same `{ ok: false, code, human }` shape a malformed body produces. Two ways to fail, one
 * shape to draw.
 * @param {Record<string, (...args: unknown[]) => Promise<unknown>>} handle
 * @param {string} id
 * @param {AbortSignal} [signal]
 * @returns {Promise<{ ok: true, room: RoomEntry, mode: string|null } | { ok: false } & Refused>}
 */
export async function readRegistryRoom(handle, id, signal) {
  try {
    return roomFromRegistry(await invoke(handle, "rooms", signal), id);
  } catch (err) {
    return { ok: false, ...refusalOf(err) };
  }
}

/* ========================================================================== *
 * 5. Ask arc
 * ========================================================================== */

/** The door refuses an empty question by name; this refuses it before the request leaves,
 *  for the same reason `door.decide` refuses an empty reason locally. */
export const MAX_QUESTION_BYTES = 2000;

/**
 * What this half of the brain can actually answer without a model, in its own words. Each
 * line is one of `ask-offline.mjs`'s matchers, so the examples are not aspirational: they are
 * the questions the deterministic reader is known to reach.
 */
export const EXAMPLE_QUESTIONS = Object.freeze([
  "What needs me today?",
  "How many receipts are on the spine?",
  "Which kinds have never fired?",
  "What is the revenue?",
  "Which lanes are LIVE?",
  "How far is the face lane through its appetite?",
]);

/**
 * Put a question to the door. The room calls this rather than reaching into the handle, for
 * the reason `invoke` gives: a missing grant must surface as a named refusal, never as a
 * component that quietly does nothing.
 * @param {Record<string, (...args: unknown[]) => Promise<unknown>>} handle
 * @param {string} q
 * @returns {Promise<unknown>}
 */
export function askThrough(handle, q) {
  return invoke(handle, "ask", q);
}

/**
 * @typedef {object} Asked
 * @property {string} answer
 * @property {string[]} citations
 * @property {boolean|null} selfVerified   what the brain said about itself; null when it said nothing
 * @property {string|null} mode            the door's data mode, "sim" for a fixture spine
 * @property {"deterministic"|"governed"|"unknown"} half
 * @property {string} halfLabel
 * @property {string} halfLine
 * @property {string|null} source          the door's own `source` string, verbatim
 * @property {string|null} shape           how a governed answer arrived: "json" | "text"
 */

/**
 * Which half of the brain answered, and say it plainly.
 *
 * THE OFFLINE PATH IS NOT A DEGRADED PATH. `apiAsk` routes deterministic-first on purpose:
 * questions about live state have exact answers computed from the log, an exact answer beats
 * a fluent one, and it needs no driver, no key and no spend. A room that renders that as a
 * fallback notice would be teaching its owner to distrust the better answer.
 *
 * The door's own field is `source`, and it is the only signal: `apiAsk` strips the matcher id
 * out of the body before serving it. When `source` is absent, the governed process answered.
 * @param {Record<string, unknown>} body
 * @returns {{ half: "deterministic"|"governed"|"unknown", halfLabel: string, halfLine: string }}
 */
export function answerHalf(body) {
  const source = typeof body.source === "string" ? body.source : null;
  if (source && source.startsWith("deterministic")) {
    return {
      half: "deterministic",
      halfLabel: "ANSWERED BY THE READER",
      halfLine: `No model, no key, no spend. Every number below was computed from the log by L2 — ${source}. This half cannot hallucinate a receipt because it never writes a sentence a matcher did not compute.`,
    };
  }
  if (source) {
    return { half: "unknown", halfLabel: "SOURCE NOT RECOGNISED", halfLine: `The door named its source as "${source}", which is not a half this shell knows. The answer is shown; the claim about where it came from is not.` };
  }
  if (typeof body.answer === "string") {
    return {
      half: "governed",
      halfLabel: "ANSWERED BY THE GOVERNED PROCESS",
      halfLine: "The deterministic reader could not reach this one, so `face-ask` ran under policy — tier-pinned, budgeted, and declaring zero tools. It emits one `run.completed` receipt; it holds no way to act.",
    };
  }
  return { half: "unknown", halfLabel: "NO ANSWER IN THE BODY", halfLine: "The door answered without an answer field. Nothing is rendered in its place." };
}

/**
 * Narrow `POST /api/ask` into the one shape both halves are read through.
 *
 * The two halves of `apiAsk` return DIFFERENT bodies and that is not a bug to paper over:
 *   deterministic  { mode, source, answer, citations, verified }
 *   governed       { mode, answer }        <- answer is arc-run's raw stdout
 *
 * So a governed answer carries no citations field at all, and the process's declared output
 * contract (`initiatives/face/contracts/face-ask.process.yaml`) is `{answer, citations,
 * verified}` — meaning the citations are inside the stdout, as JSON, if arc-run printed the
 * object. Both are handled and WHICH ONE ARRIVED IS REPORTED, because "the citations field
 * was missing" and "the citations field was empty" are the two different facts a reader needs
 * to tell apart before trusting the verdict at the top of the page.
 * @param {unknown} raw
 * @returns {{ ok: true } & Asked | { ok: false } & Refused}
 */
export function readAnswer(raw) {
  const body = asObject(raw);
  if (!body) {
    return { ok: false, code: "BAD_BODY", human: "The door answered `POST /api/ask` with something that is not an object. No answer is shown, and none has been invented in its place." };
  }
  const half = answerHalf(body);
  const mode = typeof body.mode === "string" ? body.mode : null;
  const source = typeof body.source === "string" ? body.source : null;

  let answer = typeof body.answer === "string" ? body.answer : "";
  /** @type {string[]} */
  let citations = Array.isArray(body.citations) ? body.citations.filter(/** @returns {c is string} */ (c) => typeof c === "string" && c.length > 0) : [];
  let selfVerified = typeof body.verified === "boolean" ? body.verified : null;
  /** @type {string|null} */
  let shape = null;

  if (half.half === "governed") {
    shape = "text";
    const inner = parseGovernedStdout(answer);
    if (inner) {
      shape = "json";
      answer = inner.answer;
      citations = inner.citations;
      selfVerified = inner.verified;
    }
  }

  if (!answer) {
    return { ok: false, code: "EMPTY_ANSWER", human: "The door answered with an empty answer. An empty string is not a result and is not shown as one." };
  }
  return {
    ok: true,
    answer: unescapeDoorText(answer),
    citations: citations.map((c) => unescapeDoorText(c)),
    selfVerified,
    mode,
    source,
    shape,
    half: half.half,
    halfLabel: half.halfLabel,
    halfLine: half.halfLine,
  };
}

/**
 * A governed answer is arc-run's stdout. If the process printed its declared output object,
 * unwrap it; if it printed prose, leave it alone and say so via `shape`.
 *
 * Deliberately strict about the shape: a JSON object that is NOT the declared contract is
 * left as text rather than half-unwrapped, because guessing which field held the answer is
 * how a room ends up rendering a log line as a conclusion.
 * @param {string} stdout
 * @returns {{ answer: string, citations: string[], verified: boolean|null }|null}
 */
export function parseGovernedStdout(stdout) {
  const trimmed = stdout.trim();
  if (!trimmed.startsWith("{")) return null;
  /** @type {unknown} */
  let parsed = null;
  try { parsed = JSON.parse(trimmed); } catch { return null; }
  const obj = asObject(parsed);
  if (!obj || typeof obj.answer !== "string" || !Array.isArray(obj.citations)) return null;
  return {
    answer: obj.answer,
    citations: obj.citations.filter(/** @returns {c is string} */ (c) => typeof c === "string" && c.length > 0),
    verified: typeof obj.verified === "boolean" ? obj.verified : null,
  };
}

/**
 * Every ULID in a piece of text, in order, deduplicated.
 *
 * This is the half of citation-checking that the citations array cannot do. A governed answer
 * is prose, and prose can name a receipt in the middle of a sentence without listing it — a
 * confident sentence carrying an id nobody checked is exactly the failure this product exists
 * to prevent, so an id found in the body is treated as a claim with the same standing as one
 * found in the array.
 *
 * The word boundaries are load-bearing in both directions: without them a 27-character token
 * would yield a false 26-character match, and with an over-eager pattern a lowercase sha256
 * would match — it cannot, because Crockford base32 is uppercase and drops I, L, O and U.
 * @param {string} text
 * @returns {string[]}
 */
export function ulidsIn(text) {
  if (typeof text !== "string" || !text) return [];
  /** @type {string[]} */
  const out = [];
  const seen = new Set();
  // A fresh regex per call: a module-level /g regex carries `lastIndex` between calls, which
  // makes the SECOND call over the same string return different results from the first.
  const re = new RegExp(ULID_IN_TEXT.source, "g");
  for (const m of text.matchAll(re)) {
    const id = m[0];
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/**
 * @typedef {object} Claim
 * @property {string} raw       exactly what the brain wrote
 * @property {"ulid"|"lane"|"file"} kind
 * @property {string} key       the id or lane name the door is asked about
 * @property {"cited"|"inline"} from   listed in `citations`, or found inside the prose
 */

/**
 * What kind of thing a citation is, and therefore which door route can resolve it.
 *
 * Three shapes reach here: a receipt ULID, `file:lane/<lane>` (which is what the deterministic
 * matchers emit for a lane-borne claim), and a sanctioned file id from the door's allow-list.
 * Anything else falls to the file branch and comes back UNKNOWN_FILE_ID, which is the right
 * answer: an unrecognised citation is an unresolved one, never a waved-through one.
 * @param {string} raw
 * @returns {{ kind: "ulid"|"lane"|"file", key: string }}
 */
export function classifyCitation(raw) {
  const text = String(raw).trim();
  if (ULID_RE.test(text)) return { kind: "ulid", key: text };
  const lane = /^file:lane\/([a-z][a-z0-9-]{0,63})$/.exec(text);
  if (lane && lane[1]) return { kind: "lane", key: lane[1] };
  return { kind: "file", key: text.replace(/^file:/, "") };
}

/**
 * Every claim an answer makes that can be checked, listed once.
 *
 * A ULID that appears BOTH in the citations array and in the prose is one claim, and it is
 * reported as `cited` — the stronger provenance wins, so the page never shows the same id
 * twice under two labels.
 * @param {{ answer: string, citations: string[] }} asked
 * @returns {Claim[]}
 */
export function claimsOf(asked) {
  /** @type {Claim[]} */
  const claims = [];
  const seen = new Set();
  for (const raw of asked.citations) {
    const { kind, key } = classifyCitation(raw);
    if (seen.has(key)) continue;
    seen.add(key);
    claims.push({ raw, kind, key, from: "cited" });
  }
  for (const id of ulidsIn(asked.answer)) {
    if (seen.has(id)) continue;
    seen.add(id);
    claims.push({ raw: id, kind: "ulid", key: id, from: "inline" });
  }
  return claims;
}

/**
 * @typedef {object} Resolution
 * @property {string} key
 * @property {"resolved"|"absent"|"unreadable"} state
 * @property {string} how       the route that settled it, named
 * @property {string|null} code the door's own refusal code when it refused
 * @property {string} line      the sentence the row prints
 * @property {string|null} detail  what the door said about it, when it said anything
 */

/**
 * Resolve one claim THROUGH THE DOOR. There is no other way to resolve one: a client that
 * decided an id looked plausible would be inventing the very proof it is here to demand.
 *
 * A ULID is settled by the spine reader's own cursor semantics: `?since=<id>` searches every
 * event in append order and refuses `CURSOR_NOT_FOUND` when the id is not there. The page it
 * returns is what comes AFTER the cited event (`slice(at + 1)`), so it carries no detail —
 * but the refusal, or its absence, is the door's own reader answering "is this on the spine",
 * which is the exact question REQ-07 asks. `limit: 1` keeps the proof cheap.
 *
 * `unreadable` is its own state and is NOT treated as resolved. A citation the door could not
 * be asked about has not been checked, and an unchecked citation is an unverified one.
 * @param {Record<string, (...args: unknown[]) => Promise<unknown>>} handle
 * @param {Claim} claim
 * @param {AbortSignal} [signal]
 * @returns {Promise<Resolution>}
 */
export async function resolveClaim(handle, claim, signal) {
  /** @param {unknown} err @returns {Resolution} */
  const refused = (err) => {
    const said = refusalOf(err);
    // Only the door's own "this is not here" codes mean ABSENT. Everything else — a dead
    // door, a bad token, an HTTP 500 — means the claim was never checked, and saying
    // "unresolved" about an unasked question would be its own small lie.
    const absent = said.code === "CURSOR_NOT_FOUND" || said.code === "BAD_CURSOR"
      || said.code === "UNKNOWN_LANE" || said.code === "UNKNOWN_FILE_ID";
    return {
      key: claim.key,
      state: absent ? "absent" : "unreadable",
      how: absent ? "the door was asked and said no" : "the door could not be asked",
      code: said.code,
      line: absent
        ? `The door has no record of this. It refused by name: ${said.code}.`
        : `This claim was NOT checked — the read itself failed (${said.code}). An unchecked citation is not a verified one.`,
      detail: said.human,
    };
  };

  try {
    if (claim.kind === "ulid") {
      await invoke(handle, "spine", { since: claim.key, limit: 1 }, signal);
      return {
        key: claim.key, state: "resolved", code: null,
        how: "GET /api/spine?since=…",
        line: "On the spine. The door's own reader walked the log in append order and found this id.",
        detail: null,
      };
    }
    if (claim.kind === "lane") {
      const body = asObject(await invoke(handle, "lane", claim.key, signal));
      const header = body ? asObject(body.header) : null;
      const status = header ? asText(header.status) : null;
      const phase = header ? asText(header.phase) : null;
      return {
        key: claim.key, state: "resolved", code: null,
        how: "GET /api/lane/:id",
        line: "A lane the door serves.",
        detail: status || phase ? `${status ?? "status MISSING"} · phase ${phase ?? "MISSING"}` : "file, not log — this lane is read from the tree",
      };
    }
    const body = asObject(await invoke(handle, "file", claim.key, signal));
    const path = body ? asText(body.path) : null;
    const sha = body ? asText(body.sha256) : null;
    return {
      key: claim.key, state: "resolved", code: null,
      how: "GET /api/file/:id",
      line: "An allow-listed file the door serves.",
      detail: path ? `${path}${sha ? ` · sha256 ${sha.slice(0, 12)}…` : ""}` : null,
    };
  } catch (err) {
    return refused(err);
  }
}

/**
 * Resolve every claim, in parallel, keyed for lookup.
 * @param {Record<string, (...args: unknown[]) => Promise<unknown>>} handle
 * @param {Claim[]} claims
 * @param {AbortSignal} [signal]
 * @returns {Promise<Record<string, Resolution>>}
 */
export async function resolveClaims(handle, claims, signal) {
  const settled = await Promise.all(claims.map((c) => resolveClaim(handle, c, signal)));
  /** @type {Record<string, Resolution>} */
  const out = {};
  for (const r of settled) out[r.key] = r;
  return out;
}

/**
 * @typedef {object} Standing
 * @property {"verified"|"unverified"|"absence"|"uncited"|"checking"} klass
 * @property {string} label     the word the page shows, large
 * @property {string} line      why it says that
 * @property {string[]} broken  the keys that did not resolve
 * @property {number} checked
 * @property {number} total
 */

/**
 * THE decision this module exists for.
 *
 * "20/20 golden questions answered from live L2 with citations; a citation that does not
 * resolve to a ULID via L2 marks the answer *unverified* (never silently kept)" — phase-07's
 * Definition of Done, as a function.
 *
 * Four classes, because collapsing them would each time hide something a reader needs:
 *
 *   verified    every claim resolved through the door. The ordinary, good case.
 *   unverified  at least one claim did not resolve, OR the brain marked itself unverified.
 *               The brain's own `verified: false` counts even when every id happens to
 *               resolve: the process contract says it sets that flag when it cites anything
 *               the state pack did not actually contain, and it knows that and we do not.
 *   absence     the deterministic reader answered, asserted itself verified, and cited
 *               nothing — because the answer IS an absence. "Revenue is zero because
 *               `revenue.received` has never fired" cites nothing; there is no receipt to
 *               cite, and that is the answer rather than a gap in it.
 *   uncited     a governed answer that named no receipt at all. Not a refusal, not a lie —
 *               but nothing in it has been checked, and the page must not let that pass for
 *               verification just because no id failed.
 * @param {Asked} asked
 * @param {Claim[]} claims
 * @param {Record<string, Resolution>} resolutions
 * @returns {Standing}
 */
export function standingOf(asked, claims, resolutions) {
  const total = claims.length;
  const settled = claims.filter((c) => Boolean(resolutions[c.key]));
  if (total > 0 && settled.length < total) {
    return {
      klass: "checking", label: "CHECKING", broken: [], checked: settled.length, total,
      line: `Resolving ${displayValue(total).text} citation${total === 1 ? "" : "s"} through the door. Nothing is called verified until every one of them has been asked about.`,
    };
  }
  const broken = claims.filter((c) => {
    const r = resolutions[c.key];
    return !r || r.state !== "resolved";
  }).map((c) => c.key);

  if (broken.length) {
    return {
      klass: "unverified", label: "UNVERIFIED", broken, checked: settled.length, total,
      line: `${displayValue(broken.length).text} of ${displayValue(total).text} citation${total === 1 ? "" : "s"} did not resolve through the door. The answer is kept and shown — deleting it would hide the failure — but nothing in it has been proven, and a confident sentence carrying an id that leads nowhere is the exact thing this product exists to catch.`,
    };
  }
  if (asked.selfVerified === false) {
    return {
      klass: "unverified", label: "UNVERIFIED", broken: [], checked: settled.length, total,
      line: "Every citation resolved, and the brain still marked its own answer unverified. Its contract says it sets that flag when it has cited something the state pack did not actually contain. It knows something about this answer that the citation check cannot see, and its word stands.",
    };
  }
  if (total === 0) {
    if (asked.half === "deterministic" && asked.selfVerified === true) {
      return {
        klass: "absence", label: "NOTHING TO CITE", broken: [], checked: 0, total: 0,
        line: "This answer cites nothing because it is about an ABSENCE — a kind that has never fired, a queue that is empty, an act this brain will not perform. There is no receipt to cite; that is the answer, not a gap in it.",
      };
    }
    return {
      klass: "uncited", label: "UNCITED", broken: [], checked: 0, total: 0,
      line: "No receipt was named, so nothing here has been checked against the log. This is not a refusal and it is not a lie — it is an answer with no proof attached, and the page will not dress that up as verification.",
    };
  }
  return {
    klass: "verified", label: "VERIFIED", broken: [], checked: total, total,
    line: `Every one of ${displayValue(total).text} citation${total === 1 ? "" : "s"} was put to the door and resolved. Each row below names the route that settled it.`,
  };
}

/**
 * The Inbox hand-off. THE ONE PLACE this room is allowed to point at an act.
 *
 * REQ-07 lets the brain DRAFT a decision and forbids it from making one: "the draft flows to
 * the Stamp; the brain never emits, never approves, never runs a command". So what comes back
 * is a destination and a command line — a link and some text. There is deliberately no
 * verdict, no reason and no id pre-filled into anything: the Inbox refuses a default reason
 * on purpose, and a draft that arrived with the words already written would walk straight
 * around the one rule the write path is built on.
 * @param {Claim[]} claims
 * @param {Record<string, Resolution>} resolutions
 * @returns {{ ids: string[], room: string, label: string, line: string }|null}
 */
export function inboxHandoff(claims, resolutions) {
  const ids = claims
    .filter((c) => c.kind === "ulid" && resolutions[c.key]?.state === "resolved")
    .map((c) => c.key);
  if (!ids.length) return null;
  return {
    ids,
    room: "inbox",
    label: "Open the Inbox",
    line: "This answer names receipts. If one of them is an approval waiting on you, the Inbox is where you stamp it — in your own words, one card at a time. This room cannot carry the decision there for you, and it does not offer to.",
  };
}

/**
 * The CLI lines an answer names, pulled out so they can be shown as TEXT.
 *
 * The deterministic reader's third rule is that it never offers to run the command it names,
 * and this is that rule rendered: a backticked command becomes a selectable mono line, never
 * a button. What the owner types is his; the room's job stops at spelling it correctly.
 * @param {string} text
 * @returns {string[]}
 */
export function commandsIn(text) {
  if (typeof text !== "string" || !text) return [];
  /** @type {string[]} */
  const out = [];
  const seen = new Set();
  for (const m of text.matchAll(/`([^`]+)`/g)) {
    const span = (m[1] ?? "").trim();
    if (!/^(arc|arc-[a-z-]+|node|bash|git|npm)\b/.test(span)) continue;
    if (seen.has(span)) continue;
    seen.add(span);
    out.push(span);
  }
  return out;
}

/**
 * @typedef {{ type: "text"|"code"|"em", text: string }} Segment
 */

/**
 * Split an answer into the three things it is made of: prose, `machine vocabulary`, and
 * *the honest labels* the reader emphasises.
 *
 * This exists because the two faces in tokens.css carry a MEANING and not a style: display is
 * what a human wrote, mono is what the log wrote. An answer that renders `revenue.received`
 * in the same face as the sentence around it has thrown that distinction away, and the
 * distinction is most of what makes these answers readable at a glance.
 *
 * It is a segmenter, not a markdown parser: it emits plain objects that React renders as TEXT.
 * No HTML is produced here and none may be.
 * @param {string} text
 * @returns {Segment[]}
 */
export function segments(text) {
  if (typeof text !== "string" || !text) return [];
  /** @type {Segment[]} */
  const out = [];
  const re = /`([^`]+)`|\*([^*]+)\*/g;
  let at = 0;
  for (const m of text.matchAll(re)) {
    const start = m.index;
    if (start > at) out.push({ type: "text", text: text.slice(at, start) });
    if (typeof m[1] === "string") out.push({ type: "code", text: m[1] });
    else if (typeof m[2] === "string") out.push({ type: "em", text: m[2] });
    at = start + m[0].length;
  }
  if (at < text.length) out.push({ type: "text", text: text.slice(at) });
  return out;
}

/**
 * Is this question askable, and if not, why not — before the request leaves.
 *
 * The door refuses an empty question with BAD_BODY, and it is right to. Refusing it here as
 * well is the same courtesy `door.decide` extends to an empty reason: a round trip to be told
 * the box was empty is a worse experience than being told before the request leaves.
 * @param {string} q
 * @returns {{ ok: true, q: string } | { ok: false, why: string }}
 */
export function askable(q) {
  const text = typeof q === "string" ? q.trim() : "";
  if (!text) return { ok: false, why: "Nothing to ask yet." };
  const bytes = new TextEncoder().encode(text).length;
  if (bytes > MAX_QUESTION_BYTES) {
    return { ok: false, why: `That question is ${displayValue(bytes).text} bytes and the ceiling is ${displayValue(MAX_QUESTION_BYTES).text}. Ask the narrower half of it.` };
  }
  return { ok: true, q: text };
}
