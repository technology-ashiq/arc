// plan-expect.mjs -- an apply is bound to what its plan showed (face v2 Phase 05, ADR-1340 as amended by PR 3a).
//
// A plan is read, then applied up to fifteen minutes later. Between the two, the spine or main can move, and an apply
// that re-derived its write from the world as it then stood wrote something the owner never saw. The PR 3a logic
// attack found this in two places: a driver switch planned against one router and written against another, and an
// experiment opened past its concurrency cap because the cap was counted only at plan time.
//
// So a tool whose apply re-derives what it writes prints, as the LAST line of its plan, the digest of exactly what the
// apply would write:  {"expect":"<64 hex>"}. The door carries that digest into the apply as `--expect <digest>`. The
// apply re-derives everything, re-runs every check, and writes only if the digest is unchanged. Otherwise it refuses
// PLAN_STALE and writes nothing. A hand-run works the same way: the plan prints the flag to add.

import { spawnSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { closeSync, mkdirSync, mkdtempSync, openSync, readFileSync, readdirSync, rmSync, statSync, unlinkSync, utimesSync, writeFileSync, writeSync } from "node:fs";
import { hostname, tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { spineRoot } from "../hq/lib/spine-io.mjs";

export const EXPECT_RE = /^[0-9a-f]{64}$/;

/**
 * The spine's own judgment of a receipt BEFORE the effect it describes: null when `arc-event emit --dry-run` accepts
 * it, else the emitter's first line. A tool that writes a branch and only then has its approval refused has stranded
 * the branch -- every face-ask proposal did, because the secret scanner read "sk-" in its name (PR 3a logic attack).
 * One helper, so every branch-writing tool judges the same way. `flags` are the envelope flags the real emit passes
 * (bench emits with --process): the adjacency views join every caller field, so the judgment passes the same ones.
 * @param {string} arcEvent the arc-event.mjs path @param {string} kind @param {unknown} payload
 * @param {{ cwd?: string, env?: Record<string, string | undefined>, flags?: string[] }} [o]
 */
export function spineRefusal(arcEvent, kind, payload, o = {}) {
  // Through a FILE, as bench's real emit does: a payload on the command line past the OS's argv ceiling failed to spawn
  // and was reported as "the emitter exited null" -- a refusal under the wrong cause (PR 3b round-2 shell attack).
  const r = emitThroughFile(arcEvent, kind, payload, { ...o, dryRun: true });
  if (r.startFailed) return `the spine could not be asked: ${r.why}`;
  if (r.status !== 0) return r.why;
  // WHERE the real emit would write, asked too: a dry run never resolves the spine (by design -- its verdict must not
  // depend on which spine), so from a linked worktree or a folder with no repository the plan passed and the apply
  // wrote its branch before the emit refused WORKTREE_SPINE (PR 3b round-5 logic attack).
  return spineWhere(o.cwd);
}

/**
 * Null when an emit run in `cwd` would find a spine, else why not -- by the emitter's own resolver, named by its code:
 * the resolver's message carries absolute paths, which the door withholds along with everything after them.
 * @param {string | undefined} cwd
 */
function spineWhere(cwd) {
  const before = process.cwd();
  try {
    if (cwd) process.chdir(cwd);
    spineRoot();
    return null;
  } catch (e) {
    const code = e && e.code ? e.code : "error";
    return code === "WORKTREE_SPINE" ? "the spine would refuse this emit (WORKTREE_SPINE): a linked worktree has no spine of its own -- run it from the main clone"
      : `the spine would refuse this emit (${code}): no spine can be resolved from here`;
  } finally {
    try { process.chdir(before); } catch { /* the caller's cwd is gone; nothing to restore */ }
  }
}

/**
 * One emit of `kind` with `payload` read from a temp FILE -- a payload on the command line past Windows' 32,767-char
 * ceiling (escaped quotes count) failed to spawn after the seal and the branch were written (PR 3b round-3 shell attack)
 * -- and the temp path RESOLVED, since the emitter runs in `cwd` and a relative TMP named a file it could not find (same
 * attack). Returns the id when the emitter printed one as its last line, and HOW it ended:
 *   landed   exit 0 -- arc-event's own contract for "appended", whether or not its id line survived the pipe
 *   refused  it never started, or exit 2 naming a refusal that stops BEFORE the append (a bad field, a duplicate, a lock)
 *   unknown  anything else: REJECT INTERNAL (a disk fault can land after the line is written), a signal, a timeout
 * Unknown is never read as "not raised": the same plan raised the question twice when it was (PR 3b round-4 attacks).
 * @param {string} arcEvent @param {string} kind @param {unknown} payload
 * @param {{ cwd?: string, env?: Record<string, string | undefined>, flags?: string[], dryRun?: boolean, timeoutMs?: number }} [o]
 * @returns {{ status: number | null, id: string, why: string, startFailed: boolean, state: "landed" | "refused" | "unknown" }}
 */
function emitThroughFile(arcEvent, kind, payload, o = {}) {
  let dir;
  try { dir = mkdtempSync(join(resolve(tmpdir()), "arc-spine-judge-")); }
  catch (e) { return { status: null, id: "", why: `no temp directory (${e && e.code ? e.code : "error"})`, startFailed: true, state: "refused" }; }
  try {
    const file = join(dir, "payload.json");
    writeFileSync(file, JSON.stringify(payload), "utf8");
    const r = spawnSync(process.execPath, [arcEvent, "emit", kind, "--payload-file", file, ...(o.flags || []), "--strict", ...(o.dryRun ? ["--dry-run"] : [])],
      { cwd: o.cwd, env: o.env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...(o.timeoutMs ? { timeout: o.timeoutMs, killSignal: "SIGKILL" } : {}) });
    // A timeout is an emitter that STARTED and was killed: it may have appended first.
    if (r.error && r.error.code === "ETIMEDOUT")
      return { status: null, id: "", why: `the emitter did not answer within ${o.timeoutMs} ms and was stopped`, startFailed: false, state: "unknown" };
    // Any other error with a pid is an emitter that STARTED (a stderr past the buffer, ENOBUFS): unknown, never refused.
    if (r.error && r.pid) return { status: r.status, id: "", why: `the emitter started and then failed (${r.error.code || r.error.message})`, startFailed: false, state: "unknown" };
    if (r.error) return { status: null, id: "", why: `the emitter did not start (${r.error.code || r.error.message})`, startFailed: true, state: "refused" };
    const id = String(r.stdout || "").trim().split(/\r?\n/).pop() || "";
    const lines = String(r.stderr || "").trim().split(/\r?\n/).filter(Boolean);
    const reject = lines.map((l) => /^arc-event: REJECT ([A-Z_]+) --/.exec(l)).find(Boolean);
    const why = (reject ? reject.input : lines[0]) || `the emitter exited ${r.status}`;
    const state = r.status === 0 ? "landed" : r.status === 2 && reject && reject[1] !== "INTERNAL" ? "refused" : "unknown";
    return { status: r.status, id, why, startFailed: false, state };
  } finally {
    try { rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }); } catch { /* litter */ }
  }
}

/**
 * The REAL emit, through the same file path the judgment used. `state` is the emit's (above); `id` is set when the
 * receipt id came back, and a landed emit whose id line was lost says so in `why`. For the tools that raise an approval
 * after writing a branch or a seal.
 * @param {string} arcEvent @param {string} kind @param {unknown} payload
 * @param {{ cwd?: string, env?: Record<string, string | undefined>, flags?: string[], timeoutMs?: number }} [o]
 * @returns {{ state: "landed" | "refused" | "unknown", id: string | null, why: string | null }}
 */
export function emitReceipt(arcEvent, kind, payload, o = {}) {
  const r = emitThroughFile(arcEvent, kind, payload, o);
  if (r.state !== "landed") return { state: r.state, id: null, why: r.why };
  return /^[0-9A-HJKMNP-TV-Z]{26}$/.test(r.id) ? { state: "landed", id: r.id, why: null } : { state: "landed", id: null, why: "it was appended (the emitter exited 0) and its id line was lost -- it is in your inbox" };
}

/** JSON with every object's keys sorted, so a digest never depends on the order a payload was built in. */
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`).join(",")}}`;
  }
  const s = JSON.stringify(value);
  if (s === undefined) throw new TypeError("plan-expect: a digest covers JSON values only");
  return s;
}

/** The digest of what an apply would write. @param {unknown} value */
export function planDigest(value) {
  return createHash("sha256").update(canonical(value)).digest("hex");
}

/** The plan's last line. @param {string} digest */
export function expectLine(digest) {
  return JSON.stringify({ expect: digest });
}

/**
 * Why an apply may not write, or null when it may.
 * @param {string} given the --expect the apply was handed @param {string} digest what it would write now
 */
export function staleReason(given, digest) {
  if (!EXPECT_RE.test(String(given))) return "--expect is the 64-hex digest a plan printed as its last line";
  if (given !== digest) return "PLAN_STALE -- what this run would write is not what the plan showed (the spine, main or the surface moved since). Nothing was written; plan again and read the new plan";
  return null;
}


/**
 * One holder at a time, refusing rather than waiting -- `{ busy: true }` -- so a second click is told another run holds
 * it. For a check-then-emit that must not run twice at once: three picks, and two profile requests, raised from one plan
 * in the same instant all landed (PR 4 logic attack; the PR 3a evolve row, re-found).
 *
 * NO PROCESS EVER DELETES ANOTHER'S LOCK. Every earlier shape broke a dead holder's lock by check-then-delete, and each
 * was a race: a breaker whose look predated another's take deleted that FRESH lock (PR 3b round 4: two holders in 3 of
 * 6 rounds), and the breaker file that serialised breakers was itself cleared by age, the same race one level up (PR 3b
 * round 5). So the lock is a NUMBERED file, `<name>.<n>`, and the holder of the highest number holds it:
 *   take     read the highest; if its holder is live, busy. If it is gone, create the NEXT number with "wx" -- exactly one
 *            caller can -- and never touch the old file. Then look again: a higher number means a caller on an older
 *            listing lost the race, and backs off before `fn` runs.
 *   gone     a holder on THIS machine is gone when its process is (the token names the host and the pid) -- however
 *            long it has held: a heartbeat cannot beat during a spawnSync, and a live seal past `staleMs` was broken
 *            into (PR 3b round-5 shell attack). Another machine's holder is gone when its file is older than
 *            `staleMs`, or dated past it into the future; its file is kept fresh while `fn` awaits.
 *   release  delete only this holder's own file, and the lower numbers it superseded (their holders are gone).
 * A file dated more than `staleMs` into the future is no live holder's either, and a folder at the highest number is
 * refused by name.
 * @template T @param {string} dir @param {string} name @param {() => Promise<T> | T} fn @param {{ staleMs?: number }} [o]
 * @returns {Promise<{ busy: true } | { busy: false, value: T }>}
 */
export async function withExclusiveLock(dir, name, fn, { staleMs = 10 * 60_000 } = {}) {
  const held = acquire(dir, name, staleMs);
  if (!held) return { busy: true };
  const beat = setInterval(() => {
    try { if (readOrNull(held.lock) === held.token) { const t = new Date(); utimesSync(held.lock, t, t); } } catch { /* the release decides */ }
  }, Math.max(1000, Math.floor(staleMs / 4)));
  beat.unref();
  try { return { busy: false, value: await fn() }; }
  finally { clearInterval(beat); release(held); }
}

/**
 * The same lock for a synchronous `fn` (arc-bench's proposal store, whose main is synchronous). Nothing refreshes the
 * file while it runs, so `staleMs` must outlast the longest `fn` -- or its holder's process must still be running.
 * @template T @param {string} dir @param {string} name @param {() => T} fn @param {{ staleMs?: number }} [o]
 * @returns {{ busy: true } | { busy: false, value: T }}
 */
export function withExclusiveLockSync(dir, name, fn, { staleMs = 10 * 60_000 } = {}) {
  const held = acquire(dir, name, staleMs);
  if (!held) return { busy: true };
  try { return { busy: false, value: fn() }; }
  finally { release(held); }
}

const statOrNull = (path) => { try { return statSync(path); } catch { return null; } };
const HOST = hostname();

/**
 * A lock file's text, or null when it is gone. A file another process holds open without sharing (EBUSY, EPERM,
 * EACCES on Windows) is read again before it is given up on: one such read left a lock nobody owned at release (PR 3b
 * round-5 shell attack).
 * @param {string} path
 */
function readOrNull(path) {
  for (let i = 0; i < 4; i++) {
    try { return readFileSync(path, "utf8"); }
    catch (e) {
      if (!e || !["EBUSY", "EPERM", "EACCES"].includes(e.code) || i === 3) return null;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 25);
    }
  }
  return null;
}

/** Whether a process with this pid is running here. EPERM is a process this user cannot signal: running. */
function pidRunning(pid) {
  try { process.kill(pid, 0); return true; } catch (e) { return !!e && e.code === "EPERM"; }
}

/**
 * The generations of one lock in its folder, highest first: `[{ n, path }]`. A name that only looks like one (a leading
 * zero, a sign, past the safe integers) is not one.
 * @param {string} dir @param {string} name
 */
function generations(dir, name) {
  const prefix = `${name}.`;
  /** @type {{ n: number, path: string }[]} */
  const out = [];
  for (const entry of readdirSync(dir)) {
    if (!entry.startsWith(prefix)) continue;
    const tail = entry.slice(prefix.length);
    if (!/^(0|[1-9][0-9]{0,14})$/.test(tail)) continue;
    out.push({ n: Number(tail), path: join(dir, entry) });
  }
  return out.sort((a, b) => b.n - a.n);
}

/** Create `path` holding `text`, or false when it exists (or is being deleted -- Windows' EPERM, EACCES). */
function createWith(path, text) {
  let fd;
  try { fd = openSync(path, "wx"); }
  catch (e) { if (e && (e.code === "EEXIST" || e.code === "EPERM" || e.code === "EACCES" || e.code === "EISDIR")) return false; throw e; }
  try { writeSync(fd, text); } finally { closeSync(fd); }
  return true;
}

/**
 * Whether the holder of one generation is live. A file that cannot be read was released (Windows keeps a deleted file
 * listed until its last handle closes) -- the holder closed it after writing its token, so nothing live holds it open.
 * @param {{ path: string }} g @param {number} staleMs
 */
function holderLive(g, staleMs) {
  const st = statOrNull(g.path);
  if (!st) return false;
  if (st.isDirectory()) throw new Error(`a folder sits where the lock ${basename(g.path)} belongs, so no run can ever hold it -- remove that folder`);
  const token = readOrNull(g.path);
  if (token === null) return false;
  const [host, pid] = token.split("|");
  // A holder on THIS machine is live exactly while its process runs; another machine's is judged by age alone.
  if (host === HOST && /^[1-9][0-9]{0,9}$/.test(pid || "")) return pidRunning(Number(pid));
  const age = Date.now() - st.mtimeMs;
  return !(age > staleMs || age < -staleMs);
}

/**
 * Take the lock: `{ lock, token, n }`, or null when a live holder has it.
 * @param {string} dir @param {string} name @param {number} staleMs
 */
function acquire(dir, name, staleMs) {
  // Named by the lock, never by the folder's absolute path: the door withholds a refusal from the first such path on,
  // and "mkdir 'C:\Users\...\locks'" hid the cause (PR 3b round-4 shell attack).
  try { mkdirSync(dir, { recursive: true }); }
  catch (e) { throw new Error(`the folder for the lock ${name} could not be made (${e && e.code ? e.code : "error"}) -- a file may sit where the locks folder belongs`); }
  const token = `${HOST}|${process.pid}|${randomBytes(8).toString("hex")}`;
  let listed;
  try { listed = generations(dir, name); }
  catch (e) { throw new Error(`the folder for the lock ${name} could not be read (${e && e.code ? e.code : "error"})`); }
  const top = listed[0];
  if (top && holderLive(top, staleMs)) return null;
  const n = top ? top.n + 1 : 0;
  if (!Number.isSafeInteger(n)) throw new Error(`the lock ${name} has run out of numbers -- remove its files`);
  const lock = join(dir, `${name}.${n}`);
  let made;
  try { made = createWith(lock, token); }
  catch (e) { throw new Error(`the lock ${name} could not be created (${e && e.code ? e.code : "error"})`); }
  if (!made) return null;
  // Look again: a caller on an older listing may have created a number above this one's predecessor too late to see
  // it -- the lower number backs off, before `fn` runs, and the file is re-read so this take is the one on disk.
  let again = [];
  try { again = generations(dir, name); } catch { /* the re-read below decides */ }
  if ((again[0] && again[0].n > n) || readOrNull(lock) !== token) {
    if (readOrNull(lock) === token) { try { unlinkSync(lock); } catch { /* released by the next taker's sweep */ } }
    return null;
  }
  return { lock, token, n, dir, name };
}

/**
 * Remove this holder's own file, and the lower numbers it superseded: their holders were judged gone before this one
 * was taken, so nothing live holds them.
 * @param {{ lock: string, token: string, n: number, dir: string, name: string }} held
 */
function release(held) {
  try { if (readOrNull(held.lock) === held.token) unlinkSync(held.lock); } catch { /* released, or not ours */ }
  let lower = [];
  try { lower = generations(held.dir, held.name).filter((g) => g.n < held.n); } catch { return; }
  for (const g of lower) { try { if (statOrNull(g.path)?.isFile()) unlinkSync(g.path); } catch { /* another sweeper */ } }
}
