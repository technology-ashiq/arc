#!/usr/bin/env node
/**
 * tests/council-convene-probe.mjs -- the Node half of the council-convene arms in
 * tests/engine-process-lint.bats (face Phase 06 slice 03b, attack 66a26f0).
 *
 *   node tests/council-convene-probe.mjs checks   the process as the CLI and the door will meet it
 *   node tests/council-convene-probe.mjs gate     the policy gate a live Convene click crosses
 *
 * Every check prints one `ok` or `FAIL` line; the last line is `PROBE <mode>: <n> checks, <f> failed`, so the bats arm
 * can assert that the probe RAN and how much, not only that it exited 0. Exit 1 on any failure.
 *
 * In a file rather than inside `node -e` because these checks carry quotes, globs and regexes.
 */

import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseYamlSubset } from "../.claude/scripts/engine/yaml-subset.mjs";
import { dispatchToolArgs } from "../.claude/scripts/engine/adapters/claude-code.mjs";
import { render as codexRender } from "../.claude/scripts/engine/adapters/codex.mjs";
import { toolsetsFor } from "../.claude/scripts/engine/drivers/hermes.mjs";
import { authorizeRun } from "../.claude/scripts/hq/lib/policy/run-gate.mjs";
import { sessionById } from "../.claude/scripts/hq/face-sessions.mjs";
import { ONE_LINE_SRC } from "../.claude/scripts/core/one-line.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PROCESS = join(ROOT, "processes", "council-convene.process.yaml");
const text = readFileSync(PROCESS, "utf8").replace(/\r\n/g, "\n");
const parsed = parseYamlSubset(text);
if (!parsed.ok) { console.log(`FAIL the process does not parse: ${JSON.stringify(parsed.error)}`); process.exit(1); }
const doc = parsed.value;

let n = 0, failed = 0;
const check = (name, ok, detail = "") => {
  n += 1;
  if (ok) console.log(`ok   ${name}`);
  else { failed += 1; console.log(`FAIL ${name}${detail ? ` -- ${detail}` : ""}`); }
};
const toolScopes = (prim) => {
  const t = doc.tools.find((x) => typeof x === "object" && x !== null && Object.keys(x)[0] === prim);
  return t ? t[prim] : null;
};

const mode = process.argv[2];

if (mode === "checks") {
  // B1: the write the CLI is handed is fenced to the sessions directory. The control shows the fence is the scope:
  // the same process with a bare fs.write renders the unfenced Write token.
  const argv = dispatchToolArgs(doc);
  const grants = argv[0] === "--allowedTools" ? argv[1].split(", ") : [];
  check("the CLI is handed --allowedTools, never an unrestricted run", argv[0] === "--allowedTools", argv.join(" "));
  check("the only write grant is Edit(docs/council/sessions/*.md)",
    grants.filter((g) => /^(Write|Edit)\b/.test(g)).join("|") === "Edit(docs/council/sessions/*.md)", grants.join(", "));
  const bareDoc = { ...doc, tools: doc.tools.map((t) => (typeof t === "object" && t !== null && Object.keys(t)[0] === "fs.write" ? "fs.write" : t)) };
  check("CONTROL: the same process with a bare fs.write renders the unfenced Write", dispatchToolArgs(bareDoc)[1].split(", ").includes("Write"));

  // B3: one emitter scope, one kind.
  const shells = toolScopes("shell.run") || [];
  const emits = shells.filter((s) => s.includes("arc-event.sh"));
  check("the emitter is granted for council.verdict only",
    emits.length === 1 && emits[0] === "bash .claude/scripts/hq/arc-event.sh emit council.verdict:*", JSON.stringify(emits));

  // B5: the agents the Chair may invoke are exactly the council agents on disk, both directions -- read with the same
  // glob the process's fs.read names (council-*.md), not a narrower class (1be4183 B14).
  const onDisk = readdirSync(join(ROOT, ".claude", "agents")).filter((f) => f.startsWith("council-") && f.endsWith(".md")).map((f) => f.slice(0, -3)).sort();
  const invoked = [...(toolScopes("agent.invoke") || [])].sort();
  check("agent.invoke lists every council-*.md agent on disk and nothing else",
    onDisk.length > 0 && JSON.stringify(onDisk) === JSON.stringify(invoked), `disk ${onDisk.join(",")} | process ${invoked.join(",")}`);
  // 1be4183 B1: and that list is what reaches the CLI -- one Agent(<name>) grant each, no bare Task.
  const agentGrants = grants.filter((g) => /^(Task|Agent)\b/.test(g)).sort();
  check("the CLI is handed exactly one Agent(<name>) per council agent, and no bare Task",
    JSON.stringify(agentGrants) === JSON.stringify(invoked.map((a) => `Agent(${a})`).sort()), agentGrants.join(", "));
  const bareAgents = { ...doc, tools: doc.tools.map((t) => (typeof t === "object" && t !== null && Object.keys(t)[0] === "agent.invoke" ? "agent.invoke" : t)) };
  check("CONTROL: with the agent list dropped, the CLI gets the unfenced Task", dispatchToolArgs(bareAgents)[1].split(", ").includes("Task"));

  // 1be4183 B6: a driver that cannot fence a path refuses the process rather than widen it.
  const refuses = (fn) => { try { fn(); return false; } catch (e) { return /cannot fence a path/.test(String(e.message)); } };
  check("the codex adapter refuses a path-scoped write", refuses(() => codexRender(doc)));
  check("the hermes driver refuses a path-scoped write", refuses(() => toolsetsFor(doc)));
  check("CONTROL: codex still renders the same process with a bare write", !refuses(() => codexRender(bareDoc)));

  // B6: the process input schema has no length or line keywords, so the door's field is the fence a click crosses.
  const row = sessionById("council.convene");
  const field = row && row.fields.find((f) => f.name === "question");
  check("the door row runs council-convene and claims council.verdict", !!row && row.process === "council-convene" && row.receipt && row.receipt.kind === "council.verdict", JSON.stringify(row && { p: row.process, r: row.receipt }));
  check("the question field is required, one line, and at most 500", !!field && field.required === true && field.pattern === ONE_LINE_SRC && field.max > 0 && field.max <= 500, JSON.stringify(field));

  // The drift pin: the runs: comment names arc-council.md and the hash of its LF bytes.
  const pin = /^# runs: \.claude\/commands\/arc-council\.md sha256 ([0-9a-f]{64})$/m.exec(text);
  const live = createHash("sha256").update(readFileSync(join(ROOT, ".claude", "commands", "arc-council.md"), "utf8").replace(/\r\n/g, "\n")).digest("hex");
  check("the runs: pin equals the live arc-council.md (re-read the body against it, then re-pin)", !!pin && pin[1] === live, `pin ${pin ? pin[1] : "absent"} live ${live}`);

  // B4: the body prints the one line the door credits, with the door's own shape.
  const RECEIPT_LINE = /^arc-run: receipt ([a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*)+) ([0-7][0-9A-HJKMNP-TV-Z]{25})\s*$/;
  // The third live convene (2026-09-25) emitted its receipt and then failed: it "printed" the receipt line the body
  // asked for, and in -p mode printing IS the reply, so the reply began with text and was not JSON. arc-run vouches
  // for the receipt_id now; the body asks for the JSON alone and never for a receipt line of the model's own.
  check("the body's reply is the JSON alone, never a receipt line of its own",
    doc.body.includes("Your reply is ONLY the JSON object") && !doc.body.includes("print exactly this line") && !/^\s*`?arc-run: receipt/m.test(doc.body)
      && RECEIPT_LINE.test("arc-run: receipt council.verdict 01M37D0KHFPXBDBWQRYPMEXVT8"));
  // B2, B7 and the mode-word trap, pinned in the body the model reads.
  check("the body claims its file through --claim, never a number of its own", doc.body.includes("--claim <slug>") && doc.body.includes("Never choose a number yourself"));
  check("a refused claim is FAILED, and a failed run gives its claim back", doc.body.includes("`--claim` refuses, the run has FAILED") && doc.body.includes("--release <claimed path>"));
  check("each lint gets at most 3 attempts", doc.body.includes("at most 3 attempts"));
  check("the body pins deep mode", doc.body.includes("Never run quick, standard or review mode"));
  // The first live convene (2026-09-25) ended mid-research: the Chair backgrounded its agents and called
  // ScheduleWakeup, and a headless turn simply ends there. The body now forbids both, and names its tools.
  check("the body keeps every agent in the foreground, in one turn",
    doc.body.includes("never set `run_in_background`") && doc.body.includes("call ScheduleWakeup, Monitor, sleep") && doc.body.includes("THIS RUN IS ONE TURN"));
  check("step 9 runs as plain commands, never $(...) or a pipe", doc.body.includes("never one line with `$(...)` or a") && !/\$\(node|\| tail/.test(doc.body));
} else if (mode === "gate") {
  // B8: the gate a live click meets. --dry-run exits before it, so it is asked here directly, on the real policy.
  const gate = authorizeRun({ processName: "council-convene", doc, root: ROOT });
  check("the policy engine is in force at the repo root", gate.inForce === true, gate.reason || "");
  check("hq.policy.yaml authorises process:council-convene for what it declares", gate.mayInvoke === true,
    gate.denials.map((d) => d.reason).join("; ") || "no denial named");
} else {
  console.log("usage: council-convene-probe.mjs checks|gate");
  process.exit(2);
}

console.log(`PROBE ${mode}: ${n} checks, ${failed} failed`);
process.exit(failed ? 1 : 0);
