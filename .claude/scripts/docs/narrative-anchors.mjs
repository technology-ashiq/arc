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
//       approve through arc-inbox. `--request-accept <dir>/<id>...` raises it. Amendment 2 makes it authentication: the
//       approval carries one Ed25519 signature per page, made with a key only the owner's passphrase unseals, and every
//       accepted entry carries its own `sig`, verified here against the committed public key (.claude/owner-key.pub).
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
import { createHash, generateKeyPairSync, sign as cryptoSign } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, renameSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
/** The one hq file the gate needs (products/docs requires hq): every spawn, spine read and git call lives there (DOC-A). */
const PROOF_HREF = pathToFileURL(join(HERE, "..", "hq", "lib", "narrative-proof.mjs")).href;
/** The pure half of the owner key (message, shapes, verify): node:crypto only, so the gate may import it (DOC-A). Loaded dynamically, so a consumer without hq still refuses by name. */
const OWNER_SIG_HREF = pathToFileURL(join(HERE, "..", "hq", "lib", "owner-sig.mjs")).href;
/** Where the owner's public key is committed, relative to the tree (ADR-1514 amendment 2). */
export const OWNER_PUB = ".claude/owner-key.pub";
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

/** The owner's LOCAL calendar day, YYYY-MM-DD: an evening acceptance east of UTC is that day for him, not the UTC one (attack r1 L7). */
export const localDay = (/** @type {{ getFullYear(): number, getMonth(): number, getDate(): number }} */ d = new Date()) =>
  `${String(d.getFullYear()).padStart(4, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

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
 * Every comment a page-shape fenced body carries. The fold draws a shape body verbatim and strips markers only from prose,
 * so a marker in one is shown to the reader as raw text AND was never resolved (attack r1 L2). Each body is joined first so
 * a marker broken over lines is one marker.
 * @param {string} text
 * @returns {{ line: number, raw: string, anchors: string[] }[]}
 */
export function shapeMarkers(text) {
  const lines = String(text ?? "").split(/\r?\n/);
  const cls = classify(lines);
  /** @type {{ line: number, raw: string, anchors: string[] }[]} */
  const out = [];
  /** @type {string[]} */ let body = [];
  let start = 0;
  const flush = () => {
    const joined = body.join("\n");
    for (const m of joined.matchAll(COMMENT)) {
      const raw = String(m[0]);
      const anchors = [...raw.matchAll(MARK_SRC)].flatMap((x) => String(x[1]).split(";").map((a) => a.trim()).filter(Boolean));
      out.push({ line: start + joined.slice(0, m.index).split("\n").length - 1, raw, anchors });
    }
    if (/<!--/.test(joined.replace(COMMENT, ""))) out.push({ line: start, raw: "<!--", anchors: [] });
    body = [];
  };
  for (let i = 0; i < lines.length; i++) {
    const c = /** @type {NonNullable<typeof cls[number]>} */ (cls[i]);
    if (c.t === "body" && !c.quoted) { if (!body.length) start = i + 1; body.push(String(lines[i])); continue; }
    flush();
  }
  flush();
  return out;
}

/**
 * What a narrative NAMES that must exist (ADR-1514 section 2): every `ADR-NNNN` in its prose, and every `/arc-*`
 * command and repo path in a code span. Prose, tables and the page-shape blocks (steps, panels, figures ...) are read;
 * a plain code fence (```bash ...) is a quote and is not, and neither is a comment.
 * @param {string} text @returns {{ adrs: string[], commands: string[], paths: string[], badCommands: string[] }}
 */
export function namesOf(text) {
  const adrs = new Set(), commands = new Set(), paths = new Set(), badCommands = new Set();
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
      // A span that STARTS with the command word names it (`/arc-x --lane y`, `/arc-x.`); detection is case-blind and the
      // id is then checked exactly, so `/ARC-Gone` is a drift finding and not a span nobody reads (attack r1 L3).
      if (/^\/arc-/i.test(s)) {
        const cmd = /^\/(arc-[A-Za-z0-9][A-Za-z0-9-]*)/i.exec(s);
        // The bare wildcard `/arc-*` names the whole family, no one command (products/evolve says so), like a glob path.
        if (cmd) commands.add(String(cmd[1])); else if (s !== "/arc-*") badCommands.add(s);
      } else if (PATH_NAME.test(s)) paths.add(s);
    }
  }
  return { adrs: [...adrs].sort(), commands: [...commands].sort(), paths: [...paths].sort(), badCommands: [...badCommands].sort() };
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
 * The owner signature each acceptance carries, as read from ACCEPT_FILE: page -> its base64 `sig`, or "" when the entry has none
 * (ADR-1514 amendment 2). Whether it is well formed and verifies is the gate's job, with the owner library.
 * @param {unknown} doc @returns {Record<string, string>}
 */
export function sigsOf(doc) {
  /** @type {Record<string, string>} */
  const out = Object.create(null);
  const pages = doc && typeof doc === "object" && !Array.isArray(doc) && /** @type {any} */ (doc).schema === 1 ? /** @type {any} */ (doc).pages : null;
  if (!pages || typeof pages !== "object" || Array.isArray(pages)) return out;
  for (const [page, v] of Object.entries(pages)) {
    const a = v && typeof v === "object" ? /** @type {any} */ (v).sig : undefined;
    out[page] = typeof a === "string" ? a : "";
  }
  return out;
}

/**
 * The gate. Pure: every input is handed in. `proofs` is proofsOf(): an owner entry with no well-formed approval FAILs.
 * CI can only see that an approval is NAMED, never that it is real: the spine is gitignored and lives in the main clone, so
 * the check that the ULID is a decided approve for this page and hash runs at --accept time and nowhere else.
 * `sigs` is sigsOf() and `owner` is { pub, lib } -- the committed public key PEM ("" when the file is missing) and the pure
 * owner library. An owner entry needs a sig that VERIFIES over its own approval, page and hash (ADR-1514 amendment 2), so
 * an invented ULID, a hand-edited entry and a sig copied from other text FAIL here, on CI, with no spine.
 * @param {{ narratives: Record<string, string>, accepted: Record<string, string>, proofs: Record<string, string>, sigs?: Record<string, string>, owner?: { pub: string, lib: any } | null, tree: Parameters<typeof anchorProblem>[1] }} io
 */
export function evaluate({ narratives, accepted, proofs, sigs = {}, owner = null, tree }) {
  /** @type {string[]} */ const fails = [];
  /** @type {string[]} */ const warns = [];
  const rows = Array.isArray(tree.wiki?.entities?.commands) ? tree.wiki.entities.commands : [];
  const commands = new Set();
  // A row with no string id must not become the allow-list entry "undefined" (attack r1 L4); it is named instead.
  rows.forEach((/** @type {any} */ c, /** @type {number} */ i) => {
    if (c && typeof c === "object" && typeof c.id === "string") commands.add(c.id);
    else fails.push(`[commands] entities.commands[${i}] has no id -- the command list the drift check trusts is malformed`);
  });
  let ok = 0, awaiting = 0;
  for (const [page, text] of Object.entries(narratives).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    const blocks = blocksOf(text);
    if (blocks.length === 0 && String(text).replace(COMMENT, "").trim() === "") { fails.push(`[empty] ${page} -- a narrative with nothing in it explains nothing`); continue; }
    for (const b of blocks) for (const a of b.anchors) { const why = anchorProblem(a, tree); if (why) fails.push(`[anchor] ${page}:${b.line} -- ${a}: ${why}`); }
    for (const m of shapeMarkers(text)) {
      for (const a of m.anchors) { const why = anchorProblem(a, tree); if (why) fails.push(`[anchor] ${page}:${m.line} -- ${a}: ${why}`); }
      fails.push(`[marker-in-shape] ${page}:${m.line} -- a comment inside a page-shape block is drawn to the reader as raw text; move it out of the fence`);
    }
    const names = namesOf(text);
    for (const b of names.badCommands) fails.push(`[drift] ${page} -- names ${JSON.stringify(b)}, which starts /arc- but carries no command id`);
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
  let keyReported = false;
  for (const page of Object.keys(accepted).sort()) {
    const approval = Object.prototype.hasOwnProperty.call(proofs, page) ? String(proofs[page]) : "";
    // No hash or no approval is already reported above ([awaiting-owner], [no-owner-proof]); a signature needs both to be judged.
    if (accepted[page] === "" || !ULID.test(approval)) continue;
    const sig = Object.prototype.hasOwnProperty.call(sigs, page) ? sigs[page] : "";
    if (typeof sig !== "string" || sig === "") { fails.push(`[no-owner-signature] ${page} -- the accepted entry carries no owner signature (sig): only --accept, from an approval the owner signed at a terminal with arc-inbox, writes one`); continue; }
    if (!owner || !owner.lib || !owner.pub) {
      if (!keyReported) { keyReported = true; fails.push(`[no-owner-key] ${OWNER_PUB} is missing or unreadable (or the owner library is not installed), but ${ACCEPT_FILE} holds owner entries, so none can be verified; the owner runs "arc-inbox owner-key init" and commits it`); }
      continue;
    }
    if (!owner.lib.sigWellFormed(sig)) { fails.push(`[no-owner-signature] ${page} -- the entry's sig is not a base64 Ed25519 signature of the exact length`); continue; }
    const hash = accepted[page];
    if (!owner.lib.verifyOwnerSig(owner.pub, owner.lib.ownerMessage(approval, page, hash), sig)) fails.push(`[bad-owner-signature] ${page} -- the entry's sig does not verify against ${OWNER_PUB} over this page, its hash and its approval (another key, another text, or a sig copied from elsewhere)`);
  }
  for (const page of Object.keys(accepted).sort()) if (!Object.prototype.hasOwnProperty.call(narratives, page)) fails.push(`[orphan-accept] ${ACCEPT_FILE} names ${page}, which has no narrative`);
  return { fails, warns, accepted: ok, awaiting, narratives: Object.keys(narratives).length };
}

/**
 * The acceptance file with one page added (or re-read), or why it is refused: the page must exist and pass the gate.
 * @param {unknown} doc the current ACCEPT_FILE (or null) @param {string} page @param {Record<string, string>} narratives
 * @param {string[]} fails evaluate()'s fails @param {string} on YYYY-MM-DD @param {string} approval the owner's proof, a ULID
 * @param {string} sig the owner's signature for this page, copied from the approval's decision (the caller has verified it)
 * @returns {{ doc: any, refused: string }}
 */
export function acceptEntry(doc, page, narratives, fails, on, approval, sig) {
  if (!ULID.test(String(approval))) return { doc: null, refused: "an acceptance needs the ULID of the owner's approval (--approval)" };
  if (typeof sig !== "string" || sig === "") return { doc: null, refused: "an acceptance needs the owner's signature for this page, taken from the approval's decision" };
  if (!Object.prototype.hasOwnProperty.call(narratives, page)) return { doc: null, refused: `no narrative ${page}` };
  // A missing proof is what re-stamping CURES, so it must not block the very entry that fixes it.
  const own = fails.filter((f) => !/^\[(no-owner-proof|no-owner-signature|bad-owner-signature)\]/.test(f) && f.split(" ").some((w) => w === page || w.startsWith(`${page}:`)));
  if (own.length) return { doc: null, refused: `${page} fails the gate: ${own[0]}` };
  // A page id of __proto__ is a legal own key from JSON.parse and would vanish into the prototype (attack b5f5e03 B4).
  if (doc && typeof doc === "object" && Object.prototype.hasOwnProperty.call(/** @type {any} */ (doc).pages ?? {}, "__proto__")) return { doc: null, refused: `${ACCEPT_FILE} holds a __proto__ page key; fix the file by hand` };
  const prev = doc && typeof doc === "object" && !Array.isArray(doc) && /** @type {any} */ (doc).schema === 1 && /** @type {any} */ (doc).pages && typeof /** @type {any} */ (doc).pages === "object" ? /** @type {any} */ (doc).pages : {};
  /** @type {Record<string, unknown>} */
  const pages = Object.create(null);
  for (const k of [...Object.keys(prev), page].filter((k, i, a) => a.indexOf(k) === i).sort()) pages[k] = k === page ? { by: "owner", on, sha256: sha256(String(narratives[page])), approval, sig } : prev[k];
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
 * advisory receipt, and the acceptance file, all read by NAMED path. Nothing here lists a directory or spawns a process; the tracked list the
 * drift check is judged against (attack b8707be B5) comes from hq/lib/narrative-proof.mjs.
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
  // The one process the gate needs, the tracked list, is in the hq lane (DOC-A: docs/ spawns nothing). When it cannot be had
  // the plain gate degrades to on-disk presence and says so (attack r2 B3); --accept and --request-accept refuse on `degraded`.
  const got = await loadTracked(root, PROOF_HREF);
  const adrs = new Set();
  for (const band of Array.isArray(wiki.entities.adrBands) ? wiki.entities.adrBands : []) {
    for (const a of Array.isArray(band && band.facts && band.facts.adrs) ? band.facts.adrs : []) if (a && /^\d{4}$/.test(String(a.number))) adrs.add(String(a.number));
  }
  /** @type {any} */ let lib = null;
  try { lib = await import(OWNER_SIG_HREF); } catch { lib = null; }
  const pubFile = join(root, OWNER_PUB);
  const owner = { pub: regularInside(pubFile, rootReal) ? readFileSync(pubFile, "utf8") : "", lib };
  const tracked = got.list ? trackedIn(got.list, root, rootReal) : (/** @type {string} */ p) => presentExact(root, rootReal, p);
  const read = (/** @type {string} */ p) => { try { return readFileSync(join(root, p), "utf8"); } catch { return ""; } };
  const isDir = (/** @type {string} */ seg) => isTopDir(root, seg);
  return { wb, wiki, narratives, receipts, acceptDoc, acceptText: acc.text, accepted: acceptedOf(acceptDoc), owner, rejected, degraded: got.why, tree: { adrs, wiki, tracked, read, isDir } };
}

/**
 * The git-tracked list, or why there is none (attack r2 B3): the hq helper may be absent (a consumer synced only docs) or the
 * root may not be a git checkout. Never throws; `why` is one line. `extraEnv` lets a test name its own git ceiling.
 * @param {string} root @param {string} proofHref @param {Record<string, string>} [extraEnv]
 * @returns {Promise<{ list: Set<string> | null, why: string }>}
 */
export async function loadTracked(root, proofHref, extraEnv = {}) {
  const one = (/** @type {unknown} */ e) => String(e && /** @type {Error} */ (e).message || e).split("\n")[0];
  let mod;
  try { mod = await import(proofHref); } catch (e) { return { list: null, why: `hq/lib/narrative-proof.mjs cannot be loaded (${one(e)})` }; }
  try { return { list: mod.gitTrackedList(root, extraEnv), why: "" }; } catch (e) { return { list: null, why: one(e) }; }
}

/** The one WARN line the plain gate prints when it has no git list. @param {string} why */
export const reducedWarn = (why) => `[drift-reduced] no git-tracked list (${String(why).replace(/\s+/g, " ").trim()}); a path is judged by exact-case presence on disk only, so a gitignored file is not caught here`;

/** --accept and --request-accept never run on a reduced drift check. @param {string} why @returns {string} */
export const acceptDegradeProblem = (why) => (why ? `the drift check has no git-tracked list (${String(why).replace(/\s+/g, " ").trim()}), and an acceptance never runs on a reduced check; nothing was written` : "");

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

/**
 * What the plain gate says about the owner key against the base ref (ADR-1514 amendment 2, "Correction"): one WARN when the
 * key was swapped, one WARN when it could not be compared (never a silent pass), nothing otherwise. `changed` is the count the
 * summary line carries. Pure: narrative-proof's ownerKeyBaseState does the git read.
 * @param {{ state: string, why?: string, base?: string, was?: string, now?: string } | null} st
 * @returns {{ warn: string, changed: number }}
 */
export function ownerKeyFinding(st) {
  if (!st) return { warn: `[owner-key-unchecked] hq/lib/narrative-proof.mjs is not installed, so ${OWNER_PUB} was not compared with the base ref`, changed: 0 };
  if (st.state === "changed") return { warn: `[owner-key-changed] ${OWNER_PUB} differs from ${st.base} (fingerprint ${st.was} -> ${st.now}): a key swap is the one thing a signature cannot stop, so it is loud; do not merge without telling the owner (ADR-1514 amendment 2)`, changed: 1 };
  if (st.state === "unavailable") return { warn: `[owner-key-unchecked] ${String(st.why || "the base ref could not be read").replace(/\s+/g, " ").trim()}`, changed: 0 };
  return { warn: "", changed: 0 };
}

/** Why --selftest cannot combine with other arguments, or "" (attack b5f5e03 B6): a mode must not ignore what it was given. */
export function selftestArgProblem(/** @type {string[]} */ argv) {
  const extra = argv.filter((a) => a !== "--selftest");
  if (argv.length - extra.length > 1) return "--selftest given twice";
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
  const U1_DUMMY = "01ARZ3NDEKTSV4RRFFQ69G5FAV";
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
  const accept = acceptEntry(null, "products/hq", { "products/hq": good }, [], "2026-09-28", "01ARZ3NDEKTSV4RRFFQ69G5FAV", "sig");
  const refuse = acceptEntry(null, "products/hq", { "products/hq": good }, ["[drift] products/hq -- names x"], "2026-09-28", "01ARZ3NDEKTSV4RRFFQ69G5FAV", "sig");
  arm("accept: records the owner and the hash; refuses a page that fails the gate or does not exist",
    acceptedOf(accept.doc)["products/hq"] === sha256(good) && refuse.refused !== "" && acceptEntry(null, "products/zz", {}, [], "d", "01ARZ3NDEKTSV4RRFFQ69G5FAV", "sig").refused !== "");
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
  const protoAccept = acceptEntry(protoDoc, "products/hq", { "products/hq": good }, [], "2026-09-28", "01ARZ3NDEKTSV4RRFFQ69G5FAV", "sig");
  const cleanAccept = acceptEntry({ schema: 1, pages: { "products/a": { by: "owner", on: "d", sha256: "0".repeat(64) } } }, "products/hq", { "products/hq": good }, [], "2026-09-28", "01ARZ3NDEKTSV4RRFFQ69G5FAV", "sig");
  arm("MUTANT B4 proto: a __proto__ page key in the file is refused by name, and a normal merge keeps the earlier page",
    protoAccept.refused.includes("__proto__") && cleanAccept.refused === "" && Object.keys(cleanAccept.doc.pages).join() === "products/a,products/hq");
  arm("MUTANT B6 selftest args: --selftest beside any other argument is refused by name, alone it is fine",
    selftestArgProblem(["--selftest", "--accept", "products/qa"]).includes("--accept") && selftestArgProblem(["--selftest"]) === "" && selftestArgProblem(["--selftest", "--selftest"]).includes("twice"));
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
  } finally {
    rmSync(box, { recursive: true, force: true });
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
  const stamped = acceptEntry({ schema: 1, pages: { "products/old": { by: "owner", on: "d", sha256: "0".repeat(64) } } }, "products/hq", { "products/hq": good }, ["[no-owner-proof] products/hq -- accepted without an owner proof: x"], "2026-09-29", U1, "sig");
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
  // ---- ADR-1514 amendment 2: the owner's signature. Each arm FAILs against the code before it, which asked for none.
  const OS = await import(OWNER_SIG_HREF);
  const K1 = generateKeyPairSync("ed25519"), K2 = generateKeyPairSync("ed25519");
  const pemOf = (/** @type {any} */ k) => String(k.publicKey.export({ type: "spki", format: "pem" }));
  const P1 = pemOf(K1), P2 = pemOf(K2);
  const sgn = (/** @type {any} */ k, /** @type {string} */ approval, /** @type {string} */ page, /** @type {string} */ text) => cryptoSign(null, Buffer.from(OS.ownerMessage(approval, page, sha256(text)), "utf8"), k.privateKey).toString("base64");
  const gateWith = (/** @type {string} */ text, /** @type {any} */ entrySig, pub = P1, approval = U1) => evaluate({ narratives: { "products/hq": text }, accepted: { "products/hq": sha256(text) }, proofs: { "products/hq": approval }, sigs: entrySig === undefined ? {} : { "products/hq": entrySig }, owner: { pub, lib: OS }, tree });
  const goodSig = sgn(K1, U1, "products/hq", good);
  arm("MUTANT A2 format: the signed message is exactly prefix|approval|page|hash; a signature must be 86 base64 characters and ==; sigs is a closed page -> signature object; the gate string is the gate's own",
    OS.ownerMessage("A", "p/x", "h") === "arc-narrative-accept-v1\nA\np/x\nh" && OS.sigWellFormed(goodSig) && !OS.sigWellFormed(goodSig.slice(1)) && !OS.sigWellFormed(`${goodSig}A`) && !OS.sigWellFormed(7) && !OS.sigWellFormed("")
    && OS.sigsShapeProblem({ "products/hq": goodSig }) === "" && ["x", [], {}, { "no page": goodSig }, { "products/hq": "abc" }, { "products/hq": goodSig.slice(2) }].every((v) => OS.sigsShapeProblem(v) !== "")
    && OS.ACCEPT_GATE === ACCEPT_GATE && /^[0-9a-f]{16}$/.test(OS.fingerprint(P1)) && OS.fingerprint(P1) !== OS.fingerprint(P2));
  arm("MUTANT A4 no signature: an invented ULID with no sig, an empty sig and a malformed sig each FAIL [no-owner-signature] by page; the owner's real signature passes clean",
    has(gateWith(good, undefined), "[no-owner-signature] products/hq") && has(gateWith(good, ""), "[no-owner-signature]") && has(gateWith(good, "not-base64"), "[no-owner-signature]") && gateWith(good, goodSig).fails.length === 0 && gateWith(good, goodSig).accepted === 1);
  arm("MUTANT A4 wrong key: a signature by another key FAILs [bad-owner-signature] against the committed key, though it is well formed",
    has(gateWith(good, sgn(K2, U1, "products/hq", good)), "[bad-owner-signature] products/hq") && !has(gateWith(good, sgn(K2, U1, "products/hq", good)), "[no-owner-signature]") && gateWith(good, sgn(K2, U1, "products/hq", good), P2).fails.length === 0);
  arm("MUTANT A4 copied sig: a valid signature copied for other text, for another page, or for another approval FAILs [bad-owner-signature]; each is valid where it was made",
    has(gateWith(good, sgn(K1, U1, "products/hq", `${good}\nother words\n`)), "[bad-owner-signature]") && has(gateWith(good, sgn(K1, U1, "lanes/other", good)), "[bad-owner-signature]") && has(gateWith(good, sgn(K1, U2, "products/hq", good)), "[bad-owner-signature]")
    && has(gateWith(good, goodSig, P1, U2), "[bad-owner-signature]"));
  const twoPages = evaluate({ narratives: { "products/hq": good, "lanes/x": `${good}\nlane\n` }, accepted: { "products/hq": sha256(good), "lanes/x": sha256(`${good}\nlane\n`) }, proofs: { "products/hq": U1, "lanes/x": U1 }, sigs: { "products/hq": goodSig, "lanes/x": goodSig }, owner: { pub: "", lib: OS }, tree });
  const noEntries = evaluate({ narratives: { "products/hq": good }, accepted: {}, proofs: {}, sigs: {}, owner: { pub: "", lib: OS }, tree });
  arm("MUTANT A4 no key: with owner entries and no public key file one [no-owner-key] FAILs (once, however many pages); with no entries a missing key says nothing",
    twoPages.fails.filter((f) => f.startsWith("[no-owner-key]")).length === 1 && !has(twoPages, "[bad-owner-signature]") && !has(noEntries, "[no-owner-key]") && noEntries.fails.length === 0
    && has(evaluate({ narratives: { "products/hq": good }, accepted: { "products/hq": sha256(good) }, proofs: { "products/hq": U1 }, sigs: { "products/hq": goodSig }, owner: null, tree }), "[no-owner-key]"));
  const stampedSig = acceptEntry({ schema: 1, pages: { "products/old": { by: "owner", on: "d", sha256: "0".repeat(64) } } }, "products/hq", { "products/hq": good }, ["[no-owner-signature] products/hq -- x", "[bad-owner-signature] products/hq -- x"], "2026-09-30", U1, goodSig);
  const drifted = acceptEntry(null, "products/hq", { "products/hq": good }, ["[drift] products/hq -- names x"], "2026-09-30", U1, goodSig);
  const docSigs = sigsOf({ schema: 1, pages: { "products/hq": { by: "owner", sha256: sha256(good), approval: U1, sig: goodSig }, "products/a": { by: "owner", sig: 7 }, "products/b": { by: "owner" } } });
  arm("MUTANT A5 entry: --accept writes {approval, sig} into the entry and keeps the others; no sig is refused; a page failing only for a missing or bad signature can be re-stamped, a drifting one cannot; sigsOf reads a non-string as none",
    stampedSig.refused === "" && stampedSig.doc.pages["products/hq"].sig === goodSig && stampedSig.doc.pages["products/hq"].approval === U1 && stampedSig.doc.pages["products/old"].sha256 === "0".repeat(64)
    && acceptEntry(null, "products/hq", { "products/hq": good }, [], "d", U1, "").refused !== "" && acceptEntry(null, "products/hq", { "products/hq": good }, [], "d", U1, undefined).refused !== "" && drifted.refused !== ""
    && docSigs["products/hq"] === goodSig && docSigs["products/a"] === "" && docSigs["products/b"] === "");
  // ---- attack r1 (logic surface): L2 shape markers, L3 command word, L4 command rows, L7 local day.
  const withStep = (/** @type {string} */ line) => good.replace("plain: you type `/arc-x`", `plain: you type \`/arc-x\` ${line}`);
  const badMark = run(withStep("<!-- src: a/nope.mjs -->")), goodMark = run(withStep("<!-- src: a/b.mjs -->")), plainMark = run(withStep("<!-- plain -->"));
  arm("MUTANT L2 shape marker: a src marker inside a steps block is resolved (unresolvable FAILs [anchor]), and any marker there FAILs [marker-in-shape] because the fold draws it raw",
    has(badMark, "[anchor]") && has(badMark, "[marker-in-shape]") && !has(goodMark, "[anchor]") && has(goodMark, "[marker-in-shape]") && has(plainMark, "[marker-in-shape]") && !has(run(good), "[marker-in-shape]"));
  arm("MUTANT L2 multi-line: a marker broken over lines in a shape block, and a comment left open there, are still found; a marker in a plain quote fence is not",
    has(run(good.replace("plain: you type", "<!-- src: a/nope.mjs\n-->\nplain: you type")), "[anchor]") && has(run(good.replace("plain: you type", "<!-- open\nplain: you type")), "[marker-in-shape]")
    && !has(run(good.replace("# a quote, not a claim", "# a quote <!-- src: a/nope.mjs -->")), "[anchor]"));
  arm("MUTANT L3 command word: a span that starts with /arc-x is checked -- flags, a trailing dot and upper case included; an existing command with flags passes",
    ["`/arc-gone --lane docs`", "`/arc-gone.`", "`/ARC-Gone`", "`/ARC-x`"].every((sp) => has(run(good.replace("`/arc-x`", sp)), "[drift]"))
    && !has(run(good.replace("`/arc-x`", "`/arc-x --lane docs`")), "[drift]") && !has(run(good.replace("`/arc-x`", "`/arc-x.`")), "[drift]"));
  arm("MUTANT L3 no id: a span that starts /arc- and yields no command id FAILs by name",
    ["`/arc-`", "`/arc- x`", "`/arc-*x`"].every((sp) => run(good.replace("`/arc-x`", sp)).fails.some((f) => f.startsWith("[drift]") && f.includes("no command id"))) && !has(run(good.replace("`/arc-x`", "`/arc-*`")), "[drift]"));
  const rowRun = (/** @type {any[]} */ commands, /** @type {string} */ text) => evaluate({ narratives: { "products/hq": text }, accepted: {}, proofs: {}, tree: { ...tree, wiki: { entities: { ...wiki.entities, commands } } } });
  arm("MUTANT L4 command rows: a row with no string id is named and never becomes the command undefined; well-formed rows raise nothing",
    rowRun([{ id: "arc-x" }, null, {}, { id: 7 }], good).fails.filter((f) => f.startsWith("[commands]")).length === 3
    && has(rowRun([{ id: "arc-x" }, {}], good.replace("`/arc-x`", "`/undefined`")), "[commands]") && !has(rowRun([{ id: "arc-x" }], good), "[commands]"));
  const fakeClock = { getFullYear: () => 2026, getMonth: () => 8, getDate: () => 29, toISOString: () => "2026-09-28T19:00:00.000Z" };
  arm("MUTANT L7 local day: the acceptance date is the owner's local calendar day (a clock whose UTC day differs reads its local one), zero-padded",
    localDay(fakeClock) === "2026-09-29" && localDay({ getFullYear: () => 2027, getMonth: () => 0, getDate: () => 5 }) === "2027-01-05" && /^\d{4}-\d{2}-\d{2}$/.test(localDay()));
  // ---- attack r2 B3 (the gate degrades, --accept never does) and B4 (the missing-page refusal, reached with a real approval id).
  const gone = await loadTracked(HERE, pathToFileURL(join(HERE, "no-such-hq-helper.mjs")).href);
  const bareGit = mkdtempSync(join(tmpdir(), "narr-nogit-"));
  let noGit;
  try { noGit = await loadTracked(bareGit, PROOF_HREF, { GIT_CEILING_DIRECTORIES: dirname(bareGit) }); } finally { rmSync(bareGit, { recursive: true, force: true }); }
  arm("MUTANT B3 module absent: with the hq helper missing the tracked list is null with a one-line reason, never a throw",
    gone.list === null && gone.why.includes("narrative-proof.mjs") && !gone.why.includes("\n"));
  arm("MUTANT B3 no git: a root git cannot list gives a null list and a one-line reason naming git, never a throw",
    noGit.list === null && noGit.why.includes("git ls-files") && !noGit.why.includes("\n"));
  const warnLine = reducedWarn(gone.why);
  arm("MUTANT B3 degrade: the plain gate names ONE [drift-reduced] WARN saying gitignored files are not caught, and --accept / --request-accept refuse on it (nothing written); with a git list neither fires",
    warnLine.startsWith("[drift-reduced]") && !warnLine.includes("\n") && warnLine.includes("gitignored") && acceptDegradeProblem(gone.why).includes("nothing was written") && acceptDegradeProblem("") === "");
  const missing = acceptEntry(null, "products/zz-no-such-page", {}, [], "2026-09-30", U1_DUMMY, "sig");
  arm("MUTANT B4 missing page: with a well-formed approval the refusal is the missing page, by name, decided before any spine read",
    missing.doc === null && missing.refused === "no narrative products/zz-no-such-page" && acceptArgProblem("products/zz-no-such-page", U1_DUMMY, []).code === 0);
  // The arms that need a process, the spine or a git repo live with the code that does (DOC-A: nothing here spawns); each still runs the REAL functions.
  const proof = await import(PROOF_HREF);
  for (const [name, ok] of await proof.proofArms({ good, wiki, ACCEPT_GATE, sha256, requestPayload, approvalProblem, evaluate, trackedIn, isTopDir, acceptEntry, sigsOf, ownerKeyFinding, OWNER_PUB, script: join(HERE, "narrative-anchors.mjs") })) arm(name, ok);
  console.log(`RAN: ${ran} checks, ${failed} failed`);
  return failed === 0 && ran === 75 ? 0 : 1;
}

// ---------------------------------------------------------------- CLI ----------------------------------------------------------------

/** @param {string[]} argv */
async function main(argv) {
  const stProblem = selftestArgProblem(argv);
  if (stProblem) { console.error(`narrative-anchors: ${stProblem}`); return 2; }
  if (argv.includes("--selftest")) return await selftest();
  let root = process.cwd(), rootSet = false, accept = "", approval = "";
  /** @type {string[]} */ const requestPages = [];
  let json = false;
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
    if (a === "--json") { if (json) { console.error("narrative-anchors: --json given twice"); return 2; } json = true; continue; }
    console.error(`narrative-anchors: unknown argument ${JSON.stringify(a)}`);
    return 2;
  }
  // --json shapes the gate's report; --accept and --request-accept print prose, so the pair would be a flag silently ignored (attack B4).
  if (json && (accept || requestPages.length)) { console.error(`narrative-anchors: --json cannot be combined with ${accept ? "--accept" : "--request-accept"}`); return 2; }
  // Judged before the tree is read: a bare --accept (no owner proof) costs nothing to refuse and can write nothing.
  const argBad = acceptArgProblem(accept, approval, requestPages);
  if (argBad.code === 2) { console.error(`narrative-anchors: ${argBad.why}`); return 2; }
  if (argBad.code === 1) { console.log(`REFUSED ${accept} -- ${argBad.why}`); return 1; }
  // The owner's spine is never named by the environment (attack B1): refused by name before the tree is read, nothing written.
  /** @type {any} */ let pm = null;
  if (accept || requestPages.length) {
    try { pm = await import(PROOF_HREF); } catch { pm = null; }
    if (!pm) { console.log(`REFUSED ${accept || "request-accept"} -- hq/lib/narrative-proof.mjs is not installed beside this gate, so the owner's proof cannot be checked; nothing was written`); return 1; }
    const envBad = pm.spineEnvProblem();
    if (envBad) { console.log(`REFUSED ${accept || "request-accept"} -- ${envBad}; nothing was written`); return 1; }
  }
  let t;
  try { t = await readTree(root); } catch (e) { console.error(`narrative-anchors: cannot read the tree: ${/** @type {Error} */ (e).message}`); return 2; }
  if (accept || requestPages.length) {
    const noGit = acceptDegradeProblem(t.degraded);
    if (noGit) { console.log(`REFUSED ${accept || "request-accept"} -- ${noGit}`); return 1; }
  }
  const r = evaluate({ narratives: t.narratives, accepted: t.accepted, proofs: proofsOf(t.acceptDoc), sigs: sigsOf(t.acceptDoc), owner: t.owner, tree: t.tree });
  if (t.degraded) r.warns.push(reducedWarn(t.degraded));
  // The base read spawns git, so it lives in hq (DOC-A); only the plain gate runs it, never --accept or --request-accept.
  let keyChanged = 0;
  if (!accept && !requestPages.length) {
    /** @type {any} */ let mod = pm;
    if (!mod) { try { mod = await import(PROOF_HREF); } catch { mod = null; } }
    const kf = ownerKeyFinding(mod ? mod.ownerKeyBaseState(root) : t.owner.pub === "" ? { state: "no-key" } : null);
    if (kf.warn) r.warns.push(kf.warn);
    keyChanged = kf.changed;
  }
  for (const p of t.rejected) r.fails.push(`[not-a-file] ${p} -- a symlink, a directory, unparseable, wrong-shaped or out of the tree; narratives and their records are regular files inside it`);
  if (requestPages.length) {
    const req = requestPayload(requestPages, t.narratives);
    if (req.problem) { console.log(`REFUSED request-accept -- ${req.problem}`); return 1; }
    const got = await pm.requestAcceptApproval(req.payload, { root });
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
    const on = localDay();
    // The owner's proof, read from HIS spine (the main clone's, read-only): the one place the ULID is checked against anything,
    // and where the page's signature is taken from the decision after it verifies against the committed public key.
    // The page's own refusals (no such narrative, a failing page) come first and cost no spine read; the sig is not known yet.
    const pre = acceptEntry(t.acceptDoc, accept, t.narratives, r.fails, on, approval, "pending");
    if (pre.refused) { console.log(`REFUSED ${accept} -- ${pre.refused}`); return 1; }
    const proof = await pm.verifyAcceptApproval({ ulid: approval, page: accept, sha256: sha256(String(t.narratives[accept] ?? "")), opts: { root, pubPath: join(root, OWNER_PUB), judge: approvalProblem } });
    const { doc, refused } = proof.why ? { doc: null, refused: "" } : acceptEntry(t.acceptDoc, accept, t.narratives, r.fails, on, approval, proof.sig);
    if (refused) { console.log(`REFUSED ${accept} -- ${refused}`); return 1; }
    if (proof.why) { console.log(`REFUSED ${accept} -- ${proof.why}; nothing was written`); return 1; }
    const failed = writeAccept(root, doc, before);
    if (failed) { console.log(`REFUSED ${accept} -- ${failed}`); return 1; }
    console.log(`accepted ${accept} for the owner on ${on} under approval ${approval} (sha256 ${sha256(String(t.narratives[accept])).slice(0, 12)}) -> ${ACCEPT_FILE}`);
    return 0;
  }
  const d = explanationDebt(t.wiki, t.narratives, t.wb.PAGE_DIRS);
  if (json) { process.stdout.write(`${JSON.stringify({ ...r, explanation: d }, null, 2)}\n`); return r.fails.length ? 1 : 0; }
  for (const f of r.fails) console.log(`FAIL ${f}`);
  for (const w of r.warns) console.log(`WARN ${w}`);
  console.log(`narrative-anchors: narratives=${r.narratives} accepted=${r.accepted} awaiting-owner=${r.awaiting} fail=${r.fails.length} owner-key-changed=${keyChanged} · explanation debt: ${d.debt} of ${d.total} (${d.explained} explained)`);
  return r.fails.length ? 1 : 0;
}

const self = realpathSync(fileURLToPath(import.meta.url));
const invoked = process.argv[1] ? (() => { try { return realpathSync(process.argv[1]); } catch { return ""; } })() : "";
if (self === invoked) main(process.argv.slice(2)).then((c) => { process.exitCode = c; });
