#!/usr/bin/env node
// Test-only driver: parse an export, normalize its rows to Appendix A payloads, and print them.
//
// usage: ledger-normalize-runner.mjs <razorpay|mor> <file> <venture> [--payload-only]
//
// Default output is one JSON object per row, `{payload, ts}`, so a test can assert on the IST
// conversion. With --payload-only it prints ONLY the first row's payload, which is what
// `arc-event ingest --json` expects on stdin-as-a-file -- that path is exercised so the chain
// from a real file to an accepted receipt is proven end to end rather than assumed.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const libDir = join(here, "..", ".claude", "scripts", "hq", "lib", "ledger");
const url = (p) => new URL(`file://${p.replace(/\\/g, "/")}`);

const [provider, file, venture, ...rest] = process.argv.slice(2);
if (!provider || !file || !venture) {
  process.stderr.write("usage: ledger-normalize-runner.mjs <razorpay|mor> <file> <venture> [--payload-only]\n");
  process.exit(2);
}
const payloadOnly = rest.includes("--payload-only");

try {
  const parsers = await import(url(join(libDir, "parsers", provider + ".mjs")));
  const { normalizeRows } = await import(url(join(libDir, "normalize.mjs")));
  const parse = provider === "razorpay" ? parsers.parseRazorpayExport : parsers.parseMorExport;

  const rows = parse(readFileSync(file, "utf8"));
  const normalized = normalizeRows(rows, { venture });

  if (payloadOnly) {
    process.stdout.write(JSON.stringify(normalized[0].payload));
  } else {
    for (const n of normalized) process.stdout.write(JSON.stringify(n) + "\n");
  }
  process.exit(0);
} catch (err) {
  process.stderr.write(`NORMALIZE_ERROR ${err && err.message ? err.message : String(err)}\n`);
  process.exit(1);
}
