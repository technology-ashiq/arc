#!/usr/bin/env node
// wiki-coverage -- the docs wiki's completeness gate (docs lane Phase 01, ADR-1503 DOC-C).
//
// BOTH directions, FAIL-FROM-BIRTH:
//   entity -> page       every product, lane, process, ADR band, command, agent, rule and gate
//                        in the tree has its page under docs/wiki/                (REQ-02)
//   page -> entity       every page, every page directory and every hand-written narrative
//                        under docs/wiki/ belongs to something that exists       (REQ-03)
// No WARN-first trial: a coverage gate that only warns is a hope (the same named exception as
// face-coverage, policy-lint and jobs-lint).
//
// What exists comes from wiki-build's extract(), which reads the tree only through
// face-coverage's treeWorld (DOC-A). Where a page lives comes from wiki-build's pagePath --
// the same function the renderer will write with, so the gate and the renderer cannot disagree
// about a path. The pages that exist are listed with face-coverage's own dirNames / mdStems,
// at the sanctioned sites in pageTree() below, and nowhere else.
//
//   wiki-coverage.mjs [--root DIR] [--pages DIR]
//   wiki-coverage.mjs --mutant-selftest [--root DIR]
//
// Exit: 0 all covered | 1 a finding (each named) | 2 usage, or the tree could not be read.

import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, realpathSync, lstatSync } from "node:fs";
import { join, dirname, resolve, sep, isAbsolute } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_DEFAULT = join(HERE, "..", "..", "..");
const PAGES_DEFAULT = "docs/wiki";
const FIX = "node .claude/scripts/docs/wiki-build.mjs";

async function load(repo) {
  const href = (rel) => pathToFileURL(join(repo, ...rel.split("/"))).href;
  const fc = await import(href(".claude/scripts/core/face-coverage.mjs"));
  const wb = await import(href(".claude/scripts/docs/wiki-build.mjs"));
  return { fc, wb };
}

/**
 * What is ON DISK under the pages root: the root's directories and .md pages, each allowed
 * directory's .md stems and sub-directories, and the same for the narrative tree. This is the
 * only place the docs lane lists a directory, and it does so through face-coverage's helpers.
 */
export function pageTree(fc, wb, pagesAbs) {
  const narrAbs = join(pagesAbs, wb.NARRATIVE_DIR);
  const rootDirs = fc.dirNames(pagesAbs);
  const rootPages = fc.mdStems(pagesAbs);
  // Null-prototype: a directory named constructor or __proto__ is a name, not a key lookup.
  const pages = Object.create(null), pageSubdirs = Object.create(null);
  const links = [];
  for (const d of rootDirs) {
    if (d === wb.NARRATIVE_DIR) continue;
    if (isLink(join(pagesAbs, d))) { links.push(`${d}/`); continue; }
    pages[d] = fc.mdStems(join(pagesAbs, d));
    pageSubdirs[d] = fc.dirNames(join(pagesAbs, d));
  }
  const narrDirs = fc.dirNames(narrAbs);
  const narrRootPages = fc.mdStems(narrAbs);
  const narratives = Object.create(null), narrSubdirs = Object.create(null);
  for (const d of narrDirs) {
    if (isLink(join(narrAbs, d))) { links.push(`${wb.NARRATIVE_DIR}/${d}/`); continue; }
    narratives[d] = fc.mdStems(join(narrAbs, d));
    narrSubdirs[d] = fc.dirNames(join(narrAbs, d));
  }
  if (isLink(narrAbs)) links.push(`${wb.NARRATIVE_DIR}/`);
  return { rootDirs, rootPages, pages, pageSubdirs, narrDirs, narrRootPages, narratives, narrSubdirs, links };
}

/** A symlinked page directory would count pages that live somewhere else. */
function isLink(p) {
  try { return lstatSync(p).isSymbolicLink(); } catch { return false; }
}

/** Forward: every entity has a page. Empty inventories are findings too -- never "covered". */
export function forwardFindings(wb, wiki, tree) {
  const out = [];
  for (const key of wb.RENDERED) {
    const list = wiki.entities?.[key];
    if (!Array.isArray(list) || list.length === 0) { out.push(`[empty-inventory] ${key} -- the tree yielded no ${key}; an empty inventory is never covered`); continue; }
    const have = new Set(tree.pages[wb.PAGE_DIRS[key]] || []);
    // Two ids one case apart are two pages on Linux and ONE file on Windows and macOS.
    const folded = new Map();
    for (const e of list) {
      const k = String(e.id).toLowerCase();
      folded.set(k, [...(folded.get(k) || []), e.id]);
    }
    for (const ids of folded.values()) if (ids.length > 1) out.push(`[id-collision] ${key}: ${ids.join(", ")} -- one case apart, so one file on a case-folding disk`);
    for (const e of list) {
      const p = wb.pagePath(e);
      if (p === null) { out.push(`[bad-id] ${e.type} ${JSON.stringify(e.id)} -- this id cannot be a file name on every OS`); continue; }
      if (!have.has(e.id)) out.push(`[entity-no-page] ${e.type} ${e.id} -- expected ${p}`);
    }
  }
  return out;
}

/** Reverse: every page, page directory and narrative belongs to an entity. */
export function reverseFindings(wb, wiki, tree, label) {
  const out = [];
  const byDir = Object.create(null);
  for (const key of wb.RENDERED) byDir[wb.PAGE_DIRS[key]] = new Set((wiki.entities?.[key] || []).map((e) => e.id));
  for (const l of tree.links || []) out.push(`[page-no-entity] ${label}/${l} -- a symlink; pages are regular files under docs/wiki/`);
  const allowedRoot = new Set(wb.ROOT_PAGES);
  for (const stem of tree.rootPages) if (!allowedRoot.has(stem)) out.push(`[page-no-entity] ${label}/${stem}.md -- not a page the wiki defines`);
  for (const d of tree.rootDirs) {
    if (d === wb.NARRATIVE_DIR) continue;
    if (!byDir[d]) { out.push(`[page-no-entity] ${label}/${d}/ -- not a page directory the wiki defines`); continue; }
    for (const stem of tree.pages[d]) if (!byDir[d].has(stem)) out.push(`[page-no-entity] ${label}/${d}/${stem}.md -- nothing in the tree has id ${stem} (${d})`);
    for (const sub of tree.pageSubdirs[d]) out.push(`[page-no-entity] ${label}/${d}/${sub}/ -- page directories do not nest`);
  }
  const n = `${label}/${wb.NARRATIVE_DIR}`;
  for (const stem of tree.narrRootPages) out.push(`[narrative-no-entity] ${n}/${stem}.md -- a narrative lives in a type directory`);
  for (const d of tree.narrDirs) {
    if (!byDir[d]) { out.push(`[narrative-no-entity] ${n}/${d}/ -- not a type directory the wiki defines`); continue; }
    for (const stem of tree.narratives[d]) if (!byDir[d].has(stem)) out.push(`[narrative-no-entity] ${n}/${d}/${stem}.md -- no entity ${stem} to narrate`);
    for (const sub of tree.narrSubdirs[d]) out.push(`[narrative-no-entity] ${n}/${d}/${sub}/ -- narrative directories do not nest`);
  }
  return out;
}

/** Both directions. The self-test's always-find-nothing mutant replaces THIS function. */
export function coverageFindings(wb, wiki, tree, label) {
  return [...forwardFindings(wb, wiki, tree), ...reverseFindings(wb, wiki, tree, label)];
}

/** Count narratives that exist for real entities (the narrative-debt figure, DOC-F). */
function narrativeCount(wb, wiki, tree) {
  let n = 0;
  for (const key of wb.RENDERED) {
    const have = new Set(tree.narratives[wb.PAGE_DIRS[key]] || []);
    for (const e of wiki.entities?.[key] || []) if (have.has(e.id)) n++;
  }
  return n;
}

/**
 * One full gate run. `world` / `bands` are injectable only so the self-test can plant a
 * mutant in the TREE's inventory without editing a tree; the CLI never passes them.
 */
export async function collect({ repo, pagesAbs, label, world, bands }) {
  const { fc, wb } = await load(repo);
  const res = await wb.extract(repo, world, bands ? { bands } : {});
  if (res.code !== 0) return { code: 2, findings: [], message: `the tree could not be extracted: ${res.message}` };
  const wiki = res.wiki;
  const tree = pageTree(fc, wb, pagesAbs);
  const findings = coverageFindings(wb, wiki, tree, label);
  const entities = wb.RENDERED.reduce((n, k) => n + wiki.entities[k].length, 0);
  const pages = wb.RENDERED.reduce((n, k) => n + (tree.pages[wb.PAGE_DIRS[k]] || []).length, 0);
  const narratives = narrativeCount(wb, wiki, tree);
  return { code: findings.length ? 1 : 0, findings, entities, pages, narratives };
}

function report(r, out) {
  if (r.code === 2) { process.stderr.write(`wiki-coverage: ${r.message}\n`); return; }
  if (r.findings.length) {
    out(`wiki-coverage: ${r.findings.length} finding(s) -- a part of arc with no page, or a page with no part of arc. Regenerate with \`${FIX}\`; an orphan narrative is removed or renamed by hand (ADR-1503).`);
    for (const f of r.findings) out(`FAIL ${f}`);
    return;
  }
  out(`wiki-coverage: ${r.entities} entities, ${r.pages} pages, ${r.narratives} narratives -- all covered`);
  out(`narrative debt: ${r.entities - r.narratives} of ${r.entities} entities have no narrative`);
}

// ---------- the mutant self-test (the negative control) ----------

/**
 * Six arms, each run through collect() -- the same path the CLI takes -- against a scratch
 * pages directory written fresh from the real tree's own wiki. M0 must be covered; M1..M5 must
 * each FAIL naming exactly what was planted. A gate that has never been seen to fail proves
 * nothing, and this is the thing the day-3 kill checkpoint asks about.
 */
async function selftest(repo, out) {
  const { fc, wb } = await load(repo);
  const clean = await wb.extract(repo);
  if (clean.code !== 0) { out(`mutant-selftest: the real tree does not extract: ${clean.message}`); return 2; }
  const world = await fc.treeWorld(repo);
  const scratch = mkdtempSync(join(tmpdir(), "wiki-coverage-"));
  const label = "docs/wiki";
  let ran = 0, failedArms = 0;
  const writePages = (dir) => {
    for (const key of wb.RENDERED) for (const e of clean.wiki.entities[key]) {
      const rel = wb.pagePath(e);
      if (rel === null) continue; // a bad id is the gate's finding ([bad-id]); M0 then reports it
      const p = join(dir, ...rel.split("/"));
      mkdirSync(dirname(p), { recursive: true });
      writeFileSync(p, `# ${e.id}\n`);
    }
  };
  const arm = async (id, what, pagesDir, opts, expect) => {
    ran++;
    const r = await collect({ repo, pagesAbs: pagesDir, label, ...opts });
    const ok = expect(r);
    // Show what the gate said, capped and COUNTED -- a list cut short with no sign it was cut is
    // how a reader stops trusting the rest of the output.
    const shown = (r.findings || []).slice(0, 5);
    for (const f of shown) out(`    EXPECTED-FAIL ${f}`);
    if ((r.findings || []).length > shown.length) out(`    EXPECTED-FAIL (+${r.findings.length - shown.length} more)`);
    if (r.code === 2) out(`    (${r.message})`);
    out(`${id} ${what}: ${ok ? "PASS" : "FAILED-ARM"} (exit ${r.code})`);
    if (!ok) failedArms++;
  };
  const has = (r, ...needles) => r.code === 1 && needles.every((n) => r.findings.some((f) => f.includes(n)));
  try {
    const base = join(scratch, "m0");
    writePages(base);
    await arm("M0", "every entity paged -> covered", base, {}, (r) => r.code === 0 && r.entities > 0 && r.pages === r.entities);

    const ghosts = { ...world, products: [...world.products, { name: "zzz-ghost-product", hasFace: false }], lanes: [...world.lanes, "zzz-ghost-lane"] };
    await arm("M1", "an unknown product AND an unknown lane, no pages -> FAIL naming both", base, { world: ghosts },
      (r) => has(r, "[entity-no-page] product zzz-ghost-product", "[entity-no-page] lane zzz-ghost-lane"));

    const gone = world.products[0].name;
    const minus = { ...world, products: world.products.slice(1) };
    await arm("M2", `product ${gone} removed, its page kept -> FAIL naming the orphan`, base, { world: minus },
      (r) => has(r, `[page-no-entity] ${label}/products/${gone}.md`));

    const m3 = join(scratch, "m3");
    writePages(m3);
    mkdirSync(join(m3, wb.NARRATIVE_DIR, "lanes"), { recursive: true });
    writeFileSync(join(m3, wb.NARRATIVE_DIR, "lanes", "zzz-ghost-narrative.md"), "prose about nothing\n");
    await arm("M3", "a narrative for no entity -> FAIL naming it", m3, {},
      (r) => has(r, `[narrative-no-entity] ${label}/${wb.NARRATIVE_DIR}/lanes/zzz-ghost-narrative.md`));

    const empty = { ...world, products: [], lanes: [], processes: [], commands: [], agents: [], rules: [], gates: { names: [] } };
    await arm("M4", "the tree's inventories cut to nothing -> never covered", base, { world: empty, bands: { names: [] } },
      (r) => r.code !== 0 && r.findings.some((f) => f.startsWith("[empty-inventory]")));

    const m5 = join(scratch, "m5");
    writePages(m5);
    mkdirSync(join(m5, "zzz-widgets"), { recursive: true });
    writeFileSync(join(m5, "zzz-widgets", "w.md"), "# w\n");
    await arm("M5", "a page directory the wiki does not define -> FAIL naming it", m5, {},
      (r) => has(r, `[page-no-entity] ${label}/zzz-widgets/`));
  } finally {
    try { rmSync(scratch, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); }
    catch (e) { out(`mutant-selftest: WARN scratch ${scratch} was not removed (${e.code || e.message})`); }
  }
  out(`mutant-selftest: ran ${ran} of 6`);
  return failedArms === 0 && ran === 6 ? 0 : 1;
}

// ---------- CLI ----------

const FLAGS = { "--root": "value", "--pages": "value", "--mutant-selftest": "bool" };

function parseArgs(argv) {
  const opts = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!Object.hasOwn(FLAGS, a)) return { error: `unknown argument ${JSON.stringify(a)} (known: ${Object.keys(FLAGS).join(" ")})` };
    if (Object.hasOwn(opts, a)) return { error: `${a} given twice` };
    if (FLAGS[a] === "bool") { opts[a] = true; continue; }
    const v = argv[i + 1];
    if (v === undefined || v === "" || v.startsWith("--")) return { error: `${a} needs a value` };
    opts[a] = v;
    i++;
  }
  if (opts["--mutant-selftest"] && opts["--pages"]) return { error: "--mutant-selftest writes its own pages; --pages does not apply" };
  return { opts };
}

async function main(argv) {
  const lines = [];
  const out = (s) => lines.push(s);
  const flush = () => new Promise((done) => {
    process.stdout.once("error", (e) => { process.stderr.write(`wiki-coverage: stdout write failed (${e.code || e.message})\n`); done(2); });
    process.stdout.write(lines.length ? lines.join("\n") + "\n" : "", (e) => done(e ? 2 : 0));
  });
  const { opts, error } = parseArgs(argv);
  if (error) { process.stderr.write(`wiki-coverage: ${error}\n`); return 2; }
  const repo = resolve(opts["--root"] ?? REPO_DEFAULT);
  if (!existsSync(join(repo, ".claude", "scripts", "core", "face-coverage.mjs")) || !existsSync(join(repo, ".claude", "scripts", "docs", "wiki-build.mjs"))) {
    process.stderr.write(`wiki-coverage: ${repo} is not an arc tree with the docs product\n`);
    return 2;
  }
  let code;
  if (opts["--mutant-selftest"]) code = await selftest(repo, out);
  else {
    const raw = opts["--pages"] ?? PAGES_DEFAULT;
    const segs = raw.split(/[\\/]/).filter(Boolean);
    if (isAbsolute(raw) || /^[A-Za-z]:/.test(raw) || segs.length === 0 || segs.some((s) => s === "." || s === "..")) {
      process.stderr.write(`wiki-coverage: --pages ${JSON.stringify(raw)} must be a relative path inside the tree, with no . or .. segments\n`);
      return 2;
    }
    const rel = segs.join("/");
    const pagesAbs = resolve(repo, rel);
    if (existsSync(pagesAbs)) {
      let real;
      try { real = realpathSync.native(pagesAbs); } catch (e) { process.stderr.write(`wiki-coverage: --pages ${rel}: ${e.code || e.message}\n`); return 2; }
      const root = realpathSync.native(repo);
      if (isLink(pagesAbs) || !(real === root || real.startsWith(root + sep))) {
        process.stderr.write(`wiki-coverage: --pages ${rel} is a link or resolves outside the tree\n`);
        return 2;
      }
    }
    const r = await collect({ repo, pagesAbs, label: rel });
    report(r, out);
    code = r.code;
  }
  const w = await flush();
  return w || code;
}

function isMainModule() {
  const invoked = process.argv[1];
  if (!invoked) return false;
  const self = fileURLToPath(import.meta.url);
  // Realpath BOTH sides; and when realpath itself throws (a subst drive, a link cycle), fall back
  // to the resolved spellings rather than to "not main" -- a gate that silently does nothing
  // and exits 0 is worse than no gate.
  try { return realpathSync(invoked) === realpathSync(self); }
  catch { return resolve(invoked) === resolve(self); }
}

if (isMainModule()) {
  main(process.argv.slice(2)).then((code) => { process.exitCode = code; }, (e) => {
    process.stderr.write(`wiki-coverage: ${e?.stack || e}\n`);
    process.exitCode = 2;
  });
}
