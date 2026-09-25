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
//   wiki-build.mjs --json [--root DIR] [--out FILE]
//
// Exit: 0 extracted | 1 a treeWorld key this wiki has not decided about (named)
//       | 2 usage, or an inventory / file that could not be read (named). Never 0 on unreadable.

import { readFileSync, writeFileSync, renameSync, unlinkSync, existsSync, lstatSync, realpathSync } from "node:fs";
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

// ---------- CLI ----------

const FLAGS = { "--json": "bool", "--root": "value", "--out": "value" };

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
  if (!opts["--json"]) { process.stderr.write("wiki-build: nothing to do -- pass --json (page rendering arrives in docs Phase 02)\n"); return 2; }
  const repo = resolve(opts["--root"] ?? REPO_DEFAULT);
  if (!existsSync(join(repo, ".claude", "scripts", "core", "face-coverage.mjs"))) {
    process.stderr.write(`wiki-build: ${repo} is not an arc tree (no .claude/scripts/core/face-coverage.mjs)\n`);
    return 2;
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
