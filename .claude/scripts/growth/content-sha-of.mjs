#!/usr/bin/env node
// content-sha-of <file> -- print the `content.published.content_sha` for one file.
//
// This exists as a FILE rather than as a `node -e` line in the runbook for two reasons, and the
// second is the important one.
//
// The shallow reason: the program needs quotes, and CLAUDE.md is explicit that a program embedded
// in a shell string carries no apostrophes, no single quotes, and inside a double-quoted string no
// backticks and no `$`. The first draft of the runbook step dodged that with a wall of
// String.fromCharCode, which is unreadable and therefore unreviewable -- nobody checks a hash
// command they cannot read, which defeats the point of writing the step down at all.
//
// The real reason: it calls `contentShaOfFile`, THE definition (ADR-1101). A hasher typed inline
// in a runbook is a SECOND implementation of the value the receipt is keyed on, and this exact
// class already bit us -- the draft path and the publish path were two different functions across
// a BOM, found 2026-08-16. A runbook that computes the sha its own way would be a third.
//
// Raw bytes, no decode, no BOM strip, no line-ending normalisation. `arc-site` pins eol=lf so a
// checkout on any OS produces the same bytes; before that pin, this command answered differently
// on Windows than on the Linux build host.

import { contentShaOfFile } from "./lib/content-sha.mjs";

const path = process.argv[2];
if (!path) {
  process.stderr.write("usage: content-sha-of <file>\n");
  process.exit(2);
}

try {
  process.stdout.write(`${await contentShaOfFile(path)}\n`);
} catch (e) {
  // Named loudly. A sha printed for a file that could not be read is the worst possible output
  // here, because it would be copied into a receipt that cannot be edited afterwards.
  process.stderr.write(`content-sha-of: cannot read ${path}: ${e.message}\n`);
  process.exit(2);
}
