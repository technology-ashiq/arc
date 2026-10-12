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
 * The child is always `opencode run --pure --auto --command C [--agent A] -m M --format json -- MESSAGE`, spawned
 * from an argv array. The binary is `ARC_OPENCODE_BIN`, else `opencode` on PATH.
 *
 * Exit: 0 ok · 1 OpenCode exited non-zero · 2 refused before spend (usage, model, cap, cycle cap, binary,
 * version, transcript already present) · 3 cap breach · 4 COST-UNREADABLE · 5 timeout.
 * Every path that spawned OpenCode ends the transcript with `spent=<sum>`.
 *
 * Zero dependencies, Node 18+.
 */

import { spawn, spawnSync, execFileSync } from "node:child_process";
import { closeSync, existsSync, openSync, readFileSync, readdirSync, realpathSync, statSync, writeSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

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
    if (v === undefined || v === "" || v.startsWith("--")) throw new Refusal("USAGE", `${a} needs a value`);
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
  o.priorSpent = usd(o.priorSpent, "--prior-spent-usd", { allowZero: true });
  if (!o.model) throw new Refusal("MODEL", "--model is required");
  if (!/^[a-z0-9][a-z0-9._-]*\/[A-Za-z0-9._/:-]+$/.test(o.model)) throw new Refusal("MODEL", `--model \`${o.model}\` is not provider/model`);
  if (/anthropic|claude/i.test(o.model)) throw new Refusal("MODEL", `--model \`${o.model}\` is an Anthropic model; this wrapper exists for non-Anthropic runs (REQ-03)`);
  if (!o.command || !/^[a-z][a-z0-9-]{0,63}$/.test(o.command)) throw new Refusal("USAGE", "--command must name one command ([a-z][a-z0-9-]*)");
  if (o.agent !== null && !/^[a-z][a-z0-9-]{0,63}$/.test(o.agent)) throw new Refusal("USAGE", "--agent must be [a-z][a-z0-9-]*");
  if (!o.transcript) throw new Refusal("USAGE", "--transcript is required: a run with no record is never started");
  if (!/^[1-9][0-9]{0,4}$/.test(String(o.timeoutS))) throw new Refusal("USAGE", "--timeout-s must be 1-99999");
  o.timeoutS = Number(o.timeoutS);
  return o;
}

/** The last `spent=` line of a transcript, or 0 when it has none (a run that never spawned). */
export function spentOf(text) {
  let last = 0;
  for (const line of text.split(/\r?\n/)) {
    const m = /^spent=([0-9]+(?:\.[0-9]+)?)$/.exec(line);
    if (m) last = Number(m[1]);
  }
  return last;
}

/** Sum the final spend of every committed transcript under DIR (any depth, `transcripts/*.jsonl`). */
export function priorSpend(dir) {
  let total = 0;
  const walk = (d) => {
    let names;
    try { names = readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of names) {
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.isFile() && e.name.endsWith(".jsonl") && d.split(/[\\/]/).pop() === "transcripts")
        total += spentOf(readFileSync(p, "utf8"));
    }
  };
  walk(dir);
  return total;
}

/** Cost and session id from one OpenCode JSON event line; nulls when it carries neither. */
export function readEvent(line) {
  let j;
  try { j = JSON.parse(line); } catch { return { json: false, step: false, cost: null, session: null }; }
  if (j === null || typeof j !== "object") return { json: false, step: false, cost: null, session: null };
  const part = j.part && typeof j.part === "object" ? j.part : {};
  const type = String(j.type ?? "");
  const step = /^step[_-](start|finish)$/.test(type) || /^step-(start|finish)$/.test(String(part.type ?? ""));
  let cost = null;
  for (const c of [part.cost, j.cost]) if (typeof c === "number" && Number.isFinite(c) && c >= 0) { cost = c; break; }
  const s = j.sessionID ?? part.sessionID ?? null;
  return { json: true, step, cost, session: typeof s === "string" && /^ses_[A-Za-z0-9]+$/.test(s) ? s : null };
}

// cmd.exe quoting for a .cmd/.bat binary: MSVCRT rules first, then every cmd metacharacter caret-escaped.
// A shim that re-reads its arguments through %* is parsed by cmd twice, so the escape is applied twice.
const CMD_META = /([()\][%!^"`<>&|;, *?])/g;
function cmdArg(arg) {
  let a = String(arg).replace(/(\\*)"/g, '$1$1\\"').replace(/(\\*)$/, "$1$1");
  a = `"${a}"`;
  return a.replace(CMD_META, "^$1").replace(CMD_META, "^$1");
}

function launch(bin, args, opts) {
  if (process.platform === "win32" && /\.(cmd|bat)$/i.test(bin)) {
    const line = [bin.replace(CMD_META, "^$1"), ...args.map(cmdArg)].join(" ");
    return { cmd: process.env.ComSpec || "cmd.exe", args: ["/d", "/s", "/c", `"${line}"`], opts: { ...opts, windowsVerbatimArguments: true } };
  }
  return { cmd: bin, args, opts };
}

function resolveBin() {
  const named = process.env.ARC_OPENCODE_BIN;
  if (named !== undefined) {
    if (named === "" || !existsSync(named)) throw new Refusal("BINARY", `ARC_OPENCODE_BIN \`${named}\` does not exist`);
    return named;
  }
  // On Windows an extensionless `opencode` beside the shim is npm's sh script for MSYS, which spawn cannot run.
  const exts = process.platform === "win32" ? [".exe", ".cmd", ".bat"] : [""];
  for (const d of String(process.env.PATH || "").split(process.platform === "win32" ? ";" : ":")) {
    for (const e of exts) {
      const p = join(d, `opencode${e}`);
      try { if (d && statSync(p).isFile()) return p; } catch { /* next */ }
    }
  }
  throw new Refusal("BINARY", "no `opencode` on PATH and ARC_OPENCODE_BIN unset");
}

function version(bin) {
  const l = launch(bin, ["--version"], { encoding: "utf8", timeout: VERSION_TIMEOUT_MS, stdio: ["ignore", "pipe", "pipe"] });
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
  return join(dirname(common), ".claude", "state", "hq");
}

function killTree(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/T", "/F", "/PID", String(child.pid)], { stdio: "ignore" });
  } else {
    try { process.kill(-child.pid, "SIGKILL"); } catch { try { child.kill("SIGKILL"); } catch { /* gone */ } }
  }
}

const posix = (p) => p.split(sep).join("/");
const money = (n) => String(Math.round(n * 1e9) / 1e9);

export async function run(o) {
  const cwd = resolve(o.cwd ?? process.cwd());
  const transcript = resolve(o.transcript);
  if (existsSync(transcript)) throw new Refusal("TRANSCRIPT", `${transcript} exists: a transcript is a record, never overwritten`);
  if (!existsSync(dirname(transcript))) throw new Refusal("TRANSCRIPT", `${dirname(transcript)} does not exist: create the evidence directory first`);
  const ledger = resolve(o.ledgerDir ?? join(ARC_ROOT, "initiatives", "distribute", "evidence"));
  const prior = priorSpend(ledger) + o.priorSpent;
  if (prior + o.cap > o.cycleCap + 1e-12)
    throw new Refusal("CYCLE-CAP", `prior spend ${money(prior)} + this cap ${o.cap} exceeds the cycle cap ${o.cycleCap}; remaining ${money(Math.max(0, o.cycleCap - prior))}`);
  const bin = resolveBin();
  const ver = version(bin);
  let spine;
  try { spine = canonicalSpine(cwd); } catch { throw new Refusal("SPINE", `${cwd} is not inside a git checkout, so no canonical spine can be named`); }
  // The receipt's evidence is the transcript's path inside the repository that holds it, so the receipt
  // resolves on the merged tree; a transcript outside any repository stamps no evidence.
  let evidence = null;
  try {
    const top = git(dirname(transcript), ["rev-parse", "--show-toplevel"]);
    const rel = posix(relative(realpathSync(top), join(realpathSync(dirname(transcript)), basename(transcript))));
    if (rel && !rel.startsWith("..") && !isAbsolute(rel)) evidence = rel;
  } catch { evidence = null; }

  const fd = openSync(transcript, "wx");
  const errFd = openSync(`${transcript}.stderr`, "w");
  const out = (s) => writeSync(fd, `${s}\n`);
  const header = (session) =>
    `harness-proof: opencode ${ver} session=${session} model=${o.model} cap_usd=${o.cap} command=${o.command} cwd=${posix(cwd)} spine=${posix(spine)} date=${new Date().toISOString()}`;

  const args = ["run", "--pure", "--auto", "--command", o.command];
  if (o.agent) args.push("--agent", o.agent);
  args.push("-m", o.model, "--format", "json", "--", o.message);
  const env = { ...process.env, ARC_HARNESS: "opencode", ARC_MODEL: o.model, ARC_SPINE_ROOT: spine };
  if (evidence) env.ARC_EVIDENCE = evidence; else delete env.ARC_EVIDENCE;
  const l = launch(bin, args, { cwd, env, stdio: ["ignore", "pipe", "pipe"], detached: process.platform !== "win32", windowsHide: true });
  const child = spawn(l.cmd, l.args, l.opts);

  let spent = 0, costs = 0, steps = 0, session = null, wroteHeader = false, verdict = null;
  const pending = [];
  const flushHeader = (s) => { if (!wroteHeader) { out(header(s)); wroteHeader = true; for (const p of pending.splice(0)) out(p); } };
  let buf = "";
  const onLine = (line) => {
    if (line === "") return;
    const e = readEvent(line);
    if (e.session && !session) session = e.session;
    if (wroteHeader) out(line); else { pending.push(line); if (session) flushHeader(session); }
    if (e.step) steps++;
    if (e.cost !== null) { costs++; spent += e.cost; }
    if (verdict === null && spent >= o.cap) { verdict = 3; killTree(child); }
  };
  child.stdout.on("data", (d) => {
    buf += d.toString("utf8");
    let k;
    while ((k = buf.indexOf("\n")) >= 0) { onLine(buf.slice(0, k).replace(/\r$/, "")); buf = buf.slice(k + 1); }
  });
  child.stderr.on("data", (d) => writeSync(errFd, d));
  const timer = setTimeout(() => { if (verdict === null) { verdict = 5; killTree(child); } }, o.timeoutS * 1000);

  const code = await new Promise((res) => {
    child.on("error", (err) => { writeSync(errFd, `spawn error: ${err.message}\n`); res(-1); });
    child.on("close", (c) => res(c));
  });
  clearTimeout(timer);
  if (buf) onLine(buf.replace(/\r$/, ""));
  flushHeader(session ?? "none");
  if (verdict === 3) out(`cap-breach: spent=${money(spent)} cap=${o.cap}`);
  else if (verdict === 5) out(`timeout: after ${o.timeoutS}s`);
  else if (steps > 0 && costs === 0) { verdict = 4; out("COST-UNREADABLE: steps ran and no event carried a numeric cost"); }
  else if (code !== 0) { verdict = 1; out(`child-failed: exit ${code}`); }
  else verdict = 0;
  out(`spent=${money(spent)}`);
  closeSync(fd); closeSync(errFd);
  return { code: verdict, spent, session, transcript };
}

const NAMES = { 0: "ok", 1: "CHILD-FAILED", 3: "CAP-BREACH", 4: "COST-UNREADABLE", 5: "TIMEOUT" };

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
