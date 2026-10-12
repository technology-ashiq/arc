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
  try { st = statSync(dir); } catch { return 0; } // no evidence dir yet: nothing spent
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
  const none = { finish: false, cost: null, unpriced: false, session: null };
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
  return { finish, cost, unpriced: finish && cost === null, session: typeof s === "string" && /^ses_[A-Za-z0-9]+$/.test(s) ? s : null };
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
  return join(dirname(common), ".claude", "state", "hq");
}

function killTree(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/T", "/F", "/PID", String(child.pid)], { stdio: "ignore", windowsHide: true });
  } else {
    try { process.kill(-child.pid, "SIGKILL"); } catch { try { child.kill("SIGKILL"); } catch { /* gone */ } }
  }
}

const posix = (p) => p.split(sep).join("/");
const money = (n) => String(Math.round(n * 1e9) / 1e9);
// A line longer than this is not an OpenCode event; holding it unbounded would let one unterminated line
// postpone every cost after it, so it ends the run instead.
const MAX_LINE_BYTES = 8 * 1024 * 1024;
// After the child exits, its pipes get this long to drain before the wrapper closes them and writes its verdict.
const DRAIN_MS = 5000;

export async function run(o) {
  const cwd = resolve(o.cwd ?? process.cwd());
  const transcript = resolve(o.transcript);
  const errPath = `${transcript}.stderr`;
  for (const p of [transcript, errPath])
    if (existsSync(p)) throw new Refusal("TRANSCRIPT", `${p} exists: a transcript is a record, never overwritten`);
  if (!existsSync(dirname(transcript))) throw new Refusal("TRANSCRIPT", `${dirname(transcript)} does not exist: create the evidence directory first`);
  const ledger = resolve(o.ledgerDir ?? join(ARC_ROOT, "initiatives", "distribute", "evidence"));
  const prior = priorSpend(ledger) + o.priorSpent;
  if (prior + o.cap > o.cycleCap + 1e-12)
    throw new Refusal("CYCLE-CAP", `prior spend ${money(prior)} + this cap ${o.cap} exceeds the cycle cap ${o.cycleCap}; remaining ${money(Math.max(0, o.cycleCap - prior))}`);
  const bin = resolveBin();
  const args = ["run", "--pure", "--auto", "--command", o.command];
  if (o.agent) args.push("--agent", o.agent);
  args.push("-m", o.model, "--format", "json", "--", o.message);
  launch(bin, args, {}); // refuses an argument a .cmd shim would mangle, before any spend
  const ver = version(bin, cwd);
  let spine;
  try { spine = canonicalSpine(cwd); } catch { throw new Refusal("SPINE", `${cwd} is not inside a git checkout, so no canonical spine can be named`); }
  // The receipt's evidence is the transcript's path inside the repository that holds it, so the receipt
  // resolves on the merged tree. A transcript outside every repository could prove nothing a receipt cites.
  let evidence = null;
  try {
    const top = git(dirname(transcript), ["rev-parse", "--show-toplevel"]);
    const rel = posix(relative(realpathSync(top), join(realpathSync(dirname(transcript)), basename(transcript))));
    if (rel && !rel.startsWith("..") && !isAbsolute(rel)) evidence = rel;
  } catch { evidence = null; }
  if (evidence === null) throw new Refusal("EVIDENCE", `${transcript} is not inside a git repository, so no receipt could cite it`);

  const fd = openSync(transcript, "wx");
  const errFd = openSync(errPath, "wx");
  let ioFailed = null;
  const out = (s) => { try { writeSync(fd, `${s}\n`); } catch (e) { ioFailed ??= e; } };
  const header = (session) =>
    `harness-proof: opencode ${ver} session=${session} model=${o.model} cap_usd=${o.cap} command=${o.command} cwd=${posix(cwd)} spine=${posix(spine)} evidence=${evidence} date=${new Date().toISOString()}`;

  const env = { ...process.env, ARC_HARNESS: "opencode", ARC_MODEL: o.model, ARC_SPINE_ROOT: spine, ARC_EVIDENCE: evidence };
  const l = launch(bin, args, { cwd, env, stdio: ["ignore", "pipe", "pipe"], detached: process.platform !== "win32", windowsHide: true });
  const child = spawn(l.cmd, l.args, l.opts);
  // If this process dies for any reason, OpenCode does not outlive it and keep spending.
  const onExit = () => killTree(child);
  process.on("exit", onExit);

  let spent = 0, finishes = 0, unpriced = 0, session = null, wroteHeader = false, verdict = null, overflow = false;
  const pending = [];
  const flushHeader = (s) => { if (!wroteHeader) { out(header(s)); wroteHeader = true; for (const p of pending.splice(0)) out(p); } };
  const stop = (v) => { if (verdict === null) { verdict = v; killTree(child); } };
  let buf = "";
  const onLine = (line) => {
    if (line === "") return;
    const e = readEvent(line);
    if (e.session && !session) session = e.session;
    if (wroteHeader) out(line); else { pending.push(line); if (session) flushHeader(session); }
    if (e.finish) finishes++;
    if (e.unpriced) unpriced++;
    if (e.cost !== null) spent += e.cost;
    if (spent >= o.cap) stop(3);
    if (ioFailed) stop(1);
  };
  child.stdout.on("data", (d) => {
    buf += d.toString("utf8");
    let k;
    while ((k = buf.indexOf("\n")) >= 0) { onLine(buf.slice(0, k).replace(/\r$/, "")); buf = buf.slice(k + 1); }
    if (Buffer.byteLength(buf, "utf8") > MAX_LINE_BYTES) { overflow = true; buf = ""; stop(1); }
  });
  child.stderr.on("data", (d) => { try { writeSync(errFd, d); } catch (e) { ioFailed ??= e; stop(1); } });
  const timer = setTimeout(() => stop(5), o.timeoutS * 1000);

  const code = await new Promise((res) => {
    let drain = null, settled = false;
    const done = (c) => { if (settled) return; settled = true; clearTimeout(drain); res(c); };
    child.on("error", (err) => { try { writeSync(errFd, `spawn error: ${err.message}\n`); } catch { /* reported below */ } done(-1); });
    child.on("close", (c) => done(c));
    // A grandchild holding the pipes open keeps `close` from firing; `exit` plus a bounded drain ends the wait.
    child.on("exit", (c) => { drain = setTimeout(() => { child.stdout.destroy(); child.stderr.destroy(); done(c); }, DRAIN_MS); });
  });
  clearTimeout(timer);
  process.removeListener("exit", onExit);
  if (buf) onLine(buf.replace(/\r$/, ""));
  flushHeader(session ?? "none");
  if (verdict === 3) out(`cap-breach: spent=${money(spent)} cap=${o.cap}`);
  else if (verdict === 5) out(`timeout: after ${o.timeoutS}s`);
  else if (overflow) out(`overflow: a stdout line passed ${MAX_LINE_BYTES} bytes`);
  else if (ioFailed) out(`io-failed: ${ioFailed.code || ioFailed.message}`);
  else if (unpriced > 0) { verdict = 4; out(`COST-UNREADABLE: ${unpriced} of ${finishes} step-finish event(s) carried no numeric cost`); }
  else if (code !== 0) { verdict = 1; out(`child-failed: exit ${code}`); }
  else verdict = 0;
  out(`spent=${money(spent)}`);
  try { closeSync(fd); } catch { /* reported above */ }
  try { closeSync(errFd); } catch { /* reported above */ }
  if (ioFailed && verdict === 0) verdict = 1;
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
