#!/usr/bin/env node
/**
 * product-lint.mjs — the manifest registry police (ADR-0014/0015).
 *
 * Validates products/NAME/manifest.json against the v1 schema and the coverage
 * invariant: every file the twins sync maps to exactly one product. This is the
 * adversarial gate — the hostile-fixture corpus (tests/fixtures/products/hostile)
 * must ALL exit 2. Council v2+v3 found 43 holes in gates that passed their own
 * tests; this parser gets the same breaking-input discipline.
 *
 * Usage: node product-lint.mjs [--root DIR]
 * Exit:  0 clean · 2 one or more violations.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const errors = [];
const err = (m) => errors.push(m);

// ---------- args ----------
let root = null;
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === "--root") root = argv[++i];
  else { process.stderr.write(`product-lint: unknown argument: ${argv[i]}\n`); process.exit(2); }
}
if (!root) {
  const here = fileURLToPath(new URL(".", import.meta.url));
  root = join(here, "..", "..");
}

const KNOWN_FIELDS = new Set([
  "name", "version", "requires", "commands", "agents", "scripts", "files",
  "docs", "skeletonDirs", "envBlock", "envSentinel", "hooks",
]);
const SEMVER = /^\d+\.\d+\.\d+$/;
const NAME_RE = /^[a-z][a-z-]*$/;

function checkPath(p, ctx) {
  if (typeof p !== "string" || p.length === 0) { err(`${ctx}: empty path entry`); return false; }
  let ok = true;
  if (/[\x00-\x1f]/.test(p)) { err(`${ctx}: control character in path: ${JSON.stringify(p)}`); ok = false; }
  // A repo-relative payload path is forward-slash only. Reject any backslash
  // outright -- `..\..\x` has no `/`-delimited `..` segment yet .NET/Join-Path
  // resolves it as traversal on the PowerShell twin (review C1).
  if (p.includes("\\")) { err(`${ctx}: backslash not allowed in path: ${JSON.stringify(p)}`); ok = false; }
  if (p !== p.trim()) { err(`${ctx}: leading/trailing whitespace in path: ${JSON.stringify(p)}`); ok = false; }
  if (p.startsWith("/") || p.startsWith("\\") || /^[A-Za-z]:/.test(p)) { err(`${ctx}: absolute path not allowed: ${p}`); ok = false; }
  // Reject `..` and its Windows-normalizing variants (`.. `, `...`, `... `) per
  // segment -- .NET/Win32 strips trailing dots+spaces, so `.. ` normalizes to `..`
  // (review W4, same class as the backslash rule).
  if (p.split("/").some((s) => /^\.\.[.\s]*$/.test(s))) { err(`${ctx}: path traversal not allowed: ${p}`); ok = false; }
  return ok;
}

// envSentinel becomes an unanchored regex in both twins (grep / Select-String) and
// is emitted raw in the ENVBLOCK plan line -- a newline injects arbitrary protocol
// lines (review C2) and a metachar is a ReDoS surface (review W2). Restrict it to a
// simple anchored token: optional ^/$ anchors around [A-Za-z0-9_.=-].
const ENV_SENTINEL_RE = /^\^?[A-Za-z0-9_=-]+\$?$/;

// ---------- load + per-manifest checks ----------
const productsDir = join(root, "products");
if (!existsSync(productsDir)) { err(`no products/ dir under ${root}`); report(); }

const seenNames = new Map(); // name -> dir
const mapped = new Map();     // repo-rel payload path -> [owner names]

for (const dir of readdirSync(productsDir)) {
  const mf = join(productsDir, dir, "manifest.json");
  if (!existsSync(mf)) continue;

  const raw = readFileSync(mf); // Buffer — byte-level hygiene before parse
  if (raw.length >= 3 && raw[0] === 0xef && raw[1] === 0xbb && raw[2] === 0xbf)
    err(`products/${dir}/manifest.json: UTF-8 BOM not allowed`);
  if (raw.includes(0x0d))
    err(`products/${dir}/manifest.json: CR byte (CRLF) not allowed — LF only`);

  let obj;
  try { obj = JSON.parse(raw.toString("utf8")); }
  catch (e) { err(`products/${dir}/manifest.json: invalid JSON (${e.message})`); continue; }

  for (const k of Object.keys(obj))
    if (!KNOWN_FIELDS.has(k)) err(`products/${dir}: unknown field "${k}"`);

  // name
  if (typeof obj.name !== "string" || obj.name.length === 0) {
    err(`products/${dir}: name is empty or not a string`);
  } else {
    if (!NAME_RE.test(obj.name)) err(`products/${dir}: name "${obj.name}" must match ^[a-z][a-z-]*$`);
    if (obj.name !== dir) err(`products/${dir}: name "${obj.name}" does not match directory "${dir}"`);
    if (seenNames.has(obj.name)) err(`duplicate product name "${obj.name}" (dirs ${seenNames.get(obj.name)} and ${dir})`);
    else seenNames.set(obj.name, dir);
  }

  // version
  if (typeof obj.version !== "string" || !SEMVER.test(obj.version))
    err(`products/${dir}: version ${JSON.stringify(obj.version)} is not semver MAJOR.MINOR.PATCH`);

  // payload arrays (files = catch-all for non-command/agent .claude payload:
  // hooks, rules, output-styles, templates, skills, settings.json)
  const cmds = obj.commands ?? [], ags = obj.agents ?? [], scs = obj.scripts ?? [], fls = obj.files ?? [];
  for (const [f, arr] of [["commands", cmds], ["agents", ags], ["scripts", scs], ["files", fls]])
    if (!Array.isArray(arr)) err(`products/${dir}: ${f} must be an array`);
  const len = (a) => (Array.isArray(a) ? a.length : 0);
  if (len(cmds) + len(ags) + len(scs) + len(fls) === 0)
    err(`products/${dir}: at least one of commands/agents/scripts/files must be non-empty`);

  // payload path checks + coverage mapping + existence
  const payload = [];
  for (const [f, arr] of [["commands", cmds], ["agents", ags], ["scripts", scs], ["files", fls]]) {
    if (!Array.isArray(arr)) continue;
    for (const p of arr) {
      const safe = checkPath(p, `products/${dir}.${f}`);
      if (typeof p === "string" && p.length) payload.push(p);
      if (safe && !existsSync(join(root, p))) err(`products/${dir}: declared path does not exist: ${p}`);
    }
  }
  for (const p of payload) {
    if (!mapped.has(p)) mapped.set(p, []);
    mapped.get(p).push(obj.name ?? dir);
  }

  // docs
  const docPaths = [];
  if (obj.docs !== undefined) {
    if (!Array.isArray(obj.docs)) err(`products/${dir}: docs must be an array`);
    else for (const d of obj.docs) {
      const sOk = checkPath(d?.src, `products/${dir}.docs.src`);
      checkPath(d?.dest, `products/${dir}.docs.dest`);
      if (typeof d?.src === "string") docPaths.push(d.src);
      if (typeof d?.dest === "string") docPaths.push(d.dest);
      if (sOk && !existsSync(join(root, d.src))) err(`products/${dir}: docs src does not exist: ${d.src}`);
    }
  }
  // skeletonDirs / envBlock
  if (obj.skeletonDirs !== undefined) {
    if (!Array.isArray(obj.skeletonDirs)) err(`products/${dir}: skeletonDirs must be an array`);
    else for (const s of obj.skeletonDirs) checkPath(s, `products/${dir}.skeletonDirs`);
  }
  if (obj.envBlock !== undefined) {
    checkPath(obj.envBlock, `products/${dir}.envBlock`);
    // A lints-clean manifest must resolve clean: the resolver dies on an empty
    // sentinel, so require one here too (review W3).
    if (obj.envSentinel === undefined) err(`products/${dir}: envBlock requires envSentinel`);
  }
  if (obj.envSentinel !== undefined && (typeof obj.envSentinel !== "string" || !ENV_SENTINEL_RE.test(obj.envSentinel)))
    err(`products/${dir}: envSentinel must be a simple anchored token (^?[A-Za-z0-9_=-]+$?), got ${JSON.stringify(obj.envSentinel)}`);

  // case-collide across this manifest's declared paths
  const declared = [...payload, ...docPaths];
  const lc = new Map();
  for (const p of declared) {
    const k = p.toLowerCase();
    if (lc.has(k) && lc.get(k) !== p) err(`products/${dir}: case-colliding paths "${lc.get(k)}" and "${p}"`);
    else lc.set(k, p);
  }
}

// ---------- cross-manifest: double-map ----------
for (const [p, owners] of mapped) {
  const uniq = [...new Set(owners)];
  if (uniq.length > 1) err(`file ${p} is mapped by multiple products: ${uniq.join(", ")}`);
}

// ---------- cross-manifest: coverage (every synced .claude file is mapped) ----------
const claudeDir = join(root, ".claude");
if (existsSync(claudeDir)) {
  const surface = [];
  const walk = (absDir, rel) => {
    for (const e of readdirSync(absDir, { withFileTypes: true })) {
      if (e.isDirectory()) {
        // Must mirror sync-to-project's EXCLUDES exactly (sh:92 / the ps1 twin). `worktrees`
        // holds transient git worktrees that are never synced, so every file under them was
        // reported as "unmapped" -- 535 phantom errors at repo root, which is precisely the
        // wall of known-bad output a real error would have hidden in.
        if (e.name === "state" || e.name === "attic" || e.name === "worktrees") continue;
        walk(join(absDir, e.name), rel ? `${rel}/${e.name}` : e.name);
      } else {
        if (e.name === "settings.local.json" || e.name === "scheduled_tasks.lock") continue;
        surface.push(`.claude/${rel ? rel + "/" : ""}${e.name}`);
      }
    }
  };
  walk(claudeDir, "");
  for (const f of surface)
    if (!mapped.has(f)) err(`unmapped file (synced but in no product): ${f}`);
}

report();

function report() {
  if (errors.length) {
    for (const e of errors) process.stderr.write(`product-lint: ${e}\n`);
    process.stderr.write(`product-lint: ${errors.length} error(s)\n`);
    process.exit(2);
  }
  process.stdout.write("product-lint: all manifests valid\n");
  process.exit(0);
}
