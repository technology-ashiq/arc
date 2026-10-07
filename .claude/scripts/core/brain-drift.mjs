#!/usr/bin/env node
/**
 * brain-drift.mjs -- REQ-06: AGENTS.md is the brain and CLAUDE.md cannot disagree with it (distribute ADR-2007).
 *
 *   node .claude/scripts/core/brain-drift.mjs [--root DIR]
 *
 * Every harness reads AGENTS.md; only Claude Code reads CLAUDE.md, which imports AGENTS.md with an
 * `@AGENTS.md` line. So outside a `<!-- claude-only -->` ... `<!-- /claude-only -->` block, CLAUDE.md
 * may hold only its first-line title, the import, blank lines and HTML comments. Anything else there is
 * a rule only one harness would ever see -- a DRIFT, and a heading is named by its text. Inside a block,
 * a heading that also exists in AGENTS.md is a DRIFT too (the same rule said twice will be edited once).
 * A template placeholder word (the four letters T-O-D-O) in either file is a DRIFT.
 *
 * Exit: 0 no drift · 1 drift (each `DRIFT <file>: <what>`) · 2 COULD NOT SCAN / usage.
 * Last line of a completed run: `RAN brain-drift`.
 */
import { readFileSync, realpathSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const OPEN = "<!-- claude-only -->";
const CLOSE = "<!-- /claude-only -->";
const PLACEHOLDER = new RegExp("\\b" + "TO" + "DO" + "\\b");
const HEADING = /^(#{1,6})\s+(.+?)\s*$/;

class CouldNotScan extends Error {}

function read(root, name) {
  let t;
  try { t = readFileSync(join(root, name), "utf8"); } catch { throw new CouldNotScan(`${name} unreadable in ${root}`); }
  if (t.trim() === "") throw new CouldNotScan(`${name} is empty`);
  return t.replace(/\r/g, "").split("\n");
}

const norm = (h) => h.replace(/<!--[\s\S]*?-->/g, "").replace(/\s+/g, " ").trim();

export function check(root) {
  const agents = read(root, "AGENTS.md");
  const claude = read(root, "CLAUDE.md");
  const drift = [];
  let headings = 0;

  const agentHeads = new Set();
  agents.forEach((l, i) => {
    const m = HEADING.exec(l);
    if (m) { headings++; agentHeads.add(norm(m[2])); }
    if (PLACEHOLDER.test(l)) drift.push(`DRIFT AGENTS.md: placeholder at line ${i + 1}`);
  });

  let inBlock = false, blockStart = 0, imported = false, inComment = false;
  claude.forEach((raw, i) => {
    const n = i + 1;
    if (PLACEHOLDER.test(raw)) drift.push(`DRIFT CLAUDE.md: placeholder at line ${n}`);
    // Comments are removed BEFORE any decision, and what is left is judged: text after a closing `-->`
    // is real content, and a marker inside a comment is not a marker (attack 4f5dfc7 B5, L9-L11).
    let rest = raw;
    if (inComment) {
      const end = rest.indexOf("-->");
      if (end < 0) return;
      inComment = false;
      rest = rest.slice(end + 3);
    }
    const whole = rest.trim();
    if (whole === OPEN || whole === CLOSE) rest = whole;
    else {
      rest = rest.replace(/<!--[\s\S]*?-->/g, "");
      const open = rest.indexOf("<!--");
      if (open >= 0) { inComment = true; rest = rest.slice(0, open); }
    }
    const l = rest.trim();
    if (l === OPEN) {
      if (inBlock) drift.push(`DRIFT CLAUDE.md: nested claude-only block at line ${n}`);
      inBlock = true; blockStart = n; return;
    }
    if (l === CLOSE) {
      if (!inBlock) drift.push(`DRIFT CLAUDE.md: a close marker with no open block at line ${n}`);
      inBlock = false; return;
    }
    const m = HEADING.exec(l);
    if (m) headings++;
    if (inBlock) {
      if (m && agentHeads.has(norm(m[2]))) drift.push(`DRIFT CLAUDE.md: "${norm(m[2])}" is in a claude-only block and also in AGENTS.md (line ${n})`);
      return;
    }
    if (l === "") return;
    // Only an import OUTSIDE every block counts: one hidden inside a claude-only block is not the brain (L12).
    if (l === "@AGENTS.md") { imported = true; return; }
    if (n === 1 && m && m[1] === "#") return;
    if (m) {
      if (!agentHeads.has(norm(m[2]))) drift.push(`DRIFT CLAUDE.md: heading "${norm(m[2])}" (line ${n}) is outside a claude-only block and absent from AGENTS.md`);
      else drift.push(`DRIFT CLAUDE.md: heading "${norm(m[2])}" (line ${n}) repeats AGENTS.md outside a claude-only block`);
      return;
    }
    drift.push(`DRIFT CLAUDE.md: unmarked line ${n} outside a claude-only block: ${l.slice(0, 60)}`);
  });
  if (inBlock) drift.push(`DRIFT CLAUDE.md: unclosed claude-only block opened at line ${blockStart}`);
  // An unterminated `<!--` would hide every line after it from this check (attack 7c55982 L2).
  if (inComment) drift.push("DRIFT CLAUDE.md: unclosed HTML comment hides the rest of the file");
  if (!imported) drift.push("DRIFT CLAUDE.md: no @AGENTS.md import line");
  return { headings, drift };
}

function main(argv) {
  let root = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--root") {
      const v = argv[i + 1];
      if (v === undefined || v === "" || v.startsWith("--")) { console.error("brain-drift: --root needs a directory"); return 2; }
      if (root !== null) { console.error("brain-drift: --root given twice"); return 2; }
      root = v; i++;
    } else { console.error(`brain-drift: unknown argument ${JSON.stringify(argv[i])}`); return 2; }
  }
  root = resolve(root ?? join(dirname(fileURLToPath(import.meta.url)), "..", "..", ".."));
  try {
    const r = check(root);
    console.log(`brain-drift: ${r.headings} headings checked, ${r.drift.length} drift`);
    for (const d of r.drift) console.log(d);
    console.log("RAN brain-drift");
    return r.drift.length ? 1 : 0;
  } catch (e) {
    if (e instanceof CouldNotScan) { console.log(`brain-drift: COULD NOT SCAN -- ${e.message}`); return 2; }
    throw e;
  }
}

const self = realpathSync(fileURLToPath(import.meta.url));
const invoked = process.argv[1] ? (() => { try { return realpathSync(process.argv[1]); } catch { return null; } })() : null;
if (invoked === self) process.exitCode = main(process.argv.slice(2));
