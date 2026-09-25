#!/usr/bin/env node
// wiki-build -- arc's own reference, generated from the tree (docs lane, ADR-1500..1512).
//
// Phase 00: the EXTRACTOR. It turns the tree into one wiki.json and nothing else yet.
//
// It never enumerates a directory itself (DOC-A, ADR-1501). Every set of things that exist
// comes from face-coverage.mjs's `treeWorld` -- the same assembly the face's completeness gate
// reads -- so the wiki and the face cannot disagree about what arc is. What this file does is
// read ONE NAMED FILE per entity (a manifest, a PROGRESS header, an ADR header, a frontmatter)
// and record the facts it declares. tests/docs/no-walker.mjs fails CI if that ever changes.
//
// Nothing here reads live state (DOC-I, ADR-1509): no spine, no .claude/state/, no network,
// no clock. Same tree in, same bytes out, on every OS -- which is what lets CI regenerate the
// wiki and fail on a dirty diff (DOC-D, ADR-1504).
//
//   wiki-build.mjs [--root DIR] [--out DIR]      render docs/wiki/ (Phase 02; --out elsewhere: outside the tree only)
//   wiki-build.mjs --check [--root DIR]          compare docs/wiki/ with a fresh render; write nothing
//   wiki-build.mjs --audit-counts [--root DIR]   re-derive every number on every page (REQ-07)
//   wiki-build.mjs --json [--root DIR] [--out FILE]
//
// Exit: 0 extracted | 1 a treeWorld key this wiki has not decided about (named)
//       | 2 usage, or an inventory / file that could not be read (named). Never 0 on unreadable.

import { readFileSync, writeFileSync, renameSync, unlinkSync, existsSync, lstatSync, realpathSync, mkdirSync } from "node:fs";
import { join, dirname, resolve, basename, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { randomBytes } from "node:crypto";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_DEFAULT = join(HERE, "..", "..", "..");

/**
 * The inventories the wiki gives a page type, in the order wiki.json lists them.
 * `adrBands` is the one not in treeWorld: it comes from `treeAdrBands`, which face-coverage
 * also exports and also reads from disk.
 */
export const RENDERED = ["products", "lanes", "processes", "adrBands", "commands", "agents", "rules", "gates"];

/**
 * Every OTHER key treeWorld returns, each with the reason it has no page. A key in neither
 * list stops the build (exit 1): when the face learns to read a new part of arc, the wiki must
 * decide about it too, rather than silently not knowing it exists (pre-mortem 5).
 */
export const NOT_RENDERED = [
  "kinds",        // spine event vocabulary -- a list of words, documented by validate.mjs itself
  "jobs",         // scheduled jobs -- live-state territory, the face's scheduler room (DOC-I)
  "ventures",     // venture passports -- PORTFOLIO.md owns them (ADR-0059)
  "plans",        // strategy plan docs -- they ARE documents; the lane pages link their lanes
  "capabilities", // skills / MCP servers / images -- machine-local, not arc's own parts
  "plannedRooms", // face rooms not yet built -- the face lane's backlog
  "ci",           // workflow files -- one CI system, described by the gates it runs
  "hooks",        // hook scripts -- listed by the product that owns them
  "lints",        // lint scripts -- listed by the product that owns them
  "modules",      // face room modules -- the face app's own structure
  "ops",          // face door ops -- the face app's own structure
];

// ---------- where each entity's page lives (the ONE spelling; the gate and the renderer import it) ----------

/** RENDERED key -> the directory its pages live in, under docs/wiki/. */
export const PAGE_DIRS = {
  products: "products", lanes: "lanes", processes: "processes", adrBands: "adr",
  commands: "commands", agents: "agents", rules: "rules", gates: "gates",
};
/** An entity's `type` -> its RENDERED key. */
export const TYPE_KEY = {
  product: "products", lane: "lanes", process: "processes", adrBand: "adrBands",
  command: "commands", agent: "agents", rule: "rules", gate: "gates",
};
/** Hand-written narrative lives here, under docs/wiki/, one dir per PAGE_DIRS value (ADR-1505). */
export const NARRATIVE_DIR = "_narrative";
/** Pages at the root of docs/wiki/ that belong to no entity. */
export const ROOT_PAGES = ["index"];
/** An id that can be a file name on every OS: no separators, no dots first, no reserved chars. */
export const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/** `<dir>/<id>.md` relative to docs/wiki/, or null when the id cannot be a file name. */
export function pagePath(entity) {
  const key = TYPE_KEY[entity?.type];
  if (!key || typeof entity.id !== "string" || !SAFE_ID.test(entity.id)) return null;
  // Long enough for any real id, short enough to leave room for a deep checkout's path.
  if (entity.id.length > 100) return null;
  // A Windows device name is a legal id on Linux and an unopenable file on the Windows leg.
  if (/^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$/i.test(entity.id)) return null;
  return `${PAGE_DIRS[key]}/${entity.id}.md`;
}

// ---------- small, total helpers ----------

/** Byte-order comparison. Never localeCompare: collation differs per OS and per locale. */
const byteOrder = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * A named file that exists but could not be read. It is never folded into "unparsed": an
 * EACCES or an antivirus EBUSY on one CI leg would otherwise print a different wiki.json at
 * exit 0 and make the regenerate-and-diff check flap (ADR-1504). extract() maps it to code 2.
 */
class ReadError extends Error {}

const realCache = new Map();
function realRoot(repo) {
  if (!realCache.has(repo)) realCache.set(repo, realpathSync.native(repo));
  return realCache.get(repo);
}
const inside = (p, root) => p === root || p.startsWith(root.endsWith(sep) ? root : root + sep);

/**
 * The path of a named regular file INSIDE the tree, spelled exactly as asked, or null when it
 * is absent. Throws ReadError when something is there that the wiki must not read:
 *  - a symlink (a tracked link could pull in a file from outside the repo, and core.symlinks
 *    differs per OS, so the same entry would read differently per CI leg);
 *  - a path whose real location is outside the tree (a linked parent directory);
 *  - any stat error other than "not there".
 * A file that exists only under a different CASE (plan.md for PLAN.md) is ABSENT: Linux says
 * so, and Windows / macOS must agree or the three legs produce three wikis.
 */
function namedFile(repo, rel) {
  const segs = rel.split("/");
  const p = join(repo, ...segs);
  let st;
  try { st = lstatSync(p); }
  catch (e) {
    if (e.code === "ENOENT" || e.code === "ENOTDIR") return null;
    throw new ReadError(`${rel}: ${e.code || e.message}`);
  }
  if (st.isSymbolicLink()) throw new ReadError(`${rel} is a symlink -- the wiki reads only regular files inside the tree (DOC-I)`);
  // Something IS there and it is not a regular file (a directory, a FIFO): that is not absence.
  if (!st.isFile()) throw new ReadError(`${rel} exists but is not a regular file`);
  let real;
  try { real = realpathSync.native(p); } catch (e) { throw new ReadError(`${rel}: ${e.code || e.message}`); }
  if (!inside(real, realRoot(repo))) throw new ReadError(`${rel} resolves outside the tree (${basename(real)}) -- a linked directory on its path`);
  const tail = real.split(sep).slice(-segs.length);
  if (tail.join("/") !== rel) {
    // Only a CASE-only difference means "absent" (Linux would not find it either). Any other
    // difference is a linked directory on the path, inside the tree: the entity is really
    // another one, and on a checkout without symlinks it would not exist at all.
    if (tail.join("/").toLowerCase() === rel.toLowerCase()) return null;
    throw new ReadError(`${rel} is reached through a linked directory (it is really ${tail.join("/")})`);
  }
  return p;
}

/** Read a named file as text: no BOM, LF endings, or null when absent. Same bytes on every OS. */
function readText(repo, rel) {
  const p = namedFile(repo, rel);
  if (p === null) return null;
  try { return readFileSync(p, "utf8").replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n"); }
  catch (e) { throw new ReadError(`${rel}: ${e.code || e.message}`); }
}

/** `key: value` lines between the first two `---` lines. Returns null when there is no block. */
function frontmatter(text) {
  if (text === null || !text.startsWith("---\n")) return null;
  const end = text.indexOf("\n---", 4);
  if (end === -1) return null;
  const out = {};
  for (const line of text.slice(4, end).split("\n")) {
    const m = /^([A-Za-z][A-Za-z0-9_-]*):[ \t]*(.*)$/.exec(line);
    if (m) out[m[1]] = unquote(m[2].trim());
  }
  return out;
}

function unquote(v) {
  if (v.length >= 2 && ((v[0] === "\"" && v.at(-1) === "\"") || (v[0] === "'" && v.at(-1) === "'"))) return v.slice(1, -1);
  return v;
}

/** The first `# ` heading, or null. */
function firstHeading(text) {
  if (text === null) return null;
  const m = /^# (.+)$/m.exec(text);
  return m ? m[1].trim() : null;
}

/** Pick keys in a FIXED order; a missing key is recorded in `unparsed`, never invented. */
function pick(src, keys, unparsed) {
  const facts = {};
  for (const k of keys) {
    const v = src?.[k];
    if (v === undefined || v === null || v === "") unparsed.push(k);
    else facts[k] = v;
  }
  return facts;
}

function entity(type, id, source, facts, unparsed) {
  return unparsed.length ? { id, type, source, facts, unparsed: [...unparsed].sort(byteOrder) } : { id, type, source, facts };
}

// ---------- the canonical YAML parser, never a second one ----------

async function yamlLoader(repo) {
  try {
    const mod = await import(pathToFileURL(join(repo, ".claude", "scripts", "engine", "yaml-subset.mjs")).href);
    return (text) => {
      try { const r = mod.parseYamlSubset(text); return r && r.ok === true ? r.value : null; }
      catch { return null; }
    };
  } catch { return null; }
}

// ---------- one reader per rendered type: ids from treeWorld, facts from ONE named file ----------

function readProduct(repo, name) {
  const source = `products/${name}/manifest.json`;
  const unparsed = [];
  let m = null;
  const text = readText(repo, source);
  try { m = text === null ? null : JSON.parse(text); } catch { m = null; }
  if (!m || typeof m !== "object") return entity("product", name, source, {}, ["manifest"]);
  const facts = pick(m, ["version"], unparsed);
  facts.requires = Array.isArray(m.requires) ? [...m.requires].sort(byteOrder) : [];
  for (const k of ["commands", "agents", "scripts", "files", "docs"]) {
    facts[k] = Array.isArray(m[k]) ? m[k].filter((x) => typeof x === "string").sort(byteOrder) : [];
  }
  if (m.face && typeof m.face === "object") {
    facts.faceRoom = typeof m.face.room === "string" ? m.face.room : null;
    facts.faceRing = typeof m.face.ring === "string" ? m.face.ring : null;
  }
  return entity("product", name, source, facts, unparsed);
}

const LANE_KEYS = ["status", "cycle", "phase", "appetite", "burn", "blocked-on", "depends-on"];

function readLane(repo, name) {
  const source = `initiatives/${name}/PROGRESS.md`;
  const text = readText(repo, source);
  if (text === null) return entity("lane", name, source, { hasPlan: namedFile(repo, `initiatives/${name}/PLAN.md`) !== null }, ["progress"]);
  // The machine header: `key: value` lines before the first blank-line-separated prose block.
  const header = {};
  for (const line of text.split("\n").slice(0, 30)) {
    const m = /^([a-z-]+):[ \t]*(.*)$/.exec(line);
    if (m && LANE_KEYS.includes(m[1]) && !(m[1] in header)) header[m[1]] = m[2].trim();
  }
  const unparsed = [];
  const facts = pick(header, LANE_KEYS, unparsed);
  facts.title = firstHeading(text);
  facts.hasPlan = namedFile(repo, `initiatives/${name}/PLAN.md`) !== null;
  return entity("lane", name, source, facts, unparsed);
}

function readProcess(repo, name, parse) {
  const source = `processes/${name}.process.yaml`;
  const text = readText(repo, source);
  const doc = text === null || !parse ? null : parse(text);
  if (!doc || typeof doc !== "object") return entity("process", name, source, {}, ["yaml"]);
  const unparsed = [];
  const facts = pick(doc, ["name", "version", "intent", "permissions"], unparsed);
  facts.tools = Array.isArray(doc.tools) ? doc.tools.filter((t) => typeof t === "string") : [];
  facts.inputs = Array.isArray(doc.inputs) ? doc.inputs.map((i) => (i && typeof i.name === "string" ? i.name : null)).filter(Boolean) : [];
  return entity("process", name, source, facts, unparsed);
}

const ADR_KEYS = [["Status", "status"], ["Date", "date"], ["Product", "product"], ["Reversibility", "reversibility"]];

function readAdr(repo, stem) {
  const source = `docs/adr/${stem}.md`;
  const text = readText(repo, source);
  const number = stem.slice(0, 4);
  const adr = { number, file: source };
  const unparsed = [];
  if (text === null) { adr.unparsed = ["file"]; return adr; }
  const heading = firstHeading(text);
  // "# ADR 1500 — title" and "# ADR-0042: title" and "# 0042 title" all occur across a year of
  // ADRs; strip whichever number prefix is there, keep the title.
  adr.title = heading ? heading.replace(/^ADR[\s-]*\d{1,4}\s*[—:–-]*\s*/i, "").replace(/^\d{4}\s*[—:–-]*\s*/, "") : null;
  if (!adr.title) unparsed.push("title");
  const head = text.split("\n").slice(0, 25).join("\n");
  for (const [label, key] of ADR_KEYS) {
    const m = new RegExp(`^\\*\\*${label}:\\*\\*[ \\t]*(.+)$`, "m").exec(head);
    if (m) adr[key] = m[1].trim(); else unparsed.push(key);
  }
  // The first ADRs wrote the date into the status line: "**Status:** accepted · 2026-07-09".
  // That is a declared date, not a guess, so it is read -- and only when no Date line exists.
  if (!adr.date && adr.status) {
    const d = /^(.*?)\s*·\s*(\d{4}-\d{2}-\d{2})\s*$/.exec(adr.status);
    if (d) { adr.status = d[1]; adr.date = d[2]; unparsed.splice(unparsed.indexOf("date"), 1); }
  }
  if (unparsed.length) adr.unparsed = unparsed;
  return adr;
}

function readAdrBand(repo, band, adrStems) {
  const prefix = band.slice(0, 2);
  const adrs = adrStems.filter((s) => s.startsWith(prefix)).map((s) => readAdr(repo, s));
  const unparsedAdrs = adrs.filter((a) => a.unparsed).length;
  return entity("adrBand", band, `docs/adr/${prefix}??-*.md`, { range: `${band}–${prefix}99`, fileCount: adrs.length, unparsedCount: unparsedAdrs, adrs }, []);
}

function readCommand(repo, name) {
  const source = `.claude/commands/${name}.md`;
  const text = readText(repo, source);
  const fm = frontmatter(text);
  const unparsed = [];
  const facts = pick(fm, ["description"], unparsed);
  const hint = fm?.["argument-hint"];
  if (hint) facts.argumentHint = hint;
  facts.generated = text !== null && /GENERATED FILE — DO NOT EDIT/.test(text.slice(0, 400));
  return entity("command", name, source, facts, unparsed);
}

function readAgent(repo, name) {
  const source = `.claude/agents/${name}.md`;
  const fm = frontmatter(readText(repo, source));
  const unparsed = [];
  const facts = pick(fm, ["description", "model"], unparsed);
  facts.tools = typeof fm?.tools === "string" && fm.tools ? fm.tools.split(",").map((t) => t.trim()).filter(Boolean) : [];
  return entity("agent", name, source, facts, unparsed);
}

function readRule(repo, name) {
  const source = `.claude/rules/${name}.md`;
  const text = readText(repo, source);
  const fm = frontmatter(text);
  const unparsed = [];
  const facts = {};
  const title = firstHeading(text);
  if (title) facts.title = title; else unparsed.push("title");
  if (fm?.description) facts.description = fm.description;
  return entity("rule", name, source, facts, unparsed);
}

function readGates(repo, names, parse) {
  const source = "arc.gates.yaml";
  const text = readText(repo, source);
  const doc = text === null ? null : parse(text);
  // treeGates named these gates from this same file through this same parser. If the second
  // read disagrees -- no file, no list, a name on zero rows or on two -- that is a failure to
  // report, never a gate with every fact "unparsed".
  if (!Array.isArray(doc?.gates)) throw new ReadError(`${source} gave treeGates ${names.length} gate name(s) but has no readable gates list on a second read`);
  const rows = doc.gates;
  return names.map((name) => {
    const hits = rows.filter((r) => r && r.name === name);
    if (hits.length !== 1) throw new ReadError(`${source}: gate "${name}" is on ${hits.length} rows, not exactly one`);
    const row = hits[0];
    const unparsed = [];
    const facts = pick(row, ["check", "mode", "tier", "runtime", "evidence"], unparsed);
    return entity("gate", name, source, facts, unparsed);
  });
}

// ---------- the extractor ----------

/**
 * @param {string} repo
 * @param {Record<string, any>} [world]  treeWorld(repo)'s result; injectable so a test can break
 *   one reader or grow an inventory and watch this fail closed (tests/docs/extract-probe.mjs).
 * @param {{ bands?: any }} [inject]  treeAdrBands(repo)'s result, injectable for the same reason.
 * @returns {Promise<{ code: 0|1|2, message: string, wiki?: object }>}
 */
export async function extract(repo, world, inject = {}) {
  try { return await extractOrThrow(repo, world, inject); }
  catch (e) {
    if (e instanceof ReadError) return { code: 2, message: `unreadable: ${e.message}` };
    throw e;
  }
}

async function extractOrThrow(repo, world, inject) {
  let fc;
  try { fc = await import(pathToFileURL(join(repo, ".claude", "scripts", "core", "face-coverage.mjs")).href); }
  catch (e) { return { code: 2, message: `face-coverage.mjs could not be loaded from ${repo}: ${e.code || e.message}` }; }
  if (typeof fc.treeWorld !== "function") return { code: 2, message: "face-coverage.mjs does not export treeWorld (ADR-1501)" };

  const w = world ?? (await fc.treeWorld(repo));
  const known = new Set([...RENDERED, ...NOT_RENDERED]);
  const unknown = Object.keys(w).filter((k) => !known.has(k)).sort(byteOrder);
  if (unknown.length) {
    return { code: 1, message: `treeWorld returns inventories the wiki has not decided about: ${unknown.join(", ")} -- add each to RENDERED or NOT_RENDERED in wiki-build.mjs, with a reason` };
  }

  const bands = inject.bands ?? (await fc.treeAdrBands(repo));
  // UNREADABLE is never empty: a reader that could not read its source must stop the build,
  // or wiki.json would carry a 0 that agrees with every other 0.
  const unreadable = [];
  for (const [k, inv] of [["gates", w.gates], ["adrBands", bands]]) {
    if (!inv || inv.unreadable || !Array.isArray(inv.names)) unreadable.push(`${k} (${inv?.unreadable || "no names list"})`);
  }
  for (const k of ["products", "lanes", "processes", "commands", "agents", "rules"]) {
    if (!Array.isArray(w[k])) unreadable.push(`${k} (not a list)`);
  }
  if (unreadable.length) return { code: 2, message: `unreadable inventor${unreadable.length === 1 ? "y" : "ies"}: ${unreadable.join("; ")}` };

  const parse = await yamlLoader(repo);
  if (!parse) return { code: 2, message: "the canonical YAML parser (.claude/scripts/engine/yaml-subset.mjs) could not be loaded" };

  const ids = (xs) => [...new Set(xs)].sort(byteOrder);
  const adrStems = ids(fc.mdStems(join(repo, "docs", "adr")).filter((s) => /^\d{4}-./.test(s)));

  const entities = {
    products: ids(w.products.map((p) => p.name)).map((n) => readProduct(repo, n)),
    lanes: ids(w.lanes).map((n) => readLane(repo, n)),
    processes: ids(w.processes).map((n) => readProcess(repo, n, parse)),
    adrBands: ids(bands.names).map((b) => readAdrBand(repo, b, adrStems)),
    commands: ids(w.commands).map((n) => readCommand(repo, n)),
    agents: ids(w.agents).map((n) => readAgent(repo, n)),
    rules: ids(w.rules).map((n) => readRule(repo, n)),
    gates: readGates(repo, ids(w.gates.names), parse),
  };

  const stats = {};
  for (const k of RENDERED) {
    stats[k] = { count: entities[k].length, unparsed: entities[k].filter((e) => e.unparsed).length };
  }
  stats.adrs = {
    count: entities.adrBands.reduce((n, b) => n + b.facts.fileCount, 0),
    unparsed: entities.adrBands.reduce((n, b) => n + b.facts.unparsedCount, 0),
  };

  const wiki = { schema: 1, generator: ".claude/scripts/docs/wiki-build.mjs", stats, entities };
  return { code: 0, message: "ok", wiki };
}

/** Deterministic bytes: fixed key order is built in above; two-space JSON, LF, final newline. */
export function serialize(wiki) {
  return JSON.stringify(wiki, null, 2) + "\n";
}

// ---------- the renderer (Phase 02): wiki.json -> docs/wiki/** ----------
//
// Plain markdown, one page per entity plus an index. Every file starts with the do-not-edit
// banner (DOC-D); a hand-written narrative from docs/wiki/_narrative/<dir>/<id>.md is included
// verbatim, and its absence is shown, not hidden (DOC-E, DOC-F). Every list and every number is
// derived from wiki.json (DOC-B); nothing here reads live state (DOC-I).

export const BANNER_PREFIX = "<!-- GENERATED by .claude/scripts/docs/wiki-build.mjs";
export const WIKI_DIR = "docs/wiki";

const TITLES = {
  products: "Products", lanes: "Lanes", processes: "Processes", adrBands: "Decisions (ADR bands)",
  commands: "Commands", agents: "Agents", rules: "Rules", gates: "Gates",
};
const SINGULAR = {
  products: "Product", lanes: "Lane", processes: "Process", adrBands: "ADR band",
  commands: "Command", agents: "Agent", rules: "Rule", gates: "Gate",
};
/** GitHub's heading anchor for a TITLES value. */
const anchor = (key) => TITLES[key].toLowerCase().replace(/[^\p{L}\p{N} _-]/gu, "").replace(/ /g, "-");

/** Text safe inside a table cell or a line: one line, pipes escaped (and a backslash before one), no raw angle brackets. */
function cell(v) {
  if (v === null || v === undefined || v === "") return "—";
  return String(v).replace(/\s*\n\s*/g, " ").replace(/\\(?=\|)/g, "\\\\").replace(/\|/g, "\\|").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
/**
 * An inline code span, table-safe: the fence is one backtick longer than the longest run inside
 * the value, and pipes are escaped because GitHub splits table cells before it reads code spans.
 */
function code(v) {
  const s = String(v).replace(/\s*\n\s*/g, " ").replace(/\|/g, "\\|");
  const longest = Math.max(0, ...(s.match(/`+/g) || []).map((m) => m.length));
  const fence = "`".repeat(longest + 1);
  return longest ? `${fence} ${s} ${fence}` : `${fence}${s}${fence}`;
}
/** The first backticked token, else the first word -- ADR Product fields are prose. */
function ownerToken(product) {
  if (!product) return null;
  const m = /`([a-z][a-z0-9-]*)`/.exec(product) || /^([a-z][a-z0-9-]*)/.exec(product);
  return m ? m[1] : null;
}

function banner(narrativeRel) {
  return `${BANNER_PREFIX} -- DO NOT EDIT. Regenerate with \`node .claude/scripts/docs/wiki-build.mjs\`.${narrativeRel ? ` Narrative for this page lives in ${narrativeRel}.` : ""} -->`;
}

function narrativeBlock(narrative, narrRel) {
  if (narrative !== null) return ["## Why it exists", "", narrative.replace(/\n+$/, ""), ""];
  return [`> **Narrative pending.** These are this entity's declared facts only; nobody has written why it exists yet. It belongs in \`${narrRel}\` -- hand-written, never generated (ADR-1505, ADR-1508).`, ""];
}

/**
 * Pure: the whole wiki as a map of path (relative to docs/wiki/) -> file content.
 * @param {object} wiki  extract()'s wiki
 * @param {(key: string, id: string) => string|null} narrativeOf  hand-written text or null
 */
export function renderWiki(wiki, narrativeOf) {
  const E = wiki.entities;
  const byId = {};
  for (const key of RENDERED) byId[key] = new Map(E[key].map((e) => [e.id, e]));
  const up = "../../../"; // from docs/wiki/<dir>/<id>.md to the repo root
  const pageLink = (fromKey, key, id, text = id) =>
    byId[key].has(id) ? `[${text}](${fromKey === key ? "" : `../${PAGE_DIRS[key]}/`}${id}.md)` : cell(text);
  const repoLink = (rel, text = rel) => `[${code(text)}](${up}${rel})`;
  const stemOf = (p) => (typeof p === "string" ? p.replace(/^.*\//, "").replace(/\.md$/, "") : null);

  // derived relationships, each computed once
  const requiredBy = new Map(), commandOwner = new Map(), agentOwner = new Map();
  for (const p of E.products) {
    for (const r of p.facts.requires || []) requiredBy.set(r, [...(requiredBy.get(r) || []), p.id]);
    for (const c of p.facts.commands || []) commandOwner.set(stemOf(c), p.id);
    for (const a of p.facts.agents || []) agentOwner.set(stemOf(a), p.id);
  }
  const allAdrs = E.adrBands.flatMap((b) => b.facts.adrs.map((a) => ({ ...a, band: b.id })));
  const adrsFor = new Map();
  for (const a of allAdrs) {
    const o = ownerToken(a.product);
    if (o) adrsFor.set(o, [...(adrsFor.get(o) || []), a]);
  }
  const adrRow = (a, fromBand) => `| ${repoLink(a.file, a.number)} | ${cell(a.title)} | ${cell(a.status)} | ${cell(a.date)} |${fromBand ? ` ${ownerCell(a)} |` : ""}`;
  const ownerCell = (a) => {
    const o = ownerToken(a.product);
    if (!o) return "—";
    if (byId.lanes.has(o)) return `[${o}](../${PAGE_DIRS.lanes}/${o}.md)`;
    if (byId.products.has(o)) return `[${o}](../${PAGE_DIRS.products}/${o}.md)`;
    return cell(o);
  };

  const files = new Map();
  const page = (key, e, body) => {
    const dir = PAGE_DIRS[key];
    const narrRel = `${WIKI_DIR}/${NARRATIVE_DIR}/${dir}/${e.id}.md`;
    const lines = [
      banner(narrRel),
      `# ${key === "commands" ? "/" + e.id : key === "adrBands" ? `ADRs ${e.facts.range}` : e.id}`,
      "",
      `[arc reference](../index.md) › [${TITLES[key]}](../index.md#${anchor(key)}) › **${SINGULAR[key]}**`,
      "",
      ...narrativeBlock(narrativeOf(key, e.id), narrRel),
      ...body,
    ];
    if (e.unparsed?.length) lines.push(`> Not declared in its source file: ${e.unparsed.map(code).join(", ")}.`, "");
    lines.push("## Source", "", `- ${key === "adrBands" ? repoLink("docs/adr", `docs/adr/${e.id.slice(0, 2)}??-*.md`) : repoLink(e.source)}`, "");
    files.set(`${dir}/${e.id}.md`, lines.join("\n").replace(/\n+$/, "\n"));
  };
  const facts = (rows) => ["| | |", "|---|---|", ...rows.map(([k, v]) => `| ${k} | ${v} |`), ""];
  const list = (title, items) => (items.length ? [`## ${title} (${items.length})`, "", ...items.map((x) => `- ${x}`), ""] : [`## ${title}`, "", "None declared.", ""]);

  for (const e of E.products) {
    const f = e.facts;
    const reqBy = (requiredBy.get(e.id) || []).sort(byteOrder);
    page("products", e, [
      "## At a glance", "",
      ...facts([
        ["Version", cell(f.version)],
        ["Requires", f.requires?.length ? f.requires.map((r) => pageLink("products", "products", r)).join(", ") : "—"],
        ["Required by", reqBy.length ? reqBy.map((r) => pageLink("products", "products", r)).join(", ") : "—"],
        ["Lane", byId.lanes.has(e.id) ? pageLink("products", "lanes", e.id) : "—"],
        ["Face room", f.faceRoom ? `${cell(f.faceRoom)}${f.faceRing ? ` (ring ${cell(f.faceRing)})` : ""}` : "—"],
      ]),
      ...list("Commands", (f.commands || []).map((c) => { const id = stemOf(c); return byId.commands.has(id) ? `[/${id}](../${PAGE_DIRS.commands}/${id}.md) — ${cell(byId.commands.get(id).facts.description)}` : code(c); })),
      ...list("Agents", (f.agents || []).map((a) => { const id = stemOf(a); return byId.agents.has(id) ? `[${id}](../${PAGE_DIRS.agents}/${id}.md) — ${cell(byId.agents.get(id).facts.description)}` : code(a); })),
      ...list("Scripts", (f.scripts || []).map((s) => repoLink(s))),
      ...(f.files?.length ? [`## Files (${f.files.length})`, "", ...f.files.map((s) => `- ${repoLink(s)}`), ""] : []),
    ]);
  }

  for (const e of E.lanes) {
    const f = e.facts;
    const adrs = (adrsFor.get(e.id) || []).sort((a, b) => byteOrder(a.number, b.number));
    page("lanes", e, [
      ...(f.title ? [`*${cell(f.title.replace(/^PROGRESS\.md\s*[—-]\s*/, ""))}*`, ""] : []),
      "## At a glance", "",
      // Only what changes once a cycle. Phase, burn and blocked-on move every few hours; putting
      // them here would make every lane's tracker edit a wiki regeneration (a tax on every lane),
      // and the face already shows them live (ADR-1509). They stay in wiki.json for --json.
      ...facts([
        ["Status", cell(f.status)], ["Cycle", cell(f.cycle)],
        ["Product", byId.products.has(e.id) ? pageLink("lanes", "products", e.id) : "—"],
      ]),
      "Where the lane is right now -- phase, burn, what blocks it -- lives in its `PROGRESS.md` and live in the face.", "",
      "## Plan and tracker", "",
      `- ${f.hasPlan ? repoLink(`initiatives/${e.id}/PLAN.md`, "PLAN.md") : "No `PLAN.md`."}`,
      `- ${repoLink(`initiatives/${e.id}/PROGRESS.md`, "PROGRESS.md")}`, "",
      `## Decisions (${adrs.length})`, "",
      ...(adrs.length
        ? ["ADRs whose `Product:` line names this lane first.", "", "| ADR | Decision | Status | Date |", "|---|---|---|---|", ...adrs.map((a) => adrRow(a, false)), ""]
        : ["No ADR names this lane first in its `Product:` line.", ""]),
    ]);
  }

  for (const e of E.processes) {
    const f = e.facts;
    page("processes", e, [
      "## At a glance", "",
      ...facts([["Intent", cell(f.intent)], ["Version", cell(f.version)], ["Permissions", cell(f.permissions)]]),
      ...list("Tools", (f.tools || []).map(code)),
      ...list("Inputs", (f.inputs || []).map(code)),
    ]);
  }

  for (const e of E.adrBands) {
    const f = e.facts;
    const named = new Map();
    for (const a of f.adrs) { const o = ownerToken(a.product); if (o) named.set(o, (named.get(o) || 0) + 1); }
    page("adrBands", e, [
      "## At a glance", "",
      ...facts([
        ["Range", cell(f.range)], ["ADRs", String(f.fileCount)],
        ["Headers missing a field", `${f.unparsedCount} of ${f.fileCount}`],
        ["Named first in `Product:`", named.size ? [...named].sort((a, b) => byteOrder(a[0], b[0])).map(([o, n]) => `${byId.lanes.has(o) ? `[${o}](../${PAGE_DIRS.lanes}/${o}.md)` : byId.products.has(o) ? `[${o}](../${PAGE_DIRS.products}/${o}.md)` : cell(o)} (${n})`).join(", ") : "—"],
      ]),
      `## Decisions (${f.adrs.length})`, "",
      "| ADR | Decision | Status | Date | Product |", "|---|---|---|---|---|",
      ...f.adrs.map((a) => adrRow(a, true)), "",
    ]);
  }

  for (const e of E.commands) {
    const f = e.facts;
    const owner = commandOwner.get(e.id);
    page("commands", e, [
      "## At a glance", "",
      ...facts([
        ["Does", cell(f.description)],
        ["Arguments", f.argumentHint ? code(f.argumentHint) : "—"],
        ["Product", owner ? pageLink("commands", "products", owner) : "—"],
        ["Generated", f.generated ? "yes -- compiled from a process file; edit the process, never this command (ADR-0201)" : "no -- hand-written"],
      ]),
    ]);
  }

  for (const e of E.agents) {
    const f = e.facts;
    const owner = agentOwner.get(e.id);
    page("agents", e, [
      "## At a glance", "",
      ...facts([
        ["Does", cell(f.description)], ["Model tier", cell(f.model)],
        ["Product", owner ? pageLink("agents", "products", owner) : "—"],
      ]),
      ...list("Tools", (f.tools || []).map(code)),
    ]);
  }

  for (const e of E.rules) {
    page("rules", e, ["## At a glance", "", ...facts([["Title", cell(e.facts.title)], ["Applies to", cell(e.facts.description)]])]);
  }

  for (const e of E.gates) {
    const f = e.facts;
    page("gates", e, ["## At a glance", "", ...facts([
      ["Check", f.check ? code(f.check) : "—"], ["Mode", cell(f.mode)], ["Tier", cell(f.tier)],
      ["Runtime", cell(f.runtime)], ["Evidence", f.evidence ? code(f.evidence) : "—"],
    ])]);
  }

  // ---------- the index ----------
  const total = RENDERED.reduce((n, k) => n + E[k].length, 0);
  let narrated = 0;
  const narratedOf = {};
  for (const k of RENDERED) { narratedOf[k] = E[k].filter((e) => narrativeOf(k, e.id) !== null).length; narrated += narratedOf[k]; }
  const link = (k, id, text = id) => `[${text}](${PAGE_DIRS[k]}/${id}.md)`;
  const idx = [
    banner(null),
    "# arc — the reference",
    "",
    "Every part of arc, generated from the tree by `wiki-build`. No list or number on these pages is typed by hand (ADR-1502): a product, lane, process, decision band, command, agent, rule or gate that exists has a page, and a page with nothing behind it fails CI (`wiki-coverage`, ADR-1503). Why each part exists is hand-written, one file per page, under `docs/wiki/_narrative/` -- or honestly marked pending.",
    "",
    "| Part | Count | With narrative |",
    "|---|---|---|",
    ...RENDERED.map((k) => `| [${TITLES[k]}](#${anchor(k)}) | ${E[k].length} | ${narratedOf[k]} |`),
    `| **Total** | **${total}** | **${narrated}** |`,
    "",
    `Narrative debt: **${total - narrated} of ${total}** pages have no narrative yet. ADR headers: ${wiki.stats.adrs.count - wiki.stats.adrs.unparsed} of ${wiki.stats.adrs.count} carry every parsed field; the rest are named on their band's page.`,
    "",
    `## ${TITLES.products}`, "",
    "| Product | Version | Requires | Commands | Agents | Scripts |", "|---|---|---|---|---|---|",
    ...E.products.map((e) => `| ${link("products", e.id)} | ${cell(e.facts.version)} | ${(e.facts.requires || []).map((r) => (byId.products.has(r) ? link("products", r) : cell(r))).join(", ") || "—"} | ${(e.facts.commands || []).length} | ${(e.facts.agents || []).length} | ${(e.facts.scripts || []).length} |`),
    "",
    `## ${TITLES.lanes}`, "",
    "| Lane | Status | Cycle |", "|---|---|---|",
    ...E.lanes.map((e) => `| ${link("lanes", e.id)} | ${cell(e.facts.status)} | ${cell(e.facts.cycle)} |`),
    "",
    `## ${TITLES.processes}`, "",
    "| Process | Version | Intent |", "|---|---|---|",
    ...E.processes.map((e) => `| ${link("processes", e.id)} | ${cell(e.facts.version)} | ${cell(e.facts.intent)} |`),
    "",
    `## ${TITLES.adrBands}`, "",
    "| Band | ADRs | Headers missing a field |", "|---|---|---|",
    ...E.adrBands.map((e) => `| ${link("adrBands", e.id, e.facts.range)} | ${e.facts.fileCount} | ${e.facts.unparsedCount} |`),
    "",
    `## ${TITLES.commands}`, "",
    "| Command | Does |", "|---|---|",
    ...E.commands.map((e) => `| ${link("commands", e.id, "/" + e.id)} | ${cell(e.facts.description)} |`),
    "",
    `## ${TITLES.agents}`, "",
    "| Agent | Model tier | Does |", "|---|---|---|",
    ...E.agents.map((e) => `| ${link("agents", e.id)} | ${cell(e.facts.model)} | ${cell(e.facts.description)} |`),
    "",
    `## ${TITLES.rules}`, "",
    "| Rule | Title |", "|---|---|",
    ...E.rules.map((e) => `| ${link("rules", e.id)} | ${cell(e.facts.title)} |`),
    "",
    `## ${TITLES.gates}`, "",
    "| Gate | Mode | Tier |", "|---|---|---|",
    ...E.gates.map((e) => `| ${link("gates", e.id)} | ${cell(e.facts.mode)} | ${cell(e.facts.tier)} |`),
    "",
  ];
  files.set("index.md", idx.join("\n"));
  return new Map([...files].sort((a, b) => byteOrder(a[0], b[0])));
}

/** Read every entity's narrative by NAMED path (no listing); null when absent. */
function narrativeReader(repo) {
  return (key, id) => {
    const text = readText(repo, `${WIKI_DIR}/${NARRATIVE_DIR}/${PAGE_DIRS[key]}/${id}.md`);
    // The wiki-stale fingerprint is metadata for the author, not prose for the reader.
    return text === null ? null : text.replace(/^<!-- facts:[^\n]*-->\n?/, "");
  };
}

/** extract + render, as { code, message, files } */
export async function render(repo) {
  const res = await extract(repo);
  if (res.code !== 0) return res;
  try { return { code: 0, message: "ok", files: renderWiki(res.wiki, narrativeReader(repo)), wiki: res.wiki }; }
  catch (e) { if (e instanceof ReadError) return { code: 2, message: `unreadable: ${e.message}` }; throw e; }
}

/**
 * What is on disk under a wiki dir, through the coverage gate's own pageTree (the one sanctioned
 * listing): the page paths present, which of them are GENERATED (line 1 is the banner), and the
 * links pageTree refused to count. Import or listing failures are a GateError-style message.
 */
async function onDisk(repo, dirAbs) {
  let fc, cov;
  try {
    fc = await import(pathToFileURL(join(repo, ".claude", "scripts", "core", "face-coverage.mjs")).href);
    cov = await import(pathToFileURL(join(repo, ".claude", "scripts", "docs", "wiki-coverage.mjs")).href);
  } catch (e) { return { error: `the page lister could not be loaded from ${repo}: ${e.code || e.message}` }; }
  if (typeof cov.pageTree !== "function") return { error: "wiki-coverage.mjs does not export pageTree" };
  let tree;
  try { tree = cov.pageTree(fc, { NARRATIVE_DIR }, dirAbs); }
  catch (e) { return { error: `cannot list ${dirAbs}: ${e.code || e.message}` }; }
  const present = [];
  for (const stem of tree.rootPages) present.push(`${stem}.md`);
  for (const d of Object.keys(tree.pages)) for (const stem of tree.pages[d]) present.push(`${d}/${stem}.md`);
  const generated = new Set();
  for (const rel of present) {
    let first = "";
    try { first = readFileSync(join(dirAbs, ...rel.split("/")), "utf8").split("\n", 1)[0]; } catch { /* unreadable: not ours to delete */ }
    if (first.startsWith(BANNER_PREFIX)) generated.add(rel);
  }
  return { present: present.sort(byteOrder), generated, links: (tree.links || []).filter((l) => !l.startsWith(`${NARRATIVE_DIR}/`)) };
}

/**
 * Every link or non-directory where the wiki needs a directory, and every link or non-file where
 * it needs a page -- ONE helper, called by --check and by the writer, so neither can certify or
 * write through a path the other would refuse.
 * @returns {string[]} named problems, empty when the paths are clean
 */
function pathProblems(dirAbs, rels) {
  const out = [];
  const kind = (p) => { try { const s = lstatSync(p); return s.isSymbolicLink() ? "link" : s.isDirectory() ? "dir" : s.isFile() ? "file" : "other"; } catch (e) { return e.code === "ENOENT" ? "absent" : `unreadable (${e.code})`; } };
  const top = kind(dirAbs);
  if (top !== "dir" && top !== "absent") return [`${dirAbs} is ${top === "link" ? "a symlink" : `not a directory (${top})`}`];
  const dirs = new Set(rels.map((r) => r.split("/").slice(0, -1).join("/")).filter(Boolean));
  for (const d of [...dirs].sort(byteOrder)) {
    const k = kind(join(dirAbs, ...d.split("/")));
    if (k !== "dir" && k !== "absent") out.push(`${d}/ is ${k === "link" ? "a symlink" : `not a directory (${k})`}`);
  }
  for (const r of rels) {
    const k = kind(join(dirAbs, ...r.split("/")));
    if (k !== "file" && k !== "absent") out.push(`${r} is ${k === "link" ? "a symlink" : `not a regular file (${k})`}`);
  }
  return out;
}

/** Raw bytes compared as the extractor reads them: no BOM, LF only. */
function sameBytes(abs, content) {
  try { return readFileSync(abs, "utf8").replace(/^﻿/, "").replace(/\r\n?/g, "\n") === content; } catch { return false; }
}

/** --check: compare a render with the committed docs/wiki/ without writing. */
export async function check(repo) {
  const r = await render(repo);
  if (r.code !== 0) return { code: r.code, lines: [`wiki-build: ${r.message}`] };
  const dirAbs = join(repo, ...WIKI_DIR.split("/"));
  const bad = pathProblems(dirAbs, [...r.files.keys()]);
  if (bad.length) return { code: 2, lines: bad.map((b) => `wiki-build: refusing to certify ${WIKI_DIR}/: ${b}`) };
  const disk = await onDisk(repo, dirAbs);
  if (disk.error) return { code: 2, lines: [`wiki-build: ${disk.error}`] };
  const diffs = [];
  for (const l of disk.links) diffs.push(`LINK    ${WIKI_DIR}/${l} (pages are regular files, never links)`);
  for (const [rel, content] of r.files) {
    const abs = join(dirAbs, ...rel.split("/"));
    if (!existsSync(abs)) diffs.push(`MISSING ${WIKI_DIR}/${rel}`);
    else if (!sameBytes(abs, content)) diffs.push(`DIFFERS ${WIKI_DIR}/${rel}`);
  }
  for (const rel of disk.present) if (disk.generated.has(rel) && !r.files.has(rel)) diffs.push(`STALE   ${WIKI_DIR}/${rel} (generated, but nothing in the tree renders it)`);
  if (!diffs.length) return { code: 0, lines: [`wiki-build: check ${r.files.size} generated file(s) -- ${WIKI_DIR}/ is exactly what the renderer writes`] };
  return { code: 1, lines: [`wiki-build: check ${diffs.length} file(s) differ from a fresh render -- regenerate with \`node .claude/scripts/docs/wiki-build.mjs\` and commit the result (ADR-1504)`, ...diffs] };
}

/**
 * --audit-counts (REQ-07): every number on every committed page, re-derived. A fresh render IS
 * the derivation from wiki.json, so each committed page's numbers are compared, line by line and
 * in order, with the numbers the render puts on the same line. A copied or hand-tuned count --
 * the thing ADR-1502 forbids -- shows up as a named page, line and pair of numbers.
 */
export async function auditCounts(repo) {
  const r = await render(repo);
  if (r.code !== 0) return { code: r.code, lines: [`wiki-build: ${r.message}`] };
  const dirAbs = join(repo, ...WIKI_DIR.split("/"));
  const nums = (line) => line.match(/\d+/g) || [];
  const findings = [];
  let pages = 0, numbers = 0;
  for (const [rel, content] of r.files) {
    if (!rel.endsWith(".md")) continue;
    const abs = join(dirAbs, ...rel.split("/"));
    let committed;
    try { committed = readFileSync(abs, "utf8").replace(/^﻿/, "").replace(/\r\n?/g, "\n"); }
    catch { findings.push(`COUNT ${WIKI_DIR}/${rel}: missing -- nothing to audit`); continue; }
    pages++;
    const want = content.split("\n"), have = committed.split("\n");
    for (let i = 0; i < Math.max(want.length, have.length); i++) {
      const w = nums(want[i] ?? ""), h = nums(have[i] ?? "");
      numbers += w.length;
      const at = w.findIndex((n, k) => n !== h[k]);
      if (at >= 0 || h.length !== w.length) {
        const k = at >= 0 ? at : Math.min(w.length, h.length);
        findings.push(`COUNT ${WIKI_DIR}/${rel}:${i + 1}: the page says ${h[k] ?? "(nothing)"}, the tree says ${w[k] ?? "(nothing)"}`);
        break; // one named number per page is enough to act on
      }
    }
  }
  if (!findings.length) return { code: 0, lines: [`wiki-build: audit-counts ${pages} page(s), ${numbers} number(s) re-derived from wiki.json -- all match`] };
  return { code: 1, lines: [`wiki-build: audit-counts ${findings.length} page(s) carry a number the tree does not -- regenerate with \`node .claude/scripts/docs/wiki-build.mjs\`; never edit a count by hand (ADR-1502)`, ...findings] };
}

/**
 * Write a render into a directory: the committed docs/wiki/ of this tree, or any directory
 * OUTSIDE the tree. Everything is validated BEFORE the first write -- the destination, every
 * directory and every target file, and that no hand-written file sits where a page would go --
 * so a refusal leaves nothing half-written. Files are written only when their bytes change, each
 * through an exclusive temp file; a stale GENERATED page is removed; a hand-written file is never
 * touched.
 */
export async function writeWiki(repo, outDir) {
  const r = await render(repo);
  if (r.code !== 0) return { code: r.code, message: r.message };
  const root = realRoot(repo);
  const abs = resolve(outDir);
  let parent;
  try { parent = realpathSync.native(dirname(abs)); } catch (e) { return { code: 2, message: `${outDir}: its parent directory is not there (${e.code || e.message})` }; }
  const final = join(parent, basename(abs));
  if (inside(final, root) && final !== join(root, ...WIKI_DIR.split("/"))) {
    return { code: 2, message: `${outDir} is inside the tree it reads; the only directory the renderer writes in the tree is ${WIKI_DIR}/` };
  }
  const rels = [...r.files.keys()];
  const bad = pathProblems(final, rels);
  if (bad.length) return { code: 2, message: `refusing to write: ${bad.join("; ")}` };
  const handWritten = rels.filter((rel) => {
    const p = join(final, ...rel.split("/"));
    if (!existsSync(p)) return false;
    try { return !readFileSync(p, "utf8").split("\n", 1)[0].startsWith(BANNER_PREFIX); } catch { return true; }
  });
  if (handWritten.length) return { code: 2, message: `refusing to overwrite hand-written file(s) where a generated page goes: ${handWritten.join(", ")}` };
  let written = 0, removed = 0;
  try {
    for (const [rel, content] of r.files) {
      const file = join(final, ...rel.split("/"));
      mkdirSync(dirname(file), { recursive: true });
      if (sameBytes(file, content)) continue;
      const tmp = `${file}.tmp-${process.pid}-${randomBytes(6).toString("hex")}`;
      try { writeFileSync(tmp, content, { flag: "wx" }); renameSync(tmp, file); written++; }
      catch (e) { try { unlinkSync(tmp); } catch { /* none left */ } throw e; }
    }
    const disk = await onDisk(repo, final);
    if (disk.error) return { code: 2, message: disk.error };
    for (const rel of disk.present) {
      if (disk.generated.has(rel) && !r.files.has(rel)) { unlinkSync(join(final, ...rel.split("/"))); removed++; }
    }
  } catch (e) {
    return { code: 2, message: `write failed after ${written} file(s): ${e.code || e.message} -- rerun once the cause is fixed; every write is whole-file` };
  }
  return { code: 0, message: `wiki-build: ${r.files.size} file(s) rendered (${written} written, ${removed} stale removed) -> ${outDir}` };
}

// ---------- CLI ----------

const FLAGS = { "--json": "bool", "--root": "value", "--out": "value", "--check": "bool", "--audit-counts": "bool" };

/** Strict: unknown flag, `--flag=value`, a repeated flag, or a missing / flag-shaped value is exit 2. */
function parseArgs(argv) {
  const opts = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!Object.hasOwn(FLAGS, a)) return { error: `unknown argument ${JSON.stringify(a)} (known: ${Object.keys(FLAGS).join(" ")})` };
    if (Object.hasOwn(opts, a)) return { error: `${a} given twice` };
    if (FLAGS[a] === "bool") { opts[a] = true; continue; }
    const v = argv[i + 1];
    if (v === undefined || v === "" || v.startsWith("--")) return { error: `${a} needs a value` };
    opts[a] = v;
    i++;
  }
  return { opts };
}

async function main(argv) {
  const { opts, error } = parseArgs(argv);
  if (error) { process.stderr.write(`wiki-build: ${error}\n`); return 2; }
  if (opts["--audit-counts"] && (opts["--check"] || opts["--json"] || opts["--out"])) { process.stderr.write("wiki-build: --audit-counts audits docs/wiki/ in place; it takes no --check, --json or --out\n"); return 2; }
  if (opts["--check"] && (opts["--json"] || opts["--out"])) { process.stderr.write("wiki-build: --check compares docs/wiki/ in place; it takes no --json and no --out\n"); return 2; }
  const repo = resolve(opts["--root"] ?? REPO_DEFAULT);
  if (!existsSync(join(repo, ".claude", "scripts", "core", "face-coverage.mjs")) || !existsSync(join(repo, ".claude", "scripts", "docs", "wiki-coverage.mjs"))) {
    process.stderr.write(`wiki-build: ${repo} is not an arc tree with the docs product (needs .claude/scripts/core/face-coverage.mjs and .claude/scripts/docs/wiki-coverage.mjs)\n`);
    return 2;
  }
  if (opts["--audit-counts"]) {
    const a = await auditCounts(repo);
    const w = await say(a.lines.join("\n") + "\n");
    return w || a.code;
  }
  if (opts["--check"]) {
    const c = await check(repo);
    const w = await say(c.lines.join("\n") + "\n");
    return w || c.code;
  }
  if (!opts["--json"]) {
    const r = await writeWiki(repo, opts["--out"] ?? join(repo, ...WIKI_DIR.split("/")));
    if (r.code !== 0) { process.stderr.write(`wiki-build: ${r.message}\n`); return r.code; }
    return say(r.message + "\n");
  }
  const res = await extract(repo);
  if (res.code !== 0) { process.stderr.write(`wiki-build: ${res.message}\n`); return res.code; }
  const bytes = serialize(res.wiki);
  if (opts["--out"]) {
    const err = writeOut(repo, opts["--out"], bytes);
    if (err) { process.stderr.write(`wiki-build: ${err}\n`); return 2; }
    const s = res.wiki.stats;
    return say(`wiki-build: ${RENDERED.map((k) => `${s[k].count} ${k}`).join(", ")} (${s.adrs.count} ADRs, ${s.adrs.unparsed} with unparsed headers) -> ${opts["--out"]}\n`);
  }
  return say(bytes);
}

/**
 * Write stdout and report a failed write as exit 2 rather than letting an EPIPE surface as an
 * uncaught exception, whose exit 1 would read as "an undecided inventory".
 */
function say(text) {
  return new Promise((done) => {
    let failed = false;
    process.stdout.once("error", (e) => {
      if (failed) return;
      failed = true;
      process.stderr.write(`wiki-build: stdout closed (${e.code || e.message})\n`);
      done(2);
    });
    process.stdout.write(text, (e) => { if (!failed) done(e ? 2 : 0); });
  });
}

/**
 * The writer never writes through a link, never onto a directory, and never into the tree
 * except under docs/wiki/ -- it reads the tree, so a write elsewhere in it could overwrite the
 * very source it just read. Temp file + rename, so a crash leaves no half-written wiki.json.
 * @returns {string|null} an error message, or null on success
 */
function writeOut(repo, out, bytes) {
  const abs = resolve(out);
  let st = null;
  try { st = lstatSync(abs); } catch (e) { if (e.code !== "ENOENT") return `cannot stat --out ${out}: ${e.code || e.message}`; }
  if (st?.isSymbolicLink()) return `--out ${out} is a symlink; refusing to write through it`;
  if (st && !st.isFile()) return `--out ${out} is not a regular file`;
  let parent;
  try { parent = realpathSync.native(dirname(abs)); } catch (e) { return `--out ${out}: its directory is not there (${e.code || e.message})`; }
  const final = join(parent, basename(abs));
  const root = realRoot(repo);
  // Inside the tree, exactly ONE path may be written: docs/wiki/wiki.json. Everything else under
  // docs/wiki/ is either a generated page (Phase 02 writes those, not --out) or a hand-written
  // narrative that no script may ever overwrite (ADR-1505).
  if (inside(final, root) && final !== join(root, "docs", "wiki", "wiki.json")) return `--out ${out} is inside the tree it reads; the only path wiki-build --out writes in the tree is docs/wiki/wiki.json`;
  // The temp name is unpredictable and created exclusively ('wx'): a planted link or file at the
  // temp path makes the open fail instead of writing through it.
  const tmp = `${final}.tmp-${process.pid}-${randomBytes(6).toString("hex")}`;
  try { writeFileSync(tmp, bytes, { flag: "wx" }); renameSync(tmp, final); }
  catch (e) {
    try { unlinkSync(tmp); } catch { /* nothing was left */ }
    return `cannot write ${out}: ${e.code || e.message}`;
  }
  return null;
}

/** Realpath BOTH sides: a main guard that compares spellings no-ops behind a symlink. */
function isMainModule() {
  const invoked = process.argv[1];
  if (!invoked) return false;
  const self = fileURLToPath(import.meta.url);
  // Realpath BOTH sides; and when realpath itself throws (a subst drive, a link cycle), fall back
  // to the resolved spellings rather than to "not main" -- a gate that silently does nothing
  // and exits 0 is worse than no gate.
  try { return realpathSync(invoked) === realpathSync(self); }
  catch { return resolve(invoked) === resolve(self); }
}

if (isMainModule()) {
  main(process.argv.slice(2)).then((code) => { process.exitCode = code; }, (e) => {
    process.stderr.write(`wiki-build: ${e?.stack || e}\n`);
    process.exitCode = 2;
  });
}
