// fold.mjs -- company/reference: every decision the Reference room makes (ADR-1320, ADR-1346).
//
// The room is the docs wiki inside the face. What it draws comes from ONE read, `/api/reference`: wiki-build's own
// extract, its page paths, its owner-accepted narrative, and the cross-links computed by wiki-build's own
// `relationsOf` -- the same function the markdown pages are drawn with. Nothing here walks the tree, re-derives an
// entity or decides a relationship; it chooses which of the served facts a page shows, and how the page is navigated.
//
// Navigation is one pick, `at`: "" is the index, "<type>" a type's list, "<type>/<id>" an entity's page. A pick naming
// nothing the extract holds is drawn as LOST with the way back, never as an empty page that looks real.
//
// The page follows the owner's design (arc-wiki-engine_1.html): Start here · The bigger loop (narrative -- only what
// the owner wrote, else "narrative pending", ADR-1508) · Reference (the facts and cross-links) · Evidence (the source
// file and the decisions it owns) · Meta (where the page lives, and anything the door withheld).
import { asArray, asObject, servedRead } from "../../../lib/served.mjs";
import { roomLink } from "../../../lib/lane-room.mjs";

/** @typedef {import("../../../lib/registry.mjs").Payload} Payload */
/** @typedef {{ text: string, at: string, isLink: boolean }} Ref */
/** @typedef {{ label: string, value: string, refs: Ref[], hasRefs: boolean, isList: boolean, items: string[] }} FactRow */
/** @typedef {{ key: string, number: string, title: string, status: string, date: string }} AdrRow */

/**
 * @typedef {object} Folded
 * @property {string} title
 * @property {string} lede
 * @property {import("../../../lib/registry.mjs").Read[]} reads
 * @property {boolean} isReading
 * @property {boolean} isRefused
 * @property {{ code: string, human: string }} refusal
 * @property {boolean} isRead
 * @property {{ label: string, at: string, isCurrent: boolean }[]} crumbs
 * @property {boolean} isIndex
 * @property {boolean} isType
 * @property {boolean} isEntity
 * @property {boolean} isLost
 * @property {string} lost
 * @property {{ key: string, title: string, count: string, at: string, note: string }[]} types
 * @property {string} debt
 * @property {{ title: string, rows: { name: string, at: string, summary: string }[], isEmpty: boolean }} typeList
 * @property {{ heading: string, kind: string, startHere: string[], hasStartHere: boolean, loop: string[], hasLoop: boolean, startBlocks: Block[], loopBlocks: Block[],
 *   pending: string, facts: FactRow[], source: string, adrs: AdrRow[], hasAdrs: boolean, page: string,
 *   faceRoom: { canOpen: boolean, room: string, label: string }, withheld: string, showWithheld: boolean }} entity
 * @property {string} notes
 * @property {boolean} showNotes
 */

const ROUTE = "/api/reference";
/** The one pick grammar, the fragment's (shell.mjs REFERENCE_AT): a type key, or `<type>/<id>` with a wiki-safe id. */
const AT = /^([a-z][A-Za-z]{0,31})(?:\/([A-Za-z0-9][A-Za-z0-9._-]{0,99}))?$/;
/** An OWN member only: JSON objects inherit Object.prototype, and an id of `constructor` read a function (L13). */
const own = /** @param {Record<string, unknown>} o @param {string} k @returns {unknown} */ (o, k) => (Object.prototype.hasOwnProperty.call(o, k) ? o[k] : undefined);
const str = /** @param {unknown} v @returns {string} */ (v) => (typeof v === "string" ? v : v === null || v === undefined ? "" : String(v));
const stem = /** @param {unknown} p @returns {string} */ (p) => str(p).replace(/^.*\//, "").replace(/\.md$/, "");

/**
 * The narrative split by the design's two narrative sections: everything before a `## The bigger loop` heading is
 * "Start here", everything after it is "The bigger loop". Paragraphs, with heading marks dropped -- the text itself is
 * the owner's, untouched.
 * @param {string} text @returns {{ start: string[], loop: string[] }}
 */
export function splitNarrative(text) {
  const lines = str(text).split(/\r?\n/);
  // A heading inside a fenced code block is text the owner quoted, not the owner's section break (attack 53ee223 L3).
  let fenced = false;
  const at = lines.findIndex((l) => {
    if (/^\s*(```|~~~)/.test(l)) { fenced = !fenced; return false; }
    return !fenced && /^#{1,6}\s*the bigger loop\s*$/i.test(l.trim());
  });
  const paras = /** @param {string[]} ls @returns {string[]} */ (ls) => ls.join("\n").split(/\n\s*\n/).map((p) => p.replace(/^#{1,6}\s+/gm, "").trim()).filter(Boolean);
  return at < 0 ? { start: paras(lines), loop: [] } : { start: paras(lines.slice(0, at)), loop: paras(lines.slice(at + 1)) };
}

/**
 * @typedef {{ text: string, isText: boolean, isStrong: boolean, isEm: boolean, isCode: boolean, isLink: boolean }} Span
 * @typedef {{ spans: Span[] }} Cell
 * @typedef {{ cells: Cell[] }} Row
 * @typedef {{ isHeading: boolean, isH2: boolean, isH3: boolean, isH4: boolean, isPara: boolean, isList: boolean,
 *   isOrdered: boolean, isTable: boolean, isCode: boolean, isQuote: boolean, spans: Span[], items: Cell[], head: Cell[],
 *   rows: Row[], text: string }} Block
 */

const span = /** @param {string} text @param {"text"|"strong"|"em"|"code"|"link"} k @returns {Span} */ (text, k) =>
  ({ text, isText: k === "text", isStrong: k === "strong", isEm: k === "em", isCode: k === "code", isLink: k === "link" });

/**
 * Inline markdown as spans: code, strong, emphasis and a link's TEXT (its target is dropped -- a page link is a pick the
 * facts panel already draws, and a raw URL is never an anchor here). Everything else is text; React escapes it, so a
 * tag in the owner's prose is shown, never run (ADR-1347 section 2).
 * @param {string} text @returns {Span[]}
 */
export function inlineSpans(text) {
  /** @type {Span[]} */
  const out = [];
  const re = /(`+)([\s\S]*?[^`])\1(?!`)|\*\*([^*]+?)\*\*|__([^_]+?)__|\*([^*\s][^*]*?)\*|(?<![A-Za-z0-9])_([^_\s][^_]*?)_(?![A-Za-z0-9])|\[([^\]]+)\]\([^)\s]*\)/g;
  let last = 0;
  for (const m of str(text).matchAll(re)) {
    const i = m.index ?? 0;
    if (i > last) out.push(span(text.slice(last, i), "text"));
    if (m[2] !== undefined) out.push(span(m[2].trim(), "code"));
    else if (m[3] !== undefined || m[4] !== undefined) out.push(span(str(m[3] ?? m[4]), "strong"));
    else if (m[5] !== undefined || m[6] !== undefined) out.push(span(str(m[5] ?? m[6]), "em"));
    else out.push(span(str(m[7]), "link"));
    last = i + m[0].length;
  }
  if (last < str(text).length) out.push(span(str(text).slice(last), "text"));
  return out;
}

const block = /** @param {Partial<Block>} b @returns {Block} */ (b) => ({
  isHeading: false, isH2: false, isH3: false, isH4: false, isPara: false, isList: false, isOrdered: false, isTable: false,
  isCode: false, isQuote: false, spans: [], items: [], head: [], rows: [], text: "", ...b,
});
const cellsOf = /** @param {string} line @returns {Cell[]} */ (line) => {
  const t = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return t.split(/(?<!\\)\|/).map((c) => ({ spans: inlineSpans(c.trim().replace(/\\\|/g, "|")) }));
};
const TABLE_RULE = /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/;
const BULLET = /^\s*[-*+]\s+(.*)$/;
const NUMBERED = /^\s*\d{1,3}[.)]\s+(.*)$/;
const FENCE = /^\s*(```|~~~)/;

/**
 * The owner's markdown as blocks (ADR-1347 section 2): headings, paragraphs, lists, tables, code and quotes. HTML
 * comments -- the fingerprint line and ADR-1513's src/plain markers -- are metadata for the author and the gates, never
 * prose for the reader, so they are dropped outside a code fence; inside one the text is the owner's quote, verbatim.
 * @param {string} text @returns {Block[]}
 */
export function narrativeBlocks(text) {
  const lines = str(text).split(/\r?\n/);
  /** @type {Block[]} */
  const out = [];
  /** @type {string[]} */
  let para = [];
  const flush = () => { if (para.length) out.push(block({ isPara: true, spans: inlineSpans(para.join(" ")) })); para = []; };
  let inComment = false;
  /** @type {string[]} */
  const clean = [];
  let fencedHere = false;
  for (const raw of lines) {
    if (FENCE.test(raw) && !inComment) { fencedHere = !fencedHere; clean.push(raw); continue; }
    if (fencedHere) { clean.push(raw); continue; }
    let l = raw;
    if (inComment) { const e = l.indexOf("-->"); if (e < 0) continue; l = l.slice(e + 3); inComment = false; }
    l = l.replace(/<!--[\s\S]*?-->/g, "");
    const open = l.indexOf("<!--");
    if (open >= 0) { l = l.slice(0, open); inComment = true; }
    // A line that held only a marker is gone, not a blank that splits a paragraph.
    if (l.trim() === "" && raw.trim() !== "") continue;
    clean.push(l);
  }
  for (let i = 0; i < clean.length; i++) {
    const l = str(clean[i]);
    if (FENCE.test(l)) {
      flush();
      const body = [];
      let j = i + 1;
      while (j < clean.length && !FENCE.test(str(clean[j]))) body.push(str(clean[j++]));
      out.push(block({ isCode: true, text: body.join("\n") }));
      i = j;
      continue;
    }
    if (l.trim() === "") { flush(); continue; }
    const h = /^\s*(#{1,6})\s+(.*?)\s*#*\s*$/.exec(l);
    if (h) {
      flush();
      const level = Math.max(2, Math.min(4, str(h[1]).length));
      out.push(block({ isHeading: true, isH2: level === 2, isH3: level === 3, isH4: level === 4, spans: inlineSpans(str(h[2])) }));
      continue;
    }
    if (l.trim().startsWith("|") && i + 1 < clean.length && TABLE_RULE.test(str(clean[i + 1]))) {
      flush();
      const head = cellsOf(l);
      /** @type {Row[]} */
      const rows = [];
      let j = i + 2;
      while (j < clean.length && str(clean[j]).trim().startsWith("|")) rows.push({ cells: cellsOf(str(clean[j++])) });
      out.push(block({ isTable: true, head, rows }));
      i = j - 1;
      continue;
    }
    const bullet = BULLET.exec(l), numbered = bullet ? null : NUMBERED.exec(l);
    if (bullet || numbered) {
      flush();
      const ordered = numbered !== null;
      /** @type {string[]} */
      const items = [];
      let j = i;
      while (j < clean.length) {
        const b = (ordered ? NUMBERED : BULLET).exec(str(clean[j]));
        if (b) { items.push(str(b[1])); j++; continue; }
        // An indented line continues the item above it; a blank line or anything else ends the list.
        const c = str(clean[j]);
        if (c.trim() !== "" && /^\s{2,}/.test(c) && items.length) { items[items.length - 1] = str(items[items.length - 1]) + " " + c.trim(); j++; continue; }
        break;
      }
      out.push(block({ isList: true, isOrdered: ordered, items: items.map((s) => ({ spans: inlineSpans(s) })) }));
      i = j - 1;
      continue;
    }
    if (/^\s*>\s?/.test(l)) {
      flush();
      const q = [];
      let j = i;
      while (j < clean.length && /^\s*>\s?/.test(str(clean[j]))) q.push(str(clean[j++]).replace(/^\s*>\s?/, ""));
      out.push(block({ isQuote: true, spans: inlineSpans(q.join(" ")) }));
      i = j - 1;
      continue;
    }
    para.push(l.trim());
  }
  flush();
  return out;
}

/**
 * splitNarrative's two sections as blocks: the same break, found the same way, so the paragraphs and the blocks can
 * never disagree about where "The bigger loop" starts.
 * @param {string} text @returns {{ start: Block[], loop: Block[] }}
 */
export function splitBlocks(text) {
  const lines = str(text).split(/\r?\n/);
  let fenced = false;
  const at = lines.findIndex((l) => {
    if (FENCE.test(l)) { fenced = !fenced; return false; }
    return !fenced && /^#{1,6}\s*the bigger loop\s*$/i.test(l.trim());
  });
  return at < 0 ? { start: narrativeBlocks(lines.join("\n")), loop: [] }
    : { start: narrativeBlocks(lines.slice(0, at).join("\n")), loop: narrativeBlocks(lines.slice(at + 1).join("\n")) };
}

/**
 * @param {Record<string, Payload>} payloads
 * @param {import("../../../lib/registry.mjs").FoldContext} ctx
 * @returns {Folded}
 */
export function fold(payloads, ctx) {
  /** @type {import("../../../lib/registry.mjs").Read[]} */
  const reads = [];
  const st = servedRead(payloads, ctx, reads, ROUTE);
  const body = st.body;
  const rendered = asArray(body.rendered).filter((k) => typeof k === "string");
  const entities = asObject(body.entities);
  const pages = asObject(body.pages);
  const narrative = asObject(body.narrative);
  const rel = asObject(body.relations);
  const titles = asObject(body.titles);
  const singular = asObject(body.singular);
  const pageDirs = asObject(body.pageDirs);
  const list = /** @param {string} key @returns {Record<string, unknown>[]} */ (key) => asArray(entities[key]).map(asObject).filter((e) => typeof e.id === "string");
  const has = /** @param {string} key @param {string} id @returns {boolean} */ (key, id) => rendered.includes(key) && list(key).some((e) => e.id === id);
  /** @type {(key: string, id: string, text?: string) => Ref} */
  const ref = (key, id, text = id) => ({ text, at: `${key}/${id}`, isLink: has(key, id) });

  const at = str(asObject(ctx.picks).at);
  // The grammar or nothing: `products/`, a padded key, `a/b/c` or a dot segment is LOST, never a second spelling of a
  // real page (attack 53ee223 L1, L6). An id holds no slash, so a type list and an entity page cannot collide (L2).
  const m = AT.exec(at);
  const key = m ? str(m[1]) : "";
  const id = m ? str(m[2]) : "";
  const isIndex = at === "";
  const isType = !!m && id === "" && rendered.includes(key);
  const entity = !!m && id !== "" && rendered.includes(key) ? list(key).find((e) => e.id === id) : undefined;
  const isEntity = !!entity;
  const isLost = st.isRead && !isIndex && !isType && !isEntity;

  const heading = /** @param {string} k @param {Record<string, unknown>} e @returns {string} */ (k, e) => (k === "commands" ? `/${e.id}` : k === "adrBands" ? `ADRs ${str(asObject(e.facts).range) || e.id}` : str(e.id));
  const crumbs = [{ label: "Reference", at: "", isCurrent: isIndex }];
  if (isType || isEntity) crumbs.push({ label: str(own(titles, key)) || key, at: key, isCurrent: isType });
  if (isEntity && entity) crumbs.push({ label: heading(key, entity), at, isCurrent: true });

  // ---- index ----
  const types = rendered.map((k) => {
    const n = list(k).length;
    const unparsed = Number(asObject(own(asObject(body.stats), k)).unparsed) || 0;
    return { key: k, title: str(own(titles, k)) || k, count: String(n), at: k, note: unparsed ? `${unparsed} with a field their source does not declare` : "" };
  });
  const total = rendered.reduce((n, k) => n + list(k).length, 0);
  const narrated = Object.keys(narrative).length;
  const debt = total ? `Narrative debt: ${total - narrated} of ${total} pages have no owner-written narrative yet (ADR-1508).` : "";

  // ---- a type's list ----
  const summaryOf = /** @param {Record<string, unknown>} e @returns {string} */ (e) => {
    const f = asObject(e.facts);
    return str(f.description || f.title || f.intent || f.status || f.range || (f.version ? `v${f.version}` : "")).replace(/^PROGRESS\.md\s*[—-]\s*/, "");
  };
  const rows = isType ? list(key).map((e) => ({ name: heading(key, e), at: `${key}/${e.id}`, summary: summaryOf(e) })) : [];

  // ---- an entity's page ----
  /** @type {FactRow[]} */
  const facts = [];
  /** @type {AdrRow[]} */
  let adrs = [];
  let faceRoom = { canOpen: false, room: "", label: "" };
  /** @type {string[]} */ let startHere = [];
  /** @type {string[]} */ let loop = [];
  /** @type {Block[]} */ let startBlocks = [];
  /** @type {Block[]} */ let loopBlocks = [];
  let source = "", page = "", withheld = "", kind = "", unnumbered = 0;
  if (isEntity && entity) {
    const f = asObject(entity.facts);
    const eid = str(entity.id);
    kind = str(own(singular, key)) || key;
    source = str(entity.source);
    page = own(pages, at) ? `docs/wiki/${str(own(pages, at))}` : "";
    const text = str(own(narrative, at));
    ({ start: startHere, loop } = splitNarrative(text));
    ({ start: startBlocks, loop: loopBlocks } = splitBlocks(text));
    const scalar = /** @param {string} label @param {unknown} v */ (label, v) => facts.push({ label, value: str(v), refs: [], hasRefs: false, isList: false, items: [] });
    const links = /** @param {string} label @param {Ref[]} refs */ (label, refs) => facts.push({ label, value: refs.length ? "" : "—", refs, hasRefs: refs.length > 0, isList: false, items: [] });
    const items = /** @param {string} label @param {unknown[]} xs */ (label, xs) => facts.push({ label, value: xs.length ? "" : "—", refs: [], hasRefs: false, isList: xs.length > 0, items: xs.map(str) });
    const reqBy = asArray(own(asObject(rel.requiredBy), eid)).map(str).sort();
    const productLane = asObject(rel.productLane);
    const owner = /** @param {string} map @returns {string} */ (map) => str(own(asObject(own(rel, map)), eid));
    if (key === "products") {
      scalar("Version", f.version);
      links("Requires", asArray(f.requires).map((r) => ref("products", str(r))));
      links("Required by", reqBy.map((r) => ref("products", r)));
      links("Lane", own(productLane, eid) ? [ref("lanes", str(own(productLane, eid)))] : []);
      links("Commands", asArray(f.commands).map((c) => ref("commands", stem(c), `/${stem(c)}`)));
      links("Agents", asArray(f.agents).map((a) => ref("agents", stem(a))));
      items("Scripts", asArray(f.scripts));
      items("Files", asArray(f.files));
      const room = str(f.faceRoom);
      // Openable by the rail's own rule -- served, built, not the lane template, a room-id -- not by presence (L7, B3).
      const link = roomLink(ctx, room);
      faceRoom = { canOpen: link.canOpen, room: link.room, label: link.canOpen ? `Open the live room: ${room}${f.faceRing ? ` (ring ${str(f.faceRing)})` : ""}` : "" };
    } else if (key === "lanes") {
      scalar("Status", f.status); scalar("Cycle", f.cycle);
      const prod = Object.keys(productLane).find((p) => own(productLane, p) === eid);
      links("Product", prod ? [ref("products", prod)] : []);
      items("Plan and tracker", f.hasPlan ? [`initiatives/${eid}/PLAN.md`, `initiatives/${eid}/PROGRESS.md`] : [`initiatives/${eid}/PROGRESS.md`]);
    } else if (key === "commands") {
      scalar("Description", f.description); scalar("Arguments", f.argumentHint);
      scalar("Generated", f.generated === true ? "yes -- compiled from its process file; edit the process, not the command" : "no");
      links("Owning product", owner("commandOwner") ? [ref("products", owner("commandOwner"))] : []);
    } else if (key === "agents") {
      scalar("Description", f.description); scalar("Model", f.model);
      items("Tools", asArray(f.tools));
      links("Owning product", owner("agentOwner") ? [ref("products", owner("agentOwner"))] : []);
    } else if (key === "processes") {
      scalar("Intent", f.intent); scalar("Version", f.version); scalar("Permissions", f.permissions);
      items("Tools", asArray(f.tools).map((t) => (typeof t === "string" ? t : JSON.stringify(t))));
      items("Inputs", asArray(f.inputs).map((i) => str(asObject(i).name) || JSON.stringify(i)));
    } else if (key === "adrBands") {
      scalar("Range", f.range); scalar("ADRs", f.fileCount);
    } else {
      for (const [k, v] of Object.entries(f)) if (!Array.isArray(v) && (typeof v !== "object" || v === null)) scalar(k, v);
    }
    const adrsOf = key === "adrBands" ? asArray(f.adrs) : asArray(own(asObject(rel.adrsFor), eid));
    // A row with no number cannot be told from another one: counted into the notes, never drawn under a shared key (L14).
    const numbered = adrsOf.map(asObject).filter((a) => str(a.number) !== "");
    unnumbered = adrsOf.length - numbered.length;
    adrs = numbered.map((a, i) => ({ key: `${str(a.number)}|${i}`, number: str(a.number), title: str(a.title), status: str(a.status), date: str(a.date) }))
      .sort((a, b) => (a.number < b.number ? -1 : a.number > b.number ? 1 : 0));
    const scrubbed = asObject(body.scrubbed);
    withheld = asArray(scrubbed.narrative).includes(at) ? "The door withheld part of this narrative -- a path or an address it will not send (ADR-1312)." : "";
  }
  const dir = isEntity ? str(own(pageDirs, key)) : "";
  const pending = isEntity ? `Narrative pending. Nobody has written why this exists yet; it belongs in docs/wiki/_narrative/${dir}/${id}.md, hand-written or owner-accepted (ADR-1508). The room never writes it.` : "";

  const unpaged = asArray(body.unpaged).length;
  const factsAltered = asObject(body.scrubbed).factsAltered === true;
  const notes = [
    unpaged ? `${unpaged} entit${unpaged === 1 ? "y has" : "ies have"} no safe page and ${unpaged === 1 ? "is" : "are"} not linked.` : "",
    factsAltered ? "The door withheld a path or address inside a fact; that fact reads differently here than in docs/wiki." : "",
    unnumbered ? `${unnumbered} decision row${unnumbered === 1 ? " has" : "s have"} no number and ${unnumbered === 1 ? "is" : "are"} not drawn.` : "",
  ].filter(Boolean).join(" ");

  return {
    title: ctx.room.sentence,
    lede: ctx.room.lede,
    reads,
    isReading: st.isReading,
    isRefused: st.isRefused,
    refusal: { code: str(st.refusal.code), human: str(st.refusal.human) },
    isRead: st.isRead,
    crumbs,
    isIndex: st.isRead && isIndex,
    isType: st.isRead && isType,
    isEntity: st.isRead && isEntity,
    isLost,
    lost: isLost ? `Nothing in the reference is called ${JSON.stringify(at)}. It may have been renamed or removed from the tree.` : "",
    types,
    debt,
    typeList: { title: str(own(titles, key)) || key, rows, isEmpty: isType && rows.length === 0 },
    entity: {
      heading: isEntity && entity ? heading(key, entity) : "",
      kind,
      startHere, hasStartHere: startHere.length > 0,
      loop, hasLoop: loop.length > 0,
      startBlocks, loopBlocks,
      pending,
      facts, source, adrs, hasAdrs: adrs.length > 0,
      page,
      faceRoom,
      withheld, showWithheld: withheld !== "",
    },
    notes,
    showNotes: notes !== "",
  };
}
