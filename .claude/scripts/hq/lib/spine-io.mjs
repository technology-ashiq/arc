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
  readSync, readdirSync, statSync, unlinkSync, writeFileSync, writeSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
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
// PRESENCE, not truthiness. The test was `if (process.env.ARC_SPINE_ROOT)`, so
// `ARC_SPINE_ROOT=""` -- the unquoted-empty-value failure .claude/rules/lanes.md records, and
// what `--spine-root "$UNSET_VAR"` expands to in any wrapper -- fell through to the walk-up and
// read a DIFFERENT spine entirely. Reproduced against `arc-leads report`: five rehearsal
// receipts on the named spine, and the report answered from the repo's own spine at exit 0.
// The refusal below covers "the spine does not exist"; it never covered "the spine was never
// named", and a reader that answers confidently out of the wrong file is the worse of the two.
export function spineRoot() {
  if ("ARC_SPINE_ROOT" in process.env) {
    const named = process.env.ARC_SPINE_ROOT;
    if (typeof named !== "string" || named.trim() === "")
      throw new SpineError(
        "NO_ROOT",
        "ARC_SPINE_ROOT is set but empty -- refusing to fall back to a spine nobody named, because reading the wrong spine answers every question confidently and wrongly (unset it, or give it a path)",
      );
    return resolve(named);
  }
  const dir = repoRoot();
  if (dir === null)
    throw new SpineError(
      "NO_ROOT",
      "no repository with .claude/ and .git/ at or above cwd -- refusing to guess a spine location (set ARC_SPINE_ROOT to be explicit)",
    );
  assertNotLinkedWorktree(dir);
  return join(dir, ".claude", "state", "hq");
}

/**
 * The REPOSITORY root -- the directory holding both `.claude/` and `.git/` -- or null.
 *
 * Extracted from `spineRoot` so the walk exists ONCE. It is deliberately separate from the spine:
 * `ARC_SPINE_ROOT` points the SPINE somewhere, and a caller that conflated the two read a repo file
 * out of a scratch directory and silently found nothing there (ledger Phase 01, finding 1) -- the
 * kill-criteria file vanished and, with it, the refusal that guards it.
 *
 * No worktree assertion here, unlike `spineRoot`. That refusal exists because `.claude/state/` is
 * gitignored and every worktree gets its own empty one; a TRACKED file is present and identical in
 * every worktree, so refusing to find one would be a rule with no failure behind it.
 */
export function repoRoot() {
  let dir = process.cwd();
  for (;;) {
    if (existsSync(join(dir, ".claude")) && existsSync(join(dir, ".git"))) return dir;
    const up = dirname(dir);
    if (up === dir) return null;
    dir = up;
  }
}

/**
 * REFUSE to resolve a spine inside a LINKED GIT WORKTREE.
 *
 * `.claude/state/` is gitignored, so every worktree gets its own empty one, and this resolver used to
 * hand one back without comment. The emit then succeeded -- valid event, correct shape, real ULID --
 * into a spine no reader consults. Measured 2026-08-10 across the checkouts on this machine: main
 * clone 967 events, `arc-policy` 613, `arc-absorb` 199. Policy's Phase 03 `phase.closed` receipt is on
 * `arc-policy`'s spine and absent from the main clone, so a ULID cited in an already-merged tracker is
 * unresolvable from the canonical spine.
 *
 * It cost three separate failures in one session before this guard existed: an owner `arc-inbox
 * approve` that recorded nothing and had to be handed over twice, and a `judgement.mjs reveal` that
 * refused a real decision as if it were forged because the seal and the decision sat on different
 * spines.
 *
 * Two properties make this worth a hard refusal rather than a warning:
 *   * `arc-inbox` folds its OPEN set over the spine with no state stored elsewhere (ADR-0030), so a
 *     worktree spine prints `no open approvals` and exits 0 -- a silent false negative on the one
 *     surface built to stop a decision going unrecorded.
 *   * A failed emit leaves no trace at all, so "it ran" and "it landed" are different facts. A warning
 *     on stdout is exactly the signal a wrapper script swallows.
 *
 * `ARC_SPINE_ROOT` is checked BEFORE this (see above), which keeps every test working: the test door
 * points at a temp dir and never reaches here. That is also the reason this cannot be worked around in
 * production by accident -- the env var is documented as test-only, so setting it to reach across is a
 * deliberate act a reviewer can see.
 *
 * Detection is git's own answer, not a `.git`-is-a-file heuristic: in a linked worktree `--git-dir`
 * and `--git-common-dir` differ, and the common dir's parent IS the main clone, which is what the
 * message needs in order to say where to go instead.
 */
function assertNotLinkedWorktree(dir) {
  let gitDir, commonDir;
  try {
    const opts = { cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] };
    gitDir = execFileSync("git", ["rev-parse", "--absolute-git-dir"], opts).trim();
    commonDir = execFileSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], opts).trim();
  } catch {
    // No git, or a git too old for these flags. Not a reason to block an emit -- the guard exists to
    // catch a specific mistake, not to make git a dependency of writing a receipt.
    return;
  }
  if (!gitDir || !commonDir || gitDir === commonDir) return;

  const mainClone = dirname(commonDir);
  throw new SpineError(
    "WORKTREE_SPINE",
    `refusing to use the spine inside a linked git worktree (${dir}).\n` +
      `  .claude/state/ is gitignored, so this worktree has its OWN spine and an event written here\n` +
      `  is valid, real, and invisible to every reader -- including arc-inbox, which folds its OPEN\n` +
      `  set over the spine and would print "no open approvals" while an approval sat here.\n` +
      `  The canonical spine is in the main clone: ${mainClone}\n` +
      `  Run the command from there:  cd ${mainClone} && <the same command>\n` +
      `  (ARC_SPINE_ROOT is a TEST-ONLY door and is checked before this guard; do not set it to\n` +
      `  reach across from a worktree.)`,
  );
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
 *
 * Ownership is a TOKEN, not the mere existence of the file. The first version released the
 * lock with an unconditional unlink, so once a stale-breaker had handed the lock to someone
 * else, the original holder's release deleted the NEW holder's lock -- and three processes
 * ended up inside the critical section at once.
 */
export function withLock(root, fn, { timeoutMs = DEFAULT_TIMEOUT_MS, lockName = ".lock" } = {}) {
  const dir = eventsDir(root);
  ensureDir(dir);
  // `lockName` is ADDITIVE and defaults to the one spine-wide lock, so every existing caller is
  // byte-identical in behaviour. It exists for the scheduler's PER-JOB overlap lock (SCH-C):
  // two different jobs firing in the same minute are legal, and only a job overlapping ITSELF
  // is blocked, so they cannot share one lock. The alternative was a second hand-rolled lock,
  // which is banned outright -- this token-ownership discipline took three defects to get right
  // (a stale-breaker deleting a live holder's lock, an unconditional-unlink release handing the
  // critical section to three processes at once, and EPERM/EACCES on Windows delete-pending
  // meaning contention rather than failure), and none of that is worth reproducing badly.
  if (typeof lockName !== "string" || !/^\.[a-z0-9.-]+$/.test(lockName))
    throw new SpineError("LOCK_FAILED", `lockName ${JSON.stringify(lockName)} is not a safe lock filename`);
  const lock = join(dir, lockName);
  const token = `${process.pid}:${randomBytes(8).toString("hex")}`;
  const deadline = Date.now() + timeoutMs;
  let fd = null;
  let lastCode = "EEXIST";

  // A WAITER MAY NOT BREAK A LOCK IT HAS NOT YET FINISHED WAITING FOR.
  //
  // The threshold was a bare LOCK_STALE_MS (5000) while a strict caller waits
  // STRICT_LOCK_TIMEOUT_MS (15000). A strict waiter therefore outlived the threshold by 10s
  // and would delete the lock of a holder that was alive and mid-write -- and since the token
  // is re-read once at acquire and never again during fn(), the victim kept writing. Two
  // writers in the critical section put DUPLICATE receipts on an append-only spine, with both
  // processes exiting 0 and neither reporting anything. Reproduced at production defaults.
  //
  // Taking the max makes the rule self-consistent: you may only declare a lock abandoned once
  // it has outlasted your own patience, so no waiter can break a lock it was itself prepared
  // to keep waiting for. A genuinely crashed holder is still recovered -- by the NEXT caller,
  // whose wait begins after the lock is already older than any timeout.
  const staleMs = Math.max(LOCK_STALE_MS, timeoutMs);

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
        if (Date.now() - statSync(lock).mtimeMs > staleMs) { unlinkSync(lock); continue; }
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

/**
 * Append one validated event. Caller supplies the canonical line (sha included).
 * Throws DUP_IDEM / DAY_CLOSED -- both are refusals, not crashes.
 */
export function appendEvent(root, event, canonicalLine, opts = {}) {
  return withLock(root, () => appendEventUnlocked(root, event, canonicalLine), opts);
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
