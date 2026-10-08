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
// then one summary line. Exit 0 when every verb not bound is allowlisted with a reason; 1 when one is not, when an
// allowlist row has no `why`, or when a row names a verb the tree no longer holds (a stale allowlist is a lie); 2 on
// a usage error or an unreadable allowlist.
//
// WHAT THE DETECTION SEES, AND WHAT IT DESTROYS. It is lexical, per file, after comments and string contents are
// blanked -- no data flow (the phase spec's rabbit hole). So:
//   - a WRITE is a call to an fs write primitive, a `git` write subcommand, or a spine emit (`emitReceipt`, or an
//     `arc-event` run with `emit` that is not a `--dry-run`). A write whose target names a temp dir, a lock, a cache or
//     `.claude/state` outside the spine is a scratch write and is not counted; that classification reads only the
//     call's own argument text, by WORD (tmp, temp, lock, cache, state, snapshot...). A scratch path held in a variable
//     named for nothing counts as a tracked write, which only costs an allowlist row. The other way round is the one
//     way this transform HIDES a write: a tracked file whose path expression carries a scratch word is dropped. A
//     write inside a template literal's `${}` is blanked with the literal and not seen either.
//   - a GUARD is a call to `staleReason(` or `spineRefusal(`. A write is bound when a guard call comes before it in
//     the same top-level declaration. A guard only AFTER the write in that declaration is write-before-check: `no`.
//     A write inside a declaration with no guard, in a file that guards elsewhere, cannot be decided without data
//     flow: `unknown`, which fails like `no` -- a verb is never passed by default. Whether the guard's RESULT is
//     honoured (an `if` on it) is not seen; the attack on this gate is told so.
//   - a `.sh` verb cannot call either guard, so a shell writer is never bound; it is listed and must be allowlisted.
//   - a write reached through a function imported from another file is that file's write, listed on that file's row.

import { readFileSync, readdirSync, realpathSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

/** Blank comments and the inside of string, template and regex literals, keeping offsets and newlines. */
export function blank(src) {
  const out = src.split("");
  const n = src.length;
  let i = 0;
  let prev = ""; // last significant (non-space) char outside literals, to tell a regex from a division
  const wipe = (a, b) => { for (let k = a; k < b; k++) if (out[k] !== "\n") out[k] = " "; };
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (c === "/" && d === "/") { const e = src.indexOf("\n", i); const end = e < 0 ? n : e; wipe(i, end); i = end; continue; }
    if (c === "/" && d === "*") { const e = src.indexOf("*/", i + 2); const end = e < 0 ? n : e + 2; wipe(i, end); i = end; continue; }
    if (c === '"' || c === "'" || c === "`") {
      let j = i + 1;
      while (j < n && src[j] !== c) { if (src[j] === "\\") j++; else if (c !== "`" && src[j] === "\n") break; j++; }
      wipe(i + 1, Math.min(j, n)); i = j + 1; prev = c; continue;
    }
    if (c === "/" && (prev === "" || "(,=:[!&|?{};+-*%<>~^".includes(prev) || /\b(return|typeof|case|of|in)$/.test(src.slice(Math.max(0, i - 7), i).trimEnd()))) {
      let j = i + 1, cls = false;
      while (j < n && src[j] !== "\n") { if (src[j] === "\\") { j += 2; continue; } if (src[j] === "[") cls = true; else if (src[j] === "]") cls = false; else if (src[j] === "/" && !cls) break; j++; }
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

const FS_WRITE = /\b(writeFileSync|appendFileSync|renameSync|copyFileSync|cpSync|writeFile|appendFile|createWriteStream)\s*\(/g;
const GIT_WRITE = /["'`]?(commit|update-ref|hash-object|worktree|push|merge|cherry-pick|tag|checkout|reset)["'`]?/;
// Words, not substrings: "attempt" holds "temp" and "block" holds "lock", and a substring match would drop a tracked
// write as scratch -- the one mistake that hides a verb rather than costing an allowlist row.
const words = (text) => new Set(text.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));
const SCRATCH_WORDS = ["tmp", "temp", "tmpdir", "mkdtemp", "scratch", "cache", "lock", "locks", "state", "snapshot"];
const isScratch = (text) => { const w = words(text); return SCRATCH_WORDS.some((s) => w.has(s)); };
const isSpine = (text) => { const w = words(text); return w.has("events") || w.has("spine"); };

/** The argument text of the call whose `(` is at `open`, read from the RAW source so path words are visible. */
function argText(src, open) {
  let depth = 0;
  for (let j = open; j < src.length && j < open + 600; j++) {
    if (src[j] === "(") depth++;
    else if (src[j] === ")") { depth--; if (depth === 0) return src.slice(open + 1, j); }
  }
  return src.slice(open + 1, open + 600);
}

/** Every write site in a `.mjs`/`.js` source: { at, to: "spine"|"tracked-file" }. Scratch writes are dropped. */
export function jsWrites(src, code = blank(src)) {
  const sites = [];
  for (const m of code.matchAll(FS_WRITE)) {
    const open = m.index + m[0].length - 1;
    const args = argText(src, open);
    const first = args.split(",")[0];
    // The spine lives under .claude/state/hq/events, so a spine word wins over the `state` scratch word.
    if (isSpine(first)) sites.push({ at: m.index, to: "spine" });
    else if (isScratch(first)) continue;
    else sites.push({ at: m.index, to: "tracked-file" });
  }
  for (const m of code.matchAll(/\b(emitReceipt|appendEvent|appendEventUnlocked)\s*\(/g)) sites.push({ at: m.index, to: "spine" });
  // The emitter's argv built as an array before the spawn (`const args = [ARC_EVENT, "emit", ...]`, or `[ARC_EVENT, ...emit]`).
  for (const m of code.matchAll(/\[\s*[\w.]*(ARC_EVENT|arcEvent|ARCEVENT)\w*\s*,/gi)) {
    const end = code.indexOf("]", m.index);
    const arr = src.slice(m.index, end < 0 ? m.index + 400 : end);
    if (!/--dry-run/.test(arr) && (/["'`]emit["'`]/.test(arr) || /\.\.\.\w*emit/i.test(arr))) sites.push({ at: m.index, to: "spine" });
  }
  // A spawn of the emitter with `emit` and no `--dry-run` in the same call.
  for (const m of code.matchAll(/\b(spawnSync|execFileSync|spawn|execFile|execSync)\s*\(/g)) {
    const args = argText(src, m.index + m[0].length - 1);
    if (/arc-event|ARC_EVENT|arcEvent/i.test(args) && /["'`]emit["'`]/.test(args) && !/--dry-run/.test(args) && !/\[\s*[\w.]*(ARC_EVENT|arcEvent)/i.test(args)) sites.push({ at: m.index, to: "spine" });
    else if (/["'`]git["'`]/.test(args) && GIT_WRITE.test(args.split(",").slice(1).join(","))) sites.push({ at: m.index, to: "tracked-file" });
  }
  return sites.sort((a, b) => a.at - b.at);
}

/** Every guard call's offset. */
export function jsGuards(code) {
  return [...code.matchAll(/\b(staleReason|spineRefusal)\s*\(/g)].filter((m) => !/function\s+$/.test(code.slice(Math.max(0, m.index - 10), m.index))).map((m) => m.index);
}

/** yes | no | unknown for a set of write sites, by the rule in the header. */
export function bound(code, sites, guards) {
  if (!sites.length) return "yes";
  if (!guards.length) return "no";
  const units = topLevelUnits(code);
  let verdict = "yes";
  for (const s of sites) {
    const u = unitOf(units, s.at);
    const inUnit = guards.filter((g) => (u ? g >= u[0] && g < u[1] : unitOf(units, g) === null));
    if (inUnit.some((g) => g < s.at)) continue;
    if (inUnit.length) return "no"; // a guard in this declaration, but only after the write
    verdict = "unknown";
  }
  return verdict;
}

/** A shell verb's writes: a real emit, or a git write. Redirections are not read (they write scratch far more often). */
export function shWrites(src) {
  const sites = [];
  const lines = src.split("\n");
  let at = 0;
  for (const line of lines) {
    const s = line.replace(/(^|\s)#.*$/, "");
    if (/arc-event\.(sh|mjs)\S*\s+emit\b/.test(s) && !/--dry-run/.test(s)) sites.push({ at, to: "spine" });
    else if (/\bgit\s+(-C\s+\S+\s+)?(commit|update-ref|push|merge|cherry-pick|tag)\b/.test(s)) sites.push({ at, to: "tracked-file" });
    at += line.length + 1;
  }
  return sites;
}

/** The verbs under `<root>/.claude/scripts`, each { verb, file, to, bound }. */
export function audit(root) {
  const base = join(root, ".claude", "scripts");
  const rows = [];
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      const p = join(dir, e.name);
      if (e.isDirectory()) { if (e.name !== "node_modules") walk(p); continue; }
      if (!/\.(mjs|js|sh)$/.test(e.name)) continue;
      const src = readFileSync(p, "utf8");
      const rel = relative(root, p).split(sep).join("/");
      const verb = relative(base, p).split(sep).join("/").replace(/\.(mjs|js)$/, "");
      let sites, b;
      if (e.name.endsWith(".sh")) { sites = shWrites(src); b = sites.length ? "no" : "yes"; }
      else { const code = blank(src); sites = jsWrites(src, code); b = bound(code, sites, jsGuards(code)); }
      if (!sites.length) continue;
      const to = [...new Set(sites.map((s) => s.to))].sort((x, y) => (x === "spine" ? -1 : y === "spine" ? 1 : 0)).join("+");
      rows.push({ verb, file: rel, to, bound: b });
    }
  };
  walk(base);
  return rows;
}

/** Problems with the allowlist against the rows: rows with no reason, rows naming no verb. */
export function allowlistProblems(list, rows) {
  const problems = [];
  const verbs = new Set(rows.map((r) => r.verb));
  const seen = new Set();
  for (const [i, r] of list.entries()) {
    const name = r && typeof r.verb === "string" ? r.verb : "";
    if (!name) { problems.push(`allowlist row ${i} names no verb`); continue; }
    if (seen.has(name)) problems.push(`allowlist row ${name} appears twice`);
    seen.add(name);
    if (typeof r.why !== "string" || !r.why.trim()) problems.push(`allowlist row ${name} has no why -- every unbound verb carries its reason`);
    if (!verbs.has(name)) problems.push(`allowlist row ${name} names no write verb in the tree -- a stale allowlist is a lie; remove the row`);
    else if (rows.find((x) => x.verb === name).bound === "yes") problems.push(`allowlist row ${name} names a verb that is now plan-bound -- remove the row`);
  }
  return problems;
}

function main(argv) {
  let root = resolve(HERE, "..", "..", "..");
  let allow = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--root" && argv[i + 1] !== undefined) root = resolve(argv[++i]);
    else if (argv[i] === "--allowlist" && argv[i + 1] !== undefined) allow = resolve(argv[++i]);
    else { process.stderr.write(`plan-bound-audit: unknown argument ${JSON.stringify(argv[i])} -- known: --root DIR --allowlist FILE\n`); return 2; }
  }
  if (!statSync(join(root, ".claude", "scripts"), { throwIfNoEntry: false })?.isDirectory()) { process.stderr.write(`plan-bound-audit: no .claude/scripts under ${root}\n`); return 2; }
  allow ??= join(root, ".claude", "scripts", "core", "plan-bound-allowlist.json");
  let list;
  try {
    const parsed = JSON.parse(readFileSync(allow, "utf8"));
    list = Array.isArray(parsed) ? parsed : parsed && Array.isArray(parsed.verbs) ? parsed.verbs : null;
    if (!list) throw new Error("expected an array, or an object with a `verbs` array");
  } catch (e) {
    process.stderr.write(`plan-bound-audit: the allowlist ${relative(root, allow) || allow} cannot be read: ${e.message}\n`);
    return 2;
  }
  const rows = audit(root);
  const allowed = new Set(list.map((r) => r && r.verb));
  const unbound = [];
  for (const r of rows) {
    const listed = r.bound !== "yes" && allowed.has(r.verb);
    if (r.bound !== "yes" && !listed) unbound.push(r);
    process.stdout.write(`${r.verb} · ${r.file} · ${r.to} · plan-bound ${r.bound}${listed ? " · allowlisted" : ""}\n`);
  }
  const problems = allowlistProblems(list, rows);
  for (const u of unbound) process.stdout.write(`UNBOUND ${u.verb}: writes ${u.to} with plan-bound ${u.bound} and no allowlist row -- bind it to a plan, or allowlist it with its why\n`);
  for (const p of problems) process.stdout.write(`ALLOWLIST ${p}\n`);
  const yes = rows.filter((r) => r.bound === "yes").length;
  process.stdout.write(`plan-bound-audit: ${rows.length} write verbs · ${yes} plan-bound · ${rows.length - yes - unbound.length} allowlisted · ${unbound.length} unbound · ${problems.length} allowlist problems\n`);
  return unbound.length || problems.length ? 1 : 0;
}

const self = (() => { try { return realpathSync(fileURLToPath(import.meta.url)); } catch { return ""; } })();
const invoked = (() => { try { return process.argv[1] ? realpathSync(process.argv[1]) : ""; } catch { return ""; } })();
if (self && self === invoked) process.exitCode = main(process.argv.slice(2));
