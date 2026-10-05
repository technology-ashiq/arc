#!/usr/bin/env node
// arc discover -- turn a niche into a scored, evidenced, deduped shortlist (ADR-1900..1912).
//
//   arc-discover hunt NICHE
//
// Phase 00 is the product's birth only: every verb refuses until Phase 01 builds the pipeline, so
// `/arc-hunt` can exist in the face and the wiki without pretending to work.
//
// Exit: 2 refused (not built yet).
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

export function main() {
  process.stderr.write("arc-discover: not built yet — Phase 01\n");
  return 2;
}

const invoked = process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
if (invoked) process.exitCode = main(process.argv.slice(2));
