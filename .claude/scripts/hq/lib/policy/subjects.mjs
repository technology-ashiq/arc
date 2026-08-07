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
 * WHICH STRING IS THE SUBJECT -- the finding that rewrote this file.
 *
 * There are two candidate names for a process and they are NOT the same string:
 *
 *   the FILENAME STEM   `processes/<stem>.process.yaml`
 *   the DECLARED NAME   the `name:` field inside that file
 *
 * The RUNTIME uses the stem, and only the stem. `arc-run --process X` builds
 * `processes/X.process.yaml` (arc-run.mjs:80) and authorizes against
 * `kind = "process:" + X` (run-gate.mjs:196). `name:` is never read for this.
 *
 * `processNames()` -- which predates this file and which policy-lint has always used --
 * reads `name:`. So a file whose `name:` disagrees with its stem is governed under one string
 * and authorized under another, and a birth rule keyed on `name:` goes blind exactly where it
 * matters: `evil.process.yaml` declaring `name: kickoff-plan` looks governed, while
 * `arc-run --process evil` runs as the ungoverned `process:evil`. A fresh adversarial pass
 * found this pinned as CORRECT by the birth rule's own first test -- the running list's
 * "validate one read, compare another" defect (verdict.mjs, then lineage.mjs), in a third file.
 *
 * The resolution is not to pick a winner. It is to make the two strings the same and say so:
 * every subject carries `stem` AND `name`, callers that gate on authority use `stem`, and a
 * disagreement between them is itself reportable. All three processes in the tree satisfy
 * stem === name today, so the invariant costs nothing to hold and everything to lose.
 * ---------------------------------------------------------------------------------------
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parsePolicyYaml } from "./yaml.mjs";

const SUFFIX = ".process.yaml";

/**
 * Every process in the tree, or null when there is no processes/ dir at all.
 *
 * null means "cannot check" and is NOT the empty list, which means "checked, there are none".
 * A caller that conflates them reports a missing directory as a clean result.
 *
 * THROWS when processes/ exists but cannot be read (it is a regular file, a permission is
 * denied, a Windows lock). That is deliberate and it preserves policy-lint's behaviour
 * exactly: before this function existed its `readdirSync` threw there too, and policy-lint is
 * a FAIL-capable validator, so swallowing an unreadable subject set would be a fail-open --
 * it would silently stop checking that policy rows name real processes. Advisory callers
 * catch it; validators must not.
 *
 * Each subject is `{ file, stem, name, parsed, oddExtension }`:
 *   stem          the authority string -- what the runtime keys on
 *   name          the declared `name:`, falling back to stem
 *   parsed        false when the narrow parser could not read the file, so a caller can tell
 *                 "declares this name" from "is garbage and I guessed"
 *   oddExtension  the file matches <stem>.process.yaml only case-insensitively. On Windows and
 *                 macOS the runtime still opens it; on Linux it does not. Reported rather than
 *                 silently included, because a subject that exists on two CI legs and not the
 *                 third is worse than one that exists nowhere.
 *
 * The subject set is a directory listing, never an invention (ADR-0504).
 */
export function processSubjects(root) {
  const dir = join(root, "processes");
  if (!existsSync(dir)) return null;

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
    if (!ent.isFile()) continue;                  // a subdirectory is not a process; see below
    const file = ent.name;
    const exact = file.endsWith(SUFFIX);
    const loose = file.toLowerCase().endsWith(SUFFIX);
    if (!exact && !loose) continue;
    const stem = file.slice(0, file.length - SUFFIX.length);
    if (!stem) continue;                          // a bare ".process.yaml" names nothing

    let name = stem, parsed = true;
    try {
      const doc = parsePolicyYaml(readFileSync(join(dir, file), "utf8"));
      if (doc && typeof doc.name === "string") name = doc.name;
    } catch {
      // A process file this narrow parser cannot read still contributes its filename, so a
      // policy row for it is not rejected because of an unrelated parser limitation. The flag
      // is what stops that fallback being mistaken for a declaration.
      parsed = false;
    }
    out.push({ file, stem, name, parsed, oddExtension: !exact });
  }
  return out;
}

/**
 * Directory entries under processes/ that are NOT files -- a nested directory hides
 * `processes/sub/x.process.yaml` from this non-recursive listing while `arc-run --process
 * sub/x` still resolves it. Returned separately so an advisory caller can report the shape
 * without this module inventing a traversal policy.
 */
export function processDirEntries(root) {
  const dir = join(root, "processes");
  if (!existsSync(dir)) return null;
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); }
  catch { return null; }
  return entries.filter((e) => !e.isFile()).map((e) => e.name);
}

/**
 * The DECLARED names, in tree order. null propagates.
 *
 * Kept keyed on `name:` deliberately: this is policy-lint's long-standing input and a
 * differential run over 29 constructed trees proved the extraction behaviour-preserving.
 * Changing what it returns would change what policy-lint FAILs on, which is a separate,
 * reviewed decision and not a side effect of adding the birth rule. Authority-gating callers
 * want `processSubjects(...).stem`, not this.
 */
export function processNames(root) {
  const subs = processSubjects(root);
  return subs === null ? null : subs.map((s) => s.name);
}
