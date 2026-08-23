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

import { readFileSync, writeFileSync, existsSync, mkdirSync, realpathSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
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

function run(repo, check, quiet = false) {
  const { want, have, dstPath } = tokenState(repo);
  if (have === want) {
    if (quiet) return 0;
    process.stdout.write(`face-tokens: face/src/tokens.css matches docs/design/system/tokens.css (${want.length} bytes)\n`);
    return 0;
  }
  if (check) {
    // Quiet for the selftest: its drift arms EXPECT this failure, and printing the gate's own
    // FAIL line inside a PASSING negative control puts the word "FAIL" into a transcript that
    // other checks read for exactly that word.
    if (!quiet)
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

  // The drift arm, on disk -- but in a TEMP TREE, never the live one.
  //
  // It used to corrupt `face/src/tokens.css` in place and restore it in a `finally`. Two
  // things wrong with that: a kill or a timeout between the two writes leaves a TRACKED file
  // holding the corruption, and when the copy was absent the restore did nothing at all, so
  // the selftest CREATED the drift it exists to detect, left it on disk, and exited 0. A
  // negative control that damages the repo to prove a point is not a control.
  const tmp = mkdtempSync(join(tmpdir(), "face-tokens-selftest-"));
  const tmpSrc = join(tmp, ...SRC);
  const tmpDst = join(tmp, ...DST);
  mkdirSync(dirname(tmpSrc), { recursive: true });
  mkdirSync(dirname(tmpDst), { recursive: true });
  writeFileSync(tmpSrc, readFileSync(join(repo, ...SRC), "utf8"));

  writeFileSync(tmpDst, want.replace("--accent", "--hand-edited-accent"));
  armed("a hand-edited copy exits 1", run(tmp, true, true) === 1);

  // A LENGTH-PRESERVING edit, because comparing by length instead of by content is a real
  // mutant and the previous arm could not tell the two apart: `--accent` -> `--acceNt` keeps
  // the byte count identical and must still be caught.
  writeFileSync(tmpDst, want.replace("--accent", "--acceNt"));
  armed("a length-preserving hand-edit exits 1", run(tmp, true, true) === 1);

  // An ABSENT copy is drift too, and this is the case the old in-place arm silently skipped.
  rmSync(tmpDst);
  armed("a missing copy exits 1", run(tmp, true, true) === 1);

  // A source that is not the token file must be REFUSED rather than copied over the app's
  // styles. The cheap version of this generator would happily blank the product.
  //
  // The old arm passed `join(repo, "docs")`, where the file simply does not exist -- so it
  // exercised `existsSync` and never the `--accent` shape check at all. A mutant that deleted
  // that check passed this arm AND replaced the app's entire stylesheet with 60 bytes of
  // junk. The source now EXISTS and is the wrong content, which is the case that matters.
  const wrongTree = mkdtempSync(join(tmpdir(), "face-tokens-wrong-"));
  mkdirSync(dirname(join(wrongTree, ...SRC)), { recursive: true });
  writeFileSync(join(wrongTree, ...SRC), "/* a stylesheet, but not THE stylesheet */\nbody { color: red; }\n");
  let refusedWrongContent = false;
  try { tokenState(wrongTree); } catch { refusedWrongContent = true; }
  armed("a source that EXISTS but is not the token file is refused", refusedWrongContent);

  let refusedAbsent = false;
  try { tokenState(join(repo, "docs")); } catch { refusedAbsent = true; }
  armed("an absent source is refused, not copied", refusedAbsent);

  rmSync(tmp, { recursive: true, force: true });
  rmSync(wrongTree, { recursive: true, force: true });

  for (const l of lines) process.stdout.write(l + "\n");
  process.stdout.write(`face-tokens selftest: ${ok ? "PASS -- the copy is marked, complete, and drift fails closed" : "FAIL"}\n`);
  return ok ? 0 : 1;
}

const KNOWN_FLAGS = ["--check", "--selftest"];

/**
 * Refuse an argument this gate does not know.
 *
 * `argv.includes("--check")` means every near-miss silently selects the WRITE path and exits
 * 0. An adversarial pass ran `--check=true`, `--Check`, `--checks` and `--dry-run` against a
 * drifted tree: each one repaired the drift and reported success. On `face-tokens` that
 * silently discarded a hand-edit to the app's entire stylesheet.
 *
 * It matters more than it looks. The only correct spellings in existence are the literals in
 * tests/*.bats -- any future hook, workflow line or pre-commit that types it slightly
 * differently gets a green light AND a mutated working tree. An unrecognised `--` argument is
 * exit 2: could not read the inputs, which is exactly what it is.
 *
 * @param {string[]} argv @param {string[]} known
 */
function refuseUnknownFlags(argv, known) {
  const bad = argv.filter((a) => a.startsWith("--") && !known.includes(a));
  if (bad.length) {
    process.stderr.write(`face-tokens: unknown flag(s) ${bad.join(", ")} -- known flags are ${known.join(", ")}. Refusing rather than silently taking the write path.
`);
    process.exit(2);
  }
}

if (isMainModule()) {
  const argv = process.argv.slice(2);
  refuseUnknownFlags(argv, KNOWN_FLAGS);
  const repo = argv.find((a) => !a.startsWith("--")) || REPO_DEFAULT;
  try {
    process.exit(argv.includes("--selftest") ? selftest(repo) : run(repo, argv.includes("--check")));
  } catch (err) {
    process.stderr.write(`face-tokens: ERROR -- ${err.message}\n`);
    process.exit(2);
  }
}
