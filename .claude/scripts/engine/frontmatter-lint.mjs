#!/usr/bin/env node
/**
 * frontmatter-lint.mjs -- every Claude frontmatter key has a declared per-target fate (distribute P02, ADR-2017).
 *
 *   node .claude/scripts/engine/frontmatter-lint.mjs [--root DIR] [--mutant-selftest]
 *
 * The Claude dialect is the source (ADR-2001) and the other targets are rendered from it, so a key the
 * compiler has never heard of would be dropped by ignorance -- the quiet flattening the design source's
 * pre-mortem #5 names. Two checks, in order:
 *   1. the TABLE (engine/frontmatter-keys.yaml) against the MATRIX (engine/harnesses.yaml): one legal fate
 *      per key per verified row, claude-code is the identity, and a `drop:CELL` stands only on a cell that
 *      is "false" or "partial:...";
 *   2. the TREE (.claude/commands/, .claude/agents/) against the table: every frontmatter line is
 *      `key: value`, every key is declared for its kind, no key repeats, and `targets:` names verified rows.
 *
 * This module is also the ONE parser and the ONE walker arc-compile uses for command and agent input
 * (ADR-2012): `sourceFiles` and `parseFrontmatter` are imported there, never re-implemented.
 *
 * FAIL-FROM-BIRTH: `--mutant-selftest` copies the tree, plants a pid-suffixed unknown key and passes only
 * if that key is named.
 *
 * Exit: 0 clean · 1 failures (each `FAIL <where> [<class>] <what>`) · 2 COULD NOT SCAN / usage.
 * Last line of a completed run: `RAN frontmatter-lint`.
 */
import { cpSync, existsSync, lstatSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { parseYamlSubset } from "./yaml-subset.mjs";

export const KINDS = Object.freeze(["commands", "agents"]);
export const KEYS_FILE = "engine/frontmatter-keys.yaml";
export const MATRIX_FILE = "engine/harnesses.yaml";

const KEY_LINE = /^([a-z][a-z0-9-]*): (.*)$/;
const ROW_ID = /^[a-z][a-z0-9-]*$/;
const FATE = /^(render:[a-z][a-z0-9._-]*|drop:[a-z][a-z0-9_]*|consume|unsupported)$/;

export class CouldNotScan extends Error {}

/**
 * The frontmatter of one source file. CR bytes are removed first, the same transform the sync golden
 * hashes through (`tr -d '\r'` in _arc_tree_manifest), so an autocrlf checkout parses alike.
 * Returns { ok: true, lines: [{ key, raw, line }], rest } or { ok: false, line, what }.
 * `rest` is everything after the closing `---`, so the claude-code adapter's renderSource can rebuild the file.
 */
export function parseFrontmatter(text) {
  const t = String(text).replace(/\r/g, "");
  if (!t.startsWith("---\n")) return { ok: false, line: 1, what: "the file does not open with a `---` line" };
  const all = t.split("\n");
  const lines = [];
  for (let i = 1; i < all.length; i++) {
    const l = all[i];
    if (l === "---") {
      // Offset of the closing delimiter: the opening line plus every key line before it.
      const off = all.slice(0, i).reduce((n, s) => n + s.length + 1, 0) + 3;
      return { ok: true, lines, rest: t.slice(off) };
    }
    const m = KEY_LINE.exec(l);
    if (!m) return { ok: false, line: i + 1, what: `not a \`key: value\` line: ${JSON.stringify(l.slice(0, 60))}` };
    lines.push({ key: m[1], raw: m[2], line: i + 1 });
  }
  return { ok: false, line: all.length, what: "no closing `---` line" };
}

/**
 * A repo-relative path read from a data file, confined (class d): forward slashes, no `..` segment, no
 * leading slash, no drive letter or colon, no backslash. Returns the path or null.
 */
export function confineRel(p) {
  if (typeof p !== "string" || p === "" || /[\\:]/.test(p) || p.startsWith("/")) return null;
  // An empty segment (`a//b/`) is refused too: the scan would match it to nothing and call it clean
  // (attack 85d2416 B2). A trailing slash is the one allowed empty tail.
  const segs = p.endsWith("/") ? p.slice(0, -1).split("/") : p.split("/");
  if (segs.some((s) => s === "" || s === ".." || s === ".")) return null;
  return p;
}

/**
 * Every file under .claude/<kind>/, recursively, as sorted repo-relative paths with forward slashes.
 * A symlink is returned flagged rather than followed, so the bytes validated are the bytes used; so is
 * anything that is not a regular file (a FIFO named x.md would block the read). `.claude` and the kind
 * directory are themselves refused when linked, or the whole walk would read outside the checkout
 * (attack 85d2416 B4). An fs error is COULD NOT SCAN, never a stack trace (B7).
 */
export function sourceFiles(root, kind) {
  const base = join(root, ".claude", kind);
  if (!existsSync(base)) throw new CouldNotScan(`.claude/${kind}/ does not exist under ${root}`);
  const stat = (abs) => { try { return lstatSync(abs); } catch (e) { throw new CouldNotScan(`cannot stat ${abs}: ${e.code || e.message}`); } };
  for (const [abs, name] of [[join(root, ".claude"), ".claude"], [base, `.claude/${kind}`]]) {
    const st = stat(abs);
    if (st.isSymbolicLink() || !st.isDirectory()) throw new CouldNotScan(`${name} is a link or not a directory; it is read, not followed`);
  }
  const out = [];
  const walk = (dir, rel) => {
    let names;
    try { names = readdirSync(dir).sort(); } catch (e) { throw new CouldNotScan(`cannot list ${dir}: ${e.code || e.message}`); }
    for (const name of names) {
      const abs = join(dir, name);
      const r = `${rel}/${name}`;
      const st = stat(abs);
      if (st.isSymbolicLink()) out.push({ rel: r, symlink: true });
      else if (st.isDirectory()) walk(abs, r);
      else out.push({ rel: r, symlink: false, special: !st.isFile() });
    }
  };
  walk(base, `.claude/${kind}`);
  if (!out.length) throw new CouldNotScan(`.claude/${kind}/ holds no files`);
  return out;
}

function readYaml(root, rel) {
  let text;
  try { text = readFileSync(join(root, rel), "utf8"); } catch { throw new CouldNotScan(`${rel} unreadable under ${root}`); }
  if (text.trim() === "") throw new CouldNotScan(`${rel} is empty`);
  const parsed = parseYamlSubset(text);
  if (!parsed.ok) throw new CouldNotScan(`${rel}:${parsed.error.line} does not parse: ${parsed.error.what}`);
  return parsed.value;
}

const own = (o, k) => o !== null && typeof o === "object" && !Array.isArray(o) && Object.hasOwn(o, k);

/** The verified rows of the matrix, each { id, cells, rendered, foreign }. */
export function verifiedRows(root) {
  const m = readYaml(root, MATRIX_FILE);
  if (!own(m, "harnesses") || !Array.isArray(m.harnesses)) throw new CouldNotScan(`${MATRIX_FILE} has no harnesses list`);
  const rows = m.harnesses.filter((r) => own(r, "status") && r.status === "verified");
  if (!rows.length) throw new CouldNotScan(`${MATRIX_FILE} has no verified row`);
  return rows.map((r) => ({
    id: r.id,
    cells: own(r, "cells") ? r.cells : {},
    rendered: own(r, "rendered") ? r.rendered : [],
    foreign: own(r, "rendered_foreign") ? r.rendered_foreign : [],
  }));
}

/** Check 1: the table against the matrix. Returns { table, rows, fails }. */
export function checkTable(root) {
  const rows = verifiedRows(root);
  const doc = readYaml(root, KEYS_FILE);
  const fails = [];
  const fail = (cls, what) => fails.push(`FAIL ${KEYS_FILE} [${cls}] ${what}`);
  const failMatrix = (cls, what) => fails.push(`FAIL ${MATRIX_FILE} [${cls}] ${what}`);
  const ids = rows.map((r) => r.id);
  for (const r of rows) {
    if (typeof r.id !== "string" || !ROW_ID.test(r.id)) failMatrix("bad-row", `a verified row has the id ${JSON.stringify(r.id)}`);
    for (const field of ["rendered", "foreign"]) {
      const v = r[field];
      if (!Array.isArray(v)) { failMatrix("bad-rendered", `${r.id}.${field} is not a list`); continue; }
      for (const p of v) {
        if (confineRel(p) === null) failMatrix("bad-rendered", `${r.id}.${field} entry ${JSON.stringify(p)} escapes the repository`);
        else if (field === "rendered" && !p.endsWith("/")) failMatrix("bad-rendered", `${r.id}.rendered entry \`${p}\` is not a directory (no trailing /)`);
      }
    }
  }
  if (!own(doc, "version") || doc.version !== 1) fail("bad-table", "version is not 1");
  const table = { commands: new Map(), agents: new Map() };
  for (const kind of KINDS) {
    if (!own(doc, kind) || typeof doc[kind] !== "object" || Array.isArray(doc[kind])) { fail("bad-table", `no \`${kind}\` mapping`); continue; }
    for (const key of Object.keys(doc[kind])) {
      const fates = doc[kind][key];
      if (!KEY_LINE.test(`${key}: x`)) { fail("bad-table", `${kind} key ${JSON.stringify(key)} is not a frontmatter key name`); continue; }
      if (fates === null || typeof fates !== "object" || Array.isArray(fates)) { fail("bad-table", `${kind}.${key} is not a target mapping`); continue; }
      for (const t of Object.keys(fates)) if (!ids.includes(t)) fail("unknown-target", `${kind}.${key} names \`${t}\`, which is not a verified row`);
      for (const r of rows) {
        if (!Object.hasOwn(fates, r.id)) { fail("missing-fate", `${kind}.${key} has no fate for \`${r.id}\``); continue; }
        const f = fates[r.id];
        if (typeof f !== "string" || !FATE.test(f)) { fail("bad-fate", `${kind}.${key} on \`${r.id}\` is ${JSON.stringify(f)}`); continue; }
        if (r.id === "claude-code" && f !== `render:${key}`) fail("not-identity", `${kind}.${key} on \`claude-code\` is \`${f}\`; the source target renders a key to itself`);
        if (f.startsWith("drop:")) {
          const cell = f.slice(5);
          if (!own(r.cells, cell)) fail("drop-unknown-cell", `${kind}.${key} drops on \`${r.id}\` under \`${cell}\`, which is not a cell of that row`);
          else {
            const v = r.cells[cell];
            if (!(v === "false" || (typeof v === "string" && v.startsWith("partial:"))))
              fail("drop-on-true", `${kind}.${key} drops on \`${r.id}\` under \`${cell}\`, which is ${JSON.stringify(v)}; a drop needs a false or partial cell`);
          }
        }
      }
      table[kind].set(key, fates);
    }
    if (!table[kind].size) fail("bad-table", `\`${kind}\` declares no key`);
  }
  return { table, rows, fails };
}

/** Check 2: one source file against the table. Returns the FAIL lines. */
export function checkFile(text, rel, kind, table, ids) {
  const fails = [];
  const fail = (line, cls, what) => fails.push(`FAIL ${rel}${line ? `:${line}` : ""} [${cls}] ${what}`);
  const p = parseFrontmatter(text);
  if (!p.ok) { fail(p.line, "malformed", p.what); return fails; }
  const seen = new Set();
  for (const { key, raw, line } of p.lines) {
    if (seen.has(key)) fail(line, "duplicate-key", `\`${key}\` appears twice; a second line would forge the first`);
    seen.add(key);
    if (!table[kind].has(key)) { fail(line, "unknown-key", `\`${key}\` is not a declared ${kind} key (${KEYS_FILE})`); continue; }
    if (raw.trim() === "") { fail(line, "empty-value", `\`${key}\` is present with an empty value`); continue; }
    if (key === "targets") {
      const list = raw.split(",").map((s) => s.trim());
      const dup = new Set();
      for (const id of list) {
        if (!ROW_ID.test(id)) fail(line, "bad-targets", `${JSON.stringify(id)} is not a row id`);
        else if (!ids.includes(id)) fail(line, "bad-targets", `\`${id}\` is not a verified row of ${MATRIX_FILE}`);
        if (dup.has(id)) fail(line, "bad-targets", `\`${id}\` is named twice`);
        dup.add(id);
      }
      if (!list.includes("claude-code")) fail(line, "bad-targets", "`claude-code` is missing; the source target always renders");
    }
  }
  return fails;
}

/** The whole lint. Throws CouldNotScan when an input cannot be read. */
export function lint(root) {
  const { table, rows, fails } = checkTable(root);
  const ids = rows.map((r) => r.id);
  const counts = {};
  for (const kind of KINDS) {
    const files = sourceFiles(root, kind);
    counts[kind] = 0;
    for (const f of files) {
      if (f.symlink) { fails.push(`FAIL ${f.rel} [symlink] a source file is a symlink; it is read, not followed`); continue; }
      if (f.special) { fails.push(`FAIL ${f.rel} [not-a-file] a source entry is not a regular file`); continue; }
      if (!f.rel.endsWith(".md")) { fails.push(`FAIL ${f.rel} [not-markdown] only lowercase .md files are ${kind}`); continue; }
      counts[kind]++;
      let text;
      try { text = readFileSync(join(root, f.rel), "utf8"); } catch { throw new CouldNotScan(`${f.rel} unreadable`); }
      fails.push(...checkFile(text, f.rel, kind, table, ids));
    }
    if (!counts[kind]) throw new CouldNotScan(`.claude/${kind}/ holds no .md file`);
  }
  const keys = KINDS.reduce((n, k) => n + table[k].size, 0);
  return { fails, counts, keys };
}

function mutantSelftest(root) {
  const tmp = mkdtempSync(join(tmpdir(), "fm-mutant-"));
  try {
    for (const p of [".claude/commands", ".claude/agents", KEYS_FILE, MATRIX_FILE]) {
      if (!existsSync(join(root, p))) throw new CouldNotScan(`mutant-selftest: ${p} missing in ${root}`);
      cpSync(join(root, p), join(tmp, p), { recursive: true });
    }
    const target = sourceFiles(tmp, "commands").find((f) => !f.symlink && !f.special && f.rel.endsWith(".md"));
    if (!target) throw new CouldNotScan("mutant-selftest: no command to plant into");
    const key = `x-mutant-${process.pid}`;
    const abs = join(tmp, target.rel);
    const before = readFileSync(abs, "utf8");
    if (before.includes(`${key}:`)) return { ok: false, why: `the planted key ${key} was already present` };
    const after = before.replace(/^---\r?\n/, `---\n${key}: planted\n`);
    if (after === before) return { ok: false, why: "the mutant changed nothing" };
    writeFileSync(abs, after);
    const { fails } = lint(tmp);
    const named = fails.some((l) => l.startsWith(`FAIL ${target.rel}:2 [unknown-key]`) && l.includes(`\`${key}\``));
    return named ? { ok: true, why: `caught ${key} (${target.rel})` } : { ok: false, why: `the planted key was NOT named: ${fails.join(" | ") || "no failures"}` };
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

function main(argv) {
  let root = null, selftest = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--root") {
      const v = argv[i + 1];
      if (v === undefined || v === "" || v.startsWith("--")) { console.error("frontmatter-lint: --root needs a directory"); return 2; }
      if (root !== null && root !== v) { console.error("frontmatter-lint: --root given twice with different values"); return 2; }
      root = v; i++;
    } else if (a === "--mutant-selftest") selftest = true;
    else { console.error(`frontmatter-lint: unknown argument ${a}`); return 2; }
  }
  const dir = resolve(root ?? join(fileURLToPath(new URL(".", import.meta.url)), "../../.."));
  try {
    if (selftest) {
      const r = mutantSelftest(dir);
      console.log(`mutant-selftest: ${r.why}`);
      if (r.ok) console.log("RAN frontmatter-lint");
      return r.ok ? 0 : 1;
    }
    const { fails, counts, keys } = lint(dir);
    for (const l of fails) console.log(l);
    console.log(`frontmatter-lint: ${counts.commands} commands, ${counts.agents} agents, ${keys} keys, ${fails.length} failures`);
    console.log("RAN frontmatter-lint");
    return fails.length ? 1 : 0;
  } catch (e) {
    if (e instanceof CouldNotScan) { console.log(`frontmatter-lint: COULD NOT SCAN — ${e.message}`); return 2; }
    throw e;
  }
}

const self = (() => { try { return realpathSync(fileURLToPath(import.meta.url)); } catch { return ""; } })();
const invoked = (() => { try { return process.argv[1] ? realpathSync(process.argv[1]) : ""; } catch { return ""; } })();
if (self && self === invoked) process.exitCode = main(process.argv.slice(2));
