#!/usr/bin/env node
// fail-claude-cli.mjs -- a claude CLI that always fails, for ARC_CLAUDE_CLI (model-policy v2, ADR-1802).
//
// It records that it RAN, and the argv it was given, so a suite can prove two opposite things: that a fallback chain's
// first attempt really started on claude-code with the tier's pin, and that a preflight refusal started nothing at all.
import { appendFileSync } from "node:fs";

const mark = process.env.ARC_TEST_CLI_MARK;
if (mark) appendFileSync(mark, `RAN ${JSON.stringify(process.argv.slice(2))}\n`);
process.stderr.write("fail-claude-cli: deliberate failure so the run falls back\n");
process.exit(1);
