#!/usr/bin/env node
// face-tokens -- copy the canonical design tokens into the L3 app, and hold the copy honest.
//
// docs/design/system/tokens.css is the SOURCE OF TRUTH (ADR-1308). face/src/tokens.css is a
// copy of it. A copy rather than a symlink for two reasons that both bite: a symlink does not
// survive the repo split ADR-1316 keeps reachable, and Git Bash on the Windows CI leg does
// not resolve one the way the other two legs do.
//
// A copy with no gate is drift with extra steps, so `--check` turns a hand-edit or a stale
// copy into a named CI failure -- the same posture as face-sections.
//
//   face-tokens.mjs [repo-root] [--check]
//
// Exit: 0 in sync / written | 1 drift (with --check) | 2 could not read the inputs.

import { readFileSync, writeFileSync, existsSync, mkdirSync, realpathSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

/** "Was this file RUN, or imported?" -- realpath BOTH sides; the endsWith form no-ops behind a symlink. */
function isMainModule() {
  try {
    const invoked = process.argv[1];
    if (!invoked) return false;
    return realpathSync(invoked) === realpathSync(fileURLToPath(import.meta.url));
  } catch { return false; }
}

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_DEFAULT = join(HERE, "..", "..", "..");

const SRC = ["docs", "design", "system", "tokens.css"];
const DST = ["face", "src", "tokens.css"];

const BANNER = `/* GENERATED FILE -- do not edit.
   Copied from docs/design/system/tokens.css by .claude/scripts/core/face-tokens.mjs.
   That file is the source of truth (ADR-1308); this one is a copy so the L3 tree stays
   split-able (ADR-1316) and resolvable on the Windows CI leg. Edit the source, then run
   the generator. \`--check\` fails CI on any drift, including a hand-edit here. */
`;

/** @returns {{ want: string, have: string | null, srcPath: string, dstPath: string }} */
export function tokenState(repo) {
  const srcPath = join(repo, ...SRC);
  const dstPath = join(repo, ...DST);
  if (!existsSync(srcPath)) throw new Error(`tokens source not found at ${srcPath}`);
  const source = readFileSync(srcPath, "utf8");
  if (!source.includes("--accent")) throw new Error(`${srcPath} does not look like the token file (no --accent) -- refusing to copy something else over the app's tokens`);
  return {
    want: BANNER + source,
    have: existsSync(dstPath) ? readFileSync(dstPath, "utf8") : null,
    srcPath,
    dstPath,
  };
}

function run(repo, check) {
  const { want, have, dstPath } = tokenState(repo);
  if (have === want) {
    process.stdout.write(`face-tokens: face/src/tokens.css matches docs/design/system/tokens.css (${want.length} bytes)\n`);
    return 0;
  }
  if (check) {
    process.stderr.write(`FAIL  [face-tokens-drift] face/src/tokens.css is ${have === null ? "missing" : "not a copy of"} docs/design/system/tokens.css -- run face-tokens.mjs (never hand-edit the copy)\n`);
    return 1;
  }
  mkdirSync(dirname(dstPath), { recursive: true });
  writeFileSync(dstPath, want);
  process.stdout.write(`face-tokens: wrote face/src/tokens.css (${want.length} bytes)\n`);
  return 0;
}

/** The negative control: a generator whose drift gate cannot be shown to FAIL is decoration. */
function selftest(repo) {
  const { want } = tokenState(repo);
  const lines = [];
  let ok = true;

  const armed = (label, cond, detail = "") => {
    if (!cond) ok = false;
    lines.push(`${label.padEnd(38)} ${cond ? "PASS" : `FAIL ${detail}`}`);
  };

  armed("banner marks the file GENERATED", want.startsWith("/* GENERATED FILE"));
  armed("copy carries the reserved-hue tokens", want.includes("--amber") && want.includes("--green") && want.includes("--violet"));
  armed("copy carries the product accent", want.includes("--accent"));

  // The drift arm, on disk: write a corrupted copy, assert --check exits 1, restore.
  const dstPath = join(repo, ...DST);
  const before = existsSync(dstPath) ? readFileSync(dstPath, "utf8") : null;
  let driftExit = null;
  try {
    writeFileSync(dstPath, (before ?? want).replace("--accent", "--hand-edited-accent"));
    driftExit = run(repo, true);
  } finally {
    if (before !== null) writeFileSync(dstPath, before);
  }
  armed("a hand-edited copy exits 1", driftExit === 1, `got ${driftExit}`);

  // A source that is not the token file must be REFUSED rather than copied over the app's
  // styles. The cheap version of this generator would happily blank the product.
  let refused = false;
  try { tokenState(join(repo, "docs")); } catch { refused = true; }
  armed("a wrong repo root is refused, not copied", refused);

  for (const l of lines) process.stdout.write(l + "\n");
  process.stdout.write(`face-tokens selftest: ${ok ? "PASS -- the copy is marked, complete, and drift fails closed" : "FAIL"}\n`);
  return ok ? 0 : 1;
}

if (isMainModule()) {
  const argv = process.argv.slice(2);
  const repo = argv.find((a) => !a.startsWith("--")) || REPO_DEFAULT;
  try {
    process.exit(argv.includes("--selftest") ? selftest(repo) : run(repo, argv.includes("--check")));
  } catch (err) {
    process.stderr.write(`face-tokens: ERROR -- ${err.message}\n`);
    process.exit(2);
  }
}
