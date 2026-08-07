/**
 * subjects.mjs -- the closed subject set, read from the tree (ADR-0504).
 *
 * `process:NAME` resolves against processes/*.process.yaml. This is the ONE place that
 * resolution lives, because two gates consume it in OPPOSITE directions:
 *
 *   policy-lint   FAILs a policy row naming a process that does not exist.
 *   kickoff-lint  WARNs a process file carrying no policy row  (the birth rule, REQ-07).
 *
 * Those are the two halves of one relation. Computed twice they drift, and the drift is silent
 * in the worst way: each gate keeps passing while the pair of them stops covering the middle.
 *
 * ---------------------------------------------------------------------------------------
 * WHICH STRING IS THE SUBJECT. There are two candidates and they are not the same string:
 * the FILENAME STEM of `processes/<stem>.process.yaml`, and the `name:` field inside it.
 *
 * The RUNTIME uses the stem and only the stem: `arc-run --process X` opens
 * processes/X.process.yaml (arc-run.mjs:80) and authorizes `process:X` (run-gate.mjs:196).
 *
 * And on the real tree `name:` is not merely secondary, it is UNREADABLE. `parsePolicyYaml`
 * throws on all three committed process files (its 2-space indentation rule), and the engine's
 * own `parseYamlSubset` reads them but surfaces no top-level `name`. So the fallback below is
 * not a guess that happens to be right -- it is the only subject string any consumer has ever
 * had, and policy-lint has been comparing filename stems since the day it was written.
 * `name:` is kept because a fixture-shaped file can carry one, and a disagreement between the
 * two is worth reporting where it is visible at all.
 * ---------------------------------------------------------------------------------------
 *
 * CROSS-LEG IDENTITY. Everything here is decided by exact bytes on purpose. A directory listing
 * is the one thing all three CI legs can be made to agree on; `existsSync` on a case-insensitive
 * filesystem is not (`Processes/` is the same directory on Windows and macOS and a different one
 * on Linux). Callers that must not disagree across legs use `processesDirState`.
 */
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { parsePolicyYaml } from "./yaml.mjs";

const SUFFIX = ".process.yaml";
const DIRNAME = "processes";

/**
 * How `processes/` exists in this root, decided by exact bytes rather than by existsSync.
 *
 * Returns "absent" | "exact" | "case-variant" | "not-a-directory".
 *
 * `case-variant` is its own answer because it is the one that flips a verdict per CI leg: a
 * directory committed as `Processes/` is opened by Windows and macOS and missed by Linux, so a
 * caller that treats it as absent produces a different result on the same commit depending on
 * the runner. Reported, never guessed at.
 */
export function processesDirState(root) {
  let entries;
  try { entries = readdirSync(root, { withFileTypes: true }); }
  catch { return "absent"; }
  const exact = entries.find((e) => e.name === DIRNAME);
  if (exact) return exact.isDirectory() ? "exact" : "not-a-directory";
  const variant = entries.find((e) => e.name.toLowerCase() === DIRNAME);
  return variant ? "case-variant" : "absent";
}

/**
 * Every process in the tree, or null when there is no processes/ dir at all.
 *
 * null means "cannot check" and is NOT the empty list, which means "checked, there are none".
 * A caller that conflates them reports a missing directory as a clean result.
 *
 * THROWS when processes/ exists but cannot be read. That is deliberate and preserves
 * policy-lint's behaviour exactly: before this function existed its readdirSync threw there
 * too, and policy-lint is a FAIL-capable validator, so swallowing an unreadable subject set
 * would be a fail-open -- it would silently stop checking that policy rows name real
 * processes. Advisory callers catch it; validators must not. VERIFY THIS CONTRACT WHENEVER A
 * NEW CALLER APPEARS: which side of it a caller is on is not inferable from the call.
 *
 * Each subject is `{ file, stem, name, parsed, oddExtension, viaSymlink }`.
 */
export function processSubjects(root) {
  const state = processesDirState(root);
  if (state === "absent") return null;
  if (state === "not-a-directory") {
    const err = new Error(`processes/ exists but is not a directory`);
    err.code = "PROCESSES_UNREADABLE";
    throw err;
  }
  // CASE-VARIANT IS ITS OWN ANSWER, and this function used to fall through it. A directory
  // committed as `Processes/` is opened by Windows and macOS and missed by Linux, so falling
  // through produced a subject set on two legs and an uncaught ENOENT throw on the third --
  // policy-lint, the FAIL-capable gate, does not catch it. kickoff-lint gates on this state
  // before calling and got it right; this caller did not. That is the twin-fix shape: the guard
  // written in one consumer and not the other, which this lane has now shipped four times.
  if (state === "case-variant") {
    const err = new Error(
      `a directory matching "processes" only case-insensitively exists here -- Windows and macOS ` +
      `open it and Linux does not, so the subject set differs per platform. Rename it to exactly ` +
      `"processes".`);
    err.code = "PROCESSES_UNREADABLE";
    throw err;
  }
  const dir = join(root, DIRNAME);

  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    const err = new Error(`processes/ exists but cannot be read: ${e?.message || e}`);
    err.code = "PROCESSES_UNREADABLE";
    err.cause = e;
    throw err;
  }

  const out = [];
  for (const ent of entries) {
    const file = ent.name;
    const exact = file.endsWith(SUFFIX);
    const loose = file.toLowerCase().endsWith(SUFFIX.toLowerCase());
    if (!exact && !loose) continue;
    const stem = file.slice(0, file.length - SUFFIX.length);
    if (!stem) continue;                          // a bare ".process.yaml" names nothing

    // Classify by FOLLOWING the link, not by the dirent's own type. A dirent-only `isFile()`
    // drops a symlink -- and git materializes a committed symlink as a regular file on the
    // Windows runner (core.symlinks=false) while leaving it a link on Linux, so that filter
    // made the same commit produce different subject sets per leg.
    //
    // statSync is also what keeps the FIFO door shut: it does not block, while readFileSync on
    // a FIFO blocks forever and no try/catch can interrupt it. Classify with stat, then read
    // ONLY a regular file. Both halves of that trade are load-bearing; neither may be dropped
    // without reopening the other.
    let st = null;
    try { st = statSync(join(dir, file)); } catch { st = null; }
    if (!st || !st.isFile()) continue;
    const viaSymlink = ent.isSymbolicLink();

    let name = stem, parsed = true;
    try {
      const doc = parsePolicyYaml(readFileSync(join(dir, file), "utf8"));
      if (doc && typeof doc.name === "string") name = doc.name;
    } catch {
      parsed = false;                             // the normal case; see the header
    }
    out.push({ file, stem, name, parsed, oddExtension: !exact, viaSymlink });
  }
  return out;
}

/**
 * Directory entries under processes/ that are not regular files after following links --
 * a nested directory hides `processes/sub/x.process.yaml` from this non-recursive listing
 * while `arc-run --process sub/x` still resolves it, and a junction or reparse point named
 * `x.process.yaml` is reachable by the runtime and invisible here.
 */
export function processDirEntries(root) {
  if (processesDirState(root) !== "exact") return null;
  const dir = join(root, DIRNAME);
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); }
  catch { return null; }
  return entries
    .filter((e) => {
      let st = null;
      try { st = statSync(join(dir, e.name)); } catch { return true; }
      return !st.isFile();
    })
    .map((e) => e.name);
}

/**
 * The subject names policy-lint checks its rows against, in tree order. null propagates.
 *
 * EXACT-SUFFIX ONLY. A `GHOSTCASE.PROCESS.YAML` is opened by Windows and macOS and not by
 * Linux, so admitting it here would let policy-lint accept a `process:ghostcase` row for a
 * process that does not exist on the Linux runner -- a fail-open in the one gate that is
 * FAIL-capable. It is excluded here and reported by the advisory gate instead, which is the
 * right place for "this file is ambiguous" to be said out loud. This also restores the
 * pre-extraction behaviour byte-for-byte: the original `endsWith` was case-sensitive.
 *
 * Kept keyed on `name:` deliberately, though on real files that always falls back to the stem
 * (see the header). Authority-gating callers want `processSubjects(...).stem`, not this.
 */
export function processNames(root) {
  const subs = processSubjects(root);
  return subs === null ? null : subs.filter((s) => !s.oddExtension).map((s) => s.name);
}
