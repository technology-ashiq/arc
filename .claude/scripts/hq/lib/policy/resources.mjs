/**
 * The un-grantable resource guard (ADR-0502) -- Constitution E2's twin for TARGETS.
 *
 * E2 is a list of un-grantable ACTIONS; this is the list of un-grantable TARGETS. Same shape,
 * same enforcement point: `.claude/settings.json`, `.claude/settings.local.json`,
 * `.claude/hooks/**` and `hq.policy.yaml` are excluded from every write grant and every
 * file-mutating shell grant, at every level, regardless of ceiling or cap. A backstop that the
 * thing it binds can delete is not a backstop.
 *
 * ENFORCED BY FILESYSTEM IDENTITY, NOT BY STRING PREFIX. A hardlink has no canonical path for
 * realpath to resolve to, so path comparison cannot see it: `fs.link('.claude/settings.json',
 * 'innocent.json')` produces a second name for the same bytes and a string check waves it
 * through. Comparing `dev`+`ino` catches hardlink, symlink and NTFS junction in ONE mechanism,
 * because all three end at the same inode.
 *
 * THE TWO NO-INODE CASES ARE HANDLED EXPLICITLY, never left to an uncaught throw -- an uncaught
 * throw surfacing as a non-2 exit is literally one of ADR-0501's four fail-open modes:
 *   (a) the TARGET does not exist yet (an ordinary create, the majority of writes) -- compare
 *       the resolved PARENT directory's identity plus the literal basename.
 *   (b) a GUARDED path does not exist in this checkout (.claude/settings.local.json is
 *       gitignored and often absent) -- record it once as absent and fall back to a normalised
 *       string comparison for that entry alone.
 *
 * The string fallback is the ONLY place normalisation is needed, because identity compares no
 * strings at all. There: NFC (not NFD, so a precomposed path equals a decomposed one; not NFKC,
 * which folds visually-distinct characters and would make the guard over-broad), then realpath
 * where the parent exists, then case-folding on win32 only.
 */

import { statSync, realpathSync } from "node:fs";
import { resolve, dirname, basename, sep, relative } from "node:path";

const WIN = process.platform === "win32";

const norm = (p) => {
  let out = p.normalize("NFC").split(/[\\/]+/).join("/");
  if (WIN) out = out.toLowerCase();
  return out;
};

/** 8.3 short names (RUNPRO~1) are rejected outright -- realpath does not always collapse them. */
export const hasShortName = (p) => p.split(/[\\/]+/).some((seg) => /~\d/.test(seg));

function identity(abs) {
  try {
    const real = realpathSync.native ? realpathSync.native(abs) : realpathSync(abs);
    const st = statSync(real);
    return { key: `${st.dev}:${st.ino}`, real };
  } catch {
    return null; // does not exist, or cannot be resolved
  }
}

/**
 * Build the guard once per policy load. Absent guarded paths are recorded here, not discovered
 * inside authorizeAction where a throw would fail open.
 */
export function buildResourceGuard(ungrantableResources, root = process.cwd()) {
  const exact = new Map(); // dev:ino -> declared entry
  const globs = []; // { entry, prefix } for `**` entries
  const absent = []; // { entry, normalised } -- string fallback only

  for (const entry of ungrantableResources || []) {
    if (typeof entry !== "string" || entry === "") continue;
    if (entry.endsWith("/**")) {
      const dirEntry = entry.slice(0, -3);
      const abs = resolve(root, dirEntry);
      const id = identity(abs);
      globs.push({ entry, abs, key: id ? id.key : null, normalised: norm(abs) });
      continue;
    }
    const abs = resolve(root, entry);
    const id = identity(abs);
    if (id) exact.set(id.key, entry);
    else absent.push({ entry, normalised: norm(abs) });
  }
  return { exact, globs, absent, root };
}

/**
 * Is `resource` an un-grantable target? Returns the offending declared entry, or null.
 * Never throws: every failure path returns a decision, because a throw here fails open.
 */
export function guardedEntryFor(resource, guard) {
  if (typeof resource !== "string" || resource === "") return null;
  if (hasShortName(resource)) return "8.3 short name";

  const abs = resolve(guard.root, resource);

  // Case (a): the target may not exist yet. Identity of the target if it does, otherwise
  // identity of its parent plus the literal basename.
  const id = identity(abs);
  if (id && guard.exact.has(id.key)) return guard.exact.get(id.key);

  if (!id) {
    const parent = identity(dirname(abs));
    if (parent) {
      const candidate = `${parent.real}${sep}${basename(abs)}`;
      const candidateId = identity(candidate);
      if (candidateId && guard.exact.has(candidateId.key)) return guard.exact.get(candidateId.key);
      // A create inside a guarded directory tree.
      for (const g of guard.globs) {
        if (g.key) {
          const pid = identity(dirname(abs));
          if (pid && pid.key === g.key) return g.entry;
        }
        if (norm(candidate).startsWith(g.normalised + "/")) return g.entry;
      }
      // A create at a guarded path that does not exist yet (case a + case b together).
      for (const a of guard.absent) if (norm(candidate) === a.normalised) return a.entry;
    }
  }

  // Directory-tree entries (`.claude/hooks/**`) for targets that DO exist.
  for (const g of guard.globs) {
    if (g.key && id) {
      let cur = dirname(id.real);
      for (let depth = 0; depth < 64; depth++) {
        const cid = identity(cur);
        if (cid && cid.key === g.key) return g.entry;
        const next = dirname(cur);
        if (next === cur) break;
        cur = next;
      }
    }
    const target = id ? id.real : abs;
    if (norm(target).startsWith(g.normalised + "/")) return g.entry;
  }

  // Case (b): guarded paths absent from this checkout -- normalised string comparison.
  const target = norm(id ? id.real : abs);
  for (const a of guard.absent) if (target === a.normalised) return a.entry;

  return null;
}

/** Is `resource` inside one of the declared write roots? Globs are `prefix/**` or `**`. */
export function withinRoots(resource, roots, root = process.cwd()) {
  if (!Array.isArray(roots) || roots.length === 0) return false;
  const abs = resolve(root, resource);
  const rel = relative(root, abs).split(sep).join("/");
  if (rel.startsWith("../")) return false; // escaped the repo entirely
  for (const pattern of roots) {
    if (pattern === "**") return true;
    if (pattern.endsWith("/**")) {
      const prefix = pattern.slice(0, -3);
      if (rel === prefix || rel.startsWith(prefix + "/")) return true;
    } else if (rel === pattern) return true;
  }
  return false;
}
