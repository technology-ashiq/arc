#!/usr/bin/env node
// Test-only driver for the STRICT ventures.yaml reader (ADR-1008 / LED-I, ADR-1017 / LED-R).
//
// It exists so `ledger-ventures-parser.bats` never has to embed a Node program inside a shell
// string: an apostrophe, a backtick or a dollar sign inside one of those closes the quoting and the
// shell runs the remainder, which has bitten this repo four separate times (docs/retro-log.md,
// 2026-08-03 and 2026-08-12, the second time inside the comment explaining the first).
//
// usage:
//   node tests/ledger-ventures-runner.mjs digest <file>    the criteria digest, bare lowercase hex
//   node tests/ledger-ventures-runner.mjs canon  <file>    the exact string the digest is taken over
//   node tests/ledger-ventures-runner.mjs idem   <digest>  sha256("ledger.criteria|" + digest)
//
// `idem` is DERIVED here from canonical.mjs's own sha256Hex and never pinned as a literal in the
// suite. The weld it mirrors lives in validate-ledger.mjs: a criteria approval whose idem is not
// sha256("ledger.criteria|"+digest) is refused outright, so a hardcoded constant in the test would
// go stale silently the day either half of that preimage moves and every receipt test would then be
// asserting that a REJECTED emit produced no receipt.
//
// EXIT CODES ARE KEPT DISTINCT ON PURPOSE, and this is the control that makes every `status -eq 1`
// assertion in the suite mean something:
//
//   0  ok
//   1  REFUSED <code>    the parser ran and refused the document -- and ONLY this
//   2  READ_ERROR        the file could not be read
//   3  LOAD_ERROR        the module under test could not be imported
//   4  INTERNAL <name>   a throw that is not a SpineError, so a TypeError inside the parser can
//                        never masquerade as a considered refusal
//   5  USAGE
//
// The sibling runner for the export parsers learned this the hard way: with load, read and parse
// wrapped in one try that reported everything as exit 1, a suite asserting `status -eq 1` over a
// glob of malformed fixtures stayed GREEN with the fixtures deleted, and green again with both
// parsers deleted (found by the Phase-00 adversarial pass).
//
// The module is resolved through ARC_VENTURES_MODULE when that is set. That door exists for exactly
// one test -- the one that points it at a path with no module behind it and proves LOAD_ERROR is
// reachable and distinct. Without a reachable LOAD_ERROR, "the implementation is gone" is a claim
// the suite makes and never checks.

import { readFileSync } from "node:fs";
// pathToFileURL, never `new URL("file://" + path)`: the hand-rolled form silently truncates at the
// first `#` or `?` in a path, so a checkout under a directory containing either would import a
// module that does not exist and report it as a parse failure.
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const hqLib = join(here, "..", ".claude", "scripts", "hq", "lib");
const venturesModule = process.env.ARC_VENTURES_MODULE
  ? resolve(process.env.ARC_VENTURES_MODULE)
  : join(hqLib, "ledger", "ventures.mjs");
const canonicalModule = join(hqLib, "canonical.mjs");

const [mode, arg] = process.argv.slice(2);
if (!mode || !arg || !["digest", "canon", "idem"].includes(mode)) {
  process.stderr.write("USAGE ledger-ventures-runner.mjs <digest|canon|idem> <file|digest>\n");
  process.exit(5);
}

// LOADING is separated from PARSING and exits 3, and both imports are DYNAMIC for that reason: a
// static `import` of a missing module fails at module-evaluation time, outside any try, and node
// exits 1 with a stack trace -- byte-indistinguishable from this runner reporting a refusal.
let parseVentures, canonicalVentures, sha256Hex;
try {
  const canonical = await import(pathToFileURL(canonicalModule).href);
  sha256Hex = canonical.sha256Hex;
  if (typeof sha256Hex !== "function") throw new Error("canonical.mjs exports no sha256Hex");
} catch (err) {
  process.stderr.write(`LOAD_ERROR canonical.mjs -- ${err && err.message ? err.message : String(err)}\n`);
  process.exit(3);
}

if (mode === "idem") {
  // No file, no parser: the suite already holds a digest and wants the key the emit path will
  // demand for it. Validated as a lowercase sha256 hex here so a caller that passed a filename by
  // mistake gets a usage error rather than a plausible-looking key for the string "ventures.yaml".
  if (!/^[0-9a-f]{64}$/.test(arg)) {
    process.stderr.write(`USAGE idem takes a lowercase sha256 hex digest, got ${JSON.stringify(arg)}\n`);
    process.exit(5);
  }
  process.stdout.write(sha256Hex(`ledger.criteria|${arg}`) + "\n");
  process.exit(0);
}

try {
  const mod = await import(pathToFileURL(venturesModule).href);
  parseVentures = mod.parseVentures;
  canonicalVentures = mod.canonicalVentures;
  if (typeof parseVentures !== "function") throw new Error("ventures module exports no parseVentures");
  if (typeof canonicalVentures !== "function") throw new Error("ventures module exports no canonicalVentures");
} catch (err) {
  process.stderr.write(`LOAD_ERROR ${venturesModule} -- ${err && err.message ? err.message : String(err)}\n`);
  process.exit(3);
}

let text;
try {
  // "utf8" and not a Buffer: node does NOT strip a BOM here, so the leading U+FEFF reaches the
  // parser exactly as committed -- which is the whole point of the crlf-bom fixture.
  text = readFileSync(arg, "utf8");
} catch (err) {
  process.stderr.write(`READ_ERROR ${err && err.message ? err.message : String(err)}\n`);
  process.exit(2);
}

try {
  const parsed = parseVentures(text);
  process.stdout.write((mode === "canon" ? canonicalVentures(parsed) : parsed.digest) + "\n");
  process.exit(0);
} catch (err) {
  // Duck-typed on name + code rather than `instanceof SpineError`. ARC_VENTURES_MODULE can resolve a
  // module that imported its own copy of canonical.mjs, and two copies of a class are not the same
  // class -- an instanceof check there would report every genuine refusal as INTERNAL.
  const code = err && err.name === "SpineError" && typeof err.code === "string" ? err.code : null;
  if (code === null) {
    process.stderr.write(`INTERNAL ${err && err.name ? err.name : "Error"} -- ${err && err.message ? err.message : String(err)}\n`);
    process.exit(4);
  }
  process.stderr.write(`REFUSED ${code}: ${err.message}\n`);
  process.exit(1);
}
