#!/usr/bin/env node
// Reads ONE field off the last run.completed (or a named kind) in a spine directory.
//
// WHY THIS IS A FILE AND NOT A `node -e` INSIDE THE BATS SUITE: the repo rule is that a program
// embedded in a shell string carries no apostrophes, single quotes, backticks or dollar signs,
// and the moment it wants any of them it belongs in its own file. This one wants several.
//
// WHY IT PARSES INSTEAD OF GREPPING: a sealed event carries `model` TWICE -- the top-level MP-F
// seat and a copy inside the payload -- and a grep with `tail -1` silently returns the payload
// every time, because canonical key order puts the seat first. A suite written to assert that the
// seat stays a clean model id was therefore reading the one field it was not testing, and would
// have passed against the exact implementation its own ADR amendment rejected.
//
// usage: read-receipt.mjs <spineRoot> <seat|payload|kindcount> [field|kind]
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const [spineRoot, what, arg] = process.argv.slice(2);
const dir = join(spineRoot, "events");

let files = [];
try { files = readdirSync(dir).filter((n) => n.endsWith(".jsonl")); } catch { files = []; }

// No day is derived. The spine names its files from an IST timestamp; deriving that a second time
// here is the defect this lane already shipped once, so every day file is read instead.
const events = [];
for (const n of files.sort()) {
  let text = "";
  try { text = readFileSync(join(dir, n), "utf8"); } catch { continue; }
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    try { events.push(JSON.parse(line)); } catch { /* a non-JSON line is not an event */ }
  }
}

if (what === "kindcount") {
  process.stdout.write(String(events.filter((e) => e.kind === arg).length));
  process.exit(0);
}

const runs = events.filter((e) => e.kind === "run.completed");
const last = runs.length ? runs[runs.length - 1] : null;
if (!last) { process.stdout.write("NO-RECEIPT"); process.exit(0); }

// `seat` reads the TOP-LEVEL model field (the MP-F seat). `payload` reads inside the payload.
// Keeping them separately addressable is the entire point of this helper.
const v = what === "seat" ? last.model : last.payload?.[arg];
process.stdout.write(v === undefined ? "ABSENT" : v === null ? "NULL" : String(v));
