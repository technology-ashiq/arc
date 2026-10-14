#!/usr/bin/env node
/**
 * opencode-session.mjs -- the one way the distribute lane runs OpenCode headless: capped, recorded, stamped
 * (ADR-2019, ADR-2020).
 *
 * Usage:
 *   opencode-session.mjs --cap-usd N --model M --command C --transcript PATH
 *                        [--agent A] [--cwd DIR] [--timeout-s S] [--cycle-cap-usd N] [--prior-spent-usd N]
 *                        [--ledger-dir DIR] -- MESSAGE
 *
 * The child is always `opencode run --pure --command C [--agent A] -m M --format json -- MESSAGE`, spawned
 * from an argv array. The binary is `ARC_OPENCODE_BIN`, else `opencode` on PATH.
 *
 * Exit: 0 ok · 1 OpenCode exited non-zero · 2 refused before spend (usage, model, cap, cycle cap, binary,
 * version, transcript already present, NO-FENCE, STALE-RUN) · 3 cap breach · 4 COST-UNREADABLE · 5 timeout ·
 * 7 KILL-INCOMPLETE (a process of the run's tree outlived the kill; it is named).
 * Every path that spawned OpenCode ends the transcript with `spent=<sum>`.
 *
 * Zero dependencies, Node 18+.
 */

import { spawn, spawnSync, execFileSync } from "node:child_process";
import { closeSync, existsSync, openSync, readFileSync, readdirSync, realpathSync, renameSync, statSync, unlinkSync, writeFileSync, writeSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { renderSourceTree } from "./source-render.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ARC_ROOT = resolve(HERE, "..", "..", "..");
const VALUE_FLAGS = new Set([
  "--cap-usd", "--model", "--command", "--transcript", "--agent", "--cwd", "--timeout-s",
  "--cycle-cap-usd", "--prior-spent-usd", "--ledger-dir",
]);
const TYPO_GUARD_USD = 1.0;
const VERSION_TIMEOUT_MS = 10_000;

class Refusal extends Error {
  constructor(code, msg) { super(msg); this.code = code; }
}

export function parseArgs(argv) {
  const o = { agent: null, cwd: null, timeoutS: 1200, cycleCap: 0.5, priorSpent: 0, ledgerDir: null };
  const seen = new Set();
  let i = 0;
  for (; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--") { i++; break; }
    if (!VALUE_FLAGS.has(a)) throw new Refusal("USAGE", `unknown argument \`${a}\` (the message goes after \`--\`)`);
    const v = argv[i + 1];
    // Fixed-defects (c): a missing value never consumes the next flag, and a repeated flag is an error, not last-wins.
    if (v === undefined || v === "" || v.startsWith("-")) throw new Refusal("USAGE", `${a} needs a value`);
    if (seen.has(a)) throw new Refusal("USAGE", `${a} given twice`);
    seen.add(a);
    i++;
    if (a === "--cap-usd") o.cap = v;
    else if (a === "--model") o.model = v;
    else if (a === "--command") o.command = v;
    else if (a === "--transcript") o.transcript = v;
    else if (a === "--agent") o.agent = v;
    else if (a === "--cwd") o.cwd = v;
    else if (a === "--timeout-s") o.timeoutS = v;
    else if (a === "--cycle-cap-usd") o.cycleCap = v;
    else if (a === "--prior-spent-usd") o.priorSpent = v;
    else if (a === "--ledger-dir") o.ledgerDir = v;
  }
  if (i > argv.length || argv.length - i !== 1) throw new Refusal("USAGE", "exactly one MESSAGE after `--`");
  o.message = argv[i];
  if (!/\S/.test(o.message)) throw new Refusal("USAGE", "the MESSAGE is empty");
  if (o.message.includes(String.fromCharCode(0))) throw new Refusal("USAGE", "the MESSAGE holds a NUL byte");
  return o;
}

const usd = (v, name, { allowZero = false } = {}) => {
  const s = String(v);
  if (!/^(0|[1-9][0-9]*)(\.[0-9]{1,6})?$/.test(s)) throw new Refusal("CAP", `${name} must be a plain decimal number of dollars (got \`${s}\`)`);
  const n = Number(s);
  if (!allowZero && !(n > 0)) throw new Refusal("CAP", `${name} must be above 0`);
  return n;
};

export function validate(o) {
  if (o.cap === undefined) throw new Refusal("CAP", "--cap-usd is required: an uncapped run is never started");
  o.cap = usd(o.cap, "--cap-usd");
  if (o.cap > TYPO_GUARD_USD) throw new Refusal("CAP", `--cap-usd ${o.cap} is above ${TYPO_GUARD_USD}: a typo guard, raise it by ADR`);
  o.cycleCap = usd(o.cycleCap, "--cycle-cap-usd");
  if (o.cycleCap > TYPO_GUARD_USD) throw new Refusal("CAP", `--cycle-cap-usd ${o.cycleCap} is above ${TYPO_GUARD_USD}: a typo guard, raise it by ADR`);
  // Spend made outside the committed transcripts; added to the ledger's sum, never a replacement for it.
  o.priorSpent = usd(o.priorSpent, "--prior-spent-usd", { allowZero: true });
  if (o.priorSpent > o.cycleCap) throw new Refusal("CYCLE-CAP", `--prior-spent-usd ${o.priorSpent} is already past the cycle cap ${o.cycleCap}`);
  if (!o.model) throw new Refusal("MODEL", "--model is required");
  if (!/^[a-z0-9][a-z0-9-]*(\/[A-Za-z0-9][A-Za-z0-9._:-]*)+$/.test(o.model)) throw new Refusal("MODEL", `--model \`${o.model}\` is not provider/model`);
  if (/anthropic|claude/i.test(o.model)) throw new Refusal("MODEL", `--model \`${o.model}\` is an Anthropic model; this wrapper exists for non-Anthropic runs (REQ-03)`);
  if (!o.command || !/^[a-z][a-z0-9-]{0,63}$/.test(o.command)) throw new Refusal("USAGE", "--command must name one command ([a-z][a-z0-9-]*)");
  if (o.agent !== null && !/^[a-z][a-z0-9-]{0,63}$/.test(o.agent)) throw new Refusal("USAGE", "--agent must be [a-z][a-z0-9-]*");
  if (!o.transcript) throw new Refusal("USAGE", "--transcript is required: a run with no record is never started");
  if (!/^[1-9][0-9]{0,4}$/.test(String(o.timeoutS))) throw new Refusal("USAGE", "--timeout-s must be 1-99999");
  o.timeoutS = Number(o.timeoutS);
  return o;
}

/**
 * What one transcript spent. Its final line is `spent=<n>` on every path the wrapper controls; a transcript
 * without it (the wrapper itself was killed) is charged its whole `cap_usd`, the most that run could have
 * spent. A transcript with neither is unreadable and refuses the run (fixed-defects e): spend nobody can
 * read is never counted as zero.
 */
export function spentOf(text, name) {
  const lines = text.split(/\r?\n/).filter((l) => l !== "");
  const last = lines[lines.length - 1] ?? "";
  const m = /^spent=(0|[1-9][0-9]*)(\.[0-9]+)?$/.exec(last);
  if (m) return Number(last.slice(6));
  const cap = /^harness-proof: .* cap_usd=(0|[1-9][0-9]*)(\.[0-9]+)? /.exec(lines[0] ?? "");
  if (cap) return Number(cap[1] + (cap[2] ?? ""));
  throw new Refusal("CYCLE-CAP", `${name} has no final spent= line and no cap_usd header: COULD NOT SCAN its spend`);
}

/** Sum the spend of every transcript under DIR (any depth, `transcripts/*.jsonl`); links are not followed. */
export function priorSpend(dir) {
  let st;
  try { st = statSync(dir); } catch (e) {
    if (e.code === "ENOENT") return 0; // no evidence dir yet: nothing spent
    throw new Refusal("CYCLE-CAP", `cannot stat the ledger ${dir} (${e.code || e.message}): COULD NOT SCAN`);
  }
  if (!st.isDirectory()) throw new Refusal("CYCLE-CAP", `the ledger ${dir} is not a directory: COULD NOT SCAN`);
  let total = 0;
  const walk = (d) => {
    let names;
    try { names = readdirSync(d, { withFileTypes: true }); }
    catch (e) { throw new Refusal("CYCLE-CAP", `cannot list ${d} (${e.code || e.message}): COULD NOT SCAN`); }
    for (const e of names) {
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".jsonl") && basename(d) === "transcripts") {
        if (!e.isFile()) throw new Refusal("CYCLE-CAP", `${p} is not a regular file: COULD NOT SCAN`);
        let text;
        try { text = readFileSync(p, "utf8"); }
        catch (err) { throw new Refusal("CYCLE-CAP", `cannot read ${p} (${err.code || err.message}): COULD NOT SCAN`); }
        total += spentOf(text, p);
      }
    }
  };
  walk(dir);
  return total;
}

/**
 * One OpenCode JSON event line. Only a step-finish part carries spend: a cost on any other event is not
 * OpenCode's accounting and is never summed. A step-finish whose cost is absent or not a finite non-negative
 * number (a numeric string is read as its number) is `unpriced`, which makes the run COST-UNREADABLE.
 */
export function readEvent(line) {
  const none = { json: false, finish: false, stepLike: false, cost: null, unpriced: false, session: null, child: null };
  let j;
  try { j = JSON.parse(line); } catch { return none; }
  if (j === null || typeof j !== "object" || Array.isArray(j)) return none;
  const part = j.part && typeof j.part === "object" ? j.part : {};
  const finish = j.type === "step_finish" || part.type === "step-finish";
  let cost = null;
  if (finish) {
    const c = typeof part.cost === "string" && /^[0-9]+(\.[0-9]+)?(e-?[0-9]+)?$/i.test(part.cost) ? Number(part.cost) : part.cost;
    if (typeof c === "number" && Number.isFinite(c) && c >= 0) cost = c;
  }
  const s = j.sessionID ?? part.sessionID ?? null;
  // A step event this reader does not recognise (an OpenCode release renamed it) still counts, so renamed
  // accounting reads as COST-UNREADABLE and never as zero spend (attack 5823248 B3).
  const stepLike = /^step/i.test(String(j.type ?? "")) || /^step/i.test(String(part.type ?? ""));
  // A finished task tool names the subagent session it ran: its spend is not in this stream (ADR-2022).
  const st = part.type === "tool" && part.state && typeof part.state === "object" ? part.state : null;
  const kid = st && (st.status === "completed" || st.status === "error") ? st.metadata?.sessionId : null;
  return { json: true, finish, stepLike, cost, unpriced: finish && cost === null, session: typeof s === "string" && /^ses_[A-Za-z0-9]+$/.test(s) ? s : null, child: typeof kid === "string" && /^ses_[A-Za-z0-9]+$/.test(kid) ? kid : null };
}

// cmd.exe quoting for a .cmd/.bat binary: MSVCRT rules first, then every cmd metacharacter caret-escaped.
// A shim that re-reads its arguments through %* is parsed by cmd twice, so the escape is applied twice. What
// cmd cannot carry at all is refused instead of escaped: a line break ends the command, and `%` can expand a
// variable inside quotes, where a caret is not an escape.
const CMD_META = /([()\][%!^"`<>&|;, *?])/g;
const CMD_UNSAFE = /[\r\n%]/;
function cmdArg(arg) {
  let a = String(arg).replace(/(\\*)"/g, '$1$1\\"').replace(/(\\*)$/, "$1$1");
  a = `"${a}"`;
  return a.replace(CMD_META, "^$1").replace(CMD_META, "^$1");
}

function launch(bin, args, opts) {
  if (process.platform === "win32" && /\.(cmd|bat)$/i.test(bin)) {
    for (const a of args) if (CMD_UNSAFE.test(a)) throw new Refusal("USAGE", `an argument holds a line break or % that a .cmd shim cannot carry intact: ${JSON.stringify(a).slice(0, 60)}`);
    const line = [bin.replace(CMD_META, "^$1"), ...args.map(cmdArg)].join(" ");
    return { cmd: process.env.ComSpec || "cmd.exe", args: ["/d", "/s", "/c", `"${line}"`], opts: { ...opts, windowsVerbatimArguments: true } };
  }
  return { cmd: bin, args, opts };
}

/** The binary, resolved ONCE to an absolute regular file; the version check and the run use this same path. */
function resolveBin() {
  const named = process.env.ARC_OPENCODE_BIN;
  const isFile = (p) => { try { return statSync(p).isFile(); } catch { return false; } };
  if (named !== undefined) {
    const abs = resolve(named);
    if (named === "" || !isFile(abs)) throw new Refusal("BINARY", `ARC_OPENCODE_BIN \`${named}\` is not a file`);
    return realpathSync(abs);
  }
  // On Windows an extensionless `opencode` beside the shim is npm's sh script for MSYS, which spawn cannot run.
  const exts = process.platform === "win32" ? [".exe", ".cmd", ".bat"] : [""];
  for (const d of String(process.env.PATH || "").split(process.platform === "win32" ? ";" : ":")) {
    if (!d || !isAbsolute(d)) continue;
    for (const e of exts) {
      const p = join(d, `opencode${e}`);
      if (isFile(p)) return realpathSync(p);
    }
  }
  throw new Refusal("BINARY", "no `opencode` on PATH and ARC_OPENCODE_BIN unset");
}

function version(bin, cwd) {
  const l = launch(bin, ["--version"], { cwd, encoding: "utf8", timeout: VERSION_TIMEOUT_MS, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
  const r = spawnSync(l.cmd, l.args, l.opts);
  const v = String(r.stdout || "").trim().split(/\r?\n/).pop() || "";
  if (r.error || r.status !== 0 || !/^[0-9]+\.[0-9]+\.[0-9]+\S*$/.test(v))
    throw new Refusal("VERSION", `\`opencode --version\` did not answer a version within ${VERSION_TIMEOUT_MS / 1000}s (status ${r.status}, got \`${v.slice(0, 40)}\`)`);
  return v;
}

function git(cwd, args) {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
}

/** ADR-2020: the canonical spine is the main clone's, named from git, never typed. */
export function canonicalSpine(cwd) {
  const common = git(cwd, ["rev-parse", "--path-format=absolute", "--git-common-dir"]);
  // Only a plain clone keeps its git dir at <checkout>/.git; a separate git dir, a submodule or a bare repo would
  // make dirname() name a directory that is no checkout at all (attack 5823248 B7).
  if (basename(common) !== ".git") throw new Refusal("SPINE", `the git common dir ${common} is not <checkout>/.git, so the main checkout cannot be named`);
  return join(dirname(common), ".claude", "state", "hq");
}

// Always attempted, even after the leader exited: what it left in its group or tree may still be spending
// (attack 5823248 B2). A tree that is already gone makes these fail, which is ignored.
function killTree(child) {
  if (!child || !child.pid) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/T", "/F", "/PID", String(child.pid)], { stdio: "ignore", windowsHide: true });
  } else {
    try { process.kill(-child.pid, "SIGKILL"); } catch { /* not a group leader, or gone */ }
    try { process.kill(child.pid, "SIGKILL"); } catch { /* gone */ }
  }
}

// ---------- the tree is gone, or the run says so (ADR-2027, debt row 23) ----------
// In P07 Claude Code reaped the WRAPPER for memory pressure, so killTree never ran and the OpenCode child linked a
// Vercel project nobody asked for. Two defences: a kill is verified (exit 7 KILL-INCOMPLETE names a survivor), and
// every spawn leaves `<transcript>.pid` until the tree is verifiably gone, so the next run reaps an orphan before it
// spends anything.

// pid -> { ppid, cmd } on Windows, read once per call; null when the listing itself fails. A command line is folded
// onto one line, so a line break inside one can never forge a row of its own (attack 8707a5c B8).
function winProcs() {
  const ps = "Get-CimInstance Win32_Process | ForEach-Object { [string]$_.ProcessId + ' ' + [string]$_.ParentProcessId + ' ' + $(if ($_.CreationDate) { $_.CreationDate.ToUniversalTime().ToString('yyyyMMddHHmmss') } else { '00000000000000' }) + ' ' + ([string]$_.CommandLine -replace '[\\r\\n]+', ' ') }";
  const r = spawnSync("powershell", ["-NoProfile", "-NonInteractive", "-Command", ps], { encoding: "utf8", windowsHide: true, maxBuffer: 64 * 1024 * 1024 });
  if (r.error || r.status !== 0) return null;
  const out = new Map();
  for (const line of String(r.stdout).split(/\r?\n/)) {
    const m = /^(\d+) (\d+) (\d{14}) ?(.*)$/.exec(line);
    if (m) out.set(Number(m[1]), { ppid: Number(m[2]), start: m[3], cmd: m[4] });
  }
  return out;
}

// pid -> { ppid, pgid, stat, cmd } on POSIX; null when ps fails. `-A` with `-o` works on Linux and macOS alike.
function posixProcs() {
  const r = spawnSync("ps", ["-A", "-o", "pid=,ppid=,pgid=,stat=,lstart=,args="], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (r.error || r.status !== 0) return null;
  const out = new Map();
  for (const line of String(r.stdout).split("\n")) {
    // lstart is a fixed 24-character date ("Tue Oct 14 05:00:00 2026"), so it is matched as five tokens.
    const m = /^\s*(\d+)\s+(\d+)\s+(\d+)\s+(\S+)\s+(\S+\s+\S+\s+\d+\s+[\d:]+\s+\d+)\s?(.*)$/.exec(line);
    if (m) out.set(Number(m[1]), { ppid: Number(m[2]), pgid: Number(m[3]), stat: m[4], start: m[5].replace(/\s+/g, " "), cmd: m[6] });
  }
  return out;
}

/** Every pid in the tree under ROOT (root included), walked by parent pid on both platforms. */
function treePids(root, listing) {
  const procs = listing ?? (process.platform === "win32" ? winProcs() : posixProcs());
  if (!procs) return [root];
  const seen = new Set([root]);
  for (let grew = true; grew;) {
    grew = false;
    for (const [pid, p] of procs) if (!seen.has(pid) && seen.has(p.ppid)) { seen.add(pid); grew = true; }
  }
  return [...seen];
}

// A POSIX group is alive while any member is not a zombie: the wrapper never reaps its child while it polls
// synchronously, so a killed leader lingers as Z and kill(-pgid, 0) would still answer (attack 8707a5c B6).
const alive = (pid, group = false) => {
  if (process.platform !== "win32") {
    const procs = posixProcs();
    if (procs) return [...procs].some(([p, x]) => (group ? x.pgid === pid : p === pid) && !x.stat.startsWith("Z"));
  }
  try { process.kill(group ? -pid : pid, 0); return true; } catch (e) { return e.code === "EPERM"; }
};

/** Poll up to 5 s for every pid to be gone; returns the survivors. */
function survivors(pids, group) {
  const until = Date.now() + 5000;
  let left = pids.filter((p) => alive(p, group));
  while (left.length && Date.now() < until) {
    spawnSync(process.execPath, ["-e", "setTimeout(()=>{},200)"], { stdio: "ignore", windowsHide: true });
    left = left.filter((p) => alive(p, group));
  }
  return left;
}

/** The pid's identity now -- start time, then command line -- or null. A reused pid has a different start. */
function commandLine(pid) {
  const p = (process.platform === "win32" ? winProcs() : posixProcs())?.get(pid);
  return p ? `${p.start} ${p.cmd}` : null;
}

/** The record a run keeps while it lives: its own pid, its leader, and every process seen under it with its command line. */
export function writePidfile(path, rec) {
  // Atomic: a wrapper killed mid-write leaves the old file or the new one, never half of one (attack 8707a5c B9).
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(rec)}\n`);
  renameSync(tmp, path);
}

/**
 * Reap what a killed wrapper left behind. Every `*.jsonl.pid` under the ledger was written by a run that has not yet
 * confirmed its tree gone. A pidfile whose WRAPPER is still alive is a run in progress, never touched (two runs can
 * share a ledger: attack 8707a5c B1). Otherwise each recorded pid whose command line is unchanged is killed (tree on
 * Windows, group on POSIX) and verified gone; a pid that is gone or now runs something else (reuse, or a pid planted
 * in a committed file: B2) is only cleared. A survivor, or a record that cannot be read, refuses the run by name.
 */
export function reapStale(ledger) {
  const found = [];
  const walk = (d) => {
    let names;
    try { names = readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const n of names) {
      const p = join(d, n.name);
      if (n.isDirectory() && !n.isSymbolicLink()) walk(p);
      else if (n.isFile() && n.name.endsWith(".jsonl.pid")) found.push(p);
    }
  };
  walk(ledger);
  const lines = [];
  for (const f of found.sort()) {
    let rec;
    try { rec = JSON.parse(readFileSync(f, "utf8")); } catch { rec = null; }
    const ok = rec && typeof rec === "object" && Number.isInteger(rec.pid) && rec.pid > 0 && Number.isInteger(rec.wrapper) && rec.wrapper > 0
      && typeof rec.wrapperCmd === "string" && Array.isArray(rec.tree);
    if (!ok) throw new Refusal("STALE-RUN", `${f} is not a readable run record; read it, end what it names by hand, then delete it`);
    // A run record is written by a wrapper on this machine and never committed: one that git tracks came from a
    // clone, and the pids in it name nothing of this machine's (attack 0eb78f6 L7).
    if (spawnSync("git", ["-C", dirname(f), "ls-files", "--error-unmatch", "--", basename(f)], { stdio: "ignore" }).status === 0) throw new Refusal("STALE-RUN", `${f} is tracked by git; a run record is never committed, so nothing in it is acted on -- remove it from the repository`);
    // A wrapper whose identity could not be read when it wrote the record is judged by liveness alone: never reap a
    // run that may still be in progress (attack 0eb78f6 B2).
    const wcmd = rec.wrapper !== process.pid ? commandLine(rec.wrapper) : null;
    if (wcmd !== null && (rec.wrapperCmd === "" || wcmd === rec.wrapperCmd)) { lines.push(`skipped: ${posix(f)} (its wrapper pid ${rec.wrapper} is still running)`); continue; }
    const tree = rec.tree.filter((t) => t && Number.isInteger(t.pid) && t.pid > 0 && typeof t.cmd === "string" && t.cmd !== "");
    const group = process.platform !== "win32";
    const live = tree.filter((t) => commandLine(t.pid) === t.cmd).map((t) => t.pid);
    for (const pid of live) killTree({ pid });
    const left = survivors(live, false);
    if (left.length) throw new Refusal("STALE-RUN", `${f} names a live OpenCode process that survived a kill: pid ${left.join(", ")}; end it by hand before any new run`);
    if (group && live.includes(rec.pid) && survivors([rec.pid], true).length) throw new Refusal("STALE-RUN", `${f}: the process group ${rec.pid} survived a kill; end it by hand before any new run`);
    lines.push(live.length ? `reaped: pid=${rec.pid} tree=${live.length} from ${posix(f)}` : `cleared: ${posix(f)} (no live process of that run)`);
    unlinkSync(f);
  }
  return lines;
}

const posix = (p) => p.split(sep).join("/");
const money = (n) => String(Math.round(n * 1e9) / 1e9);
// A line longer than this is not an OpenCode event; holding it unbounded would let one unterminated line
// postpone every cost after it, so it ends the run instead.
const MAX_LINE_BYTES = 8 * 1024 * 1024;
// After the child exits, its pipes get this long to drain before the wrapper closes them and writes its verdict.
const DRAIN_MS = 5000;

/**
 * What one exported session (and every task session under it) spent: the sum of its step-finish costs. Throws
 * when the export fails, does not parse, or has a step-finish without a readable cost (ADR-2022).
 */
export function exportedSpend(text, id) {
  const i = text.indexOf("{");
  let j;
  try { j = JSON.parse(text.slice(i)); } catch { throw new Error(`the export of ${id} is not JSON`); }
  let cost = 0, finishes = 0, nodes = 0;
  const kids = new Set();
  // Bounded: an export is data from another program, and a pathological one must end the read, not the stack.
  const walk = (o, depth) => {
    if (!o || typeof o !== "object") return;
    if (depth > 64 || ++nodes > 2_000_000) throw new Error(`the export of ${id} is too deep or too large to read`);
    if (o.type === "step-finish") {
      finishes++;
      const c = typeof o.cost === "string" && /^[0-9]+(\.[0-9]+)?(e-?[0-9]+)?$/i.test(o.cost) ? Number(o.cost) : o.cost;
      if (typeof c !== "number" || !Number.isFinite(c) || c < 0) throw new Error(`the export of ${id} has a step-finish without a numeric cost`);
      cost += c;
    }
    const k = o.type === "tool" && o.state?.metadata?.sessionId;
    if (typeof k === "string" && /^ses_[A-Za-z0-9]+$/.test(k)) kids.add(k);
    for (const v of Object.values(o)) walk(v, depth + 1);
  };
  walk(j, 0);
  return { cost, finishes, kids: [...kids] };
}

/**
 * The fence a command runs under (ADR-2027, debt row 22). A rendered command whose front matter names
 * `agent: <stem>-fence` carries its tool fence in that agent; launching the session AS that agent puts the
 * top-level session inside the fence too, where a subagent fence left the parent with its own tools (P07 run 5).
 * An explicit --agent wins. A command that names a fence whose file is missing is refused, never run unfenced.
 * Returns the agent name, or null for a command with no fence (no allowed-tools in its source).
 */
export function commandFence(cwd, command) {
  const rendered = join(cwd, ".opencode", "commands", `${command}.md`);
  const fenceFile = join(cwd, ".opencode", "agents", `${command}-fence.md`);
  const source = join(cwd, ".claude", "commands", `${command}.md`);
  const front = (file) => {
    const text = readFileSync(file, "utf8").replace(/\r/g, "");
    const m = /^---\n([\s\S]*?)\n---\n/.exec(text);
    return m ? m[1] : null;
  };
  // A source with allowed-tools, or a fence file on disk, means this command has a fence: a missing or stale render
  // is refused by name, never run under the default agent.
  const fenced = existsSync(fenceFile) || (existsSync(source) && /^allowed-tools:/m.test(front(source) ?? ""));
  if (!existsSync(rendered)) {
    if (fenced) throw new Refusal("NO-FENCE", `.opencode/commands/${command}.md is missing while the command has a fence: render it (node bin/arc.mjs compile --self)`);
    return null;
  }
  const head = front(rendered);
  const m = head && /^agent:\s*(\S+)\s*$/m.exec(head);
  if (!m) {
    if (fenced) throw new Refusal("NO-FENCE", `.opencode/commands/${command}.md names no agent while the command has a fence: the render is stale or edited`);
    return null;
  }
  const agent = m[1].replace(/^["']|["']$/g, "");
  if (agent !== `${command}-fence`) throw new Refusal("NO-FENCE", `.opencode/commands/${command}.md names agent \`${agent}\`, not its own fence ${command}-fence`);
  if (!existsSync(fenceFile)) throw new Refusal("NO-FENCE", `.opencode/commands/${command}.md names the fence ${agent}, and .opencode/agents/${agent}.md is missing: the run would be unfenced`);
  const fh = front(fenceFile) ?? "";
  if (!/^mode:\s*all\s*$/m.test(fh) || !/^ {2}"\*":\s*deny\s*$/m.test(fh)) throw new Refusal("NO-FENCE", `.opencode/agents/${agent}.md is not a session fence (needs mode: all and "*": deny): a stale render binds only a subagent`);
  if (/^ {4}"\*":\s*allow\s*$/m.test(fh) && !/^allowed-tools:.*\bBash(,|\s|$)/m.test(existsSync(source) ? front(source) ?? "" : "")) throw new Refusal("NO-FENCE", `.opencode/agents/${agent}.md allows every bash command although the command grants no bare Bash`);
  // In an arc checkout the source and the renderer are both here: the fence must be exactly what they render now,
  // so a fence edited by hand or left from before a narrowing never binds a session (attack 0eb78f6 B4).
  if (existsSync(join(cwd, "engine", "frontmatter-keys.yaml")) && existsSync(source)) {
    let want = null;
    try { want = renderSourceTree(cwd, "opencode").files.get(`.opencode/agents/${agent}.md`) ?? null; } catch (e) { throw new Refusal("NO-FENCE", `cannot render ${agent} to compare it: ${e.message}`); }
    if (want === null || readFileSync(fenceFile, "utf8").replace(/\r/g, "") !== want.replace(/\r/g, "")) throw new Refusal("NO-FENCE", `.opencode/agents/${agent}.md differs from what the source renders now: run node bin/arc.mjs compile --self`);
  }
  return agent;
}

export async function run(o) {
  const cwd = resolve(o.cwd ?? process.cwd());
  const fence = o.agent ? null : commandFence(cwd, o.command);
  if (fence) o.agent = fence;
  const transcript = resolve(o.transcript);
  const errPath = `${transcript}.stderr`;
  for (const p of [transcript, errPath])
    if (existsSync(p)) throw new Refusal("TRANSCRIPT", `${p} exists: a transcript is a record, never overwritten`);
  if (!existsSync(dirname(transcript))) throw new Refusal("TRANSCRIPT", `${dirname(transcript)} does not exist: create the evidence directory first`);
  const ledger = resolve(o.ledgerDir ?? join(ARC_ROOT, "initiatives", "distribute", "evidence"));
  const prior = priorSpend(ledger) + o.priorSpent;
  // The cycle cap can only count what it can see: a transcript is written where the next run's ledger walk reads it.
  const under = relative(realpathSync(ledger), join(realpathSync(dirname(transcript)), basename(transcript)));
  if (under.startsWith("..") || isAbsolute(under) || basename(dirname(transcript)) !== "transcripts" || !transcript.endsWith(".jsonl"))
    throw new Refusal("TRANSCRIPT", `${transcript} is not a transcripts/*.jsonl file under the ledger ${ledger}, so the cycle cap would never count it`);
  if (prior + o.cap > o.cycleCap + 1e-12)
    throw new Refusal("CYCLE-CAP", `prior spend ${money(prior)} + this cap ${o.cap} exceeds the cycle cap ${o.cycleCap}; remaining ${money(Math.max(0, o.cycleCap - prior))}`);
  for (const l of reapStale(ledger)) process.stderr.write(`opencode-session: ${l}\n`);
  const bin = resolveBin();
  // Never --auto (measured on 1.17.18, P05 probes): headless, a permission OpenCode would ask about is refused,
  // which is the fence working; --auto approved every such ask under a primary agent and hung forever under a
  // command's subagent fence, the shape of the second live smoke.
  // A unique title names the session even when the run is killed before its first event, so a kill can still find
  // it and charge what its subagents spent (attack 7c30208 B1).
  const title = `arc-${basename(transcript, ".jsonl")}-${Date.now().toString(36)}`;
  const args = ["run", "--pure", "--title", title, "--command", o.command];
  if (o.agent) args.push("--agent", o.agent);
  args.push("-m", o.model, "--format", "json", "--", o.message);
  launch(bin, args, {}); // refuses an argument a .cmd shim would mangle, before any spend
  const ver = version(bin, cwd);
  let spine, sessionRepo, transcriptRepo, top;
  try {
    spine = canonicalSpine(cwd);
    sessionRepo = realpathSync(git(cwd, ["rev-parse", "--path-format=absolute", "--git-common-dir"]));
  } catch (e) {
    if (e instanceof Refusal) throw e;
    throw new Refusal("SPINE", `${cwd} is not inside a git checkout, so no canonical spine can be named`);
  }
  // The receipt's evidence is the transcript's path inside the checkout that holds it, and that checkout must be
  // the session's own repository, or the receipt names a file in a tree it will never be merged into.
  try {
    top = git(dirname(transcript), ["rev-parse", "--show-toplevel"]);
    transcriptRepo = realpathSync(git(dirname(transcript), ["rev-parse", "--path-format=absolute", "--git-common-dir"]));
  } catch { throw new Refusal("EVIDENCE", `${transcript} is not inside a git repository, so no receipt could cite it`); }
  if (transcriptRepo !== sessionRepo) throw new Refusal("EVIDENCE", `${transcript} is in a different repository from the session cwd ${cwd}`);
  const evidence = posix(relative(realpathSync(top), join(realpathSync(dirname(transcript)), basename(transcript))));
  if (!evidence || evidence.startsWith("..") || isAbsolute(evidence)) throw new Refusal("EVIDENCE", `${transcript} is outside its checkout`);
  // The header is space-separated, and the emitter's evidence grammar has no room for these either.
  for (const [k, v] of [["cwd", posix(cwd)], ["spine", posix(spine)], ["evidence", evidence]])
    if (/[\s\\]/.test(v) || Buffer.byteLength(v, "utf8") > 512) throw new Refusal("EVIDENCE", `${k} \`${v}\` holds whitespace, a backslash or is too long for the header and the receipt`);

  const header = (session) =>
    `harness-proof: opencode ${ver} session=${session} model=${o.model} cap_usd=${o.cap} command=${o.command} cwd=${posix(cwd)} spine=${posix(spine)} evidence=${evidence} date=${started} fence=${fence ?? (o.agent ? `explicit:${o.agent}` : "none")}`;
  const started = new Date().toISOString();
  const errFd = openSync(errPath, "wx");
  let fd;
  try { fd = openSync(transcript, "wx"); } catch (e) { closeSync(errFd); throw e; }
  let ioFailed = null;
  const out = (s) => { try { writeSync(fd, `${s}\n`); } catch (e) { ioFailed ??= e; } };
  // Line 1 exists before anything can spend: a wrapper killed outright still leaves a header whose cap_usd the
  // next run's ledger charges in full. It is rewritten with the session id when the run ends.
  out(header("pending"));

  let spent = 0, finishes = 0, unpriced = 0, stepLike = 0, events = 0, session = null, verdict = null, overflow = false;
  const charged = new Set();
  // A subagent session is charged once, with every nested task session under it, before the next event is read.
  const charge = (id) => {
    if (charged.has(id)) return;
    charged.add(id);
    const l = launch(bin, ["export", id], { cwd, env: { ...process.env, PWD: cwd }, encoding: "utf8", timeout: 60_000, maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    const r = spawnSync(l.cmd, l.args, l.opts);
    let got;
    try {
      if (r.error || r.status !== 0) throw new Error(`opencode export ${id} failed (status ${r.status})`);
      got = exportedSpend(String(r.stdout || ""), id);
      // A subagent that ran took at least one step; an export with none is unreadable, never a free run (7c30208 B3).
      if (got.finishes === 0) throw new Error(`the export of ${id} holds no step-finish`);
    } catch (e) { unpriced++; out(`subagent: ${id} COST-UNREADABLE ${e.message}`); return; }
    spent += got.cost;
    out(`subagent: ${id} spent=${money(got.cost)} steps=${got.finishes}`);
    for (const k of got.kids) charge(k);
  };
  const oc = (args) => {
    const l = launch(bin, args, { cwd, env: { ...process.env, PWD: cwd }, encoding: "utf8", timeout: 60_000, maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    const r = spawnSync(l.cmd, l.args, l.opts);
    if (r.error || r.status !== 0) throw new Error(`opencode ${args[0]} failed (status ${r.status})`);
    return String(r.stdout || "");
  };
  const sweep = () => {
    try {
      let id = session;
      if (!id) {
        const text = oc(["session", "list", "--format", "json", "-n", "50"]);
        const list = JSON.parse(text.slice(text.indexOf("[")));
        const hit = Array.isArray(list) ? list.find((x) => x && x.title === title) : null;
        if (!hit || typeof hit.id !== "string" || !/^ses_[A-Za-z0-9]+$/.test(hit.id)) throw new Error(`no session titled ${title}`);
        id = hit.id;
        session = id;
      }
      const kids = exportedSpend(oc(["export", id]), id).kids;
      out(`sweep: ${id} ${kids.length} subagent session(s)`);
      for (const k of kids) charge(k);
    } catch (e) { unpriced++; out(`sweep: COST-UNREADABLE ${e.message}`); }
  };
  let child = null, finalised = false, interrupted = null, stopSnap = () => {}, seenEntries = () => [];
  const stop = (v) => { if (verdict === null) { verdict = v; if (child) killTree(child); } };
  const finalise = (code) => {
    if (finalised) return verdict;
    finalised = true;
    let left = [];
    stopSnap();
    if (child) {
      // The tree is read while its leader lives; a leader that already exited has no tree left to walk.
      const leading = child.exitCode === null && child.signalCode === null;
      // One listing: the live tree under a leader that still runs, plus every pid seen while it ran whose command
      // line is unchanged -- a recorded pid the OS has since handed to another program is never touched (0eb78f6 B1).
      const procs = process.platform === "win32" ? winProcs() : posixProcs();
      const now = (pid) => (procs?.get(pid) ? `${procs.get(pid).start} ${procs.get(pid).cmd}` : null);
      const tree = new Map();
      if (leading) for (const pid of treePids(child.pid, procs ?? undefined)) tree.set(pid, now(pid));
      for (const [pid, cmd] of seenEntries()) if (now(pid) === cmd) tree.set(pid, cmd);
      for (const pid of tree.keys()) if (pid !== child.pid) killTree({ pid });
      killTree(child); // a leader that exited may have left its group behind (stragglers keep spending)
      left = survivors([...tree.keys()], false);
      if (!left.length && process.platform !== "win32") left = survivors([child.pid], true);
      // A survivor stays on record, with its command line, for the next run's reap (0eb78f6 B3).
      if (left.length) { try { writePidfile(`${transcript}.pid`, { pid: child.pid, wrapper: process.pid, wrapperCmd: "", started, tree: left.map((pid) => ({ pid, cmd: tree.get(pid) ?? now(pid) ?? "" })).filter((t) => t.cmd) }); } catch (e) { ioFailed ??= e; } }
    }
    // A killed run never streams the finished task events, so its subagents' spend is read from the parent's own
    // export, found by title when no event named the session (attack 7c30208 B1).
    if (child && (verdict !== null || interrupted)) sweep();
    if (left.length) { verdict = 7; for (const pid of left) out(`kill: survivor pid=${pid}`); }
    else if (interrupted) { verdict = 6; out(`interrupted: ${interrupted}`); }
    else if (verdict === 3) out(`cap-breach: spent=${money(spent)} cap=${o.cap}`);
    else if (verdict === 5) out(`timeout: after ${o.timeoutS}s`);
    else if (overflow) out(`overflow: a stdout line passed ${MAX_LINE_BYTES} bytes`);
    else if (ioFailed) { verdict = 1; out(`io-failed: ${ioFailed.code || ioFailed.message}`); }
    else if (unpriced > 0 || (finishes === 0 && stepLike > 0) || (code === 0 && events > 0 && finishes === 0)) {
      verdict = 4;
      out(`COST-UNREADABLE: ${finishes} step-finish event(s), ${unpriced} without a numeric cost, ${stepLike} step-like event(s), ${events} event(s)`);
    }
    else if (code !== 0) { verdict = 1; out(`child-failed: exit ${code}`); }
    else verdict = 0;
    out(`spent=${money(spent)}`);
    if (!left.length) { try { unlinkSync(`${transcript}.pid`); } catch { /* never written */ } }
    try { closeSync(fd); } catch { /* reported above */ }
    try { closeSync(errFd); } catch { /* reported above */ }
    try {
      const text = readFileSync(transcript, "utf8");
      const nl = text.indexOf("\n");
      writeFileSync(transcript, header(session ?? "none") + (nl >= 0 ? text.slice(nl) : "\n"));
    } catch (e) { ioFailed ??= e; if (verdict === 0) verdict = 1; }
    return verdict;
  };
  // A signal does not fire `exit`, so each one kills the tree and writes the verdict itself (attack 5823248 B1).
  const signals = ["SIGINT", "SIGTERM", "SIGHUP", "SIGBREAK"].filter((s) => process.platform === "win32" || s !== "SIGBREAK");
  const onSignal = (sig) => { interrupted = sig; finalise(-1); process.exit(130); };
  const onExit = () => { if (!finalised) { interrupted ??= "the wrapper exited"; finalise(-1); } };
  for (const s of signals) process.on(s, onSignal);
  process.on("exit", onExit);
  const detach = () => { for (const s of signals) process.removeListener(s, onSignal); process.removeListener("exit", onExit); };

  let code;
  try {
    // PWD too: OpenCode takes its project directory from an inherited PWD over the spawn cwd, so a shell that
    // launched the wrapper elsewhere sent the first live smoke to the wrong checkout, with no .opencode/ in it.
    const env = { ...process.env, PWD: cwd, ARC_HARNESS: "opencode", ARC_MODEL: o.model, ARC_SPINE_ROOT: spine, ARC_EVIDENCE: evidence };
    const l = launch(bin, args, { cwd, env, stdio: ["ignore", "pipe", "pipe"], detached: process.platform !== "win32", windowsHide: true });
    child = spawn(l.cmd, l.args, l.opts);
    const seen = new Map();
    const wrapperCmd = commandLine(process.pid) ?? "";
    const record = () => {
      if (!child.pid) return;
      if (child.exitCode === null && child.signalCode === null) {
        const procs = process.platform === "win32" ? winProcs() : posixProcs();
        if (procs) for (const pid of treePids(child.pid, procs)) if (!seen.has(pid) && procs.get(pid)?.cmd) seen.set(pid, `${procs.get(pid).start} ${procs.get(pid).cmd}`);
      }
      try { writePidfile(`${transcript}.pid`, { pid: child.pid, wrapper: process.pid, wrapperCmd, started, tree: [...seen].map(([pid, cmd]) => ({ pid, cmd })) }); } catch (e) { ioFailed ??= e; }
    };
    record();
    // A wrapper that dies leaves this file behind; the tree in it is what the next run reaps.
    const snap = [setTimeout(record, 1000), setInterval(record, 3000)];
    for (const t of snap) t.unref();
    stopSnap = () => { clearTimeout(snap[0]); clearInterval(snap[1]); };
    seenEntries = () => [...seen];
    let buf = "";
    const onLine = (line) => {
      if (line === "") return;
      out(line);
      const e = readEvent(line);
      if (e.json) events++;
      if (e.session && !session) session = e.session;
      if (e.stepLike) stepLike++;
      if (e.finish) finishes++;
      if (e.unpriced) unpriced++;
      if (e.cost !== null) spent += e.cost;
      if (e.child && e.child !== session) charge(e.child);
      if (spent >= o.cap) stop(3);
      if (ioFailed) stop(1);
    };
    // A decoder, not chunk.toString(): a multi-byte character split across two chunks stays one character.
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (d) => {
      buf += d;
      let k;
      while ((k = buf.indexOf("\n")) >= 0) { onLine(buf.slice(0, k).replace(/\r$/, "")); buf = buf.slice(k + 1); }
      if (Buffer.byteLength(buf, "utf8") > MAX_LINE_BYTES) { overflow = true; buf = ""; stop(1); }
    });
    child.stderr.on("data", (d) => { try { writeSync(errFd, d); } catch (e) { ioFailed ??= e; stop(1); } });
    const timer = setTimeout(() => stop(5), o.timeoutS * 1000);
    code = await new Promise((res) => {
      let drain = null, settled = false;
      const done = (c) => { if (settled) return; settled = true; clearTimeout(drain); res(c); };
      child.on("error", (err) => { try { writeSync(errFd, `spawn error: ${err.message}\n`); } catch { /* reported below */ } done(-1); });
      child.on("close", (c) => done(c));
      // A grandchild holding the pipes open keeps `close` from firing; `exit` plus a bounded drain ends the wait.
      child.on("exit", (c) => { drain = setTimeout(() => { killTree(child); child.stdout.destroy(); child.stderr.destroy(); done(c); }, DRAIN_MS); });
    });
    clearTimeout(timer);
    if (buf) onLine(buf.replace(/\r$/, ""));
  } catch (e) {
    try { writeSync(errFd, `wrapper error: ${e && e.message}\n`); } catch { /* reported below */ }
    ioFailed ??= e;
    code = -1;
  } finally {
    detach();
  }
  const v = finalise(code);
  return { code: v, spent, session, transcript };
}

const NAMES = { 0: "ok", 1: "CHILD-FAILED", 3: "CAP-BREACH", 4: "COST-UNREADABLE", 5: "TIMEOUT", 6: "INTERRUPTED", 7: "KILL-INCOMPLETE" };

async function main(argv) {
  let o;
  try { o = validate(parseArgs(argv)); }
  catch (e) {
    if (!(e instanceof Refusal)) throw e;
    process.stderr.write(`opencode-session: REFUSED ${e.code}: ${e.message}\n`);
    return 2;
  }
  try {
    const r = await run(o);
    const line = `opencode-session: ${NAMES[r.code]} spent=${money(r.spent)} session=${r.session ?? "none"} transcript=${posix(r.transcript)}`;
    (r.code === 0 ? process.stdout : process.stderr).write(`${line}\n`);
    return r.code;
  } catch (e) {
    if (!(e instanceof Refusal)) throw e;
    process.stderr.write(`opencode-session: REFUSED ${e.code}: ${e.message}\n`);
    return 2;
  }
}

function isMain() {
  try { return !!process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); } catch { return false; }
}

if (isMain()) main(process.argv.slice(2)).then((c) => { process.exitCode = c; });
