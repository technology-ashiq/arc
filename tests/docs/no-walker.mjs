// DOC-A's proof (ADR-1501): nothing under .claude/scripts/docs/ enumerates a directory.
//
// The wiki reads the tree through face-coverage.mjs's treeWorld and nothing else. A second
// walker is the "validate one read, compare another" defect this repo has fixed four times;
// this scanner is what makes a fifth one a red test instead of a review comment.
//
// Reading one NAMED file (a manifest, a PROGRESS header) is allowed. Enumerating a directory
// is not, however it is spelled: the fs call or its promise form, an alias, a computed
// property on anything bound to node:fs, face-coverage's own enumerators called on a new
// directory, or a child process that lists files for us.
//
//   node tests/docs/no-walker.mjs <dir> [--expect N]
//
// Every regular file under <dir> is scanned, recursively, whatever its extension -- a walker
// in lib/walk.mjs or in an extensionless script is still a walker. With --expect, the number
// of files scanned must equal N (the caller derives N independently, from git).
//
// Exit 0 clean | 1 a walker found (named, file:line) | 2 usage, nothing scanned, or a count
// mismatch. It prints "no-walker: scanned N file(s)" first, so a caller can assert it RAN.

import { readFileSync, readdirSync, lstatSync } from "node:fs";
import { join, relative, sep } from "node:path";

const args = process.argv.slice(2);
const dir = args[0];
let expect = null;
if (args[1] === "--expect") expect = Number(args[2]);

/** Blank comments and string contents so a sentence ABOUT readdirSync is not a call. */
function codeOnly(src) {
  let out = "", i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (c === "/" && d === "/") { while (i < n && src[i] !== "\n") { out += " "; i++; } continue; }
    if (c === "/" && d === "*") {
      out += "  "; i += 2;
      while (i < n && !(src[i] === "*" && src[i + 1] === "/")) { out += src[i] === "\n" ? "\n" : " "; i++; }
      out += "  "; i += 2; continue;
    }
    if (c === "\"" || c === "'" || c === "`") {
      out += c; i++;
      while (i < n && src[i] !== c) {
        if (src[i] === "\\") { out += "  "; i += 2; continue; }
        // A template's ${...} is CODE, not text: `${readdirSync(d)}` is a call.
        if (c === "`" && src[i] === "$" && src[i + 1] === "{") {
          let depth = 0;
          while (i < n) {
            if (src[i] === "{") depth++;
            if (src[i] === "}") { depth--; if (depth === 0) { out += "}"; i++; break; } }
            out += src[i]; i++;
          }
          continue;
        }
        out += src[i] === "\n" ? "\n" : " "; i++;
      }
      out += c; i++; continue;
    }
    out += c; i++;
  }
  return out;
}

/**
 * The sanctioned calls of a face-coverage enumerator -- the only directory listings the docs
 * lane makes, all through face's own helpers -- each bound to the ONE file allowed to make it:
 * the ADR files (wiki-build), and the pages and narratives under docs/wiki/ (wiki-coverage's
 * pageTree, the reverse direction). Each must appear EXACTLY once in its file when that file is
 * scanned, so a stale entry fails instead of silently allowing a future line.
 */
const SANCTIONED = [
  ["wiki-build.mjs", 'fc.mdStems(join(repo, "docs", "adr"))'],
  ["wiki-coverage.mjs", "fc.dirNames(pagesAbs)"],
  ["wiki-coverage.mjs", "fc.mdStems(pagesAbs)"],
  ["wiki-coverage.mjs", "fc.mdStems(join(pagesAbs, d))"],
  ["wiki-coverage.mjs", "fc.dirNames(join(pagesAbs, d))"],
  ["wiki-coverage.mjs", "fc.dirNames(narrAbs)"],
  ["wiki-coverage.mjs", "fc.mdStems(narrAbs)"],
  ["wiki-coverage.mjs", "fc.mdStems(join(narrAbs, d))"],
  ["wiki-coverage.mjs", "fc.dirNames(join(narrAbs, d))"],
];
const sanctionedHits = new Map(SANCTIONED.map(([f, c]) => [f + "\u0000" + c, 0]));

/**
 * The line holds exactly one enumerator, the file is the one the call is sanctioned in, the
 * call sits at the SAME column in the code (comments and strings blanked) as in the raw text,
 * and its receiver is exactly `fc` (not `myfc`). Allow-listed words in a comment or a string,
 * or the same call in another file, cannot launder a walker.
 */
function isSanctioned(rel, codeLine, rawLine) {
  const names = codeLine.match(/\b(dirNames|mdStems|yamlStems)\b/g) || [];
  if (names.length !== 1) return false;
  for (const [file, call] of SANCTIONED) {
    if (rel !== file) continue;
    const at = rawLine.indexOf(call);
    if (at < 0) continue;
    const name = /(dirNames|mdStems|yamlStems)/.exec(call)[1];
    const m = new RegExp(String.raw`\b${name}\b`).exec(codeLine);
    const before = at === 0 ? "" : codeLine[at - 1];
    if (m && m.index === at + call.indexOf(name) && codeLine.slice(at, at + 3) === "fc." && !/[\w$.]/.test(before)) {
      sanctionedHits.set(file + "\u0000" + call, sanctionedHits.get(file + "\u0000" + call) + 1);
      return true;
    }
  }
  return false;
}

const FS_SPEC = String.raw`["'](?:node:)?fs(?:\/promises)?["']`;

/** Names bound to the fs module (or its promises) anywhere in the RAW source. */
function fsBindings(raw) {
  const names = new Set(["fs", "fsp", "promises"]);
  const pats = [
    new RegExp(String.raw`import\s+\*\s+as\s+([A-Za-z_$][\w$]*)\s+from\s+` + FS_SPEC, "g"),
    new RegExp(String.raw`import\s+([A-Za-z_$][\w$]*)\s*(?:,\s*\{[^}]*\})?\s+from\s+` + FS_SPEC, "g"),
    new RegExp(String.raw`([A-Za-z_$][\w$]*)\s*=\s*(?:await\s+)?(?:require|import)\(\s*` + FS_SPEC + String.raw`\s*\)`, "g"),
    new RegExp(String.raw`\bpromises\s+as\s+([A-Za-z_$][\w$]*)`, "g"),
  ];
  for (const re of pats) for (const m of raw.matchAll(re)) names.add(m[1]);
  return names;
}

function scanFile(root, p, found) {
  const rel = relative(root, p).split(sep).join("/");
  const raw = readFileSync(p, "utf8");
  const code = codeOnly(raw);
  const codeLines = code.split("\n");
  const rawLines = raw.split("\n");
  const bound = [...fsBindings(raw)].map((n) => n.replace(/\$/g, "\\$"));
  const rules = [
    [/\b(readdirSync|readdir|opendirSync|opendir|globSync|glob|Dir|walk|walkSync|scandir|readdirp)\b/, "directory-enumerating name"],
    [new RegExp(String.raw`(?:^|[^\w$.])(?:${bound.join("|")})\s*(?:\?\.)?\s*\[`), "computed property access on the fs module"],
    [/\b(dirNames|mdStems|yamlStems)\b/, "a face-coverage enumerator called outside the sanctioned site"],
  ];
  codeLines.forEach((line, idx) => {
    const rawLine = rawLines[idx] ?? "";
    for (const [re, why] of rules) {
      if (!re.test(line)) continue;
      if (why.startsWith("a face-coverage enumerator") && isSanctioned(rel, line, rawLine)) continue;
      found.push(`${rel}:${idx + 1}: ${why}: ${rawLine.trim()}`);
    }
  });
  // Module specifiers are strings, so they are matched in the RAW source.
  const inlineFs = new RegExp(String.raw`(?:require|import)\(\s*` + FS_SPEC + String.raw`\s*\)\s*(?:\)\s*)?(?:\?\.)?\s*\[`);
  rawLines.forEach((line, idx) => {
    if (inlineFs.test(line)) found.push(`${rel}:${idx + 1}: computed property access on the fs module: ${line.trim()}`);
    if (/["'](?:node:)?child_process["']/.test(line)) found.push(`${rel}:${idx + 1}: child_process -- a spawned process can list files for us: ${line.trim()}`);
    if (/["'](?:node:)?worker_threads["']/.test(line)) found.push(`${rel}:${idx + 1}: worker_threads -- code outside this scan: ${line.trim()}`);
  });
}

function main(root) {
  const found = [];
  const scannedNames = new Set();
  let scanned = 0;
  const walk = (d) => {
    let entries;
    try { entries = readdirSync(d).sort(); }
    catch (e) { found.push(`${relative(root, d) || "."}: unreadable directory (${e.code || e.message})`); return; }
    for (const name of entries) {
      const p = join(d, name);
      const st = lstatSync(p);
      if (st.isSymbolicLink()) { found.push(`${relative(root, p).split(sep).join("/")}: a symlink -- its target is not scanned`); continue; }
      if (st.isDirectory()) { walk(p); continue; }
      if (!st.isFile()) continue;
      scanned++;
      scannedNames.add(relative(root, p).split(sep).join("/"));
      scanFile(root, p, found);
    }
  };
  try { lstatSync(root); } catch (e) { process.stderr.write(`no-walker: cannot read ${root}: ${e.code || e.message}\n`); process.exitCode = 2; return; }
  walk(root);
  for (const [file, call] of SANCTIONED) {
    if (!scannedNames.has(file)) continue;
    const n = sanctionedHits.get(file + "\u0000" + call);
    if (n !== 1) found.push(`${file}: the sanctioned call ${call} appears ${n} time(s), not exactly once`);
  }
  process.stdout.write(`no-walker: scanned ${scanned} file(s)\n`);
  if (scanned === 0) { process.stderr.write("no-walker: nothing scanned -- a scan of zero files proves nothing\n"); process.exitCode = 2; return; }
  if (expect !== null && scanned !== expect) { process.stderr.write(`no-walker: scanned ${scanned} but the caller expected ${expect}\n`); process.exitCode = 2; return; }
  for (const x of found) process.stdout.write(`WALKER ${x}\n`);
  process.exitCode = found.length ? 1 : 0;
}

// Run LAST: the rule tables above are module-level consts, and calling main() before them is a
// temporal-dead-zone ReferenceError.
if (!dir || (args.length > 1 && (args[1] !== "--expect" || !Number.isInteger(expect) || args.length !== 3))) {
  process.stderr.write("no-walker: usage: no-walker.mjs <dir> [--expect N]\n");
  process.exitCode = 2;
} else main(dir);
