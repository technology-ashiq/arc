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
//   link           a symlink or junction anywhere under face/src
//   import-outside an import, export-from, import() or require() whose specifier leaves face/src, is
//                  absolute, a URL, a drive path, a `#` subpath, a package name with a `.` or `..` segment,
//                  spells a separator, a percent or a colon the bundler and this lint could read
//                  differently, or matches a folder only case-insensitively; a computed import(); any
//                  require(); a stylesheet @import, url(), @plugin, @config, @source or @reference that
//                  leaves face/src
//   asset-import   a specifier carrying a query (`?raw`, `?url`, `?inline`; `?worker` on code excepted), a
//                  data extension, or an import attribute: the bundler turns a file into a value
//   package        face/package.json installing from a path (`file:`, `link:`, a folder, a tarball, a
//                  drive), declaring `workspaces`, `imports`, `exports` or `browser`, or an `overrides` or
//                  `resolutions` value that is a path -- each maps a name to a file this lint never walks
//   build-config   face/vite.config.* declaring `define`, `alias`, `resolve`, `publicDir`, `envDir`,
//                  `envPrefix`, `assetsInclude` or `json`: a value or a path the build injects from outside
//   glob           an import.meta.glob whose pattern is not a literal `./` path to .mjs/.ts/.tsx below the
//                  file, or whose options ask for anything but `eager` and `import`
//   asset-url      new URL(<literal>, import.meta.url) for anything but code inside face/src
//   env-fact       import.meta.env.NAME for any NAME but MODE, DEV, PROD, SSR, BASE_URL
//   fetch-static   a fetch(), new Request() or EventSource whose literal target is not a plain door route
//                  under /api/ (no `..`, percent, backslash or empty segment); a fetch reached by a computed
//                  key; XMLHttpRequest, WebSocket or sendBeacon at all -- the face reads the door by fetch
//   blob           2048 characters or more of one literal text: a string, a template (all its literal
//                  parts), a `+` chain of strings, JSX text, a regex source, a quoted CSS string; any
//                  literal text inside JSON.parse() or atob(), however reached; a stylesheet literal or
//                  file carrying a JSON member
//   data-mass      one object or array literal of 200 or more literal leaves; a file whose literals hold
//                  2000 or more leaves or 48000 or more characters (the tree this lint was born on: 60 in
//                  one literal, 672 leaves and 16651 characters in one file)
//   named-bundle   a file or an import named arcFacts or arcKnowledge, v0.7's own bundles
//   unscannable    a code file, stylesheet, package.json or vite config the lint cannot read
// HEURISTIC arms WARN (exit 0), per the cycle's rule that a heuristic starts WARN-first:
//   data-literal   an object or array literal of 64 or more leaves; a file of 1000+ leaves or 24000+ chars
//   long-string    512 characters or more of one literal text
//   banner         a comment saying the file was GENERATED from something
//   fact-literal   text under face/src/modules shaped like a repo fact: a ULID, a commit SHA, a PR
//                  number, or a count of commands, agents, lanes, rooms, ADRs, tests or holes
//
// Declared limits (review's, and the NOT SERVED list's): a bundle split across files each under the file
// thresholds; a fact built at runtime by code rather than written as a literal; data written as CSS
// custom properties read back from the DOM; files under face/public fetched by a computed path; an
// NTFS alternate data stream behind a specifier is refused by its colon, but a stream is never walked.
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
  blob: 2048, longString: 512, literalFail: 200, literalWarn: 64,
  fileLeaves: 2000, fileLeavesWarn: 1000, fileChars: 48000, fileCharsWarn: 24000,
});
const ENV_OK = new Set(["MODE", "DEV", "PROD", "SSR", "BASE_URL"]);
const BUNDLE_NAMES = new Set(["arcfacts", "arcknowledge"]);
// A relative import of any of these is refused: none of them may live under face/src at all.
const DATA_EXT = /\.(json|jsonc|json5|jsonl|ya?ml|toml|md|mdx|txt|csv|tsv|xml|html?|js|jsx|cjs)$/i;
// Out of a package, .js is code (three's examples); these are data wherever they come from.
const PACKAGE_DATA_EXT = /\.(json|jsonc|json5|jsonl|ya?ml|toml|md|mdx|txt|csv|tsv|xml|html?)$/i;
const CODE_SPEC = /\.(mjs|ts|tsx)$/;
// A JSON member -- `"key":` or `'key':` -- which a stylesheet has no use for.
const JSON_MEMBER = /["'][^"'\n]{1,80}["']\s*:/;
const PACKAGE = /^(@[a-z0-9][a-z0-9._~-]*\/)?[a-z0-9][a-z0-9._~-]*(\/[a-zA-Z0-9._~@-]+)*$/;
const GLOB_PATTERN = /^\.\/([A-Za-z0-9_*.-]+\/)*[A-Za-z0-9_*.-]*\.(mjs|ts|tsx)$/;
const GLOB_OPTIONS = new Set(["eager", "import"]);
const FETCH_BASES = new Set(["window", "globalThis", "self"]);
const RAW_NETWORK = new Set(["XMLHttpRequest", "WebSocket", "sendBeacon"]);
const BUILD_KEYS = new Set(["define", "alias", "resolve", "publicDir", "envDir", "envPrefix", "assetsInclude", "json"]);
const VITE_CONFIGS = Object.freeze(["vite.config.ts", "vite.config.mts", "vite.config.js", "vite.config.mjs", "vite.config.cjs", "vite.config.cts"]);

const FACT_SHAPES = [
  // Lookarounds, not negated ranges: a negated letter range is collation-dependent (tests/portability.bats).
  ["a ULID", /(?<![0-9A-Za-z])[0-9A-HJKMNP-TV-Z]{26}(?![0-9A-Za-z])/],
  ["a commit SHA", /(?<![0-9A-Za-z])(?=[0-9a-f]*[a-f])(?=[0-9a-f]*[0-9])[0-9a-f]{7,40}(?![0-9A-Za-z])/],
  ["a PR number", /(^|[\s(])#\d{2,5}\b/],
  ["a count claim", /\b\d+\s+(commands|agents|lanes|rooms|ADRs|tests|holes|skills|kinds|routes|modules)\b/i],
];

/** @typedef {{ file: string, line: number, col: number, kind: string, detail: string, level: "FAIL"|"WARN" }} Finding */

const isP = (t, v) => !!t && t.k === "p" && t.v === v;
const isName = (t, v) => !!t && t.k === "name" && t.v === v;

/**
 * Is the bracket at `idx` an object or array LITERAL? A `{` counts only after a token that can precede a
 * value: `): string {` is a function body, however the lexer classed it (face v2 Phase 03 attack).
 */
function isDataBracket(tokens, idx) {
  const t = tokens[idx];
  if (!t || t.k !== "p") return false;
  const p = tokens[idx - 1];
  if (t.v === "{") {
    if (t.kind !== "object") return false;
    if (!p) return false;
    if (p.k === "name") return p.prop !== true && ["return", "yield", "await", "default", "case"].includes(p.v);
    return p.k === "p" && ["=", "(", ",", "[", ":", "?", "...", "||", "&&", "??", "${"].includes(p.v);
  }
  if (t.v === "[") {
    if (!p) return true;
    if (p.k === "name") return p.prop !== true && ["return", "typeof", "in", "of", "case", "yield", "await", "void", "delete", "throw", "new", "export", "default", "extends"].includes(p.v);
    if (p.k === "str" || p.k === "num" || p.k === "re" || p.k === "text") return false;
    return !(p.v === ")" || p.v === "]" || p.v === "}" || p.v === "`end");
  }
  return false;
}

/**
 * A path with every EXISTING ancestor resolved through links, and the rest appended. An extensionless
 * specifier (`../ui/bits`) names no file on disk, and comparing its raw path with a realpath'd root read
 * macOS's `/var` against `/private/var` as leaving the root (face v2 Phase 03, CI run 35241805573).
 * @param {string} p
 */
function realish(p) {
  let head = p;
  const tail = [];
  for (;;) {
    try { return join(realpathSync(head), ...[...tail].reverse()); } catch { /* not there yet: climb */ }
    const up = dirname(head);
    if (up === head) return p;
    tail.push(basename(head));
    head = up;
  }
}

/** @param {string} p */
function realOf(p) { try { return realpathSync(p); } catch { return p; } }

/**
 * Whether a relative specifier matches a folder or file only case-insensitively on the way down -- the
 * spelling a case-insensitive disk resolves and a case-sensitive one refuses, which gave this lint a
 * different answer per OS (the twin of face-pure's Phase 02 spelling fix). A segment that is simply absent
 * (an extensionless import, a missing file) ends the check: that is the bundler's to refuse.
 * @param {string} fromDir @param {string} spec
 * @returns {string | null}
 */
function caseProblem(fromDir, spec) {
  let dir = fromDir;
  for (const seg of spec.split("/")) {
    if (seg === "." || seg === "") continue;
    if (seg === "..") { dir = dirname(dir); continue; }
    let names;
    try { names = readdirSync(dir); } catch { return null; }
    if (names.includes(seg)) { dir = join(dir, seg); continue; }
    if (names.some((n) => n.toLowerCase() === seg.toLowerCase())) return `${JSON.stringify(spec)} matches ${JSON.stringify(seg)} only case-insensitively`;
    return null;
  }
  return null;
}

/**
 * Where a relative specifier lands, and whether it stays inside the root. Separators, percents, colons
 * and empty segments are refused before any resolution: the bundler, node and this lint must not be able
 * to read one spelling as three files (a colon names an NTFS stream the walk never lists).
 */
function relativeProblem(spec, fromDir, rootReal) {
  if (spec.includes("\\") || spec.includes("%") || spec.includes("//") || spec.includes(":")) return `${JSON.stringify(spec)} spells a backslash, a percent, a colon or an empty segment`;
  const cased = caseProblem(fromDir, spec);
  if (cased) return cased;
  const rel = relative(rootReal, realish(resolve(fromDir, spec)));
  if (rel === "" || rel.startsWith("..") || isAbsolute(rel)) return `${JSON.stringify(spec)} leaves face/src`;
  return null;
}

/** A package-style name with a `.`, `..` or empty segment climbs wherever it is resolved from. */
const climbs = (s) => s.split("/").some((seg) => seg === "." || seg === ".." || seg === "");

/** Why a module specifier is refused, as [kind, detail], or null. */
export function specifierProblem(spec, fromDir, rootReal) {
  const s = String(spec);
  const worker = /^(\.\.?\/.*)\?(worker|sharedworker)$/.exec(s);
  if (worker && CODE_SPEC.test(worker[1] ?? "")) {
    const why = relativeProblem(worker[1] ?? "", fromDir, rootReal);
    return why ? ["import-outside", why] : null;
  }
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
  if (!PACKAGE.test(s) || climbs(s)) return ["import-outside", `${JSON.stringify(s)} is not a package name, or climbs through a . or .. segment`];
  if (PACKAGE_DATA_EXT.test(s)) return ["asset-import", `${JSON.stringify(s)} imports a data file out of a package`];
  return null;
}

/**
 * The literal tokens that are a STYLESHEET, not a blob: a top-level `const NAME = <string or template
 * with no ${}>` that is not exported, in a file that re-exports nothing and imports no namespace, whose
 * every other use is the sole child of a <style> element. The Cycle 15 rooms carry their CSS this way.
 * Such text is scanned as a stylesheet instead. (An exported or namespace-reachable constant is read by
 * other code, so it is judged as text like any other -- face v2 Phase 03 attack.)
 * @returns {number[][]} one list of token indices per stylesheet literal
 */
function styleLiterals(tokens) {
  for (let i = 0; i < tokens.length; i++) {
    if (isName(tokens[i], "import") && isP(tokens[i + 1], "*")) return [];
    if (isName(tokens[i], "export") && isP(tokens[i + 1], "*")) return [];
  }
  /** @type {Map<string, number[]>} */
  const decl = new Map();
  /** @type {Set<number>} */
  const declName = new Set();
  /** @type {Set<string>} */
  const exported = new Set();
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (isName(t, "export")) {
      if (isName(tokens[i + 1], "default") && tokens[i + 2] && tokens[i + 2].k === "name") exported.add(tokens[i + 2].v);
      if (isP(tokens[i + 1], "{") && tokens[i + 1].pair > 0) for (let j = i + 2; j < tokens[i + 1].pair; j++) if (tokens[j].k === "name") exported.add(tokens[j].v);
    }
    if (!isName(t, "const") || t.inside !== -1) continue;
    if (isName(tokens[i - 1], "export")) { if (tokens[i + 1]) exported.add(tokens[i + 1].v); continue; }
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
    if (t.k !== "name" || !decl.has(t.v) || declName.has(j)) continue;
    const u = uses.get(t.v) ?? { good: 0, bad: 0 };
    const open = tokens[j - 1];
    const element = open && open.inside >= 0 ? tokens[open.inside] : null;
    const sole = t.prop !== true && isP(open, "{") && open.kind === "jsx" && isP(tokens[j + 1], "}") && isP(tokens[j - 2], "jsx>") && isP(tokens[j + 2], "jsx</>");
    if (sole && element && element.v === "jsx<" && element.tag === "style") u.good++;
    else u.bad++;
    uses.set(t.v, u);
  }
  /** @type {number[][]} */
  const out = [];
  for (const [name, idx] of decl) {
    const u = uses.get(name);
    if (!exported.has(name) && u && u.good > 0 && u.bad === 0 && idx.length > 0) out.push(idx);
  }
  return out;
}

/** Does a literal door target stay a plain route under /api/? */
const plainApi = (target) => /^\/api\/[A-Za-z0-9_:.-]*(\/[A-Za-z0-9_:.-]+)*\/?(\?[A-Za-z0-9_=&.,:-]*)?$/.test(target)
  && !target.includes("..") && !target.includes("%") && !target.includes("\\") && !/\/\/|\/\.(\/|$)/.test(target.slice(1));

/** The literal head of a call's first argument, looking through parentheses and a template's literal ${}. */
function literalHead(tokens, openParen) {
  let i = openParen + 1;
  while (isP(tokens[i], "(")) i++;
  const a = tokens[i];
  if (!a) return { kind: "none" };
  if (a.k === "str") return { kind: "literal", text: a.v, at: a };
  if (isP(a, "`")) {
    let text = "";
    for (let j = i + 1; j < a.pair; j++) {
      const u = tokens[j];
      if (u.k === "text") { text += u.v; continue; }
      if (isP(u, "${") && tokens[j + 1] && tokens[j + 1].k === "str" && isP(tokens[j + 2], "}")) { text += tokens[j + 1].v; j += 2; continue; }
      return j === i + 1 ? { kind: "computed" } : { kind: "literal", text, at: a };
    }
    return { kind: "literal", text, at: a };
  }
  return { kind: "computed" };
}

/**
 * Scan one code file's text.
 * @param {string} text  @param {string} file  shown path  @param {{ fromDir: string, rootReal: string, inModules: boolean, jsx: boolean }} ctx
 * @returns {{ findings: Finding[], leaves: number, chars: number }}
 */
export function scanCode(text, file, { fromDir, rootReal, inModules, jsx }) {
  /** @type {Finding[]} */
  const findings = [];
  const add = (t, level, kind, detail) => findings.push({ file, line: t ? t.line : 1, col: t ? t.col : 1, kind, detail, level });
  const { tokens, error } = lex(text, { jsx, text: true });
  if (error) { add(error, "FAIL", "unscannable", `the lexer could not read this file past here: ${error.message}`); return { findings, leaves: 0, chars: 0 }; }

  if (/\bGENERATED\b\s+(from|by)\b/.test(text)) {
    const at = text.slice(0, text.search(/\bGENERATED\b\s+(from|by)\b/)).split("\n").length;
    add({ line: at, col: 1 }, "WARN", "banner", "a comment says this file was GENERATED -- a generated snapshot in the bundle is a facts bundle");
  }

  for (const st of importStatements(tokens)) {
    const why = specifierProblem(st.spec, fromDir, rootReal);
    if (why) add(st.specAt, "FAIL", why[0], why[1]);
    for (let j = st.start; j <= st.end; j++) {
      if ((isName(tokens[j], "with") || isName(tokens[j], "assert")) && isP(tokens[j + 1], "{")) {
        add(tokens[j], "FAIL", "asset-import", "an import attribute turns a file into a value in the bundle");
        break;
      }
    }
  }

  /** @type {Set<number>} */
  const styles = new Set();
  for (const group of styleLiterals(tokens)) {
    for (const k of group) styles.add(k);
    const at = tokens[group[0]];
    const css = group.map((k) => tokens[k].v).join("");
    for (const f of scanStyle(css, file, { fromDir, rootReal })) findings.push({ ...f, line: at.line + f.line - 1, col: f.line === 1 ? at.col : 1 });
  }

  /** Text length and shape checks for one literal text, reported once at its first token. */
  const judgeText = (at, value, shapes = true) => {
    if (value.length >= LIMITS.blob) add(at, "FAIL", "blob", `${value.length} characters of literal text -- a bundle packed into text is still a bundle`);
    else if (value.length >= LIMITS.longString) add(at, "WARN", "long-string", `${value.length} characters of literal text`);
    if (shapes && inModules) for (const [what, re] of FACT_SHAPES) if (re.test(value)) { add(at, "WARN", "fact-literal", `text shaped like ${what}: ${JSON.stringify(value.length > 80 ? `${value.slice(0, 77)}...` : value)} -- a repo fact comes from a door route`); break; }
  };

  const mass = new Map();
  let dataLeaves = 0;
  let leaves = 0;
  let chars = 0;
  /** @type {Set<number>} tokens already judged as part of a longer text */
  const judged = new Set();

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    const p = tokens[i - 1];
    const n = tokens[i + 1];
    const afterDot = isP(p, ".") || isP(p, "?.");
    const base = afterDot ? tokens[i - 2] : null;
    const viaGlobal = !afterDot || (base && base.k === "name" && FETCH_BASES.has(base.v) && !isP(tokens[i - 3], ".") && !isP(tokens[i - 3], "?."));

    if (t.k === "str" || t.k === "num" || t.k === "text" || t.k === "re") {
      const value = t.k === "re" ? String(t.raw ?? "") : t.v;
      if (!styles.has(i)) {
        leaves++;
        chars += t.k === "num" ? 0 : value.length;
      }
      if (t.k === "num" || styles.has(i) || judged.has(i)) { /* counted; no text to judge */ }
      else if (t.k === "str" && isP(n, "+") && tokens[i + 2] && tokens[i + 2].k === "str") {
        // a `+` chain of strings is one text
        let whole = t.v;
        let j = i;
        while (isP(tokens[j + 1], "+") && tokens[j + 2] && tokens[j + 2].k === "str") { j += 2; whole += tokens[j].v; judged.add(j); }
        judgeText(t, whole);
      } else if (t.k === "text" && t.inside >= 0 && isP(tokens[t.inside], "`")) {
        // every literal part of a template is one text, whatever sits between the parts
        const open = tokens[t.inside];
        let whole = "";
        for (let j = t.inside + 1; j < open.pair; j++) if (tokens[j].k === "text" && tokens[j].inside === t.inside) { whole += tokens[j].v; judged.add(j); }
        judgeText(t, whole);
      } else {
        judgeText(t, value, t.k !== "re");
      }
      if (t.k === "str" || t.k === "num") {
        let j = t.inside, top = -1;
        while (j >= 0 && isDataBracket(tokens, j)) { top = j; j = tokens[j].inside; }
        if (top >= 0) { mass.set(top, (mass.get(top) ?? 0) + 1); dataLeaves++; }
      }
      // A fetch reached through a computed key: globalThis["fetch"](...)
      if (t.k === "str" && (t.v === "fetch" || RAW_NETWORK.has(t.v)) && isP(p, "[") && isP(n, "]")) add(t, "FAIL", "fetch-static", `${JSON.stringify(t.v)} reached by a computed key cannot be judged -- the face reads the door by a plain fetch`);
      continue;
    }

    if (t.k !== "name") continue;

    if (RAW_NETWORK.has(t.v) && (t.v === "sendBeacon" || !afterDot)) { add(t, "FAIL", "fetch-static", `${t.v} -- the face reads the door by fetch, and nothing else leaves the page`); continue; }

    if (t.v === "require" && !afterDot && isP(n, "(")) { add(t, "FAIL", "import-outside", "require() -- the face is ES modules, and a require cannot be shown to stay inside the app folder"); continue; }

    if (t.v === "import" && !afterDot && isP(n, "(")) {
      const a = tokens[i + 2];
      if (a && a.k === "str" && isP(tokens[i + 3], ")")) {
        const why = specifierProblem(a.v, fromDir, rootReal);
        if (why) add(a, "FAIL", why[0], why[1]);
      } else add(t, "FAIL", "import-outside", "an import() of a computed specifier cannot be shown to stay inside the app folder");
      continue;
    }

    if (afterDot) {
      // JSON.parse / atob / fetch reached through a global base are judged below; any other member is not a rule.
      if (!(t.v === "parse" || t.v === "atob" || t.v === "fetch")) continue;
    }

    // import.meta.glob / import.meta.env
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
            if ((u.k === "name" || u.k === "str") && isP(tokens[j + 1], ":") && u.inside === after + 1 && !GLOB_OPTIONS.has(u.v))
              add(u, "FAIL", "glob", `the glob option ${JSON.stringify(u.v)} -- only { eager, import } are read; a query, raw text or a URL is a file turned into a value`);
            else if (isP(u, "...") || (isP(u, "[") && u.inside === after + 1)) add(u, "FAIL", "glob", "glob options that are computed cannot be checked");
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
      const comma = a && a.k === "str" ? i + 3 : a && isP(a, "`") ? a.pair + 1 : -1;
      if (comma > 0 && isP(tokens[comma], ",") && isName(tokens[comma + 1], "import")) {
        const head = literalHead(tokens, i + 1);
        const codeInside = head.kind === "literal" && (head.text.startsWith("./") || head.text.startsWith("../")) && CODE_SPEC.test(head.text) && relativeProblem(head.text, fromDir, rootReal) === null;
        if (!codeInside) add(t, "FAIL", "asset-url", "new URL(literal, import.meta.url) makes the bundler copy the file into the app -- only code inside face/src (a worker) is allowed");
      }
      continue;
    }

    const isFetch = t.v === "fetch" && viaGlobal && isP(n, "(");
    const isNewTarget = (t.v === "EventSource" || t.v === "Request") && isName(p, "new") && isP(n, "(");
    if (isFetch || isNewTarget) {
      const head = literalHead(tokens, i + 1);
      if (head.kind === "literal" && !plainApi(head.text)) add(head.at ?? t, "FAIL", "fetch-static", `${t.v} of ${JSON.stringify(head.text.length > 80 ? `${head.text.slice(0, 77)}...` : head.text)} -- the face reads plain door routes under /api/, never a file or a path that climbs`);
      continue;
    }

    // JSON.parse / atob of any literal text, however reached
    const parse = t.v === "parse" && afterDot && isName(base, "JSON") && isP(n, "(");
    const jsonCall = t.v === "JSON" && isP(n, ".") && isName(tokens[i + 2], "parse") && isP(tokens[i + 3], "(");
    const atob = t.v === "atob" && viaGlobal && isP(n, "(");
    if ((parse || atob) && n.pair > 0) {
      for (let j = i + 2; j < n.pair; j++) {
        if (tokens[j].k === "str" || tokens[j].k === "text") { add(t, "FAIL", "blob", `${t.v === "atob" ? "atob" : "JSON.parse"} of literal text is a bundle unpacked at runtime`); break; }
      }
    }
    if (jsonCall) continue;
  }

  for (const [idx, count] of mass) {
    const at = tokens[idx];
    if (count >= LIMITS.literalFail) add(at, "FAIL", "data-mass", `one literal holds ${count} literal leaves (FAIL at ${LIMITS.literalFail}) -- facts in the bundle`);
    else if (count >= LIMITS.literalWarn) add(at, "WARN", "data-literal", `one literal holds ${count} literal leaves (WARN at ${LIMITS.literalWarn})`);
  }
  const origin = { line: 1, col: 1 };
  if (leaves >= LIMITS.fileLeaves) add(origin, "FAIL", "data-mass", `the file's literals hold ${leaves} leaves (FAIL at ${LIMITS.fileLeaves}) -- facts in the bundle`);
  else if (leaves >= LIMITS.fileLeavesWarn) add(origin, "WARN", "data-literal", `the file's literals hold ${leaves} leaves (WARN at ${LIMITS.fileLeavesWarn})`);
  if (chars >= LIMITS.fileChars) add(origin, "FAIL", "data-mass", `the file's literals hold ${chars} characters (FAIL at ${LIMITS.fileChars}) -- facts in the bundle`);
  else if (chars >= LIMITS.fileCharsWarn) add(origin, "WARN", "data-literal", `the file's literals hold ${chars} characters (WARN at ${LIMITS.fileCharsWarn})`);
  if (dataLeaves >= LIMITS.fileLeaves) add(origin, "FAIL", "data-mass", `the file's data literals hold ${dataLeaves} leaves (FAIL at ${LIMITS.fileLeaves})`);
  return { findings, leaves, chars };
}

/**
 * A stylesheet: every @import, url(), and Tailwind @plugin, @config, @source and @reference that leaves
 * face/src; any quoted string long enough to be a blob; any JSON member. Comments are blanked first
 * (keeping line numbers), so `@import/**\/"x"` reads as the @import it is.
 */
export function scanStyle(text, file, { fromDir, rootReal }) {
  /** @type {Finding[]} */
  const findings = [];
  const css = String(text).replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
  const lineOf = (index) => css.slice(0, index).split("\n").length;
  const push = (index, level, kind, detail) => findings.push({ file, line: lineOf(index), col: 1, level, kind, detail });
  if (JSON_MEMBER.test(css)) push(css.search(JSON_MEMBER), "FAIL", "blob", "a stylesheet carrying a JSON member -- data wearing a stylesheet's clothes");
  for (const m of css.matchAll(/(["'])((?:\\.|(?!\1)[^\\\n])*)\1/g)) {
    const v = m[2] ?? "";
    if (v.length >= LIMITS.blob) push(m.index, "FAIL", "blob", `a ${v.length}-character string in a stylesheet`);
    else if (v.length >= LIMITS.longString) push(m.index, "WARN", "long-string", `a ${v.length}-character string in a stylesheet`);
  }
  const refs = [];
  for (const m of css.matchAll(/@import\s*(?:url\(\s*)?(["']?)([^"')\s;]+)\1/g)) refs.push([m[2], m.index]);
  for (const m of css.matchAll(/url\(\s*(["']?)([^"')]*)\1\s*\)/g)) refs.push([m[2], m.index]);
  for (const m of css.matchAll(/@(?:plugin|config|source|reference)\s*(?:not\s+|inline\(\s*)?(["'])([^"']*)\1/g)) refs.push([m[2], m.index]);
  for (const [ref, index] of refs) {
    const r = String(ref ?? "");
    if (r.startsWith("data:")) {
      if (r.length >= LIMITS.blob) push(index, "FAIL", "blob", `a ${r.length}-character data: URL`);
      continue;
    }
    if (r.startsWith("#") && !r.includes("/")) continue; // an SVG fragment reference
    if (r === "." || r.startsWith("./") || r.startsWith("../")) {
      if (DATA_EXT.test(r)) { push(index, "FAIL", "asset-import", `${JSON.stringify(r)} pulls a data file into the stylesheet`); continue; }
      const why = r === "." ? null : relativeProblem(r, fromDir, rootReal);
      if (why) push(index, "FAIL", "import-outside", why);
      continue;
    }
    if (PACKAGE.test(r) && !climbs(r)) continue; // `@import "tailwindcss"`
    push(index, "FAIL", "import-outside", `${JSON.stringify(r)} is an absolute path, a URL, a scheme or a climbing name in a stylesheet`);
  }
  return findings;
}

/**
 * Whether a dependency spec installs from the disk, by npm's own reading of a spec: a `file:`, `link:`,
 * `portal:` or `git+file:` protocol in any case (after an `npm:` alias too), a path that starts with a
 * dot, a slash, a backslash, a tilde or a drive, or a tarball by its extension.
 * @param {string} spec
 */
export function pathSpec(spec) {
  const s = String(spec).trim().toLowerCase();
  // A registry or remote URL ending in .tgz is a download, not a path; only a bare tarball name is local.
  const remote = /^[a-z][a-z0-9+.-]*:\/\//.test(s) && !s.startsWith("file:") && !s.startsWith("git+file:");
  return /(^|@)(file|link|portal|git\+file):/.test(s) || /^[.~/\\]/.test(s) || /^[a-z]:[\\/]/.test(s) || (!remote && /\.(tgz|tar|tar\.gz|tar\.bz2|tbz2?|zip)$/.test(s));
}

/**
 * face/package.json: a path install, and every field that maps a name to a file the walk never reaches.
 * @param {string} packageJson @param {(kind: string, detail: string) => void} fail
 */
function checkPackage(packageJson, fail) {
  let pkg;
  try {
    const raw = readFileSync(packageJson, "utf8");
    pkg = JSON.parse(raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw);
  } catch (e) { fail("unscannable", `package.json could not be read: ${e.message}`); return; }
  if (!pkg || typeof pkg !== "object") { fail("unscannable", "package.json is not an object"); return; }
  for (const field of ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"]) {
    for (const [name, range] of Object.entries(pkg[field] ?? {})) {
      if (typeof range === "string" && pathSpec(range)) fail("package", `${field}.${name} is installed from a path (${JSON.stringify(range)}) -- a package the lint cannot see into`);
    }
  }
  /** @param {unknown} v @param {string} at */
  const walkPaths = (v, at) => {
    if (typeof v === "string") { if (pathSpec(v)) fail("package", `${at} is a path (${JSON.stringify(v)})`); return; }
    if (v && typeof v === "object") for (const [k, w] of Object.entries(v)) walkPaths(w, `${at}.${k}`);
  };
  walkPaths(pkg.overrides, "overrides");
  walkPaths(pkg.resolutions, "resolutions");
  for (const field of ["workspaces", "imports", "exports", "browser"]) {
    if (Object.hasOwn(pkg, field)) fail("package", `package.json declares ${field} -- it maps a name to a file this lint never walks`);
  }
}

/**
 * face/package-lock.json: `npm ci` installs what the lock resolved, so a package locked to a link or a path
 * is a path install whatever package.json says.
 * @param {string} lockfile @param {(kind: string, detail: string) => void} fail
 */
function checkLockfile(lockfile, fail) {
  let lock;
  try {
    const raw = readFileSync(lockfile, "utf8");
    lock = JSON.parse(raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw);
  } catch (e) { fail("unscannable", `package-lock.json could not be read: ${e.message}`); return; }
  const packages = lock && typeof lock === "object" && lock.packages && typeof lock.packages === "object" ? lock.packages : {};
  for (const [at, entry] of Object.entries(packages)) {
    if (!entry || typeof entry !== "object" || at === "") continue;
    if (entry.link === true || (typeof entry.resolved === "string" && pathSpec(entry.resolved)))
      fail("package", `package-lock.json locks ${JSON.stringify(at)} to a link or a path -- npm ci installs a file this lint never walks`);
  }
}

/**
 * face/vite.config.*: a key that injects a value or a path into the build.
 * @param {string} file @param {(kind: string, detail: string) => void} fail
 */
function checkViteConfig(file, fail) {
  let text;
  try { text = readFileSync(file, "utf8"); } catch (e) { fail("unscannable", `${basename(file)} could not be read: ${e.message}`); return; }
  const { tokens, error } = lex(text, { jsx: false });
  if (error) { fail("unscannable", `${basename(file)} could not be read past line ${error.line}: ${error.message}`); return; }
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if ((t.k === "name" || t.k === "str") && BUILD_KEYS.has(t.v) && isP(tokens[i + 1], ":") && !isP(tokens[i - 1], "?"))
      fail("build-config", `${basename(file)} sets ${JSON.stringify(t.v)} (line ${t.line}) -- a value or a path the build injects from outside face/src`);
  }
}

/**
 * Walk a root and scan every file under it.
 * @param {string} root  face/src
 * @param {{ base?: string, packageJson?: string | null, configDir?: string | null }} [opts]
 */
export function lintFacts(root, { base = process.cwd(), packageJson = join(dirname(root), "package.json"), configDir = dirname(root) } = {}) {
  const report = { files: 0, code: 0, styles: 0, leaves: 0, chars: 0, findings: /** @type {Finding[]} */ ([]) };
  const show = (p) => oneLine(relative(base, p).split(sep).join("/") || ".");
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

  if (packageJson && existsSync(packageJson)) checkPackage(packageJson, (kind, detail) => fail(packageJson, kind, detail));
  const lockfile = packageJson ? join(dirname(packageJson), "package-lock.json") : null;
  if (lockfile && existsSync(lockfile)) checkLockfile(lockfile, (kind, detail) => fail(lockfile, kind, detail));
  if (configDir) for (const name of VITE_CONFIGS) {
    const file = join(configDir, name);
    if (existsSync(file)) checkViteConfig(file, (kind, detail) => fail(file, kind, detail));
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
      // Relative specifiers resolve from the REAL folder, as node and the bundler resolve them: `..` from a
      // linked parent lands where the link points, not where the link sits (face v2 Phase 03 attack).
      const ctx = { fromDir: realOf(dirname(abs)), rootReal };
      if (isStyle) { report.styles++; report.findings.push(...scanStyle(text, show(abs), ctx)); continue; }
      report.code++;
      const real = realOf(abs);
      const inModules = real.startsWith(modulesDir + sep);
      const { findings, leaves, chars } = scanCode(text, show(abs), { ...ctx, inModules, jsx: ext === ".tsx" });
      report.leaves += leaves;
      report.chars += chars;
      report.findings.push(...findings);
    }
  };
  walk(root);
  return report;
}

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
