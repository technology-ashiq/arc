/**
 * subjects.mjs -- the closed subject set, read from the tree (ADR-0504).
 *
 * `process:NAME` resolves against processes/*.process.yaml. This is the ONE place that
 * resolution lives, because two gates now consume it in OPPOSITE directions:
 *
 *   policy-lint   FAILs a policy row naming a process that does not exist.
 *   kickoff-lint  WARNs a process file carrying no policy row  (the birth rule, REQ-07).
 *
 * Those are the two halves of one relation. Computed twice, they drift, and the drift is
 * silent in the worst way: each gate keeps passing while the pair of them stops covering
 * the middle. POL-D -- one implementation, two consumers -- is exactly this case.
 *
 * Extracted verbatim from policy-lint.mjs, where it was private, when Phase 03 needed the
 * second direction. Behaviour is unchanged for policy-lint by construction: processNames()
 * is now a projection of processSubjects() and returns the same array it always did.
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parsePolicyYaml } from "./yaml.mjs";

/**
 * Every process in the tree as `{ file, name }`, or null when there is no processes/ dir at
 * all -- null means "cannot check", which is not the same as the empty list, which means
 * "checked, and there are none". A caller that conflates them reports a missing directory as
 * a clean result.
 *
 * The subject set is a directory listing, never an invention (ADR-0504).
 */
export function processSubjects(root) {
  const dir = join(root, "processes");
  if (!existsSync(dir)) return null;
  const out = [];
  for (const file of readdirSync(dir)) {
    if (!file.endsWith(".process.yaml")) continue;
    const fallback = file.replace(/\.process\.yaml$/, "");
    let name = fallback;
    try {
      const doc = parsePolicyYaml(readFileSync(join(dir, file), "utf8"));
      if (doc && typeof doc.name === "string") name = doc.name;
    } catch {
      // A process file this narrow parser cannot read still contributes its filename, so a
      // policy row for it is not rejected because of an unrelated parser limitation.
    }
    out.push({ file, name });
  }
  return out;
}

/** The names alone, in tree order. null propagates: no processes/ dir, nothing to check. */
export function processNames(root) {
  const subs = processSubjects(root);
  return subs === null ? null : subs.map((s) => s.name);
}
