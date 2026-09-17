#!/usr/bin/env node
// face-colour-literal -- no colour is spelled out under face/src/ui/** or face/src/modules/**
// (face v2 Phase 01, REQ-02, ADR-1308, ADR-1322). Every colour there is a token from
// docs/design/system/tokens.css; a second spelling of a colour is how a reserved meaning rots,
// and a light mood cannot flip a colour that never went through a token.
//
// FAIL from birth: there is no WARN phase and no allow-list.
//
// What counts as a literal:
//   hex       #rgb · #rgba · #rrggbb · #rrggbbaa (not an HTML numeric entity such as &#8983;)
//   named     white · black, as a whole word in any case -- including Tailwind's text-white/80;
//             the CSS property white-space is the one hyphenated word that is not a colour
//   function  rgb() rgba() hsl() hsla() hwb() lab() lch() oklab() oklch() color() whose first
//             argument is a number -- rgba(var(--ink), 0.04) is a token and is not a literal
//   palette   a Tailwind default-palette utility such as bg-slate-900 or text-red-500
//
// It reads EVERY byte of every file, comments and prose included. A scanner that tries to tell
// JSX text from a string literal has to guess, and a guessing scanner goes quiet on the input it
// guessed wrong (fixed-defects: a comment stripper once blanked 99 lines). A literal in a comment
// is refused like one in code; write the token's name instead.
//
// What it does NOT see, declared: CSS named colours other than white and black (red, teal, ...),
// which are ordinary English words in a room's copy; system colours (Canvas, CanvasText); colours
// built at runtime from numbers; and anything outside the two roots.
//
// Usage: face-colour-literal.mjs [--root DIR]...     (default: face/src/ui and face/src/modules)
// Exit:  0 scanned more than zero files and found nothing · 1 a finding, or nothing scanned
//        2 could not run (bad argument, unreadable root)
import { readdirSync, readFileSync, lstatSync, realpathSync } from "node:fs";
import { join, dirname, resolve, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..", "..");
export const DEFAULT_ROOTS = ["face/src/ui", "face/src/modules"];

const WORD = "A-Za-z0-9_$";
const RULES = [
  { kind: "hex", re: new RegExp(`(?<![&${WORD}])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})(?![${WORD}-])`, "g") },
  // `white-space` is a CSS property, not a colour: the one hyphenated word the named rule excludes.
  { kind: "named", re: new RegExp(`(?<![${WORD}])(?:white(?!-space(?![${WORD}-]))|black)(?![${WORD}])`, "gi") },
  { kind: "function", re: new RegExp(`(?<![${WORD}-])(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\\(\\s*(?=[-+.0-9])`, "gi") },
  { kind: "function", re: new RegExp(`(?<![${WORD}-])color\\(\\s*[a-z0-9-]+\\s+(?=[-+.0-9])`, "gi") },
  {
    kind: "palette",
    re: new RegExp(`(?<![${WORD}-])(?:text|bg|border(?:-[xytrblse])?|ring|ring-offset|fill|stroke|outline|decoration|divide|placeholder|caret|accent|shadow|inset-shadow|drop-shadow|from|via|to)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|[1-9]00|950)(?![${WORD}])`, "g"),
  },
];

/**
 * Every literal in `text`, with a 1-based line and column.
 * @returns {{ file: string, line: number, col: number, kind: string, literal: string }[]}
 */
export function scanText(text, file) {
  const starts = [0];
  for (let i = 0; i < text.length; i++) if (text[i] === "\n") starts.push(i + 1);
  const where = (index) => {
    let lo = 0, hi = starts.length - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (starts[mid] <= index) lo = mid; else hi = mid - 1; }
    return { line: lo + 1, col: index - starts[lo] + 1 };
  };
  const out = [];
  for (const rule of RULES) {
    rule.re.lastIndex = 0;
    for (const m of text.matchAll(rule.re)) {
      out.push({ file, ...where(m.index), kind: rule.kind, literal: m[0].trim() });
    }
  }
  return out.sort((a, b) => a.line - b.line || a.col - b.col);
}

/**
 * Walk the roots. Every file is read whatever its extension; a NUL byte or a symlink is a named
 * finding rather than a file quietly left out of the count.
 * @returns {{ roots: { root: string, state: string, files: number }[], scanned: number, findings: object[] }}
 */
export function lintRoots(roots, base = REPO) {
  const report = { roots: [], scanned: 0, findings: [] };
  const show = (p) => relative(base, p).split(sep).join("/") || ".";
  const scanFile = (path) => {
    report.scanned++;
    const buf = readFileSync(path);
    if (buf.includes(0)) {
      report.findings.push({ file: show(path), line: 0, col: 0, kind: "binary", literal: "file carries a NUL byte and cannot be scanned" });
      return;
    }
    report.findings.push(...scanText(buf.toString("utf8"), show(path)));
  };
  const walk = (dir, counter) => {
    const entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const e of entries) {
      const p = join(dir, e.name);
      const st = lstatSync(p);
      if (st.isSymbolicLink()) {
        report.findings.push({ file: show(p), line: 0, col: 0, kind: "symlink", literal: "not followed and not scanned -- a source under this root is a real file" });
      } else if (st.isDirectory()) {
        walk(p, counter);
      } else if (st.isFile()) {
        counter.files++;
        scanFile(p);
      } else {
        report.findings.push({ file: show(p), line: 0, col: 0, kind: "special", literal: "neither a file nor a directory" });
      }
    }
  };
  for (const r of roots) {
    const abs = resolve(base, r);
    let st;
    try { st = lstatSync(abs); } catch (e) {
      if (e && e.code === "ENOENT") { report.roots.push({ root: r, state: "absent", files: 0 }); continue; }
      throw new Error(`cannot read root ${r}: ${e.message}`);
    }
    const counter = { files: 0 };
    if (st.isSymbolicLink()) {
      report.findings.push({ file: show(abs), line: 0, col: 0, kind: "symlink", literal: "a root that is a symlink is not followed" });
      report.roots.push({ root: r, state: "symlink", files: 0 });
    } else if (st.isDirectory()) {
      walk(abs, counter);
      report.roots.push({ root: r, state: "present", files: counter.files });
    } else {
      counter.files++;
      scanFile(abs);
      report.roots.push({ root: r, state: "file", files: 1 });
    }
  }
  return report;
}

export function parseArgs(argv) {
  const roots = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a !== "--root") throw new Error(`unknown argument ${JSON.stringify(a)} (the only flag is --root DIR)`);
    const v = argv[i + 1];
    if (v === undefined || v.startsWith("--") || v.trim() === "") throw new Error("--root needs a directory");
    if (roots.includes(v)) throw new Error(`--root ${v} given twice`);
    roots.push(v);
    i++;
  }
  return { roots: roots.length ? roots : DEFAULT_ROOTS, custom: roots.length > 0 };
}

function main(argv) {
  let opts;
  try { opts = parseArgs(argv); } catch (e) { console.error(`face-colour-literal: ${e.message}`); return 2; }
  let report;
  try { report = lintRoots(opts.roots, opts.custom ? process.cwd() : REPO); }
  catch (e) { console.error(`face-colour-literal: ${e.message}`); return 2; }
  for (const r of report.roots) console.log(`root ${r.root}: ${r.state === "present" ? `files=${r.files}` : r.state}`);
  for (const f of report.findings) console.log(`FAIL ${f.file}:${f.line}:${f.col} ${f.kind} ${f.literal}`);
  if (report.scanned === 0) console.log("FAIL nothing was scanned -- zero files is not a clean tree");
  console.log(`colour-literal: scanned=${report.scanned} files findings=${report.findings.length}`);
  return report.scanned > 0 && report.findings.length === 0 ? 0 : 1;
}

function invokedDirectly() {
  if (!process.argv[1]) return false;
  try { return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); }
  catch { return false; }
}

if (invokedDirectly()) process.exitCode = main(process.argv.slice(2));
