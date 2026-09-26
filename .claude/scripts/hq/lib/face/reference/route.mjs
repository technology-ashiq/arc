// GET /api/reference -- the docs wiki's own extract, for the face's Reference room (REQ-12, ADR-1346).
//
// ONE EXTRACT. The facts are wiki-build's `extract()` over face-coverage's treeWorld, imported, and the narrative is
// wiki-build's own `narrativeReader`, imported: this file enumerates nothing and re-derives nothing. It sits in its
// own directory so tests/docs/no-walker.mjs can prove that about it alone (a second walker is the failure ADR-1346
// exists to prevent).
//
// BUILD-TIME FACTS ONLY (DOC-I, ADR-1509). The body is the extract, each entity's page path and the owner-accepted
// narrative -- nothing from the spine, nothing under .claude/state/, no live count. Live numbers stay in the live
// rooms. READ-ONLY (DOC-D, ADR-1504): nothing here writes, and docs/wiki/** is never touched by the door.
import { ReadError, answer, scrub, scrubDeep } from "../reads.mjs";

/** The extract schema this room renders. A new schema refuses the route whole rather than rendering half of it. */
export const REFERENCE_SCHEMA = 1;

let wikiBuild = null;
/** wiki-build, imported once. A load failure refuses this route by name, with the loader's code, never its message. */
async function wiki() {
  if (!wikiBuild) wikiBuild = import(new URL("../../../../docs/wiki-build.mjs", import.meta.url).href).then((m) => ({ m }), (e) => ({ e }));
  const got = await wikiBuild;
  if (got.e) {
    const raw = String((got.e && (got.e.code || got.e.name)) || "Error");
    throw new ReadError("PARSER_UNAVAILABLE", `the parser this route imports (docs/wiki-build.mjs) did not load (${/^[A-Za-z0-9_]{1,64}$/.test(raw) ? raw : "Error"})`);
  }
  return got.m;
}

/**
 * The route body, from a repo root. Exported so the fixture can hold it equal to `wiki-build --json` without a door.
 * `inject.wiki` stands in for the imported module, so a test can hand the route a new schema or a missing export and
 * watch it refuse whole; the door never passes it.
 * @param {string} repo @param {{ wiki?: any }} [inject]
 */
export async function referenceBody(repo, inject = {}) {
  const w = inject.wiki ?? await wiki();
  // OWN members of the right kind: `in` accepted an inherited member, and a missing export then threw as a TypeError
  // (a 500) instead of this named refusal (attack 94ffba3 L1).
  const WANT = { extract: "function", narrativeReader: "function", pagePath: "function", RENDERED: "array", PAGE_DIRS: "object", TYPE_KEY: "object" };
  for (const [name, kind] of Object.entries(WANT)) {
    const v = w && Object.hasOwn(w, name) ? w[name] : undefined;
    const ok = kind === "array" ? Array.isArray(v) : kind === "object" ? v !== null && typeof v === "object" && !Array.isArray(v) : typeof v === kind;
    if (!ok) throw new ReadError("PARSER_UNAVAILABLE", `docs/wiki-build.mjs does not export ${name} as a ${kind} (ADR-1346 imports it rather than re-deriving it)`);
  }
  const res = await w.extract(repo);
  // The extract's own message is another reader's text: scrubbed like every refusal the door raises (L2m).
  if (!res || res.code !== 0 || !res.wiki) throw new ReadError("SOURCE_INVALID", `the wiki extract did not complete: ${scrub(String(res && res.message || "no result"), repo)}`);
  const wk = /** @type {any} */ (res.wiki);
  if (wk.schema !== REFERENCE_SCHEMA) throw new ReadError("SOURCE_INVALID", `the wiki extract is schema ${scrub(JSON.stringify(wk.schema), repo)}; this room renders schema ${REFERENCE_SCHEMA} -- refused whole, never rendered in part`);
  // A WRONG SHAPE IS REFUSED, NOT RENDERED: entities is an object of arrays of { id } (L2).
  const shapeOk = wk.entities !== null && typeof wk.entities === "object" && !Array.isArray(wk.entities)
    && Object.values(wk.entities).every((list) => Array.isArray(list) && list.every((e) => e !== null && typeof e === "object" && typeof e.id === "string"));
  if (!shapeOk) throw new ReadError("SOURCE_INVALID", "the wiki extract's entities are not an object of arrays of { id } -- refused whole, never rendered in part");
  const narrativeOf = w.narrativeReader(repo);
  /** @type {Record<string, string>} */ const pages = {};
  /** @type {Record<string, string>} */ const narrative = {};
  /** @type {string[]} */ const unpaged = [];
  for (const key of w.RENDERED) {
    for (const e of wk.entities[key] || []) {
      // A key the room folds and links by exists only for an id wiki-build gives a page: pagePath enforces SAFE_ID and
      // the device-name rule, and the page it returns must be `<dir>/<id>.md` inside docs/wiki -- a slash, a newline or
      // a `..` in an id never becomes a key or a link (L4, L5). An entity without one is counted, not dropped silently.
      const page = w.pagePath(e);
      if (typeof page !== "string" || !PAGE_RE.test(page) || page !== `${w.PAGE_DIRS[key]}/${e.id}.md`) { unpaged.push(`${key}:${e.id.slice(0, 80)}`); continue; }
      const at = `${key}/${e.id}`;
      pages[at] = page;
      // wiki-build refuses a symlinked or out-of-tree narrative with ITS OWN error class; carried here as this door's
      // named refusal (the whole route, never a half-served page), not a 500 (attack 94ffba3 B1).
      let text;
      try { text = narrativeOf(key, e.id); }
      catch (err) { throw new ReadError("SOURCE_INVALID", `the narrative for ${at} could not be read as a regular file inside the tree: ${scrub(String(err && err.message || err), repo)}`); }
      if (typeof text === "string") narrative[at] = text;
    }
  }
  return { schema: wk.schema, stats: wk.stats, entities: wk.entities, pages, narrative, unpaged, pageDirs: w.PAGE_DIRS, typeKey: w.TYPE_KEY, rendered: w.RENDERED };
}

/** A page path the room may link: one directory, one safe id, `.md` -- relative to docs/wiki, never out of it. */
const PAGE_RE = /^[a-z][a-z0-9-]*\/[A-Za-z0-9][A-Za-z0-9._-]*\.md$/;

/**
 * The served value: the body after the door's scrub, and WHAT the scrub changed -- the narrative keys whose text it
 * altered and whether any entity fact moved. A transform between the measured value and the served one must say what
 * it destroyed (attack 94ffba3 B2, B3); the room shows it instead of passing a withheld sentence off as the prose.
 * @param {string} repo @param {{ wiki?: any }} [inject]
 */
export async function servedReference(repo, inject = {}) {
  const body = await referenceBody(repo, inject);
  const served = /** @type {any} */ (scrubDeep(body, repo));
  const withheld = Object.keys(body.narrative).filter((k) => served.narrative[k] !== body.narrative[k]);
  const factsAltered = JSON.stringify(served.entities) !== JSON.stringify(body.entities);
  return { ...served, scrubbed: { narrative: withheld, factsAltered } };
}

// One computation at a time per repo: concurrent requests share it rather than each re-running the whole extract
// (attack 94ffba3 B4). Nothing is kept after it settles -- the next request reads the tree as it is then.
/** @type {Map<string, Promise<any>>} */
const inflight = new Map();

/** GET /api/reference -- takes no query. @param {{ mode: string, repo: string }} ctx @param {URL} url */
export async function apiReference(ctx, url) {
  for (const k of url.searchParams.keys()) throw new ReadError("BAD_ARGS", `${url.pathname} takes no query; "${k}" is not read`);
  let p = inflight.get(ctx.repo);
  if (!p) {
    p = servedReference(ctx.repo).finally(() => inflight.delete(ctx.repo));
    inflight.set(ctx.repo, p);
  }
  return answer(ctx, "/api/reference", "file, not log", "docs/wiki-build.mjs#extract · docs/wiki-build.mjs#narrativeReader", [], await p);
}
