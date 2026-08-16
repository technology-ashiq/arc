#!/usr/bin/env node
/**
 * tests/embedded-program-probe.mjs -- the automated half of the embedded-program rule.
 *
 * THE RULE, from CLAUDE.md: a program embedded in a shell string carries no apostrophes and no
 * single quotes, in code OR in comments. One apostrophe closes the single-quoted string and the
 * shell expands the rest.
 *
 * THE RULE ALSO SAYS HOW IT MUST BE ENFORCED: "by a grep check ... NEVER BY VIGILANCE, because
 * this rule was written down and then broken three times anyway." It has now been broken five
 * times, twice inside the comment explaining a previous break, and the check it names had never
 * been written. This file is that check.
 *
 * WHY NOT LITERALLY GREP, and why not counting quotes. A shell script carries apostrophes
 * legitimately -- in comments, and in the `'"'"'` idiom that embeds a literal quote inside a
 * single-quoted string. A global count of quotes therefore says "unterminated" about twelve
 * perfectly valid scripts, which was this probe's own first draft and is a check that cries
 * wolf until it is ignored. So it ANCHORS on the construct that is actually at risk -- `node -e`
 * and friends -- walks to the true end of that one quoted region, and asks the JavaScript parser
 * whether what it found is a whole program. A stray apostrophe truncates the region, and a
 * truncated program does not parse. That is a decision rather than a heuristic.
 *
 * It catches the case `bash -n` misses: a break that leaves the SHELL syntax valid while the
 * embedded program is silently cut in half.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const Q = String.fromCharCode(39);       // apostrophe
const ESCAPED = `${Q}"${Q}"${Q}`;        // the '"'" idiom: close, literal quote, reopen

// The constructs that put a program inside a single-quoted shell string.
const ANCHORS = [`node -e ${Q}`, `node --eval ${Q}`, `python -c ${Q}`, `python3 -c ${Q}`];

function shellScripts(root) {
  const out = [];
  const walk = (d) => {
    let entries;
    try { entries = readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries.sort((a, b) => (a.name < b.name ? -1 : 1))) {
      if (e.name === "node_modules" || e.name === ".git") continue;
      const p = join(d, e.name);
      if (e.isDirectory()) { walk(p); continue; }
      if (e.isFile() && e.name.endsWith(".sh")) out.push(p);
    }
  };
  try { if (statSync(root).isDirectory()) walk(root); else out.push(root); } catch { /* nothing */ }
  return out;
}

/** From just after an opening quote, return [region, endIndex] honouring the '"'" idiom. */
function readRegion(src, from) {
  let i = from;
  let region = "";
  while (i < src.length) {
    const q = src.indexOf(Q, i);
    if (q < 0) return [region + src.slice(i), -1];      // unterminated
    region += src.slice(i, q);
    if (src.startsWith(ESCAPED, q)) { region += Q; i = q + ESCAPED.length; continue; }
    return [region, q];
  }
  return [region, -1];
}

const failures = [];
let scanned = 0;
let programs = 0;

const roots = process.argv.slice(2);
for (const file of roots.flatMap((r) => shellScripts(r))) {
  scanned += 1;
  const src = readFileSync(file, "utf8");

  for (const anchor of ANCHORS) {
    let at = 0;
    for (;;) {
      const found = src.indexOf(anchor, at);
      if (found < 0) break;
      const start = found + anchor.length;
      const [region, end] = readRegion(src, start);
      at = end < 0 ? src.length : end + 1;
      programs += 1;
      const line = src.slice(0, found).split("\n").length;
      if (end < 0) {
        failures.push(`${file}:${line}: the embedded program is never closed`);
        continue;
      }
      // WHAT FOLLOWS THE CLOSING QUOTE IS THE REAL SIGNAL, and parsing alone is not enough.
      // When an apostrophe inside the program closes the string early, the region often still
      // PARSES -- an unterminated line comment is valid JavaScript, so `// this comment doesn`
      // is a whole program as far as the parser is concerned. The first draft of this probe
      // reported a deliberately broken fixture INTACT for exactly that reason, which is a check
      // that lies rather than a check that misses.
      //
      // A genuine closing quote is followed by shell: whitespace, a redirection, a pipe, an
      // argument, end of line. An accidental one is followed by the rest of an English word.
      const after = src.slice(end + 1, end + 2);
      if (after && !/[\s;)|&<>"$]/.test(after)) {
        failures.push(`${file}:${line}: the quoted program ends at an apostrophe followed by ${JSON.stringify(after)} — the string closed early, mid-word`);
        continue;
      }
      if (anchor.includes("python")) continue;   // no parser for it here; the close is the check
      try {
        // eslint-disable-next-line no-new-func
        new Function(region);
      } catch (e) {
        failures.push(`${file}:${line}: the embedded program does not parse (${e.message.split("\n")[0]})`);
      }
    }
  }
}

console.log(`scanned=${scanned}`);
console.log(`programs=${programs}`);
console.log(`failures=${failures.length}`);
for (const f of failures) console.log(`FAIL ${f}`);
// Printed LAST and only on the success path, so a probe that died partway cannot be mistaken
// for one that ran and found nothing.
if (!failures.length) console.log("EMBEDDED_PROGRAMS_INTACT");
process.exit(failures.length ? 1 : 0);
