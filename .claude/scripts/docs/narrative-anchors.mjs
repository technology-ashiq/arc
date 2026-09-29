#!/usr/bin/env node
// narrative-anchors.mjs -- the narrative gate: ADR-1514 (DOC-N), which amends ADR-1513 (DOC-M) and ADR-1508.
//
// Hard facts live in the Reference room's generated sections, rebuilt from source (ADR-1348). A narrative explains;
// this gate keeps it honest in two ways, and counts a third:
//   (1) the drift check -- every ADR, `/arc-*` command and repo path the narrative names must exist, and any
//       `<!-- src: ... -->` anchor it still carries must resolve;
//   (2) the owner's acceptance -- `--accept <dir>/<id>` records it against the narrative's sha256, so an edit after he
//       read it shows the page as awaiting-owner again. Awaiting is counted, never failed; Phase 07 closes at 0.
//   (3) the EXPLANATION DEBT: every command, agent, process, gate and rule no narrative names, and every product and
//       lane with no narrative -- a count, never a target (ADR-1506's posture).
// The per-block verifier (narrative-verify.mjs) is advisory since ADR-1514; its receipts no longer ship a page.
//
//   node .claude/scripts/docs/narrative-anchors.mjs [--root DIR] [--json]
//   node .claude/scripts/docs/narrative-anchors.mjs [--root DIR] --accept <dir>/<id>
//   node .claude/scripts/docs/narrative-anchors.mjs --selftest
//
// Exit 0 clean (warnings allowed) · 1 a FAIL finding, or --accept refused · 2 usage or an unreadable tree.
//
// The rules live in `evaluate()`, which is pure: the CLI hands it the tree, the self-test hands it planted trees, so
// every arm FAILs from birth with its mutant (ADR-1503's rule for a gate).
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, renameSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/** Where the advisory verifier receipts live, and the owner's acceptances beside them (outside docs/wiki, ADR-1503). */
export const VERIFY_DIR = "docs/narrative-verify";
export const ACCEPT_FILE = `${VERIFY_DIR}/accepted.json`;
/** The types a narrative must NAME to explain (ADR-1513): the features. Products and lanes are explained by a file. */
export const FEATURE_TYPES = ["commands", "agents", "processes", "gates", "rules"];
export const PAGE_TYPES = ["products", "lanes"];
/** The page-shape fenced blocks (ADR-1348 section 5): prose the reader sees, so what they name is checked. */
export const SHAPE_KINDS = ["tagline", "lede", "steps", "flow", "loop", "panel", "stats", "rosetta", "gloss"];

/** Kept for narrative-verify's callers; ADR-1514 retired the exemption it served. */
export const LEGACY = Object.freeze({});

const MARK_SRC = /<!--\s*src:\s*([\s\S]*?)\s*-->/g;
const MARK_PLAIN = /<!--\s*plain\s*-->/;
const COMMENT = /<!--[\s\S]*?-->/g;
/** One fence tokenizer for the fold and the gate (attack b5f5e03 B7): CommonMark closes only on a bare fence of the opener's character and at least its length. */
const FENCE = /^\s*(`{3,}|~~~+)(.*)$/;
/** @param {string} line @returns {{ ch: string, len: number, info: string } | null} */
const fenceOf = (line) => { const m = FENCE.exec(line); return m ? { ch: String(m[1])[0], len: String(m[1]).length, info: String(m[2]).trim() } : null; };
/** @param {{ ch: string, len: number, info: string }} f @param {{ ch: string, len: number }} open */
const closesFence = (f, open) => f.ch === open.ch && f.len >= open.len && f.info === "";
const BULLET = /^\s*(?:[-*+]|\d{1,3}[.)])\s+/;
const TABLE_RULE = /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/;
/** A repo path as a narrative names one: segments, a slash, a file extension -- and no placeholder or glob. */
const PATH_NAME = /^(?:\.?[A-Za-z0-9_-][\w.-]*\/)+[\w.-]+\.(?:mjs|cjs|js|ts|tsx|md|json|ya?ml|sh|bats|css|html)$/;

/** Line endings normalised: a Windows checkout (CRLF) and a CI runner (LF) must hash one text the same. */
export const sha256 = (/** @type {string} */ text) => createHash("sha256").update(String(text).replace(/\r\n/g, "\n"), "utf8").digest("hex");

const opensComment = (/** @type {string} */ s) => (s.match(/<!--/g) || []).length > (s.match(/-->/g) || []).length;

/**
 * One structural pass over the lines, read by blocksOf AND namesOf so they cannot disagree about which line is a fence, a
 * comment or prose (attack b8707be B3: namesOf tokenised fences before comments, blocksOf after). A comment that is open
 * is handled BEFORE any fence test; a fence body never carries comments (the fold draws it verbatim).
 * `rest` is what follows the `-->` that closes a comment on that line; `opens` says a comment is still open after the line.
 * @param {string[]} lines
 * @returns {{ t: "fence" | "body" | "comment" | "prose", quoted: boolean, rest: string, opens: boolean }[]}
 */
function classify(lines) {
  /** @type {{ t: "fence" | "body" | "comment" | "prose", quoted: boolean, rest: string, opens: boolean }[]} */
  const out = [];
  /** @type {{ ch: string, len: number, info: string } | null} */ let fenced = null;
  let quoted = false, inComment = false;
  for (const raw of lines) {
    const l = String(raw);
    if (inComment) {
      const e = l.indexOf("-->");
      const rest = e < 0 ? "" : l.slice(e + 3);
      if (e >= 0) inComment = opensComment(rest);
      out.push({ t: "comment", quoted: false, rest, opens: e >= 0 && inComment });
      continue;
    }
    const f = fenceOf(l);
    if (f && !fenced) { fenced = f; quoted = !SHAPE_KINDS.includes(String(/^[A-Za-z]*/.exec(f.info)?.[0]).toLowerCase()); out.push({ t: "fence", quoted, rest: "", opens: false }); continue; }
    if (f && fenced && closesFence(f, fenced)) { fenced = null; out.push({ t: "fence", quoted, rest: "", opens: false }); quoted = false; continue; }
    if (fenced) { out.push({ t: "body", quoted, rest: "", opens: false }); continue; }
    inComment = opensComment(l);
    out.push({ t: "prose", quoted: false, rest: "", opens: inComment });
  }
  return out;
}

/**
 * The page's blocks, numbered from 1 in reading order -- the numbering narrative-verify sends its verifier. Headings and
 * fenced blocks are not blocks. A paragraph, a list item (with its indented continuation), a quote and a table ROW are
 * each one block; a table's header and rule are not. A block's text is its prose with every comment gone.
 * @param {string} text
 * @returns {{ n: number, kind: string, text: string, anchors: string[], plain: boolean, line: number, end: number }[]}
 */
export function blocksOf(text) {
  const lines = String(text ?? "").split(/\r?\n/);
  /** @type {{ n: number, kind: string, text: string, anchors: string[], plain: boolean, line: number, end: number }[]} */
  const out = [];
  /** @type {{ kind: string, raw: string[], line: number } | null} */
  let cur = null;
  const close = () => {
    if (!cur) return;
    const raw = cur.raw.join("\n");
    const prose = raw.replace(COMMENT, "").replace(/\s+/g, " ").trim();
    if (prose !== "") {
      const anchors = [...raw.matchAll(MARK_SRC)].flatMap((m) => String(m[1]).split(";").map((a) => a.trim()).filter(Boolean));
      out.push({ n: out.length + 1, kind: cur.kind, text: prose, anchors, plain: MARK_PLAIN.test(raw), line: cur.line, end: cur.line + cur.raw.length - 1 });
    }
    cur = null;
  };
  const cls = classify(lines);
  for (let i = 0; i < lines.length; i++) {
    const l = String(lines[i]);
    const c = /** @type {NonNullable<typeof cls[number]>} */ (cls[i]);
    // A comment that spans lines is one marker, never prose (the fingerprint, or a src list broken over lines).
    if (c.t === "comment") { if (cur) cur.raw.push(l); continue; }
    if (c.t === "fence") { close(); continue; }
    if (c.t === "body") continue;
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
 * What a narrative NAMES that must exist (ADR-1514 section 2): every `ADR-NNNN` in its prose, and every `/arc-*`
 * command and repo path in a code span. Prose, tables and the page-shape blocks (steps, panels, figures ...) are read;
 * a plain code fence (```bash ...) is a quote and is not, and neither is a comment.
 * @param {string} text @returns {{ adrs: string[], commands: string[], paths: string[] }}
 */
export function namesOf(text) {
  const adrs = new Set(), commands = new Set(), paths = new Set();
  const lines = String(text ?? "").split(/\r?\n/);
  const cls = classify(lines);
  for (let i = 0; i < lines.length; i++) {
    const c = /** @type {NonNullable<typeof cls[number]>} */ (cls[i]);
    if (c.t === "fence" || (c.t === "body" && c.quoted)) continue;
    let l = c.t === "comment" ? c.rest : String(lines[i]);
    // A shape-fence body is drawn verbatim by the fold, so it is read verbatim; only prose carries comments.
    if (c.t !== "body") {
      l = l.replace(COMMENT, "");
      const open = c.opens ? l.indexOf("<!--") : -1;
      if (open >= 0) l = l.slice(0, open);
    }
    for (const m of l.matchAll(/\bADR-(\d{4})\b/g)) adrs.add(String(m[1]));
    for (const m of l.matchAll(/`([^`\n]+)`/g)) {
      const s = String(m[1]).trim();
      const cmd = /^\/(arc-[a-z0-9-]+)$/.exec(s);
      if (cmd) commands.add(String(cmd[1]));
      else if (PATH_NAME.test(s)) paths.add(s);
    }
  }
  return { adrs: [...adrs].sort(), commands: [...commands].sort(), paths: [...paths].sort() };
}

/**
 * Whether one anchor resolves. `ADR-NNNN` needs its file; `fact:<type>/<id>.<key>` needs that entity and an OWN fact
 * key (or `source`); anything else is a repo path -- relative, a regular file inside the tree -- with an optional `#symbol`
 * that must appear in the file as a word.
 * @param {string} anchor
 * @param {{ adrs: Set<string>, wiki: any, tracked: (p: string) => boolean, read: (p: string) => string, isDir: (seg: string) => boolean }} tree
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
  if (path === "" || path.startsWith("/") || path.includes(":") || path.split(/[\\/]/).includes("..") || path.includes("\\")) return "not a repo-relative path";
  if (!tree.tracked(path)) return `${path} is not a regular file in the tree`;
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
 * The owner's acceptances, as read from ACCEPT_FILE: page -> the sha256 he read. Anything malformed is "" (unread).
 * @param {unknown} doc @returns {Record<string, string>}
 */
export function acceptedOf(doc) {
  /** @type {Record<string, string>} */
  const out = Object.create(null);
  const pages = doc && typeof doc === "object" && !Array.isArray(doc) && /** @type {any} */ (doc).schema === 1 ? /** @type {any} */ (doc).pages : null;
  if (!pages || typeof pages !== "object" || Array.isArray(pages)) return out;
  for (const [page, v] of Object.entries(pages)) {
    const ok = v && typeof v === "object" && /** @type {any} */ (v).by === "owner" && /^[0-9a-f]{64}$/.test(String(/** @type {any} */ (v).sha256));
    out[page] = ok ? String(/** @type {any} */ (v).sha256) : "";
  }
  return out;
}

/**
 * The gate. Pure: every input is handed in.
 * @param {{ narratives: Record<string, string>, accepted: Record<string, string>, tree: Parameters<typeof anchorProblem>[1] }} io
 */
export function evaluate({ narratives, accepted, tree }) {
  /** @type {string[]} */ const fails = [];
  /** @type {string[]} */ const warns = [];
  const commands = new Set((Array.isArray(tree.wiki?.entities?.commands) ? tree.wiki.entities.commands : []).map((/** @type {any} */ c) => String(c && c.id)));
  let ok = 0, awaiting = 0;
  for (const [page, text] of Object.entries(narratives).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    const blocks = blocksOf(text);
    if (blocks.length === 0 && String(text).replace(COMMENT, "").trim() === "") { fails.push(`[empty] ${page} -- a narrative with nothing in it explains nothing`); continue; }
    for (const b of blocks) for (const a of b.anchors) { const why = anchorProblem(a, tree); if (why) fails.push(`[anchor] ${page}:${b.line} -- ${a}: ${why}`); }
    const names = namesOf(text);
    for (const n of names.adrs) if (!tree.adrs.has(n)) fails.push(`[drift] ${page} -- names ADR-${n}, which has no docs/adr/${n}-*.md`);
    for (const c of names.commands) if (!commands.has(c)) fails.push(`[drift] ${page} -- names /${c}, which is no command in .claude/commands/`);
    // A path is a claim about the tree only when it starts at a real top-level directory; `lib/x.mjs` is relative to
    // something the prose names, so it is not checked (the reader, not the gate, judges it).
    for (const p of names.paths) if (tree.isDir(String(p.split("/")[0])) && !tree.tracked(p)) fails.push(`[drift] ${page} -- names ${p}, which is not a file in the tree`);
    const read = Object.prototype.hasOwnProperty.call(accepted, page) ? accepted[page] : "";
    if (read !== "" && read === sha256(text)) ok++;
    else { awaiting++; warns.push(`[awaiting-owner] ${page} -- ${read === "" ? "the owner has not read it yet" : "edited since the owner read it"} (ADR-1514 section 4)`); }
  }
  for (const page of Object.keys(accepted).sort()) if (!Object.prototype.hasOwnProperty.call(narratives, page)) fails.push(`[orphan-accept] ${ACCEPT_FILE} names ${page}, which has no narrative`);
  return { fails, warns, accepted: ok, awaiting, narratives: Object.keys(narratives).length };
}

/**
 * The acceptance file with one page added (or re-read), or why it is refused: the page must exist and pass the gate.
 * @param {unknown} doc the current ACCEPT_FILE (or null) @param {string} page @param {Record<string, string>} narratives
 * @param {string[]} fails evaluate()'s fails @param {string} on YYYY-MM-DD
 * @returns {{ doc: any, refused: string }}
 */
export function acceptEntry(doc, page, narratives, fails, on) {
  if (!Object.prototype.hasOwnProperty.call(narratives, page)) return { doc: null, refused: `no narrative ${page}` };
  const own = fails.filter((f) => f.split(" ").some((w) => w === page || w.startsWith(`${page}:`)));
  if (own.length) return { doc: null, refused: `${page} fails the gate: ${own[0]}` };
  // A page id of __proto__ is a legal own key from JSON.parse and would vanish into the prototype (attack b5f5e03 B4).
  if (doc && typeof doc === "object" && Object.prototype.hasOwnProperty.call(/** @type {any} */ (doc).pages ?? {}, "__proto__")) return { doc: null, refused: `${ACCEPT_FILE} holds a __proto__ page key; fix the file by hand` };
  const prev = doc && typeof doc === "object" && !Array.isArray(doc) && /** @type {any} */ (doc).schema === 1 && /** @type {any} */ (doc).pages && typeof /** @type {any} */ (doc).pages === "object" ? /** @type {any} */ (doc).pages : {};
  /** @type {Record<string, unknown>} */
  const pages = Object.create(null);
  for (const k of [...Object.keys(prev), page].filter((k, i, a) => a.indexOf(k) === i).sort()) pages[k] = k === page ? { by: "owner", on, sha256: sha256(String(narratives[page])) } : prev[k];
  return { doc: { schema: 1, pages }, refused: "" };
}

/**
 * Why a verifier receipt does not pass its page, or "" when it does -- narrative-verify's advisory check since ADR-1514.
 * @param {any} r @param {string} page @param {string} hash @param {number} count
 */
export function receiptProblem(r, page, hash, count) {
  if (!r || typeof r !== "object" || Array.isArray(r)) return "not a receipt object";
  if (r.schema !== 1) return `schema ${JSON.stringify(r.schema)}, not 1`;
  if (r.page !== page) return `judged ${JSON.stringify(r.page)}, not ${page}`;
  if (r.sha256 !== hash) return "judged other text -- the narrative changed after it was verified; verify it again";
  if (typeof r.model !== "string" || r.model.trim() === "") return "names no model";
  if (/claude|anthropic|opus|sonnet|haiku|fable/i.test(r.model)) return `the verifier ${r.model} is the drafter's family (ADR-0069: agreement within one family is not evidence)`;
  if (r.model_source !== "trial" && r.model_source !== "router") return `model_source ${JSON.stringify(r.model_source)}`;
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

/**
 * Every narrative, listed through wiki-coverage's pageTree -- the one sanctioned listing (DOC-A, ADR-1501) -- each one's
 * advisory receipt, and the acceptance file, all read by NAMED path. Nothing here lists a directory; the one process is a
 * single `git ls-files -z` (the tracked list the drift check is judged against, attack b8707be B5).
 * @param {string} root
 */
export async function readTree(root) {
  const href = (/** @type {string} */ p) => pathToFileURL(join(root, p)).href;
  const wb = await import(href(".claude/scripts/docs/wiki-build.mjs"));
  const fc = await import(href(".claude/scripts/core/face-coverage.mjs"));
  const cov = await import(href(".claude/scripts/docs/wiki-coverage.mjs"));
  const res = await wb.extract(root);
  if (!res || res.code !== 0 || !res.wiki || !res.wiki.entities) throw new Error(`wiki-build's extract did not complete: ${String(res && res.message || "no result")}`);
  const wiki = res.wiki;
  const rootReal = realpathSync(root);
  const pages = cov.pageTree(fc, wb, join(root, wb.WIKI_DIR));
  /** @type {Record<string, string>} */ const narratives = Object.create(null);
  /** @type {Record<string, unknown>} */ const receipts = Object.create(null);
  /** @type {string[]} */ const rejected = [];
  for (const l of pages.links || []) if (String(l).startsWith(`${wb.NARRATIVE_DIR}/`)) rejected.push(`${wb.WIKI_DIR}/${l}`);
  for (const type of wb.RENDERED) {
    const dir = String(wb.PAGE_DIRS[type]);
    for (const stem of pages.narratives[dir] || []) {
      const rel = `${wb.WIKI_DIR}/${wb.NARRATIVE_DIR}/${dir}/${stem}.md`;
      if (!regularInside(join(root, rel), rootReal)) { rejected.push(rel); continue; }
      narratives[`${dir}/${stem}`] = readFileSync(join(root, rel), "utf8");
      const rrel = `${VERIFY_DIR}/${dir}/${stem}.json`;
      if (!existsSync(join(root, rrel))) continue;
      if (!regularInside(join(root, rrel), rootReal)) { rejected.push(rrel); continue; }
      try { receipts[`${dir}/${stem}`] = JSON.parse(readFileSync(join(root, rrel), "utf8")); }
      catch { receipts[`${dir}/${stem}`] = "unparseable"; }
    }
  }
  const acc = readAccept(root, rootReal);
  if (acc.problem) rejected.push(acc.problem);
  const acceptDoc = acc.doc;
  const gitList = gitTrackedList(root);
  const adrs = new Set();
  for (const band of Array.isArray(wiki.entities.adrBands) ? wiki.entities.adrBands : []) {
    for (const a of Array.isArray(band && band.facts && band.facts.adrs) ? band.facts.adrs : []) if (a && /^\d{4}$/.test(String(a.number))) adrs.add(String(a.number));
  }
  const tracked = trackedIn(gitList, root, rootReal);
  const read = (/** @type {string} */ p) => { try { return readFileSync(join(root, p), "utf8"); } catch { return ""; } };
  const isDir = (/** @type {string} */ seg) => isTopDir(root, seg);
  return { wb, wiki, narratives, receipts, acceptDoc, acceptText: acc.text, accepted: acceptedOf(acceptDoc), rejected, tree: { adrs, wiki, tracked, read, isDir } };
}

/**
 * Why an acceptance document is not `{schema:1, pages:<plain object>}`, or "" when it is (attack b8707be B1): a document that
 * parses but is another shape is unreadable, never "empty" -- writing over it would drop every earlier acceptance.
 * @param {unknown} doc
 */
export function acceptShapeProblem(doc) {
  if (!doc || typeof doc !== "object" || Array.isArray(doc)) return "not a JSON object";
  const d = /** @type {any} */ (doc);
  if (d.schema !== 1) return `schema ${JSON.stringify(d.schema)}, not 1`;
  if (!d.pages || typeof d.pages !== "object" || Array.isArray(d.pages)) return "pages is not an object";
  return "";
}

/**
 * The acceptance file, read ONCE: its text (the stale-write baseline, attack b8707be B2 -- never re-read to get one), the
 * parsed document, and why it is unusable. Only a MISSING file is empty; a link, a directory, bad JSON or the wrong shape is a problem.
 * @param {string} root @param {string} rootReal
 * @returns {{ text: string | null, doc: unknown, problem: string }}
 */
export function readAccept(root, rootReal) {
  const file = join(root, ACCEPT_FILE);
  if (!existsSync(file)) return { text: null, doc: null, problem: "" };
  if (!regularInside(file, rootReal)) return { text: null, doc: null, problem: ACCEPT_FILE };
  let text = "";
  try { text = readFileSync(file, "utf8"); } catch { return { text: null, doc: null, problem: `${ACCEPT_FILE} (unreadable)` }; }
  let doc;
  try { doc = JSON.parse(text); } catch { return { text, doc: null, problem: `${ACCEPT_FILE} (unparseable)` }; }
  const why = acceptShapeProblem(doc);
  return { text, doc: why ? null : doc, problem: why ? `${ACCEPT_FILE} (wrong shape: ${why})` : "" };
}

/**
 * Every git-tracked path, from ONE bounded `git ls-files -z` (attack b8707be B5): a gitignored file that exists on this
 * box is absent from a clean checkout, so disk presence is not the CI verdict. Refuses, loudly, when git cannot answer.
 * @param {string} root @returns {Set<string>}
 */
export function gitTrackedList(root) {
  try {
    const out = execFileSync("git", ["-C", root, "ls-files", "-z"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, timeout: 30000, stdio: ["ignore", "pipe", "pipe"] });
    return new Set(out.split("\0").filter(Boolean));
  } catch (e) {
    throw new Error(`git ls-files failed in ${root} (${String(/** @type {Error} */ (e).message).split("\n")[0]}); the drift check judges paths against the git-tracked list and will not guess`);
  }
}

/** A path counts only when git tracks it AND it is a regular file on disk spelt exactly so; the list is handed in, so evaluate() stays pure. */
export function trackedIn(/** @type {Set<string>} */ list, /** @type {string} */ root, /** @type {string} */ rootReal) {
  return (/** @type {string} */ p) => list.has(p) && presentExact(root, rootReal, p);
}

/** A top-level directory, by name (never a listing): lstat, a real directory, not a symlink. The name grammar is run on the REAL tree by the self-test (attack b5f5e03 B1). */
export function isTopDir(/** @type {string} */ root, /** @type {string} */ seg) {
  if (!/^\.?[A-Za-z0-9_-][\w.-]*$/.test(seg)) return false;
  try { const st = lstatSync(join(root, seg)); return st.isDirectory() && !st.isSymbolicLink(); } catch { return false; }
}

/**
 * A regular file inside the tree whose on-disk spelling is EXACTLY `p`. It is not a git-tracked check by itself (trackedIn
 * adds the git list), so the name says what it does. A case-insensitive checkout (Windows, macOS) resolves `Docs/x.md` to
 * `docs/x.md` and would pass locally what the Linux leg fails (attack b5f5e03 B5); the native real path carries the true case.
 */
export function presentExact(/** @type {string} */ root, /** @type {string} */ rootReal, /** @type {string} */ p) {
  const abs = resolve(root, p);
  if (!regularInside(abs, rootReal)) return false;
  try {
    const base = realpathSync.native(root);
    const real = realpathSync.native(abs);
    return real.startsWith(base + sep) && real.slice(base.length + 1).split(sep).join("/") === p;
  } catch { return false; }
}

/** The acceptance file as text, or null when absent or not a regular file; read again right before a write (attack b5f5e03 B4). */
function acceptRaw(/** @type {string} */ root) {
  try { const f = join(root, ACCEPT_FILE); return lstatSync(f).isFile() ? readFileSync(f, "utf8") : null; } catch { return null; }
}

/** Why --accept must not touch ACCEPT_FILE, from readTree's `rejected`: a link, a directory or bad JSON is never read as empty (attack b5f5e03 B2, B3). */
export function acceptBlocker(/** @type {string[]} */ rejected) {
  const bad = rejected.find((r) => r === ACCEPT_FILE || r.startsWith(`${ACCEPT_FILE} `));
  return bad ? `${bad} is not a readable regular file inside the tree; fix or remove it by hand -- nothing was written` : "";
}

/**
 * Write the acceptance file, or return why not (never throws): every folder on the way must be a real directory (not a
 * link that leads outside the tree), the file must not have changed since it was read, and the write is a temp file plus
 * rename so a torn write never leaves half a file (attack b5f5e03 B2, B4).
 * @param {string} root @param {unknown} doc @param {string | null} before the text read when the run began
 */
export function writeAccept(root, doc, before) {
  const tmp = join(root, `${ACCEPT_FILE}.${process.pid}.tmp`);
  try {
    let dir = root;
    for (const seg of VERIFY_DIR.split("/")) {
      dir = join(dir, seg);
      let st = null;
      try { st = lstatSync(dir); } catch { /* not there yet */ }
      if (!st) mkdirSync(dir);
      else if (!st.isDirectory() || st.isSymbolicLink()) return `${dir} is not a plain directory inside the tree; nothing was written`;
    }
    const file = join(root, ACCEPT_FILE);
    try { const st = lstatSync(file); if (!st.isFile() || st.isSymbolicLink()) return `${ACCEPT_FILE} is not a regular file; nothing was written`; } catch { /* first acceptance */ }
    if (acceptRaw(root) !== before) return `${ACCEPT_FILE} changed while this ran (another session accepted a page?); run --accept again`;
    writeFileSync(tmp, `${JSON.stringify(doc, null, 2)}\n`, { flag: "wx" });
    renameSync(tmp, file);
    return "";
  } catch (e) {
    try { unlinkSync(tmp); } catch { /* none written */ }
    return `could not write ${ACCEPT_FILE}: ${/** @type {Error} */ (e).message}`;
  }
}

/** Why --selftest cannot combine with other arguments, or "" (attack b5f5e03 B6): a mode must not ignore what it was given. */
export function selftestArgProblem(/** @type {string[]} */ argv) {
  const extra = argv.filter((a) => a !== "--selftest");
  return argv.includes("--selftest") && extra.length ? `--selftest takes no other argument (got ${JSON.stringify(extra[0])})` : "";
}

/** A regular file (not a symlink, not a directory) whose real path is inside the tree (attack 845e0a5 B3). */
function regularInside(/** @type {string} */ abs, /** @type {string} */ rootReal) {
  try {
    const st = lstatSync(abs);
    return st.isFile() && !st.isSymbolicLink() && realpathSync(abs).startsWith(rootReal + sep);
  } catch { return false; }
}

// ---------------------------------------------------------------- self-test ----------------------------------------------------------------

function selftest() {
  const wiki = { entities: { products: [{ id: "hq", facts: { version: "1.0.0" } }], lanes: [], commands: [{ id: "arc-x", facts: {} }], agents: [], processes: [], gates: [], rules: [] } };
  const tree = { adrs: new Set(["1513"]), wiki, tracked: (/** @type {string} */ p) => p === "a/b.mjs", read: () => "export function foo() {}", isDir: (/** @type {string} */ d) => d === "a" };
  const good = "<!-- facts: x=1 -->\n# Start here\n## In plain words\nThink of hq as the front desk. It keeps `a/b.mjs` and answers to ADR-1513.\n\n```steps\nt: Ask\nplain: you type `/arc-x`\n```\n\n```bash\n# a quote, not a claim\nnode `c/zz.mjs` /arc-zz ADR-0001\n```\n\n| Term | Means |\n|---|---|\n| hq | the spine <!-- src: fact:products/hq.version --> |\n";
  const run = (/** @type {string} */ text, /** @type {Record<string, string>} */ accepted = {}) => evaluate({ narratives: { "products/hq": text }, accepted, tree });
  let ran = 0, failed = 0;
  const arm = (/** @type {string} */ name, /** @type {boolean} */ ok) => { ran++; if (!ok) failed++; console.log(`${ok ? "ok" : "FAIL"} ${name}`); };
  const has = (/** @type {{ fails: string[] }} */ r, /** @type {string} */ tag) => r.fails.some((f) => f.startsWith(tag));
  const names = namesOf(good);
  arm("clean: plain prose with no markers passes; every name it uses resolves", run(good).fails.length === 0);
  arm("names: prose, a steps block and a table are read; a plain code fence and a comment are not",
    names.adrs.join() === "1513" && names.commands.join() === "arc-x" && names.paths.join() === "a/b.mjs");
  arm("MUTANT drift: an ADR with no file FAILs", has(run(good.replace("ADR-1513", "ADR-9999")), "[drift]"));
  arm("MUTANT drift: a command that does not exist FAILs", has(run(good.replace("`/arc-x`", "`/arc-nope`")), "[drift]"));
  arm("MUTANT drift: a path that is not in the tree FAILs", has(run(good.replace("`a/b.mjs`", "`a/nope.mjs`")), "[drift]"));
  arm("MUTANT drift: a name inside a page-shape block is checked too", has(run(good.replace("you type `/arc-x`", "you type `/arc-gone`")), "[drift]"));
  arm("relative: a path that does not start at a top-level directory is not a claim about the tree", run(good.replace("`a/b.mjs`", "`lib/zz.mjs`")).fails.length === 0);
  arm("MUTANT anchor: a src marker that does not resolve FAILs", has(run(good.replace("hq.version", "hq.nope")), "[anchor]"));
  arm("MUTANT anchor: a path climbing out of the tree, or carrying a colon, FAILs",
    has(run(`${good}\nx <!-- src: ../x.mjs -->\n`), "[anchor]") && has(run(`${good}\nx <!-- src: a/b.mjs:hidden -->\n`), "[anchor]"));
  arm("MUTANT empty: a narrative with nothing in it FAILs", has(run("<!-- facts: x=1 -->\n\n"), "[empty]"));
  arm("awaiting: a page the owner has not read is counted, not failed",
    run(good).fails.length === 0 && run(good).awaiting === 1 && run(good).accepted === 0);
  arm("accepted: the owner's read against this text's hash counts as accepted",
    run(good, { "products/hq": sha256(good) }).accepted === 1 && run(good, { "products/hq": sha256(good) }).awaiting === 0);
  arm("MUTANT edited-after-accept: an acceptance for other text reads awaiting, not accepted",
    run(`${good}\nMore words.\n`, { "products/hq": sha256(good) }).accepted === 0 && run(`${good}\nMore words.\n`, { "products/hq": sha256(good) }).awaiting === 1);
  arm("MUTANT orphan: an acceptance for a page with no narrative FAILs",
    has(evaluate({ narratives: {}, accepted: { "products/gone": sha256(good) }, tree }), "[orphan-accept]"));
  const accept = acceptEntry(null, "products/hq", { "products/hq": good }, [], "2026-09-28");
  const refuse = acceptEntry(null, "products/hq", { "products/hq": good }, ["[drift] products/hq -- names x"], "2026-09-28");
  arm("accept: records the owner and the hash; refuses a page that fails the gate or does not exist",
    acceptedOf(accept.doc)["products/hq"] === sha256(good) && refuse.refused !== "" && acceptEntry(null, "products/zz", {}, [], "d").refused !== "");
  const debt = explanationDebt(wiki, { "products/hq": good }, { products: "products", lanes: "lanes", commands: "commands" });
  const none = explanationDebt(wiki, {}, { products: "products" });
  arm("debt: a product with a narrative and a command named in a code span are explained; with none, both are debt",
    debt.debt === 0 && debt.total === 2 && none.debt === 2 && none.unexplained.commands.includes("arc-x"));
  arm("blocks: a fenced heading, a multi-line comment and a table rule are not blocks",
    blocksOf("A. <!-- src: x -->\n\n```\n## no\nB\n```\n\n<!-- a\nb -->\n\n| h |\n|---|\n| r <!-- src: y --> |\n").length === 2);
  // ---- attack b5f5e03 round 1: the arms below run the REAL functions against a real temp tree, never a stub.
  const sandbox = mkdtempSync(join(tmpdir(), "narr-anchors-"));
  const outside = mkdtempSync(join(tmpdir(), "narr-outside-"));
  try {
    mkdirSync(join(sandbox, "docs"));
    writeFileSync(join(sandbox, "docs", "Real.md"), "x");
    const sbReal = realpathSync(sandbox);
    const realTree = { adrs: new Set(), wiki, tracked: (/** @type {string} */ p) => presentExact(sandbox, sbReal, p), read: () => "", isDir: (/** @type {string} */ d) => isTopDir(sandbox, d) };
    const realRun = (/** @type {string} */ text) => evaluate({ narratives: { "products/hq": text }, accepted: {}, tree: realTree });
    arm("MUTANT B1 real isDir: docs is a directory on the real check, and a planted missing docs/ path FAILs",
      isTopDir(sandbox, "docs") && !isTopDir(sandbox, "nope") && !isTopDir(sandbox, "docs/x") && has(realRun("It keeps `docs/nope-gone.md` here.\n"), "[drift]") && !has(realRun("It keeps `docs/Real.md` here.\n"), "[drift]"));
    arm("MUTANT B5 case: docs/real.md is not the on-disk docs/Real.md, so a wrong-case name FAILs even on a case-insensitive disk",
      presentExact(sandbox, sbReal, "docs/Real.md") && !presentExact(sandbox, sbReal, "docs/real.md") && has(realRun("It keeps `docs/real.md` here.\n"), "[drift]"));
    arm("MUTANT B3 unparseable: a rejected or unparseable acceptance file blocks --accept, never read as empty",
      acceptBlocker([`${ACCEPT_FILE} (unparseable)`]) !== "" && acceptBlocker([ACCEPT_FILE]) !== "" && acceptBlocker(["docs/wiki/x.md"]) === "");
    // B2: a directory where the file belongs, and a link where its folder belongs, are refused, never followed.
    mkdirSync(join(sandbox, "docs", "narrative-verify"));
    mkdirSync(join(sandbox, "docs", "narrative-verify", "accepted.json"));
    const dirRefusal = writeAccept(sandbox, { schema: 1, pages: {} }, null);
    arm("MUTANT B2 directory: accepted.json is a directory -> a plain refusal, no throw, still a directory",
      dirRefusal !== "" && lstatSync(join(sandbox, ACCEPT_FILE)).isDirectory());
    rmSync(join(sandbox, "docs", "narrative-verify"), { recursive: true });
    let linked = false;
    try { symlinkSync(outside, join(sandbox, "docs", "narrative-verify"), "junction"); linked = true; } catch { /* the arm below then FAILs, honestly */ }
    const linkRefusal = linked ? writeAccept(sandbox, { schema: 1, pages: {} }, null) : "";
    arm("MUTANT B2 link: the verify folder is a link out of the tree -> refused, and the outside folder stays empty",
      linked && linkRefusal !== "" && !existsSync(join(outside, "accepted.json")));
    if (linked) rmSync(join(sandbox, "docs", "narrative-verify"), { recursive: true, force: true });
    // B4: a clean write lands whole; a write over a file changed since it was read is refused.
    const okWrite = writeAccept(sandbox, { schema: 1, pages: { "products/a": { by: "owner" } } }, null);
    const stale = writeAccept(sandbox, { schema: 1, pages: {} }, null);
    const landed = existsSync(join(sandbox, ACCEPT_FILE)) && JSON.parse(readFileSync(join(sandbox, ACCEPT_FILE), "utf8")).pages["products/a"].by === "owner";
    arm("MUTANT B4 stale write: a clean write lands whole with no temp file; a write over a file changed since it was read is refused",
      okWrite === "" && landed && stale !== "" && !existsSync(join(sandbox, `${ACCEPT_FILE}.${process.pid}.tmp`)));
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  }
  const protoDoc = JSON.parse('{"schema":1,"pages":{"__proto__":{"by":"owner"},"products/a":{"by":"owner"}}}');
  const protoAccept = acceptEntry(protoDoc, "products/hq", { "products/hq": good }, [], "2026-09-28");
  const cleanAccept = acceptEntry({ schema: 1, pages: { "products/a": { by: "owner", on: "d", sha256: "0".repeat(64) } } }, "products/hq", { "products/hq": good }, [], "2026-09-28");
  arm("MUTANT B4 proto: a __proto__ page key in the file is refused by name, and a normal merge keeps the earlier page",
    protoAccept.refused.includes("__proto__") && cleanAccept.refused === "" && Object.keys(cleanAccept.doc.pages).join() === "products/a,products/hq");
  arm("MUTANT B6 selftest args: --selftest beside any other argument is refused by name, alone it is fine",
    selftestArgProblem(["--selftest", "--accept", "products/qa"]).includes("--accept") && selftestArgProblem(["--selftest"]) === "");
  const nested = "````bash\n```steps\n`/arc-gone`\n```\n````\n\nAfter `/arc-x`.\n";
  arm("MUTANT B7 names: a longer fence is closed only by a bare fence of its own length, so a quoted inner steps fence stays quoted",
    namesOf(nested).commands.join() === "arc-x" && namesOf("```bash\n~~~\n`/arc-gone`\n```\n").commands.length === 0);
  arm("MUTANT B7 blocks: the fold agrees -- the nested fence hides its inner line, so only the closing paragraph is a block",
    blocksOf("````\n```x\nA\n```\n````\n\nB\n").length === 1);
  // ---- attack b8707be round 2 (B4, the renderer's half, is tests/face/reference-fold.mjs: only a test may import both).
  arm("MUTANT B1 shape: null, an array, schema 2 and pages-as-array are each a wrong shape; the real shape is not",
    [null, [], { schema: 2, pages: {} }, { schema: 1, pages: [] }, { schema: 1 }].every((d) => acceptShapeProblem(d) !== "") && acceptShapeProblem({ schema: 1, pages: {} }) === "");
  arm("MUTANT B3 comment first: a fence line inside an open comment opens nothing, so the prose after `-->` is still checked, by names and by blocks",
    (() => { const t = "<!-- todo\n```bash\n-->\nSee `/arc-gone` and ADR-9999.\n"; const n = namesOf(t); return n.commands.join() === "arc-gone" && n.adrs.join() === "9999" && blocksOf(t).length === 1; })());
  const box = mkdtempSync(join(tmpdir(), "narr-r2-"));
  const bare = mkdtempSync(join(tmpdir(), "narr-nogit-"));
  const ceiling = process.env.GIT_CEILING_DIRECTORIES;
  try {
    mkdirSync(join(box, "docs", "narrative-verify"), { recursive: true });
    const boxReal = realpathSync(box);
    const accFile = join(box, ACCEPT_FILE);
    writeFileSync(accFile, "[]\n");
    const wrong = readAccept(box, boxReal);
    arm("MUTANT B1 read: a parseable acceptance file of the wrong shape is a problem that blocks --accept (never empty); a missing file is empty",
      wrong.problem.includes("wrong shape") && wrong.doc === null && acceptBlocker([wrong.problem]) !== "" && (() => { unlinkSync(accFile); const gone = readAccept(box, boxReal); return gone.problem === "" && gone.text === null; })());
    const mine = `${JSON.stringify({ schema: 1, pages: { "products/a": { by: "owner", on: "d", sha256: "0".repeat(64) } } }, null, 2)}\n`;
    writeFileSync(accFile, mine);
    const seen = readAccept(box, boxReal);
    // Session B lands between A's read and A's write: A's baseline is the text A parsed, so the write must be refused.
    const theirs = `${JSON.stringify({ schema: 1, pages: { "products/a": { by: "owner", on: "d", sha256: "0".repeat(64) }, "products/b": { by: "owner", on: "d", sha256: "1".repeat(64) } } }, null, 2)}\n`;
    writeFileSync(accFile, theirs);
    const raced = writeAccept(box, { schema: 1, pages: {} }, seen.text);
    arm("MUTANT B2 baseline: readAccept hands back the exact text it parsed, and a write against it after another session landed is refused",
      seen.text === mine && raced !== "" && readFileSync(accFile, "utf8") === theirs);
    // B5: a gitignored file that exists on this box is not in the tracked list, so it FAILs; a tracked one passes.
    execFileSync("git", ["init", "-q"], { cwd: box });
    writeFileSync(join(box, ".gitignore"), "docs/ignored.md\n");
    writeFileSync(join(box, "docs", "kept.md"), "x");
    writeFileSync(join(box, "docs", "ignored.md"), "x");
    execFileSync("git", ["add", ".gitignore", "docs/kept.md"], { cwd: box });
    const list = gitTrackedList(box);
    const gtree = { adrs: new Set(), wiki, tracked: trackedIn(list, box, boxReal), read: () => "", isDir: (/** @type {string} */ d) => isTopDir(box, d) };
    const grun = (/** @type {string} */ text) => evaluate({ narratives: { "products/hq": text }, accepted: {}, tree: gtree });
    arm("MUTANT B5 tracked: a gitignored file present on disk FAILs the drift check; a git-tracked one passes",
      existsSync(join(box, "docs", "ignored.md")) && list.has("docs/kept.md") && !list.has("docs/ignored.md")
      && has(grun("It keeps `docs/ignored.md` here.\n"), "[drift]") && !has(grun("It keeps `docs/kept.md` here.\n"), "[drift]"));
    process.env.GIT_CEILING_DIRECTORIES = dirname(bare);
    let refusal = "";
    try { gitTrackedList(bare); } catch (e) { refusal = /** @type {Error} */ (e).message; }
    arm("MUTANT B5 no git: a directory git cannot list is refused with a message naming git ls-files, never a silent pass",
      refusal.includes("git ls-files") && refusal.includes("will not guess"));
  } finally {
    if (ceiling === undefined) delete process.env.GIT_CEILING_DIRECTORIES; else process.env.GIT_CEILING_DIRECTORIES = ceiling;
    rmSync(box, { recursive: true, force: true });
    rmSync(bare, { recursive: true, force: true });
  }
  console.log(`RAN: ${ran} checks, ${failed} failed`);
  return failed === 0 && ran === 33 ? 0 : 1;
}

// ---------------------------------------------------------------- CLI ----------------------------------------------------------------

/** @param {string[]} argv */
async function main(argv) {
  const stProblem = selftestArgProblem(argv);
  if (stProblem) { console.error(`narrative-anchors: ${stProblem}`); return 2; }
  if (argv.includes("--selftest")) return selftest();
  let root = process.cwd(), rootSet = false, accept = "";
  const json = argv.includes("--json");
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--root" || a === "--accept") {
      const v = argv[i + 1];
      if (typeof v !== "string" || v === "" || v.startsWith("-")) { console.error(`narrative-anchors: ${a} needs ${a === "--root" ? "a directory" : "a page, <dir>/<id>"}`); return 2; }
      if (a === "--root") { if (rootSet) { console.error("narrative-anchors: --root given twice"); return 2; } root = resolve(v); rootSet = true; }
      else { if (accept) { console.error("narrative-anchors: --accept given twice"); return 2; } if (!/^[a-z]+\/[A-Za-z0-9][A-Za-z0-9._-]*$/.test(v)) { console.error("narrative-anchors: --accept needs <dir>/<id>"); return 2; } accept = v; }
      i++;
      continue;
    }
    if (a === "--json") continue;
    console.error(`narrative-anchors: unknown argument ${JSON.stringify(a)}`);
    return 2;
  }
  let t;
  try { t = await readTree(root); } catch (e) { console.error(`narrative-anchors: cannot read the tree: ${/** @type {Error} */ (e).message}`); return 2; }
  const r = evaluate({ narratives: t.narratives, accepted: t.accepted, tree: t.tree });
  for (const p of t.rejected) r.fails.push(`[not-a-file] ${p} -- a symlink, a directory, unparseable, wrong-shaped or out of the tree; narratives and their records are regular files inside it`);
  if (accept) {
    const blocked = acceptBlocker(t.rejected);
    if (blocked) { console.log(`REFUSED ${accept} -- ${blocked}`); return 1; }
    // The baseline is the text readTree PARSED, never a second read (attack b8707be B2): the guard must judge the read the doc came from.
    const before = t.acceptText;
    const on = new Date().toISOString().slice(0, 10);
    const { doc, refused } = acceptEntry(t.acceptDoc, accept, t.narratives, r.fails, on);
    if (refused) { console.log(`REFUSED ${accept} -- ${refused}`); return 1; }
    const failed = writeAccept(root, doc, before);
    if (failed) { console.log(`REFUSED ${accept} -- ${failed}`); return 1; }
    console.log(`accepted ${accept} for the owner on ${on} (sha256 ${sha256(String(t.narratives[accept])).slice(0, 12)}) -> ${ACCEPT_FILE}`);
    return 0;
  }
  const d = explanationDebt(t.wiki, t.narratives, t.wb.PAGE_DIRS);
  if (json) { process.stdout.write(`${JSON.stringify({ ...r, explanation: d }, null, 2)}\n`); return r.fails.length ? 1 : 0; }
  for (const f of r.fails) console.log(`FAIL ${f}`);
  for (const w of r.warns) console.log(`WARN ${w}`);
  console.log(`narrative-anchors: narratives=${r.narratives} accepted=${r.accepted} awaiting-owner=${r.awaiting} fail=${r.fails.length} · explanation debt: ${d.debt} of ${d.total} (${d.explained} explained)`);
  return r.fails.length ? 1 : 0;
}

const self = realpathSync(fileURLToPath(import.meta.url));
const invoked = process.argv[1] ? (() => { try { return realpathSync(process.argv[1]); } catch { return ""; } })() : "";
if (self === invoked) main(process.argv.slice(2)).then((c) => { process.exitCode = c; });
