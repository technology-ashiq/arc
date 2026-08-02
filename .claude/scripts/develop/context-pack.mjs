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
import { existsSync, readFileSync, readdirSync, realpathSync, statSync } from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";

import { isFilled } from "./ledger.mjs";
import { readRows } from "./learning.mjs";

/** The five sources, in print order. This list is the contract; nothing may be omitted. */
export const SOURCE_NAMES = ["code", "adrs", "learning", "retro", "churn"];

/** A pack that does not fit a screen has failed at its own purpose (phase-05-spec.md). */
const NEIGHBOURHOOD_CAP = 8;
const ITEM_CAP = 5;
const CHURN_TOP = 3;
/** How many blast-radius files codegraph is asked about. Declared in the pack when it bites. */
const CODEGRAPH_QUERY_FILES = 4;

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
  const base = real(resolve(root));
  const abs = real(resolve(root, candidate));
  return abs === base || abs.startsWith(base + sep);
}

/**
 * The REAL path, links resolved. Comparing resolved strings is not containment: a symlink or a
 * Windows junction inside the repo is a string under the root that names a file outside it, and
 * an adversarial pass walked one out of the tree and had the pack print what it found there.
 * A path that does not exist cannot be followed, so it falls back to the lexical form -- which
 * is still checked, and still rejected if it escapes.
 */
function real(p) {
  try { return realpathSync.native(p); } catch { return p; }
}

/**
 * Case-EXACT existence. `existsSync` is case-insensitive on Windows and macOS and case-
 * sensitive on Linux, so a blast radius reading `SRC/A.JS` is kept on two CI legs and dropped
 * on the third: the same ledger then produces two different packs, and the one test asserting
 * the neighbourhood exists passes on the legs that cannot fail it.
 */
function existsExact(root, p) {
  const parts = p.split("/").filter((s) => s && s !== ".");
  let dir = resolve(root);
  for (const part of parts) {
    let names;
    try { names = readdirSync(dir); } catch { return false; }
    if (!names.includes(part)) return false;
    dir = join(dir, part);
  }
  return parts.length > 0;
}

/** A safe existence test: outside the repo is treated as absent, never as a file to read. */
function livesInRepo(root, p) {
  if (!p || typeof p !== "string") return false;
  if (/^[a-z]+:\/\//i.test(p)) return false;                 // a URL is not a path
  if (!insideRoot(root, p)) return false;
  try { return existsExact(root, p.replace(/\\/g, "/")); } catch { return false; }
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

/**
 * Word tokens, for the area and tag matching. Lowercased, punctuation split, dedup.
 *
 * The class is spelled out rather than written `a-z0-9`: a letter RANGE is resolved by the
 * active collation, so the same text tokenises differently under two locales and the pack
 * would match a learning row on one CI leg and not on another. tests/portability.bats fails
 * any new range for exactly this reason.
 */
function tokens(text) {
  return new Set(
    String(text ?? "").toLowerCase()
      .split(/[^abcdefghijklmnopqrstuvwxyz0123456789]+/)
      .filter((t) => t.length > 1),
  );
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
    // An ABSOLUTE path inside the repo is a legitimate answer -- it is what a tool run with a
    // full cwd prints -- and it was being discarded as "no path this repo holds", which then
    // went into the audit trail as a permanent false statement about another program.
    if (isAbsolute(t) || /^[A-Za-z]:\//.test(t)) {
      if (!insideRoot(root, t)) continue;
      t = relative(root, t).split(sep).join("/");
    }
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
  const query = files.slice(0, CODEGRAPH_QUERY_FILES).join(" ") || root;
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
      : e?.code === "ENOBUFS" ? "printed more than the read buffer holds"
      : `failed (${e?.code ?? "unknown"})`;    // "exit ENOBUFS" claimed an exit code it had not got
    return { failed: why };
  }
}

/**
 * The fallback, and a real implementation rather than a stub: the blast radius itself, plus
 * the files that name any of it. Both halves matter -- glob answers "what is this slice", grep
 * answers "who else cares".
 */
function grepNeighbourhood(root, files) {
  // ONE budget for every walk this call makes. It used to be per-call, so each directory in
  // the blast radius bought a fresh WALK_CAP: two directories silently searched 8000 files of
  // 9000 and reported no truncation at all. A ceiling that multiplies is not a ceiling.
  const budget = { n: WALK_CAP };
  const seed = [];
  for (const f of files) {
    const abs = resolve(root, f);
    // Containment belongs HERE, in the function that produces the paths, not only in the one
    // caller that happens to filter its input. A junction under the repo pointed outside it and
    // this walked straight through, rendering outside files as ordinary repo-relative paths.
    if (!insideRoot(root, f)) continue;
    if (isDir(abs)) seed.push(...walk(abs, root, [], budget));
    else if (livesInRepo(root, f)) seed.push(f);
  }
  const names = [...new Set(seed.map((f) => f.split("/").pop()).filter((n) => n && n.length > 2))];
  const hits = [];
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
  const all = uniqSorted([...seed, ...hits]);
  // The pack prints one comma-separated list, and its own documented contract is that a
  // consumer can split that line. A path containing ", " makes the count and the list
  // disagree and hands the consumer two paths that do not exist. Dropping it is a transform,
  // so it is declared -- which is the rule this repo already writes down about transforms.
  const items = all.filter((p) => !p.includes(","));
  const commas = all.length - items.length;
  return {
    items,
    truncated: budget.n <= 0 ? WALK_CAP : 0,
    commas,
  };
}

/**
 * The neighbourhood, and WHICH path produced it. `ran` is never absent and never a guess:
 * codegraph runs only when this repo actually holds an index, and any failure downgrades to
 * grep carrying the reason rather than reporting an empty neighbourhood as a result.
 */
export function neighbourhood(root, files, env = process.env) {
  const fallback = (why) => {
    const { items, truncated, commas } = grepNeighbourhood(root, files);
    const note = [why,
      truncated ? `search stopped at ${truncated} files` : null,
      commas ? `${commas} path(s) containing a comma omitted` : null,
    ].filter(Boolean).join(", ");
    return { ran: "grep-fallback", note, items: items.slice(0, NEIGHBOURHOOD_CAP), total: items.length };
  };
  // A DIRECTORY. A plain file named `.codegraph` satisfied `existsSync` and sent the module
  // shelling out to a binary it did not need, then reported `codegraph not installed` -- a
  // diagnostic pointing at the wrong problem entirely.
  if (!isDir(join(root, ".codegraph"))) return fallback("no .codegraph/");
  const got = codegraphNeighbourhood(root, files, env);
  if (got.items) {
    // codegraph is asked about the first few files only. The grep leg uses all of them, so
    // without this the two implementations of one interface answer different questions and
    // the pack presents the narrower answer as the neighbourhood.
    const asked = Math.min(files.length, CODEGRAPH_QUERY_FILES);
    return {
      ran: "codegraph",
      note: files.length > asked ? `asked about ${asked} of ${files.length} files` : undefined,
      items: got.items.slice(0, NEIGHBOURHOOD_CAP),
      total: got.items.length,
    };
  }
  return fallback(`codegraph ${got.failed}`);
}

// ---------------------------------------------------------------------------
// Source 2 -- governing ADRs
// ---------------------------------------------------------------------------

/**
 * The product an ADR belongs to: the FIRST backticked token on the first `Product:` line that
 * is neither inside a fence nor inside a blockquote, or null.
 *
 * Every clause of that sentence is a hole an adversarial pass walked through. The matcher used
 * to take the first line anywhere in the head that looked like a Product line, allow a `>`
 * marker in its lead, and then test whether the lane token appeared anywhere on it:
 *
 *   - `> **Product:** \`develop\`` inside a "supersedes the develop-lane rule" note claimed a
 *     design ADR for develop, while the same trick in reverse hid a develop ADR — one input,
 *     both errors at once, and the shipped fixture passed only because its real header
 *     happened to come first;
 *   - a fenced ```` **Product:** `develop` ```` EXAMPLE outranked the real header below it;
 *   - `**Product:** \`design\` — explicitly NOT \`develop\`` matched develop, because the
 *     sentence saying "not this one" contains the token.
 *
 * First-backticked-token is what makes the last case right: a Product line names one product.
 */
export function productOf(text) {
  let fence = false;
  for (const raw of String(text ?? "").split(/\r?\n/)) {
    if (/^[ \t]*(```|~~~)/.test(raw)) { fence = !fence; continue; }
    if (fence) continue;
    if (/^[ \t]*>/.test(raw)) continue;                       // a quotation is not this file's header
    if (/^[ \t]*#{1,6}[ \t]+/.test(raw)) {
      if (/^[ \t]*#{2,6}[ \t]+/.test(raw)) return null;        // past the header block entirely
      continue;
    }
    const m = raw.match(/^[ \t*_]*Product[ \t*_]*:[ \t*_]*(.*)$/i);
    if (!m) continue;
    const tok = m[1].match(/`([^`]+)`/);
    return tok ? tok[1].trim() : m[1].trim().replace(/[*_]+$/, "").trim() || null;
  }
  return null;
}

export function adrs(root, brief, lane) {
  const dir = join(root, "docs", "adr");
  // A whole token that IS a four-digit number, not any four digits found in the line. Scanning
  // loosely, a hand-edited `adrs: see 2026-08-03` pulled in ADR-2026 as a governing decision.
  const citedNums = new Set(
    String(brief?.adrs ?? "").split(/[,\s]+/)
      .map((s) => (s.trim().match(/^(?:ADR-)?(\d{4})$/i) || [])[1])
      .filter(Boolean),
  );
  const out = new Set();
  let files = [];
  try {
    files = readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isFile() && /^\d{4}.*\.md$/.test(e.name))
      .map((e) => e.name);
  } catch { files = []; }
  for (const f of files) {
    const num = f.slice(0, 4);
    if (citedNums.has(num)) { out.add(num); continue; }
    if (!lane) continue;
    let text = "";
    // The whole file, not a byte window: an ADR whose Product line sat past a 2048-byte head
    // was dropped from its own lane. ADRs are prose files; productOf stops at the first `##`.
    try { text = readFileSync(join(dir, f), "utf8"); } catch { continue; }
    if (productOf(text) === lane) out.add(num);
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

/** Path containment either way. Trailing slashes are stripped: a human writes `src/auth/` and
 * `src/auth` to mean the same directory, and only one of them used to overlap its own files. */
const overlaps = (a, b) => {
  const x = a.replace(/\/+$/, ""), y = b.replace(/\/+$/, "");
  return x === y || x.startsWith(y + "/") || y.startsWith(x + "/");
};

export function learning(root, files, corpus) {
  const path = join(root, "docs", "develop", "learning-ledger.md");
  if (!existsSync(path)) return { items: [], total: 0, note: "no learning ledger" };
  let rows = [], errors = [];
  try {
    const read = readRows(readFileSync(path, "utf8"));
    rows = read.rows; errors = read.errors ?? [];
  } catch { return { items: [], total: 0, note: "unreadable" }; }

  // readRows knows when a ledger did not parse and says so precisely -- an unterminated fence,
  // a marker its grammar will not accept, two rows claiming one id. Discarding those errors is
  // how a BROKEN ledger reported `learning [0] (none)`: indistinguishable from a repo with
  // nothing to say, and worse than a MISSING ledger, which at least said it was missing.
  const brokenNote = errors.length
    ? `${errors.length} parse error(s) in the ledger — ${errors[0].msg}`
    : null;

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
      .map((k) => {
        const v = String(f[k] ?? "").trim();
        if (!v) return null;
        // A `rule:` or `fixture:` naming something this repo does not hold is handed on as a
        // fact unless it is labelled. `rule: ../../../etc/passwd` is an ordinary string to
        // find in a markdown file, and it was being printed as the governing record's link.
        const suspect = (k === "rule" || k === "fixture") && !livesInRepo(root, v);
        return `${k}:${v}${suspect ? " (not in this repo)" : ""}`;
      })
      .filter(Boolean);
    return links.length ? `${r.id} → ${links.join(", ")}` : `${r.id} (no typed link)`;
  });
  return { items: items.slice(0, ITEM_CAP), total: items.length, rows: matched, note: brokenNote };
}

// ---------------------------------------------------------------------------
// Source 4 -- retro patterns, matched on tag overlap
// ---------------------------------------------------------------------------

/** A real calendar date, not a date SHAPE. `9999-99-99` is not a day (retro-log 2026-07-16). */
function isCalendarDate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const [y, mo, d] = m.slice(1).map(Number);
  if (mo < 1 || mo > 12 || d < 1) return false;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

export function retro(root, corpus) {
  const path = join(root, "docs", "retro-log.md");
  if (!existsSync(path)) return { items: [], total: 0, note: "no retro log" };
  let text = "";
  try { text = readFileSync(path, "utf8"); } catch { return { items: [], total: 0, note: "unreadable" }; }

  const hits = [];
  let fence = false, dated = 0, malformed = 0;
  for (const line of text.split(/\r?\n/)) {
    // Fences are content. Without this, a "copy this template" block in the log was read as a
    // finding: a row dated 2099 whose own text said it records nothing was handed to the next
    // slice as a pattern that must not repeat.
    if (/^[ \t]*(```|~~~)/.test(line)) { fence = !fence; continue; }
    if (fence) continue;
    if (/^\s*>/.test(line)) continue;                                   // the file's own preamble

    const cols = line.split("|").map((c) => c.trim());
    if (!isCalendarDate(cols[0])) continue;
    dated++;
    // EXACTLY the five columns the log's own format line declares:
    // `YYYY-MM-DD | project | pattern | prevention | tags`. Accepting "5 or more" made the
    // cycle-scoreboard rows in this very file parse as findings, with the tier letter read as
    // the pattern and a metric read as the tag list — and it turned a pattern containing a
    // pipe into a truncated half-sentence presented as the finding.
    if (cols.length !== 5) { malformed++; continue; }
    const tags = cols[4].split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);
    if (!tags.length || !tags.some((t) => corpus.has(t))) continue;
    const pattern = cols[2].length > 72 ? cols[2].slice(0, 69) + "..." : cols[2];
    hits.push(`${cols[0]} · ${pattern} [${tags.join(",")}]`);
  }
  // A file that exists, holds dated lines, and yields no row in its own format is not a repo
  // with nothing to say — it is a reader that did not read it. Say which.
  const note = !dated ? "no dated row in the log's format"
    : malformed ? `${malformed} dated line(s) are not in the log's 5-column format`
    : undefined;
  return { items: hits.slice(0, ITEM_CAP), total: hits.length, note };
}

// ---------------------------------------------------------------------------
// Source 5 -- churn, computed from git log and never estimated
// ---------------------------------------------------------------------------

export function churn(root, files) {
  if (!files.length) return { items: [], total: 0, note: "empty blast radius" };
  let out = "";
  try {
    // `core.quotePath=false`: git's default C-quotes any path outside ASCII, so
    // `src/auth/café.js` arrives as `"src/auth/caf\303\251.js"`. The separator normalisation
    // below then read those octal escapes as directories and the pack's TOP-RANKED churn
    // entry was `"src/auth/caf/303/251.js"` -- a path that exists nowhere, printed with a
    // computed count beside it. Git emits forward slashes on every platform, so there is no
    // separator to normalise and nothing left that a backslash could legitimately mean.
    out = execFileSync("git", ["-c", "core.quotePath=false", "log", "--format=%H", "--name-only", "--", ...files], {
      cwd: root, encoding: "utf8", timeout: 20000, maxBuffer: 8 * 1024 * 1024,
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch (e) {
    // WHY it failed, never a single stock sentence. `no git history` was printed for a repo
    // with four commits and a syntax error in .git/config, for git not being installed, for
    // the timeout and for the buffer cap alike -- four different problems, one false answer.
    const why = e?.code === "ENOENT" ? "git is not installed"
      : e?.code === "ETIMEDOUT" ? "git log timed out"
      : e?.code === "ENOBUFS" ? "git log output exceeded the read buffer"
      : e?.status ? `git log exited ${e.status}`
      : "no git history";
    return { items: [], total: 0, note: why };
  }
  const counts = new Map();
  for (const line of out.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || /^[0-9a-f]{40}$/i.test(t)) continue;
    counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  if (!counts.size) return { items: [], total: 0, note: "no commits touch the blast radius" };

  // History names paths the tree no longer holds. A renamed or deleted file kept its commits
  // and was handed to the next slice as a blast-radius file it could open -- two of three
  // printed paths, in one attack. Renames are NOT followed: `--follow` takes a single path and
  // this is a set, so the honest move is to drop the dead paths and say how many.
  const live = [...counts.entries()].filter(([p]) => livesInRepo(root, p));
  const dead = counts.size - live.length;
  if (!live.length) {
    return { items: [], total: 0, note: `${dead} path(s) in the history are no longer in the tree; renames are not followed` };
  }
  // Count descending, then path ascending BY CODE POINT. `localeCompare` returns 0 for
  // canonically-equivalent strings, which drops the sort back to git-log order, and with no
  // locale argument it uses the host collator -- so a Swedish dev box and an en CI runner
  // ordered the same repo differently. Every other list here sorts by code point; so does this.
  const ranked = live.sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  return {
    items: ranked.slice(0, CHURN_TOP).map(([p, n]) => `${p} (${n})`),
    total: ranked.length,
    note: dead ? `${dead} path(s) in the history are no longer in the tree; renames are not followed` : undefined,
  };
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
    .map((t) => t.replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/+$/, ""))
    // `.` is a legal path that names the whole repository. Left in, the neighbourhood becomes
    // every file and churn ranks the entire history, with nothing in the pack saying that the
    // blast radius was in effect unbounded.
    .filter((t) => t && t !== "." && t !== ".." && t !== "(none)")
    .filter((t) => livesInRepo(root, t));
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
    // The note prints whether or not the source returned items. A ledger that half-parsed
    // still half-parsed, and a source that says nothing about itself while returning three
    // rows is the same silence as one that returns none.
    const why = s.note && s.name !== "code" ? ` — ${s.note}` : "";
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
/**
 * A token this function itself wrote on a previous run, and therefore the only kind it may
 * remove. The old filter dropped anything STARTING with a source name, which is a shape a
 * person writes too: `learning: L-101 was applied by hand` vanished, and
 * `churn: ignored, the file moved` half-vanished, leaving `the file moved` reading as an
 * independent claim. A writer may only take back exactly what it put down.
 */
const MACHINE_TOKEN = /^(?:code:[a-z-]+|adrs|learning|retro|churn)\([^)]*\)$/;

export function sourcesField(previous, pack) {
  const keep = String(previous ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((t) => !MACHINE_TOKEN.test(t))
    .filter((t) => isFilled(t));            // `(empty until proven)` is not an audit trail entry
  const computed = pack.sources.map((s) => {
    if (s.name !== "code") return `${s.name}(${s.total})`;
    // The REASON is persisted, not just the path name. Without it "no index" and "the index
    // crashed" are byte-identical a week later, which is the silent-fallback failure the
    // field exists to prevent, one level in.
    return `code:${s.ran}(${s.total}${s.note ? `; ${s.note}` : ""})`;
  });
  return [...keep, ...computed].join(", ");
}
