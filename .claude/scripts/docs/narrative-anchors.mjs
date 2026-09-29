#!/usr/bin/env node
// narrative-anchors.mjs -- the narrative gate: ADR-1514 (DOC-N), which amends ADR-1513 (DOC-M) and ADR-1508.
//
// Hard facts live in the Reference room's generated sections, rebuilt from source (ADR-1348). A narrative explains;
// this gate keeps it honest in two ways, and counts a third:
//   (1) the drift check -- every ADR, `/arc-*` command and repo path the narrative names must exist, and any
//       `<!-- src: ... -->` anchor it still carries must resolve;
//   (2) the owner's acceptance -- `--accept <dir>/<id> --approval <ULID>` records it against the narrative's sha256, so an
//       edit after he read it shows the page as awaiting-owner again. Awaiting is counted, never failed; Phase 07 closes
//       at 0. The ULID is the owner's proof (ADR-1514 amendment 1): an approval.requested for that page and hash, decided
//       approve through arc-inbox. `--request-accept <dir>/<id>...` raises it.
//   (3) the EXPLANATION DEBT: every command, agent, process, gate and rule no narrative names, and every product and
//       lane with no narrative -- a count, never a target (ADR-1506's posture).
// The per-block verifier (narrative-verify.mjs) is advisory since ADR-1514; its receipts no longer ship a page.
//
//   node .claude/scripts/docs/narrative-anchors.mjs [--root DIR] [--json]
//   node .claude/scripts/docs/narrative-anchors.mjs [--root DIR] --request-accept <dir>/<id> [<dir>/<id> ...]
//   node .claude/scripts/docs/narrative-anchors.mjs [--root DIR] --accept <dir>/<id> --approval <ULID>
//   node .claude/scripts/docs/narrative-anchors.mjs --selftest
//
// Exit 0 clean (warnings allowed) · 1 a FAIL finding, or --accept / --request-accept refused · 2 usage or an unreadable tree.
//
// The rules live in `evaluate()`, which is pure: the CLI hands it the tree, the self-test hands it planted trees, so
// every arm FAILs from birth with its mutant (ADR-1503's rule for a gate).
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, renameSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
/** The gate string an owner-proof request carries, and the id grammar of the approval that answers it (arc-event's ULID). */
export const ACCEPT_GATE = "narrative-accept";
const ULID = /^[0-9A-HJKMNP-TV-Z]{26}$/;

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
 * The approval each acceptance names, as read from ACCEPT_FILE: page -> its ULID, or "" when the entry names none or a
 * malformed one (ADR-1514 amendment 1). Read beside acceptedOf, never inside it, so the hash check stays as it was.
 * @param {unknown} doc @returns {Record<string, string>}
 */
export function proofsOf(doc) {
  /** @type {Record<string, string>} */
  const out = Object.create(null);
  const pages = doc && typeof doc === "object" && !Array.isArray(doc) && /** @type {any} */ (doc).schema === 1 ? /** @type {any} */ (doc).pages : null;
  if (!pages || typeof pages !== "object" || Array.isArray(pages)) return out;
  for (const [page, v] of Object.entries(pages)) {
    const a = v && typeof v === "object" ? /** @type {any} */ (v).approval : undefined;
    out[page] = typeof a === "string" && ULID.test(a) ? a : "";
  }
  return out;
}

/**
 * The gate. Pure: every input is handed in. `proofs` is proofsOf(): an owner entry with no well-formed approval FAILs.
 * CI can only see that an approval is NAMED, never that it is real: the spine is gitignored and lives in the main clone, so
 * the check that the ULID is a decided approve for this page and hash runs at --accept time and nowhere else.
 * @param {{ narratives: Record<string, string>, accepted: Record<string, string>, proofs: Record<string, string>, tree: Parameters<typeof anchorProblem>[1] }} io
 */
export function evaluate({ narratives, accepted, proofs, tree }) {
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
  for (const page of Object.keys(accepted).sort()) {
    if (accepted[page] !== "" && !(Object.prototype.hasOwnProperty.call(proofs, page) && ULID.test(String(proofs[page])))) fails.push(`[no-owner-proof] ${page} -- accepted without an owner proof: ${ACCEPT_FILE} names no approval for it (--request-accept, then --accept --approval)`);
  }
  for (const page of Object.keys(accepted).sort()) if (!Object.prototype.hasOwnProperty.call(narratives, page)) fails.push(`[orphan-accept] ${ACCEPT_FILE} names ${page}, which has no narrative`);
  return { fails, warns, accepted: ok, awaiting, narratives: Object.keys(narratives).length };
}

/**
 * The acceptance file with one page added (or re-read), or why it is refused: the page must exist and pass the gate.
 * @param {unknown} doc the current ACCEPT_FILE (or null) @param {string} page @param {Record<string, string>} narratives
 * @param {string[]} fails evaluate()'s fails @param {string} on YYYY-MM-DD @param {string} approval the owner's proof, a ULID
 * @returns {{ doc: any, refused: string }}
 */
export function acceptEntry(doc, page, narratives, fails, on, approval) {
  if (!ULID.test(String(approval))) return { doc: null, refused: "an acceptance needs the ULID of the owner's approval (--approval)" };
  if (!Object.prototype.hasOwnProperty.call(narratives, page)) return { doc: null, refused: `no narrative ${page}` };
  // A missing proof is what re-stamping CURES, so it must not block the very entry that fixes it.
  const own = fails.filter((f) => !f.startsWith("[no-owner-proof]") && f.split(" ").some((w) => w === page || w.startsWith(`${page}:`)));
  if (own.length) return { doc: null, refused: `${page} fails the gate: ${own[0]}` };
  // A page id of __proto__ is a legal own key from JSON.parse and would vanish into the prototype (attack b5f5e03 B4).
  if (doc && typeof doc === "object" && Object.prototype.hasOwnProperty.call(/** @type {any} */ (doc).pages ?? {}, "__proto__")) return { doc: null, refused: `${ACCEPT_FILE} holds a __proto__ page key; fix the file by hand` };
  const prev = doc && typeof doc === "object" && !Array.isArray(doc) && /** @type {any} */ (doc).schema === 1 && /** @type {any} */ (doc).pages && typeof /** @type {any} */ (doc).pages === "object" ? /** @type {any} */ (doc).pages : {};
  /** @type {Record<string, unknown>} */
  const pages = Object.create(null);
  for (const k of [...Object.keys(prev), page].filter((k, i, a) => a.indexOf(k) === i).sort()) pages[k] = k === page ? { by: "owner", on, sha256: sha256(String(narratives[page])), approval } : prev[k];
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

// ---------------------------------------------------------------- the owner's proof (ADR-1514 amendment 1) ----------------------------------------------------------------

/**
 * The main clone, from git's common dir the way spine-io's assertNotLinkedWorktree finds it: in a linked worktree the
 * common dir's parent IS the main clone, and in the main clone itself it is the clone. "" when git cannot say.
 * @param {string} cwd
 */
export function mainCloneOf(cwd) {
  try {
    const common = execFileSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    return common ? dirname(common) : "";
  } catch { return ""; }
}

/**
 * Where the owner's spine is, and which arc-event writes to it. A linked worktree refuses the spine (WORKTREE_SPINE) and the
 * canonical spine is in the main clone, so both the read and the request go there. ARC_SPINE_ROOT, the existing TEST door,
 * names the spine instead and skips the lookup; set but empty is refused, never read as "no spine named".
 * @param {string} root the tree this ran against
 * @returns {{ spine: string, arcEvent: string, cwd: string, main: string, why: string }}
 */
export function ownerSpine(root) {
  const none = { spine: "", arcEvent: "", cwd: "", main: "", why: "" };
  if ("ARC_SPINE_ROOT" in process.env) {
    const named = String(process.env.ARC_SPINE_ROOT ?? "");
    if (named.trim() === "") return { ...none, why: "ARC_SPINE_ROOT is set but empty; unset it or name a spine" };
    return { spine: resolve(named), arcEvent: join(HERE, "..", "hq", "arc-event.mjs"), cwd: root, main: "", why: "" };
  }
  const main = mainCloneOf(root);
  if (!main) return { ...none, why: "git cannot say where the main clone is, so the owner's spine cannot be found" };
  const arcEvent = join(main, ".claude", "scripts", "hq", "arc-event.mjs");
  if (!existsSync(arcEvent)) return { ...none, why: `the main clone ${main} has no arc-event; pull it first` };
  return { spine: join(main, ".claude", "state", "hq"), arcEvent, cwd: main, main, why: "" };
}

/**
 * Every event on the spine, read-only, through the door (spine.mjs `query`). Never throws: a spine that cannot be read is a
 * reason to refuse, and the events it could not show cannot have forged an approval.
 * @param {string} spine @returns {Promise<{ events: any[], why: string }>}
 */
export async function readSpineEvents(spine) {
  if (!spine || !existsSync(join(spine, "events"))) return { events: [], why: "the owner's spine has no events folder, so no approval can be found" };
  try {
    const { query } = await import(pathToFileURL(join(HERE, "..", "hq", "spine.mjs")).href);
    const r = await query(spine, { engine: "scan" });
    return { events: r.events.map((/** @type {any} */ x) => x.event), why: "" };
  } catch (e) { return { events: [], why: `the spine could not be read (${e && /** @type {any} */ (e).code ? /** @type {any} */ (e).code : "error"})` }; }
}

/**
 * Why `approval` is not the owner's proof for this page at this text, or "" when it is: the spine must hold an
 * approval.requested for gate narrative-accept that lists the page with its CURRENT sha256, and a decision.recorded for it
 * that approves. Pure; the caller hands in the spine's events.
 * @param {any[]} events @param {unknown} approval @param {string} page @param {string} hash
 */
export function approvalProblem(events, approval, page, hash) {
  if (typeof approval !== "string" || approval === "") return "--approval <ULID> is required: the owner's approval for this page (--request-accept raises it, arc-inbox approve decides it)";
  if (!ULID.test(approval)) return `${JSON.stringify(approval.slice(0, 40))} is not an approval id (the 26-character ULID --request-accept printed)`;
  const evs = (Array.isArray(events) ? events : []).filter((e) => e && typeof e === "object");
  const req = evs.find((e) => e.id === approval && e.kind === "approval.requested");
  if (!req) {
    const other = evs.find((e) => e.id === approval);
    return other ? `${approval} is a ${String(other.kind)}, not an approval request` : `${approval} is not an approval on the owner's spine`;
  }
  const p = req.payload && typeof req.payload === "object" ? req.payload : {};
  if (p.gate !== ACCEPT_GATE) return `${approval} is an approval for ${JSON.stringify(p.gate ?? null)}, not ${ACCEPT_GATE}`;
  const named = (Array.isArray(p.pages) ? p.pages : []).filter((/** @type {any} */ x) => x && typeof x === "object" && x.page === page);
  if (!named.length) return `${approval} does not name ${page}`;
  if (!named.every((/** @type {any} */ x) => x.sha256 === hash)) return `${page} was edited after ${approval} was requested (its text no longer matches what the owner was asked to read); request a new approval`;
  const decisions = evs.filter((e) => e.kind === "decision.recorded" && e.payload && typeof e.payload === "object" && e.payload.decides === approval);
  if (!decisions.length) return `${approval} is not decided yet: the owner runs arc-inbox approve ${approval} from the main clone`;
  if (decisions.some((d) => d.payload.verdict !== "approve")) return `${approval} was rejected by the owner, not approved`;
  return "";
}

/**
 * The approval.requested a page list becomes, or why it cannot: every page must have a narrative, none twice.
 * @param {string[]} pages @param {Record<string, string>} narratives
 * @returns {{ payload: any, problem: string }}
 */
export function requestPayload(pages, narratives) {
  if (!Array.isArray(pages) || pages.length === 0) return { payload: null, problem: "--request-accept needs at least one <dir>/<id>" };
  const seen = new Set();
  for (const pg of pages) {
    if (seen.has(pg)) return { payload: null, problem: `${pg} is named twice` };
    seen.add(pg);
    if (!Object.prototype.hasOwnProperty.call(narratives, pg)) return { payload: null, problem: `no narrative ${pg}` };
  }
  const list = pages.map((page) => ({ page, sha256: sha256(String(narratives[page])) }));
  const what = `accept ${pages.length} narrative page${pages.length === 1 ? "" : "s"} as read by the owner (${pages.slice(0, 3).join(", ")}${pages.length > 3 ? ", ..." : ""})`;
  return { payload: { what, gate: ACCEPT_GATE, pages: list }, problem: "" };
}

/**
 * Raise the request through the owner's arc-event (the main clone's, run from the main clone).
 * @param {string} root @param {any} payload
 * @returns {Promise<{ id: string, main: string, why: string }>}
 */
export async function raiseRequest(root, payload) {
  const os = ownerSpine(root);
  if (os.why) return { id: "", main: "", why: os.why };
  const { emitReceipt } = await import(pathToFileURL(join(HERE, "..", "core", "plan-expect.mjs")).href);
  const r = emitReceipt(os.arcEvent, "approval.requested", payload, { cwd: os.cwd, env: { ...process.env }, timeoutMs: 60_000 });
  if (r.state !== "landed") return { id: "", main: os.main, why: `the spine ${r.state === "refused" ? "refused" : "may or may not have taken"} the request: ${r.why}` };
  if (!r.id) return { id: "", main: os.main, why: String(r.why) };
  return { id: r.id, main: os.main, why: "" };
}

/**
 * What --accept / --approval / --request-accept may not be combined with, judged BEFORE the tree is read so a refusal costs
 * nothing: a bare --accept (the agent-style call) is refused, and so is an approval that is not a ULID.
 * @param {string} accept @param {string} approval @param {string[]} requestPages
 * @returns {{ code: number, why: string }}
 */
export function acceptArgProblem(accept, approval, requestPages) {
  if (requestPages.length && (accept || approval)) return { code: 2, why: "--request-accept cannot be combined with --accept or --approval" };
  if (approval && !accept) return { code: 2, why: "--approval only goes with --accept" };
  if (accept && !approval) return { code: 1, why: "--accept needs --approval <ULID>: the owner's approval (--request-accept raises it, arc-inbox approve decides it); nothing was written" };
  if (accept && !ULID.test(approval)) return { code: 1, why: `${JSON.stringify(approval.slice(0, 40))} is not an approval id (the 26-character ULID --request-accept printed); nothing was written` };
  return { code: 0, why: "" };
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

async function selftest() {
  const wiki = { entities: { products: [{ id: "hq", facts: { version: "1.0.0" } }], lanes: [], commands: [{ id: "arc-x", facts: {} }], agents: [], processes: [], gates: [], rules: [] } };
  const tree = { adrs: new Set(["1513"]), wiki, tracked: (/** @type {string} */ p) => p === "a/b.mjs", read: () => "export function foo() {}", isDir: (/** @type {string} */ d) => d === "a" };
  const good = "<!-- facts: x=1 -->\n# Start here\n## In plain words\nThink of hq as the front desk. It keeps `a/b.mjs` and answers to ADR-1513.\n\n```steps\nt: Ask\nplain: you type `/arc-x`\n```\n\n```bash\n# a quote, not a claim\nnode `c/zz.mjs` /arc-zz ADR-0001\n```\n\n| Term | Means |\n|---|---|\n| hq | the spine <!-- src: fact:products/hq.version --> |\n";
  // The older arms judge the hash and the drift rules, so every acceptance they plant carries a well-formed proof.
  const run = (/** @type {string} */ text, /** @type {Record<string, string>} */ accepted = {}) => evaluate({ narratives: { "products/hq": text }, accepted, proofs: Object.fromEntries(Object.keys(accepted).map((k) => [k, "01ARZ3NDEKTSV4RRFFQ69G5FAV"])), tree });
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
    has(evaluate({ narratives: {}, accepted: { "products/gone": sha256(good) }, proofs: { "products/gone": "01ARZ3NDEKTSV4RRFFQ69G5FAV" }, tree }), "[orphan-accept]"));
  const accept = acceptEntry(null, "products/hq", { "products/hq": good }, [], "2026-09-28", "01ARZ3NDEKTSV4RRFFQ69G5FAV");
  const refuse = acceptEntry(null, "products/hq", { "products/hq": good }, ["[drift] products/hq -- names x"], "2026-09-28", "01ARZ3NDEKTSV4RRFFQ69G5FAV");
  arm("accept: records the owner and the hash; refuses a page that fails the gate or does not exist",
    acceptedOf(accept.doc)["products/hq"] === sha256(good) && refuse.refused !== "" && acceptEntry(null, "products/zz", {}, [], "d", "01ARZ3NDEKTSV4RRFFQ69G5FAV").refused !== "");
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
    const realRun = (/** @type {string} */ text) => evaluate({ narratives: { "products/hq": text }, accepted: {}, proofs: {}, tree: realTree });
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
  const protoAccept = acceptEntry(protoDoc, "products/hq", { "products/hq": good }, [], "2026-09-28", "01ARZ3NDEKTSV4RRFFQ69G5FAV");
  const cleanAccept = acceptEntry({ schema: 1, pages: { "products/a": { by: "owner", on: "d", sha256: "0".repeat(64) } } }, "products/hq", { "products/hq": good }, [], "2026-09-28", "01ARZ3NDEKTSV4RRFFQ69G5FAV");
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
    const grun = (/** @type {string} */ text) => evaluate({ narratives: { "products/hq": text }, accepted: {}, proofs: {}, tree: gtree });
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
  // ---- ADR-1514 amendment 1: the owner's proof. Each arm FAILs against the code before it (no proof was asked, so nothing refused).
  const U1 = "01ARZ3NDEKTSV4RRFFQ69G5FAV", U2 = "01ARZ3NDEKTSV4RRFFQ69G5FAW";
  arm("MUTANT B6 gate: an owner acceptance that names no approval, or a malformed one, FAILs by page; a well-formed ULID does not; a hand-edited file reads the same",
    (() => {
      const acc = { "products/hq": sha256(good) };
      const bare = evaluate({ narratives: { "products/hq": good }, accepted: acc, proofs: {}, tree });
      const bad = evaluate({ narratives: { "products/hq": good }, accepted: acc, proofs: { "products/hq": "not-a-ulid" }, tree });
      const fine = evaluate({ narratives: { "products/hq": good }, accepted: acc, proofs: { "products/hq": U1 }, tree });
      const edited = JSON.parse(JSON.stringify({ schema: 1, pages: { "products/hq": { by: "owner", on: "d", sha256: sha256(good) }, "products/a": { by: "owner", on: "d", sha256: "0".repeat(64), approval: "x" }, "products/b": { by: "owner", on: "d", sha256: "1".repeat(64), approval: U2 } } }));
      const pf = proofsOf(edited);
      return has(bare, "[no-owner-proof] products/hq") && bare.fails.some((f) => f.includes("without an owner proof")) && has(bad, "[no-owner-proof]") && !has(fine, "[no-owner-proof]")
        && pf["products/hq"] === "" && pf["products/a"] === "" && pf["products/b"] === U2;
    })());
  const stamped = acceptEntry({ schema: 1, pages: { "products/old": { by: "owner", on: "d", sha256: "0".repeat(64) } } }, "products/hq", { "products/hq": good }, ["[no-owner-proof] products/hq -- accepted without an owner proof: x"], "2026-09-29", U1);
  arm("MUTANT B6 record: the entry carries the approval; none or a malformed one is refused; a page failing only for a missing proof can still be re-stamped, and other entries are kept",
    stamped.refused === "" && stamped.doc.pages["products/hq"].approval === U1 && stamped.doc.pages["products/old"].sha256 === "0".repeat(64)
    && acceptEntry(null, "products/hq", { "products/hq": good }, [], "d", "").refused !== "" && acceptEntry(null, "products/hq", { "products/hq": good }, [], "d", "nope").refused !== "");
  const HG = sha256(good);
  const rq = (/** @type {string} */ id, /** @type {any} */ over = {}) => ({ id, kind: "approval.requested", payload: { what: "w", gate: ACCEPT_GATE, pages: [{ page: "products/hq", sha256: HG }], ...over } });
  const dc = (/** @type {string} */ of, /** @type {string} */ verdict) => ({ id: "01ARZ3NDEKTSV4RRFFQ69G5FB1", kind: "decision.recorded", payload: { decides: of, verdict, reason: "r" } });
  const yes = [rq(U1), dc(U1, "approve")];
  const cases = /** @type {[string, string][]} */ ([
    [approvalProblem(yes, undefined, "products/hq", HG), "required"],
    [approvalProblem(yes, "not-a-ulid", "products/hq", HG), "not an approval id"],
    [approvalProblem(yes, U2, "products/hq", HG), "not an approval on"],
    [approvalProblem([rq(U1, { gate: "concept-define" }), dc(U1, "approve")], U1, "products/hq", HG), "not narrative-accept"],
    [approvalProblem(yes, U1, "products/other", HG), "does not name"],
    [approvalProblem(yes, U1, "products/hq", sha256(`${good}\nedited\n`)), "edited after"],
    [approvalProblem([rq(U1)], U1, "products/hq", HG), "not decided yet"],
    [approvalProblem([rq(U1), dc(U1, "reject")], U1, "products/hq", HG), "rejected"],
    [approvalProblem([dc(U1, "approve")], U1, "products/hq", HG), "not an approval on"],
  ]);
  arm("MUTANT B6 refusals: no --approval, a malformed id, an unknown id, another gate, a page not in the request, an edited page, an undecided and a rejected request are each refused in their own words",
    cases.every(([why, want]) => why.includes(want)));
  const many = [{ id: U1, kind: "approval.requested", payload: { what: "w", gate: ACCEPT_GATE, pages: [{ page: "products/hq", sha256: HG }, { page: "lanes/x", sha256: "a".repeat(64) }] } }, dc(U1, "approve")];
  arm("proof: one approved request covers every page it lists at its hash, and only those",
    approvalProblem(many, U1, "products/hq", HG) === "" && approvalProblem(many, U1, "lanes/x", "a".repeat(64)) === "" && approvalProblem(many, U1, "lanes/x", "b".repeat(64)) !== "" && approvalProblem(many, U1, "lanes/y", HG) !== "");
  const spine = mkdtempSync(join(tmpdir(), "narr-spine-"));
  const priorSpine = process.env.ARC_SPINE_ROOT;
  try {
    mkdirSync(join(spine, "events"));
    process.env.ARC_SPINE_ROOT = spine;
    const inbox = (/** @type {string} */ verb, /** @type {string} */ id) => spawnSync(process.execPath, [join(HERE, "..", "hq", "arc-inbox.mjs"), verb, id, "--reason", "read it"], { encoding: "utf8", env: { ...process.env, ARC_SPINE_ROOT: spine } });
    const asked = requestPayload(["products/hq", "lanes/x"], { "products/hq": good, "lanes/x": `${good}\nlane\n` });
    const got = await raiseRequest(spine, asked.payload);
    const read0 = await readSpineEvents(spine);
    const undecided = approvalProblem(read0.events, got.id, "products/hq", HG);
    const ap = inbox("approve", got.id);
    const read1 = await readSpineEvents(spine);
    const approved = approvalProblem(read1.events, got.id, "products/hq", HG);
    const second = approvalProblem(read1.events, got.id, "lanes/x", sha256(`${good}\nlane\n`));
    const afterEdit = approvalProblem(read1.events, got.id, "products/hq", sha256(`${good}\nedited after approval\n`));
    const got2 = await raiseRequest(spine, requestPayload(["products/hq"], { "products/hq": good }).payload);
    const rj = inbox("reject", got2.id);
    const rejected = approvalProblem((await readSpineEvents(spine)).events, got2.id, "products/hq", HG);
    arm("MUTANT B6 real spine: request -> undecided refused -> arc-inbox approve -> accepted for every listed page -> edit the page -> hash mismatch refused; a rejected request stays refused",
      got.why === "" && /^[0-9A-HJKMNP-TV-Z]{26}$/.test(got.id) && undecided.includes("not decided yet") && ap.status === 0 && approved === "" && second === ""
      && afterEdit.includes("edited after") && got2.why === "" && rj.status === 0 && rejected.includes("rejected"));
    const named = ownerSpine("x").spine === resolve(spine);
    process.env.ARC_SPINE_ROOT = "";
    const emptyDoor = ownerSpine(spine).why !== "" && (await raiseRequest(spine, asked.payload)).why !== "";
    process.env.ARC_SPINE_ROOT = spine;
    arm("MUTANT B6 request: an unknown page, a repeat and an empty list are refused before anything is emitted; the test door names the spine, and an empty one is refused",
      requestPayload(["products/nope"], {}).problem !== "" && requestPayload(["products/hq", "products/hq"], { "products/hq": good }).problem !== "" && requestPayload([], {}).problem !== ""
      && asked.payload.gate === ACCEPT_GATE && asked.payload.pages.length === 2 && asked.payload.pages[0].sha256 === HG && named && emptyDoor);
  } finally {
    if (priorSpine === undefined) delete process.env.ARC_SPINE_ROOT; else process.env.ARC_SPINE_ROOT = priorSpine;
    rmSync(spine, { recursive: true, force: true });
  }
  const cli = mkdtempSync(join(tmpdir(), "narr-cli-"));
  try {
    const me = join(HERE, "narrative-anchors.mjs");
    const call = (/** @type {string[]} */ ...a) => spawnSync(process.execPath, [me, "--root", cli, ...a], { encoding: "utf8" });
    const bareAccept = call("--accept", "products/hq");
    const junk = call("--accept", "products/hq", "--approval", "12345");
    const orphanApproval = call("--approval", U1);
    const both = call("--request-accept", "products/hq", "--accept", "products/hq");
    arm("MUTANT B6 bare accept: an agent-style --accept with no --approval, or a malformed one, is refused (exit 1, one sentence, nothing written); --approval alone and --request-accept beside --accept are usage errors",
      bareAccept.status === 1 && /^REFUSED products\/hq -- --accept needs --approval/.test(bareAccept.stdout) && junk.status === 1 && junk.stdout.includes("not an approval id")
      && orphanApproval.status === 2 && both.status === 2 && !existsSync(join(cli, "docs")));
  } finally { rmSync(cli, { recursive: true, force: true }); }
  const repo = mkdtempSync(join(tmpdir(), "narr-main-"));
  const wt = `${repo}-wt`;
  try {
    const g = (/** @type {string[]} */ a, /** @type {string} */ cwd) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.com", ...a], { cwd, stdio: "ignore" });
    g(["init", "-q"], repo);
    g(["commit", "-q", "--allow-empty", "-m", "x"], repo);
    g(["worktree", "add", "-q", "--detach", wt], repo);
    arm("main clone: from a linked worktree git's common dir names the main clone, and from the clone itself the same one",
      realpathSync(mainCloneOf(wt)) === realpathSync(repo) && realpathSync(mainCloneOf(repo)) === realpathSync(repo));
  } finally { rmSync(wt, { recursive: true, force: true }); rmSync(repo, { recursive: true, force: true }); }
  console.log(`RAN: ${ran} checks, ${failed} failed`);
  return failed === 0 && ran === 41 ? 0 : 1;
}

// ---------------------------------------------------------------- CLI ----------------------------------------------------------------

/** @param {string[]} argv */
async function main(argv) {
  const stProblem = selftestArgProblem(argv);
  if (stProblem) { console.error(`narrative-anchors: ${stProblem}`); return 2; }
  if (argv.includes("--selftest")) return await selftest();
  let root = process.cwd(), rootSet = false, accept = "", approval = "";
  /** @type {string[]} */ const requestPages = [];
  const json = argv.includes("--json");
  const PAGE_ARG = /^[a-z]+\/[A-Za-z0-9][A-Za-z0-9._-]*$/;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--request-accept") {
      // Takes every page up to the next flag: one request may name the whole batch.
      if (requestPages.length) { console.error("narrative-anchors: --request-accept given twice"); return 2; }
      while (i + 1 < argv.length && !String(argv[i + 1]).startsWith("-")) {
        const v = String(argv[++i]);
        if (!PAGE_ARG.test(v)) { console.error(`narrative-anchors: --request-accept needs <dir>/<id>, got ${JSON.stringify(v)}`); return 2; }
        requestPages.push(v);
      }
      if (!requestPages.length) { console.error("narrative-anchors: --request-accept needs at least one page, <dir>/<id>"); return 2; }
      continue;
    }
    if (a === "--root" || a === "--accept" || a === "--approval") {
      const v = argv[i + 1];
      if (typeof v !== "string" || v === "" || v.startsWith("-")) { console.error(`narrative-anchors: ${a} needs ${a === "--root" ? "a directory" : a === "--approval" ? "the approval ULID" : "a page, <dir>/<id>"}`); return 2; }
      if (a === "--root") { if (rootSet) { console.error("narrative-anchors: --root given twice"); return 2; } root = resolve(v); rootSet = true; }
      else if (a === "--approval") { if (approval) { console.error("narrative-anchors: --approval given twice"); return 2; } approval = v; }
      else { if (accept) { console.error("narrative-anchors: --accept given twice"); return 2; } if (!PAGE_ARG.test(v)) { console.error("narrative-anchors: --accept needs <dir>/<id>"); return 2; } accept = v; }
      i++;
      continue;
    }
    if (a === "--json") continue;
    console.error(`narrative-anchors: unknown argument ${JSON.stringify(a)}`);
    return 2;
  }
  // Judged before the tree is read: a bare --accept (no owner proof) costs nothing to refuse and can write nothing.
  const argBad = acceptArgProblem(accept, approval, requestPages);
  if (argBad.code === 2) { console.error(`narrative-anchors: ${argBad.why}`); return 2; }
  if (argBad.code === 1) { console.log(`REFUSED ${accept} -- ${argBad.why}`); return 1; }
  let t;
  try { t = await readTree(root); } catch (e) { console.error(`narrative-anchors: cannot read the tree: ${/** @type {Error} */ (e).message}`); return 2; }
  const r = evaluate({ narratives: t.narratives, accepted: t.accepted, proofs: proofsOf(t.acceptDoc), tree: t.tree });
  for (const p of t.rejected) r.fails.push(`[not-a-file] ${p} -- a symlink, a directory, unparseable, wrong-shaped or out of the tree; narratives and their records are regular files inside it`);
  if (requestPages.length) {
    const req = requestPayload(requestPages, t.narratives);
    if (req.problem) { console.log(`REFUSED request-accept -- ${req.problem}`); return 1; }
    const got = await raiseRequest(root, req.payload);
    if (got.why) { console.log(`REFUSED request-accept -- ${got.why}`); return 1; }
    console.log(`requested ${got.id}: the owner is asked to accept ${requestPages.length} page${requestPages.length === 1 ? "" : "s"}, each at the text hash it has now`);
    console.log(`the owner runs${got.main ? ` from the main clone (${got.main})` : ""}:`);
    console.log(`  node .claude/scripts/hq/arc-inbox.mjs approve ${got.id} --reason "read the ${requestPages.length} narrative page${requestPages.length === 1 ? "" : "s"} and accept ${requestPages.length === 1 ? "it" : "them"}"`);
    console.log(`then, per page: node .claude/scripts/docs/narrative-anchors.mjs --accept <dir>/<id> --approval ${got.id}`);
    return 0;
  }
  if (accept) {
    const blocked = acceptBlocker(t.rejected);
    if (blocked) { console.log(`REFUSED ${accept} -- ${blocked}`); return 1; }
    // The baseline is the text readTree PARSED, never a second read (attack b8707be B2): the guard must judge the read the doc came from.
    const before = t.acceptText;
    const on = new Date().toISOString().slice(0, 10);
    const { doc, refused } = acceptEntry(t.acceptDoc, accept, t.narratives, r.fails, on, approval);
    if (refused) { console.log(`REFUSED ${accept} -- ${refused}`); return 1; }
    // The owner's proof, read from HIS spine (the main clone's, read-only): the one place the ULID is checked against anything.
    const os = ownerSpine(root);
    if (os.why) { console.log(`REFUSED ${accept} -- ${os.why}; nothing was written`); return 1; }
    const sp = await readSpineEvents(os.spine);
    if (sp.why) { console.log(`REFUSED ${accept} -- ${sp.why}; nothing was written`); return 1; }
    const noProof = approvalProblem(sp.events, approval, accept, sha256(String(t.narratives[accept])));
    if (noProof) { console.log(`REFUSED ${accept} -- ${noProof}; nothing was written`); return 1; }
    const failed = writeAccept(root, doc, before);
    if (failed) { console.log(`REFUSED ${accept} -- ${failed}`); return 1; }
    console.log(`accepted ${accept} for the owner on ${on} under approval ${approval} (sha256 ${sha256(String(t.narratives[accept])).slice(0, 12)}) -> ${ACCEPT_FILE}`);
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
