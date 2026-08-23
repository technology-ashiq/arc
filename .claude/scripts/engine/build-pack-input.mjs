// Build the arc-run --input document for a build-in-public-draft dispatch from a pack file.
// In a file rather than `node -e`, because the pack carries apostrophes and a program embedded in
// a shell string carries none (CLAUDE.md, enforced by tests/embedded-program-guard).
import { readFileSync, writeFileSync } from "node:fs";

const [, , packPath, packRef, outPath] = process.argv;
if (!packPath || !packRef || !outPath) {
  process.stderr.write("usage: build-pack-input.mjs <pack.md> <pack-ref> <out.json>\n");
  process.exit(64);
}

const pack = readFileSync(packPath, "utf8");

// The classification rides the INPUT, not the pack text: the data boundary parses the input
// document structurally, and a classification line inside the pack STRING is a substring rather
// than a declaration it can read.
const doc = {
  classification: "external-ok",
  pack_ref: packRef,
  pack,
};

writeFileSync(outPath, JSON.stringify(doc, null, 2), "utf8");
process.stdout.write(`wrote ${outPath} (${pack.length} bytes of pack)\n`);
