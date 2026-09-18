// served.mjs -- a panel one of Phase 04's door read routes fills (face v2 Phase 04, REQ-06, ADR-1324).
//
// Phase 03 drew every panel the door could not fill as NOT SERVED, naming the route it needed. Phase 04
// serves those routes, and this is the one way a fold reads one: the read is planned against the module's
// manifest by the host's own rule (readProblem), its payload is read ONCE into a plain copy, and the copy is
// judged before anything is drawn from it. The lessons lane-room.mjs carries hold here too:
//   - a 200 that is not the route asked for is a REFUSAL with a code, never a table about something else --
//     every Phase 04 route names itself in its body (`route`), and a body naming another is WRONG_ROUTE;
//   - a body with no list where the table's rows live is BAD_BODY, never an empty table: "empty because
//     unreadable" and "empty because nothing is there" are different sentences;
//   - every string the door sent is escaped by its serializer, so it is unescaped exactly once, here;
//   - where the door says what parsed the table and from which files, the panel says so too.
import { payloadOf, readProblem } from "./registry.mjs";
import { visibleText } from "./lane-room.mjs";

/**
 * @typedef {import("./registry.mjs").Payload} Payload
 * @typedef {import("./registry.mjs").Read} Read
 * @typedef {import("./registry.mjs").FoldContext} FoldContext
 *
 * @typedef {object} ServedState
 * @property {boolean} isReading
 * @property {boolean} isRefused
 * @property {{ code: string, human: string }} refusal
 * @property {boolean} isRead       the door answered with this route's own body
 * @property {Record<string, unknown>} body  the body, copied once (an empty object unless isRead)
 * @property {string} source        what parsed it and from where, as the door stated it
 *
 * @typedef {{ key: string, cells: string[] }} ServedRow
 *
 * @typedef {object} ServedTable
 * @property {true} isServed
 * @property {string} panel
 * @property {string} route
 * @property {boolean} isReading
 * @property {boolean} isRefused
 * @property {{ code: string, human: string }} refusal
 * @property {boolean} isDrawn      the rows are what the door sent, and may be drawn
 * @property {boolean} showEmpty    the door answered and the table has no row
 * @property {string[]} columns
 * @property {ServedRow[]} rows
 * @property {string} empty
 * @property {string} note
 * @property {string} source
 */

const NO_REFUSAL = Object.freeze({ code: "", human: "" });

/** @param {unknown} v @returns {Record<string, unknown>} */
export const asObject = (v) => (v !== null && typeof v === "object" && !Array.isArray(v) ? /** @type {Record<string, unknown>} */ (v) : {});

/** @param {unknown} v @returns {unknown[]} */
export const asArray = (v) => (Array.isArray(v) ? v : []);

/**
 * A served value as a person reads it: a string unescaped once and trimmed of what renders as nothing, a finite
 * number or a boolean in words, and anything else as the empty string -- never "[object Object]".
 * @param {unknown} v
 * @returns {string}
 */
export function cell(v) {
  if (typeof v === "string") return visibleText(v);
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "";
  if (typeof v === "boolean") return v ? "yes" : "no";
  return "";
}

/**
 * One own field of a body copy, as text.
 * @param {Record<string, unknown>} o @param {string} k
 */
export const field = (o, k) => cell(Object.hasOwn(o, k) ? o[k] : undefined);

/** @param {string} code @param {string} human @returns {ServedState} */
const refused = (code, human) => ({ isReading: false, isRefused: true, refusal: { code, human }, isRead: false, body: {}, source: "" });

/**
 * The provenance line: which parser the door imported and which files it parsed.
 * @param {Record<string, unknown>} body
 */
function sourceLine(body) {
  const parser = field(body, "parser");
  const files = asArray(body["sources"]).map((s) => field(asObject(s), "path")).filter((p) => p !== "");
  if (parser === "" && files.length === 0) return "";
  return [parser !== "" ? `parsed by ${parser}` : "", files.length > 0 ? `from ${files.join(", ")}` : ""].filter((s) => s !== "").join(" ");
}

/**
 * Plan one Phase 04 read and read what the door answered.
 *
 * `reads` is the fold's own list of reads (the host loads exactly those); the read is pushed only when the
 * module's manifest may make it, so a manifest that does not declare the route draws a named refusal rather
 * than a panel reading "…" for ever (the factory ring's debt row).
 *
 * @param {Record<string, Payload>} payloads @param {FoldContext} ctx @param {Read[]} reads
 * @param {string} route @param {Record<string, string | number>} [query]
 * @returns {ServedState}
 */
export function servedRead(payloads, ctx, reads, route, query) {
  /** @type {Read} */
  const read = query === undefined ? { route } : { route, query };
  const why = readProblem(read, ctx.manifest);
  if (why !== null) return refused("READ_REFUSED", why);
  reads.push(read);
  const p = payloadOf(payloads, read);
  if (p.state === "loading" || p.state === "pending") return { isReading: true, isRefused: false, refusal: NO_REFUSAL, isRead: false, body: {}, source: "" };
  if (p.state === "refused") return refused(p.code, p.human);
  // Every field read once into a plain copy, then judged and drawn from the copy.
  const raw = asObject(p.data);
  /** @type {Record<string, unknown>} */
  const body = {};
  for (const k of Object.keys(raw)) body[k] = raw[k];
  const named = body["route"];
  if (typeof named !== "string") return refused("BAD_BODY", `the door answered ${route} without naming the route it answered for`);
  if (named !== route) return refused("WRONG_ROUTE", `this room asked the door for ${route} and the body it answered with is ${visibleText(named)}`);
  return { isReading: false, isRefused: false, refusal: NO_REFUSAL, isRead: true, body, source: sourceLine(body) };
}

/**
 * A table panel over one served list.
 *
 * `listKey` names where the rows live in the body; a body with no list there is BAD_BODY. `row` turns one
 * copied entry into its cells, and returns null for an entry it cannot read -- which is COUNTED into the
 * note, never silently dropped.
 *
 * @param {ServedState} st
 * @param {{ panel: string, route: string, columns: string[], listKey: string, empty: string,
 *   row: (entry: Record<string, unknown>, i: number) => ServedRow | null, note?: string }} spec
 * @returns {ServedTable}
 */
export function servedTable(st, spec) {
  const base = {
    isServed: /** @type {true} */ (true),
    panel: spec.panel,
    route: spec.route,
    columns: spec.columns,
    empty: spec.empty,
    source: st.source,
  };
  if (!st.isRead) {
    return { ...base, isReading: st.isReading, isRefused: st.isRefused, refusal: st.refusal, isDrawn: false, showEmpty: false, rows: [], note: "" };
  }
  const list = st.body[spec.listKey];
  if (!Array.isArray(list)) {
    return {
      ...base, isReading: false, isRefused: true,
      refusal: { code: "BAD_BODY", human: `the door answered ${spec.route}, but with no ${spec.listKey} list in the body it sent` },
      isDrawn: false, showEmpty: false, rows: [], note: "",
    };
  }
  /** @type {ServedRow[]} */
  const rows = [];
  let unread = 0;
  const keys = new Set();
  list.forEach((entry, i) => {
    const r = entry !== null && typeof entry === "object" && !Array.isArray(entry) ? spec.row(asObject(entry), i) : null;
    // A row that reads as nothing, or under a key already drawn, is not a second row: it is counted as unread.
    if (r === null || r.cells.every((c) => c === "") || keys.has(r.key)) { unread += 1; return; }
    keys.add(r.key);
    rows.push(r);
  });
  const notes = [
    spec.note ?? "",
    unread > 0 ? `${unread} entr${unread === 1 ? "y" : "ies"} the door sent could not be read and ${unread === 1 ? "is" : "are"} not drawn` : "",
  ].filter((s) => s !== "");
  return { ...base, isReading: false, isRefused: false, refusal: NO_REFUSAL, isDrawn: true, showEmpty: rows.length === 0, rows, note: notes.join(" · ") };
}

/**
 * The same answer, seen through one projection a fold made of it -- a nested list lifted to where a table reads
 * it, or a list of names turned into rows. The state is carried unchanged, so a projection can never turn a
 * refusal or a read in flight into a table; a projection of an answer that is not there is `undefined`, which
 * the table refuses as BAD_BODY rather than drawing as empty.
 * @param {ServedState} st @param {string} key @param {(body: Record<string, unknown>) => unknown} pick
 * @returns {ServedState}
 */
export function projected(st, key, pick) {
  return st.isRead ? { ...st, body: { [key]: pick(st.body) } } : st;
}

/**
 * An answer the door sent in which the part this panel needs was refused by name -- the budgets the bench's
 * ceiling reader would not read, say. Drawn as that refusal, never as an empty table.
 * @param {ServedState} st @param {string} code @param {string} human
 * @returns {ServedState}
 */
export function refusedPart(st, code, human) {
  return st.isRead ? { ...st, isRead: false, isRefused: true, refusal: { code, human } } : st;
}

/**
 * The gates table three rooms draw from /api/gates (factory, review-and-ship, legal): each gate's DECLARED mode, and
 * the profile a `profile`-mode gate is resolved under. One projection, so the three rooms cannot drift apart on
 * what a mode means; the resolution itself is arc-profile.sh's and is named, never repeated.
 * @param {ServedState} st @param {string} panel @param {string} [extraNote]
 * @returns {ServedTable}
 */
export function gateModes(st, panel, extraNote = "") {
  const profile = field(st.body, "profile");
  const resolver = field(st.body, "profileResolver");
  return servedTable(st, {
    panel,
    route: "/api/gates",
    columns: ["gate", "mode, as declared", "tier", "evidence"],
    listKey: "gates",
    empty: "arc.gates.yaml declares no gate.",
    row: (g) => {
      const name = field(g, "name");
      return name === "" ? null : { key: name, cells: [name, field(g, "mode"), field(g, "tier"), field(g, "evidence")] };
    },
    note: [
      st.isRead ? `the strictness profile is ${profile === "" ? "unset, so the default applies" : profile}; a gate declared "profile" takes its mode from it, resolved by ${resolver || "arc-profile.sh"}` : "",
      extraNote,
    ].filter((n) => n !== "").join(" · "),
  });
}

/**
 * Each venture's distance from its kill lines, one row per criterion, as the ledger's kill panel evaluated them
 * (/api/ventures). A criteria file whose digest no receipt pins is NOT evaluated -- the panel says the kill lines
 * are unarmed rather than drawing distances the ledger refused to compute.
 * @param {ServedState} st @param {string} panel
 * @returns {ServedTable}
 */
export function venturesKill(st, panel) {
  const kill = asObject(st.body["kill"]);
  const armed = kill["present"] === true && kill["receipted"] === true;
  return servedTable(projected(st, "rows", (b) => {
    const k = asObject(b["kill"]);
    if (!Array.isArray(k["ventures"])) return undefined;
    return k["ventures"].flatMap((v) => asArray(asObject(v)["criteria"]).map((c) => ({ ...asObject(c), venture: asObject(v)["venture"] })));
  }), {
    panel,
    route: "/api/ventures",
    columns: ["venture", "kill criterion", "status", "distance to the line"],
    listKey: "rows",
    empty: kill["present"] !== true
      ? "ventures.yaml is not on this tree, so no venture has a kill line."
      : kill["receipted"] !== true
        ? "The criteria file's digest is pinned by no receipt, so the ledger arms no kill line and computes no distance."
        : "The criteria file names no venture.",
    row: (c) => {
      const venture = field(c, "venture");
      const criterion = field(c, "criterion");
      const unit = field(c, "unit");
      const distance = c["distance"] === null || c["distance"] === undefined ? (field(c, "reason") || "not measured") : `${cell(c["distance"])}${unit ? ` ${unit}` : ""}`;
      return venture === "" || criterion === "" ? null : { key: `${venture}/${criterion}`, cells: [venture, `${criterion} ${cell(c["threshold"])}`, field(c, "status"), distance] };
    },
    note: armed ? `evaluated on ${field(kill, "asOf")} from ${field(kill, "path")} by the ledger's kill panel` : "",
  });
}

/**
 * A one-line panel: a sentence the door's body carries, or the state that stands in for it.
 * @param {ServedState} st @param {{ panel: string, route: string, line: (body: Record<string, unknown>) => string, empty: string }} spec
 * @returns {ServedTable}
 */
export function servedLine(st, spec) {
  const text = st.isRead ? spec.line(st.body) : "";
  return servedTable(st.isRead ? { ...st, body: { lines: text === "" ? [] : [{ text }] } } : st, {
    panel: spec.panel,
    route: spec.route,
    columns: [],
    listKey: "lines",
    empty: spec.empty,
    row: (e) => ({ key: "line", cells: [field(e, "text")] }),
  });
}
