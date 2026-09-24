// session-door -- the SESSION door behind arc-dash (face v2 Phase 06; REQ-08, ADR-1326 · ADR-1334 · ADR-1339).
//
// Four verbs, and no session state of its own:
//
//   click()            a one-shot click token. The face asks for one inside the owner's click handler and spends it on
//                      start; a start without an unspent token is refused. A page load, a reload, an attach or a
//                      replayed request carries none, so none of them can start a session.
//   start(id, body)    validate the owner's fields against the face-sessions row, build THE argv (sessionCommand), run
//                      driverOnly() on it, and start `node arc-run.mjs --process … --driver …` DETACHED, its stdout and
//                      stderr written to ONE file in the session's directory -- one file, so the lines keep the order
//                      the run wrote them in.
//   read(sid)          attach: the session as its directory and the spine hold it -- what it was started as, the lines it
//                      has written so far, how it ended, and the receipts it printed that the spine holds.
//   list()             the registry, and the newest sessions on disk.
//
// NO SESSION STATE IN THE DOOR. A session is its directory: session.json (written at start), run.log (the run's own
// output) and exit.json (written when the door that started it sees it end). Each JSON file is written to a temp name
// and renamed over, so a poll never reads half of one. A door restarted mid-run reads the same files, so attach still
// shows the run, and a run the door never saw end says exactly that. The one thing held in memory is the unspent click
// tokens -- a restart forgets them, and a forgotten token can only refuse a start.
//
// A SESSION IS A MODEL WITH TOOLS, not a deterministic CLI, so four guards the work door does not need (attack 60c13e9):
// the child is told which spine to write to (ARC_SPINE_ROOT = the door's own), it never sees the door's token or
// journal (ARC_DASH_*), every line served is passed through the secret deny-rules as well as the path scrub, and it only
// starts on a feat/* branch -- a session writes files, and main is untouchable (ADR-1326).

import { randomBytes, createHash } from "node:crypto";
import { spawn as nodeSpawn, spawnSync } from "node:child_process";
import { closeSync, existsSync, fstatSync, mkdirSync, openSync, readdirSync, readFileSync, readSync, realpathSync, renameSync, statSync, writeFileSync } from "node:fs";
import { join, sep } from "node:path";

import { query } from "../../spine.mjs";
import { validateInput } from "../../face-ops.mjs";
import { DENY_RULES } from "../redact.mjs";
import { SESSIONS, SessionError, sessionById, sessionCommand, driverOnly, sessionDrivers, processFileOf, processNames, sessionsView } from "../../face-sessions.mjs";
import { childEnv, scrub, scrubDeep } from "./reads.mjs";

const CLICK_TTL_MS = 60_000;
const CLICKS_CAP = 64;
const SID_RE = /^[A-Za-z0-9_-]{16}$/;
const CLICK_RE = /^[A-Za-z0-9_-]{24}$/;
// What attach serves of a run's output: the TAIL, and how much it left out -- a silently cut log reads like a short one.
const LOG_TAIL = 256 * 1024;
const LINES_KEPT = 400;
const LINE_CAP = 8192;
const RUNS_LISTED = 20;
// Paid children alive at once, from this door's disk. The click limits the rate of starts, not the number running.
const RUNNING_CAP = 3;
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
  NO_PROCESS: 503, CONFIRM_STEP_UNENFORCED: 503, DRIVERS_UNREADABLE: 503,
  SIM_SPEND: 403, BRANCH_REFUSED: 409, SESSION_RUNNING: 409, SESSIONS_BUSY: 429,
  DRIVER_ONLY: 500, SPAWN_FAILED: 502, RUN_OUTSIDE: 403, RUN_UNREADABLE: 503,
});

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

/** A JSON file the door wrote: its value, "absent", or "torn" -- never a torn read passed off as absence. @param {string} p */
function readJson(p) {
  let raw;
  try { raw = readFileSync(p, "utf8"); } catch (e) { return /** @type {any} */ (e).code === "ENOENT" ? { absent: true } : { torn: true }; }
  try { return { value: JSON.parse(raw) }; } catch { return { torn: true }; }
}

/** Write a JSON file whole or not at all: a temp name in the same directory, renamed over. @param {string} p @param {unknown} v */
function writeJsonAtomic(p, v) {
  const t = `${p}.${randomBytes(4).toString("hex")}.tmp`;
  writeFileSync(t, JSON.stringify(v));
  renameSync(t, p);
}

/** Is `pid` still a live process? A reused pid reads alive; exit.json, when the door saw the end, wins over this. */
function alive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; } catch (e) { return /** @type {any} */ (e).code === "EPERM"; }
}

/** The env a session child gets: the door's child env, minus the door's own credentials, with the door's spine named. */
function sessionEnv(ctx) {
  const env = Object.fromEntries(Object.entries(childEnv()).filter(([k]) => !k.toUpperCase().startsWith("ARC_DASH_")));
  env.ARC_SPINE_ROOT = ctx.root;
  return env;
}

/** The branch the door's checkout is on, or null (detached, unborn-and-unreadable, no git). @param {string} repo */
function currentBranch(repo) {
  const r = spawnSync("git", ["symbolic-ref", "--quiet", "--short", "HEAD"], { cwd: repo, env: childEnv(), encoding: "utf8", timeout: 10_000, windowsHide: true });
  if (r.status !== 0) return null;
  const b = String(r.stdout).trim();
  return b || null;
}

/**
 * @param {{ mode: string, root: string, repo: string, journalDir: string }} ctx
 * @param {{ journal?: (entry: Record<string, unknown>) => void, now?: () => number, spawn?: typeof nodeSpawn, drivers?: () => readonly string[], branch?: () => string | null }} [opts]
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
  const sessionsDir = join(ctx.journalDir, "sessions");
  /** @type {Map<string, number>} token -> expiry */
  const clicks = new Map();

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

  /** The session directories, newest first by the directory's own mtime -- bounded before any record is parsed. */
  function newest(limit) {
    let names = [];
    try { names = readdirSync(sessionsDir); } catch { return []; }
    return names
      .map((n) => ({ n, d: contained(n) }))
      .filter((x) => x.d)
      .map((x) => { try { return { ...x, m: statSync(/** @type {string} */ (x.d)).mtimeMs }; } catch { return null; } })
      .filter(Boolean)
      .sort((a, b) => /** @type {any} */ (b).m - /** @type {any} */ (a).m)
      .slice(0, limit)
      .map((x) => /** @type {any} */ (x));
  }

  /** How a session stands, from its files alone. @param {string} dir @param {any} meta */
  function stateOf(dir, meta) {
    const ex = readJson(join(dir, "exit.json"));
    if (ex.value) return { state: "done", exit: ex.value.exit ?? null, signal: ex.value.signal ?? null };
    // Torn is not absent: the door may be writing it this instant. Never fall through to a terminal answer on a torn read.
    if (ex.torn) return { state: "unknown", exit: null, signal: null, note: "exit.json could not be read just now -- read again" };
    if (alive(meta.pid)) return { state: "running", exit: null, signal: null };
    if (meta.pid === null) return { state: "unknown", exit: null, signal: null, note: "the run's pid was never recorded; the log and the spine are all there is" };
    return { state: "ended", exit: null, signal: null, note: "the door did not see this run end (it restarted, or the run was killed); the log and the spine are all there is" };
  }

  function list() {
    const runs = newest(RUNS_LISTED)
      .map((x) => ({ sid: x.n, dir: x.d, meta: readJson(join(x.d, "session.json")).value }))
      .filter((r) => r.meta && typeof r.meta.startedAt === "number")
      .map((r) => ({ sid: r.sid, session: r.meta.session, process: r.meta.process, driver: r.meta.driver, startedAt: r.meta.startedAt, state: stateOf(r.dir, r.meta).state }));
    let drv = [];
    try { drv = drivers(); } catch { /* list still answers; start names the refusal */ }
    return { mode: ctx.mode, sessions: sessionsView(ctx.repo), drivers: ["auto", ...drv], processes: processNames(ctx.repo), runs };
  }

  /** The sessions this door's disk says are running, bounded by a scan of the newest directories. */
  function running() {
    return newest(64)
      .map((x) => ({ dir: x.d, meta: readJson(join(x.d, "session.json")).value }))
      .filter((r) => r.meta && stateOf(r.dir, r.meta).state === "running")
      .map((r) => r.meta);
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
    if (typeof proc !== "string" || !processFileOf(ctx.repo, proc))
      throw new SessionError("NO_PROCESS", s.pickProcess
        ? `dispatch takes a process on this tree (${processNames(ctx.repo).join(", ") || "none"})`
        : `${s.id} is NOT SHIPPABLE yet: processes/${s.process}.process.yaml is not on this tree -- the engine lane adds it (ADR-1339)`);
    // A row that must stop for the owner before an outward step (ship's deploy) starts only once that stop is carried to
    // arc-run and enforced there. Until then it is not shippable -- a process file alone must not turn it into one click.
    if (s.confirmStep) throw new SessionError("CONFIRM_STEP_UNENFORCED", `${s.id} stops for your confirmation before its ${s.confirmStep} step, and no session can carry that stop yet -- NOT SHIPPABLE (phase 06 spec)`);
    // A sim door answers against a fixture spine: a session there runs on the mock driver or not at all.
    if (ctx.mode === "sim" && driver !== "mock") throw new SessionError("SIM_SPEND", `this door is in sim mode -- a session here runs on the mock driver, which spends nothing`);
    const br = branch();
    if (!br || !BRANCH_RE.test(br)) throw new SessionError("BRANCH_REFUSED", `a session writes files, and this checkout is on ${br ? `"${br}"` : "no branch"} -- start it from a feat/* branch; main is untouchable (ADR-1326)`);
    const digest = createHash("sha256").update(JSON.stringify([s.id, proc, values])).digest("hex");
    const live = running();
    if (live.some((m) => m.digest === digest)) throw new SessionError("SESSION_RUNNING", `${s.id} with this input is already running -- attach to it rather than start a second`);
    if (live.length >= RUNNING_CAP) throw new SessionError("SESSIONS_BUSY", `${live.length} sessions are running on this door (the cap is ${RUNNING_CAP}) -- wait for one to end`);

    const sid = randomBytes(12).toString("base64url");
    const dir = join(sessionsDir, sid);
    mkdirSync(join(dir, "transcript"), { recursive: true });
    const cmd = sessionCommand(proc, driver, values, join(dir, "transcript"));
    // The check runs on the argv ABOUT to be spawned, not on the row: a bug in sessionCommand cannot reach a child.
    const refused = driverOnly(cmd, drv);
    if (refused) throw new SessionError("DRIVER_ONLY", `${s.id}: ${refused} -- nothing started (ADR-1326)`);
    const arcRun = join(ctx.repo, ".claude", "scripts", ...cmd.script.split("/"));
    const real = realpathSync(arcRun);
    if (!real.startsWith(realpathSync(ctx.repo) + sep)) throw new SessionError("DRIVER_ONLY", `${cmd.script} resolves outside this tree -- nothing started`);

    const startedAt = now();
    const meta = { sid, session: s.id, room: s.room, process: proc, driver, startedAt, digest, argv: ["node", `.claude/scripts/${cmd.script}`, ...cmd.args.map((a) => redactLine(String(scrub(a, ctx.repo))))], receipt: s.receipt, pid: null };
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
    child.on("error", (e) => { try { writeJsonAtomic(join(dir, "exit.json"), { exit: null, signal: "spawn-failed", error: redactLine(String(scrub(e.message, ctx.repo))), endedAt: now() }); } catch { /* the directory went away */ } });
    child.on("exit", (code, signal) => {
      try { writeJsonAtomic(join(dir, "exit.json"), { exit: code, signal, endedAt: now() }); } catch { /* the directory went away */ }
      journal({ session: s.id, phase: "end", sid, exit: code });
    });
    try { child.unref(); } catch { /* a child that cannot unref still runs */ }
    // Bookkeeping after the effect can be LOST; it can never turn a started run into a refusal that invites a retry.
    try { closeSync(fd); } catch { /* the child holds its own copy */ }
    meta.pid = child.pid ?? null;
    try { writeJsonAtomic(join(dir, "session.json"), meta); } catch (e) { process.stderr.write(`session-door: WARN ${sid} pid not recorded (${/** @type {any} */ (e).code || "error"})\n`); }
    journal({ session: s.id, phase: "start", sid, process: proc, driver });
    return { mode: ctx.mode, sid, session: s.id, process: proc, driver, command: meta.argv, state: "running" };
  }

  /** The last LOG_TAIL bytes of run.log, and how many came before them -- one descriptor, one size. @param {string} dir */
  function tail(dir) {
    let fd;
    try { fd = openSync(join(dir, "run.log"), "r"); } catch { return { raw: "", bytesDropped: 0 }; }
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
      // A cut mid-character: skip the continuation bytes the head landed in, and count them as dropped.
      let skip = 0;
      if (from > 0) while (skip < body.length && skip < 4 && (body[skip] & 0xc0) === 0x80) skip++;
      body = body.subarray(skip);
      return { raw: body.toString("utf8"), bytesDropped: from + skip };
    } finally { closeSync(fd); }
  }

  /** @param {string} sid */
  async function read(sid) {
    const dir = dirOf(sid);
    const rec = readJson(join(dir, "session.json"));
    if (!rec.value) throw new SessionError("RUN_UNREADABLE", "that session's record could not be read just now -- read again");
    const meta = rec.value;
    const { raw, bytesDropped } = tail(dir);
    const all = raw.split(/\r?\n/);
    if (all.length && all[all.length - 1] === "") all.pop();
    const lines = all.slice(-LINES_KEPT).map((l) => redactLine(String(scrub(l.length > LINE_CAP ? `${l.slice(0, LINE_CAP)} [line cut at ${LINE_CAP} characters]` : l, ctx.repo))));
    const st = stateOf(dir, meta);
    const receipts = await receiptsOf(all, meta.startedAt);
    return {
      mode: ctx.mode, sid, session: meta.session, room: meta.room, process: meta.process, driver: meta.driver, command: meta.argv,
      startedAt: meta.startedAt, ...st, lines, linesDropped: Math.max(0, all.length - LINES_KEPT), bytesDropped, receipts,
    };
  }

  /**
   * The receipts THIS run wrote: ids the run printed, of events the spine holds, minted no earlier than the run began.
   * Never the newest event of a kind -- another writer's event is new too.
   * @param {string[]} lines @param {number} startedAt
   */
  async function receiptsOf(lines, startedAt) {
    /** @type {Map<string, string | null>} id -> kind named beside it (null when bare) */
    const named = new Map();
    for (const l of lines) {
      const m = RECEIPT_LINE.exec(l);
      if (m) { named.set(m[2], m[1]); continue; }
      for (const u of l.matchAll(ULID_ANYWHERE)) if (!named.has(u[0])) named.set(u[0], null);
    }
    const ids = [...named.keys()].filter((id) => ULID_RE.test(id) && ulidTime(id) >= startedAt - 2000);
    if (!ids.length) return [];
    const { events } = await query(ctx.root, { engine: "scan" });
    const byId = new Map(events.map((e) => [e.event.id, e.event]));
    const out = [];
    for (const id of ids) {
      const ev = byId.get(id);
      if (!ev) continue;
      out.push({ id: ev.id, kind: ev.kind, ts: ev.ts, outcome: ev.outcome, process: ev.process, named: named.get(id) !== null, payload: redactDeep(scrubDeep(ev.payload, ctx.repo)) });
    }
    return out;
  }

  return { list, click, start, read, rows: SESSIONS };
}
