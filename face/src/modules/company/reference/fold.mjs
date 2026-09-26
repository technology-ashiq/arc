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

/** @typedef {import("../../../lib/registry.mjs").Payload} Payload */
/** @typedef {{ text: string, at: string, isLink: boolean }} Ref */
/** @typedef {{ label: string, value: string, refs: Ref[], hasRefs: boolean, isList: boolean, items: string[] }} FactRow */
/** @typedef {{ number: string, title: string, status: string, date: string }} AdrRow */

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
 * @property {{ heading: string, kind: string, startHere: string[], hasStartHere: boolean, loop: string[], hasLoop: boolean,
 *   pending: string, facts: FactRow[], source: string, adrs: AdrRow[], hasAdrs: boolean, page: string,
 *   faceRoom: { canOpen: boolean, room: string, label: string }, withheld: string, showWithheld: boolean }} entity
 * @property {string} notes
 * @property {boolean} showNotes
 */

const ROUTE = "/api/reference";
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
  const at = lines.findIndex((l) => /^#{1,6}\s*the bigger loop\s*$/i.test(l.trim()));
  const paras = /** @param {string[]} ls @returns {string[]} */ (ls) => ls.join("\n").split(/\n\s*\n/).map((p) => p.replace(/^#{1,6}\s+/gm, "").trim()).filter(Boolean);
  return at < 0 ? { start: paras(lines), loop: [] } : { start: paras(lines.slice(0, at)), loop: paras(lines.slice(at + 1)) };
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

  const at = str(asObject(ctx.picks).at).trim();
  const [key = "", ...rest] = at.split("/");
  const id = rest.join("/");
  const isIndex = at === "";
  const isType = !isIndex && id === "" && rendered.includes(key);
  const entity = !isIndex && id !== "" ? list(key).find((e) => e.id === id) : undefined;
  const isEntity = !!entity;
  const isLost = st.isRead && !isIndex && !isType && !isEntity;

  const heading = /** @param {string} k @param {Record<string, unknown>} e @returns {string} */ (k, e) => (k === "commands" ? `/${e.id}` : k === "adrBands" ? `ADRs ${str(asObject(e.facts).range) || e.id}` : str(e.id));
  const crumbs = [{ label: "Reference", at: "", isCurrent: isIndex }];
  if (isType || isEntity) crumbs.push({ label: str(titles[key]) || key, at: key, isCurrent: isType });
  if (isEntity && entity) crumbs.push({ label: heading(key, entity), at, isCurrent: true });

  // ---- index ----
  const types = rendered.map((k) => {
    const n = list(k).length;
    const unparsed = Number(asObject(asObject(body.stats)[k]).unparsed) || 0;
    return { key: k, title: str(titles[k]) || k, count: String(n), at: k, note: unparsed ? `${unparsed} with a field their source does not declare` : "" };
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
  let source = "", page = "", withheld = "", kind = "";
  if (isEntity && entity) {
    const f = asObject(entity.facts);
    const eid = str(entity.id);
    kind = str(singular[key]) || key;
    source = str(entity.source);
    page = pages[at] ? `docs/wiki/${str(pages[at])}` : "";
    const text = str(narrative[at]);
    ({ start: startHere, loop } = splitNarrative(text));
    const scalar = /** @param {string} label @param {unknown} v */ (label, v) => facts.push({ label, value: str(v), refs: [], hasRefs: false, isList: false, items: [] });
    const links = /** @param {string} label @param {Ref[]} refs */ (label, refs) => facts.push({ label, value: refs.length ? "" : "—", refs, hasRefs: refs.length > 0, isList: false, items: [] });
    const items = /** @param {string} label @param {unknown[]} xs */ (label, xs) => facts.push({ label, value: xs.length ? "" : "—", refs: [], hasRefs: false, isList: xs.length > 0, items: xs.map(str) });
    const reqBy = asArray(asObject(rel.requiredBy)[eid]).map(str).sort();
    const productLane = asObject(rel.productLane);
    const owner = /** @param {string} map @returns {string} */ (map) => str(asObject(rel[map])[eid]);
    if (key === "products") {
      scalar("Version", f.version);
      links("Requires", asArray(f.requires).map((r) => ref("products", str(r))));
      links("Required by", reqBy.map((r) => ref("products", r)));
      links("Lane", productLane[eid] ? [ref("lanes", str(productLane[eid]))] : []);
      links("Commands", asArray(f.commands).map((c) => ref("commands", stem(c), `/${stem(c)}`)));
      links("Agents", asArray(f.agents).map((a) => ref("agents", stem(a))));
      items("Scripts", asArray(f.scripts));
      items("Files", asArray(f.files));
      const room = str(f.faceRoom);
      const served = asArray(ctx.rooms).some((r) => asObject(r).id === room);
      faceRoom = { canOpen: served, room, label: room ? `Open the live room: ${room}${f.faceRing ? ` (ring ${str(f.faceRing)})` : ""}` : "" };
    } else if (key === "lanes") {
      scalar("Status", f.status); scalar("Cycle", f.cycle);
      const prod = Object.keys(productLane).find((p) => productLane[p] === eid);
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
    const adrsOf = key === "adrBands" ? asArray(f.adrs) : asArray(asObject(rel.adrsFor)[eid]);
    adrs = adrsOf.map(asObject).map((a) => ({ number: str(a.number), title: str(a.title), status: str(a.status), date: str(a.date) }))
      .sort((a, b) => (a.number < b.number ? -1 : a.number > b.number ? 1 : 0));
    const scrubbed = asObject(body.scrubbed);
    withheld = asArray(scrubbed.narrative).includes(at) ? "The door withheld part of this narrative -- a path or an address it will not send (ADR-1312)." : "";
  }
  const dir = isEntity ? str(pageDirs[key]) : "";
  const pending = isEntity ? `Narrative pending. Nobody has written why this exists yet; it belongs in docs/wiki/_narrative/${dir}/${id}.md, hand-written or owner-accepted (ADR-1508). The room never writes it.` : "";

  const unpaged = asArray(body.unpaged).length;
  const factsAltered = asObject(body.scrubbed).factsAltered === true;
  const notes = [
    unpaged ? `${unpaged} entit${unpaged === 1 ? "y has" : "ies have"} no safe page and ${unpaged === 1 ? "is" : "are"} not linked.` : "",
    factsAltered ? "The door withheld a path or address inside a fact; that fact reads differently here than in docs/wiki." : "",
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
    typeList: { title: str(titles[key]) || key, rows, isEmpty: isType && rows.length === 0 },
    entity: {
      heading: isEntity && entity ? heading(key, entity) : "",
      kind,
      startHere, hasStartHere: startHere.length > 0,
      loop, hasLoop: loop.length > 0,
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
