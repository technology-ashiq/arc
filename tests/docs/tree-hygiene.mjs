// Determinism hygiene for a whole generated directory: no CR byte, no spelling of the
// checkout's own path, and -- when a banner is given -- that banner as line 1 of every .md
// outside _narrative/. Test code: it walks freely.
//
//   node tests/docs/tree-hygiene.mjs <dir> <repo-root> [--banner-prefix TEXT]
//
// Prints "tree-hygiene: checked N file(s), B with the banner" first. Exit 0 clean | 1 a
// finding (named) | 2 usage or nothing checked.

import { readFileSync, readdirSync, statSync, realpathSync } from "node:fs";
import { join, resolve, relative, sep } from "node:path";

const [dir, root, flag, prefix] = process.argv.slice(2);
if (!dir || !root || (flag !== undefined && (flag !== "--banner-prefix" || !prefix))) {
  process.stderr.write("tree-hygiene: usage: tree-hygiene.mjs <dir> <repo-root> [--banner-prefix TEXT]\n");
  process.exitCode = 2;
} else main();

function files(d, out = []) {
  for (const n of readdirSync(d).sort()) {
    const p = join(d, n);
    if (statSync(p).isDirectory()) files(p, out); else out.push(p);
  }
  return out;
}

function main() {
  const spellings = new Set();
  for (const p of [root, resolve(root), safeReal(root)]) {
    if (!p) continue;
    spellings.add(p);
    spellings.add(p.replace(/\\/g, "/"));
    spellings.add(JSON.stringify(p).slice(1, -1));
    spellings.add(p.replace(/\\/g, "/").replace(/^([A-Za-z]):\//, (_, dr) => `/${dr.toLowerCase()}/`));
  }
  const all = files(dir);
  const found = [];
  let bannered = 0;
  for (const f of all) {
    const rel = relative(dir, f).split(sep).join("/");
    const text = readFileSync(f, "utf8");
    if (text.includes("\r")) found.push(`${rel}: a CR byte`);
    for (const s of spellings) if (s.length > 3 && text.includes(s)) found.push(`${rel}: the checkout path ${JSON.stringify(s)}`);
    if (prefix && rel.endsWith(".md") && !rel.startsWith("_narrative/")) {
      if (text.split("\n", 1)[0].startsWith(prefix)) bannered++;
      else found.push(`${rel}: line 1 is not the do-not-edit banner`);
    }
  }
  process.stdout.write(`tree-hygiene: checked ${all.length} file(s), ${bannered} with the banner\n`);
  if (all.length === 0) { process.exitCode = 2; return; }
  for (const x of found) process.stdout.write(`FOUND ${x}\n`);
  process.exitCode = found.length ? 1 : 0;
}

function safeReal(p) { try { return realpathSync.native(p); } catch { return null; } }
