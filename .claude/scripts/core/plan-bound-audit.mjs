#!/usr/bin/env node
// plan-bound-audit.mjs -- every write verb measured, not assumed (face v2 Phase 14, REQ-18, ADR-1353).
//
// core/plan-expect.mjs holds the guarantee that an apply writes only what its plan showed: `staleReason` refuses
// PLAN_STALE when the digest moved, `spineRefusal` asks the spine before a branch or a file is written. Phases 15 and 16
// lean on that guarantee. Nothing counted which verbs honour it, so this lists every script under `.claude/scripts`
// that writes the spine or a tracked file, and says whether each write sits behind such a check.
//
//   node .claude/scripts/core/plan-bound-audit.mjs [--root DIR] [--allowlist FILE]
//
// One line per write verb:   <verb> · <file> · <writes-to> · plan-bound <yes|no|unknown>[ · allowlisted]
// then a SCRATCH line per verb with writes read as scratch, and one summary line. Exit 0 when every verb not bound is
// allowlisted with a reason; 1 when one is not, when an allowlist row is malformed, stale or names a verb now bound, or
// when the run read no write verb at all; 2 on a usage error, an unreadable allowlist, or a file the walk cannot read.
//
// WHAT THE DETECTION SEES, AND WHAT IT DESTROYS. It is lexical, per file, after comments and string contents are
// blanked -- no data flow (the phase spec's rabbit hole). So:
//   - a WRITE is a call to an fs mutator (by its imported name or alias, sync, callback or promise form, deletion
//     included), a `git` write subcommand, or a spine emit (`emitReceipt` / `appendEvent` by name or alias, or the
//     emitter's argv with `emit` and no `--dry-run`). rename, copy and cp are judged by their DESTINATION.
//   - a write whose destination expression carries a scratch word (tmp, temp, lock, cache, state, snapshot...) and no
//     `..` is a scratch write. Scratch writes are not rows, but they are COUNTED and printed by verb on a SCRATCH line,
//     so a tracked file whose path merely carries such a word is visible to the reader, never silently dropped. A
//     spine word (events, spine) wins over `state`, because the spine lives under .claude/state/hq/events.
//   - ONE CALL HOP: a relative import of a name whose declaration in that file writes makes each call of it in the
//     importer a write of the importer, judged against the importer's own guards. Deeper chains are not followed.
//   - a GUARD is a call to `staleReason(` or `spineRefusal(` whose RESULT gates: it sits in an `if (` condition, or it
//     is assigned to a name that a later `if (`, `?`, `&&` or `||` reads before the write. A guard whose result is
//     dropped is no guard. A write is bound when such a guard comes before it in the same top-level declaration. A
//     guard only after the write there is write-before-check: `no`. A write in a declaration with no guard, in a file
//     that guards elsewhere, cannot be decided without data flow: `unknown`, which fails like `no`.
//   - a `.sh` verb cannot call either guard, so a shell writer is never bound. A script the walk cannot parse (`.py`,
//     `.ps1`, `.cjs`, `.ts`) is listed as `tracked-file · plan-bound unknown`: never passed by default.
//   - a spawned program that is not git or the emitter is not followed; when it is an arc script it is audited on its
//     own row, because this walk covers every file under `.claude/scripts`.
//   - a template literal is blanked whole, so a write inside its `${}` is not seen; a guard inside an unbraced `if` is
//     judged by position, not by branch.

import { lstatSync, readFileSync, readdirSync, realpathSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
// LS and PS end a line comment too; built from code points so no invisible character sits in this file.
const EOL = new RegExp("[\n\r" + String.fromCharCode(0x2028, 0x2029) + "]");

/** Blank comments and the inside of string, template and regex literals, keeping offsets and line ends. */
export function blank(src) {
  const out = src.split("");
  const n = src.length;
  let i = 0;
  let prev = ""; // last significant char outside literals, to tell a regex from a division
  const wipe = (a, b) => { for (let k = a; k < b; k++) if (!EOL.test(out[k])) out[k] = " "; };
  const lineEnd = (from) => { for (let k = from; k < n; k++) if (EOL.test(src[k])) return k; return n; };
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (c === "/" && d === "/") { const end = lineEnd(i); wipe(i, end); i = end; continue; }
    if (c === "/" && d === "*") { const e = src.indexOf("*/", i + 2); const end = e < 0 ? n : e + 2; wipe(i, end); i = end; continue; }
    if (c === '"' || c === "'" || c === "`") {
      let j = i + 1;
      while (j < n && src[j] !== c) { if (src[j] === "\\") j++; else if (c !== "`" && EOL.test(src[j])) break; j++; }
      wipe(i + 1, Math.min(j, n)); i = j + 1; prev = c; continue;
    }
    if (c === "/" && (prev === "" || "(,=:[!&|?{};+-*%<>~^".includes(prev) || /\b(return|typeof|case|of|in)$/.test(src.slice(Math.max(0, i - 7), i).trimEnd()))) {
      let j = i + 1, cls = false;
      while (j < n && !EOL.test(src[j])) { if (src[j] === "\\") { j += 2; continue; } if (src[j] === "[") cls = true; else if (src[j] === "]") cls = false; else if (src[j] === "/" && !cls) break; j++; }
      if (src[j] === "/") { wipe(i + 1, j); i = j + 1; prev = "/"; continue; }
    }
    if (!/\s/.test(c)) prev = c;
    i++;
  }
  return out.join("");
}

/** The [start, end) of each top-level declaration: a run of code that closes back to brace depth zero. */
function topLevelUnits(code) {
  const units = [];
  let depth = 0, start = 0;
  for (let i = 0; i < code.length; i++) {
    const c = code[i];
    if (c === "{") { if (depth === 0) start = i; depth++; }
    else if (c === "}") { depth = Math.max(0, depth - 1); if (depth === 0) units.push([start, i + 1]); }
  }
  return units;
}
const unitOf = (units, at) => { for (const u of units) if (at >= u[0] && at < u[1]) return u; return null; };

// Every fs member that changes a file, in its sync, callback and promise forms. rename/copy/cp: the destination is arg 1.
const FS_MUTATORS = {
  writeFileSync: 0, writeFile: 0, appendFileSync: 0, appendFile: 0, createWriteStream: 0, truncateSync: 0, truncate: 0,
  renameSync: 1, rename: 1, copyFileSync: 1, copyFile: 1, cpSync: 1, cp: 1,
  unlinkSync: 0, unlink: 0, rmSync: 0, rm: 0, writeSync: 0, write: 0,
};
const GIT_WRITES = new Set(["commit", "update-ref", "hash-object", "worktree", "push", "merge", "cherry-pick", "tag", "checkout",
  "reset", "branch", "switch", "symbolic-ref", "replace", "mktag", "rebase", "revert", "add", "rm", "mv", "stash", "notes", "apply", "am", "restore"]);

// The read-only forms of write subcommands: `git branch --show-current`, `git symbolic-ref --short HEAD`, `git stash list`.
const GIT_READ_FLAGS = /^(--show-current|--list|-l|-a|-r|--all|--remotes|--contains|--merged|--no-merged|-v|-vv|--verify|--short|-q|--format=.*|--points-at)$/;
/** `toks` is everything after `git`'s own options: the subcommand first. */
export function isGitWrite(toks) {
  const [sub, ...rest] = toks;
  if (!GIT_WRITES.has(sub)) return false;
  const pos = rest.filter((t) => !t.startsWith("-"));
  if (sub === "branch" || sub === "tag") return pos.length > 0 && !rest.some((t) => GIT_READ_FLAGS.test(t));
  if (sub === "symbolic-ref") return pos.length >= 2 && !rest.includes("--short");
  if (sub === "stash" || sub === "worktree" || sub === "notes") return !["list", "show"].includes(pos[0]);
  return true;
}

// Words, not substrings: "attempt" holds "temp" and "block" holds "lock", and a substring match would drop a tracked
// write as scratch.
const words = (text) => new Set(text.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase().split(/[\W_]+/).filter(Boolean));
const SCRATCH_WORDS = ["tmp", "temp", "tmpdir", "mkdtemp", "scratch", "cache", "lock", "locks", "state", "snapshot"];
const isScratch = (text) => { if (/\.\./.test(text)) return false; const w = words(text); return SCRATCH_WORDS.some((s) => w.has(s)); };
const isSpine = (text) => { const w = words(text); return w.has("events") || w.has("spine"); };

/** The argument text of the call whose `(` is at `open`, read from the RAW source so path words are visible. */
function argText(src, open) {
  let depth = 0;
  for (let j = open; j < src.length && j < open + 1200; j++) {
    if (src[j] === "(") depth++;
    else if (src[j] === ")") { depth--; if (depth === 0) return src.slice(open + 1, j); }
  }
  return src.slice(open + 1, open + 1200);
}

/** Top-level commas only, so `join(a, b)` stays one argument. Brackets are counted on the BLANKED text. */
function splitArgs(raw, code) {
  const parts = [];
  let depth = 0, from = 0;
  for (let k = 0; k < code.length; k++) {
    const c = code[k];
    if ("([{".includes(c)) depth++;
    else if (")]}".includes(c)) depth--;
    else if (c === "," && depth === 0) { parts.push(raw.slice(from, k)); from = k + 1; }
  }
  parts.push(raw.slice(from));
  return parts;
}

/** `import { a, b as c } from "x"` -> [{ from: "x", names: Map(local -> imported) }]. Read from the raw source. */
function imports(src) {
  const out = [];
  for (const m of src.matchAll(/\bimport\s*\{([^}]*)\}\s*from\s*["']([^"']+)["']/g)) {
    const names = new Map();
    for (const part of m[1].split(",")) {
      const t = part.trim().split(/\s+as\s+/);
      if (t[0]) names.set((t[1] || t[0]).trim(), t[0].trim());
    }
    out.push({ from: m[2], names });
  }
  // `const { a, b: c } = await import("x")` and `= require("x")`: the same names, bound at run time.
  for (const m of src.matchAll(/\{([^{}]*)\}\s*=\s*(?:await\s+)?(?:import|require)\s*\(\s*["']([^"']+)["']\s*\)/g)) {
    const names = new Map();
    for (const part of m[1].split(",")) {
      const t = part.trim().split(/\s*:\s*/);
      if (t[0]) names.set((t[1] || t[0]).trim(), t[0].trim());
    }
    out.push({ from: m[2], names });
  }
  return out;
}

/** The local names under which a set of members is imported from any of `modules`, mapped to the member's name. */
function localNames(src, modules, members) {
  const local = new Map();
  for (const im of imports(src)) {
    if (!modules.some((mod) => mod === im.from || im.from.endsWith(mod))) continue;
    for (const [as, real] of im.names) if (members.includes(real)) local.set(as, real);
  }
  return local;
}
const esc = (s) => s.replace(/[$]/g, "\\$");

/**
 * Every write site in a `.mjs`/`.js` source: { at, to: "spine"|"tracked-file"|"scratch" }.
 * `hop` maps a local name imported from a writing library to that library's writes-to.
 */
export function jsWrites(src, code = blank(src), hop = new Map()) {
  const sites = [];
  // Member calls on any object (`fs.writeFileSync(`, `fsp.writeFile(`) and bare calls of names imported from fs.
  const fsLocal = localNames(src, ["node:fs", "fs", "node:fs/promises", "fs/promises"], Object.keys(FS_MUTATORS));
  const nsFs = /\bimport\s+(?:\*\s+as\s+)?(\w+)\s+from\s+["'](?:node:)?fs(?:\/promises)?["']/.exec(src)?.[1];
  const fsNs = new Set(["fs", "fsp", "promises", nsFs].filter(Boolean));
  const call = new RegExp(`(?:\\b(\\w+)\\s*\\.\\s*)?\\b(${[...new Set([...Object.keys(FS_MUTATORS), ...fsLocal.keys()])].map(esc).join("|")})\\s*\\(`, "g");
  for (const m of code.matchAll(call)) {
    const [, obj, name] = m;
    const real = obj ? (fsNs.has(obj) || /^fs/i.test(obj) ? name : null) : fsLocal.get(name);
    if (!real || !(real in FS_MUTATORS)) continue;
    const open = m.index + m[0].length - 1;
    const rawArgs = argText(src, open), blankArgs = argText(code, open);
    const args = splitArgs(rawArgs, blankArgs);
    let dest = (args[FS_MUTATORS[real]] ?? args[0] ?? "").trim();
    if (real === "writeSync" || real === "write") {
      // On a standard stream it is output, not a file. On an fd, the file is whatever the nearest earlier
      // `fd = openSync(path, ...)` opened; with none in sight the fd is unknown, and counts as a tracked write.
      if (/^(1|2|process\.(stdout|stderr)\.fd)$/.test(dest)) continue;
      if (real === "write" && !obj && !fsLocal.has(name)) continue;
      if (/^\w+$/.test(dest)) {
        const opens = [...code.slice(0, m.index).matchAll(new RegExp(`\\b${esc(dest)}\\s*=\\s*(?:\\w+\\s*\\.\\s*)?openSync\\s*\\(`, "g"))];
        const last = opens[opens.length - 1];
        if (last) dest = (splitArgs(argText(src, last.index + last[0].length - 1), argText(code, last.index + last[0].length - 1))[0] || dest).trim();
      }
    }
    const to = isSpine(dest) ? "spine" : isScratch(dest) ? "scratch" : "tracked-file";
    sites.push({ at: m.index, to, what: `${real}(${dest.replace(/\s+/g, " ").slice(0, 60)})` });
  }
  // The emitter's writers, by name or alias.
  const emitLocal = localNames(src, ["plan-expect.mjs", "spine-io.mjs"], ["emitReceipt", "appendEvent", "appendEventUnlocked"]);
  for (const n of ["emitReceipt", "appendEvent", "appendEventUnlocked"]) if (!emitLocal.has(n)) emitLocal.set(n, n);
  for (const m of code.matchAll(new RegExp(`\\b(${[...emitLocal.keys()].map(esc).join("|")})\\s*\\(`, "g"))) {
    if (/\b(function|async function)\s*$/.test(code.slice(Math.max(0, m.index - 16), m.index))) continue;
    sites.push({ at: m.index, to: "spine", what: emitLocal.get(m[1]) });
  }
  // The emitter's argv built as an array: any array that holds the word `emit` and an emitter constant, or `...emit`.
  for (const m of code.matchAll(/\[/g)) {
    const end = code.indexOf("]", m.index);
    if (end < 0) continue;
    const arr = src.slice(m.index, end + 1);
    const head = code.slice(m.index, end + 1);
    const names = /\b\w*(arc_?event|ARC_?EVENT|arcEvent|emitter|EMITTER)\w*\b/i.test(head) || /arc-event/.test(arr);
    if (!names || /--dry-run/.test(arr)) continue;
    if (/["'`]emit["'`]/.test(arr) || /\.\.\.\s*\w*emit\w*/i.test(head)) sites.push({ at: m.index, to: "spine", what: "arc-event emit" });
  }
  // git, by a literal "git" or a constant holding it, with a write subcommand as its first non-option argument.
  // A constant that holds "git" in any case, so `const Git = "git"` is a git binary too.
  const gitConsts = new Set([...src.matchAll(/\b(?:const|let|var)\s+(\w+)\s*=\s*["'`]git(?:\.exe)?["'`]/gi)].map((g) => g[1]));
  const isGitBin = (bin) => /^["'`]git(\.exe)?["'`]$/i.test(bin) || /^\w*GIT\w*$/.test(bin) || gitConsts.has(bin) || /^["'`]git\s/i.test(bin);
  // A file's own git wrappers: a declaration whose spawn of git takes its argv from a parameter, not a literal array.
  const units = topLevelUnits(code);
  const gitHelpers = new Set();
  const judgeGit = (at, argv) => {
    // Every element: a string literal's content, or VAR for anything else -- so `-C root` still skips two and a
    // variable SUBCOMMAND is unknown, which counts as a write (fail closed: it costs a row, never hides one).
    const toks = splitArgs(argv.raw, argv.blank).map((t) => t.trim()).filter(Boolean).map((t) => (/^["'`][^"'`]*["'`]$/.test(t) ? t.slice(1, -1) : "\0VAR"));
    let k = 0;
    while (k < toks.length && toks[k].startsWith("-")) k += toks[k] === "-C" || toks[k] === "-c" ? 2 : 1;
    if (k >= toks.length) return;
    if (toks[k] === "\0VAR" || toks[k].startsWith("...") || isGitWrite(toks.slice(k))) sites.push({ at, to: "tracked-file", what: `git ${toks[k] === "\0VAR" ? "(a variable subcommand)" : toks[k]}` });
  };
  /** The inside of the array literal at the start of `raw`, or null. */
  const arrayOf = (raw, blank) => {
    const r = raw.trimStart(), off = raw.length - r.length;
    if (r[0] !== "[") return null;
    let depth = 0;
    for (let j = 0; j < r.length; j++) {
      if (blank[off + j] === "[") depth++;
      else if (blank[off + j] === "]" && --depth === 0) return { raw: r.slice(1, j), blank: blank.slice(off + 1, off + j) };
    }
    return null;
  };
  for (const m of code.matchAll(/\b(spawnSync|execFileSync|spawn|execFile|execSync|exec)\s*\(/g)) {
    const open = m.index + m[0].length - 1;
    const raw = argText(src, open), blk = argText(code, open);
    const partsRaw = splitArgs(raw, blk), partsBlank = splitArgs(blk, blk);
    const bin = (partsRaw[0] || "").trim();
    if (!isGitBin(bin)) continue;
    if (/^["'`]git\s/i.test(bin)) {
      const q = bin.slice(1, -1).split(/\s+/).slice(1).map((t) => JSON.stringify(t)).join(",");
      judgeGit(m.index, { raw: q, blank: q.replace(/"[^"]*"/g, (x) => " ".repeat(x.length)) });
      continue;
    }
    const arr = arrayOf(partsRaw[1] || "", partsBlank[1] || "");
    if (arr) { judgeGit(m.index, { raw: arr.raw, blank: arr.blank }); continue; }
    // argv is not a literal: the enclosing declaration is a git wrapper, judged at each of its call sites below.
    const u = unitOf(units, m.index);
    const name = u && /\bfunction\s*\*?\s*(\w+)\s*\([^)]*\)\s*$|\b(?:const|let)\s+(\w+)\s*=\s*(?:\([^)]*\)|\w+)\s*=>\s*$/.exec(code.slice(Math.max(0, u[0] - 200), u[0]));
    if (name) gitHelpers.add(name[1] || name[2]);
    else sites.push({ at: m.index, to: "tracked-file", what: "git (an argv the audit cannot read)" });
  }
  for (const h of gitHelpers) {
    for (const m of code.matchAll(new RegExp(`(?<![.\\w$])${esc(h)}\\s*\\(`, "g"))) {
      if (/\bfunction\s*\*?\s*$/.test(code.slice(Math.max(0, m.index - 12), m.index))) continue;
      const open = m.index + m[0].length - 1;
      const arr = arrayOf(argText(src, open), argText(code, open));
      if (arr) judgeGit(m.index, arr);
      else sites.push({ at: m.index, to: "tracked-file", what: `${h}() (git, an argv the audit cannot read)` });
    }
  }
  // One call hop: a name imported from a library whose declaration of it writes -- and any local name rebound to it.
  const hopNames = new Map(hop);
  for (const [local, to] of hop) for (const r of code.matchAll(new RegExp(`\\b(?:const|let|var)\\s+(\\w+)\\s*=\\s*${esc(local)}\\s*[;,\\n]`, "g"))) hopNames.set(r[1], to);
  for (const [local, to] of hopNames) {
    for (const m of code.matchAll(new RegExp(`(?<![.\\w$])${esc(local)}\\s*\\(`, "g"))) sites.push({ at: m.index, to, what: `${local}() (imported)` });
  }
  const seen = new Set();
  return sites.filter((s) => (seen.has(s.at) ? false : (seen.add(s.at), true))).sort((a, b) => a.at - b.at);
}

/** Guard calls whose result gates: inside an `if (` condition, or assigned to a name a later condition reads. */
export function jsGuards(code) {
  const guards = [];
  for (const m of code.matchAll(/\b(staleReason|spineRefusal)\s*\(/g)) {
    if (/function\s*$/.test(code.slice(Math.max(0, m.index - 12), m.index))) continue;
    const before = code.slice(Math.max(0, m.index - 200), m.index);
    const stmt = before.slice(Math.max(before.lastIndexOf(";"), before.lastIndexOf("{"), before.lastIndexOf("}")) + 1);
    // `if (staleReason(...))`, `if (!spineRefusal(...))`, `const x = a || staleReason(...)` inside an if, or a return.
    if (/\b(if|while)\s*\([^)]*$/.test(stmt) || /\breturn\b/.test(stmt) || /[?]\s*$/.test(stmt)) { guards.push({ at: m.index }); continue; }
    const asg = /\b(?:const|let|var)\s+(\w+)\s*=\s*$/.exec(stmt) || /\b(\w+)\s*=\s*$/.exec(stmt);
    if (!asg) continue; // the result is dropped: no guard
    const name = asg[1];
    const after = code.slice(m.index, m.index + 4000);
    const read = new RegExp(`\\b(if|while)\\s*\\(\\s*!?\\s*${esc(name)}\\b|\\b${esc(name)}\\s*(\\?|&&|\\|\\|)|\\b(if|while)\\s*\\([^)]*\\b${esc(name)}\\b`).exec(after);
    if (read) guards.push({ at: m.index + read.index });
  }
  return guards.map((g) => g.at).sort((a, b) => a - b);
}

/** All guard call offsets, honoured or not, to tell `no` (guard present, after or dropped) from `unknown`. */
const anyGuard = (code) => [...code.matchAll(/\b(staleReason|spineRefusal)\s*\(/g)].filter((m) => !/function\s*$/.test(code.slice(Math.max(0, m.index - 12), m.index))).map((m) => m.index);

/** yes | no | unknown for a set of write sites, by the rule in the header. */
export function bound(code, sites, guards, all = anyGuard(code)) {
  const real = sites.filter((s) => s.to !== "scratch");
  if (!real.length) return "yes";
  if (!all.length) return "no";
  const units = topLevelUnits(code);
  const inUnit = (u, at) => (u ? at >= u[0] && at < u[1] : unitOf(units, at) === null);
  let verdict = "yes";
  for (const s of real) {
    const u = unitOf(units, s.at);
    if (guards.filter((g) => inUnit(u, g)).some((g) => g < s.at)) continue;
    if (all.some((g) => inUnit(u, g))) return "no"; // a guard in this declaration, but after the write or its result dropped
    verdict = "unknown";
  }
  return verdict;
}

/** A shell verb's writes: a real emit, or a git write. Redirections are not read (they write scratch far more often). */
export function shWrites(src) {
  const sites = [];
  const joined = src.replace(/\\\r?\n/g, "  ");
  let at = 0;
  for (const line of joined.split(/\r?\n/)) {
    const s = line.replace(/^\s*#.*$/, "").replace(/\s#[^"']*$/, "");
    if (/arc-event\.(sh|mjs)\S*\s.*\bemit\b/.test(s) && !/--dry-run/.test(s)) sites.push({ at, to: "spine" });
    else {
      // Every `git` on the line (a pipeline or `||` can hold two), each judged by its own words up to the next operator.
      for (const g of s.matchAll(/(?:^|[\s;&|($`])git((?:\s+(?:-C|-c)\s+\S+|\s+--?[\w-]+(?:=\S+)?)*)\s+([\w-]+)([^;&|)`]*)/g)) {
        if (isGitWrite([g[2], ...g[3].trim().split(/\s+/).filter(Boolean)])) { sites.push({ at, to: "tracked-file" }); break; }
      }
    }
    at += line.length + 1;
  }
  return sites;
}

const PARSED = /\.(mjs|js)$/i;
const OTHER_SCRIPT = /\.(sh|cjs|ts|mts|cts|py|ps1|bash)$/i;
const VERB_RE = /^[A-Za-z0-9._/-]+$/;

class AuditError extends Error {}

/** Every file under `<root>/.claude/scripts`, refusing what cannot be read honestly. */
function files(root) {
  const base = join(root, ".claude", "scripts");
  const out = [];
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      const p = join(dir, e.name);
      const st = lstatSync(p);
      if (st.isSymbolicLink()) throw new AuditError(`${relative(root, p)} is a symbolic link -- the audit reads only real files, so it cannot vouch for one`);
      if (st.isDirectory()) { if (e.name !== "node_modules") walk(p); continue; }
      if (st.isFile()) out.push(p);
    }
  };
  walk(base);
  return out;
}

/** The writing exported declarations of a parsed file: name -> writes-to, from its own direct sites. */
function writingExports(src, code, sites) {
  const units = topLevelUnits(code);
  const map = new Map();
  for (const s of sites) {
    if (s.to === "scratch" || /\(imported\)$/.test(s.what || "")) continue;
    const u = unitOf(units, s.at);
    const head = code.slice(Math.max(0, (u ? u[0] : s.at) - 200), u ? u[0] : s.at);
    const n = /\bexport\s+(?:async\s+)?function\s*\*?\s*(\w+)\s*\([^)]*\)\s*$/.exec(head) || /\bexport\s+(?:const|let)\s+(\w+)\s*=[^;]*$/.exec(head);
    if (!n) continue;
    const prev = map.get(n[1]);
    map.set(n[1], prev && prev !== s.to ? "spine+tracked-file" : s.to);
  }
  return map;
}

const join2 = (a, b) => (a === b ? a : "spine+tracked-file");

/** The verbs under `<root>/.claude/scripts`, each { verb, file, to, bound, scratch }. */
export function audit(root) {
  const base = join(root, ".claude", "scripts");
  const list = files(root);
  const read = new Map();
  for (const p of list) {
    if (!PARSED.test(p) && !OTHER_SCRIPT.test(p)) continue;
    try { read.set(p, readFileSync(p, "utf8")); }
    catch (e) { throw new AuditError(`${relative(root, p)} cannot be read (${e.code || e.message})`); }
  }
  // Pass 1: each parsed file's own sites and its writing exports.
  const own = new Map();
  for (const [p, src] of read) {
    if (!PARSED.test(p)) continue;
    const code = blank(src);
    const sites = jsWrites(src, code);
    own.set(p, { code, exports: writingExports(src, code, sites) });
  }
  const rows = [];
  for (const [p, src] of read) {
    const rel = relative(root, p).split(sep).join("/");
    const verb = relative(base, p).split(sep).join("/").replace(PARSED, "");
    if (!VERB_RE.test(verb)) throw new AuditError(`a script name the audit will not print: ${JSON.stringify(verb)}`);
    let sites, b;
    if (/\.(sh|bash)$/i.test(p)) { sites = shWrites(src); b = sites.length ? "no" : "yes"; }
    else if (!PARSED.test(p)) { rows.push({ verb, file: rel, to: "tracked-file", bound: "unknown", scratch: 0 }); continue; }
    else {
      const { code } = own.get(p);
      const hop = new Map();
      for (const im of imports(src)) {
        if (!im.from.startsWith(".")) continue;
        const target = resolve(dirname(p), im.from);
        const lib = own.get(target);
        if (!lib) continue;
        for (const [as, real] of im.names) if (lib.exports.has(real)) hop.set(as, lib.exports.get(real));
      }
      sites = jsWrites(src, code, hop);
      b = bound(code, sites, jsGuards(code));
    }
    const real = sites.filter((s) => s.to !== "scratch");
    const scratch = sites.length - real.length;
    if (!real.length && !scratch) continue;
    const to = real.length ? real.map((s) => s.to).reduce(join2) : "";
    rows.push({ verb, file: rel, to, bound: real.length ? b : "yes", scratch, scratchWhat: sites.filter((s) => s.to === "scratch").map((s) => s.what) });
  }
  const names = new Map();
  for (const r of rows) {
    if (names.has(r.verb)) throw new AuditError(`two files share the verb name ${r.verb} (${names.get(r.verb)}, ${r.file}) -- one allowlist row would cover both`);
    names.set(r.verb, r.file);
  }
  return rows;
}

export const CLASSES = ["writer", "lane-tool", "door-gap"];

/** Problems with the allowlist against the rows: malformed, unreasoned, stale or now-bound rows. */
export function allowlistProblems(list, rows) {
  const problems = [];
  const writers = new Map(rows.filter((r) => r.to).map((r) => [r.verb, r]));
  const seen = new Set();
  for (const [i, r] of list.entries()) {
    const name = r && typeof r.verb === "string" ? r.verb : "";
    if (!name || !VERB_RE.test(name)) { problems.push(`allowlist row ${i} names no verb`); continue; }
    if (seen.has(name)) problems.push(`allowlist row ${name} appears twice`);
    seen.add(name);
    if (typeof r.why !== "string" || !r.why.trim()) problems.push(`allowlist row ${name} has no why -- every unbound verb carries its reason`);
    if (!CLASSES.includes(r.class)) problems.push(`allowlist row ${name} has class ${JSON.stringify(r.class ?? null)} -- one of ${CLASSES.join(", ")}`);
    const w = writers.get(name);
    if (!w) problems.push(`allowlist row ${name} names no write verb in the tree -- a stale allowlist is a lie; remove the row`);
    else if (w.bound === "yes") problems.push(`allowlist row ${name} names a verb that is now plan-bound -- remove the row`);
  }
  return problems;
}

const say = (s) => process.stdout.write(s + "\n");
const usage = (m) => { process.stderr.write(`plan-bound-audit: ${m}\n`); return 2; };

function main(argv) {
  const given = {};
  for (let i = 0; i < argv.length; i++) {
    const f = argv[i];
    if (f !== "--root" && f !== "--allowlist") return usage(`unknown argument ${JSON.stringify(f)} -- known: --root DIR --allowlist FILE`);
    if (f in given) return usage(`${f} given twice`);
    const v = argv[i + 1];
    if (v === undefined || v === "" || v.startsWith("--")) return usage(`${f} needs a value`);
    given[f] = v; i++;
  }
  const root = resolve(given["--root"] ?? join(HERE, "..", "..", ".."));
  let isDir = false;
  try { isDir = statSync(join(root, ".claude", "scripts")).isDirectory(); } catch {}
  if (!isDir) return usage(`no .claude/scripts directory under ${root}`);
  const allow = resolve(given["--allowlist"] ?? join(root, ".claude", "scripts", "core", "plan-bound-allowlist.json"));
  let list;
  try {
    const parsed = JSON.parse(readFileSync(allow, "utf8"));
    list = Array.isArray(parsed) ? parsed : parsed && Array.isArray(parsed.verbs) ? parsed.verbs : null;
    if (!list) throw new Error("expected an array, or an object with a `verbs` array");
  } catch (e) {
    return usage(`the allowlist ${relative(root, allow) || allow} cannot be read: ${e.message}`);
  }
  let rows;
  try { rows = audit(root); } catch (e) { if (e instanceof AuditError) return usage(e.message); throw e; }
  const writers = rows.filter((r) => r.to);
  const allowed = new Set(list.map((r) => r && r.verb));
  const unbound = [];
  for (const r of writers) {
    const listed = r.bound !== "yes" && allowed.has(r.verb);
    if (r.bound !== "yes" && !listed) unbound.push(r);
    say(`${r.verb} · ${r.file} · ${r.to} · plan-bound ${r.bound}${listed ? " · allowlisted" : ""}`);
  }
  let scratch = 0;
  for (const r of rows) if (r.scratch) { scratch += r.scratch; say(`SCRATCH ${r.verb}: ${r.scratch} write(s) read as scratch, not counted -- ${r.scratchWhat.join("; ")}`); }
  const problems = allowlistProblems(list, rows);
  for (const u of unbound) say(`UNBOUND ${u.verb}: writes ${u.to} with plan-bound ${u.bound} and no allowlist row -- bind it to a plan, or allowlist it with its why`);
  for (const p of problems) say(`ALLOWLIST ${p}`);
  if (!writers.length) say("EMPTY the audit read no write verb at all -- a walk that saw nothing proves nothing");
  const yes = writers.filter((r) => r.bound === "yes").length;
  say(`plan-bound-audit: ${writers.length} write verbs · ${yes} plan-bound · ${writers.length - yes - unbound.length} allowlisted · ${unbound.length} unbound · ${problems.length} allowlist problems · ${scratch} scratch writes`);
  return unbound.length || problems.length || !writers.length ? 1 : 0;
}

const self = (() => { try { return realpathSync(fileURLToPath(import.meta.url)); } catch { return ""; } })();
const invoked = (() => { try { return process.argv[1] ? realpathSync(process.argv[1]) : ""; } catch { return ""; } })();
if (self && self === invoked) process.exitCode = main(process.argv.slice(2));
