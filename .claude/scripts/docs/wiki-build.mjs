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

import { readFileSync, writeFileSync, existsSync, statSync, realpathSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

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

// ---------- small, total helpers ----------

/** Byte-order comparison. Never localeCompare: collation differs per OS and per locale. */
const byteOrder = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/** Read a named file as text with LF endings, or null. A CRLF checkout must not change a byte. */
function readText(repo, rel) {
  const p = join(repo, ...rel.split("/"));
  try {
    if (!statSync(p).isFile()) return null;
    return readFileSync(p, "utf8").replace(/\r\n?/g, "\n");
  } catch { return null; }
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
  if (text === null) return entity("lane", name, source, { hasPlan: existsSync(join(repo, "initiatives", name, "PLAN.md")) }, ["progress"]);
  // The machine header: `key: value` lines before the first blank-line-separated prose block.
  const header = {};
  for (const line of text.split("\n").slice(0, 30)) {
    const m = /^([a-z-]+):[ \t]*(.*)$/.exec(line);
    if (m && LANE_KEYS.includes(m[1]) && !(m[1] in header)) header[m[1]] = m[2].trim();
  }
  const unparsed = [];
  const facts = pick(header, LANE_KEYS, unparsed);
  facts.title = firstHeading(text);
  facts.hasPlan = existsSync(join(repo, "initiatives", name, "PLAN.md"));
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
  const doc = text === null || !parse ? null : parse(text);
  const rows = Array.isArray(doc?.gates) ? doc.gates : [];
  return names.map((name) => {
    const row = rows.find((r) => r && r.name === name);
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
 * @returns {Promise<{ code: 0|1|2, message: string, wiki?: object }>}
 */
export async function extract(repo, world) {
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

  const bands = await fc.treeAdrBands(repo);
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
    const out = resolve(opts["--out"]);
    try {
      if (existsSync(out) && statSync(out).isDirectory()) { process.stderr.write(`wiki-build: --out ${out} is a directory\n`); return 2; }
      writeFileSync(out, bytes);
    } catch (e) { process.stderr.write(`wiki-build: cannot write ${out}: ${e.code || e.message}\n`); return 2; }
    const s = res.wiki.stats;
    process.stdout.write(`wiki-build: ${RENDERED.map((k) => `${s[k].count} ${k}`).join(", ")} (${s.adrs.count} ADRs, ${s.adrs.unparsed} with unparsed headers) -> ${opts["--out"]}\n`);
  } else {
    process.stdout.write(bytes);
  }
  return 0;
}

/** Realpath BOTH sides: a main guard that compares spellings no-ops behind a symlink. */
function isMainModule() {
  try {
    const invoked = process.argv[1];
    if (!invoked) return false;
    return realpathSync(invoked) === realpathSync(fileURLToPath(import.meta.url));
  } catch { return false; }
}

if (isMainModule()) {
  main(process.argv.slice(2)).then((code) => { process.exitCode = code; }, (e) => {
    process.stderr.write(`wiki-build: ${e?.stack || e}\n`);
    process.exitCode = 2;
  });
}
