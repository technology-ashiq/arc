#!/usr/bin/env node
/**
 * REQ-06 is the legal lane's one permanent non-negotiable: **no page is ever published without a
 * human decision.** Four specs repeat that sentence. Until this file existed, nothing tested it.
 *
 * The mechanism it protects is `hq.policy.yaml`'s `targets.publish`, a closed enum that is EMPTY.
 * Empty means there is no target any automation can name, so no automated publish can be
 * authorised -- not "is discouraged", cannot be addressed. This gate asserts it stays empty.
 *
 * It runs on EVERY CI leg, not only on changes under `.claude/scripts/legal/**`. The spec asked
 * for the narrower trigger and the narrower trigger is wrong: the value being protected lives in
 * a shared company organ that any lane can edit, and the lane most likely to add a publish target
 * is not this one. A guard that only watches its author's own diffs is not watching the change it
 * exists to catch.
 *
 * Exit 0 empty and safe - exit 2 a publish target exists - exit 3 could not check.
 *
 * `targets.publish` is parsed rather than grepped. A grep for `publish: []` passes a file where
 * the key was deleted outright, and a deleted closed enum is not an empty one -- it is a grammar
 * with no constraint at all, which is strictly worse than the state this guards against.
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..", "..", "..");
const POLICY = join(REPO_ROOT, "hq.policy.yaml");

function die(code, message) {
  process.stderr.write(`publish-gate: ${message}\n`);
  process.exit(code);
}

/**
 * Read one key inside one top-level block, returning either an inline value or the block-list
 * items under it. Deliberately tiny: this reads exactly one shape in one known file, and a
 * general YAML parser here would be a second parser to keep correct.
 */
function readBlockKey(lines, block, key) {
  let i = lines.findIndex((l) => l === `${block}:`);
  if (i < 0) return { found: false };
  for (i += 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
    // Dedent to column 0 ends the block.
    if (!/^\s/.test(line)) break;
    const m = line.match(/^(\s+)([A-Za-z_][A-Za-z0-9_-]*):(.*)$/);
    if (!m) continue;
    if (m[2] !== key) continue;

    const inline = m[3].trim();
    if (inline && inline !== "") return { found: true, inline, items: [] };

    // No inline value: collect the block-list items indented under it.
    const items = [];
    const keyIndent = m[1].length;
    for (let j = i + 1; j < lines.length; j++) {
      const l = lines[j];
      if (!l.trim() || l.trimStart().startsWith("#")) continue;
      const indent = l.length - l.trimStart().length;
      if (indent <= keyIndent) break;
      if (l.trimStart().startsWith("- ")) items.push(l.trimStart().slice(2).trim());
    }
    return { found: true, inline: "", items };
  }
  return { found: false };
}

if (!existsSync(POLICY)) die(3, `hq.policy.yaml is missing at ${POLICY}`);

let lines;
try { lines = readFileSync(POLICY, "utf8").split(/\r?\n/); }
catch (e) { die(3, `cannot read ${POLICY}: ${e.message}`); }

const found = readBlockKey(lines, "targets", "publish");

// A MISSING key is a failure, not a pass. The closed enum being absent means nothing constrains
// what a publish target may be named -- the opposite of what the empty list buys.
if (!found.found)
  die(2, "targets.publish is not present in hq.policy.yaml. REQ-06 rests on that key existing and being EMPTY; a deleted closed enum constrains nothing, so its absence is a weaker state than the one this gate protects, not a stronger one.");

const inlineIsEmpty = found.inline === "[]";
if (found.inline && !inlineIsEmpty)
  die(2, `targets.publish is "${found.inline}", not []. REQ-06 makes the human gate PERMANENT: with a publish target defined, an automated publish becomes addressable. If this change is intended it needs an ADR that supersedes REQ-06, not a green build.`);

if (found.items.length)
  die(2, `targets.publish lists ${found.items.length} target(s): ${found.items.join(", ")}. REQ-06 makes the human gate PERMANENT. If this change is intended it needs an ADR that supersedes REQ-06, not a green build.`);

process.stdout.write("publish-gate: targets.publish is empty - REQ-06 human gate intact\n");
