#!/usr/bin/env node
// Test-only driver for the two export parsers. It exists so `ledger-parsers.bats` never has to
// embed a Node program inside a shell string: an apostrophe, a backtick or a dollar sign inside
// one of those closes the quoting and the shell runs the remainder, which has bitten this repo
// four separate times (see docs/retro-log.md, 2026-08-03 and 2026-08-12).
//
// usage: node tests/ledger-parse-runner.mjs <razorpay|mor> <file>
// Prints the parsed rows as JSON on success and exits 0; prints the error message and exits 1.
// It is deliberately dumb -- every assertion lives in the bats file, where it is readable.

import { readFileSync } from "node:fs";
// pathToFileURL, never `new URL("file://" + path)`: the hand-rolled form silently truncates at the
// first `#` or `?` in a path, so a checkout under a directory containing either would import a
// module that does not exist and report it as a parse failure.
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const parsersDir = join(here, "..", ".claude", "scripts", "hq", "lib", "ledger", "parsers");

const [provider, file] = process.argv.slice(2);
if (!provider || !file) {
  process.stderr.write("usage: ledger-parse-runner.mjs <razorpay|mor> <file>\n");
  process.exit(2);
}

// LOADING and READING are separated from PARSING, and they exit 2 rather than 1.
//
// The first cut wrapped all three in one try and reported everything as PARSE_ERROR + exit 1.
// That made "the parser refused this input" indistinguishable from "the file does not exist" and
// from "the parser module is gone" -- so a suite asserting `status -eq 1` over a glob of malformed
// fixtures stayed GREEN with the fixtures deleted, and green again with both parsers deleted.
// Found by the Phase-00 adversarial pass. A test that passes when the implementation is removed
// is a test of nothing.
let fn;
try {
  const mod = await import(pathToFileURL(join(parsersDir, provider + ".mjs")));
  fn = provider === "razorpay" ? mod.parseRazorpayExport : mod.parseMorExport;
  if (typeof fn !== "function") throw new Error(`parser ${provider} exports no callable entry point`);
} catch (err) {
  process.stderr.write(`LOAD_ERROR ${err && err.message ? err.message : String(err)}\n`);
  process.exit(2);
}

let text;
try {
  // Read as raw bytes then decode, so a BOM and CRLF reach the parser exactly as committed.
  text = readFileSync(file, "utf8");
} catch (err) {
  process.stderr.write(`READ_ERROR ${err && err.message ? err.message : String(err)}\n`);
  process.exit(2);
}

try {
  process.stdout.write(JSON.stringify(fn(text), null, 0) + "\n");
  process.exit(0);
} catch (err) {
  process.stderr.write(`PARSE_ERROR ${err && err.message ? err.message : String(err)}\n`);
  process.exit(1);
}
