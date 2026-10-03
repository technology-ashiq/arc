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

// Every module specifier an adapter names: static import/export-from, dynamic import(), require().
// Returns { spec, computed }: a dynamic specifier that is not one string literal is `computed`.
export function specifiers(src) {
  const out = [];
  const statics = [/\bimport\s+(?:[^'"`;]*?\sfrom\s+)?["']([^"']+)["']/g, /\bexport\s+[^'"`;]*?\sfrom\s+["']([^"']+)["']/g];
  for (const re of statics) for (const m of src.matchAll(re)) out.push({ spec: m[1], computed: false });
  for (const re of [/\bimport\s*\(\s*([^)]*)\)/g, /\brequire\s*\(\s*([^)]*)\)/g])
    for (const m of src.matchAll(re)) {
      const lit = m[1].trim().match(/^["']([^"']+)["']$/);
      out.push(lit ? { spec: lit[1], computed: false } : { spec: m[1].trim(), computed: true });
    }
  return out;
}

export function importFindings(src, adapterPath, providersDir) {
  const out = [];
  for (const { spec, computed } of specifiers(src)) {
    if (computed) { out.push({ rule: "zero-dep-leg", msg: `computed module specifier ${spec} -- an adapter names its imports literally` }); continue; }
    if (spec.startsWith("node:")) continue;
    if (spec.startsWith("./") || spec.startsWith("../")) {
      const rel = relative(providersDir, resolve(dirname(adapterPath), spec));
      if (rel.startsWith("..") || isAbsolute(rel))
        out.push({ rule: "import-boundary", msg: `imports ${spec}, outside the providers tree (an adapter never reaches venture or lane code)` });
      continue;
    }
    out.push({ rule: "zero-dep-leg", msg: `imports package ${spec} -- adapters import no package (ADR-1715)` });
  }
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
export function adapterDigest(path) {
  const text = readFileSync(path, "utf8").replace(/\r\n/g, "\n");
  return createHash("sha256").update(text, "utf8").digest("hex");
}

export const posix = (p) => p.split(sep).join("/");
