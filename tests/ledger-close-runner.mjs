#!/usr/bin/env node
// Test-only driver for `tests/ledger-close.bats` (Phase 02, REQ-05 / REQ-06).
//
// It exists for the reason `ledger-ventures-runner.mjs` and `ledger-kill-runner.mjs` exist: a Node
// program embedded inside a shell string has broken this repo four separate times
// (docs/retro-log.md, 2026-08-03 and 2026-08-12, the second time inside the comment explaining the
// first). One apostrophe closes the quoting and the shell runs the remainder; one backtick opens a
// command substitution. The moment the embedded program wants any of those characters it belongs
// in a file, and both things this driver computes want them.
//
// usage:
//   ledger-close-runner.mjs idem <YYYY-MM>              sha256("month.closed|" + month)
//   ledger-close-runner.mjs sums <a-minor> <b-minor> <currency>
//
// `idem` IS DERIVED, NEVER PINNED. `assertMonthClosed` welds a close receipt to
// sha256("month.closed|"+month), so a hardcoded constant in the suite would go stale silently the
// day either half of that preimage moves -- and every receipt test would then be asserting that a
// REJECTED emit produced no receipt, which is exactly the shape retro 2026-08-02 records. It comes
// out of `canonical.mjs`s own `sha256Hex`, i.e. out of the code under test.
//
// `sums` EXISTS FOR AN ABSENCE ASSERTION, which is the one kind that must never be written by hand.
// REQ-06 says a mixed-source month renders two labelled subtotals and no combined total, so the
// suite has to name the number that must NOT appear. Formatting it here with `money.mjs`s own
// `formatMinorUnits` means the forbidden string is the string that renderer would actually print --
// a literal typed into the suite would stop matching the day the grouping or the exponent changed,
// and the test would then pass by looking for something nobody prints.
//
// EXIT CODES ARE KEPT DISTINCT, and that is what makes every status assertion in the suite mean
// something:
//
//   0  ok
//   3  LOAD_ERROR   a module under test could not be imported -- never confusable with a refusal
//   5  USAGE        bad arguments
//
// There is deliberately no exit 1 here: neither mode has a "refused" outcome to report. A driver
// that reserved one would invite a suite to assert on it and stay green over a deleted module.

import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const hqLib = join(here, "..", ".claude", "scripts", "hq", "lib");
const canonicalModule = join(hqLib, "canonical.mjs");
const moneyModule = join(hqLib, "ledger", "money.mjs");

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const INT_RE = /^(0|[1-9]\d*)$/;

function usage(why) {
  process.stderr.write(`USAGE ${why}\n`);
  process.stderr.write("usage: ledger-close-runner.mjs idem <YYYY-MM>\n");
  process.stderr.write("       ledger-close-runner.mjs sums <a-minor> <b-minor> <currency>\n");
  process.exit(5);
}

// DYNAMIC imports, and load failure is its own exit code. A static `import` of a missing module
// fails at module-evaluation time, outside any try, and node exits 1 with a stack trace -- which is
// byte-indistinguishable from this driver reporting anything else.
async function load(path, names) {
  try {
    const mod = await import(pathToFileURL(path).href);
    for (const n of names)
      if (typeof mod[n] !== "function") throw new Error(`exports no ${n}`);
    return mod;
  } catch (err) {
    process.stderr.write(`LOAD_ERROR ${path} -- ${err && err.message ? err.message : String(err)}\n`);
    process.exit(3);
  }
}

const argv = process.argv.slice(2);
const mode = argv[0];

if (mode === "idem") {
  const month = argv[1];
  if (month === undefined) usage("idem needs a <YYYY-MM>");
  // Validated here so a caller that passed a file path by mistake gets a usage error rather than a
  // plausible-looking 64-hex key for a string that is not a month.
  if (!MONTH_RE.test(month)) usage(`idem takes a YYYY-MM month, got ${JSON.stringify(month)}`);
  const { sha256Hex } = await load(canonicalModule, ["sha256Hex"]);
  process.stdout.write(sha256Hex(`month.closed|${month}`) + "\n");
  process.exit(0);
}

if (mode === "sums") {
  const [, aText, bText, currency] = argv;
  if (aText === undefined || bText === undefined || currency === undefined)
    usage("sums needs <a-minor> <b-minor> <currency>");
  for (const [label, text] of [["a-minor", aText], ["b-minor", bText]])
    if (!INT_RE.test(text)) usage(`${label} must be a non-negative integer of minor units, got ${JSON.stringify(text)}`);
  const { formatMinorUnits } = await load(moneyModule, ["formatMinorUnits"]);
  const a = Number(aText);
  const b = Number(bText);
  let out;
  try {
    out =
      `A=${formatMinorUnits(a, currency)}\n` +
      `B=${formatMinorUnits(b, currency)}\n` +
      `SUM=${formatMinorUnits(a + b, currency)}\n` +
      `SUM_MINOR=${a + b}\n`;
  } catch (err) {
    // A currency with no pinned minor-unit exponent is a fixture mistake, not a refusal worth its
    // own code: report it as usage so it can never be read as "the renderer refused".
    usage(`sums cannot format ${JSON.stringify(currency)} -- ${err && err.message ? err.message : String(err)}`);
  }
  process.stdout.write(out);
  // Written LAST and only after every field. Without it a truncated answer whose first line
  // happened to be right would satisfy a suite that read only field A.
  process.stdout.write("SUMS_OK\n");
  process.exit(0);
}

usage(`unknown mode ${JSON.stringify(mode)}`);
