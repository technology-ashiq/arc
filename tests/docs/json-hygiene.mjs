// Determinism hygiene for a generated file: no CR byte anywhere, and no spelling of the
// checkout's own path (POSIX, native, forward-slashed, or JSON-escaped). Either would make the
// same tree produce different bytes on different machines or CI legs.
//
//   node tests/docs/json-hygiene.mjs <file> <repo-root>
//
// Prints "json-hygiene: checked <file>" first. Exit 0 clean | 1 a finding (named) | 2 usage.

import { readFileSync, realpathSync } from "node:fs";
import { resolve } from "node:path";

const [file, root] = process.argv.slice(2);
if (!file || !root) { process.stderr.write("json-hygiene: usage: json-hygiene.mjs <file> <repo-root>\n"); process.exitCode = 2; }
else check(file, root);

function check(file, root) {
  const bytes = readFileSync(file, "utf8");
  process.stdout.write(`json-hygiene: checked ${file}\n`);
  const findings = [];
  if (bytes.includes("\r")) findings.push("a CR byte");
  const spellings = new Set();
  for (const p of [root, resolve(root), safeReal(root)]) {
    if (!p) continue;
    spellings.add(p);
    spellings.add(p.replace(/\\/g, "/"));
    spellings.add(JSON.stringify(p).slice(1, -1));
    const msys = p.replace(/\\/g, "/").replace(/^([A-Za-z]):\//, (_, d) => `/${d.toLowerCase()}/`);
    spellings.add(msys);
  }
  for (const s of spellings) if (s.length > 3 && bytes.includes(s)) findings.push(`the checkout path ${JSON.stringify(s)}`);
  for (const f of findings) process.stdout.write(`FOUND ${f}\n`);
  process.exitCode = findings.length ? 1 : 0;
}

function safeReal(p) { try { return realpathSync.native(p); } catch { return null; } }
