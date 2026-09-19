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
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

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
  let dir;
  try { dir = mkdtempSync(join(tmpdir(), "arc-spine-judge-")); }
  catch (e) { return `the spine could not be asked: no temp directory (${e && e.code ? e.code : "error"})`; }
  try {
    const file = join(dir, "payload.json");
    writeFileSync(file, JSON.stringify(payload), "utf8");
    const r = spawnSync(process.execPath, [arcEvent, "emit", kind, "--payload-file", file, ...(o.flags || []), "--strict", "--dry-run"],
      { cwd: o.cwd, env: o.env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    if (r.error) return `the spine could not be asked: the emitter did not start (${r.error.code || r.error.message})`;
    return r.status === 0 ? null : (String(r.stderr || "").trim().split(/\r?\n/).filter(Boolean)[0] || `the emitter exited ${r.status}`);
  } finally {
    try { rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }); } catch { /* litter */ }
  }
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
