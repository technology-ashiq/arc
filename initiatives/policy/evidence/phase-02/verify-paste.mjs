#!/usr/bin/env node
// verify-paste.mjs -- the Phase 02 owner paste, checked on both sides of the copy. Read-only.
//
//   node initiatives/policy/evidence/phase-02/verify-paste.mjs --pre   BEFORE copying: every live file must still be
//                                                                     the one the paste was generated from (exit 1 names
//                                                                     any that drifted -- copying would revert that change)
//   node initiatives/policy/evidence/phase-02/verify-paste.mjs         AFTER copying: every live file is the paste
//
// Hashes fold CRLF to LF, so an autocrlf checkout reads the same as an LF one (attack p02 B6).
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const pre = process.argv.includes("--pre");
const sha = (s) => createHash("sha256").update(s.replace(/\r\n/g, "\n")).digest("hex");
const manifest = JSON.parse(readFileSync("initiatives/policy/evidence/phase-02/paste-manifest.json", "utf8"));
let bad = 0;
for (const [rel, m] of Object.entries(manifest)) {
  let live = null;
  try { live = sha(readFileSync(rel, "utf8")); } catch { /* reported below */ }
  const state = live === m.paste ? "APPLIED " : live === m.live_before ? "NOT YET " : "DIFFERS ";
  // Before the copy, only NOT YET is safe. APPLIED is harmless; DIFFERS means the live file moved since generation.
  if (pre ? state === "DIFFERS " : live !== m.paste) bad++;
  console.log(`${state} ${rel}  live=${live ? live.slice(0, 12) : "missing"} paste=${m.paste.slice(0, 12)}`);
}
if (pre) console.log(bad === 0 ? "verify-paste --pre: no live file drifted -- safe to copy" : `verify-paste --pre: ${bad} live file(s) changed since the paste was generated -- DO NOT copy; regenerate first`);
else console.log(bad === 0 ? "verify-paste: every file is byte-identical to the paste" : `verify-paste: ${bad} file(s) not applied as generated`);
process.exitCode = bad === 0 ? 0 : 1;
