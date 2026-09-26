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
import { ReadError, answer, scrubDeep } from "../reads.mjs";

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
  for (const name of ["extract", "narrativeReader", "pagePath", "RENDERED", "PAGE_DIRS", "TYPE_KEY"]) {
    if (!(name in w)) throw new ReadError("PARSER_UNAVAILABLE", `docs/wiki-build.mjs does not export ${name} (ADR-1346 imports it rather than re-deriving it)`);
  }
  const res = await w.extract(repo);
  if (!res || res.code !== 0 || !res.wiki) throw new ReadError("SOURCE_INVALID", `the wiki extract did not complete: ${String(res && res.message || "no result")}`);
  const wk = /** @type {any} */ (res.wiki);
  if (wk.schema !== REFERENCE_SCHEMA) throw new ReadError("SOURCE_INVALID", `the wiki extract is schema ${JSON.stringify(wk.schema)}; this room renders schema ${REFERENCE_SCHEMA} -- refused whole, never rendered in part`);
  const narrativeOf = w.narrativeReader(repo);
  /** @type {Record<string, string>} */ const pages = {};
  /** @type {Record<string, string>} */ const narrative = {};
  for (const key of w.RENDERED) {
    for (const e of wk.entities[key] || []) {
      const at = `${key}/${e.id}`;
      const page = w.pagePath(e);
      if (page) pages[at] = page;
      const text = narrativeOf(key, e.id);
      if (text !== null) narrative[at] = text;
    }
  }
  return { schema: wk.schema, stats: wk.stats, entities: wk.entities, pages, narrative, pageDirs: w.PAGE_DIRS, typeKey: w.TYPE_KEY, rendered: w.RENDERED };
}

/** GET /api/reference -- takes no query. @param {{ mode: string, repo: string }} ctx @param {URL} url */
export async function apiReference(ctx, url) {
  for (const k of url.searchParams.keys()) throw new ReadError("BAD_ARGS", `${url.pathname} takes no query; "${k}" is not read`);
  const body = await referenceBody(ctx.repo);
  // Narrative is hand-written prose: it passes the same scrub as every free-text field the door serves.
  return answer(ctx, "/api/reference", "file, not log", "docs/wiki-build.mjs#extract · docs/wiki-build.mjs#narrativeReader", [], scrubDeep(body, ctx.repo));
}
