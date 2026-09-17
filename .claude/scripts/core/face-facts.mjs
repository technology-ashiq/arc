#!/usr/bin/env node
// face-facts -- no facts bundle under face/src (face v2 Phase 03, REQ-05, ADR-1324).
//
// v0.7 shipped src/data/arcFacts.js, a 137 KB generated snapshot of repo facts whose ancestor was
// already caught quoting counts the frozen contract disagrees with. In the product a module cites a
// door route or renders NOT SERVED; this lint refuses the other road -- a fact the BUNDLE carries
// instead of a fact the DOOR serves. The v0.7 reference folder is not product and is not scanned
// (ADR-1318).
//
// STRUCTURAL arms FAIL from birth:
//   data-file      a file under face/src that is not .mjs, .ts, .tsx or .css: JSON, YAML, Markdown, a
//                  .js file, a text file -- data the bundler would carry
//   link           a symlink anywhere under face/src: a link brings any file into the bundle
//   import-outside an import, export-from or import() whose specifier leaves face/src, is absolute, a
//                  URL, a drive path, a `#` subpath import, a `/@fs/` path, or spells a separator or a
//                  percent the bundler and this lint could read differently; a CSS @import or url()
//                  that leaves face/src; a dependency installed from a path (`file:`, `link:`)
//   asset-import   a specifier carrying a query (`?raw`, `?url`, `?inline`), a data extension, or a
//                  JSON import attribute: the bundler turns a file into a value in the bundle
//   glob           an import.meta.glob whose pattern is not a literal `./` path to .mjs/.ts/.tsx that
//                  stays below the file, or whose options ask for a query, raw text or a URL
//   asset-url      new URL(<literal>, import.meta.url): the bundler copies the file
//   env-fact       import.meta.env.NAME for any NAME but MODE, DEV, PROD, SSR, BASE_URL: a value the
//                  build inlines from outside face/src
//   fetch-static   a fetch() or EventSource whose literal target is not a door route under /api/
//   blob           a string, template text or JSX text of 2048 characters or more; JSON.parse or atob
//                  of a literal
//   data-mass      one object or array literal holding 200 or more literal leaves, or a file whose
//                  data literals hold 1000 or more (the tree this lint was born on: 60 and 271)
//   named-bundle   a file or an import named arcFacts or arcKnowledge, v0.7's own bundles
//   unscannable    a code file the lexer cannot read, or one carrying a NUL byte
// HEURISTIC arms WARN (exit 0), per the cycle's rule that a heuristic starts WARN-first:
//   data-literal   an object or array literal of 64 or more leaves
//   long-string    a string, template or JSX text of 512 characters or more
//   banner         a comment saying the file was GENERATED from something
//   fact-literal   text under face/src/modules shaped like a repo fact: a ULID, a commit SHA, a PR
//                  number, or a count of commands, agents, lanes, rooms, ADRs, tests or holes
//
// Declared limits: a bundle split across many small data-only files each under the structural
// thresholds reads only as WARN; a fact computed at runtime from code (not from a literal) is not a
// literal at all. Both are review's, and the NOT SERVED list is what makes a missing route visible.
//
// Usage: face-facts.mjs [--root PATH]   (default: face/src, which must exist)
// Exit:  0 scanned more than zero files and nothing FAILed (WARN lines may print)
//        1 a FAIL, or nothing scanned
//        2 could not run (a bad argument, an unreadable root)
import { readFileSync, readdirSync, lstatSync, realpathSync, existsSync } from "node:fs";
import { join, dirname, resolve, relative, sep, basename, extname, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import { lex, importStatements, oneLine } from "./face-pure.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..", "..");
export const DEFAULT_ROOT = "face/src";

export const CODE_EXT = Object.freeze([".mjs", ".ts", ".tsx"]);
export const STYLE_EXT = Object.freeze([".css"]);
export const LIMITS = Object.freeze({
  blob: 2048, longString: 512, literalFail: 200, literalWarn: 64, fileFail: 1000,
});
const ENV_OK = new Set(["MODE", "DEV", "PROD", "SSR", "BASE_URL"]);
const BUNDLE_NAMES = new Set(["arcfacts", "arcknowledge"]);
// A relative import of any of these is refused: none of them may live under face/src at all.
const DATA_EXT = /\.(json|jsonc|json5|jsonl|ya?ml|toml|md|mdx|txt|csv|tsv|xml|html?|js|jsx|cjs)$/i;
// Out of a package, .js is code (three's examples); these are data wherever they come from.
const PACKAGE_DATA_EXT = /\.(json|jsonc|json5|jsonl|ya?ml|toml|md|mdx|txt|csv|tsv|xml|html?)$/i;
// Text shaped like a JSON member -- `"key":` -- which a stylesheet has no use for.
const JSON_MEMBER = /"[^"\n]{1,80}"\s*:/;
const PACKAGE = /^(@[a-z0-9][a-z0-9._~-]*\/)?[a-z0-9][a-z0-9._~-]*(\/[a-zA-Z0-9._~@-]+)*$/;
const GLOB_PATTERN = /^\.\/([A-Za-z0-9_*.-]+\/)*[A-Za-z0-9_*.-]*\.(mjs|ts|tsx)$/;

const FACT_SHAPES = [
  ["a ULID", /(^|[^0-9A-Za-z])[0-9A-HJKMNP-TV-Z]{26}([^0-9A-Za-z]|$)/],
  ["a commit SHA", /(^|[^0-9A-Za-z])(?=[0-9a-f]*[a-f])(?=[0-9a-f]*[0-9])[0-9a-f]{7,40}([^0-9A-Za-z]|$)/],
  ["a PR number", /(^|[\s(])#\d{2,5}\b/],
  ["a count claim", /\b\d+\s+(commands|agents|lanes|rooms|ADRs|tests|holes|skills|kinds|routes|modules)\b/i],
];

/** @typedef {{ file: string, line: number, col: number, kind: string, detail: string, level: "FAIL"|"WARN" }} Finding */

const isP = (t, v) => !!t && t.k === "p" && t.v === v;
const isName = (t, v) => !!t && t.k === "name" && t.v === v;

/** Is the bracket at `idx` an object or array LITERAL (not a block, a call, an index or JSX)? */
function isDataBracket(tokens, idx) {
  const t = tokens[idx];
  if (!t || t.k !== "p") return false;
  if (t.v === "{") return t.kind === "object";
  if (t.v === "[") {
    const p = tokens[idx - 1];
    if (!p) return true;
    if (p.k === "name") return p.prop !== true && ["return", "typeof", "in", "of", "case", "yield", "await", "void", "delete", "throw", "new", "export", "default", "extends"].includes(p.v);
    if (p.k === "str" || p.k === "num" || p.k === "re") return false;
    return !(p.v === ")" || p.v === "]" || p.v === "}" || p.v === "`end");
  }
  return false;
}

/**
 * Where a relative specifier lands, and whether it stays inside the root. Separators, percents and
 * empty segments are refused before any resolution: the bundler, node and this lint must not be able
 * to read one spelling as three files.
 */
function relativeProblem(spec, fromDir, rootReal) {
  if (spec.includes("\\") || spec.includes("%") || spec.includes("//")) return `${JSON.stringify(spec)} spells a backslash, a percent or an empty segment`;
  const target = resolve(fromDir, spec);
  let real = target;
  try { real = realpathSync(target); } catch { /* a missing target is the bundler's error; containment is judged on the path */ }
  const rel = relative(rootReal, real);
  if (rel === "" || rel.startsWith("..") || isAbsolute(rel)) return `${JSON.stringify(spec)} leaves face/src`;
  return null;
}

/** Why a module specifier is refused, as [kind, detail], or null. */
export function specifierProblem(spec, fromDir, rootReal) {
  const s = String(spec);
  if (s.includes("?")) return ["asset-import", `${JSON.stringify(s)} carries a query -- the bundler turns the file into a value in the bundle`];
  const base = basename(s).replace(/\.[^.]*$/, "").toLowerCase();
  if (BUNDLE_NAMES.has(base)) return ["named-bundle", `${JSON.stringify(s)} is v0.7's facts bundle by name`];
  if (s.startsWith("./") || s.startsWith("../")) {
    if (DATA_EXT.test(s)) return ["asset-import", `${JSON.stringify(s)} imports a data file`];
    const why = relativeProblem(s, fromDir, rootReal);
    return why ? ["import-outside", why] : null;
  }
  if (s.startsWith("#")) return ["import-outside", `${JSON.stringify(s)} is a subpath import: package.json maps it to a file this lint cannot see`];
  if (s.startsWith("/") || s.includes(":") || s.startsWith(".")) return ["import-outside", `${JSON.stringify(s)} is an absolute path, a URL, a drive path or a scheme`];
  if (!PACKAGE.test(s)) return ["import-outside", `${JSON.stringify(s)} is not a package name`];
  if (PACKAGE_DATA_EXT.test(s)) return ["asset-import", `${JSON.stringify(s)} imports a data file out of a package`];
  return null;
}

/**
 * The literal tokens that are a STYLESHEET, not a blob: a top-level `const NAME = <string or template
 * with no ${}>` whose every other use in the file is the sole child of a <style> element. The Cycle 15
 * rooms carry their CSS this way. Such text is scanned as a stylesheet instead (its @import and url()
 * must stay inside face/src) and FAILs as a blob if it holds a JSON member. Declared residue: data
 * written as CSS custom properties and read back from the DOM at runtime.
 * @returns {number[][]} one list of token indices per stylesheet literal (a str token, or a template's text tokens)
 */
function styleLiterals(tokens) {
  /** @type {Map<string, number[]>} */
  const decl = new Map();
  /** @type {Set<number>} */
  const declName = new Set();
  for (let i = 0; i + 3 < tokens.length; i++) {
    const t = tokens[i];
    if (!isName(t, "const") || t.inside !== -1) continue;
    const nameTok = tokens[i + 1];
    const lit = tokens[i + 3];
    if (!nameTok || nameTok.k !== "name" || !isP(tokens[i + 2], "=") || !lit) continue;
    if (lit.k === "str") { decl.set(nameTok.v, [i + 3]); declName.add(i + 1); continue; }
    if (isP(lit, "`") && lit.pair > 0) {
      const inner = [];
      let computed = false;
      for (let j = i + 4; j < lit.pair; j++) {
        if (tokens[j].k === "text") inner.push(j);
        else computed = true;
      }
      if (!computed) { decl.set(nameTok.v, inner); declName.add(i + 1); }
    }
  }
  /** @type {Map<string, { good: number, bad: number }>} */
  const uses = new Map();
  for (let j = 0; j < tokens.length; j++) {
    const t = tokens[j];
    if (t.k !== "name" || !decl.has(t.v) || declName.has(j) || t.prop === true || isP(tokens[j - 1], ".") || isP(tokens[j - 1], "?.")) continue;
    const u = uses.get(t.v) ?? { good: 0, bad: 0 };
    const open = tokens[j - 1];
    const element = open && open.inside >= 0 ? tokens[open.inside] : null;
    const sole = isP(open, "{") && open.kind === "jsx" && isP(tokens[j + 1], "}") && isP(tokens[j - 2], "jsx>") && isP(tokens[j + 2], "jsx</>");
    if (sole && element && element.v === "jsx<" && element.tag === "style") u.good++;
    else u.bad++;
    uses.set(t.v, u);
  }
  /** @type {number[][]} */
  const out = [];
  for (const [name, idx] of decl) {
    const u = uses.get(name);
    if (u && u.good > 0 && u.bad === 0 && idx.length > 0) out.push(idx);
  }
  return out;
}

/**
 * Scan one code file's text.
 * @param {string} text  @param {string} file  shown path  @param {{ fromDir: string, rootReal: string, inModules: boolean, jsx: boolean }} ctx
 * @returns {{ findings: Finding[], leaves: number }}
 */
export function scanCode(text, file, { fromDir, rootReal, inModules, jsx }) {
  /** @type {Finding[]} */
  const findings = [];
  const add = (t, level, kind, detail) => findings.push({ file, line: t ? t.line : 1, col: t ? t.col : 1, kind, detail, level });
  const { tokens, error } = lex(text, { jsx, text: true });
  if (error) { add(error, "FAIL", "unscannable", `the lexer could not read this file past here: ${error.message}`); return { findings, leaves: 0 }; }

  if (/\bGENERATED\b\s+(from|by)\b/.test(text)) {
    const at = text.slice(0, text.search(/\bGENERATED\b\s+(from|by)\b/)).split("\n").length;
    add({ line: at, col: 1 }, "WARN", "banner", "a comment says this file was GENERATED -- a generated snapshot in the bundle is a facts bundle");
  }

  for (const st of importStatements(tokens)) {
    const why = specifierProblem(st.spec, fromDir, rootReal);
    if (why) add(st.specAt, "FAIL", why[0], why[1]);
    const w = tokens[st.end - (isP(tokens[st.end], ";") ? 1 : 0)];
    if (w && isP(w, "}")) {
      for (let j = st.start; j <= st.end; j++) {
        if ((isName(tokens[j], "with") || isName(tokens[j], "assert")) && isP(tokens[j + 1], "{")) {
          add(tokens[j], "FAIL", "asset-import", "an import attribute turns a file into a value in the bundle");
          break;
        }
      }
    }
  }

  // Leaves inside data literals: counted once, against the outermost data literal that holds them.
  const mass = new Map();
  let leaves = 0;
  /** @type {Set<number>} */
  const styles = new Set();
  for (const group of styleLiterals(tokens)) {
    for (const k of group) styles.add(k);
    const at = tokens[group[0]];
    const css = group.map((k) => tokens[k].v).join("");
    if (JSON_MEMBER.test(css)) add(at, "FAIL", "blob", "a stylesheet literal carrying a JSON member -- data wearing a stylesheet's clothes");
    for (const f of scanStyle(css, file, { fromDir, rootReal })) findings.push({ ...f, line: at.line + f.line - 1, col: f.line === 1 ? at.col : 1 });
  }

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    const p = tokens[i - 1];
    const n = tokens[i + 1];
    const afterDot = isP(p, ".") || isP(p, "?.");

    if (t.k === "str" || t.k === "num" || t.k === "text") {
      const v = t.v;
      if (t.k !== "num" && !styles.has(i)) {
        if (v.length >= LIMITS.blob) add(t, "FAIL", "blob", `${v.length} characters of literal text -- a bundle packed into a string is still a bundle`);
        else if (v.length >= LIMITS.longString) add(t, "WARN", "long-string", `${v.length} characters of literal text`);
        if (inModules) for (const [what, re] of FACT_SHAPES) if (re.test(v)) { add(t, "WARN", "fact-literal", `text shaped like ${what}: ${JSON.stringify(v.length > 80 ? `${v.slice(0, 77)}...` : v)} -- a repo fact comes from a door route`); break; }
      }
      if (t.k !== "text") {
        let j = t.inside, top = -1;
        while (j >= 0 && isDataBracket(tokens, j)) { top = j; j = tokens[j].inside; }
        if (top >= 0) { mass.set(top, (mass.get(top) ?? 0) + 1); leaves++; }
      }
      continue;
    }

    if (t.k !== "name" || afterDot) continue;

    // import.meta.glob / import.meta.env / new URL(..., import.meta.url)
    if (t.v === "import" && isP(n, ".") && isName(tokens[i + 2], "meta")) {
      const member = tokens[i + 4];
      if (!isP(tokens[i + 3], ".") || !member || member.k !== "name") continue;
      if (member.v === "glob" || member.v === "globEager") {
        const open = tokens[i + 5];
        if (!isP(open, "(")) { add(t, "FAIL", "glob", "import.meta.glob not called with a literal pattern"); continue; }
        const first = tokens[i + 6];
        const patterns = [];
        let after = i + 7;
        if (first && first.k === "str") patterns.push(first);
        else if (isP(first, "[") && first.pair > 0) {
          for (let j = i + 7; j < first.pair; j++) {
            const u = tokens[j];
            if (u.k === "str") patterns.push(u);
            else if (!isP(u, ",")) { patterns.length = 0; break; }
          }
          after = first.pair + 1;
        }
        if (patterns.length === 0) { add(t, "FAIL", "glob", "import.meta.glob with a pattern that is not a literal string or a list of them"); continue; }
        for (const pt of patterns) {
          if (!GLOB_PATTERN.test(pt.v) || pt.v.includes("..") || pt.v.includes("**")) add(pt, "FAIL", "glob", `${JSON.stringify(pt.v)} is not a ./ pattern below this file matching .mjs, .ts or .tsx`);
        }
        const opts = tokens[after + 1];
        if (isP(tokens[after], ",") && isP(opts, "{") && opts.pair > 0) {
          for (let j = after + 2; j < opts.pair; j++) {
            const u = tokens[j];
            if ((u.k === "name" || u.k === "str") && isP(tokens[j + 1], ":") && tokens[j].inside === after + 1 && u.v !== "eager")
              add(u, "FAIL", "glob", `the glob option ${JSON.stringify(u.v)} -- only { eager } is read; a query, raw text or a URL is a file turned into a value`);
            else if (isP(u, "...") || isP(u, "[")) add(u, "FAIL", "glob", "glob options that are computed cannot be checked");
          }
        } else if (!isP(tokens[after], ")")) add(t, "FAIL", "glob", "glob options that are not an object literal cannot be checked");
        continue;
      }
      if (member.v === "env") {
        const name = tokens[i + 6];
        if (isP(tokens[i + 5], ".") && name && name.k === "name" && ENV_OK.has(name.v)) continue;
        add(t, "FAIL", "env-fact", "import.meta.env beyond MODE, DEV, PROD, SSR and BASE_URL is a value the build inlines from outside face/src");
      }
      continue;
    }

    if (t.v === "URL" && isName(p, "new") && isP(n, "(")) {
      const a = tokens[i + 2];
      if (a && (a.k === "str" || isP(a, "`")) && isP(tokens[(a.k === "str" ? i + 3 : a.pair + 1)], ",") && isName(tokens[(a.k === "str" ? i + 4 : a.pair + 2)], "import"))
        add(t, "FAIL", "asset-url", "new URL(literal, import.meta.url) makes the bundler copy the file into the app");
      continue;
    }

    if ((t.v === "fetch" || (t.v === "EventSource" && isName(p, "new"))) && isP(n, "(")) {
      const a = tokens[i + 2];
      if (a && a.k === "str" && !a.v.startsWith("/api/")) add(a, "FAIL", "fetch-static", `${t.v} of ${JSON.stringify(a.v)} -- the face reads the door's /api/ routes, not a file`);
      if (isP(a, "`")) {
        const head = tokens[i + 3];
        const lead = head && head.k === "text" ? head.v : "";
        const dynamicHead = isP(head, "${") && head.inside === i + 2;
        if (!dynamicHead && !lead.startsWith("/api/")) add(a, "FAIL", "fetch-static", `${t.v} of a template that does not start with /api/ or a computed origin`);
      }
      continue;
    }

    if ((t.v === "JSON" && isP(n, ".") && isName(tokens[i + 2], "parse") && isP(tokens[i + 3], "(")) || (t.v === "atob" && isP(n, "("))) {
      const a = tokens[t.v === "atob" ? i + 2 : i + 4];
      if (a && (a.k === "str" || (isP(a, "`") && !tokens.slice(i, a.pair).some((u) => isP(u, "${")))))
        add(t, "FAIL", "blob", `${t.v === "atob" ? "atob" : "JSON.parse"} of a literal is a bundle unpacked at runtime`);
    }
  }

  for (const [idx, count] of mass) {
    const at = tokens[idx];
    if (count >= LIMITS.literalFail) add(at, "FAIL", "data-mass", `one literal holds ${count} literal leaves (FAIL at ${LIMITS.literalFail}) -- facts in the bundle`);
    else if (count >= LIMITS.literalWarn) add(at, "WARN", "data-literal", `one literal holds ${count} literal leaves (WARN at ${LIMITS.literalWarn})`);
  }
  if (leaves >= LIMITS.fileFail) add({ line: 1, col: 1 }, "FAIL", "data-mass", `the file's data literals hold ${leaves} leaves (FAIL at ${LIMITS.fileFail}) -- facts in the bundle`);
  return { findings, leaves };
}

/** A CSS file: an @import or url() that leaves face/src, or a data: URL long enough to be a blob. */
export function scanStyle(text, file, { fromDir, rootReal }) {
  /** @type {Finding[]} */
  const findings = [];
  const lineOf = (index) => text.slice(0, index).split("\n").length;
  const refs = [];
  for (const m of text.matchAll(/@import\s+(?:url\(\s*)?(["']?)([^"')\s;]+)\1/g)) refs.push([m[2], m.index]);
  for (const m of text.matchAll(/url\(\s*(["']?)([^"')]*)\1\s*\)/g)) refs.push([m[2], m.index]);
  for (const [ref, index] of refs) {
    const at = { line: lineOf(index), col: 1 };
    if (ref.startsWith("data:")) {
      if (ref.length >= LIMITS.blob) findings.push({ file, ...at, level: "FAIL", kind: "blob", detail: `a ${ref.length}-character data: URL` });
      continue;
    }
    if (ref.startsWith("#")) continue; // an SVG fragment reference
    if (ref.startsWith("./") || ref.startsWith("../")) {
      if (DATA_EXT.test(ref)) { findings.push({ file, ...at, level: "FAIL", kind: "asset-import", detail: `${JSON.stringify(ref)} pulls a data file into the stylesheet` }); continue; }
      const why = relativeProblem(ref, fromDir, rootReal);
      if (why) findings.push({ file, ...at, level: "FAIL", kind: "import-outside", detail: why });
      continue;
    }
    if (PACKAGE.test(ref)) continue; // `@import "tailwindcss"`
    findings.push({ file, ...at, level: "FAIL", kind: "import-outside", detail: `${JSON.stringify(ref)} is an absolute path, a URL or a scheme in a stylesheet` });
  }
  return findings;
}

/**
 * Walk a root and scan every file under it.
 * @param {string} root  face/src
 * @param {{ base?: string, packageJson?: string | null }} [opts]
 */
export function lintFacts(root, { base = process.cwd(), packageJson = join(dirname(root), "package.json") } = {}) {
  const report = { files: 0, code: 0, styles: 0, leaves: 0, findings: /** @type {Finding[]} */ ([]) };
  const show = (p) => relative(base, p).split(sep).join("/") || ".";
  const fail = (p, kind, detail) => report.findings.push({ file: show(p), line: 0, col: 0, kind, detail, level: "FAIL" });

  let st;
  try { st = lstatSync(root); } catch (e) {
    if (e && e.code === "ENOENT") { fail(root, "absent-root", "the root is absent -- renamed, moved or re-cased?"); return report; }
    throw new Error(`cannot read root ${root}: ${e.message}`);
  }
  if (st.isSymbolicLink()) { fail(root, "link", "a root that is a symlink is not followed"); return report; }
  if (!st.isDirectory()) { fail(root, "not-a-folder", "the root is not a directory"); return report; }
  try {
    if (!readdirSync(dirname(root)).includes(basename(root))) { fail(root, "root-case", "the root's spelling does not match the folder on disk"); return report; }
  } catch { /* the parent is unreadable; the walk reports what it can */ }
  const rootReal = realpathSync(root);
  const modulesDir = join(rootReal, "modules");

  if (packageJson && existsSync(packageJson)) {
    try {
      const pkg = JSON.parse(readFileSync(packageJson, "utf8"));
      for (const field of ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"]) {
        for (const [name, range] of Object.entries(pkg[field] ?? {})) {
          if (typeof range === "string" && /^(file|link|portal|git\+file):|^\.{0,2}\//.test(range))
            fail(packageJson, "import-outside", `${field}.${name} is installed from a path (${JSON.stringify(range)}) -- a package the lint cannot see into`);
        }
      }
      if (pkg.imports && typeof pkg.imports === "object") fail(packageJson, "import-outside", "package.json declares subpath imports -- a # specifier maps to a file this lint cannot see");
    } catch (e) { fail(packageJson, "unscannable", `package.json could not be read: ${e.message}`); }
  }

  const walk = (dir) => {
    let names;
    try { names = readdirSync(dir).sort(); } catch (e) { fail(dir, "unscannable", `could not list: ${e.code ?? e.message}`); return; }
    for (const name of names) {
      const abs = join(dir, name);
      let s;
      try { s = lstatSync(abs); } catch (e) { fail(abs, "unscannable", `could not stat: ${e.code ?? e.message}`); continue; }
      if (s.isSymbolicLink()) { fail(abs, "link", "a symlink under face/src can bring any file into the bundle"); continue; }
      if (s.isDirectory()) { walk(abs); continue; }
      if (!s.isFile()) { fail(abs, "data-file", "not a regular file"); continue; }
      report.files++;
      const stem = name.replace(/\..*$/, "").toLowerCase();
      if (BUNDLE_NAMES.has(stem)) fail(abs, "named-bundle", `${name} is v0.7's facts bundle by name`);
      const ext = extname(name);
      const isCode = CODE_EXT.includes(ext);
      const isStyle = STYLE_EXT.includes(ext);
      if (!isCode && !isStyle) { fail(abs, "data-file", `a ${ext || "extensionless"} file under face/src is data the bundler would carry -- a fact comes from a door route`); continue; }
      let buf;
      try { buf = readFileSync(abs); } catch (e) { fail(abs, "unscannable", `could not read: ${e.code ?? e.message}`); continue; }
      if (buf.includes(0)) { fail(abs, "unscannable", "the file carries a NUL byte and cannot be scanned"); continue; }
      const text = buf.toString("utf8");
      const ctx = { fromDir: dirname(abs), rootReal };
      if (isStyle) { report.styles++; report.findings.push(...scanStyle(text, show(abs), ctx)); continue; }
      report.code++;
      const inModules = abs === modulesDir || abs.startsWith(modulesDir + sep) || realOf(abs).startsWith(modulesDir + sep);
      const { findings, leaves } = scanCode(text, show(abs), { ...ctx, inModules, jsx: ext === ".tsx" });
      report.leaves += leaves;
      report.findings.push(...findings);
    }
  };
  walk(root);
  return report;
}

function realOf(p) { try { return realpathSync(p); } catch { return p; } }

export function parseArgs(argv) {
  let root = null;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a !== "--root") throw new Error(`unknown argument ${JSON.stringify(a)} (the only flag is --root PATH)`);
    if (root !== null) throw new Error("--root given twice -- which one is meant is not a guess");
    const v = argv[i + 1];
    if (v === undefined || v.startsWith("--") || v.trim() === "") throw new Error("--root needs a path");
    root = v;
    i++;
  }
  return { root };
}

function main(argv) {
  let opts;
  try { opts = parseArgs(argv); } catch (e) { console.error(oneLine(`face-facts: ${e.message}`)); return 2; }
  const root = opts.root === null ? join(REPO, DEFAULT_ROOT) : resolve(process.cwd(), opts.root);
  const base = opts.root === null ? REPO : process.cwd();
  let report;
  try { report = lintFacts(root, { base }); }
  catch (e) { console.error(oneLine(`face-facts: ${e.message}`)); return 2; }
  const fails = report.findings.filter((f) => f.level === "FAIL");
  const warns = report.findings.filter((f) => f.level === "WARN");
  for (const f of [...fails, ...warns]) console.log(oneLine(`${f.level} ${f.file}:${f.line}:${f.col} ${f.kind} ${f.detail}`));
  if (report.code === 0) console.log("FAIL nothing was scanned -- zero code files is not a clean tree");
  console.log(`face-facts: files=${report.files} code=${report.code} styles=${report.styles} leaves=${report.leaves} fail=${fails.length} warn=${warns.length}`);
  return report.code > 0 && fails.length === 0 ? 0 : 1;
}

/** "Was this file RUN, or imported?" -- realpath BOTH sides; the endsWith form no-ops behind a link. */
function isMain() {
  try {
    const invoked = process.argv[1];
    return !!invoked && realpathSync(invoked) === realpathSync(fileURLToPath(import.meta.url));
  } catch { return false; }
}

if (isMain()) process.exitCode = main(process.argv.slice(2));
