// Every relative link in every generated wiki page must land on a real file (and, for an
// in-page anchor into index.md, on a real heading). A reference whose links go nowhere is a
// reference nobody can use, however complete its coverage gate says it is.
//
//   node tests/docs/link-check.mjs <wiki-dir>
//
// Prints "link-check: N page(s), M link(s) checked" first. Exit 0 all resolve | 1 a broken
// link (named: page -> target) | 2 usage or nothing checked. Test code: it walks freely.

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname, resolve, relative, sep } from "node:path";

const dir = process.argv[2];
if (!dir) { process.stderr.write("link-check: usage: link-check.mjs <wiki-dir>\n"); process.exitCode = 2; }
else main(dir);

/** GitHub's heading anchor: lowercase, drop punctuation except - and space, spaces to -. */
function slug(h) {
  return h.trim().toLowerCase().replace(/[^\p{L}\p{N} _-]/gu, "").replace(/ /g, "-");
}

function pages(d, out = []) {
  for (const n of readdirSync(d).sort()) {
    const p = join(d, n);
    if (statSync(p).isDirectory()) { if (n !== "_narrative") pages(p, out); }
    else if (n.endsWith(".md")) out.push(p);
  }
  return out;
}

function main(d) {
  const all = pages(d);
  const anchors = new Map();
  const anchorsOf = (file) => {
    if (!anchors.has(file)) {
      const text = existsSync(file) ? readFileSync(file, "utf8") : "";
      anchors.set(file, new Set([...text.matchAll(/^#{1,6} (.+)$/gm)].map((m) => slug(m[1]))));
    }
    return anchors.get(file);
  };
  let links = 0;
  const broken = [];
  for (const page of all) {
    const text = readFileSync(page, "utf8");
    for (const m of text.matchAll(/\]\(([^)\s]+)\)/g)) {
      const target = m[1];
      if (/^[a-z]+:/i.test(target)) continue; // http(s), mailto
      links++;
      const [path, anchor] = target.split("#");
      const file = path === "" ? page : resolve(dirname(page), decodeURIComponent(path));
      const where = relative(d, page).split(sep).join("/");
      if (!existsSync(file)) { broken.push(`${where} -> ${target} (no such file)`); continue; }
      if (anchor && file.endsWith(".md") && !anchorsOf(file).has(anchor)) broken.push(`${where} -> ${target} (no such heading)`);
    }
  }
  process.stdout.write(`link-check: ${all.length} page(s), ${links} link(s) checked\n`);
  if (all.length === 0 || links === 0) { process.stderr.write("link-check: nothing checked\n"); process.exitCode = 2; return; }
  for (const b of broken) process.stdout.write(`BROKEN ${b}\n`);
  process.exitCode = broken.length ? 1 : 0;
}
