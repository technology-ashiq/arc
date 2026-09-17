#!/usr/bin/env node
// face-colour-literal -- no colour is spelled out under face/src/ui/** or face/src/modules/**
// (face v2 Phase 01, REQ-02, ADR-1308, ADR-1322). Every colour there is a token from
// docs/design/system/tokens.css; a second spelling of a colour is how a reserved meaning rots,
// and a light mood cannot flip a colour that never went through a token.
//
// FAIL from birth: there is no WARN phase and no allow-list.
//
// What counts as a literal:
//   hex       #rgb · #rgba · #rrggbb · #rrggbbaa -- including one assembled out of underscores in a
//             Tailwind arbitrary value (shadow-[0_0_0_1px_#fff]); not an HTML entity such as &#8983;
//   named     white · black, as a whole word in any case, including text-white/80 and
//             shadow-[inset_0_0_0_1px_white]; the CSS property white-space is not a colour
//   function  rgb() rgba() hsl() hsla() hwb() lab() lch() oklab() oklch() color() carrying any
//             number other than an alpha: rgba(var(--ink), 0.04) and rgb(from var(--x) r g b / .5)
//             are tokens; rgb(none 0 0), rgb(calc(255) ...) and rgb(from var(--x) 0 0 0) are not
//   palette   a Tailwind default-palette colour with a shade, under any prefix -- bg-slate-900,
//             inset-ring-red-500, var(--color-rose-600), theme(colors.red.500)
// Escaped spellings are read too: the file is scanned once as written and once with its numeric
// escapes decoded (&#35; &#x23; \x23 # \u{23} and CSS \23 ), and a literal that only the
// decoded text shows is reported as `escaped-<kind>`.
//
// It reads EVERY byte of every file, comments and prose included. A scanner that tries to tell
// JSX text from a string literal has to guess, and a guessing scanner goes quiet on the input it
// guessed wrong (fixed-defects: a comment stripper once blanked 99 lines). A literal in a comment
// is refused like one in code: write the token's name, and write "PR 233", not a hash and digits.
//
// What it does NOT see, declared: CSS named colours other than white and black (red, teal, ...),
// which are ordinary English words in a room's copy; system colours (Canvas, CanvasText); colours
// built at runtime from numbers or by string concatenation; and anything outside its roots --
// today that is the v1 renderers under face/src/rooms, which Phase 03 replaces with modules, and
// the unmounted face stage under face/src/face, whose particle palette joins a root when a room
// draws the stage again. The v0.7 shell ported in Phase 02 lives under face/src/shell and
// face/src/App.tsx, and both are read.
//
// Usage: face-colour-literal.mjs [--root PATH]...  (default: face/src/ui, face/src/modules,
//        face/src/shell and face/src/App.tsx, every one of which must exist)
// Exit:  0 scanned more than zero files and found nothing · 1 a finding, or nothing scanned
//        2 could not run (bad argument, a root given twice or inside another, unreadable root)
import { readdirSync, readFileSync, lstatSync, realpathSync } from "node:fs";
import { join, dirname, resolve, relative, sep, basename } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..", "..");
export const DEFAULT_ROOTS = ["face/src/ui", "face/src/modules", "face/src/shell", "face/src/App.tsx"];
/** A default root that must exist: a renamed or re-cased folder is a finding, not a clean tree. */
export const REQUIRED_DEFAULT_ROOTS = ["face/src/ui", "face/src/modules", "face/src/shell", "face/src/App.tsx"];

// Letters and digits only: `_` and `$` are separators here, because Tailwind reads `_` as a space
// inside an arbitrary value and a literal assembled that way is still a literal.
const ALNUM = "A-Za-z0-9";
const PALETTE = "slate|gray|zinc|neutral|stone|mauve|olive|mist|taupe|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";
const SHADE = "50|[1-9]00|950";

const RULES = [
  { kind: "hex", re: new RegExp(`(?<![&${ALNUM}])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})(?![${ALNUM}-])`, "g") },
  { kind: "named", re: new RegExp(`(?<![${ALNUM}])(?:white(?!-space(?![${ALNUM}-]))|black)(?![${ALNUM}])`, "gi") },
  { kind: "palette", re: new RegExp(`(?<![${ALNUM}])(?:[a-z][a-z0-9]*-)*(?:${PALETTE})-(?:${SHADE})(?![${ALNUM}])`, "g") },
  { kind: "palette", re: new RegExp(`(?<![${ALNUM}])colors\\.(?:${PALETTE})\\.(?:${SHADE})(?![${ALNUM}])`, "g") },
];
const COLOUR_FN = new RegExp(`(?<![${ALNUM}-])(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\\(`, "gi");

/** The argument text of a call whose "(" is at `open`, or null when it never closes. */
function callArgs(text, open) {
  let depth = 1;
  for (let i = open + 1; i < text.length; i++) {
    if (text[i] === "(") depth++;
    else if (text[i] === ")" && --depth === 0) return text.slice(open + 1, i);
  }
  return null;
}

/**
 * Whether a colour function's arguments spell any number that is not an alpha. `var(...)` calls
 * are removed first; an alpha is whatever follows the last top-level `/`, or the last of two or
 * more top-level comma parts when that part is a bare number or percentage.
 */
export function literalColourArgs(args) {
  let rest = args.replace(/\/\*[\s\S]*?\*\//g, " ");
  // Drop var(...) calls, innermost first, so nested fallbacks go too.
  for (let guard = 0; /var\(/i.test(rest) && guard < 50; guard++) rest = rest.replace(/var\([^()]*\)/gi, " ");
  let depth = 0;
  let slash = -1;
  const commas = [];
  for (let i = 0; i < rest.length; i++) {
    const c = rest[i];
    if (c === "(") depth++;
    else if (c === ")") depth--;
    else if (depth === 0 && c === "/") slash = i;
    else if (depth === 0 && c === ",") commas.push(i);
  }
  if (slash !== -1) rest = rest.slice(0, slash);
  else if (commas.length >= 1) {
    const last = rest.slice(commas[commas.length - 1] + 1).trim();
    if (/^(?:\d+\.?\d*|\.\d+)%?$/.test(last)) rest = rest.slice(0, commas[commas.length - 1]);
  }
  return /\d/.test(rest) || /\bnone\b/i.test(rest);
}

/** Numeric escapes decoded to the ASCII character they spell; anything else left as it was. */
export function decodeEscapes(text) {
  const ascii = (cp) => (cp >= 0x20 && cp < 0x7f ? String.fromCharCode(cp) : null);
  return text
    .replace(/&#(\d{1,7});/g, (m, d) => ascii(Number(d)) ?? m)
    .replace(/&#[xX]([0-9a-fA-F]{1,6});/g, (m, h) => ascii(parseInt(h, 16)) ?? m)
    .replace(/\\u\{([0-9a-fA-F]{1,6})\}/g, (m, h) => ascii(parseInt(h, 16)) ?? m)
    .replace(/\\u([0-9a-fA-F]{4})/g, (m, h) => ascii(parseInt(h, 16)) ?? m)
    .replace(/\\x([0-9a-fA-F]{2})/g, (m, h) => ascii(parseInt(h, 16)) ?? m)
    .replace(/\\([0-9a-fA-F]{1,6})[ \t]?/g, (m, h) => ascii(parseInt(h, 16)) ?? m);
}

function scanOnce(text) {
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
    for (const m of text.matchAll(rule.re)) out.push({ ...where(m.index), kind: rule.kind, literal: m[0].trim() });
  }
  COLOUR_FN.lastIndex = 0;
  for (const m of text.matchAll(COLOUR_FN)) {
    const open = m.index + m[0].length - 1;
    const args = callArgs(text, open);
    if (args === null || literalColourArgs(args)) out.push({ ...where(m.index), kind: "function", literal: m[0] });
  }
  return out;
}

/**
 * Every literal in `text`, with a 1-based line and column.
 * @returns {{ file: string, line: number, col: number, kind: string, literal: string }[]}
 */
export function scanText(text, file) {
  const plain = scanOnce(text);
  const decodedText = decodeEscapes(text);
  const out = plain.map((f) => ({ file, ...f }));
  if (decodedText !== text) {
    // Counted per kind: a kind the decoded text shows more of than the raw text is an escaped
    // spelling of a colour, reported at the decoded position.
    const rawCount = (k) => plain.filter((f) => f.kind === k).length;
    const decoded = scanOnce(decodedText);
    for (const kind of new Set(decoded.map((f) => f.kind))) {
      const extra = decoded.filter((f) => f.kind === kind).slice(rawCount(kind));
      for (const f of extra) out.push({ file, ...f, kind: `escaped-${kind}` });
    }
  }
  return out.sort((a, b) => a.line - b.line || a.col - b.col);
}

/** Whether `abs`'s last path segment exists on disk with exactly that spelling. */
function exactCase(abs) {
  try { return readdirSync(dirname(abs)).includes(basename(abs)); } catch { return false; }
}

/**
 * Walk the roots. Every file is read whatever its extension; a NUL byte, a symlink or a special
 * file is a named finding rather than a file quietly left out of the count.
 * @returns {{ roots: { root: string, state: string, files: number }[], scanned: number, findings: object[] }}
 */
export function lintRoots(roots, base = REPO, { required = [] } = {}) {
  const report = { roots: [], scanned: 0, findings: [] };
  const show = (p) => relative(base, p).split(sep).join("/") || ".";
  const finding = (p, kind, literal) => report.findings.push({ file: show(p), line: 0, col: 0, kind, literal });

  // Two spellings of one root, or a root inside another, would count a file twice.
  const resolved = roots.map((r) => ({ r, abs: resolve(base, r) }));
  for (let i = 0; i < resolved.length; i++) {
    for (let j = 0; j < resolved.length; j++) {
      if (i === j) continue;
      const a = resolved[i].abs.toLowerCase();
      const b = resolved[j].abs.toLowerCase();
      if (a === b) throw new Error(`--root ${resolved[i].r} and --root ${resolved[j].r} are the same directory`);
      if (b.startsWith(a + sep.toLowerCase()) || b.startsWith(a + "/")) throw new Error(`--root ${resolved[j].r} is inside --root ${resolved[i].r}; a file would be counted twice`);
    }
  }

  const scanFile = (path) => {
    report.scanned++;
    const buf = readFileSync(path);
    if (buf.includes(0)) { finding(path, "binary", "file carries a NUL byte and cannot be scanned"); return; }
    report.findings.push(...scanText(buf.toString("utf8"), show(path)));
  };
  const walk = (dir, counter) => {
    const entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const e of entries) {
      const p = join(dir, e.name);
      const st = lstatSync(p);
      if (st.isSymbolicLink()) finding(p, "symlink", "not followed and not scanned -- a source under this root is a real file");
      else if (st.isDirectory()) walk(p, counter);
      else if (st.isFile()) { counter.files++; scanFile(p); }
      else finding(p, "special", "neither a file nor a directory");
    }
  };
  for (const { r, abs } of resolved) {
    let st;
    try { st = lstatSync(abs); } catch (e) {
      if (e && e.code === "ENOENT") {
        report.roots.push({ root: r, state: "absent", files: 0 });
        if (required.includes(r)) finding(abs, "absent-root", "a root that must exist is absent -- renamed, moved or re-cased?");
        continue;
      }
      throw new Error(`cannot read root ${r}: ${e.message}`);
    }
    if (!exactCase(abs)) {
      finding(abs, "root-case", `the root is spelled "${basename(abs)}" but the folder on disk is not -- a case-insensitive filesystem found it, a case-sensitive one would not`);
      report.roots.push({ root: r, state: "wrong-case", files: 0 });
      continue;
    }
    const counter = { files: 0 };
    if (st.isSymbolicLink()) {
      finding(abs, "symlink", "a root that is a symlink is not followed");
      report.roots.push({ root: r, state: "symlink", files: 0 });
    } else if (st.isDirectory()) {
      walk(abs, counter);
      report.roots.push({ root: r, state: "present", files: counter.files });
    } else if (st.isFile()) {
      counter.files++;
      scanFile(abs);
      report.roots.push({ root: r, state: "file", files: 1 });
    } else {
      finding(abs, "special", "a root that is neither a file nor a directory (a device, a pipe) is not read");
      report.roots.push({ root: r, state: "special", files: 0 });
    }
  }
  return report;
}

export function parseArgs(argv) {
  const roots = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a !== "--root") throw new Error(`unknown argument ${JSON.stringify(a)} (the only flag is --root PATH)`);
    const v = argv[i + 1];
    if (v === undefined || v.startsWith("--") || v.trim() === "") throw new Error("--root needs a path");
    if (roots.includes(v)) throw new Error(`--root ${v} given twice`);
    roots.push(v);
    i++;
  }
  // An explicit root must exist; a default one must exist only when it is required.
  return roots.length
    ? { roots, custom: true, required: roots }
    : { roots: DEFAULT_ROOTS, custom: false, required: REQUIRED_DEFAULT_ROOTS };
}

function main(argv) {
  let opts;
  try { opts = parseArgs(argv); } catch (e) { console.error(`face-colour-literal: ${e.message}`); return 2; }
  let report;
  try { report = lintRoots(opts.roots, opts.custom ? process.cwd() : REPO, { required: opts.required }); }
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
