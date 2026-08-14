#!/usr/bin/env node
// Stamps a unique marker into a copied mock recording so a test can prove WHICH copy was read.
//
// The point is discrimination. A work-root test that copies arc's own recordings and asserts the
// run succeeded passes just as well when the flag is ignored, because arc still has them. Mutating
// the copy means the marker can only come back from the work-root, so the assertion fails the
// moment --work-root stops reaching the driver.
//
// Its own file rather than an embedded program: the repo rule is that a program inside a shell
// string carries no apostrophes, single quotes, backticks or dollar signs.
//
// usage: mark-recording.mjs <recordingsDir> <marker>
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [dir, marker] = process.argv.slice(2);
if (!dir || !marker) { process.stderr.write("usage: mark-recording.mjs <recordingsDir> <marker>\n"); process.exit(2); }

const file = join(dir, "commit-msg-draft", "default.json");
const doc = JSON.parse(readFileSync(file, "utf8"));

// The recording may store the document directly or under `output`; handle both rather than
// assuming, because an unmarked fixture is a silent pass generator.
const out = doc.output ?? doc;
if (!out.commits || !out.commits.length) {
  process.stderr.write(`mark-recording: ${file} has no commits[] to mark -- the test would prove nothing\n`);
  process.exit(1);
}
out.commits[0].subject = marker;
writeFileSync(file, JSON.stringify(doc));

// Assert the marker is actually on disk before returning success. A fixture builder that reports
// success without verifying its own output is how empty fixtures produce green tests.
if (!readFileSync(file, "utf8").includes(marker)) {
  process.stderr.write("mark-recording: the marker did not reach the file\n");
  process.exit(1);
}
