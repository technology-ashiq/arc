// tests/distribute/dirty-probe.mjs -- prints each rendered directory engine/harnesses.yaml declares, for
// tests/distribute-dirty.bats. Read through frontmatter-lint's verifiedRows, the reader arc-compile's dirty
// check uses, so the suite's list cannot drift from the scanner's (fixed-defects class k).
// Usage: node tests/distribute/dirty-probe.mjs <root>   Last line: `RAN dirty-probe`.
import { verifiedRows } from "../../.claude/scripts/engine/frontmatter-lint.mjs";

const root = process.argv[2];
if (!root) throw new Error("no root argument");
const dirs = new Set();
for (const r of verifiedRows(root)) for (const d of Array.isArray(r.rendered) ? r.rendered : []) dirs.add(d);
if (!dirs.size) throw new Error("COULD NOT SCAN: no rendered directory declared");
for (const d of [...dirs].sort()) process.stdout.write(`dir ${d}\n`);
process.stdout.write("RAN dirty-probe\n");
