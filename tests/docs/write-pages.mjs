// Write one stub page per entity of a tree's wiki.json into a pages dir, at the path the wiki
// itself defines (wiki-build's pagePath). Phase 01's coverage gate is proven against these
// hand-made pages before any renderer exists -- which is the point of building it first.
//
//   node tests/docs/write-pages.mjs <repo-root> <pages-dir>
//
// Prints "write-pages: wrote N page(s)" on success; exit 2 if the tree does not extract or
// nothing was written (an empty fixture is a silent pass generator).

import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { pathToFileURL } from "node:url";

const [repo, pages] = process.argv.slice(2);
if (!repo || !pages) { process.stderr.write("write-pages: usage: write-pages.mjs <repo-root> <pages-dir>\n"); process.exitCode = 2; }
else await main(repo, pages);

async function main(repo, pages) {
  const wb = await import(pathToFileURL(join(repo, ".claude", "scripts", "docs", "wiki-build.mjs")).href);
  const res = await wb.extract(repo);
  if (res.code !== 0) { process.stderr.write(`write-pages: extract failed: ${res.message}\n`); process.exitCode = 2; return; }
  let n = 0;
  for (const type of wb.RENDERED) {
    for (const e of res.wiki.entities[type]) {
      const p = join(pages, ...wb.pagePath(e).split("/"));
      mkdirSync(dirname(p), { recursive: true });
      writeFileSync(p, `# ${e.id}\n`);
      n++;
    }
  }
  process.stdout.write(`write-pages: wrote ${n} page(s)\n`);
  process.exitCode = n > 0 ? 0 : 2;
}
