#!/usr/bin/env node
/**
 * arc-products.mjs — the single product resolver (ADR-0015).
 *
 * Reads products/NAME/manifest.json and emits a line-protocol install plan on
 * stdout. BOTH sync twins (sync-to-project.sh / .ps1) consume this plan as dumb
 * copy loops — no twin ever parses JSON. One parser to harden, one place for the
 * adversarial fixture corpus. Zero deps (node:fs, node:path), Node >=18.
 *
 * Usage:
 *   node arc-products.mjs --products core,council [--root DIR]   # emit plan
 *   node arc-products.mjs --list [--root DIR]                    # names, one per line
 *
 * Line protocol v1 (TAB-separated, LF endings, UTF-8):
 *   PROTO   \t 1                       (always line 1)
 *   MKDIR   \t dest-dir
 *   COPY    \t src-path \t dest-path
 *   ENVBLOCK\t src-file \t sentinel-regex
 *
 * Exit: 0 ok · 2 bad usage / unknown product / unsafe path.
 */
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const TAB = "\t";

function die(msg) {
  process.stderr.write(`arc-products: ${msg}\n`);
  process.exit(2);
}

// ---------- args ----------
const argv = process.argv.slice(2);
let mode = null; // "plan" | "list"
let productsArg = "";
let root = null;
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--products") { mode = "plan"; productsArg = argv[++i] ?? ""; }
  else if (a === "--list") { mode = "list"; }
  else if (a === "--root") { root = argv[++i]; }
  else die(`unknown argument: ${a}`);
}
if (!root) {
  // default: repo root = two levels up from .claude/scripts/
  const here = fileURLToPath(new URL(".", import.meta.url));
  root = join(here, "..", "..");
}
if (!mode) die("usage: arc-products.mjs (--products LIST | --list) [--root DIR]");

// ---------- path safety (defense in depth with product-lint) ----------
function assertSafe(p, ctx) {
  if (typeof p !== "string" || p.length === 0) die(`${ctx}: empty path`);
  if (/[\x00-\x1f]/.test(p)) die(`${ctx}: control character in path: ${JSON.stringify(p)}`);
  if (p !== p.trim()) die(`${ctx}: leading/trailing whitespace in path: ${JSON.stringify(p)}`);
  if (p.startsWith("/") || /^[A-Za-z]:/.test(p)) die(`${ctx}: absolute path not allowed: ${p}`);
  if (p.split("/").some((seg) => seg === "..")) die(`${ctx}: path traversal not allowed: ${p}`);
}

// ---------- load manifests ----------
const productsDir = join(root, "products");
if (!existsSync(productsDir)) die(`no products/ dir under ${root}`);

const manifests = new Map(); // name -> manifest object
for (const entry of readdirSync(productsDir)) {
  const mf = join(productsDir, entry, "manifest.json");
  if (!existsSync(mf)) continue;
  let obj;
  try { obj = JSON.parse(readFileSync(mf, "utf8")); }
  catch (e) { die(`products/${entry}/manifest.json: invalid JSON (${e.message})`); }
  if (obj.name !== entry) die(`products/${entry}/manifest.json: name "${obj.name}" != dir "${entry}"`);
  manifests.set(obj.name, obj);
}
if (manifests.size === 0) die(`no manifests found under ${productsDir}`);

const allNames = [...manifests.keys()].sort();

// ---------- --list ----------
if (mode === "list") {
  process.stdout.write(allNames.join("\n") + "\n");
  process.exit(0);
}

// ---------- resolve requested set + transitive requires + implicit core ----------
const requested = productsArg.split(",").map((s) => s.trim()).filter(Boolean);
for (const r of requested) {
  if (!manifests.has(r)) die(`unknown product: ${r}\nvalid products: ${allNames.join(", ")}`);
}
const resolved = new Set();
const addWithDeps = (name) => {
  if (resolved.has(name)) return;
  if (!manifests.has(name)) die(`product "${name}" requires missing product "${name}"`);
  resolved.add(name);
  for (const dep of manifests.get(name).requires ?? []) addWithDeps(dep);
};
if (manifests.has("core")) addWithDeps("core"); // core is always installed
for (const r of requested) addWithDeps(r);

// install order: core first, then the rest alphabetically
const order = [...resolved].filter((n) => n !== "core").sort();
if (resolved.has("core")) order.unshift("core");

// ---------- emit plan ----------
const out = [];
const mkdirSeen = new Set();
const emitMkdir = (dir) => {
  if (!dir || dir === "." || mkdirSeen.has(dir)) return;
  mkdirSeen.add(dir);
  out.push(`MKDIR${TAB}${dir}`);
};
const parentDir = (p) => (p.lastIndexOf("/") > 0 ? p.slice(0, p.lastIndexOf("/")) : "");
const emitCopy = (src, dest, ctx) => {
  assertSafe(src, ctx);
  assertSafe(dest, ctx);
  emitMkdir(parentDir(dest));
  out.push(`COPY${TAB}${src}${TAB}${dest}`);
};

out.push(`PROTO${TAB}1`);
for (const name of order) {
  const m = manifests.get(name);
  for (const p of m.commands ?? []) emitCopy(p, p, `${name}.commands`);
  for (const p of m.agents ?? []) emitCopy(p, p, `${name}.agents`);
  for (const p of m.scripts ?? []) emitCopy(p, p, `${name}.scripts`);
  for (const p of m.files ?? []) emitCopy(p, p, `${name}.files`);
  for (const d of m.docs ?? []) emitCopy(d.src, d.dest, `${name}.docs`);
  for (const dir of m.skeletonDirs ?? []) { assertSafe(dir, `${name}.skeletonDirs`); emitMkdir(dir); }
  if (m.envBlock) {
    assertSafe(m.envBlock, `${name}.envBlock`);
    out.push(`ENVBLOCK${TAB}${m.envBlock}${TAB}${m.envSentinel ?? ""}`);
  }
}
process.stdout.write(out.join("\n") + "\n");
