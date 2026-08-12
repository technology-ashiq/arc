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
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const parsersDir = join(here, "..", ".claude", "scripts", "hq", "lib", "ledger", "parsers");

const [provider, file] = process.argv.slice(2);
if (!provider || !file) {
  process.stderr.write("usage: ledger-parse-runner.mjs <razorpay|mor> <file>\n");
  process.exit(2);
}

try {
  const mod = await import(new URL(`file://${join(parsersDir, provider + ".mjs").replace(/\\/g, "/")}`));
  const fn = provider === "razorpay" ? mod.parseRazorpayExport : mod.parseMorExport;
  if (typeof fn !== "function") {
    process.stderr.write(`parser ${provider} exports no callable entry point\n`);
    process.exit(2);
  }
  // Read as raw bytes then decode, so a BOM and CRLF reach the parser exactly as committed.
  const text = readFileSync(file, "utf8");
  process.stdout.write(JSON.stringify(fn(text), null, 0) + "\n");
  process.exit(0);
} catch (err) {
  process.stderr.write(`PARSE_ERROR ${err && err.message ? err.message : String(err)}\n`);
  process.exit(1);
}
