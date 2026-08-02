#!/usr/bin/env node
/**
 * context-pack.mjs -- what past work already knows about this slice (Phase 05).
 *
 * Five retrieval sources, one hop, and a written record of where it looked:
 *
 *   code      the neighbourhood, from `codegraph` when an index exists, from grep when not
 *   adrs      the brief's own citations, plus every ADR whose `Product:` names this lane
 *   learning  rows in the learning ledger matched on area or on blast-radius overlap
 *   retro     retro-log rows matched on tag overlap
 *   churn     the top 3 blast-radius files by commit count, computed from `git log`
 *
 * ADR-0111 fixes two things about this and they are the whole design. A matched record
 * contributes ITSELF and the things its own typed links name; those contribute nothing
 * further -- walk transitively and the pack becomes everything, which is the same as nothing.
 * And every source that contributed is recorded in the slice's `sources:` field INCLUDING the
 * ones that returned nothing and including which retrieval path actually ran, because a
 * fallback that is silent is the 2026-07-30 failure where a normalisation removed the
 * property being measured and no artifact could show it.
 *
 * Nothing here ranks. There is no relevance score, because a relevance score is an invented
 * number and this product bans those. The shape is fixed -- five sources, one hop, top-3
 * churn -- precisely so that nothing needs ranking.
 *
 * Zero dependencies, Node 18+.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";

import { readRows } from "./learning.mjs";

/** The five sources, in print order. This list is the contract; nothing may be omitted. */
export const SOURCE_NAMES = ["code", "adrs", "learning", "retro", "churn"];

/** A pack that does not fit a screen has failed at its own purpose (phase-05-spec.md). */
const NEIGHBOURHOOD_CAP = 8;
const ITEM_CAP = 5;
const CHURN_TOP = 3;

/** Directories never worth walking, and a ceiling so `next` cannot become slow on a big repo. */
const SKIP_DIRS = new Set([".git", "node_modules", ".codegraph", ".venv", "dist", "build", "coverage"]);
const WALK_CAP = 4000;
const READ_CAP = 256 * 1024;

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

/** Repo-relative, forward-slashed, always. Two adapters must not disagree about shape. */
const rel = (root, abs) => relative(root, abs).split(sep).join("/");

/**
 * True only for a path that stays INSIDE the repo.
 *
 * Every path this module touches comes from a file it did not write -- a learning row's
 * `rule:` link, a line of another program's stdout. `../../../etc/passwd` is a perfectly
 * ordinary string to find in either, and without this check the pack would read it, print it,
 * and record it as a source.
 */
function insideRoot(root, candidate) {
  const abs = resolve(root, candidate);
  const base = resolve(root);
  return abs === base || abs.startsWith(base + sep);
}

/** A safe existence test: outside the repo is treated as absent, never as a file to read. */
function livesInRepo(root, p) {
  if (!p || typeof p !== "string") return false;
  if (/^[a-z]+:\/\//i.test(p)) return false;                 // a URL is not a path
  if (!insideRoot(root, p)) return false;
  try { return existsSync(resolve(root, p)); } catch { return false; }
}

const isDir = (p) => { try { return statSync(p).isDirectory(); } catch { return false; } };

/** Every file under a directory, capped, skipping the directories nobody wants in a pack. */
function walk(dir, root, out = [], budget = { n: WALK_CAP }) {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    if (budget.n <= 0) return out;
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      walk(join(dir, e.name), root, out, budget);
    } else if (e.isFile()) {
      budget.n--;
      out.push(rel(root, join(dir, e.name)));
    }
  }
  return out;
}

const uniqSorted = (xs) => [...new Set(xs)].sort();

/** Word tokens, for the area and tag matching. Lowercased, punctuation split, dedup. */
function tokens(text) {
  return new Set(String(text ?? "").toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 1));
}

// ---------------------------------------------------------------------------
// Source 1 -- the code neighbourhood, behind an interface with two real implementations
// ---------------------------------------------------------------------------

/**
 * Path-like tokens out of another program's stdout, kept only if the repo really holds them.
 *
 * Deliberately tolerant about the FORM (a `path:line` suffix, surrounding punctuation) and
 * strict about the FACT (the file exists, inside this repo). Over-fitting to one version of
 * codegraph's output would make the adapter break silently the day that output changes; this
 * degrades to fewer items, and fewer items is visible in the pack.
 */
export function parsePaths(stdout, root) {
  const found = [];
  for (const raw of String(stdout ?? "").split(/\s+/)) {
    let t = raw.trim();
    if (!t) continue;
    t = t.replace(/^[("'`[]+/, "").replace(/[)"'`\],.;]+$/, "");
    t = t.replace(/:\d+(?::\d+)?$/, "");                       // path:line[:col]
    t = t.replace(/\\/g, "/").replace(/^\.\//, "");
    if (!/[/.]/.test(t)) continue;
    if (!livesInRepo(root, t)) continue;
    if (isDir(resolve(root, t))) continue;
    found.push(t);
  }
  return uniqSorted(found);
}

/** The real implementation: ask codegraph. Returns null when it cannot answer. */
function codegraphNeighbourhood(root, files, env) {
  const cmd = env.ARC_CODEGRAPH_CMD || "codegraph";
  const extra = String(env.ARC_CODEGRAPH_ARGS || "").split(/\s+/).filter(Boolean);
  const query = files.slice(0, 4).join(" ") || root;
  try {
    // A node script is spawned through node: `ARC_CODEGRAPH_CMD` naming a `.mjs` is the test
    // seam that lets the codegraph leg run on a machine with no index. Nothing is shell-split
    // beyond ARC_CODEGRAPH_ARGS, so a path containing spaces cannot smuggle an argument.
    const isNodeScript = /\.(mjs|cjs|js)$/i.test(cmd);
    const bin = isNodeScript ? process.execPath : cmd;
    const args = isNodeScript ? [cmd, ...extra, "explore", query] : [...extra, "explore", query];
    const stdout = execFileSync(bin, args, {
      cwd: root, encoding: "utf8", timeout: 15000, maxBuffer: 4 * 1024 * 1024,
      stdio: ["ignore", "pipe", "ignore"],
    });
    const items = parsePaths(stdout, root);
    if (!items.length) return { failed: "returned no path this repo holds" };
    return { items };
  } catch (e) {
    const why = e?.status !== undefined && e.status !== null ? `exit ${e.status}`
      : e?.code === "ETIMEDOUT" ? "timed out"
      : e?.code === "ENOENT" ? "not installed"
      : `exit ${e?.code ?? "unknown"}`;
    return { failed: why };
  }
}

/**
 * The fallback, and a real implementation rather than a stub: the blast radius itself, plus
 * the files that name any of it. Both halves matter -- glob answers "what is this slice", grep
 * answers "who else cares".
 */
function grepNeighbourhood(root, files) {
  const seed = [];
  for (const f of files) {
    const abs = resolve(root, f);
    if (isDir(abs)) seed.push(...walk(abs, root));
    else if (livesInRepo(root, f)) seed.push(f);
  }
  const names = [...new Set(seed.map((f) => f.split("/").pop()).filter((n) => n && n.length > 2))];
  const hits = [];
  // A walk that stops early has SEARCHED LESS than it claims to have searched, and a pack
  // that cannot say so is the silent-fallback failure one level down. The budget is reported.
  const budget = { n: WALK_CAP };
  if (names.length) {
    for (const cand of walk(root, root, [], budget)) {
      if (seed.includes(cand)) continue;
      const abs = resolve(root, cand);
      let size = 0;
      try { size = statSync(abs).size; } catch { continue; }
      if (size > READ_CAP || size === 0) continue;
      let text = "";
      try { text = readFileSync(abs, "utf8"); } catch { continue; }
      if (names.some((n) => text.includes(n))) hits.push(cand);
    }
  }
  const items = uniqSorted([...seed, ...hits]);
  return budget.n <= 0 ? { items, truncated: WALK_CAP } : { items };
}

/**
 * The neighbourhood, and WHICH path produced it. `ran` is never absent and never a guess:
 * codegraph runs only when this repo actually holds an index, and any failure downgrades to
 * grep carrying the reason rather than reporting an empty neighbourhood as a result.
 */
export function neighbourhood(root, files, env = process.env) {
  const fallback = (why) => {
    const { items, truncated } = grepNeighbourhood(root, files);
    const note = truncated ? `${why}, search stopped at ${truncated} files` : why;
    return { ran: "grep-fallback", note, items: items.slice(0, NEIGHBOURHOOD_CAP), total: items.length };
  };
  if (!existsSync(join(root, ".codegraph"))) return fallback("no .codegraph/");
  const got = codegraphNeighbourhood(root, files, env);
  if (got.items) return { ran: "codegraph", items: got.items.slice(0, NEIGHBOURHOOD_CAP), total: got.items.length };
  return fallback(`codegraph ${got.failed}`);
}

// ---------------------------------------------------------------------------
// Source 2 -- governing ADRs
// ---------------------------------------------------------------------------

export function adrs(root, brief, lane) {
  const dir = join(root, "docs", "adr");
  const cited = new Set(String(brief?.adrs ?? "").match(/\d{4}/g) ?? []);
  const out = new Set();
  let files = [];
  try { files = readdirSync(dir).filter((f) => /^\d{4}.*\.md$/.test(f)); } catch { files = []; }
  for (const f of files) {
    const num = f.slice(0, 4);
    if (cited.has(num)) { out.add(num); continue; }
    if (!lane) continue;
    let head = "";
    try { head = readFileSync(join(dir, f), "utf8").slice(0, 2048); } catch { continue; }
    // `**Product:** \`develop\`` — the lane token inside backticks on the Product line only.
    const m = head.match(/^[ \t>*_]*\**Product:\**[ \t]*(.*)$/im);
    if (m && new RegExp("`" + lane.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "`").test(m[1])) out.add(num);
  }
  const all = [...out].sort();
  return { items: all.slice(0, ITEM_CAP).map((n) => `ADR-${n}`), total: all.length };
}

// ---------------------------------------------------------------------------
// Source 3 -- learning rows, and their links followed exactly one hop
// ---------------------------------------------------------------------------

/** The typed links a row may carry. One hop means: these, and nothing they in turn name. */
const LINK_KEYS = ["adr", "rule", "fixture", "phase"];
/** Row fields that hold a path, used for blast-radius overlap. */
const PATH_KEYS = ["fixture", "rule", "check"];

const overlaps = (a, b) => a === b || a.startsWith(b + "/") || b.startsWith(a + "/");

export function learning(root, files, corpus) {
  const path = join(root, "docs", "develop", "learning-ledger.md");
  if (!existsSync(path)) return { items: [], total: 0, note: "no learning ledger" };
  let rows = [];
  try { rows = readRows(readFileSync(path, "utf8")).rows; } catch { return { items: [], total: 0, note: "unreadable" }; }

  const matched = [];
  for (const r of rows) {
    const f = r.fields ?? {};
    const area = String(f.area ?? "").trim().toLowerCase();
    const byArea = area && corpus.has(area);
    const byPath = PATH_KEYS.some((k) => {
      const v = String(f[k] ?? "").trim().replace(/\\/g, "/").replace(/^\.\//, "");
      return v && files.some((file) => overlaps(file, v));
    });
    if (byArea || byPath) matched.push(r);
  }

  // ONE HOP. The links of a matched row are read from the ROW, never from the target: the
  // target is never opened, so nothing it names can reach the pack. That is the boundary, and
  // it is enforced by not having the code that would cross it.
  const items = matched.map((r) => {
    const f = r.fields ?? {};
    const links = LINK_KEYS
      .map((k) => (String(f[k] ?? "").trim() ? `${k}:${String(f[k]).trim()}` : null))
      .filter(Boolean);
    return links.length ? `${r.id} → ${links.join(", ")}` : `${r.id} (no typed link)`;
  });
  return { items: items.slice(0, ITEM_CAP), total: items.length, rows: matched };
}

// ---------------------------------------------------------------------------
// Source 4 -- retro patterns, matched on tag overlap
// ---------------------------------------------------------------------------

export function retro(root, corpus) {
  const path = join(root, "docs", "retro-log.md");
  if (!existsSync(path)) return { items: [], total: 0, note: "no retro log" };
  let text = "";
  try { text = readFileSync(path, "utf8"); } catch { return { items: [], total: 0, note: "unreadable" }; }

  const hits = [];
  for (const line of text.split(/\r?\n/)) {
    if (/^\s*>/.test(line)) continue;                                   // the file's own preamble
    const cols = line.split("|").map((c) => c.trim());
    if (cols.length < 5) continue;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(cols[0])) continue;
    const tags = cols[cols.length - 1].split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);
    if (!tags.length || !tags.some((t) => corpus.has(t))) continue;
    const pattern = cols[2].length > 72 ? cols[2].slice(0, 69) + "..." : cols[2];
    hits.push(`${cols[0]} · ${pattern} [${tags.join(",")}]`);
  }
  return { items: hits.slice(0, ITEM_CAP), total: hits.length };
}

// ---------------------------------------------------------------------------
// Source 5 -- churn, computed from git log and never estimated
// ---------------------------------------------------------------------------

export function churn(root, files) {
  if (!files.length) return { items: [], total: 0, note: "empty blast radius" };
  let out = "";
  try {
    out = execFileSync("git", ["log", "--format=%H", "--name-only", "--", ...files], {
      cwd: root, encoding: "utf8", timeout: 20000, maxBuffer: 8 * 1024 * 1024,
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return { items: [], total: 0, note: "no git history" };
  }
  const counts = new Map();
  for (const line of out.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || /^[0-9a-f]{40}$/i.test(t)) continue;
    const p = t.replace(/\\/g, "/");
    counts.set(p, (counts.get(p) ?? 0) + 1);
  }
  if (!counts.size) return { items: [], total: 0, note: "no commits touch the blast radius" };
  // Count descending, then path ascending -- a tie must not depend on Map insertion order,
  // or the same repo prints a different pack on two machines.
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return { items: ranked.slice(0, CHURN_TOP).map(([p, n]) => `${p} (${n})`), total: ranked.length };
}

// ---------------------------------------------------------------------------
// Assembly
// ---------------------------------------------------------------------------

/** The slice's file set: the phase's blast radius, plus any path the slice's own title names. */
export function fileSet(root, brief, slice) {
  const raw = String(brief?.["blast-radius"] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const fromTitle = [...String(slice?.fields?.title ?? "").matchAll(/`([^`\n]+)`/g)]
    .map((m) => m[1].trim())
    .filter((t) => /[/.]/.test(t) && !/\s/.test(t));
  const all = [...raw, ...fromTitle]
    .map((t) => t.replace(/\\/g, "/").replace(/^\.\//, ""))
    .filter((t) => t !== "(none)" && livesInRepo(root, t));
  return uniqSorted(all);
}

export function buildPack({ root, brief, slice, lane, env = process.env }) {
  const files = fileSet(root, brief, slice);

  const code = neighbourhood(root, files, env);
  const adr = adrs(root, brief, lane);

  // The corpus every "matched on area / matched on tag" question is answered against: the
  // slice's own words and its paths. Stated here rather than hidden in two matchers, because
  // a retrieval nobody can predict is a retrieval nobody trusts.
  const corpus = tokens(`${slice?.fields?.title ?? ""} ${files.join(" ")}`);
  const learn = learning(root, files, corpus);
  // A matched row's own area and tag widen the retro corpus by exactly one hop, the same
  // rule the links follow -- never the areas of rows that did not match.
  for (const r of learn.rows ?? []) {
    for (const k of ["area", "tag"]) {
      const v = String(r.fields?.[k] ?? "").trim().toLowerCase();
      if (v) corpus.add(v);
    }
  }
  const ret = retro(root, corpus);
  const ch = churn(root, files);

  return {
    files,
    sources: [
      { name: "code", ran: code.ran, note: code.note, items: code.items, total: code.total },
      { name: "adrs", items: adr.items, total: adr.total, note: adr.note },
      { name: "learning", items: learn.items, total: learn.total, note: learn.note },
      { name: "retro", items: ret.items, total: ret.total, note: ret.note },
      { name: "churn", items: ch.items, total: ch.total, note: ch.note },
    ],
  };
}

/**
 * The printed pack. The count sits in an ASCII bracket before the items so a consumer -- a
 * test, a person, a later command -- can split the line without depending on a multi-byte
 * separator surviving whatever locale it is read under.
 */
export function renderPack(pack, sliceId) {
  const lines = [`Context Pack — slice ${sliceId} · one hop (ADR-0111)`];
  const width = Math.max(...SOURCE_NAMES.map((n) => n.length));
  for (const s of pack.sources) {
    const label = s.name.padEnd(width, " ");
    const lead = s.name === "code" ? `${s.ran}${s.note ? ` (${s.note})` : ""} ` : "";
    const shown = s.items.length ? s.items.join(", ") : "(none)";
    const more = s.total > s.items.length ? ` (+${s.total - s.items.length} more)` : "";
    const why = !s.items.length && s.note && s.name !== "code" ? ` — ${s.note}` : "";
    lines.push(`  ${label}  ${lead}[${s.total}] ${shown}${more}${why}`);
  }
  return lines;
}

/**
 * The `sources:` value: every source named, including the ones that returned nothing, and the
 * retrieval path that actually ran. Anything already on the line that is NOT one of the five
 * source tokens is preserved -- the spec reference `start` wrote is the audit trail's first
 * entry and re-running `next` must not erase it.
 */
export function sourcesField(previous, pack) {
  const keep = String(previous ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((t) => !SOURCE_NAMES.some((n) => t === n || t.startsWith(`${n}(`) || t.startsWith(`${n}:`)));
  const computed = pack.sources.map((s) =>
    s.name === "code" ? `code:${s.ran}(${s.total})` : `${s.name}(${s.total})`);
  return [...keep, ...computed].join(", ");
}
