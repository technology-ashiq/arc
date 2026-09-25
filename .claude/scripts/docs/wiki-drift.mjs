#!/usr/bin/env node
// wiki-drift -- a hand-written narrative may only name things that exist (docs lane Phase 03,
// ADR-1507 DOC-G, REQ-05). BLOCK.
//
// Narrative under docs/wiki/_narrative/ is prose a person wrote (ADR-1505, ADR-1508). Prose rots
// in one specific, checkable way: it names an ADR, a script, a driver or a command that has since
// been renamed or deleted, and goes on saying so with the wiki's authority. This gate reads every
// narrative and fails, naming file:line and the reference, on anything that no longer resolves.
//
// What counts as a reference (a fixed grammar, deliberately narrow -- NLP is a rabbit hole):
//   ADR-NNNN / ADR NNNN              must be an ADR on this tree
//   `/name` in backticks, or /arc-x  must be a command on this tree
//   a path with a file extension, in backticks or under a known root (.claude/ products/
//   initiatives/ processes/ docs/ tests/)   must exist at that path, or be the tail of a path
//                                           a product manifest declares (`drivers/hermes.mjs`)
// A line that is an HTML comment (the stale fingerprint) is not prose and is skipped.
//
// Narratives are listed through wiki-coverage's pageTree -- the one sanctioned listing (DOC-A).
//
//   wiki-drift.mjs [--root DIR]
//   wiki-drift.mjs --mutant-selftest [--root DIR]
//
// Exit: 0 nothing dangling | 1 a dangling reference (named) | 2 usage, or the tree unreadable.

import { readFileSync, existsSync, lstatSync, realpathSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_DEFAULT = join(HERE, "..", "..", "..");
const WIKI = "docs/wiki";
const ROOTS = [".claude/", "products/", "initiatives/", "processes/", "docs/", "tests/"];
const EXT = /\.(mjs|cjs|js|sh|bash|md|json|ya?ml|bats|ts|tsx)$/;

async function load(repo) {
  const href = (rel) => pathToFileURL(join(repo, ...rel.split("/"))).href;
  return {
    fc: await import(href(".claude/scripts/core/face-coverage.mjs")),
    wb: await import(href(".claude/scripts/docs/wiki-build.mjs")),
    cov: await import(href(".claude/scripts/docs/wiki-coverage.mjs")),
  };
}

/** What a narrative may name: ADR numbers, command ids, and every path a manifest declares. */
export function context(wb, wiki, repo) {
  const adrs = new Set(wiki.entities.adrBands.flatMap((b) => b.facts.adrs.map((a) => a.number)));
  const commands = new Set(wiki.entities.commands.map((e) => e.id));
  const declared = [];
  for (const p of wiki.entities.products) {
    for (const k of ["scripts", "files", "commands", "agents"]) for (const f of p.facts[k] || []) declared.push(f);
    declared.push(p.source);
  }
  return { adrs, commands, declared, repo };
}

/** Every reference on one line of prose, as [token, kind]. */
export function referencesIn(line) {
  const refs = [];
  for (const m of line.matchAll(/\bADR[- ]?(\d{4})\b/g)) refs.push([`ADR-${m[1]}`, "adr"]);
  const ticked = [...line.matchAll(/`([^`\n]+)`/g)].map((m) => m[1].trim());
  for (const t of ticked) {
    if (/^\/[a-z][a-z0-9-]*$/.test(t)) refs.push([t, "command"]);
    else if (t.includes("/") && EXT.test(t) && !/^[a-z]+:\/\//i.test(t) && !t.includes(" ")) refs.push([t.replace(/^\.\//, ""), "path"]);
  }
  const bare = line.replace(/`[^`\n]*`/g, " ");
  for (const m of bare.matchAll(/(?:^|[\s(])(\/arc-[a-z0-9-]+)\b/g)) refs.push([m[1], "command"]);
  for (const m of bare.matchAll(/(?:^|[\s(])((?:\.claude|products|initiatives|processes|docs|tests)\/[\w./-]+)/g)) {
    const t = m[1].replace(/[.,;:]+$/, "");
    if (EXT.test(t)) refs.push([t, "path"]);
  }
  return refs;
}

/** null when the reference resolves, else the reason it does not. */
export function dangling([token, kind], ctx) {
  if (kind === "adr") return ctx.adrs.has(token.slice(4)) ? null : "no such ADR on this tree";
  if (kind === "command") return ctx.commands.has(token.slice(1)) ? null : "no such command on this tree";
  if (token.split("/").includes("..")) return "a path with .. is not a reference into this tree";
  if (ROOTS.some((r) => token.startsWith(r)) && existsSync(join(ctx.repo, ...token.split("/")))) return null;
  if (ctx.declared.some((d) => d === token || d.endsWith(`/${token}`))) return null;
  return "no such file on this tree, and no manifest declares it";
}

/** Pure over one narrative's text: [{ line, token, why }]. */
export function driftFindings(text, ctx) {
  const out = [];
  text.replace(/\r\n?/g, "\n").split("\n").forEach((line, i) => {
    if (/^\s*<!--.*-->\s*$/.test(line)) return;
    for (const ref of referencesIn(line)) {
      const why = dangling(ref, ctx);
      if (why) out.push({ line: i + 1, token: ref[0], why });
    }
  });
  return out;
}

/** One full run over a pages root; `wiki` is injectable only for the self-test. */
export async function collect({ repo, pagesAbs, label }) {
  const { fc, wb, cov } = await load(repo);
  const res = await wb.extract(repo);
  if (res.code !== 0) return { code: 2, message: `the tree could not be extracted: ${res.message}`, findings: [] };
  const ctx = context(wb, res.wiki, repo);
  let tree;
  try { tree = cov.pageTree(fc, wb, pagesAbs); }
  catch (e) { return { code: 2, message: `cannot list ${label}: ${e.message}`, findings: [] }; }
  const findings = [];
  let narratives = 0, refs = 0;
  for (const dir of Object.keys(tree.narratives).sort()) {
    for (const stem of tree.narratives[dir]) {
      const rel = `${label}/${wb.NARRATIVE_DIR}/${dir}/${stem}.md`;
      const abs = join(pagesAbs, wb.NARRATIVE_DIR, dir, `${stem}.md`);
      let text;
      try { text = readFileSync(abs, "utf8"); } catch (e) { return { code: 2, message: `cannot read ${rel}: ${e.code || e.message}`, findings: [] }; }
      narratives++;
      text.replace(/\r\n?/g, "\n").split("\n").forEach((line) => { if (!/^\s*<!--.*-->\s*$/.test(line)) refs += referencesIn(line).length; });
      for (const f of driftFindings(text, ctx)) findings.push(`[dangling] ${rel}:${f.line}: ${f.token} -- ${f.why}`);
    }
  }
  return { code: findings.length ? 1 : 0, findings, narratives, refs };
}

function report(r, out) {
  if (r.code === 2) { process.stderr.write(`wiki-drift: ${r.message}\n`); return; }
  if (r.findings.length) {
    out(`wiki-drift: ${r.findings.length} dangling reference(s) in hand-written narrative -- fix the prose (it names something that is gone), never the gate (ADR-1507)`);
    for (const f of r.findings) out(`FAIL ${f}`);
    return;
  }
  out(`wiki-drift: ${r.narratives} narrative(s), ${r.refs} reference(s) checked -- none dangling`);
}

// ---------- the mutant self-test ----------

async function selftest(repo, out) {
  const { wb } = await load(repo);
  const res = await wb.extract(repo);
  if (res.code !== 0) { out(`mutant-selftest: the real tree does not extract: ${res.message}`); return 2; }
  const E = res.wiki.entities;
  const product = E.products[0].id;
  const adr = E.adrBands[0].facts.adrs[0].number;
  const command = E.commands[0].id;
  const scratch = mkdtempSync(join(tmpdir(), "wiki-drift-"));
  let ran = 0, failedArms = 0;
  const arm = async (id, what, prose, expect) => {
    ran++;
    const pages = join(scratch, id);
    mkdirSync(join(pages, wb.NARRATIVE_DIR, "products"), { recursive: true });
    writeFileSync(join(pages, wb.NARRATIVE_DIR, "products", `${product}.md`), prose);
    const r = await collect({ repo, pagesAbs: pages, label: WIKI });
    const ok = expect(r);
    for (const f of (r.findings || []).slice(0, 5)) out(`    EXPECTED-FAIL ${f}`);
    out(`${id} ${what}: ${ok ? "PASS" : "FAILED-ARM"} (exit ${r.code})`);
    if (!ok) failedArms++;
  };
  const names = (r, t) => r.code === 1 && r.findings.some((f) => f.includes(`: ${t} -- `));
  try {
    await arm("M0", "real references only -> clean", `Decided in ADR-${adr}; run \`/${command}\`; declared in \`${E.products[0].source}\`.\n`,
      (r) => r.code === 0 && r.narratives === 1 && r.refs === 3);
    await arm("M1", "a gone ADR -> FAIL naming it", "Decided in ADR-9999.\n", (r) => names(r, "ADR-9999"));
    await arm("M2", "a ghost driver -> FAIL naming it", "Runs through `drivers/ghost.mjs`.\n", (r) => names(r, "drivers/ghost.mjs"));
    await arm("M3", "a ghost command -> FAIL naming it", "Started by `/arc-ghost`.\n", (r) => names(r, "/arc-ghost"));
  } finally {
    try { rmSync(scratch, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); }
    catch (e) { out(`mutant-selftest: WARN scratch ${scratch} was not removed (${e.code || e.message})`); }
  }
  out(`mutant-selftest: ran ${ran} of 4`);
  return failedArms === 0 && ran === 4 ? 0 : 1;
}

// ---------- CLI ----------

const FLAGS = { "--root": "value", "--mutant-selftest": "bool" };

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
  return { opts };
}

async function main(argv) {
  const lines = [];
  const out = (s) => lines.push(s);
  const { opts, error } = parseArgs(argv);
  if (error) { process.stderr.write(`wiki-drift: ${error}\n`); return 2; }
  const repo = resolve(opts["--root"] ?? REPO_DEFAULT);
  if (!existsSync(join(repo, ".claude", "scripts", "docs", "wiki-coverage.mjs"))) {
    process.stderr.write(`wiki-drift: ${repo} is not an arc tree with the docs product\n`);
    return 2;
  }
  let code;
  if (opts["--mutant-selftest"]) code = await selftest(repo, out);
  else {
    const pagesAbs = join(repo, ...WIKI.split("/"));
    try { if (existsSync(pagesAbs) && lstatSync(pagesAbs).isSymbolicLink()) { process.stderr.write(`wiki-drift: ${WIKI} is a symlink\n`); return 2; } }
    catch (e) { process.stderr.write(`wiki-drift: cannot inspect ${WIKI}: ${e.code || e.message}\n`); return 2; }
    const r = await collect({ repo, pagesAbs, label: WIKI });
    report(r, out);
    code = r.code;
  }
  return new Promise((done) => {
    process.stdout.once("error", (e) => { process.stderr.write(`wiki-drift: stdout write failed (${e.code || e.message})\n`); done(2); });
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
    process.stderr.write(`wiki-drift: ${e?.stack || e}\n`);
    process.exitCode = 2;
  });
}
