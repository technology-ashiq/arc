#!/usr/bin/env node
/**
 * replay-child.mjs -- runs ONE candidate against fixture bodies, in its own process.
 *
 * The candidate is untrusted code. An adversarial pass proved why this separation exists:
 *
 *   - a candidate handed the whole fixture returned `flagged: fixture.expect === "flagged"`
 *     and scored 11 of 11 — it was given the answer key
 *   - another MUTATED `fixture.expect` before returning, and because the parent re-read that
 *     field after the call, the clean denominator vanished: `false-blocked 0 of 0`
 *   - another printed a byte-plausible replay report at import time and called
 *     `process.exit(0)`, so the report a human would paste into an evidence bundle was
 *     entirely candidate-authored
 *   - another appended every fixture's id, category and body to a file, defeating the
 *     holdout through the runner itself rather than by reading the directory
 *
 * So: this child receives ONLY frozen bodies, returns ONLY booleans, writes them ONLY to a
 * file path the parent chose, and never sees `expect`, `id` or `category`. Its stdout is
 * ignored by the parent. If it exits early, throws, or writes nothing parseable, the parent
 * treats the replay as failed rather than as a result.
 *
 * argv: <candidate-path> <bodies-json-path> <out-json-path>
 */

import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const [candidatePath, bodiesPath, outPath] = process.argv.slice(2);

const bodies = JSON.parse(readFileSync(bodiesPath, "utf8"));
const mod = await import(pathToFileURL(resolve(candidatePath)).href);
if (typeof mod.check !== "function") {
  writeFileSync(outPath, JSON.stringify({ error: "candidate exports no check(fixture) function" }), "utf8");
  process.exit(3);
}

const flags = [];
for (const body of bodies) {
  let flagged = false;
  try {
    // Frozen, and body-only. `check` is documented as pure: it reads the artifact it is
    // handed. It has no legitimate use for the label it is being graded against.
    const r = mod.check(Object.freeze({ body: String(body) }));
    flagged = !!(r && r.flagged);
  } catch {
    // A candidate that throws on an input has not flagged it. That is a real answer, not a
    // crash: a check that cannot read an artifact has not found the failure in it.
    flagged = false;
  }
  flags.push(flagged);
}

writeFileSync(outPath, JSON.stringify({ flags }), "utf8");
process.exit(0);
