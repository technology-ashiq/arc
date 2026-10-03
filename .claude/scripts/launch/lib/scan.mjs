// ONE scanner for the three source rules, so a fix to one cannot leave its twin open (PLAN pre-mortem 4):
//   default-word  (ADR-1703) -- the word is forbidden in both YAML files and in adapter code
//   zero-dep-leg  (ADR-1715) -- an adapter imports only node: built-ins and files inside the providers tree
//   verify-is-probe (ADR-1709) -- an adapter's verify must ask something outside the repo (ctx.fetch / ctx.probe)
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, resolve, relative, isAbsolute, sep } from "node:path";

const WORD = /\bdefault\b/i;

export function defaultWordHits(text) {
  const hits = [];
  text.split("\n").forEach((line, i) => { if (WORD.test(line)) hits.push(i + 1); });
  return hits;
}

// Comments blanked, strings KEPT -- specifiers live in strings, and a commented-out import is not an import.
export function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*|(["'`])(?:\\.|(?!\1)[^\\])*?\1/g, (m, q) => (q ? m : m.replace(/[^\n]/g, " ")));
}

// Every module specifier an adapter names, whitespace-free syntax included (`import{x}from"pkg"`, `import"pkg"`):
// any `from "x"`, any bare `import "x"`, any dynamic import() or require(). A non-literal dynamic one is `computed`.
export function specifiers(src) {
  const code = stripComments(src);
  const out = [];
  for (const re of [/\bfrom\s*["']([^"']+)["']/g, /\bimport\s*["']([^"']+)["']/g]) for (const m of code.matchAll(re)) out.push({ spec: m[1], computed: false });
  for (const re of [/\bimport\s*\(\s*([^)]*)\)/g, /\brequire\s*\(\s*([^)]*)\)/g])
    for (const m of code.matchAll(re)) {
      const lit = m[1].trim().match(/^["']([^"']+)["']$/);
      out.push(lit ? { spec: lit[1], computed: false } : { spec: m[1].trim(), computed: true });
    }
  return out;
}

// The adapter's whole world is ctx (ADR-1704). A built-in that reaches the network, the filesystem, a process or the
// environment would walk round every ctx guard, so only pure-computation built-ins are allowed (attack 3b48ed1 B2).
// An adapter is ONE file: the worker runs the exact bytes it hashed, so there is nothing for a relative import to reach.
export const ALLOWED_BUILTINS = new Set(["node:crypto", "node:url", "node:path", "node:buffer", "node:util"]);
const AMBIENT = [
  [/\bprocess\b/, "process"], [/\bglobalThis\b/, "globalThis"], [/\bglobal\b/, "global"], [/\beval\s*\(/, "eval"],
  [/\bFunction\s*\(/, "Function()"], [/\bWebSocket\b/, "WebSocket"], [/\bXMLHttpRequest\b/, "XMLHttpRequest"],
  [/(?<![.\w$])fetch\s*\(/, "bare fetch() -- use ctx.fetch"],
];

export function importFindings(src) {
  const out = [];
  for (const { spec, computed } of specifiers(src)) {
    if (computed) { out.push({ rule: "zero-dep-leg", msg: `computed module specifier ${spec} -- an adapter names its imports literally` }); continue; }
    if (spec.startsWith("node:") || /^(fs|child_process|net|http|https|os|vm|worker_threads|dns|tls|dgram|cluster)$/.test(spec)) {
      if (!ALLOWED_BUILTINS.has(spec)) out.push({ rule: "zero-dep-leg", msg: `imports ${spec} -- an adapter reaches the world only through ctx (allowed: ${[...ALLOWED_BUILTINS].join(", ")})` });
      continue;
    }
    if (spec.startsWith(".") || spec.startsWith("/")) { out.push({ rule: "import-boundary", msg: `imports ${spec} -- an adapter is one file and reaches no other code` }); continue; }
    out.push({ rule: "zero-dep-leg", msg: `imports package ${spec} -- adapters import no package (ADR-1715)` });
  }
  // Quoted strings are blanked so prose cannot trip the rule; template literals are NOT, since `${...}` inside one is code.
  const code = stripComments(src).replace(/(["'])(?:\\.|(?!\1)[^\\\n])*?\1/g, (m) => m[0] + " ".repeat(m.length - 2) + m[0]);
  for (const [re, name] of AMBIENT) if (re.test(code)) out.push({ rule: "ambient-capability", msg: `uses ${name} -- an adapter reaches the world only through ctx` });
  return out;
}

// The body of `export async function verify(...) { ... }`, by brace matching (strings and comments are blanked first).
export function verifyBody(src) {
  // One pass over strings and comments together: blanking comments first would read the `//` inside
  // "https://..." as a comment and eat the rest of the line, braces included.
  const blank = src.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*|(["'`])(?:\\.|(?!\1)[^\\])*?\1/g, (m, q) =>
    q ? q + m.slice(1, -1).replace(/[^\n]/g, " ") + q : m.replace(/[^\n]/g, " "));
  const m = blank.match(/export\s+(?:async\s+)?function\s+verify\s*\([^)]*\)\s*\{/);
  if (!m) return null;
  let depth = 0;
  for (let i = m.index + m[0].length - 1; i < blank.length; i++) {
    if (blank[i] === "{") depth++;
    else if (blank[i] === "}" && --depth === 0) return blank.slice(m.index, i + 1);
  }
  return null;
}

export function probeFindings(src) {
  const body = verifyBody(src);
  if (body === null) return [{ rule: "verify-is-probe", msg: "no `export async function verify(ctx)` found" }];
  if (!/\bctx\s*\.\s*(fetch|probe)\s*[.(]/.test(body))
    return [{ rule: "verify-is-probe", msg: "verify never asks anything outside the repo (no ctx.fetch / ctx.probe) -- a self-report is not a verify" }];
  return [];
}

export const CONTRACT = ["scaffold", "envContract", "verify", "teardown"];

export function contractFindings(src) {
  return CONTRACT.filter((fn) => !new RegExp(`export\\s+(?:async\\s+)?function\\s+${fn}\\s*\\(`).test(src))
    .map((fn) => ({ rule: "adapter-contract", msg: `missing export function ${fn} (ADR-1704: four functions)` }));
}

export function adapterFindings(path, providersDir) {
  const src = readFileSync(path, "utf8");
  return [
    ...defaultWordHits(src).map((n) => ({ rule: "default-word", msg: `line ${n} uses the word default (ADR-1703)` })),
    ...importFindings(src, path, providersDir),
    ...probeFindings(src),
    ...contractFindings(src),
  ];
}

// Digest pinned at vet (ADR-1719 amendment): sha256 over the bytes after CRLF -> LF, so a Windows checkout's line
// endings cannot un-vet an adapter on one CI leg. That normalisation is the one thing the pin cannot see.
export const normalizeAdapter = (text) => text.replace(/\r\n/g, "\n");
export const digestOf = (normalized) => createHash("sha256").update(normalized, "utf8").digest("hex");
export function adapterDigest(path) {
  return digestOf(normalizeAdapter(readFileSync(path, "utf8")));
}

export const posix = (p) => p.split(sep).join("/");
