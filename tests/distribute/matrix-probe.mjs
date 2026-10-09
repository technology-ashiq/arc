// tests/distribute/matrix-probe.mjs -- prints every verified row's cells of engine/harnesses.yaml, for
// tests/distribute-matrix.bats. Read through frontmatter-lint's verifiedRows, the reader the installer's
// degraded lines come from, so the suite's expected set cannot drift from the matrix (fixed-defects class k).
// Usage: node tests/distribute/matrix-probe.mjs <root>
// Prints `cell <row> <cell> <true|false|partial>` per cell, then `RAN matrix-probe`.
import { verifiedRows } from "../../.claude/scripts/engine/frontmatter-lint.mjs";

const root = process.argv[2];
if (!root) throw new Error("no root argument");
const rows = verifiedRows(root);
if (rows.length < 4) throw new Error(`COULD NOT SCAN: ${rows.length} verified rows`);
for (const r of rows) {
  for (const [cell, v] of Object.entries(r.cells ?? {})) {
    const kind = v === "true" ? "true" : v === "false" ? "false" : typeof v === "string" && v.startsWith("partial:") ? "partial" : null;
    if (!kind) throw new Error(`COULD NOT SCAN: ${r.id}.${cell} is ${JSON.stringify(v)}`);
    process.stdout.write(`cell ${r.id} ${cell} ${kind}\n`);
  }
}
process.stdout.write("RAN matrix-probe\n");
