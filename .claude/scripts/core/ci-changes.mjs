#!/usr/bin/env node
/**
 * ci-changes.mjs -- which path-gated CI jobs a change needs (ci ADR-2201). The `changes` job appends
 * its stdout to $GITHUB_OUTPUT; filtering is job-level `if:`, never workflow-level `paths` (CI-I).
 *
 *   node .claude/scripts/core/ci-changes.mjs --base SHA --head SHA
 *   node .claude/scripts/core/ci-changes.mjs --files LIST     # one path per line
 *
 * Prints `face=true|false` and `citier=true|false`. FAILS OPEN: no base (a dispatch run), a diff
 * that errors, or an empty list turns every output true -- a skipped required job reads as passing,
 * so doubt must run the job, never skip it.
 */
import { readFileSync, realpathSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const RULES = {
  face: [/^face\//],
  citier: [/^docker\//, /^\.claude\/scripts\/review\/arc-tools-image\.sh$/, /^\.claude\/scripts\/review\/arc-scan\/adapters\/trivy/],
};

export function classify(paths) {
  const out = {};
  for (const [k, res] of Object.entries(RULES)) out[k] = paths.length === 0 || paths.some((p) => res.some((r) => r.test(p)));
  return out;
}

function changedPaths(argv) {
  const flag = (name) => { const i = argv.indexOf(name); return i < 0 ? undefined : (argv[i + 1] ?? ""); };
  const files = flag("--files");
  if (files !== undefined) return readFileSync(files, "utf8").split(/\r?\n/).filter(Boolean);
  const base = flag("--base");
  const head = flag("--head") || "HEAD";
  if (!base) return [];
  try {
    return execFileSync("git", ["diff", "--name-only", `${base}...${head}`], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] })
      .split("\n").filter(Boolean);
  } catch { return []; }
}

const self = realpathSync(fileURLToPath(import.meta.url));
const invoked = process.argv[1] ? (() => { try { return realpathSync(process.argv[1]); } catch { return null; } })() : null;
if (invoked === self) {
  const paths = changedPaths(process.argv.slice(2));
  if (paths.length === 0) console.error("ci-changes: no change list (dispatch, diff error or empty) -- failing open");
  for (const [k, v] of Object.entries(classify(paths))) console.log(`${k}=${v}`);
}
