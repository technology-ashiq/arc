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
import { closeSync, mkdirSync, mkdtempSync, openSync, readFileSync, rmSync, statSync, unlinkSync, writeFileSync, writeSync } from "node:fs";
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
 * attack). Returns the id when the emitter printed one as its last line.
 * @param {string} arcEvent @param {string} kind @param {unknown} payload
 * @param {{ cwd?: string, env?: Record<string, string | undefined>, flags?: string[], dryRun?: boolean }} [o]
 * @returns {{ status: number | null, id: string, why: string, startFailed: boolean }}
 */
function emitThroughFile(arcEvent, kind, payload, o = {}) {
  let dir;
  try { dir = mkdtempSync(join(resolve(tmpdir()), "arc-spine-judge-")); }
  catch (e) { return { status: null, id: "", why: `no temp directory (${e && e.code ? e.code : "error"})`, startFailed: true }; }
  try {
    const file = join(dir, "payload.json");
    writeFileSync(file, JSON.stringify(payload), "utf8");
    const r = spawnSync(process.execPath, [arcEvent, "emit", kind, "--payload-file", file, ...(o.flags || []), "--strict", ...(o.dryRun ? ["--dry-run"] : [])],
      { cwd: o.cwd, env: o.env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    if (r.error) return { status: null, id: "", why: `the emitter did not start (${r.error.code || r.error.message})`, startFailed: true };
    const id = String(r.stdout || "").trim().split(/\r?\n/).pop() || "";
    return { status: r.status, id, why: String(r.stderr || "").trim().split(/\r?\n/).filter(Boolean)[0] || `the emitter exited ${r.status}`, startFailed: false };
  } finally {
    try { rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }); } catch { /* litter */ }
  }
}

/**
 * The REAL emit, through the same file path the judgment used: `{ id }` when a receipt id came back, else `{ id: null,
 * why }`. For the tools that raise an approval after writing a branch or a seal.
 * @param {string} arcEvent @param {string} kind @param {unknown} payload @param {{ cwd?: string, env?: Record<string, string | undefined>, flags?: string[] }} [o]
 */
export function emitReceipt(arcEvent, kind, payload, o = {}) {
  const r = emitThroughFile(arcEvent, kind, payload, o);
  if (r.status === 0 && /^[0-9A-HJKMNP-TV-Z]{26}$/.test(r.id)) return { id: r.id, why: null };
  return { id: null, why: r.startFailed ? r.why : r.status === 0 ? `the emitter printed no receipt id` : r.why };
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
 * @template T @param {string} dir @param {string} name @param {() => Promise<T> | T} fn @param {{ staleMs?: number }} [o]
 * @returns {Promise<{ busy: true } | { busy: false, value: T }>}
 */
export async function withExclusiveLock(dir, name, fn, { staleMs = 120_000 } = {}) {
  mkdirSync(dir, { recursive: true });
  const lock = join(dir, name);
  // A TOKEN in the file, and a release that removes only its own: a lock broken as stale while its holder lived was later
  // deleted by that holder -- the defect spine-io.withLock documents (PR 3b round-3 shell attack). EPERM and EACCES are
  // Windows' delete-pending, contention like EEXIST.
  const token = `${process.pid}:${randomBytes(8).toString("hex")}`;
  const take = () => {
    let fd;
    try { fd = openSync(lock, "wx"); }
    catch (e) { if (e && (e.code === "EEXIST" || e.code === "EPERM" || e.code === "EACCES" || e.code === "EISDIR")) return false; throw e; }
    try { writeSync(fd, token); } finally { closeSync(fd); }
    return true;
  };
  let ok = take();
  if (!ok) {
    let age = 0;
    try { age = Date.now() - statSync(lock).mtimeMs; } catch { /* released meanwhile */ }
    if (age > staleMs) { try { unlinkSync(lock); } catch { /* another breaker, or a directory */ } ok = take(); }
  }
  if (!ok) return { busy: true };
  try { return { busy: false, value: await fn() }; }
  finally { try { if (readFileSync(lock, "utf8") === token) unlinkSync(lock); } catch { /* released, or not ours */ } }
}
