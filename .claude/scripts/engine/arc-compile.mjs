#!/usr/bin/env node
/**
 * arc-compile.mjs -- canonical process -> dialect file (REQ-02, REQ-03).
 *
 * The compiler reads and writes; the ADAPTERS are pure `canonical -> text` functions
 * (ADR-0201). That split is what makes the byte-diff a measurement rather than a
 * coincidence, and the suite asserts it directly by rendering twice and comparing.
 *
 * THE BYTE-DIFF IS A MIGRATION GATE (ADR-0202). It proves the move into `processes/` lost
 * nothing; it retires at the flip and never becomes a permanent regression check, because
 * after the flip "byte-identical to itself" is a tautology and the only thing a permanent
 * byte-lock buys is freezing the pilots against improvement.
 *
 * WHAT LF-NORMALISATION DESTROYS, AND WHAT COVERS IT. Comparison collapses \r\n and a lone
 * \r to \n on BOTH sides, which deletes exactly the signal a Windows-only defect differs on
 * -- the retro-log 2026-07-30 shape where a transform added for measurement removes the
 * property being measured. So line endings are measured by a DIFFERENT instrument: the
 * `lf-only` check below, with its own message and its own negative control. One instrument
 * measures content, another measures line endings, and neither is asked to do the other's
 * job.
 *
 * Usage:
 *   arc-compile.mjs --check [--all|FILE...] [--target claude-code|codex] [--root PATH]
 *   arc-compile.mjs --write [--all|FILE...] [--target ...] [--root PATH]
 * Zero dependencies, Node 18+.
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { execFileSync } from "node:child_process";

import { parseYamlSubset } from "./yaml-subset.mjs";
import * as claudeCode from "./adapters/claude-code.mjs";
import * as codex from "./adapters/codex.mjs";

export const ADAPTERS = Object.freeze({ "claude-code": claudeCode, codex });

const lf = (s) => s.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

/** First differing byte offset plus context. "files differ" costs an hour per round. */
function firstDiff(a, b) {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    if (a[i] !== b[i]) return i;
  }
  return a.length === b.length ? -1 : n;
}
function context(s, i, w = 16) {
  return JSON.stringify(s.slice(Math.max(0, i - w), i + w));
}

function gitToplevel() {
  try {
    return execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch { return ""; }
}

// ---------- CLI ----------
const argv = process.argv.slice(2);
let root = "";
let target = "claude-code";
let mode = null;
let all = false;
// --migration renders WITHOUT the DO-NOT-EDIT header, which is the only way REQ-02's proof
// can be run: it compares against the hand-written files, and those have no header.
// ADR-0202 makes this a migration-window flag, not a permanent mode.
let migration = false;
const files = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--check") mode = "check";
  else if (a === "--write") mode = "write";
  else if (a === "--all") all = true;
  else if (a === "--migration") migration = true;
  else if (a === "--target") target = argv[++i] ?? "";
  else if (a === "--root") root = argv[++i] ?? "";
  else if (a.startsWith("--")) { console.error(`arc-compile: unknown option ${a}`); process.exit(2); }
  else files.push(a);
}
if (!mode) { console.error("usage: arc-compile.mjs --check|--write [--all|FILE...] [--target claude-code|codex] [--root PATH]"); process.exit(2); }
if (!ADAPTERS[target]) { console.error(`arc-compile: unknown target \`${target}\` (known: ${Object.keys(ADAPTERS).join(", ")})`); process.exit(2); }
root = resolve(root || gitToplevel() || ".");

if (all) {
  const dir = join(root, "processes");
  if (!existsSync(dir)) { console.error(`arc-compile: no processes/ directory under ${root}`); process.exit(1); }
  for (const f of readdirSync(dir).sort()) if (f.endsWith(".process.yaml")) files.push(join(dir, f));
}
if (!files.length) { console.error("arc-compile: nothing to compile"); process.exit(2); }

// ---------- compile ----------
const out = [];
let identical = 0;
let failed = 0;

for (const file of files) {
  const rel = relative(root, resolve(file)) || file;
  const parsed = parseYamlSubset(readFileSync(file, "utf8"));
  if (!parsed.ok) {
    out.push(`[compile] ${rel}:${parsed.error.line} — canonical file does not parse: ${parsed.error.what}`);
    failed++;
    continue;
  }
  const doc = parsed.value;

  let rendered;
  try {
    rendered = ADAPTERS[target].render(doc, { withHeader: !migration });
  } catch (e) {
    // A target that genuinely cannot express a construct fails with a NAMED message rather
    // than emitting something that superficially resembles a working command. REQ-03
    // passing mechanically while failing its intent is the outcome to avoid.
    out.push(`[unsupported] ${rel} — the \`${target}\` adapter cannot express this process: ${e.message}`);
    failed++;
    continue;
  }

  // lf-only: its own check, its own message. This is the instrument that covers what the
  // byte-diff's LF normalisation deletes, so it must be real rather than a footnote.
  if (/\r/.test(rendered)) {
    const i = rendered.indexOf("\r");
    out.push(`[lf-only] ${rel} — rendered output contains a CR byte at offset ${i}`);
    out.push(`  Context:  ${context(rendered, i)}`);
    failed++;
    continue;
  }

  const dest = target === "claude-code"
    ? join(root, doc.baseline?.path ?? "")
    : join(root, "tests/fixtures/engine/goldens", target, `${doc.name}.md`);

  if (mode === "write") {
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, rendered, "utf8");
    out.push(`[written] ${relative(root, dest)} (${rendered.length} bytes)`);
    continue;
  }

  if (!existsSync(dest)) {
    out.push(`[missing] ${relative(root, dest)} — nothing to compare against (run --write to record it)`);
    failed++;
    continue;
  }
  const want = lf(readFileSync(dest, "utf8"));
  const got = lf(rendered);
  if (want === got) { identical++; continue; }

  const i = firstDiff(got, want);
  out.push(`[byte-diff] ${relative(root, dest)} — differs at byte ${i} (rendered ${got.length} bytes, on disk ${want.length})`);
  out.push(`  Expected: ${context(want, i)}`);
  out.push(`  Found:    ${context(got, i)}`);
  failed++;
}

for (const line of out) console.log(line);
if (mode === "write") {
  console.log(`\narc-compile: wrote ${files.length - failed} of ${files.length} file(s) for target \`${target}\``);
  process.exit(failed ? 1 : 0);
}
console.log(`\narc-compile: ${identical}/${files.length} byte-identical for target \`${target}\``);
process.exit(failed ? 1 : 0);
