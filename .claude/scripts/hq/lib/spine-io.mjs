// Spine storage: paths, the write lock, atomic append, quarantine, the idem index, and
// day-close markers.
//
// ADR-0025: everything here lives in the INSTANCE at .claude/state/hq/ and never enters the
// sync payload -- `state` is already excluded by sync-to-project.sh, which is the real gate.
// ADR-0029: the active day is append-only; a closed day is immutable forever.

import {
  closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync,
  readdirSync, statSync, unlinkSync, writeFileSync, writeSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { createHash } from "node:crypto";
import { SpineError, canonicalize, formatIst, nowMs } from "./canonical.mjs";

const LOCK_TIMEOUT_MS = Number(process.env.ARC_SPINE_LOCK_TIMEOUT_MS || 3000);
const LOCK_STALE_MS = Number(process.env.ARC_SPINE_LOCK_STALE_MS || 15000);

// ARC_SPINE_ROOT is how tests (and a consumer with a non-standard layout) point the spine
// somewhere else. Otherwise: the nearest .claude/ at or above cwd owns the spine.
export function spineRoot() {
  if (process.env.ARC_SPINE_ROOT) return resolve(process.env.ARC_SPINE_ROOT);
  let dir = process.cwd();
  for (;;) {
    if (existsSync(join(dir, ".claude"))) return join(dir, ".claude", "state", "hq");
    const up = dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  throw new SpineError("NO_ROOT", "no .claude/ directory found at or above cwd -- cannot locate the spine");
}

export const eventsDir = (root) => join(root, "events");
export const quarantineDir = (root) => join(root, "events", "_quarantine");
export const derivedDir = (root) => join(root, "derived");
export const dayFile = (root, day) => join(eventsDir(root), `${day}.jsonl`);
export const closedMarker = (root, day) => join(eventsDir(root), `${day}.closed`);
export const idemIndexPath = (root) => join(derivedDir(root), "idem.index");

const ensureDir = (d) => mkdirSync(d, { recursive: true });

// Node has no sleep; Atomics.wait on a throwaway buffer is the portable synchronous one.
function sleepSync(ms) {
  const sab = new Int32Array(new SharedArrayBuffer(4));
  Atomics.wait(sab, 0, 0, ms);
}

/**
 * Serializes every mutation of a day file and the idem index behind one lock file.
 * Belt and braces with the single-write append below: the lock keeps two emitters from
 * interleaving their read-modify-write of the index, the single write keeps the JSONL line
 * whole even if the lock were somehow bypassed.
 */
export function withLock(root, fn) {
  const dir = eventsDir(root);
  ensureDir(dir);
  const lock = join(dir, ".lock");
  const deadline = Date.now() + LOCK_TIMEOUT_MS;
  let fd = null;

  for (;;) {
    try {
      fd = openSync(lock, "wx"); // atomic create-or-fail
      break;
    } catch (e) {
      if (e.code !== "EEXIST") throw new SpineError("LOCK_FAILED", `cannot take the spine lock: ${e.code || e.message}`);
      // A killed emitter leaves its lock behind. Break it once it is provably stale, or the
      // next session inherits a wedged spine (the crash window is exactly when telemetry
      // must not block a human).
      try {
        if (Date.now() - statSync(lock).mtimeMs > LOCK_STALE_MS) { unlinkSync(lock); continue; }
      } catch { /* the holder released it between our check and now -- retry */ }
      if (Date.now() > deadline)
        throw new SpineError("LOCK_TIMEOUT", `spine lock held for more than ${LOCK_TIMEOUT_MS}ms`);
      sleepSync(15);
    }
  }

  try {
    try { writeSync(fd, Buffer.from(`${process.pid}\n`, "utf8")); } catch { /* advisory only */ }
    return fn();
  } finally {
    try { closeSync(fd); } catch { /* already closed */ }
    try { unlinkSync(lock); } catch { /* already gone */ }
  }
}

// One line, one write, then fsync: the whole line reaches the page cache in a single call,
// so a kill between events can never leave half a line behind.
function appendLine(file, line) {
  ensureDir(dirname(file));
  const fd = openSync(file, "a");
  try {
    writeSync(fd, Buffer.from(line, "utf8"));
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}

export function isDayClosed(root, day) {
  return existsSync(closedMarker(root, day));
}

// The index is DERIVED, never truth: arc-replay rebuilds it whole from the spine (ckpt B).
// A missing index on a fresh instance is an empty set, not an error.
export function readIdemIndex(root) {
  const path = idemIndexPath(root);
  const map = new Map();
  if (!existsSync(path)) return map;
  let text;
  try {
    text = readFileSync(path, "utf8");
  } catch (e) {
    throw new SpineError("INDEX_UNREADABLE", `idem index unreadable: ${e.code || e.message}`);
  }
  for (const line of text.split("\n")) {
    if (!line) continue;
    const tab = line.indexOf("\t");
    if (tab === -1) continue; // a torn index line is a rebuild problem, never a reason to block
    map.set(line.slice(0, tab), line.slice(tab + 1));
  }
  return map;
}

export function fileSha(path) {
  if (!existsSync(path)) return null;
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

/**
 * Append one validated event. Caller supplies the canonical line (sha included).
 * Throws DUP_IDEM / DAY_CLOSED -- both are refusals, not crashes.
 */
export function appendEvent(root, event, canonicalLine) {
  return withLock(root, () => appendEventUnlocked(root, event, canonicalLine));
}

/** The same append, for a caller that ALREADY holds the lock (day-close). */
export function appendEventUnlocked(root, event, canonicalLine) {
  const day = event.ts.slice(0, 10);
  if (isDayClosed(root, day))
    throw new SpineError("DAY_CLOSED", `${day} is closed -- corrections go on a new day via supersedes (ADR-0029)`);

  const index = readIdemIndex(root);
  const existing = index.get(event.idem);
  if (existing)
    throw new SpineError("DUP_IDEM", `idem already on the spine as ${existing} -- this event is a duplicate`);

  // This order is deliberate. A crash between the two appends leaves an event on the spine
  // with no index entry, so a later redelivery could be accepted twice -- recoverable,
  // because truth is the JSONL and replay rebuilds the index from it. The reverse order
  // would leave an index entry with no event, and a legitimate retry would be refused as a
  // duplicate forever: a silently LOST receipt. Prefer a duplicate you can supersede.
  appendLine(dayFile(root, day), canonicalLine + "\n");
  ensureDir(derivedDir(root));
  appendLine(idemIndexPath(root), `${event.idem}\t${event.id}\n`);
  return { day, file: dayFile(root, day) };
}

/**
 * Quarantine an input that must not reach the spine.
 * `stubOnly` is the secret path (ADR-0028): the record proves THAT something was refused
 * and why, and carries no field names, no values, and no lengths.
 */
export function quarantine(root, { code, message, day, raw, stubOnly }) {
  const dir = quarantineDir(root);
  ensureDir(dir);
  const record = {
    code,
    day,
    reason: stubOnly ? "refused: secret pattern (stub-only record, ADR-0028)" : String(message || "").slice(0, 1000),
    stub_only: !!stubOnly,
    ts: formatIst(nowMs()),
  };
  if (!stubOnly && raw !== undefined) record.raw = String(raw).slice(0, 4096);
  appendLine(join(dir, `${day}.jsonl`), canonicalize(record) + "\n");
}

/**
 * Close a day: pin its bytes forever. The day.closed event records the sha of the file as
 * it stood, then the marker pins the final bytes including that event.
 */
export function writeCloseMarker(root, day, sha) {
  writeFileSync(closedMarker(root, day), `${sha}\n`, "utf8");
}

export function listDays(root) {
  const dir = eventsDir(root);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((n) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(n))
    .map((n) => n.slice(0, 10))
    .sort();
}
