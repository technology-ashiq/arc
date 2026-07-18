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
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

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
  if (a === "--products") { productsArg = argv[++i] ?? ""; if (mode === null) mode = "plan"; }
  else if (a === "--list") { mode = "list"; }
  else if (a === "--status") { mode = "status"; }
  else if (a === "--registry") { mode = "registry"; }
  else if (a === "--root") { root = argv[++i]; }
  else die(`unknown argument: ${a}`);
}
if (!root) {
  // default: walk up to the dir holding products/. NOT a fixed `..` count -- that is
  // correct only for wherever the script sits today, and Phase 03 moves it a level
  // deeper. Depth-independent, so ckpt 3/4 cannot silently repeat the same break.
  let d = fileURLToPath(new URL(".", import.meta.url));
  while (!existsSync(join(d, "products")) && dirname(d) !== d) d = dirname(d);
  root = d;
}
if (!mode) die("usage: arc-products.mjs (--products LIST | --list) [--root DIR]");

// ---------- path safety (defense in depth with product-lint) ----------
function assertSafe(p, ctx) {
  if (typeof p !== "string" || p.length === 0) die(`${ctx}: empty path`);
  if (/[\x00-\x1f]/.test(p)) die(`${ctx}: control character in path: ${JSON.stringify(p)}`);
  // Reject backslashes outright -- `..\..\x` escapes as traversal on the PowerShell
  // twin though it has no `/`-delimited `..` segment (review C1).
  if (p.includes("\\")) die(`${ctx}: backslash not allowed in path: ${p}`);
  if (p !== p.trim()) die(`${ctx}: leading/trailing whitespace in path: ${JSON.stringify(p)}`);
  if (p.startsWith("/") || p.startsWith("\\") || /^[A-Za-z]:/.test(p)) die(`${ctx}: absolute path not allowed: ${p}`);
  // `..` and its Windows-normalizing variants (`.. `, `...`) -- .NET strips trailing
  // dots/spaces so `.. ` becomes `..` (review W4).
  if (p.split("/").some((seg) => /^\.\.[.\s]*$/.test(seg))) die(`${ctx}: path traversal not allowed: ${p}`);
}

// envSentinel is emitted raw in the ENVBLOCK plan line and used as a regex by both
// twins -- restrict it to a simple anchored token so a newline can't inject a plan
// line (review C2) and a metachar can't ReDoS (review W2).
const ENV_SENTINEL_RE = /^\^?[A-Za-z0-9_=-]+\$?$/;

// Guard a payload field that must be an array-or-absent -- the resolver is the only
// consumer-side check, so a type-invalid manifest must die cleanly, not stack-trace
// (review W1).
const asArray = (v, ctx) => {
  if (v === undefined) return [];
  if (!Array.isArray(v)) die(`${ctx}: expected an array`);
  return v;
};

// Source commit stamped into the registry: a deterministic test override
// (ARC_SOURCE_COMMIT, validated hex) wins; else the mold's short HEAD; else
// "unknown" (no git / not a repo) -- the registry writes cleanly regardless.
function registrySourceCommit(dir) {
  const override = process.env.ARC_SOURCE_COMMIT;
  if (override && /^[0-9a-f]+$/i.test(override)) return override;
  try {
    return execFileSync("git", ["-C", dir, "rev-parse", "--short", "HEAD"], {
      encoding: "utf8", stdio: ["ignore", "pipe", "ignore"],
    }).trim() || "unknown";
  } catch { return "unknown"; }
}

// The frozen product lineup (No-go this cycle: no 7th product, no re-slicing). Used ONLY
// to enumerate ABSENT products in a consumer repo, which has no products/ dir to read;
// INSTALLED state itself always comes from the registry, never from file presence (REQ-05).
const CATALOG = ["core", "council", "git", "plan", "qa", "review"];

// --status rendered from the registry (REQ-05): the registry is the ground truth for
// INSTALLED; HEALTH is a live integrity check (are the files it claims still on disk?).
function renderRegistryStatus(rootDir, reg) {
  const installed = new Set(Object.keys(reg.products));
  const commit = reg?.source?.commit ?? "unknown";
  const out = [
    `arc — product status  (registry @ ${commit})`,
    `${"PRODUCT".padEnd(10)}${"INSTALLED".padEnd(11)}${"HEALTH".padEnd(10)}FILES`,
  ];
  for (const name of CATALOG) {
    if (!installed.has(name)) { out.push(`${name.padEnd(10)}${"no".padEnd(11)}${"-".padEnd(10)}-`); continue; }
    const files = Array.isArray(reg.products[name]?.files) ? reg.products[name].files : [];
    const present = files.filter((p) => typeof p === "string" && existsSync(join(rootDir, p))).length;
    const total = files.length;
    const health = present === total ? "ok" : `degraded(${total - present} missing)`;
    out.push(`${name.padEnd(10)}${"yes".padEnd(11)}${health.padEnd(10)}${present}/${total}`);
  }
  const absent = CATALOG.filter((n) => !installed.has(n));
  if (absent.length) out.push(`\ninstall missing: sync-to-project.sh <target> --products ${absent.join(",")}`);
  process.stdout.write(out.join("\n") + "\n");
  process.exit(0);
}

// ---------- --status via registry (REQ-05): registry is ground truth when present ----------
// Runs BEFORE the products/ requirement so a consumer repo (no synced manifests) still gets
// a true status. A present-but-unreadable registry degrades loudly, never crashes (adversarial).
if (mode === "status") {
  const regPath = join(root, ".claude", "arc-registry.json");
  if (existsSync(regPath)) {
    let reg = null;
    try { reg = JSON.parse(readFileSync(regPath, "utf8")); } catch { reg = null; }
    if (reg && reg.products && typeof reg.products === "object" && !Array.isArray(reg.products)) {
      renderRegistryStatus(root, reg); // prints + exits 0
    }
    process.stdout.write(
      `arc — product status  (root: ${root})\n` +
      `.claude/arc-registry.json present but unreadable — reinstall to repair (sync-to-project.sh <target>).\n`
    );
    process.exit(0);
  }
  // no registry here: fall through to the products/ file-presence path (mold) below.
}

// ---------- load manifests ----------
const productsDir = join(root, "products");
if (!existsSync(productsDir)) {
  // /arc in a consumer repo has no products/ (manifests aren't synced) — degrade
  // gracefully rather than erroring; registry-backed status lands in Phase 2.
  if (mode === "status") {
    process.stdout.write(
      `arc — product status  (root: ${root})\n` +
      `no product registry here yet.\n` +
      `run /arc from the arc mold, or (Phase 2) a registry-backed install writes .claude/arc-registry.json.\n`
    );
    process.exit(0);
  }
  die(`no products/ dir under ${root}`);
}

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

// ---------- --status: read-only per-product install view (file-presence, Phase 0) ----------
if (mode === "status") {
  const rows = allNames.map((name) => {
    const m = manifests.get(name);
    const paths = [...(m.commands ?? []), ...(m.agents ?? []), ...(m.scripts ?? []), ...(m.files ?? [])];
    const present = paths.filter((p) => existsSync(join(root, p))).length;
    const total = paths.length;
    const state = total > 0 && present === total ? "yes" : present > 0 ? "partial" : "no";
    return { name, state, present, total };
  });
  const out = [`arc — product status  (root: ${root})`, `${"PRODUCT".padEnd(10)}${"INSTALLED".padEnd(11)}FILES`];
  for (const r of rows) out.push(`${r.name.padEnd(10)}${r.state.padEnd(11)}${r.present}/${r.total}`);
  const absent = rows.filter((r) => r.state !== "yes").map((r) => r.name);
  if (absent.length) out.push(`\ninstall missing: sync-to-project.sh <target> --products ${absent.join(",")}`);
  process.stdout.write(out.join("\n") + "\n");
  process.exit(0);
}

// ---------- --registry: emit the target's arc-registry.json (Phase 2, REQ-08) ----------
// One JSON document (not the TAB plan): products, versions, per-product installed
// file lists, source commit. Both twins redirect this to .claude/arc-registry.json.
// v1 schema is LOCKED (PLAN rabbit hole): schema, source.commit, products.<name>.{version,files}.
if (mode === "registry") {
  const reqNames = productsArg.split(",").map((s) => s.trim()).filter(Boolean);
  const names = reqNames.length ? reqNames : allNames; // no --products => every product (bare/full install)
  for (const r of names) {
    if (!manifests.has(r)) die(`unknown product: ${r}\nvalid products: ${allNames.join(", ")}`);
  }
  const inSet = new Set();
  const addDeps = (name) => {
    if (inSet.has(name)) return;
    inSet.add(name);
    for (const dep of manifests.get(name).requires ?? []) {
      if (!manifests.has(dep)) die(`product "${name}" requires missing product "${dep}"`);
      addDeps(dep);
    }
  };
  if (manifests.has("core")) addDeps("core"); // core always rides along (REQ-01)
  for (const r of names) addDeps(r);

  const products = {};
  for (const name of [...inSet].sort()) {
    const m = manifests.get(name);
    // version is a registry field AND transported to the ledger reader -- a hostile
    // manifest must die cleanly, never emit a malformed token (adversarial pass).
    if (typeof m.version !== "string" || !/^[\w.+-]+$/.test(m.version))
      die(`${name}.version: must be a simple version token ([\\w.+-]+), got ${JSON.stringify(m.version)}`);
    const files = [];
    const addFile = (p, ctx) => { assertSafe(p, ctx); files.push(p); }; // same path safety as the plan
    for (const p of asArray(m.commands, `${name}.commands`)) addFile(p, `${name}.commands`);
    for (const p of asArray(m.agents, `${name}.agents`)) addFile(p, `${name}.agents`);
    for (const p of asArray(m.scripts, `${name}.scripts`)) addFile(p, `${name}.scripts`);
    for (const p of asArray(m.files, `${name}.files`)) addFile(p, `${name}.files`);
    for (const d of asArray(m.docs, `${name}.docs`)) addFile(d?.dest, `${name}.docs`); // dest, not src
    products[name] = { version: m.version, files };
  }
  const registry = { schema: 1, source: { commit: registrySourceCommit(root) }, products };
  process.stdout.write(JSON.stringify(registry, null, 2) + "\n");
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
  for (const p of asArray(m.commands, `${name}.commands`)) emitCopy(p, p, `${name}.commands`);
  for (const p of asArray(m.agents, `${name}.agents`)) emitCopy(p, p, `${name}.agents`);
  for (const p of asArray(m.scripts, `${name}.scripts`)) emitCopy(p, p, `${name}.scripts`);
  for (const p of asArray(m.files, `${name}.files`)) emitCopy(p, p, `${name}.files`);
  for (const d of asArray(m.docs, `${name}.docs`)) emitCopy(d?.src, d?.dest, `${name}.docs`);
  for (const dir of asArray(m.skeletonDirs, `${name}.skeletonDirs`)) { assertSafe(dir, `${name}.skeletonDirs`); emitMkdir(dir); }
  if (m.envBlock) {
    assertSafe(m.envBlock, `${name}.envBlock`);
    const sentinel = m.envSentinel ?? "";
    if (!ENV_SENTINEL_RE.test(sentinel))
      die(`${name}.envSentinel: must be a simple anchored token (^?[A-Za-z0-9_.=-]+$?), got ${JSON.stringify(sentinel)}`);
    out.push(`ENVBLOCK${TAB}${m.envBlock}${TAB}${sentinel}`);
  }
}
process.stdout.write(out.join("\n") + "\n");
