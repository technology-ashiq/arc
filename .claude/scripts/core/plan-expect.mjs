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
import { closeSync, mkdirSync, mkdtempSync, openSync, readFileSync, rmSync, statSync, unlinkSync, utimesSync, writeFileSync, writeSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

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
  return r.status === 0 ? null : r.why;
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
 * One holder at a time: an exclusive lock FILE (flag "wx") in `dir`, released when `fn` settles, and broken only when
 * older than `staleMs` (a killed holder's). It REFUSES rather than waits -- `{ busy: true }` -- so a second click is
 * told another run holds it. For a check-then-emit that must not run twice at once: three picks, and two profile
 * requests, raised from one plan in the same instant all landed (PR 4 logic attack; the PR 3a evolve row, re-found).
 *
 * Breaking a stale lock is where two holders came from (PR 3b round-4 shell attack: 2 holders in 3 of 6 rounds behind a
 * killed holder's lock). Check-age-unlink-take is three steps: a breaker whose look was older than another's take
 * deleted that FRESH lock and took its own. So breakers go one at a time through `<name>.break`, and the one that holds
 * it deletes the lock only if it is still the very file it judged stale -- the same token, the same mtime. The take is
 * re-read before `fn` runs, and a live holder's lock is kept fresh while `fn` awaits, so a slow holder is not "stale".
 * A lock dated past `staleMs` into the future is no live holder's either: a skewed clock wedged it for a day.
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
 * The same lock for a synchronous `fn` (arc-bench's proposal store, whose main is synchronous): one acquire, one
 * release, and no second hand-rolled copy -- bench's own copy carried the stale-break race too (PR 3b round-4 shell
 * attack). Nothing runs between the take and the release to refresh it, so `staleMs` must outlast the longest `fn`.
 * @template T @param {string} dir @param {string} name @param {() => T} fn @param {{ staleMs?: number }} [o]
 * @returns {{ busy: true } | { busy: false, value: T }}
 */
export function withExclusiveLockSync(dir, name, fn, { staleMs = 10 * 60_000 } = {}) {
  const held = acquire(dir, name, staleMs);
  if (!held) return { busy: true };
  try { return { busy: false, value: fn() }; }
  finally { release(held); }
}

const readOrNull = (path) => { try { return readFileSync(path, "utf8"); } catch { return null; } };
const statOrNull = (path) => { try { return statSync(path); } catch { return null; } };
const contended = (e) => !!e && (e.code === "EEXIST" || e.code === "EPERM" || e.code === "EACCES" || e.code === "EISDIR");

/** Create `path` holding `text`, or false when another holds it. */
function createWith(path, text) {
  let fd;
  try { fd = openSync(path, "wx"); }
  catch (e) { if (contended(e)) return false; throw e; }
  try { writeSync(fd, text); } finally { closeSync(fd); }
  return true;
}

/**
 * Take the lock: `{ lock, token }`, or null when a live holder has it.
 * @param {string} dir @param {string} name @param {number} staleMs
 */
function acquire(dir, name, staleMs) {
  // Named by the lock, never by the folder's absolute path: the door withholds a refusal from the first such path on,
  // and "mkdir 'C:\Users\...\locks'" hid the cause (PR 3b round-4 shell attack).
  try { mkdirSync(dir, { recursive: true }); }
  catch (e) { throw new Error(`the folder for the lock ${name} could not be made (${e && e.code ? e.code : "error"}) -- a file may sit where the locks folder belongs`); }
  const lock = join(dir, name);
  const breaker = join(dir, `${name}.break`);
  // A TOKEN in the file, and a release that removes only its own: a lock broken as stale while its holder lived was later
  // deleted by that holder -- the defect spine-io.withLock documents (PR 3b round-3 shell attack). EPERM and EACCES are
  // Windows' delete-pending, contention like EEXIST.
  const token = `${process.pid}:${randomBytes(8).toString("hex")}`;
  const isStale = (st) => { const age = Date.now() - st.mtimeMs; return age > staleMs || age < -staleMs; };
  let ok = createWith(lock, token);
  if (!ok) {
    const seen = statOrNull(lock);
    if (seen && seen.isDirectory())
      throw new Error(`a folder sits where the lock ${name} belongs, so no run can ever hold it -- remove that folder`);
    if (seen && isStale(seen)) {
      const seenToken = readOrNull(lock);
      // A breaker that died holding `.break` would stop every later break: its file lives for microseconds, and one
      // older than a minute is litter.
      const b = statOrNull(breaker);
      if (b && Date.now() - b.mtimeMs > 60_000) { try { unlinkSync(breaker); } catch { /* another cleaner */ } }
      if (createWith(breaker, token)) {
        try {
          const now = statOrNull(lock);
          if (now && now.isFile() && now.mtimeMs === seen.mtimeMs && isStale(now) && readOrNull(lock) === seenToken) {
            try { unlinkSync(lock); } catch { /* released meanwhile */ }
          }
        } finally { if (readOrNull(breaker) === token) { try { unlinkSync(breaker); } catch { /* litter */ } } }
        ok = createWith(lock, token);
      }
    }
  }
  // Re-read: a breaker whose judgment predates this take must not leave two holders (the spine lock's LOCK_LOST rule).
  if (!ok || readOrNull(lock) !== token) return null;
  return { lock, token };
}

/** Remove the lock only when it is still this holder's. @param {{ lock: string, token: string }} held */
function release(held) {
  try { if (readFileSync(held.lock, "utf8") === held.token) unlinkSync(held.lock); } catch { /* released, or not ours */ }
}
