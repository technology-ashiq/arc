#!/usr/bin/env node
// rebuild-lint.mjs -- lints an absorb REBUILD (absorb Phase 02, REQ-02).
//
// Three checks on one subject, which is why they share a script rather than three:
//   1. ALLOWLIST   every touched path is on the ADR-0602 allowlist. Arbitrary paths are never a
//                  rebuild target, because absorb's output is an edit to arc's own files and a
//                  self-editing loop needs a hard boundary on WHERE.
//   2. DEPENDENCIES  zero new runtime dependencies, found by PARSING rather than grepping.
//   3. ATTRIBUTION   a rebuild derived from a permissive-license source carries a source comment.
//
// WARN-first in TRIAL: exit 0 on any diff it could read, one WARN line per defect, promotion via
// /arc-retro against docs/trial-ledger.md. Exit 2 is a usage error only.
//
// WHY THE DEPENDENCY CHECK IS A PARSE AND NOT A GREP, in this file's own words so nobody
// "simplifies" it back: docs/retro-log.md, 2026-08-04, arc-evolve -- a propose-only guard was a
// grep, and it missed `from "fs"`, `fs/promises`, `child_process` and async exec/spawn, so a mutant
// module that overwrote the canonical file, deleted the champion, committed and spawned a deploy
// walked straight past it. Two independent attackers flagged the same shape in this lane's REQ-02
// before a line of it was written. A grep is never the guard where a parse is available.
//
// Usage:
//   rebuild-lint.mjs --paths FILE        FILE holds one changed path per line (git diff --name-only)
//   rebuild-lint.mjs --paths FILE --allowlist PATH --license permissive|incompatible|none
//
// The paths come from a FILE rather than argv because a rebuild can touch more paths than a command
// line holds, and because a path list built by a shell loop is where quoting bugs live.

import { readFileSync, existsSync, statSync } from "node:fs";
import { resolve, join } from "node:path";

const DEFAULT_ALLOWLIST = "products/absorb/allowlist.txt";

const warnings = [];
const warn = (group, msg) => warnings.push(`WARN  [${group}] ${msg}`);
const die = (msg) => { console.error(`rebuild-lint: ${msg}`); process.exit(2); };

const argv = process.argv.slice(2);
function flag(name) {
  const hits = [];
  for (let i = 0; i < argv.length; i++) if (argv[i] === name) hits.push(i);
  if (hits.length === 0) return null;
  if (hits.length > 1) die(`${name} given ${hits.length} times -- an operator error, not a last-wins override`);
  const v = argv[hits[0] + 1];
  if (v === undefined || v.startsWith("--")) die(`${name} needs a value`);
  return v;
}

const pathsFile = flag("--paths");
if (!pathsFile) die("usage: rebuild-lint.mjs --paths FILE [--allowlist PATH] [--license permissive|incompatible|none]");
if (!existsSync(pathsFile)) die(`--paths file does not exist: ${pathsFile}`);

const allowlistPath = flag("--allowlist") || DEFAULT_ALLOWLIST;
if (!existsSync(allowlistPath)) die(`allowlist not found at ${allowlistPath} (ADR-0602's lint-readable copy)`);

const license = flag("--license") || "none";
if (!["permissive", "incompatible", "none"].includes(license)) {
  die(`--license must be permissive | incompatible | none, got "${license}"`);
}

// --root is where the paths are READ from; it defaults to the cwd. The allowlist is checked against
// the path STRING, always repo-relative, never against the resolved location -- otherwise a lint run
// from a different directory would judge a different allowlist.
//
// This flag exists because the tests found the design flaw: a dependency fixture has to live in a
// temp directory, and an absolute temp path is correctly refused by the allowlist check, so the
// parse never ran on it. Reading and judging are two different questions about a path.
const rootArg = flag("--root") || ".";
if (!existsSync(rootArg)) die(`--root does not exist: ${rootArg}`);
const ROOT = resolve(rootArg);
const readable = (p) => join(ROOT, p);

// ---------- the allowlist ----------
const globs = readFileSync(allowlistPath, "utf8")
  .split("\n")
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith("#"));
if (globs.length === 0) die(`allowlist at ${allowlistPath} has no patterns -- an empty allowlist refuses everything, which is not a configuration`);

// `**` crosses separators, `*` does not. Anchored at both ends so a pattern cannot match a suffix:
// `processes/**` must not admit `evil/processes/x`.
function globToRe(g) {
  let out = "^";
  for (let i = 0; i < g.length; i++) {
    const c = g[i];
    if (c === "*" && g[i + 1] === "*") { out += ".*"; i++; continue; }
    if (c === "*") { out += "[^/]*"; continue; }
    if (c === "?") { out += "[^/]"; continue; }
    out += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(out + "$");
}
const allow = globs.map(globToRe);

// ---------- the paths ----------
const paths = readFileSync(pathsFile, "utf8")
  .split("\n")
  .map((l) => l.trim().replace(/\\/g, "/"))
  .filter(Boolean);
if (paths.length === 0) die(`--paths file ${pathsFile} is empty -- a rebuild that touches nothing is not a rebuild, and reporting it as clean would be a silent pass`);

for (const p of paths) {
  // A path escaping upward is refused before the allowlist is even consulted: `../` outside the repo
  // is not on any list, but saying so by name is clearer than "no pattern matched".
  if (p.startsWith("/") || /^[a-zA-Z]:/.test(p) || p.split("/").includes("..")) {
    warn("allowlist", `${p}: absolute or upward path -- a rebuild target is always repo-relative`);
    continue;
  }
  if (!allow.some((re) => re.test(p))) {
    warn("allowlist", `${p}: not on the ADR-0602 allowlist (${globs.join(", ")}) -- widening the list is an amendment, never a convenience edit`);
  }
}

// ---------- dependencies, by parse ----------
// Every import FORM, not the keyword. The forms below are exactly the ones the 2026-08-04 grep
// missed, plus the dynamic and constructed ones a grep cannot see at all.
const IMPORT_FORMS = [
  { re: /\bfrom\s+["']([^"']+)["']/g, what: 'from "X"' },
  { re: /\bimport\s+["']([^"']+)["']/g, what: 'bare import "X"' },
  { re: /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g, what: "dynamic import()" },
  { re: /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g, what: "require()" },
  { re: /\bcreateRequire\s*\(/g, what: "createRequire()" },
];
// A specifier built from a variable cannot be resolved statically, and that is itself the finding:
// it is how a dependency hides from any static check, grep or parse alike.
const DYNAMIC_SPECIFIER = [
  { re: /\bimport\s*\(\s*(?!["'])/g, what: "import() with a computed specifier" },
  { re: /\brequire\s*\(\s*(?!["'])/g, what: "require() with a computed specifier" },
];
const EXEC_FORMS = [
  { re: /\bchild_process\b/g, what: "child_process" },
  { re: /\bexecSync\b|\bexecFileSync\b|\bspawnSync\b|\bexec\s*\(|\bspawn\s*\(/g, what: "exec/spawn" },
  { re: /\bnpm\s+(?:install|i|add)\b|\byarn\s+add\b|\bpnpm\s+add\b/g, what: "a package install" },
];

// A specifier is a NEW runtime dependency unless it is node-builtin or repo-relative.
const BUILTIN = /^node:/;
const RELATIVE = /^[./]/;

const CODE_EXT = /\.(mjs|cjs|js|ts|mts|cts)$/;

for (const p of paths) {
  if (!CODE_EXT.test(p)) continue;      // a playbook or a command body carries no imports
  const abs = readable(p);
  if (!existsSync(abs)) continue;       // a deleted path has nothing to parse
  let src;
  try {
    if (statSync(abs).size > 2 * 1024 * 1024) { warn("deps", `${p}: over 2 MiB, not parsed`); continue; }
    src = readFileSync(abs, "utf8");
  } catch (e) {
    warn("deps", `${p}: unreadable (${e.code || e.message}), so its dependencies were NOT checked`);
    continue;
  }
  // Strip line comments and block comments so a documented example is not a finding. Only the
  // first non-space `//` per line, so a `//` inside a string literal cannot truncate the line --
  // that exact mistake defeated this lane's own boundary guard in Phase 01.
  const stripped = src
    .split("\n")
    .filter((l) => !/^\s*\/\//.test(l))
    .join("\n")
    .replace(/\/\*[\s\S]*?\*\//g, "");

  for (const { re, what } of IMPORT_FORMS) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(stripped)) !== null) {
      const spec = m[1];
      if (spec === undefined) { warn("deps", `${p}: uses ${what}, which resolves a module at run time`); continue; }
      if (BUILTIN.test(spec) || RELATIVE.test(spec)) continue;
      warn("deps", `${p}: NEW runtime dependency "${spec}" via ${what} -- absorb rebuilds add zero dependencies (REQ-02)`);
    }
  }
  for (const { re, what } of DYNAMIC_SPECIFIER) {
    re.lastIndex = 0;
    if (re.test(stripped)) warn("deps", `${p}: ${what} -- a specifier no static check can resolve is how a dependency hides`);
  }
  for (const { re, what } of EXEC_FORMS) {
    re.lastIndex = 0;
    if (re.test(stripped)) warn("deps", `${p}: names ${what} -- a rebuild does not install or execute anything`);
  }
}

// ---------- attribution ----------
// ADR-0601 puts the attribution rule in the report and REQ-02 requires it in TWO places: the
// registry row's `attribution` field (checked by registry-ref) and a source comment in the rebuilt
// file. This is the second place.
if (license === "permissive") {
  const codeOrText = paths.filter((p) => existsSync(readable(p)) && statSync(readable(p)).isFile());
  let attributed = 0;
  for (const p of codeOrText) {
    let src = "";
    try { src = readFileSync(readable(p), "utf8"); } catch { continue; }
    if (/\b(?:adapted|derived|re-expressed|attribution|originally)\b/i.test(src)) attributed++;
  }
  if (attributed === 0) {
    warn(
      "attribution",
      `--license permissive but no rebuilt file carries a source comment naming what it was adapted from -- REQ-02 requires attribution in the registry row AND in the file`
    );
  }
} else if (license === "incompatible") {
  warn(
    "attribution",
    `--license incompatible: a rebuild must not exist at all. The technique is a REFUSAL recorded in the registry with its reason (ADR-0601), never a diff`
  );
}

// ---------- report ----------
for (const w of warnings) console.log(w);
console.log(
  warnings.length === 0
    ? `rebuild-lint: 0 warnings (${paths.length} path${paths.length === 1 ? "" : "s"} checked against ${globs.length} allowlist pattern${globs.length === 1 ? "" : "s"})`
    : `rebuild-lint: ${warnings.length} warning${warnings.length === 1 ? "" : "s"} [trial] — WARN-first, exit 0 by design (docs/trial-ledger.md)`
);
process.exitCode = 0;
