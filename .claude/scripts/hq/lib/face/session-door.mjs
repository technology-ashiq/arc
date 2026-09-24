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
//   list()             the registry, and the sessions on disk, newest first.
//
// NO SESSION STATE IN THE DOOR. A session is its directory: session.json (written once, at start), run.log (the run's
// own output) and exit.json (written when the door that started it sees it end). A door restarted mid-run reads the same
// three files, so attach still shows the run, and a run the door never saw end says exactly that. The one thing held in
// memory is the unspent click tokens -- a restart forgets them, and a forgotten token can only refuse a start.

import { randomBytes } from "node:crypto";
import { spawn as nodeSpawn } from "node:child_process";
import { closeSync, existsSync, mkdirSync, openSync, readdirSync, readFileSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { join, sep } from "node:path";

import { query } from "../../spine.mjs";
import { validateInput } from "../../face-ops.mjs";
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
const ULID_RE = /^[0-7][0-9A-HJKMNP-TV-Z]{25}$/;
// arc-run names its own receipt on stderr, once: `arc-run: receipt run.completed <ULID>` (arc-run.mjs emitRun).
const RECEIPT_LINE = /^arc-run: receipt ([a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*)+) ([0-7][0-9A-HJKMNP-TV-Z]{25})\s*$/;
const ULID_ANYWHERE = /(?<![0-9A-Z])[0-7][0-9A-HJKMNP-TV-Z]{25}(?![0-9A-Z])/g;
const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** The HTTP status each session-door refusal carries. */
export const SESSION_STATUS = Object.freeze({
  UNKNOWN_SESSION: 404, UNKNOWN_RUN: 404,
  BAD_SESSION_BODY: 400, BAD_RUN_ID: 400, BAD_DRIVER: 400,
  CLICK_REQUIRED: 428,
  NO_PROCESS: 503,
  SIM_SPEND: 403,
  DRIVER_ONLY: 500, SPAWN_FAILED: 502, RUN_OUTSIDE: 403,
});

/** The ms a ULID was minted at. @param {string} id */
function ulidTime(id) {
  let t = 0;
  for (const c of id.slice(0, 10)) t = t * 32 + CROCKFORD.indexOf(c);
  return t;
}

/** A JSON file the door wrote, or null. @param {string} p */
function readJson(p) {
  try { return JSON.parse(readFileSync(p, "utf8")); } catch { return null; }
}

/** Is `pid` still a live process? A reused pid reads alive; exit.json, when the door saw the end, wins over this. */
function alive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; } catch (e) { return /** @type {any} */ (e).code === "EPERM"; }
}

/**
 * @param {{ mode: string, root: string, repo: string, journalDir: string }} ctx
 * @param {{ journal?: (entry: Record<string, unknown>) => void, now?: () => number, spawn?: typeof nodeSpawn, drivers?: readonly string[] }} [opts]
 */
export function createSessionDoor(ctx, opts = {}) {
  const journal = opts.journal || (() => {});
  const now = opts.now || Date.now;
  const spawn = opts.spawn || nodeSpawn;
  const drivers = opts.drivers || sessionDrivers();
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

  /** A session's directory, refused if it resolves off the door's own. @param {string} sid */
  function dirOf(sid) {
    if (typeof sid !== "string" || !SID_RE.test(sid)) throw new SessionError("BAD_RUN_ID", "a session is read by the id its start returned");
    const d = join(sessionsDir, sid);
    if (!existsSync(join(d, "session.json"))) throw new SessionError("UNKNOWN_RUN", "no session with that id is on this door's disk");
    // A junction planted where a session directory belongs would serve another tree's log under this door's name.
    const real = realpathSync(d);
    const base = realpathSync(sessionsDir);
    if (!real.startsWith(base + sep)) throw new SessionError("RUN_OUTSIDE", "that session's directory resolves outside this door's -- not read");
    return d;
  }

  function list() {
    let runs = [];
    try {
      runs = readdirSync(sessionsDir)
        .filter((n) => SID_RE.test(n))
        .map((n) => ({ sid: n, meta: readJson(join(sessionsDir, n, "session.json")) }))
        .filter((r) => r.meta && typeof r.meta.startedAt === "number")
        .sort((a, b) => b.meta.startedAt - a.meta.startedAt)
        .slice(0, RUNS_LISTED)
        .map((r) => ({ sid: r.sid, session: r.meta.session, process: r.meta.process, driver: r.meta.driver, startedAt: r.meta.startedAt, state: stateOf(join(sessionsDir, r.sid), r.meta).state }));
    } catch { /* no sessions directory yet: no runs */ }
    return { mode: ctx.mode, sessions: sessionsView(ctx.repo), drivers: ["auto", ...drivers], processes: processNames(ctx.repo), runs };
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
    const driver = b.driver === undefined ? "auto" : b.driver;
    if (typeof driver !== "string" || (driver !== "auto" && !drivers.includes(driver))) throw new SessionError("BAD_DRIVER", `driver must be auto or one of ${drivers.join(", ")}`);
    if (b.process !== undefined && !s.pickProcess) throw new SessionError("BAD_SESSION_BODY", `${s.id} runs its own process; only dispatch takes one`);
    const proc = s.pickProcess ? b.process : s.process;
    if (typeof proc !== "string" || !processFileOf(ctx.repo, proc))
      throw new SessionError("NO_PROCESS", s.pickProcess
        ? `dispatch takes a process on this tree (${processNames(ctx.repo).join(", ") || "none"})`
        : `${s.id} is NOT SHIPPABLE yet: processes/${s.process}.process.yaml is not on this tree -- the engine lane adds it (ADR-1339)`);
    // A sim door answers against a fixture spine: a session there runs on the mock driver or not at all.
    if (ctx.mode === "sim" && driver !== "mock") throw new SessionError("SIM_SPEND", `this door is in sim mode -- a session here runs on the mock driver, which spends nothing`);

    const sid = randomBytes(12).toString("base64url");
    const dir = join(sessionsDir, sid);
    mkdirSync(join(dir, "transcript"), { recursive: true });
    const cmd = sessionCommand(proc, driver, values, join(dir, "transcript"));
    // The check runs on the argv ABOUT to be spawned, not on the row: a bug in sessionCommand cannot reach a child.
    const refused = driverOnly(cmd, drivers);
    if (refused) throw new SessionError("DRIVER_ONLY", `${s.id}: ${refused} -- nothing started (ADR-1326)`);
    const arcRun = join(ctx.repo, ".claude", "scripts", ...cmd.script.split("/"));
    const real = realpathSync(arcRun);
    if (!real.startsWith(realpathSync(ctx.repo) + sep)) throw new SessionError("DRIVER_ONLY", `${cmd.script} resolves outside this tree -- nothing started`);

    const startedAt = now();
    const meta = { sid, session: s.id, room: s.room, process: proc, driver, startedAt, argv: ["node", `.claude/scripts/${cmd.script}`, ...cmd.args.map((a) => scrub(a, ctx.repo))], receipt: s.receipt, pid: null };
    writeFileSync(join(dir, "session.json"), JSON.stringify(meta));
    const fd = openSync(join(dir, "run.log"), "a");
    let child;
    try {
      // DETACHED, output to a file: the run outlives the door, and a restarted door reads it back from disk.
      child = spawn(process.execPath, [real, ...cmd.args], { cwd: ctx.repo, env: childEnv(), detached: true, windowsHide: true, stdio: ["ignore", fd, fd] });
    } catch (e) {
      closeSync(fd);
      writeFileSync(join(dir, "exit.json"), JSON.stringify({ exit: null, signal: "spawn-failed", endedAt: now() }));
      throw new SessionError("SPAWN_FAILED", `${s.id}: arc-run did not start (${scrub(e instanceof Error ? e.message : String(e), ctx.repo)})`);
    }
    closeSync(fd);
    meta.pid = child.pid ?? null;
    writeFileSync(join(dir, "session.json"), JSON.stringify(meta));
    child.on("error", (e) => { try { writeFileSync(join(dir, "exit.json"), JSON.stringify({ exit: null, signal: "spawn-failed", error: scrub(e.message, ctx.repo), endedAt: now() })); } catch { /* the directory went away */ } });
    child.on("exit", (code, signal) => {
      try { writeFileSync(join(dir, "exit.json"), JSON.stringify({ exit: code, signal, endedAt: now() })); } catch { /* the directory went away */ }
      journal({ session: s.id, phase: "end", sid, exit: code });
    });
    child.unref();
    journal({ session: s.id, phase: "start", sid, process: proc, driver });
    return { mode: ctx.mode, sid, session: s.id, process: proc, driver, command: meta.argv, state: "running" };
  }

  /** How a session stands, from its files alone. @param {string} dir @param {any} meta */
  function stateOf(dir, meta) {
    const ex = readJson(join(dir, "exit.json"));
    if (ex) return { state: "done", exit: ex.exit ?? null, signal: ex.signal ?? null };
    if (alive(meta.pid)) return { state: "running", exit: null, signal: null };
    return { state: "ended", exit: null, signal: null, note: "the door did not see this run end (it restarted, or the run was killed); the log and the spine are all there is" };
  }

  /** @param {string} sid */
  async function read(sid) {
    const dir = dirOf(sid);
    const meta = readJson(join(dir, "session.json"));
    if (!meta) throw new SessionError("UNKNOWN_RUN", "that session's record is unreadable");
    let raw = "", bytesDropped = 0;
    try {
      const size = statSync(join(dir, "run.log")).size;
      const buf = readFileSync(join(dir, "run.log"));
      bytesDropped = Math.max(0, size - LOG_TAIL);
      raw = buf.subarray(bytesDropped).toString("utf8");
    } catch { /* no output yet */ }
    const all = raw.split(/\r?\n/);
    if (all.length && all[all.length - 1] === "") all.pop();
    const lines = all.slice(-LINES_KEPT).map((l) => scrub(l.length > LINE_CAP ? `${l.slice(0, LINE_CAP)} [line cut at ${LINE_CAP} characters]` : l, ctx.repo));
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
      out.push({ id: ev.id, kind: ev.kind, ts: ev.ts, outcome: ev.outcome, process: ev.process, named: named.get(id) !== null, payload: scrubDeep(ev.payload, ctx.repo) });
    }
    return out;
  }

  return { list, click, start, read, rows: SESSIONS };
}
