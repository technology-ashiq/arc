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
import { readFileSync, readdirSync, realpathSync } from "node:fs";
import { join, dirname } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// A change to the gate itself runs every gated job, so a broken job definition cannot merge unrun (attack r2 B4).
const GATE = [/^\.github\/workflows\/ci\.yml$/, /^\.claude\/scripts\/core\/ci-changes\.mjs$/];
const RULES = {
  face: [/^face\//, ...GATE],
  citier: [/^docker\//, /^\.claude\/scripts\/review\/arc-tools-image\.sh$/, /^\.claude\/scripts\/review\/arc-scan\/adapters\/trivy/, ...GATE],
};

// Paperwork (REQ-02, ADR-2212): a change made ONLY of these runs quality + security, never the test suite.
// Allowlist, not denylist: a path on no list is code. Off the list: every docs/initiatives path a bats test
// reads by content (evidence/phase-00/readers.md) -- portfolio-board's reads run in quality instead.
const PAPERWORK = [/^docs\/.*\.md$/, /^initiatives\/[^/]+\/(PLAN|PROGRESS)\.md$/, /^initiatives\/[^/]+\/phases\/[^/]+\.md$/,
  /^initiatives\/[^/]+\/evidence\//, /^initiatives\/[^/]+\/handoffs\//, /^PORTFOLIO\.md$/];
const READ_BY_TESTS = [/^docs\/(wiki|memory|council|archive|design|templates)\//, /^docs\/[^/]+\.md$/, /^docs\/strategy\/README\.md$/,
  /^initiatives\/develop\/PLAN\.md$/, /^initiatives\/absorb\/evidence\/planoff\//, /^initiatives\/engine\/evidence\/phase-04\//,
  /^initiatives\/face\/evidence\/phase-03\//, /^initiatives\/policy\/evidence\/phase-02\//];
// A program or test is code wherever it sits, evidence/ and handoffs/ included (attack p01 B11).
const CODE_EXT = /\.(mjs|cjs|js|ts|tsx|sh|bash|bats|ps1|py|ya?ml)$/;

/**
 * The static list goes stale the day a test starts reading a new doc (attack p01 L3/L10), so the tests' own
 * text is asked too: a path a test file names literally, or a directory of 3+ segments it names, is code.
 * shortcut: a templated read (`initiatives/$lane/...`) is invisible to this; READ_BY_TESTS carries those.
 */
export function testsText(root = ".") {
  const out = [];
  const walk = (d) => { for (const e of readdirSync(d, { withFileTypes: true })) { const p = join(d, e.name); if (e.isDirectory()) walk(p); else if (/\.(bats|mjs|bash)$/.test(e.name)) out.push(readFileSync(p, "utf8")); } };
  try { walk(join(root, "tests")); } catch { return null; } // unreadable tests/ -> no answer, so nothing is paperwork
  return out.join("\n");
}
const namedByTests = (p, text) => {
  if (text === null) return true;
  if (text.includes(p)) return true; // the file itself, at any depth: PORTFOLIO.md is one segment (attack p01 r2 B2)
  const segs = p.split("/");
  for (let n = segs.length - 1; n >= 3; n--) if (text.includes(segs.slice(0, n).join("/"))) return true;
  return false;
};
export const isPaperwork = (p, text = "") => PAPERWORK.some((r) => r.test(p)) && !READ_BY_TESTS.some((r) => r.test(p)) && !CODE_EXT.test(p) && !namedByTests(p, text);

export function classify(paths, text = "") {
  const out = {};
  for (const [k, res] of Object.entries(RULES)) out[k] = paths.length === 0 || paths.some((p) => res.some((r) => r.test(p)));
  out.code = paths.length === 0 || !paths.every((p) => isPaperwork(p, text));
  return out;
}

function changedPaths(argv) {
  const flag = (name) => { const i = argv.indexOf(name); return i < 0 ? undefined : (argv[i + 1] ?? ""); };
  const files = flag("--files");
  if (files !== undefined) return readFileSync(files, "utf8").split(/\r?\n/).filter(Boolean);
  const base = flag("--base");
  const head = flag("--head") || "HEAD";
  if (!base) return [];
  // Literal argv, no wrapper: plan-bound-audit reads a variable git argv as a write (fail closed).
  const opts = { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] };
  try {
    // Both ends must resolve before a diff is believed: a successful diff over the wrong range is
    // the one fail-open cannot catch (attack B1, L6). -z: a quoted or newline-bearing path is one record.
    // --no-renames: a file moved OUT of face/ lists its old path too (attack r2 B3).
    for (const ref of [base, head]) execFileSync("git", ["cat-file", "-e", `${ref}^{commit}`], opts);
    return execFileSync("git", ["-c", "core.quotePath=false", "diff", "-z", "--no-renames", "--name-only", `${base}...${head}`], opts).split("\0").filter(Boolean);
  } catch { return []; }
}

const self = realpathSync(fileURLToPath(import.meta.url));
const invoked = process.argv[1] ? (() => { try { return realpathSync(process.argv[1]); } catch { return null; } })() : null;
if (invoked === self) {
  const paths = changedPaths(process.argv.slice(2));
  if (paths.length === 0) console.error("ci-changes: no change list (dispatch, diff error or empty) -- failing open");
  // The tree this script sits in, not the cwd: the tests it asks are the ones that will run.
  const root = join(dirname(self), "..", "..", "..");
  for (const [k, v] of Object.entries(classify(paths, testsText(root)))) console.log(`${k}=${v}`);
}
