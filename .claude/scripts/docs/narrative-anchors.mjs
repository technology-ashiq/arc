#!/usr/bin/env node
// narrative-anchors.mjs -- ADR-1513's gate (DOC-M, amends ADR-1508; face Phase 07, ADR-1347).
//
// A narrative drafted by a model ships only when (1) every factual block carries an anchor that resolves, (2) an
// independent verifier passed every block of THIS text (its receipt holds the file's sha256), and (3) the owner read
// it. This file checks (1) and (2), and counts (3). It also reports the EXPLANATION DEBT: every command, agent,
// process, gate and rule no narrative names, and every product and lane with no narrative -- a count, never a target
// (ADR-1506's posture), so a part born tomorrow shows up here the day it lands.
//
//   node .claude/scripts/docs/narrative-anchors.mjs [--root DIR] [--json]
//   node .claude/scripts/docs/narrative-anchors.mjs --selftest
//
// Exit 0 clean (warnings allowed) · 1 a FAIL finding · 2 usage or an unreadable tree.
//
// The rules live in `evaluate()`, which is pure: the CLI hands it the tree, the self-test hands it planted trees, so
// every arm FAILs from birth with its mutant (ADR-1503's rule for a gate).
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/** Where each narrative's verifier receipt lives: outside docs/wiki, which wiki-coverage owns (ADR-1503). */
export const VERIFY_DIR = "docs/narrative-verify";
/** The types a narrative must NAME to explain (ADR-1513): the features. Products and lanes are explained by a file. */
export const FEATURE_TYPES = ["commands", "agents", "processes", "gates", "rules"];
export const PAGE_TYPES = ["products", "lanes"];

/**
 * The narratives written by hand before ADR-1513 (ADR-1508's Phase 03 set), exempt from the receipt rule while their
 * text is exactly this. Any edit changes the hash and the exemption is gone; the list only ever shrinks, as each is
 * replaced by a verified page.
 * @type {Record<string, string>}
 */
export const LEGACY = Object.freeze({
  "products/engine": "6de5e5d730954293fe13ede3f120cc3d124954cccc5d21ba2bc92b877d527d76",
  "products/git": "8b811cfa1981b4616c2f1a80e00a28f5de41360234e603584947a1cc0c256a48",
  "lanes/portfolio": "edac90500abe0bcdafefcc9281254eee835c82f7ead44104b82db239ad9a8acd",
});

const MARK_SRC = /<!--\s*src:\s*([\s\S]*?)\s*-->/g;
const MARK_PLAIN = /<!--\s*plain\s*-->/;
const COMMENT = /<!--[\s\S]*?-->/g;
const FENCE = /^\s*(```|~~~)/;
const BULLET = /^\s*(?:[-*+]|\d{1,3}[.)])\s+/;
const TABLE_RULE = /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/;
/** A plain block states no fact about arc: no code span, no digit, no path or command slash, no ADR, no file name. */
const PLAIN_FACT = /`|\d|\/|\bADR\b|\.(?:mjs|js|ts|tsx|md|json|ya?ml|sh)\b/;

/** Line endings normalised: a Windows checkout (CRLF) and a CI runner (LF) must hash one text the same. */
export const sha256 = (/** @type {string} */ text) => createHash("sha256").update(String(text).replace(/\r\n/g, "\n"), "utf8").digest("hex");

/**
 * The page's blocks, numbered from 1 in reading order. Headings and fenced code are not blocks: a heading names a
 * section and the fence's text is quoted. A paragraph, a list item (with its indented continuation), a quote and a
 * table ROW are each one block; a table's header and rule are not. A block's text is its prose with every comment gone.
 * @param {string} text
 * @returns {{ n: number, kind: string, text: string, anchors: string[], plain: boolean, line: number }[]}
 */
export function blocksOf(text) {
  const lines = String(text ?? "").split(/\r?\n/);
  /** @type {{ n: number, kind: string, text: string, anchors: string[], plain: boolean, line: number }[]} */
  const out = [];
  /** @type {{ kind: string, raw: string[], line: number } | null} */
  let cur = null;
  const close = () => {
    if (!cur) return;
    const raw = cur.raw.join("\n");
    const prose = raw.replace(COMMENT, "").replace(/\s+/g, " ").trim();
    if (prose !== "") {
      const anchors = [...raw.matchAll(MARK_SRC)].flatMap((m) => String(m[1]).split(";").map((a) => a.trim()).filter(Boolean));
      out.push({ n: out.length + 1, kind: cur.kind, text: prose, anchors, plain: MARK_PLAIN.test(raw), line: cur.line });
    }
    cur = null;
  };
  let fenced = false, inComment = false;
  for (let i = 0; i < lines.length; i++) {
    const l = String(lines[i]);
    // A comment that spans lines is one marker, never prose (the fingerprint, or a src list broken over lines).
    if (inComment) { if (cur) cur.raw.push(l); if (l.includes("-->")) inComment = false; continue; }
    if (FENCE.test(l)) { close(); fenced = !fenced; continue; }
    if (fenced) continue;
    const opens = (l.match(/<!--/g) || []).length, shuts = (l.match(/-->/g) || []).length;
    if (opens > shuts) inComment = true;
    if (l.trim() === "") { close(); continue; }
    if (/^\s*#{1,6}\s/.test(l)) { close(); continue; }
    if (l.trim().startsWith("|")) {
      if (TABLE_RULE.test(l)) { cur = null; continue; }
      // The header row is the line before the rule: it names columns and is not a block.
      if (TABLE_RULE.test(String(lines[i + 1] ?? ""))) { close(); continue; }
      close();
      cur = { kind: "row", raw: [l], line: i + 1 };
      close();
      continue;
    }
    if (BULLET.test(l)) { close(); cur = { kind: "item", raw: [l], line: i + 1 }; continue; }
    if (/^\s*>/.test(l)) { if (!cur || cur.kind !== "quote") { close(); cur = { kind: "quote", raw: [], line: i + 1 }; } cur.raw.push(l); continue; }
    if (cur && cur.kind === "item" && !/^\s{2,}/.test(l) && !/^\s*<!--/.test(l)) { close(); }
    if (!cur) cur = { kind: "para", raw: [], line: i + 1 };
    cur.raw.push(l);
  }
  close();
  return out;
}

/**
 * Whether one anchor resolves. `ADR-NNNN` needs its file; `fact:<type>/<id>.<key>` needs that entity and an OWN fact
 * key (or `source`); anything else is a repo path -- relative, inside the tree, tracked -- with an optional `#symbol`
 * that must appear in the file as a word.
 * @param {string} anchor
 * @param {{ adrs: Set<string>, wiki: any, tracked: (p: string) => boolean, read: (p: string) => string }} tree
 * @returns {string} "" when it resolves, else why not
 */
export function anchorProblem(anchor, tree) {
  const a = String(anchor).trim();
  const adr = /^ADR-(\d{4})$/.exec(a);
  if (adr) return tree.adrs.has(String(adr[1])) ? "" : `no docs/adr/${adr[1]}-*.md`;
  if (a.startsWith("fact:")) {
    const m = /^fact:([a-zA-Z]+)\/(.+)\.([A-Za-z][A-Za-z0-9-]*)$/.exec(a);
    if (!m) return "not fact:<type>/<id>.<key>";
    const list = Object.prototype.hasOwnProperty.call(tree.wiki?.entities ?? {}, String(m[1])) ? tree.wiki.entities[String(m[1])] : null;
    if (!Array.isArray(list)) return `no entity type ${m[1]}`;
    const e = list.find((x) => x && x.id === m[2]);
    if (!e) return `no ${m[1]} entity ${m[2]}`;
    const key = String(m[3]);
    if (key === "source") return "";
    return e.facts && typeof e.facts === "object" && Object.prototype.hasOwnProperty.call(e.facts, key) ? "" : `${m[1]}/${m[2]} has no fact ${key}`;
  }
  const hash = a.indexOf("#");
  const path = hash < 0 ? a : a.slice(0, hash);
  const symbol = hash < 0 ? "" : a.slice(hash + 1);
  if (path === "" || path.startsWith("/") || /^[A-Za-z]:/.test(path) || path.split(/[\\/]/).includes("..") || path.includes("\\")) return "not a repo-relative path";
  if (!tree.tracked(path)) return `${path} is not a tracked file`;
  if (symbol) {
    if (!/^[A-Za-z_$][\w$.-]*$/.test(symbol)) return `#${symbol} is not a symbol name`;
    const esc = symbol.replace(/[.$]/g, (c) => `\\${c}`);
    if (!new RegExp(`(^|[^\\w$])${esc}([^\\w$]|$)`).test(tree.read(path))) return `${path} never names ${symbol}`;
  }
  return "";
}

/**
 * The explanation debt (ADR-1513): every product and lane with no narrative, and every feature no narrative names in a
 * code span (`id` or `/id`). Pure; the route and this gate call the same function, so the room and CI cannot disagree.
 * @param {any} wiki  wiki-build's extract
 * @param {Record<string, string>} narratives  "<dir>/<id>" -> text
 * @param {Record<string, string>} pageDirs  wiki-build's PAGE_DIRS
 */
export function explanationDebt(wiki, narratives, pageDirs) {
  const E = wiki && wiki.entities && typeof wiki.entities === "object" ? wiki.entities : {};
  const named = new Set();
  for (const text of Object.values(narratives)) for (const m of String(text).matchAll(/`\/?([A-Za-z0-9][A-Za-z0-9._-]*)`/g)) named.add(String(m[1]));
  /** @type {Record<string, string[]>} */
  const unexplained = Object.create(null);
  let total = 0, missing = 0;
  for (const type of [...PAGE_TYPES, ...FEATURE_TYPES]) {
    const list = Array.isArray(E[type]) ? E[type] : [];
    const dir = String(pageDirs && Object.prototype.hasOwnProperty.call(pageDirs, type) ? pageDirs[type] : type);
    const ids = list.map((e) => String(e && e.id)).filter((id) => id !== "undefined");
    const miss = PAGE_TYPES.includes(type)
      ? ids.filter((id) => !Object.prototype.hasOwnProperty.call(narratives, `${dir}/${id}`))
      : ids.filter((id) => !named.has(id));
    total += ids.length;
    missing += miss.length;
    unexplained[type] = miss.sort();
  }
  return { total, explained: total - missing, debt: missing, unexplained };
}

/**
 * The gate. Pure: every input is handed in.
 * @param {{ narratives: Record<string, string>, receipts: Record<string, unknown>, tree: Parameters<typeof anchorProblem>[1], legacy?: Record<string, string> }} io
 */
export function evaluate({ narratives, receipts, tree, legacy = LEGACY }) {
  /** @type {string[]} */ const fails = [];
  /** @type {string[]} */ const warns = [];
  let verified = 0, legacyCount = 0, awaiting = 0;
  for (const [page, text] of Object.entries(narratives).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    const hash = sha256(text);
    if (Object.prototype.hasOwnProperty.call(legacy, page) && legacy[page] === hash && !Object.prototype.hasOwnProperty.call(receipts, page)) {
      legacyCount++;
      warns.push(`[legacy] ${page} -- hand-written before ADR-1513 (ADR-1508); replace it with a verified page`);
      continue;
    }
    const blocks = blocksOf(text);
    if (blocks.length === 0) { fails.push(`[empty] ${page} -- a narrative with no block explains nothing`); continue; }
    for (const b of blocks) {
      const where = `${page}:${b.line} [${b.n}]`;
      if (b.plain && b.anchors.length) fails.push(`[marker] ${where} -- a block is plain OR anchored, never both`);
      else if (b.plain) { if (PLAIN_FACT.test(b.text)) fails.push(`[plain-fact] ${where} -- a plain block names a file, a command, an ADR or a number: anchor it`); }
      else if (!b.anchors.length) fails.push(`[unanchored] ${where} -- a factual block with no <!-- src: ... --> (or <!-- plain --> if it states no fact)`);
      for (const a of b.anchors) { const why = anchorProblem(a, tree); if (why) fails.push(`[anchor] ${where} -- ${a}: ${why}`); }
    }
    if (!Object.prototype.hasOwnProperty.call(receipts, page)) { fails.push(`[unverified] ${page} -- no receipt at ${VERIFY_DIR}/${page}.json; run narrative-verify.mjs ${page}`); continue; }
    const r = /** @type {any} */ (receipts[page]);
    const bad = receiptProblem(r, page, hash, blocks.length);
    if (bad) { fails.push(`[receipt] ${page} -- ${bad}`); continue; }
    verified++;
    if (!r.accepted || r.accepted.by !== "owner") { awaiting++; warns.push(`[awaiting-owner] ${page} -- verified; the owner has not read it yet (ADR-1513 section 3)`); }
  }
  for (const page of Object.keys(receipts).sort()) if (!Object.prototype.hasOwnProperty.call(narratives, page)) fails.push(`[orphan-receipt] ${VERIFY_DIR}/${page}.json -- no narrative it judged`);
  return { fails, warns, verified, legacy: legacyCount, awaiting, narratives: Object.keys(narratives).length };
}

/**
 * Why a receipt does not ship its page, or "" when it does: this page, this text's hash, a trial on a family other than
 * the drafter's (never Claude), one SUPPORTED verdict for every block and nothing else.
 * @param {any} r @param {string} page @param {string} hash @param {number} count
 */
export function receiptProblem(r, page, hash, count) {
  if (!r || typeof r !== "object" || Array.isArray(r)) return "not a receipt object";
  if (r.schema !== 1) return `schema ${JSON.stringify(r.schema)}, not 1`;
  if (r.page !== page) return `judged ${JSON.stringify(r.page)}, not ${page}`;
  if (r.sha256 !== hash) return "judged other text -- the narrative changed after it was verified; verify it again";
  if (typeof r.model !== "string" || r.model.trim() === "") return "names no model";
  if (/claude|anthropic|opus|sonnet|haiku|fable/i.test(r.model)) return `the verifier ${r.model} is the drafter's family (ADR-0069: agreement within one family is not evidence)`;
  if (r.model_source !== "trial" && r.model_source !== "routed") return `model_source ${JSON.stringify(r.model_source)}`;
  if (!Array.isArray(r.verdicts)) return "no verdict list";
  const seen = new Set();
  for (const v of r.verdicts) {
    if (!v || !Number.isInteger(v.block) || v.block < 1 || v.block > count) return `a verdict for block ${JSON.stringify(v && v.block)}, which the page does not have`;
    if (seen.has(v.block)) return `block ${v.block} judged twice`;
    seen.add(v.block);
    if (v.verdict !== "SUPPORTED") return `block ${v.block} is ${JSON.stringify(v.verdict)}: ${String(v.why ?? "").slice(0, 160)}`;
  }
  if (seen.size !== count) return `${count - seen.size} of ${count} blocks were never judged`;
  return "";
}

// ---------------------------------------------------------------- the tree ----------------------------------------------------------------

/** Every narrative, by NAMED directory (wiki-build's PAGE_DIRS), and every receipt. */
export function readTree(root) {
  const wbUrl = pathToFileURL(join(root, ".claude", "scripts", "docs", "wiki-build.mjs")).href;
  return import(wbUrl).then(async (wb) => {
    const res = wb.extract ? await wb.extract(root) : null;
    const wiki = res && res.wiki ? res.wiki : res;
    if (!wiki || !wiki.entities) throw new Error("wiki-build's extract returned no entities");
    /** @type {Record<string, string>} */ const narratives = Object.create(null);
    /** @type {Record<string, unknown>} */ const receipts = Object.create(null);
    for (const type of wb.RENDERED) {
      const dir = String(wb.PAGE_DIRS[type]);
      const nd = join(root, wb.WIKI_DIR, wb.NARRATIVE_DIR, dir);
      if (existsSync(nd)) for (const f of readdirSync(nd)) if (f.endsWith(".md") && statSync(join(nd, f)).isFile()) narratives[`${dir}/${f.slice(0, -3)}`] = readFileSync(join(nd, f), "utf8");
      const rd = join(root, VERIFY_DIR, dir);
      if (existsSync(rd)) for (const f of readdirSync(rd)) {
        if (!f.endsWith(".json")) continue;
        try { receipts[`${dir}/${f.slice(0, -5)}`] = JSON.parse(readFileSync(join(rd, f), "utf8")); }
        catch { receipts[`${dir}/${f.slice(0, -5)}`] = "unparseable"; }
      }
    }
    let files = null;
    try { files = new Set(execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).split("\0").filter(Boolean)); }
    catch { files = null; }
    const rootReal = realpathSync(root);
    const tracked = (/** @type {string} */ p) => {
      if (files) return files.has(p);
      const abs = resolve(root, p);
      return existsSync(abs) && statSync(abs).isFile() && realpathSync(abs).startsWith(rootReal + sep);
    };
    const read = (/** @type {string} */ p) => { try { return readFileSync(join(root, p), "utf8"); } catch { return ""; } };
    const adrs = new Set(readdirSync(join(root, "docs", "adr")).map((f) => /^(\d{4})-.*\.md$/.exec(f)).filter(Boolean).map((m) => String(/** @type {RegExpExecArray} */ (m)[1])));
    return { wb, wiki, narratives, receipts, tree: { adrs, wiki, tracked, read } };
  });
}

// ---------------------------------------------------------------- self-test ----------------------------------------------------------------

function selftest() {
  const wiki = { entities: { products: [{ id: "hq", facts: { version: "1.0.0" } }], lanes: [], commands: [{ id: "arc-x", facts: {} }], agents: [], processes: [], gates: [], rules: [] } };
  const tree = { adrs: new Set(["1513"]), wiki, tracked: (p) => p === "a/b.mjs", read: () => "export function foo() {}" };
  const good = "<!-- facts: x=1 -->\nThink of it as a front desk. <!-- plain -->\n\nIt reads `a/b.mjs`. <!-- src: a/b.mjs#foo; ADR-1513 -->\n\n| Term | Means |\n|---|---|\n| hq | the spine <!-- src: fact:products/hq.version --> |\n\n- runs `/arc-x` <!-- src: ADR-1513 -->\n";
  const n = blocksOf(good).length;
  const receipt = (text, over = {}) => ({ schema: 1, page: "products/hq", sha256: sha256(text), model: "deepseek/deepseek-v4-flash-0731", model_source: "trial", verdicts: Array.from({ length: blocksOf(text).length }, (_, i) => ({ block: i + 1, verdict: "SUPPORTED", why: "x" })), accepted: { by: "owner", on: "2026-09-27" }, ...over });
  const run = (text, rec = receipt(text), extra = {}) => evaluate({ narratives: { "products/hq": text }, receipts: rec === null ? {} : { "products/hq": rec }, tree, legacy: {}, ...extra });
  let ran = 0, failed = 0;
  const arm = (name, ok) => { ran++; if (!ok) failed++; console.log(`${ok ? "ok" : "FAIL"} ${name}`); };
  const has = (r, tag) => r.fails.some((f) => f.startsWith(tag));
  arm("clean: a plain block, an anchored paragraph, a table row and a list item pass, all four counted as blocks", n === 4 && run(good).fails.length === 0 && run(good).verified === 1);
  arm("MUTANT unanchored: a factual paragraph with no marker FAILs", has(run(good + "\nIt also writes the ledger.\n"), "[unanchored]"));
  arm("MUTANT anchor: a path that is not tracked FAILs", has(run(good.replace("a/b.mjs#foo", "a/nope.mjs")), "[anchor]"));
  arm("MUTANT anchor: a symbol the file never names FAILs", has(run(good.replace("#foo", "#bar")), "[anchor]"));
  arm("MUTANT anchor: an ADR with no file, and a fact key the entity lacks, each FAIL",
    has(run(good.replace("ADR-1513 -->\n\n|", "ADR-9999 -->\n\n|")), "[anchor]") && has(run(good.replace("hq.version", "hq.nope")), "[anchor]"));
  arm("MUTANT anchor: a path climbing out of the tree FAILs", has(run(good.replace("a/b.mjs#foo", "../x.mjs")), "[anchor]"));
  arm("MUTANT plain-fact: a plain block with a number or a code span FAILs", has(run(good.replace("a front desk.", "a front desk with 3 doors.")), "[plain-fact]") && has(run(good.replace("a front desk.", "`hq`.")), "[plain-fact]"));
  arm("MUTANT unverified: a narrative with no receipt FAILs", has(run(good, null), "[unverified]"));
  arm("MUTANT edited-after-verify: a receipt for other text FAILs", has(run(good + "\nMore. <!-- src: ADR-1513 -->\n", receipt(good)), "[receipt]"));
  arm("MUTANT verdict: one UNSUPPORTED block FAILs", has(run(good, receipt(good, { verdicts: receipt(good).verdicts.map((v, i) => (i === 1 ? { ...v, verdict: "UNSUPPORTED" } : v)) })), "[receipt]"));
  arm("MUTANT coverage: a receipt that skipped a block FAILs", has(run(good, receipt(good, { verdicts: receipt(good).verdicts.slice(1) })), "[receipt]"));
  arm("MUTANT family: a Claude-family verifier FAILs", has(run(good, receipt(good, { model: "anthropic/claude-sonnet-5" })), "[receipt]"));
  arm("MUTANT orphan: a receipt with no narrative FAILs", has(evaluate({ narratives: {}, receipts: { "products/hq": receipt(good) }, tree, legacy: {} }), "[orphan-receipt]"));
  arm("legacy: an exempt hand-written text passes as a WARN, and any edit to it FAILs",
    evaluate({ narratives: { "products/hq": "Old words." }, receipts: {}, tree, legacy: { "products/hq": sha256("Old words.") } }).fails.length === 0
    && has(evaluate({ narratives: { "products/hq": "Old words!" }, receipts: {}, tree, legacy: { "products/hq": sha256("Old words.") } }), "[unanchored]"));
  arm("awaiting: a verified page the owner has not read is counted, not failed",
    run(good, receipt(good, { accepted: null })).fails.length === 0 && run(good, receipt(good, { accepted: null })).awaiting === 1);
  const debt = explanationDebt(wiki, { "products/hq": good }, { products: "products", lanes: "lanes", commands: "commands" });
  const none = explanationDebt(wiki, {}, { products: "products" });
  arm("debt: a product with a narrative and a command named in a code span are explained; with none, both are debt",
    debt.debt === 0 && debt.total === 2 && none.debt === 2 && none.unexplained.commands.includes("arc-x"));
  arm("blocks: a fenced heading, a multi-line comment and a table rule are not blocks",
    blocksOf("A. <!-- src: x -->\n\n```\n## no\nB\n```\n\n<!-- a\nb -->\n\n| h |\n|---|\n| r <!-- src: y --> |\n").length === 2);
  console.log(`RAN: ${ran} checks, ${failed} failed`);
  return failed === 0 && ran === 17 ? 0 : 1;
}

// ---------------------------------------------------------------- CLI ----------------------------------------------------------------

async function main(argv) {
  if (argv.includes("--selftest")) return selftest();
  let root = process.cwd();
  const json = argv.includes("--json");
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--root") { root = resolve(String(argv[++i] ?? "")); continue; }
    if (a === "--json") continue;
    console.error(`narrative-anchors: unknown argument ${JSON.stringify(a)}`);
    return 2;
  }
  let t;
  try { t = await readTree(root); } catch (e) { console.error(`narrative-anchors: cannot read the tree: ${/** @type {Error} */ (e).message}`); return 2; }
  const r = evaluate({ narratives: t.narratives, receipts: t.receipts, tree: t.tree });
  const d = explanationDebt(t.wiki, t.narratives, t.wb.PAGE_DIRS);
  if (json) { process.stdout.write(`${JSON.stringify({ ...r, explanation: d }, null, 2)}\n`); return r.fails.length ? 1 : 0; }
  for (const f of r.fails) console.log(`FAIL ${f}`);
  for (const w of r.warns) console.log(`WARN ${w}`);
  console.log(`narrative-anchors: narratives=${r.narratives} verified=${r.verified} legacy=${r.legacy} awaiting-owner=${r.awaiting} fail=${r.fails.length} · explanation debt: ${d.debt} of ${d.total} (${d.explained} explained)`);
  return r.fails.length ? 1 : 0;
}

const self = realpathSync(fileURLToPath(import.meta.url));
const invoked = process.argv[1] ? (() => { try { return realpathSync(process.argv[1]); } catch { return ""; } })() : "";
if (self === invoked) main(process.argv.slice(2)).then((c) => { process.exitCode = c; });
