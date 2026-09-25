#!/usr/bin/env node
/**
 * tests/memory-session-probe.mjs -- the Node half of the memory-ring session arms in tests/engine-process-lint.bats
 * (face Phase 06 slice 04): lesson-log and rule-promote, as the CLI and the door will meet them.
 *
 *   node tests/memory-session-probe.mjs checks   grants, door rows, bodies
 *   node tests/memory-session-probe.mjs gate     the policy gate a live click crosses, for both
 *
 * One `ok` / `FAIL` line per check, then `PROBE <mode>: <n> checks, <f> failed`. Exit 1 on any failure.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseYamlSubset } from "../.claude/scripts/engine/yaml-subset.mjs";
import { dispatchToolArgs } from "../.claude/scripts/engine/adapters/claude-code.mjs";
import { authorizeRun } from "../.claude/scripts/hq/lib/policy/run-gate.mjs";
import { sessionById } from "../.claude/scripts/hq/face-sessions.mjs";
import { ONE_LINE_SRC } from "../.claude/scripts/core/one-line.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const load = (name) => {
  const p = parseYamlSubset(readFileSync(join(ROOT, "processes", `${name}.process.yaml`), "utf8").replace(/\r\n/g, "\n"));
  if (!p.ok) { console.log(`FAIL ${name} does not parse`); return null; }
  return p.value;
};
let n = 0, failed = 0;
const check = (name, ok, detail = "") => {
  n += 1;
  if (ok) console.log(`ok   ${name}`);
  else { failed += 1; console.log(`FAIL ${name}${detail ? ` -- ${detail}` : ""}`); }
};
const grantsOf = (doc) => { const a = dispatchToolArgs(doc); return a[0] === "--allowedTools" ? a[1].split(", ").sort() : []; };

const SPEC = {
  "lesson-log": {
    row: "memory.log-lesson", kind: "note.logged", field: "lesson",
    // No Edit on docs/retro-log.md and no raw emit: memory/lesson-log.mjs is the log's one writer (attack 3e97a85 B8).
    grants: [
      "Bash(node .claude/scripts/memory/lesson-log.mjs:*)",
      "Edit(.claude/state/lesson-log/row.txt)",
      "Read",
    ],
    tag: "--as-process lesson-log@1.0.0",
  },
  "rule-promote": {
    row: "memory.promote-rule", kind: "approval.requested", field: "rule",
    grants: [
      "Bash(node .claude/scripts/memory/rule-propose.mjs:*)",
      "Edit(.claude/state/rule-promote/rule.md)",
      "Read",
    ],
    tag: "--as-process rule-promote@1.0.0",
  },
};

// Exactly one mode argument: `checks gate` used to run checks alone, silently (attack 3e97a85 B7).
const mode = process.argv.length === 3 ? process.argv[2] : "";
// exitCode, never process.exit(): an exit right after a console.log can cut the summary line off a piped stdout.
if (mode !== "checks" && mode !== "gate") { console.log("usage: memory-session-probe.mjs checks|gate"); process.exitCode = 2; }
for (const [name, s] of (mode === "checks" || mode === "gate") ? Object.entries(SPEC) : []) {
  const doc = load(name);
  if (!doc) { n += 1; failed += 1; continue; }
  if (mode === "checks") {
    // The whole grant, exactly: a write fenced to its paths, one shell scope per tool, no Task, no bare Write.
    check(`${name}: the CLI is handed exactly its fenced grants`, JSON.stringify(grantsOf(doc)) === JSON.stringify([...s.grants].sort()), grantsOf(doc).join(" | "));
    const row = sessionById(s.row);
    const field = row && row.fields.find((f) => f.name === s.field);
    check(`${name}: the door row ${s.row} runs it and claims ${s.kind}`, !!row && row.process === name && row.receipt && row.receipt.kind === s.kind, JSON.stringify(row && { p: row.process, r: row.receipt }));
    check(`${name}: its door field is required, one line, at most 500`, !!field && field.required === true && field.pattern === ONE_LINE_SRC && field.max > 0 && field.max <= 500, JSON.stringify(field));
    // The receipt is this run's own only when it carries the process tag arc-run's vouch reads.
    check(`${name}: the body tags its receipt with the process`, doc.body.includes(s.tag), s.tag);
    check(`${name}: the body is one turn, and names its tools`, doc.body.includes("This run is one") && doc.body.includes("never background anything") && doc.body.includes("everything else is refused"), "");
  } else if (mode === "gate") {
    const gate = authorizeRun({ processName: name, doc, root: ROOT });
    check(`${name}: hq.policy.yaml authorises it for what it declares`, gate.inForce === true && gate.mayInvoke === true, gate.denials.map((d) => d.reason).join("; ") || gate.reason || "");
  }
}

if (mode === "checks" || mode === "gate") console.log(`PROBE ${mode}: ${n} checks, ${failed} failed`);
if (mode === "checks" || mode === "gate") process.exitCode = failed ? 1 : 0;
