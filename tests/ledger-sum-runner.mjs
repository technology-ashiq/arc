#!/usr/bin/env node
// Test-only driver: parse an export and print `rows=<n> net=<sum of net, minor units>`.
// A separate tiny script rather than a shell one-liner, because a Node program embedded in a
// shell string is how this repo broke four times (docs/retro-log.md).
//
// The sum is computed with integer addition over the parser's own integers -- if the parser ever
// started returning floats, this line would stop being an integer and the assertion would fail,
// which is deliberate.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const parsersDir = join(here, "..", ".claude", "scripts", "hq", "lib", "ledger", "parsers");

const [provider, file] = process.argv.slice(2);
if (!provider || !file) {
  process.stderr.write("usage: ledger-sum-runner.mjs <razorpay|mor> <file>\n");
  process.exit(2);
}

try {
  const mod = await import(new URL(`file://${join(parsersDir, provider + ".mjs").replace(/\\/g, "/")}`));
  const fn = provider === "razorpay" ? mod.parseRazorpayExport : mod.parseMorExport;
  const rows = fn(readFileSync(file, "utf8"));
  let net = 0;
  for (const r of rows) {
    if (!Number.isSafeInteger(r.net)) {
      process.stderr.write(`NON_INTEGER net ${JSON.stringify(r.net)} on ${r.provider_payment_id}\n`);
      process.exit(1);
    }
    net += r.net;
  }
  process.stdout.write(`rows=${rows.length} net=${net}\n`);
  process.exit(0);
} catch (err) {
  process.stderr.write(`PARSE_ERROR ${err && err.message ? err.message : String(err)}\n`);
  process.exit(1);
}
