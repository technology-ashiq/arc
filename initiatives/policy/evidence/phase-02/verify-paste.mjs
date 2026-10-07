#!/usr/bin/env node
// verify-paste.mjs -- after the owner copies the Phase 02 paste into place, prove every live file is byte-identical to
// the generated one (sha256), and say which are not. Read-only.
//
//   node initiatives/policy/evidence/phase-02/verify-paste.mjs        (from the repo root)   exit 0 all match · 1 not
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const manifest = JSON.parse(readFileSync("initiatives/policy/evidence/phase-02/paste-manifest.json", "utf8"));
let bad = 0;
for (const [rel, m] of Object.entries(manifest)) {
  let live = null;
  try { live = createHash("sha256").update(readFileSync(rel, "utf8")).digest("hex"); } catch { /* reported below */ }
  const state = live === m.paste ? "APPLIED " : live === m.live_before ? "NOT YET " : "DIFFERS ";
  if (live !== m.paste) bad++;
  console.log(`${state} ${rel}  live=${live ? live.slice(0, 12) : "missing"} paste=${m.paste.slice(0, 12)}`);
}
console.log(bad === 0 ? "verify-paste: every file is byte-identical to the paste" : `verify-paste: ${bad} file(s) not applied as generated`);
process.exitCode = bad === 0 ? 0 : 1;
