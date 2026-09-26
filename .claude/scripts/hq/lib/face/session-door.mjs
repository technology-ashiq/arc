// session-door -- the SESSION door behind arc-dash (face v2 Phase 06; REQ-08, ADR-1326 · ADR-1334 · ADR-1339).
//
// Four verbs, and no session state of its own:
//
//   click()            a one-shot click token. The face asks for one inside the owner's click handler and spends it on
//                      start; a start without an unspent token is refused. A page load, a reload, an attach or a
//                      replayed request carries none, so none of them can start a session.
//   start(id, body)    validate the owner's fields against the face-sessions row, build THE argv (sessionCommand), run
//                      driverOnly() on it, and start `node arc-run.mjs --process … --driver …` DETACHED, its stdout and
//                      stderr written to ONE file -- one file, so the lines keep the order the run wrote them in.
//   read(sid)          attach: the session as its files and the spine hold it -- what it was started as, the lines it
//                      has written so far, how it ended, and the receipts it printed that the spine holds.
//   list()             the registry, and the newest sessions on disk.
//
// NO SESSION STATE IN THE DOOR. A session is its directory, sessions/<sid>/: session.json (written at start), run.log
// (the run's own output) and exit.json (written when the door that started it sees it end). Each JSON file is written to
// a temp name and renamed over, so a poll never reads half of one. A door restarted mid-run reads the same files, so
// attach still shows the run, and a run the door never saw end says exactly that. In memory: the unspent click tokens,
// and which runs THIS door started and has not yet seen end -- a hint that only ever says "read again".
//
// A SESSION IS A MODEL WITH TOOLS, not a deterministic CLI, so guards the work door does not need (attacks 60c13e9,
// 8e389a5):
//   - its env is an ALLOW-list: OS basics, arc's own ARC_* (never the door's ARC_DASH_*, never the leads lane's steering
//     list) and the model providers' keys. A deploy or VCS token in the owner's shell never reaches it.
//   - it is told only its transcript directory, session-transcripts/<sid>/. The door's trusted files live in a sibling
//     tree it is never named, and every one of them is shape-checked on read.
//   - every served line and payload passes the secret deny-rules as well as the path scrub, whole, before any cut.
//   - it starts only on a feat/* branch (main is untouchable, ADR-1326), and attach flags a checkout that moved since.
//   - a receipt is credited only when the run NAMED it in arc-run's own line, of a kind the row claims or arc-run's own
//     run.completed for this process. Everything else it printed is "unattributed".

import { randomBytes, createHash } from "node:crypto";
import { execFile, spawn as nodeSpawn, spawnSync } from "node:child_process";
import { closeSync, existsSync, fstatSync, lstatSync, mkdirSync, openSync, readdirSync, readFileSync, readSync, realpathSync, renameSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { join, sep } from "node:path";

import { query, spineStamp } from "../../spine.mjs";
import { validateInput } from "../../face-ops.mjs";
import { DENY_RULES } from "../redact.mjs";
import { ENV_LOCAL_FORBIDDEN as LEADS_STEERING } from "../../../leads/lib/mail.mjs";
import { SESSIONS, SessionError, sessionById, sessionCommand, driverOnly, sessionDrivers, processFileOf, processNames, sessionsView } from "../../face-sessions.mjs";
import { childEnv, scrub, scrubDeep } from "./reads.mjs";

const CLICK_TTL_MS = 60_000;
const CLICKS_CAP = 64;
// <9 base36 chars of the start ms><7 random>: sorted by NAME, the newest sessions come first with no fs call.
const SID_RE = /^[0-9a-z]{9}[A-Za-z0-9_-]{7}$/;
const CLICK_RE = /^[A-Za-z0-9_-]{24}$/;
// What attach serves of a run's output: the TAIL, and how much it left out -- a silently cut log reads like a short one.
const LOG_TAIL = 256 * 1024;
const LINES_KEPT = 400;
const LINE_CAP = 8192;
const RUNS_LISTED = 20;
const RECEIPTS_KEPT = 50;
// Paid children alive at once, from this door's disk. The click limits the rate of starts, not the number running.
const RUNNING_CAP = 3;
// Directories running() looks at, newest first. Past it the scan says it stopped, rather than silently missing one.
const RUNNING_SCAN = 256;
// A session older than this no longer holds a slot: a reused pid or a hung driver must not block every later start.
const SESSION_MAX_MS = 6 * 60 * 60_000;
const ULID_RE = /^[0-7][0-9A-HJKMNP-TV-Z]{25}$/;
// arc-run names its own receipt on stderr, once: `arc-run: receipt run.completed <ULID>` (arc-run.mjs emitRun).
const RECEIPT_LINE = /^arc-run: receipt ([a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*)+) ([0-7][0-9A-HJKMNP-TV-Z]{25})\s*$/;
const ULID_ANYWHERE = /(?<![0-9A-Z])[0-7][0-9A-HJKMNP-TV-Z]{25}(?![0-9A-Z])/g;
const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
// A session writes files; it starts only on a feature branch (ADR-1326: main is untouchable).
const BRANCH_RE = /^feat\/[A-Za-z0-9._/-]+$/;

/** The HTTP status each session-door refusal carries. */
export const SESSION_STATUS = Object.freeze({
  UNKNOWN_SESSION: 404, UNKNOWN_RUN: 404,
  BAD_SESSION_BODY: 400, BAD_RUN_ID: 400, BAD_DRIVER: 400,
  CLICK_REQUIRED: 428,
  NO_PROCESS: 503, NO_ARC_RUN: 503, CONFIRM_STEP_UNENFORCED: 503, DRIVERS_UNREADABLE: 503,
  SIM_SPEND: 403, BRANCH_REFUSED: 409, SESSION_RUNNING: 409, SESSIONS_BUSY: 429,
  DRIVER_ONLY: 500, SPAWN_FAILED: 502, RUN_OUTSIDE: 403, RUN_UNREADABLE: 503,
});

// Processes held back by a row's confirm step. Refused by NAME, whichever row starts them -- dispatch included.
const HELD = new Map(SESSIONS.filter((s) => s.confirmStep && s.process).map((s) => [s.process, s]));

// ---- the env a session child gets: an allow-list ----
const OS_NAMES = new Set(["PATH", "PATHEXT", "SYSTEMROOT", "WINDIR", "COMSPEC", "TEMP", "TMP", "TMPDIR", "HOME", "USERPROFILE", "HOMEDRIVE", "HOMEPATH",
  "APPDATA", "LOCALAPPDATA", "PROGRAMDATA", "PROGRAMFILES", "PROGRAMFILES(X86)", "PROGRAMW6432", "COMMONPROGRAMFILES", "SYSTEMDRIVE", "OS",
  "USER", "USERNAME", "LOGNAME", "SHELL", "LANG", "LANGUAGE", "TZ", "TERM", "NUMBER_OF_PROCESSORS", "PROCESSOR_ARCHITECTURE",
  "NODE_EXTRA_CA_CERTS", "SSL_CERT_FILE", "SSL_CERT_DIR", "HTTP_PROXY", "HTTPS_PROXY", "NO_PROXY", "ALL_PROXY"]);
// The model providers the drivers reach. Their keys are the drivers' business; nothing else of the owner's shell is.
const PROVIDER_PREFIXES = ["ANTHROPIC_", "OPENAI_", "CLAUDE_", "CODEX_", "GEMINI_", "OPENROUTER_", "HERMES_", "AZURE_OPENAI_"];
const LEADS_UPPER = new Set(LEADS_STEERING.map((n) => n.toUpperCase()));
/** @param {string} name */
function envAllowed(name) {
  const up = name.toUpperCase();
  if (up.startsWith("ARC_DASH_") || up.startsWith("ARC_LEADS_") || LEADS_UPPER.has(up)) return false;
  if (OS_NAMES.has(up) || up.startsWith("LC_") || up.startsWith("XDG_")) return true;
  if (up.startsWith("ARC_")) return true;
  if (up === "GOOGLE_API_KEY") return true;
  return PROVIDER_PREFIXES.some((p) => up.startsWith(p));
}
/** @param {{ root: string }} ctx */
function sessionEnv(ctx) {
  const env = Object.fromEntries(Object.entries(childEnv()).filter(([k]) => envAllowed(k)));
  // The door names the spine; the child never inherits one from wherever the door was started (attack 60c13e9 B2).
  env.ARC_SPINE_ROOT = ctx.root;
  // A session's phases show while they happen: arc-run writes its driver's progress into run.log as each step lands,
  // instead of all at once when the run ends (Phase 06 slice 03c). Set by the door, never inherited.
  env.ARC_RUN_STREAM = "1";
  return env;
}

// ---- the secret deny-rules, applied to what the door SERVES (ADR-1325: no key in the browser) ----
const REDACT = [
  ...DENY_RULES.map((r) => ({ name: r.name, re: new RegExp(r.re.source, r.re.flags.includes("g") ? r.re.flags : `${r.re.flags}g`) })),
  { name: "jwt", re: /eyJ[A-Za-z0-9_-]{8,512}\.[A-Za-z0-9_-]{8,2048}\.[A-Za-z0-9_-]{8,2048}/g },
  // The door's own token rides the page's #token= fragment; an echoed URL carries it.
  { name: "door-token", re: /[#?&]token=[^\s&#]{8,512}/gi },
];
/** @param {string} s */
export function redactLine(s) {
  let out = String(s);
  for (const r of REDACT) out = out.replace(r.re, `[${r.name} redacted]`);
  return out;
}
/** @param {unknown} v @returns {unknown} */
function redactDeep(v) {
  if (typeof v === "string") return redactLine(v);
  if (Array.isArray(v)) return v.map(redactDeep);
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, redactDeep(x)]));
  return v;
}

/** The ms a ULID was minted at. @param {string} id */
function ulidTime(id) {
  let t = 0;
  for (const c of id.slice(0, 10)) t = t * 32 + CROCKFORD.indexOf(c);
  return t;
}

/**
 * A JSON file the door wrote: { value }, { absent } or { torn } -- never a torn read passed off as absence. `shape`
 * rejects a well-formed file of the wrong shape as torn: a value the door did not write is not state.
 * @param {string} p @param {(v: any) => boolean} shape
 */
function readJson(p, shape) {
  let raw;
  try { raw = readFileSync(p, "utf8"); } catch (e) { return /** @type {any} */ (e).code === "ENOENT" ? { absent: true } : { torn: true }; }
  try { const v = JSON.parse(raw); return shape(v) ? { value: v } : { torn: true }; } catch { return { torn: true }; }
}
const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const intOrNull = (v) => v === null || Number.isInteger(v);
const metaShape = (v) => isObj(v) && typeof v.sid === "string" && typeof v.session === "string" && typeof v.process === "string" && typeof v.driver === "string"
  && typeof v.startedAt === "number" && intOrNull(v.pid) && Array.isArray(v.argv);
const exitShape = (v) => isObj(v) && intOrNull(v.exit) && (v.signal === null || typeof v.signal === "string") && typeof v.endedAt === "number";

/** Write a JSON file whole or not at all: a temp name in the same directory, renamed over; the temp never left behind. */
function writeJsonAtomic(p, v) {
  const t = `${p}.${randomBytes(4).toString("hex")}.tmp`;
  writeFileSync(t, JSON.stringify(v));
  try { renameSync(t, p); } catch (e) { try { unlinkSync(t); } catch { /* already gone */ } throw e; }
}

/** Is `pid` still a live process? A reused pid reads alive; exit.json and the age ceiling both win over this. */
function alive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; } catch (e) { return /** @type {any} */ (e).code === "EPERM"; }
}

/** The branch the door's checkout is on, or null (detached, unreadable, no git). Blocking -- start only. @param {string} repo */
function currentBranch(repo) {
  const r = spawnSync("git", ["symbolic-ref", "--quiet", "--short", "HEAD"], { cwd: repo, env: childEnv(), encoding: "utf8", timeout: 10_000, windowsHide: true });
  if (r.status !== 0) return null;
  return String(r.stdout).trim() || null;
}
/** The same read, without blocking the door: attach asks it on every poll of a running session. @param {string} repo */
function currentBranchAsync(repo) {
  return new Promise((res) => {
    execFile("git", ["symbolic-ref", "--quiet", "--short", "HEAD"], { cwd: repo, env: childEnv(), encoding: "utf8", timeout: 5_000, windowsHide: true },
      (err, stdout) => res(err ? null : String(stdout).trim() || null));
  });
}

/**
 * @param {{ mode: string, root: string, repo: string, journalDir: string }} ctx
 * @param {{ journal?: (entry: Record<string, unknown>) => void, now?: () => number, spawn?: typeof nodeSpawn, drivers?: () => readonly string[],
 *   branch?: () => string | null, branchAsync?: () => Promise<string | null> }} [opts]
 */
export function createSessionDoor(ctx, opts = {}) {
  const journalRaw = opts.journal || (() => {});
  // The journal is evidence, never the effect: a failed line is said on stderr and changes no answer (attack 60c13e9 B4).
  const journal = (entry) => { try { journalRaw(entry); } catch (e) { process.stderr.write(`session-door: WARN journal write failed (${/** @type {any} */ (e).code || "error"})\n`); } };
  const now = opts.now || Date.now;
  const spawn = opts.spawn || nodeSpawn;
  // Read per call, never cached: a directory unreadable for a moment at boot must not make every driver BAD_DRIVER.
  const drivers = opts.drivers || (() => sessionDrivers());
  const branch = opts.branch || (() => currentBranch(ctx.repo));
  const branchAsync = opts.branchAsync || (opts.branch ? async () => branch() : () => currentBranchAsync(ctx.repo));
  const sessionsDir = join(ctx.journalDir, "sessions");
  const transcriptsDir = join(ctx.journalDir, "session-transcripts");
  /** @type {Map<string, number>} token -> expiry */
  const clicks = new Map();
  /** Runs this door started and has not yet seen end: while one is here and its pid is gone, the answer is "read again". */
  const pending = new Set();
  /** @type {{ stamp: string, byId: Map<string, any> } | null} */
  let scanCache = null;

  function click() {
    const t = now();
    for (const [k, exp] of clicks) if (exp <= t) clicks.delete(k);
    // Past the cap the OLDEST token goes: a page that asked for tokens and never spent them cannot grow the map.
    while (clicks.size >= CLICKS_CAP) clicks.delete(clicks.keys().next().value);
    const token = randomBytes(18).toString("base64url");
    clicks.set(token, t + CLICK_TTL_MS);
    return { mode: ctx.mode, click: token, expiresInMs: CLICK_TTL_MS };
  }

  /** Spend a click token: true once per token, inside its life. @param {unknown} token */
  function spend(token) {
    if (typeof token !== "string" || !CLICK_RE.test(token)) return false;
    const exp = clicks.get(token);
    clicks.delete(token);
    return exp !== undefined && exp > now();
  }

  /** A session directory, contained in the door's own, or null. @param {string} name */
  function contained(name) {
    if (!SID_RE.test(name)) return null;
    const d = join(sessionsDir, name);
    try {
      // A junction planted where a session directory belongs would serve another tree's record under this door's name.
      const real = realpathSync(d);
      if (!real.startsWith(realpathSync(sessionsDir) + sep)) return null;
      return statSync(real).isDirectory() ? d : null;
    } catch { return null; }
  }

  /** A session's directory for attach, with a named refusal. @param {string} sid */
  function dirOf(sid) {
    if (typeof sid !== "string" || !SID_RE.test(sid)) throw new SessionError("BAD_RUN_ID", "a session is read by the id its start returned");
    if (!existsSync(join(sessionsDir, sid))) throw new SessionError("UNKNOWN_RUN", "no session with that id is on this door's disk");
    const d = contained(sid);
    if (!d) throw new SessionError("RUN_OUTSIDE", "that session's directory resolves outside this door's -- not read");
    return d;
  }

  /** Session names, newest first by NAME (the sid leads with its start time) -- no fs call per directory. */
  function names() {
    try { return readdirSync(sessionsDir).filter((n) => SID_RE.test(n)).sort().reverse(); } catch { return []; }
  }

  /** How a session stands, from its files alone. @param {string} dir @param {any} meta */
  function stateOf(dir, meta) {
    const ex = readJson(join(dir, "exit.json"), exitShape);
    if (ex.value) return { state: "done", exit: ex.value.exit, signal: ex.value.signal };
    // Torn is not absent: the door may be writing it this instant. Never fall through to a terminal answer on a torn read.
    if (ex.torn) return { state: "unknown", exit: null, signal: null, note: "exit.json could not be read as the door writes it -- read again" };
    const isAlive = alive(meta.pid);
    if (isAlive && now() - meta.startedAt > SESSION_MAX_MS) return { state: "stale", exit: null, signal: null, note: `older than ${SESSION_MAX_MS / 3_600_000} h with no recorded end -- a hung run or a reused pid; it no longer holds a slot` };
    if (isAlive) return { state: "running", exit: null, signal: null };
    // This door started it and has not been told it ended: the exit event may be a tick away (attack 8e389a5 B13).
    if (pending.has(meta.sid)) return { state: "unknown", exit: null, signal: null, note: "the run has just ended and the door is recording it -- read again" };
    if (meta.pid === null) return { state: "unknown", exit: null, signal: null, note: "the run's pid was never recorded; the log and the spine are all there is" };
    return { state: "ended", exit: null, signal: null, note: "the door did not see this run end (it restarted, or the run was killed); the log and the spine are all there is" };
  }

  function list() {
    const runs = names().slice(0, RUNS_LISTED)
      .map((n) => ({ sid: n, dir: contained(n) }))
      .filter((r) => r.dir)
      .map((r) => ({ ...r, meta: readJson(join(/** @type {string} */ (r.dir), "session.json"), metaShape).value }))
      .filter((r) => r.meta)
      .map((r) => ({ sid: r.sid, session: r.meta.session, process: r.meta.process, driver: r.meta.driver, startedAt: r.meta.startedAt, state: stateOf(/** @type {string} */ (r.dir), r.meta).state }));
    let drv = [];
    try { drv = drivers(); } catch { /* list still answers; start names the refusal */ }
    return { mode: ctx.mode, sessions: sessionsView(ctx.repo), drivers: ["auto", ...drv], processes: processNames(ctx.repo), runs };
  }

  /** The sessions this door's disk says are running: every directory without an end, newest first, to a stated ceiling. */
  function running() {
    const all = names();
    const out = [];
    for (const n of all.slice(0, RUNNING_SCAN)) {
      const d = contained(n);
      if (!d || existsSync(join(d, "exit.json"))) continue;
      const meta = readJson(join(d, "session.json"), metaShape).value;
      if (meta && stateOf(d, meta).state === "running") out.push(meta);
    }
    return { live: out, capped: all.length > RUNNING_SCAN };
  }

  /** @param {string} sessionId @param {unknown} body */
  function start(sessionId, body) {
    const s = sessionById(sessionId);
    if (body === null || typeof body !== "object" || Array.isArray(body)) throw new SessionError("BAD_SESSION_BODY", "a start takes { click, input, driver }");
    for (const k of Object.keys(body)) if (!["click", "input", "driver", "process"].includes(k)) throw new SessionError("BAD_SESSION_BODY", `a start takes { click, input, driver${s.pickProcess ? ", process" : ""} }, not "${k}"`);
    const b = /** @type {any} */ (body);
    // THE CLICK, spent first: a start with a bad body still costs the token, so one click can never be retried into two.
    if (!spend(b.click)) throw new SessionError("CLICK_REQUIRED", `${s.id} starts only from the owner's click -- ask POST /api/session-click inside the click, and spend it once`);
    const values = validateInput({ id: s.id, fields: s.fields }, b.input === undefined ? {} : b.input);
    let drv;
    try { drv = drivers(); } catch (e) { throw new SessionError("DRIVERS_UNREADABLE", `the driver list could not be read (${/** @type {any} */ (e).code || "error"}) -- nothing started`); }
    const driver = b.driver === undefined ? "auto" : b.driver;
    if (typeof driver !== "string" || (driver !== "auto" && !drv.includes(driver))) throw new SessionError("BAD_DRIVER", `driver must be auto or one of ${drv.join(", ")}`);
    if (b.process !== undefined && !s.pickProcess) throw new SessionError("BAD_SESSION_BODY", `${s.id} runs its own process; only dispatch takes one`);
    const proc = s.pickProcess ? b.process : s.process;
    // A process a row holds back for the owner's confirmation is held back BY NAME: dispatch cannot reach it either
    // (attack 8e389a5 B1). Checked before the file, so the refusal does not change the day the file lands.
    const held = typeof proc === "string" ? HELD.get(proc) : undefined;
    if (held) throw new SessionError("CONFIRM_STEP_UNENFORCED", `${proc} stops for your confirmation before its ${held.confirmStep} step, and no session can carry that stop yet -- NOT SHIPPABLE from any row (phase 06 spec)`);
    if (typeof proc !== "string" || !processFileOf(ctx.repo, proc))
      throw new SessionError("NO_PROCESS", s.pickProcess
        ? `dispatch takes a process on this tree (${processNames(ctx.repo).join(", ") || "none"})`
        : `${s.id} is NOT SHIPPABLE yet: processes/${s.process}.process.yaml is not on this tree -- the engine lane adds it (ADR-1339)`);
    // A sim door answers against a fixture spine: a session there runs on the mock driver or not at all.
    if (ctx.mode === "sim" && driver !== "mock") throw new SessionError("SIM_SPEND", `this door is in sim mode -- a session here runs on the mock driver, which spends nothing`);

    // Everything that can refuse WITHOUT writing runs before anything is created (attack 8e389a5 B11).
    const sid = `${now().toString(36).padStart(9, "0").slice(-9)}${randomBytes(6).toString("base64url").slice(0, 7)}`;
    const dir = join(sessionsDir, sid);
    const transcript = join(transcriptsDir, sid);
    const cmd = sessionCommand(proc, driver, values, transcript);
    // The check runs on the argv ABOUT to be spawned, not on the row: a bug in sessionCommand cannot reach a child.
    const refused = driverOnly(cmd, drv);
    if (refused) throw new SessionError("DRIVER_ONLY", `${s.id}: ${refused} -- nothing started (ADR-1326)`);
    let real;
    try { real = realpathSync(join(ctx.repo, ".claude", "scripts", ...cmd.script.split("/"))); }
    catch (e) { throw new SessionError("NO_ARC_RUN", `.claude/scripts/${cmd.script} is not on this tree (${/** @type {any} */ (e).code || "error"}) -- nothing started`); }
    if (!real.startsWith(realpathSync(ctx.repo) + sep)) throw new SessionError("DRIVER_ONLY", `${cmd.script} resolves outside this tree -- nothing started`);
    const br = branch();
    if (!br || !BRANCH_RE.test(br)) throw new SessionError("BRANCH_REFUSED", `a session writes files, and this checkout is on ${br ? `"${br}"` : "no branch git could name"} -- start it from a feat/* branch; main is untouchable (ADR-1326)`);
    const digest = createHash("sha256").update(JSON.stringify([s.id, proc, values])).digest("hex");
    const { live, capped } = running();
    if (live.some((m) => m.digest === digest)) throw new SessionError("SESSION_RUNNING", `${s.id} with this input is already running -- attach to it rather than start a second`);
    if (live.length >= RUNNING_CAP) throw new SessionError("SESSIONS_BUSY", `${live.length} sessions are running on this door (the cap is ${RUNNING_CAP}) -- wait for one to end`);

    mkdirSync(dir, { recursive: true });
    mkdirSync(transcript, { recursive: true });
    const startedAt = now();
    const meta = { sid, session: s.id, room: s.room, process: proc, driver, branch: br, startedAt, digest,
      argv: ["node", `.claude/scripts/${cmd.script}`, ...cmd.args.map((a) => redactLine(String(scrub(a, ctx.repo))))], receipt: s.receipt, pid: null, runningScanCapped: capped };
    writeJsonAtomic(join(dir, "session.json"), meta);
    const fd = openSync(join(dir, "run.log"), "a");
    let child;
    try {
      // DETACHED, output to a file: the run outlives the door, and a restarted door reads it back from disk.
      child = spawn(process.execPath, [real, ...cmd.args], { cwd: ctx.repo, env: sessionEnv(ctx), detached: true, windowsHide: true, stdio: ["ignore", fd, fd] });
    } catch (e) {
      try { closeSync(fd); } catch { /* already closed */ }
      try { writeJsonAtomic(join(dir, "exit.json"), { exit: null, signal: "spawn-failed", endedAt: now() }); } catch { /* the directory went away */ }
      throw new SessionError("SPAWN_FAILED", `${s.id}: arc-run did not start (${redactLine(String(scrub(e instanceof Error ? e.message : String(e), ctx.repo)))})`);
    }
    // THE LISTENERS FIRST, before any bookkeeping that can throw: a live child with no 'error' listener is an uncaught
    // exception that takes the door down, and no 'exit' listener means no exit.json ever (attack 60c13e9 B3).
    pending.add(sid);
    const recordEnd = (rec) => {
      // Once, then once more: exit.json is the only proof the door saw the end, so a failed write is said, never swallowed.
      for (let attempt = 0; attempt < 2; attempt++) {
        try { writeJsonAtomic(join(dir, "exit.json"), rec); pending.delete(sid); return; }
        catch (e) { if (attempt === 1) process.stderr.write(`session-door: WARN ${sid} exit not recorded (${/** @type {any} */ (e).code || "error"})\n`); }
      }
      pending.delete(sid);
    };
    child.on("error", (e) => recordEnd({ exit: null, signal: "spawn-failed", error: redactLine(String(scrub(e.message, ctx.repo))), endedAt: now() }));
    child.on("exit", (code, signal) => {
      recordEnd({ exit: code, signal, endedAt: now() });
      journal({ session: s.id, phase: "end", sid, exit: code });
    });
    try { child.unref(); } catch { /* a child that cannot unref still runs */ }
    // Bookkeeping after the effect can be LOST; it can never turn a started run into a refusal that invites a retry.
    try { closeSync(fd); } catch { /* the child holds its own copy */ }
    meta.pid = child.pid ?? null;
    try { writeJsonAtomic(join(dir, "session.json"), meta); } catch (e) { process.stderr.write(`session-door: WARN ${sid} pid not recorded (${/** @type {any} */ (e).code || "error"})\n`); }
    journal({ session: s.id, phase: "start", sid, process: proc, driver });
    return { mode: ctx.mode, sid, session: s.id, process: proc, driver, command: meta.argv, pid: meta.pid, branch: br, state: "running" };
  }

  /**
   * The last LOG_TAIL bytes of run.log, and how many came before them -- one descriptor, one size. The file must be a
   * plain file inside the session's directory; a link the run swapped in is not read (attack 8e389a5 B4). When the
   * tail starts mid-file its first, partial line is dropped and counted: a key cut in half has no prefix left for a
   * deny-rule to find (attack 8e389a5 B9).
   * @param {string} dir
   */
  function tail(dir) {
    const p = join(dir, "run.log");
    try {
      if (!lstatSync(p).isFile() || !realpathSync(p).startsWith(realpathSync(dir) + sep)) return { raw: "", bytesDropped: 0, logRefused: true };
    } catch { return { raw: "", bytesDropped: 0 }; }
    let fd;
    try { fd = openSync(p, "r"); } catch { return { raw: "", bytesDropped: 0 }; }
    try {
      const size = fstatSync(fd).size;
      const from = Math.max(0, size - LOG_TAIL);
      const buf = Buffer.alloc(size - from);
      let got = 0;
      while (got < buf.length) {
        const n = readSync(fd, buf, got, buf.length - got, from + got);
        if (n <= 0) break;
        got += n;
      }
      let body = buf.subarray(0, got);
      let skip = 0;
      if (from > 0) {
        const nl = body.indexOf(0x0a);
        skip = nl === -1 ? body.length : nl + 1;
      }
      return { raw: body.subarray(skip).toString("utf8"), bytesDropped: from + skip };
    } finally { closeSync(fd); }
  }

  /** @param {string} sid */
  async function read(sid) {
    const dir = dirOf(sid);
    const rec = readJson(join(dir, "session.json"), metaShape);
    if (!rec.value) throw new SessionError("RUN_UNREADABLE", "that session's record could not be read as the door writes it -- read again");
    const meta = rec.value;
    const { raw, bytesDropped, logRefused } = tail(dir);
    const all = raw.split(/\r?\n/);
    if (all.length && all[all.length - 1] === "") all.pop();
    // Redacted WHOLE, then cut: a cut first can split a key below a rule's minimum length (attack 8e389a5 B9).
    const lines = all.slice(-LINES_KEPT).map((l) => {
      const clean = redactLine(String(scrub(l, ctx.repo)));
      return clean.length > LINE_CAP ? `${clean.slice(0, LINE_CAP)} [line cut at ${LINE_CAP} characters]` : clean;
    });
    const st = stateOf(dir, meta);
    let receipts = { receipts: [], receiptsDropped: 0, unattributed: [] }, receiptsError = null;
    try { receipts = await receiptsOf(all, meta); }
    catch (e) { receiptsError = /** @type {any} */ (e).code || "SCAN_FAILED"; }
    // A checkout that moved since the start: the run's writes land wherever HEAD is now (attack 8e389a5 B7).
    let branchNow = null;
    if (st.state === "running") branchNow = await branchAsync();
    return {
      mode: ctx.mode, sid, session: meta.session, room: meta.room, process: meta.process, driver: meta.driver, command: meta.argv, pid: meta.pid,
      branch: meta.branch ?? null, ...(branchNow !== null && branchNow !== meta.branch ? { branchMoved: { from: meta.branch ?? null, to: branchNow } } : {}),
      startedAt: meta.startedAt, ...st, lines, linesDropped: Math.max(0, all.length - LINES_KEPT), bytesDropped, ...(logRefused ? { logRefused: true } : {}),
      ...receipts, ...(receiptsError ? { receiptsError } : {}),
    };
  }

  /** Every event on the spine, by id, re-read only when the spine's stat fingerprint moved. */
  async function spineById() {
    const stamp = spineStamp(ctx.root).join("\n");
    if (scanCache && scanCache.stamp === stamp) return scanCache.byId;
    const { events } = await query(ctx.root, { engine: "scan" });
    scanCache = { stamp, byId: new Map(events.map((e) => [e.event.id, e.event])) };
    return scanCache.byId;
  }

  /**
   * The receipts THIS run wrote. Credited only when arc-run's own line NAMED it, the spine holds it with that kind, it
   * was minted after the run began, and it is of a kind this session can write: the row's claimed kind, or arc-run's
   * run.completed for THIS process. A bare id, or a named one of another kind or process, is listed as unattributed --
   * the model's text shares the file with arc-run's line, so a line alone proves nothing (attack 8e389a5 B5).
   * @param {string[]} lines @param {any} meta
   */
  async function receiptsOf(lines, meta) {
    /** @type {Map<string, string | null>} */
    const named = new Map();
    for (const l of lines) {
      const m = RECEIPT_LINE.exec(l);
      if (m) { named.set(m[2], m[1]); continue; }
      for (const u of l.matchAll(ULID_ANYWHERE)) if (!named.has(u[0])) named.set(u[0], null);
    }
    const ids = [...named.keys()].filter((id) => ULID_RE.test(id) && ulidTime(id) >= meta.startedAt - 2000);
    if (!ids.length) return { receipts: [], receiptsDropped: 0, unattributed: [] };
    const byId = await spineById();
    const claimed = meta.receipt && typeof meta.receipt.kind === "string" ? meta.receipt.kind : null;
    const out = [], unattributed = [];
    for (const id of ids) {
      const ev = byId.get(id);
      if (!ev) continue;
      const kind = named.get(id);
      const ok = kind !== null && kind === ev.kind
        && ((ev.kind === "run.completed" && typeof ev.process === "string" && ev.process.startsWith(`${meta.process}@`)) || (claimed !== null && ev.kind === claimed && ev.kind !== "run.completed"));
      if (!ok) { if (unattributed.length < RECEIPTS_KEPT) unattributed.push(id); continue; }
      out.push({ id: ev.id, kind: ev.kind, ts: ev.ts, outcome: ev.outcome, process: ev.process, attributedBy: ev.kind === "run.completed" ? "process" : "named-line", payload: redactDeep(scrubDeep(ev.payload, ctx.repo)) });
    }
    return { receipts: out.slice(0, RECEIPTS_KEPT), receiptsDropped: Math.max(0, out.length - RECEIPTS_KEPT), unattributed };
  }

  return { list, click, start, read, rows: SESSIONS };
}
