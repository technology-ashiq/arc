// DOC-A's proof (ADR-1501): nothing under .claude/scripts/docs/ enumerates a directory.
//
// The wiki reads the tree through face-coverage.mjs's treeWorld and nothing else. A second
// walker is the "validate one read, compare another" defect this repo has fixed four times;
// this scanner is what makes a fifth one a red test instead of a review comment.
//
// Reading one NAMED file (a manifest, a PROGRESS header) is allowed. Enumerating a directory
// is not, however it is spelled: the call, the promise form, a destructured alias, or a
// computed property on the fs module.
//
//   node tests/docs/no-walker.mjs <dir>
//
// Exit 0 clean | 1 a walker found (named, file:line) | 2 nothing scanned or unreadable.
// It prints "no-walker: scanned N file(s)" first, so a caller can assert it RAN.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const dir = process.argv[2];
if (!dir) { process.stderr.write("no-walker: usage: no-walker.mjs <dir>\n"); process.exitCode = 2; }
else main(dir);

/** Blank comments and string/template contents so a sentence ABOUT readdirSync is not a call. */
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
      // Keep the quotes, blank the body: `fs["readdir" + "Sync"]` must still be caught, and
      // it is -- by the computed-access rule below, which looks at the brackets, not the words.
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

const RULES = [
  [/\b(readdirSync|readdir|opendirSync|opendir|globSync|glob|Dir|walk|walkSync|scandir)\b/, "directory-enumerating name"],
  // A computed property on anything bound to node:fs hides the name from the rule above.
  [/\b(fs|fsp|promises)\s*\[/, "computed property access on the fs module"],
];

function main(root) {
  let files;
  try { files = readdirSync(root).filter((f) => /\.(mjs|js|cjs)$/.test(f)).sort(); }
  catch (e) { process.stderr.write(`no-walker: cannot read ${root}: ${e.code || e.message}\n`); process.exitCode = 2; return; }
  const found = [];
  let scanned = 0;
  for (const f of files) {
    const p = join(root, f);
    if (!statSync(p).isFile()) continue;
    scanned++;
    const lines = codeOnly(readFileSync(p, "utf8")).split("\n");
    lines.forEach((line, idx) => {
      for (const [re, why] of RULES) if (re.test(line)) found.push(`${f}:${idx + 1}: ${why}: ${line.trim()}`);
    });
  }
  process.stdout.write(`no-walker: scanned ${scanned} file(s)\n`);
  if (scanned === 0) { process.stderr.write("no-walker: nothing scanned -- a scan of zero files proves nothing\n"); process.exitCode = 2; return; }
  for (const x of found) process.stdout.write(`WALKER ${x}\n`);
  process.exitCode = found.length ? 1 : 0;
}
