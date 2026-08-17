#!/usr/bin/env node
/**
 * argv-order-probe.mjs -- every docker flag must sit BEFORE the image in the recorded argv.
 *
 * It lives in a FILE rather than inside `node -e` for the reason this repo has paid for four times:
 * a program embedded in a shell string carries no apostrophe, no single quote and -- in a
 * double-quoted string -- no backtick and no dollar sign, in code OR in comments.
 *
 * FIXED 2026-08-17, after both adversarial surfaces walked past the inline version:
 *
 *   1. It used `argv.indexOf(flag)`, which returns only the FIRST occurrence. `-e` appears six
 *      times in a proxy-configured run, so a seventh `-e` appended AFTER the image was invisible.
 *      Position is now judged on the LAST occurrence.
 *   2. An ABSENT flag returned -1, was filtered out by the `i >= 0` clause, and therefore scored as
 *      "not misplaced" -- so deleting the `-v` data mount entirely left `misplaced:[]` and the test
 *      green. Presence is now reported separately, and the caller asserts on both.
 *
 * The terminal marker line lets the caller assert the probe RAN before asserting what it printed.
 */
import { readFileSync } from "node:fs";

const path = process.argv[2];
if (!path) {
  process.stderr.write("argv-order-probe: usage: argv-order-probe.mjs ARGV_FILE\n");
  process.exit(64);
}

let argv;
try {
  const lines = readFileSync(path, "utf8").trim().split("\n").filter(Boolean);
  if (lines.length === 0) {
    process.stderr.write("argv-order-probe: the argv file is empty -- the fixture recorded no invocation\n");
    process.exit(65);
  }
  argv = JSON.parse(lines[lines.length - 1]);
} catch (e) {
  process.stderr.write(`argv-order-probe: could not read ${path}: ${e.message}\n`);
  process.exit(66);
}

if (!Array.isArray(argv)) {
  process.stderr.write("argv-order-probe: the recorded argv is not an array\n");
  process.exit(67);
}

const img = argv.findIndex((a) => typeof a === "string" && a.startsWith("nousresearch/"));
if (img < 0) {
  process.stderr.write("argv-order-probe: NO IMAGE IN ARGV\n");
  process.exit(68);
}

// Flags every run must carry. `--network` and `-e` are conditional on the egress mode, so they are
// checked for POSITION when present but never for presence.
const ALWAYS = ["-v", "--rm", "--name"];
const CONDITIONAL = ["--network", "-e"];

const absent = ALWAYS.filter((f) => !argv.includes(f));
const misplaced = [...ALWAYS, ...CONDITIONAL].filter((f) => {
  const last = argv.lastIndexOf(f);
  return last >= 0 && last > img;
});

const after = argv.slice(img + 1);
process.stdout.write(`${JSON.stringify({ misplaced, absent, firstAfterImage: after[0] || null })}\n`);
process.stdout.write("ARGV-ORDER-PROBE-DONE\n");
process.exitCode = misplaced.length === 0 && absent.length === 0 ? 0 : 1;
