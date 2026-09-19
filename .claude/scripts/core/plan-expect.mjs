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
    // Named by the real cause: an EMPTY ARC_SPINE_ROOT and "no repository here" shared one sentence (PR 3b round 6).
    if (code === "WORKTREE_SPINE") return "the spine would refuse this emit (WORKTREE_SPINE): a linked worktree has no spine of its own -- run it from the main clone";
    if ("ARC_SPINE_ROOT" in process.env && String(process.env.ARC_SPINE_ROOT).trim() === "") return "the spine would refuse this emit (NO_ROOT): ARC_SPINE_ROOT is set but empty -- unset it, or name a spine";
    return `the spine would refuse this emit (${code}): no spine can be resolved from here`;
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
 * EVERY TAKER CREATES ITS OWN FILE, THEN LOOKS AT EVERYONE ELSE'S. Each shape that broke a dead holder's lock, or reused
 * a name, raced: check-then-delete let a stale look delete a fresh lock (PR 3b round 4), a breaker file cleared by age
 * raced one level up (round 5), and numbered files swept empty were numbered again from zero, so a slow taker's old
 * number went to someone else beside a live holder (round 6). So:
 *   take     create `<name>.<16 hex>`, a name nobody else will ever use, with "wx"; then list every `<name>.<16 hex>`.
 *            ANY other file whose holder is live (or whose holder cannot be told -- an unreadable file is live, never
 *            "released") and this taker deletes its own file and is busy. Two takers in the same instant may both back
 *            off; neither holds wrongly, and the next click takes it.
 *   gone     on THIS machine, a holder is gone when its process has exited, or when its file is over an hour old -- a
 *            pid reused by another program, not a holder (a heartbeat cannot beat during a spawnSync, so nothing live
 *            waits that long); on another machine, when its file is older than `staleMs` or dated past it into the
 *            future. A live holder's file is kept fresh while `fn` awaits.
 *   release  delete this holder's own file. A gone holder's file is deleted by whoever finds it: its holder is not in
 *            the section, and its name is never used again.
 * A folder where a lock file belongs is refused by name.
 * @template T @param {string} dir @param {string} name @param {() => Promise<T> | T} fn @param {{ staleMs?: number }} [o]
 * @returns {Promise<{ busy: true } | { busy: false, value: T }>}
 */
export async function withExclusiveLock(dir, name, fn, { staleMs = 10 * 60_000 } = {}) {
  const held = acquire(dir, name, staleMs);
  if (!held) return { busy: true };
  const beat = setInterval(() => {
    try { const t = new Date(); utimesSync(held.lock, t, t); } catch { /* the release decides */ }
  }, Math.max(1000, Math.floor(staleMs / 4)));
  beat.unref();
  try { return { busy: false, value: await fn() }; }
  finally { clearInterval(beat); release(held); }
}

/**
 * The same lock for a synchronous `fn` (arc-bench's proposal store, whose main is synchronous). Nothing refreshes the
 * file while it runs, so on another machine `staleMs` must outlast the longest `fn`; on this one, its running process
 * is what keeps it held.
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
/** A holder on this machine is never live past this: past it, the pid is another program's. */
const SAME_HOST_MAX_MS = 60 * 60_000;

/**
 * A lock file's text: the text, "gone" when the file is not there, or "unreadable" when it is and cannot be read (a
 * scanner holding it open without sharing -- EBUSY, EPERM, EACCES on Windows), after a few tries. Unreadable is never
 * read as released: a live holder's lock was counted gone that way (PR 3b round-6 logic attack).
 * @param {string} path @returns {string | "gone" | "unreadable"}
 */
function readToken(path) {
  for (let i = 0; i < 4; i++) {
    try { return readFileSync(path, "utf8"); }
    catch (e) {
      if (e && e.code === "ENOENT") return "gone";
      if (i === 3) return "unreadable";
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 25);
    }
  }
  return "unreadable";
}

/** Whether a process with this pid is running here. EPERM is a process this user cannot signal: running. */
function pidRunning(pid) {
  try { process.kill(pid, 0); return true; } catch (e) { return !!e && e.code === "EPERM"; }
}

/** Every lock file of one lock in its folder: `<name>.<16 lowercase hex>`, nothing else. @param {string} dir @param {string} name */
function lockFiles(dir, name) {
  const prefix = `${name}.`;
  return readdirSync(dir).filter((e) => e.startsWith(prefix) && /^[0-9a-f]{16}$/.test(e.slice(prefix.length))).map((e) => join(dir, e));
}

/**
 * How one lock file stands: "live", "gone" (its holder is not in the section), or it throws for a folder.
 * @param {string} path @param {number} staleMs @returns {"live" | "gone"}
 */
function standing(path, staleMs) {
  const st = statOrNull(path);
  if (!st) return "gone";
  if (st.isDirectory()) throw new Error(`a folder sits where the lock ${basename(path)} belongs, so no run can ever hold it -- remove that folder`);
  const token = readToken(path);
  if (token === "gone") return "gone";
  if (token === "unreadable") return "live";
  const age = Date.now() - st.mtimeMs;
  const [host, pid] = token.split("|");
  // THIS machine: live exactly while its process runs, up to an hour (past that the pid is someone else's).
  if (host === HOST && /^[1-9][0-9]{0,9}$/.test(pid || "")) return pidRunning(Number(pid)) && age <= SAME_HOST_MAX_MS && age >= -SAME_HOST_MAX_MS ? "live" : "gone";
  // Another machine, or a token that names none: by age alone.
  return age > staleMs || age < -staleMs ? "gone" : "live";
}

/**
 * Take the lock: `{ lock, token }`, or null when a live holder has it (or might).
 * @param {string} dir @param {string} name @param {number} staleMs
 */
function acquire(dir, name, staleMs) {
  // Named by the lock, never by the folder's absolute path: the door withholds a refusal from the first such path on,
  // and "mkdir 'C:\Users\...\locks'" hid the cause (PR 3b round-4 shell attack).
  try { mkdirSync(dir, { recursive: true }); }
  catch (e) { throw new Error(`the folder for the lock ${name} could not be made (${e && e.code ? e.code : "error"}) -- a file may sit where the locks folder belongs`); }
  const token = `${HOST}|${process.pid}|${randomBytes(8).toString("hex")}`;
  const lock = join(dir, `${name}.${randomBytes(8).toString("hex")}`);
  let fd;
  try { fd = openSync(lock, "wx"); }
  catch (e) { throw new Error(`the lock ${name} could not be created (${e && e.code ? e.code : "error"})`); }
  try { writeSync(fd, token); } finally { closeSync(fd); }
  const backOff = () => { try { unlinkSync(lock); } catch { /* gone already */ } return null; };
  let others;
  try { others = lockFiles(dir, name).filter((p) => p !== lock); }
  // A folder that cannot be listed says nothing about who holds it: busy, never "free" (PR 3b round-6 logic attack).
  catch { return backOff(); }
  for (const p of others) {
    let s;
    try { s = standing(p, staleMs); }
    catch (e) { backOff(); throw e; }
    if (s === "live") return backOff();
    // A gone holder's file: deleted, and its name is never used again (the names are random).
    try { unlinkSync(p); } catch { /* another taker's cleanup */ }
  }
  // Our own file is still ours: nothing deletes a live holder's file, so a mismatch is the filesystem, and it is busy.
  if (readToken(lock) !== token) return backOff();
  return { lock, token };
}

/** Remove this holder's own file. @param {{ lock: string, token: string }} held */
function release(held) {
  try { if (readToken(held.lock) === held.token) unlinkSync(held.lock); } catch { /* released */ }
}
