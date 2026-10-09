#!/usr/bin/env node
// The owner's one apply for launch REQ-10 (ADR-1750): adds the `process:launch-watch` subject to hq.policy.yaml, which is
// on the deny floor, so the agent cannot write it. Idempotent: a second run changes nothing. It inserts the block after
// `process:day-close-roll` and prints what it did; jobs-lint is the check that follows.
//   node .claude/scripts/launch/owner-apply-watch-policy.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const FILE = join(resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", ".."), "hq.policy.yaml");
const ANCHOR = "  \"process:build-in-public-draft\":\n";
const BLOCK = [
  "  # launch REQ-10 (ADR-1750): the weekly watch shells out to arc-launch verify --public-only, which asks the venture's",
  "  # public endpoints (network) and writes the board's last_verify and the watch stamp under .claude/state/.",
  "  \"process:launch-watch\":",
  "    e2: []",
  "    read: { level: L3 }",
  "    write: { level: L2, roots: [\".claude/state/launch/**\", \".claude/state/hq/**\"] }",
  "    shell: { level: L1, evidence_days: 35 }",
  "    network: { level: L1 }",
  "    message: { level: L0 }",
  "    publish: { level: L0 }",
  "    deploy: { level: L0 }",
  "    spend: { level: L0 }",
  "",
  "",
].join("\n");

const text = readFileSync(FILE, "utf8");
if (text.includes("\"process:launch-watch\":")) { console.log("hq.policy.yaml already holds process:launch-watch -- nothing changed"); process.exit(0); }
if (!text.includes(ANCHOR)) { console.log("hq.policy.yaml has no process:build-in-public-draft anchor -- nothing changed; add the block by hand"); process.exit(2); }
writeFileSync(FILE, text.replace(ANCHOR, BLOCK + ANCHOR));
console.log("hq.policy.yaml: process:launch-watch added (network L1, writes under .claude/state only)");
