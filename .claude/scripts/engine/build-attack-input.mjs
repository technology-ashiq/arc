#!/usr/bin/env node
/**
 * build-attack-input.mjs -- the arc-run --input document for one attack-diff surface (ADR-0226).
 *
 *   node .claude/scripts/engine/build-attack-input.mjs (--base REF | --since SHA)
 *        --surface logic|boundary --out FILE [--lane NAME] [--prior FILE]
 *        [--classification external-ok|internal-only] [--root PATH]
 *
 * Mirrors build-pack-input.mjs: everything the attacker gets is INLINED, because attack-diff
 * declares `tools: []` and cannot resolve a reference, and because the data boundary (ADR-0219)
 * scans the input before any driver starts -- it can only judge bytes it was actually shown.
 *
 * THE DEFECT PATTERNS ARE THE LANE'S CARRIED LIST, CONDENSED, NEVER CUT. A `fixed-defects.md` row
 * is `- **defect** — where (sha) — *rule*`, often wrapped across lines. Each row contributes its
 * bold lead and its trailing italic rule; a row with no bold lead contributes its first sentence.
 * Rows in == rows out, and both counts are printed: dropping a row to save tokens is exactly the
 * carried-list law being broken quietly (CLAUDE.md, ADR-0226 "Alternatives rejected").
 *
 * Exit: 0 written · 2 usage/operator error · 3/4/5 lane ambiguous/unknown/invalid (lane-resolve's
 * own codes) · 6 the diff is empty (there is nothing to attack, and attacking nothing would
 * produce a clean-looking result).
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { renderHuman, resolveLane } from "../core/lane-resolve.mjs";

const SURFACES = ["logic", "boundary"];
const CLASSIFICATIONS = ["external-ok", "internal-only"];
// A ref reaches git as ONE argv element, so the shell is not the risk -- git's own option parser
// is: a ref of `--output=/tmp/x` is an option to `git diff`, not a revision. Leading `-` refused,
// and the character set is the one git's ref grammar and revision suffixes actually use.
const REF_RE = /^[A-Za-z0-9][A-Za-z0-9._/@{}~^-]*$/;

/**
 * Condense fixed-defects.md to one line per row. Pure, so a test can hold rows-in == rows-out
 * without a repo. Returns `{ rows, lines }`; `lines.length === rows` always.
 */
export function condenseDefects(text) {
  const raw = [];
  let cur = null;
  for (const line of String(text).split(/\r?\n/)) {
    // A bullet at ANY indent starts a row. Column-0 only swallowed an indented bullet into the row
    // above -- two defects became one, the second's rule pinned to the first -- or, with no row
    // open, dropped it outright (logic attack L3: the parser that goes quiet).
    const b = line.match(/^\s*- (.*)$/);
    if (b) { if (cur !== null) raw.push(cur); cur = b[1]; continue; }
    // A wrapped row continues until a blank line, a heading, or the next row -- the file wraps
    // WITHOUT indenting, so "indented means continuation" would split one row into two.
    if (cur !== null && line.trim() !== "" && !/^#/.test(line)) { cur += " " + line.trim(); continue; }
    if (cur !== null) { raw.push(cur); cur = null; }
  }
  if (cur !== null) raw.push(cur);

  const lines = raw.map((row0) => {
    const row = row0.trim();
    let lead = "";
    if (row.startsWith("**")) {
      const end = row.indexOf("**", 2);
      if (end > 2) lead = row.slice(2, end).trim();
    }
    if (!lead) {
      const plain = row.replace(/\*\*/g, "");
      const m = plain.match(/^[\s\S]*?[.!?](?=\s|$)/);
      lead = (m ? m[0] : plain).trim();
    }
    // The rule is the italic span that ENDS the row. A single `*` inside it (a glob, `/*`) is
    // allowed as long as it is not a closing star followed by whitespace.
    const r = row.match(/(?:^|\s)\*([^*\s](?:[^*]|\*(?!\s|$))*?)\*[.,;]?\s*$/);
    const rule = r ? r[1].trim() : "";
    // Never an empty line: an empty entry would read as a row the attacker can skip.
    return (rule ? `${lead} -> ${rule}` : lead) || row;
  });
  // `lines.length === raw.length` holds by construction, so on its own it proves nothing. The
  // number that can disagree is the source's count of list items in ANY marker (`-`, `*`, `+`,
  // `1.`), taken independently of the grouping above: a row written with another marker is folded
  // into its neighbour by the loop, and this is what notices. The caller refuses on a mismatch.
  return { rows: raw.length, lines, bullets: (String(text).match(/^\s*(?:[-*+]|\d+\.)\s/gm) || []).length };
}

function usage(msg) {
  if (msg) process.stderr.write(`build-attack-input: ${msg}\n`);
  process.stderr.write("usage: build-attack-input.mjs (--base REF | --since SHA) --surface logic|boundary --out FILE [--lane NAME] [--prior FILE] [--classification external-ok|internal-only] [--root PATH]\n");
  return 2;
}

export function parseArgs(argv) {
  const opts = { base: null, since: null, surface: null, out: null, lane: "", laneGiven: false, laneDup: false, prior: null, classification: "internal-only", root: null };
  const FLAGS = { "--base": "base", "--since": "since", "--surface": "surface", "--out": "out", "--lane": "lane", "--prior": "prior", "--classification": "classification", "--root": "root" };
  const seen = new Set();
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    // `--flag=VALUE` is refused, not ignored: a form the parser does not read is an error.
    if (a.includes("=") && a.startsWith("--")) return { error: `\`${a}\`: write the value as a separate argument (--flag VALUE)` };
    const key = FLAGS[a];
    if (!key) return { error: `unknown argument \`${a}\`` };
    const v = argv[i + 1];
    // A value that is missing, or is itself a flag, never gets consumed as a value.
    if (v === undefined || v === "" || v.startsWith("--")) return { error: `${a} needs a value` };
    i++;
    if (key === "lane") {
      if (opts.laneGiven && opts.lane !== v) opts.laneDup = true;
      opts.lane = v; opts.laneGiven = true;
      continue;
    }
    if (seen.has(key) && opts[key] !== v) return { error: `${a} given twice with different values` };
    seen.add(key);
    opts[key] = v;
  }
  if (!opts.base === !opts.since) return { error: "give exactly one of --base or --since" };
  if (!SURFACES.includes(opts.surface)) return { error: `--surface must be one of: ${SURFACES.join(", ")}` };
  if (!CLASSIFICATIONS.includes(opts.classification)) return { error: `--classification must be one of: ${CLASSIFICATIONS.join(", ")}` };
  if (!opts.out) return { error: "--out is required" };
  const ref = opts.base ?? opts.since;
  if (!REF_RE.test(ref)) return { error: `\`${ref}\` is not a revision this script will hand to git` };
  return { opts };
}

function gitRoot() {
  return execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
}

export function main(argv) {
  const parsed = parseArgs(argv);
  if (parsed.error) return usage(parsed.error);
  const o = parsed.opts;
  const root = resolve(o.root || gitRoot());

  const lane = resolveLane({ root, lane: o.lane, laneGiven: o.laneGiven, laneDup: o.laneDup, surface: "attack" });
  if (lane.code !== 0) {
    for (const l of renderHuman(lane)) process.stderr.write(`${l}\n`);
    return lane.code;
  }
  if (lane.mode === "lane") process.stderr.write(`Selected lane: ${lane.lane} (via ${lane.via})\n`);

  // Args array, never a shell string -- a ref is one argv element and nothing else.
  const range = o.base ? `${o.base}...HEAD` : `${o.since}..HEAD`;
  let diff;
  try {
    diff = execFileSync("git", ["diff", "--no-color", "--no-ext-diff", range], { cwd: root, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
  } catch (e) {
    process.stderr.write(`build-attack-input: git diff ${range} failed: ${String(e.message).split("\n")[0]}\n`);
    return 2;
  }
  if (!diff.trim()) {
    process.stderr.write(`build-attack-input: the diff ${range} is EMPTY -- nothing to attack, and an attack on nothing would read as a clean result\n`);
    return 6;
  }

  const defectsPath = join(root, lane.tracker, "fixed-defects.md");
  let defect_patterns = "";
  if (existsSync(defectsPath)) {
    const text = readFileSync(defectsPath, "utf8");
    const { rows, lines, bullets } = condenseDefects(text);
    if (bullets !== rows) {
      process.stderr.write(`build-attack-input: ${defectsPath} has ${bullets} list item(s) but ${rows} row(s) were read -- a row in another list marker would be folded into its neighbour. Refusing rather than carrying a short list; write every row as \`- \`.\n`);
      return 2;
    }
    defect_patterns = lines.join("\n");
    process.stderr.write(`defect patterns: ${rows} row(s) in, ${lines.length} line(s) out, ${Buffer.byteLength(defect_patterns)} bytes (from ${Buffer.byteLength(text)}) -- ${defectsPath}\n`);
  } else {
    process.stderr.write(`defect patterns: NONE -- ${defectsPath} does not exist. The attacker carries NO fixed-defects list; twins of earlier fixes will not be checked.\n`);
  }

  let prior_findings = "";
  if (o.prior) {
    try { prior_findings = readFileSync(o.prior, "utf8"); }
    catch (e) { process.stderr.write(`build-attack-input: --prior ${o.prior} cannot be read: ${e.code || e.message}\n`); return 2; }
  }

  const doc = { classification: o.classification, surface: o.surface, diff, defect_patterns, prior_findings };
  writeFileSync(o.out, JSON.stringify(doc, null, 2), "utf8");
  process.stdout.write(`wrote ${o.out} (${o.surface}, ${Buffer.byteLength(diff)} bytes of diff, classification ${o.classification})\n`);
  return 0;
}

// Realpath BOTH sides: `argv[1].endsWith(...)` no-ops behind a symlink or a rename, and that is the
// first row of the fixed-defects list this script exists to carry.
function isMainModule() {
  try { return !!process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); } catch { return false; }
}

if (isMainModule()) process.exitCode = main(process.argv.slice(2));
