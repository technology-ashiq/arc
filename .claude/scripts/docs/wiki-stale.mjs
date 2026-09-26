#!/usr/bin/env node
// wiki-stale -- a narrative written against facts that have since moved (docs lane Phase 03,
// ADR-1507 DOC-G). WARN, exit 0: blocking on prose makes people write none.
//
// A narrative carries, as its first line, a fingerprint of the generated facts it was written
// against -- one short hash per fact key:
//
//   <!-- facts: requires=1a2b3c4d version=5e6f7a8b ... -->
//
// This script recomputes them from the tree and names every key whose hash moved, so the person
// re-reading the prose knows WHICH fact to check it against. It never rewrites a narrative
// (ADR-1505): `--print <dir>/<id>` prints the current line for the author to paste.
//
// Narratives are listed through wiki-coverage's pageTree -- the one sanctioned listing (DOC-A).
//
//   wiki-stale.mjs [--root DIR]
//   wiki-stale.mjs --print <dir>/<id> [--root DIR]     e.g. --print products/engine
//
// Exit: 0 always when the tree reads (WARN lines carry the news) | 2 usage, or unreadable.

import { readFileSync, existsSync, realpathSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_DEFAULT = join(HERE, "..", "..", "..");
const WIKI = "docs/wiki";

async function load(repo) {
  const href = (rel) => pathToFileURL(join(repo, ...rel.split("/"))).href;
  return {
    fc: await import(href(".claude/scripts/core/face-coverage.mjs")),
    wb: await import(href(".claude/scripts/docs/wiki-build.mjs")),
    cov: await import(href(".claude/scripts/docs/wiki-coverage.mjs")),
  };
}

/** key -> 8-hex hash of that fact's canonical JSON, keys in byte order. */
export function fingerprint(facts) {
  const out = {};
  for (const k of Object.keys(facts || {}).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))) {
    out[k] = createHash("sha256").update(JSON.stringify(facts[k])).digest("hex").slice(0, 8);
  }
  return out;
}

export function fingerprintLine(facts) {
  return `<!-- facts: ${Object.entries(fingerprint(facts)).map(([k, h]) => `${k}=${h}`).join(" ")} -->`;
}

/** The fingerprint on a narrative's first line, or null when there is none. */
export function readFingerprint(text) {
  const first = text.replace(/^﻿/, "").split(/\r?\n/, 1)[0];
  const m = /^<!-- facts:((?: [A-Za-z][\w-]*=[0-9a-f]{8})*) -->$/.exec(first.trim());
  if (!m) return null;
  return Object.fromEntries(m[1].trim().split(" ").filter(Boolean).map((kv) => kv.split("=")));
}

/** Keys whose hash differs, appeared or vanished; empty when the narrative is current. */
export function movedKeys(was, now) {
  const keys = new Set([...Object.keys(was), ...Object.keys(now)]);
  return [...keys].filter((k) => was[k] !== now[k]).sort();
}

function entityFor(wb, wiki, dir, id) {
  const key = Object.keys(wb.PAGE_DIRS).find((k) => wb.PAGE_DIRS[k] === dir);
  return key ? wiki.entities[key].find((e) => e.id === id) ?? null : null;
}

async function run(repo, out) {
  const { fc, wb, cov } = await load(repo);
  const res = await wb.extract(repo);
  if (res.code !== 0) { process.stderr.write(`wiki-stale: the tree could not be extracted: ${res.message}\n`); return 2; }
  const pagesAbs = join(repo, ...WIKI.split("/"));
  let tree;
  try { tree = cov.pageTree(fc, wb, pagesAbs); }
  catch (e) { process.stderr.write(`wiki-stale: cannot list ${WIKI}: ${e.message}\n`); return 2; }
  let checked = 0, stale = 0;
  for (const dir of Object.keys(tree.narratives).sort()) {
    for (const id of tree.narratives[dir]) {
      const e = entityFor(wb, res.wiki, dir, id);
      if (!e) continue; // an orphan narrative is wiki-coverage's finding, not this one's
      let text;
      try { text = readFileSync(join(pagesAbs, wb.NARRATIVE_DIR, dir, `${id}.md`), "utf8"); }
      catch (err) { process.stderr.write(`wiki-stale: cannot read ${dir}/${id}: ${err.code || err.message}\n`); return 2; }
      checked++;
      const was = readFingerprint(text);
      if (!was) { stale++; out(`WARN [no-fingerprint] ${dir}/${id} -- add this as the narrative's first line: ${fingerprintLine(e.facts)}`); continue; }
      const moved = movedKeys(was, fingerprint(e.facts));
      if (moved.length) { stale++; out(`WARN [stale] ${dir}/${id} -- its facts changed since the narrative was written: ${moved.join(", ")}. Re-read the prose against them, then refresh the first line with --print ${dir}/${id}.`); }
    }
  }
  out(`wiki-stale: ${checked} narrative(s) checked, ${stale} stale`);
  return 0;
}

async function print(repo, target, out) {
  const { wb } = await load(repo);
  const res = await wb.extract(repo);
  if (res.code !== 0) { process.stderr.write(`wiki-stale: the tree could not be extracted: ${res.message}\n`); return 2; }
  const [dir, id, ...rest] = target.split("/");
  const e = rest.length === 0 && dir && id ? entityFor(wb, res.wiki, dir, id) : null;
  if (!e) { process.stderr.write(`wiki-stale: --print ${JSON.stringify(target)} is not <dir>/<id> of an entity (dirs: ${Object.values(wb.PAGE_DIRS).join(", ")})\n`); return 2; }
  out(fingerprintLine(e.facts));
  return 0;
}

const FLAGS = { "--root": "value", "--print": "value" };

function parseArgs(argv) {
  const opts = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!Object.hasOwn(FLAGS, a)) return { error: `unknown argument ${JSON.stringify(a)} (known: ${Object.keys(FLAGS).join(" ")})` };
    if (Object.hasOwn(opts, a)) return { error: `${a} given twice` };
    const v = argv[i + 1];
    if (v === undefined || v === "" || v.startsWith("--")) return { error: `${a} needs a value` };
    opts[a] = v;
    i++;
  }
  return { opts };
}

async function main(argv) {
  const lines = [];
  const out = (s) => lines.push(s);
  const { opts, error } = parseArgs(argv);
  if (error) { process.stderr.write(`wiki-stale: ${error}\n`); return 2; }
  const repo = resolve(opts["--root"] ?? REPO_DEFAULT);
  if (!existsSync(join(repo, ".claude", "scripts", "docs", "wiki-coverage.mjs"))) {
    process.stderr.write(`wiki-stale: ${repo} is not an arc tree with the docs product\n`);
    return 2;
  }
  const code = opts["--print"] ? await print(repo, opts["--print"], out) : await run(repo, out);
  return new Promise((done) => {
    process.stdout.once("error", (e) => { process.stderr.write(`wiki-stale: stdout write failed (${e.code || e.message})\n`); done(2); });
    process.stdout.write(lines.length ? lines.join("\n") + "\n" : "", (e) => done(e ? 2 : code));
  });
}

function isMainModule() {
  const invoked = process.argv[1];
  if (!invoked) return false;
  const self = fileURLToPath(import.meta.url);
  try { return realpathSync(invoked) === realpathSync(self); }
  catch { return resolve(invoked) === resolve(self); }
}

if (isMainModule()) {
  main(process.argv.slice(2)).then((code) => { process.exitCode = code; }, (e) => {
    process.stderr.write(`wiki-stale: ${e?.stack || e}\n`);
    process.exitCode = 2;
  });
}
