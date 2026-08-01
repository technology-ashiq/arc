// Spine storage: paths, the write lock, atomic append, quarantine, the idem index, and
// day-close markers.
//
// ADR-0025: everything here lives in the INSTANCE at .claude/state/hq/ and never enters the
// sync payload -- `state` is already excluded by sync-to-project.sh, which is the real gate.
// ADR-0029: the active day is append-only; a closed day is immutable forever.
//
// The locking and append rules below are the output of the Phase-0 adversarial pass, which
// confirmed that the first version could hand the same lock to three processes, silently
// destroy the next event after a torn tail, and report SKIP for an event it had already
// written (docs/evidence/phase-00/adversarial-report.md).

import {
  closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync,
  readSync, readdirSync, renameSync, statSync, unlinkSync, writeFileSync, writeSync,
} from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { createHash, randomBytes } from "node:crypto";
import { SpineError, canonicalize, formatIst, nowMs } from "./canonical.mjs";

// The critical section is a few file appends -- single-digit milliseconds. A stale
// threshold three orders of magnitude above that is already absurdly generous, and keeping
// it SHORT is what bounds how long a crashed emitter can wedge the next session.
const LOCK_STALE_MS = Number(process.env.ARC_SPINE_LOCK_STALE_MS || 5000);
// Strict callers (CI, ingest) can afford to wait; a hook must never hold a session up.
const DEFAULT_TIMEOUT_MS = Number(process.env.ARC_SPINE_LOCK_TIMEOUT_MS || 8000);

// ARC_SPINE_ROOT is how tests (and a consumer with a non-standard layout) point the spine
// somewhere else. Otherwise the spine belongs to a REPO: we require .claude and .git in the
// same directory. Walking up for `.claude` alone found the user's HOME config from an
// unrelated cwd and quietly wrote one project's receipts into a global spine.
export function spineRoot() {
  if (process.env.ARC_SPINE_ROOT) return resolve(process.env.ARC_SPINE_ROOT);
  let dir = process.cwd();
  for (;;) {
    if (existsSync(join(dir, ".claude")) && existsSync(join(dir, ".git")))
      return join(dir, ".claude", "state", "hq");
    const up = dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  throw new SpineError(
    "NO_ROOT",
    "no repository with .claude/ and .git/ at or above cwd -- refusing to guess a spine location (set ARC_SPINE_ROOT to be explicit)",
  );
}

export const eventsDir = (root) => join(root, "events");
export const quarantineDir = (root) => join(root, "events", "_quarantine");
// The spool. Separate from _quarantine/ on purpose: "your event was invalid" and "the
// machine was busy" are different facts about different things, and one bucket for both
// meant a perfectly good receipt sat in the folder reserved for rejects.
export const pendingDir = (root) => join(root, "events", "_pending");
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
 *
 * Ownership is a TOKEN, not the mere existence of the file. The first version released the
 * lock with an unconditional unlink, so once a stale-breaker had handed the lock to someone
 * else, the original holder's release deleted the NEW holder's lock -- and three processes
 * ended up inside the critical section at once.
 */
export function withLock(root, fn, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const dir = eventsDir(root);
  ensureDir(dir);
  const lock = join(dir, ".lock");
  const token = `${process.pid}:${randomBytes(8).toString("hex")}`;
  const deadline = Date.now() + timeoutMs;
  let fd = null;
  let lastCode = "EEXIST";

  for (;;) {
    try {
      fd = openSync(lock, "wx"); // atomic create-or-fail
      break;
    } catch (e) {
      // "Somebody else has it" is not spelled the same way on every OS, and reading only
      // EEXIST cost a receipt. Windows keeps a released file in a DELETE-PENDING state until
      // the last handle closes; an O_EXCL create landing in that window fails EPERM (EACCES
      // on some filesystems), not EEXIST. Section E's fixture caught it on the first run --
      // 1 strict emit in 200 refused LOCK_FAILED on windows-git-bash, which in strict mode is
      // exit 2 and a LOST receipt, the exact failure REQ-04 exists to prevent (risk 5, the C2
      // lesson). All three codes mean contention, so all three retry; a genuine permission
      // fault still surfaces, as a LOCK_TIMEOUT naming the code it kept seeing.
      if (e.code !== "EEXIST" && e.code !== "EPERM" && e.code !== "EACCES")
        throw new SpineError("LOCK_FAILED", `cannot take the spine lock: ${e.code || e.message}`);
      lastCode = e.code;
      // A killed emitter leaves its lock behind. Break it once it is provably stale, or the
      // next session inherits a wedged spine (the crash window is exactly when telemetry
      // must not block a human).
      try {
        if (Date.now() - statSync(lock).mtimeMs > LOCK_STALE_MS) { unlinkSync(lock); continue; }
      } catch { /* the holder released it between our check and now -- retry */ }
      if (Date.now() > deadline)
        throw new SpineError("LOCK_TIMEOUT", `spine lock held for more than ${timeoutMs}ms (last open: ${lastCode})`);
      sleepSync(15);
    }
  }

  try {
    writeSync(fd, Buffer.from(`${token}\n`, "utf8"));
    fsyncSync(fd);
    closeSync(fd);
    fd = null;
    // If a stale-breaker took our lock away between creation and here, we are not the
    // holder and must not write. Cheap re-read; the alternative is a silent double writer.
    if (readLockToken(lock) !== token)
      throw new SpineError("LOCK_LOST", "another process took the spine lock mid-acquire");
    return fn();
  } finally {
    if (fd !== null) { try { closeSync(fd); } catch { /* already closed */ } }
    try {
      if (readLockToken(lock) === token) unlinkSync(lock);
    } catch { /* never let releasing the lock be the thing that throws */ }
  }
}

function readLockToken(lock) {
  try { return readFileSync(lock, "utf8").trim(); } catch { return null; }
}

// One line, one write, then fsync: the whole line reaches the page cache in a single call,
// so a kill between events can never leave half a line behind.
//
// The heal below matters more than it looks. If a previous write was truncated mid-line,
// appending straight onto it welds our event to the torn remains and BOTH become
// unparseable -- the emitter reports success for a receipt that no longer exists.
function appendLine(file, line) {
  ensureDir(dirname(file));
  let prefix = "";
  try {
    const size = statSync(file).size;
    if (size > 0) {
      const fdCheck = openSync(file, "r");
      try {
        const tail = Buffer.alloc(1);
        readSync(fdCheck, tail, 0, 1, size - 1);
        if (tail[0] !== 0x0a) prefix = "\n";
      } finally { closeSync(fdCheck); }
    }
  } catch { /* no file yet, or unreadable -- the append below surfaces the real error */ }

  const fd = openSync(file, "a");
  try {
    writeSync(fd, Buffer.from(prefix + line, "utf8"));
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  return prefix !== "";
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

// ---------------------------------------------------------------------------- the spool ----
//
// A hook that cannot take the lock in time must not block the session and must not throw the
// receipt away. It writes the ALREADY-SEALED canonical line to its own file under _pending/,
// and the next emitter to hold the lock appends it. Storing the sealed line verbatim is what
// makes the drained bytes identical to a direct emit's: the drain re-appends, it never
// re-serializes.

/**
 * Spool one sealed event. tmp + rename, because a crash mid-write would otherwise leave a
 * half-written file that every future drain would choke on -- a spool that poisons itself.
 *
 * Returns a `label` as well as the path because spine paths are built HERE and nowhere else
 * (ADR-0030, enforced by spine-reader-lint): a caller that wants to name the destination in a
 * message must be handed the name, not left to compose one out of the spine's directory
 * layout.
 */
export function spoolEvent(root, event, canonicalLine) {
  const dir = pendingDir(root);
  ensureDir(dir);
  const file = join(dir, `${event.id}.json`);
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, canonicalLine + "\n", "utf8");
  renameSync(tmp, file);
  return { file, label: `${basename(dir)}/${basename(file)}` };
}

/** Spooled files, oldest first. ULIDs sort lexically by time, so the name IS the order. */
export function listPending(root) {
  const dir = pendingDir(root);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((n) => n.endsWith(".json"))   // never the .json.tmp of a write in flight
    .sort()
    .map((n) => join(dir, n));
}

export const pendingCount = (root) => listPending(root).length;

/**
 * Append every spooled event. The CALLER MUST HOLD THE LOCK -- this is the "drained under the
 * next lock" half of the contract.
 *
 * Exactly-once, and the crash window is the reason for the shape. Append-then-unlink means a
 * crash in between leaves the event BOTH on the spine and in the spool; the next drain sees
 * DUP_IDEM from the idem index, which is proof it already landed, so the spool copy is
 * dropped rather than appended twice. The reverse order -- unlink then append -- would lose
 * the event outright in the same window. Never both, never neither.
 *
 * Nothing here is allowed to throw: a drain runs on the way to somebody else's append, and a
 * single bad spool file must not take that caller's receipt down with it.
 */
export function drainPendingUnlocked(root) {
  const report = { drained: [], deduped: [], quarantined: [], failed: [] };
  for (const file of listPending(root)) {
    let line, event;
    try {
      line = readFileSync(file, "utf8").replace(/\n+$/, "");
      event = JSON.parse(line);
      if (!event || typeof event.ts !== "string" || typeof event.idem !== "string")
        throw new Error("not a sealed event");
    } catch (e) {
      // Unreadable means it can never be drained, so retrying it forever would wedge every
      // future emit behind the same failure. Quarantine is the visible destination for
      // something that cannot go on the spine -- which is exactly what that folder is for.
      try {
        quarantine(root, {
          code: "SPOOL_UNREADABLE",
          message: `pending file ${basename(file)} is not a sealed canonical event: ${e.message}`,
          day: formatIst(nowMs()).slice(0, 10),
          stubOnly: true,   // its contents are unparseable, so they are also unscannable
        });
        unlinkSync(file);
      } catch { /* nothing here may block the caller's own append */ }
      report.quarantined.push({ file: basename(file), code: "SPOOL_UNREADABLE" });
      continue;
    }

    try {
      appendEventUnlocked(root, event, line);
      report.drained.push(event.id);
    } catch (e) {
      if (e.code === "DUP_IDEM") {
        report.deduped.push(event.id);            // already landed before a crash: drop the copy
      } else if (e.code === "DAY_CLOSED") {
        // Its day was sealed while it waited. ADR-0029 makes that day immutable forever, so
        // this receipt can never be appended where it belongs. Quarantined rather than left
        // to retry on every emit until someone notices -- visible loss, never silent.
        try {
          quarantine(root, {
            code: "DAY_CLOSED",
            message: `spooled event ${event.id} outlived its day (${event.ts.slice(0, 10)} is closed, ADR-0029)`,
            day: event.ts.slice(0, 10),
            raw: line,   // sealed by the emitter, so already past the secret scan
          });
        } catch { /* see above */ }
        report.quarantined.push({ file: basename(file), code: "DAY_CLOSED" });
      } else {
        // Unexpected. Leave the file alone so nothing is lost, and report it.
        report.failed.push({ file: basename(file), code: e.code || "INTERNAL" });
        continue;
      }
    }
    try { unlinkSync(file); } catch { /* a concurrent drain got there first */ }
  }
  return report;
}

/**
 * Append one validated event. Caller supplies the canonical line (sha included).
 * Throws DUP_IDEM / DAY_CLOSED -- both are refusals, not crashes.
 *
 * The drain rides along here because this is the only place that reliably takes the lock:
 * "drained under the next lock" needs no separate command, no daemon, and no timer
 * (ADR-0027's no-bus stance -- the spool is a timeout fallback, not a queue).
 */
export function appendEvent(root, event, canonicalLine, opts = {}) {
  return withLock(root, () => {
    const drain = drainPendingUnlocked(root);
    return { ...appendEventUnlocked(root, event, canonicalLine), drain };
  }, opts);
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
  const healed = appendLine(dayFile(root, day), canonicalLine + "\n");

  // Past this point the receipt EXISTS. An index failure is a derived-state problem, and
  // reporting failure here would be a lie that makes the caller retry and duplicate it.
  let indexed = true;
  try {
    ensureDir(derivedDir(root));
    appendLine(idemIndexPath(root), `${event.idem}\t${event.id}\n`);
  } catch {
    indexed = false;
  }
  return { day, file: dayFile(root, day), healed, indexed };
}

/**
 * Quarantine an input that must not reach the spine.
 *
 * `raw` is written ONLY when the caller has proven it carries no secret. Every rejection
 * that fires BEFORE the scanner runs (a bad ts, an unknown kind) used to persist the raw
 * bytes verbatim -- so a payload holding a live credential landed in cleartext in an
 * append-only file, which is precisely what ADR-0028 exists to prevent.
 */
export function quarantine(root, { code, message, day, raw, stubOnly }) {
  const dir = quarantineDir(root);
  ensureDir(dir);
  const record = {
    code,
    day,
    reason: stubOnly ? "refused: secret-bearing or unscannable input (stub-only record, ADR-0028)" : String(message || "").slice(0, 1000),
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
