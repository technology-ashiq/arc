#!/usr/bin/env node
/**
 * drivers/claude-code.mjs -- runs a process through the Claude Code CLI, headless.
 *
 * `arc-run` is headless only and never wraps an interactive session (a PLAN
 * non-negotiable), so this shells out to the CLI's non-interactive print mode.
 *
 * Runtime permissions come from the Phase-01 mapping table, NOT a second one: the abstract
 * `tools:` list is translated by `adapters/claude-code.mjs`'s TOOL_MAP, the same data that
 * renders the generated command's `allowed-tools:` line. A driver that re-implemented that
 * mapping would be free to drift from the compiler's, and the two would disagree about what
 * a process is allowed to do -- which is the gap phase-02-spec says must be a NAMED finding
 * rather than a silent second implementation.
 */

import { execFileSync, spawn } from "node:child_process";

import { canonicalDoc, parseModelJson, pinnedModel, runDriver, settle } from "./common.mjs";
import { dispatchToolArgs, progressLine } from "../adapters/claude-code.mjs";

/**
 * PROGRESS MODE (face Phase 06 slice 03c). arc-run sets ARC_DRIVER_PROGRESS=1 when it streams a session for the face's
 * door. The CLI then runs with `--output-format stream-json --verbose`, and each tool step the model takes becomes ONE
 * short stderr line -- which agent it started, which command, which file -- written the moment the CLI reports it, so
 * the door shows a council's phases while they happen. The final `result` event is the same envelope `json` mode
 * returns, so everything after it is unchanged. What a line may say is the adapter's `progressLine`, pure and tested.
 */

/** Run the CLI in stream-json mode, writing a progress line per tool step; resolve with the final result event. */
/**
 * The command that runs the CLI. A fixture CLI is a .mjs run under this node: Windows cannot spawn a script file
 * directly, and the fixture has to run on every CI leg. The real CLI is a binary on PATH and never ends in .mjs.
 * @param {string[]} cliArgs @returns {[string, string[]]}
 */
const cliCommand = (cliArgs) => (CLI.endsWith(".mjs") ? [process.execPath, [CLI, ...cliArgs]] : [CLI, cliArgs]);

// The stream path keeps the json path's ceiling: 64 MiB in all, and no single line past 16 MiB (attack 3e77530 B7).
const STREAM_TOTAL_CAP = 64 * 1024 * 1024;
const STREAM_LINE_CAP = 16 * 1024 * 1024;
// Once the CLI has exited, its pipes get this long to drain; a grandchild holding them open cannot hold the run (B4).
const STREAM_DRAIN_MS = 2000;

/** `args` with every --output-format and the value after it removed, in either spelling (attack 3e77530 B14). */
const withoutOutputFormat = (args) => {
  const out = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--output-format") { i += 1; continue; }
    if (args[i].startsWith("--output-format=")) continue;
    out.push(args[i]);
  }
  return out;
};

function runStreaming(args, prompt) {
  return new Promise((resolveP, rejectP) => {
    const [bin, argv] = cliCommand([...withoutOutputFormat(args), "--output-format", "stream-json", "--verbose"]);
    const child = spawn(bin, argv, { cwd: WORK_ROOT, stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
    // Decoded as streams, so a character split across two chunks is never two replacement characters (B5).
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    let buf = "", total = 0, result = null, errTail = "", settled = false, exited = null, drain = null, overflow = "";
    const fail = (msg) => {
      if (settled) return;
      settled = true;
      if (drain) clearTimeout(drain);
      try { child.kill("SIGKILL"); } catch { /* already gone */ }
      rejectP(new Error(`claude CLI failed: ${msg}`));
    };
    const finish = () => {
      if (settled) return;
      settled = true;
      if (drain) clearTimeout(drain);
      for (const s of [child.stdout, child.stderr]) { try { s.destroy(); } catch { /* already closed */ } }
      if (buf) onLine(buf);
      const tail = errTail ? ` (${errTail.split("\n").filter(Boolean).pop()})` : "";
      if (overflow) return rejectP(new Error(`claude CLI failed: ${overflow}`));
      // A non-zero exit, a signal, or a result the CLI marks as an error is a failed run -- as execFileSync made it on
      // the json path -- never an answer to parse (B2).
      if (exited && (exited.code !== 0 || exited.signal)) return rejectP(new Error(`claude CLI failed: exit ${exited.code ?? "none"}${exited.signal ? ` (${exited.signal})` : ""}${tail}`));
      if (!result) return rejectP(new Error(`claude CLI failed: no result event${tail}`));
      if (result.is_error === true) return rejectP(new Error(`claude CLI failed: the result is an error (${String(result.subtype ?? "error").slice(0, 60)})`));
      resolveP(result);
    };
    function onLine(line) {
      if (!line.trim()) return;
      let ev;
      try { ev = JSON.parse(line); } catch { return; }
      if (ev && ev.type === "assistant" && ev.message && Array.isArray(ev.message.content)) {
        for (const b of ev.message.content) {
          // A block the model shaped to throw is skipped, never the end of a paid run (B1).
          let l = null;
          try { l = progressLine(b); } catch { l = null; }
          if (l) process.stderr.write(`${l}\n`);
        }
      } else if (ev && ev.type === "result") result = ev;
    }
    child.stdout.on("data", (c) => {
      total += c.length;
      if (total > STREAM_TOTAL_CAP) { overflow = `the stream passed ${STREAM_TOTAL_CAP} bytes`; return finish(); }
      buf += c;
      let nl;
      while ((nl = buf.indexOf("\n")) !== -1) { onLine(buf.slice(0, nl)); buf = buf.slice(nl + 1); }
      if (buf.length > STREAM_LINE_CAP) { overflow = `one stream line passed ${STREAM_LINE_CAP} bytes`; finish(); }
    });
    child.stderr.on("data", (c) => { errTail = (errTail + c).slice(-2000); });
    child.on("error", (e) => fail(e.message));
    child.on("exit", (code, signal) => {
      exited = { code, signal };
      drain = setTimeout(finish, STREAM_DRAIN_MS);
      drain.unref?.();
    });
    child.on("close", () => finish());
    child.stdin.on("error", () => {});
    child.stdin.end(prompt);
  });
}
const CLI = process.env.ARC_CLAUDE_CLI || "claude";
// The work root -- the child cwd, and nothing else. The canonical process file is read from the
// MACHINERY root instead (ADR-0220 splits them; ADR-0223 records why it matters): the policy gate
// validates the file at policyRoot(), so a driver building its prompt and its tool grant from a
// file at $ARC_ROOT is validating one read and using another.
const WORK_ROOT = process.env.ARC_ROOT || process.cwd();

await runDriver("claude-code", async ({ processName, input }) => {
  // ONE READER for the canonical document (canonicalDoc). This body used to open the file itself,
  // so the gate validated one read while the prompt and the tool grant came from a second, later
  // one -- and an adversarial pass showed the two can see different bytes if anything writes
  // between them. Sharing the ROOT was only half the fix; sharing the READ is the other half.
  const read = await canonicalDoc(processName);
  if (read.missing) throw new Error(`canonical file not found: ${read.path}`);
  if (!read.ok) throw new Error(`canonical file does not parse: ${read.what}`);
  const doc = read.doc;

  // Reuse, never re-derive -- the MAPPING and the RULE both. This driver once took the adapter's
  // mapping and left its refusal behind, so the rule held at compile time and not at dispatch
  // (ADR-0223 clause 4). The whole decision now lives in `dispatchToolArgs`, including ADR-0226's
  // amendment: an explicit `tools: []` reaches the CLI as its real zero instead of a refusal.
  // Computed BEFORE the prompt, so a refusal still dies here and never at the CLI.
  const toolArgs = dispatchToolArgs(doc);

  const prompt = [
    doc.body,
    "",
    "---",
    "INPUT (JSON):",
    JSON.stringify(input),
    "",
    "Reply with ONE JSON document matching this process's output contract, and nothing else.",
  ].join("\n");

  // The prompt goes on STDIN, not argv (ADR-0226): `-p` with no argument reads it from stdin, and
  // an argv prompt is capped at ~32 KB on Windows -- an attack prompt carrying a PR diff is not.
  const args = ["-p", "--output-format", "json"];
  args.push(...toolArgs);
  // The tier reaches the model here, or the run is unpinned and the receipt says so.
  const model = pinnedModel();
  if (model) args.push("--model", model);

  let raw, envelope;
  if (process.env.ARC_DRIVER_PROGRESS === "1") {
    envelope = await runStreaming(args, prompt);
    raw = JSON.stringify(envelope);
  } else {
    try {
      const [bin, argv] = cliCommand(args);
      raw = execFileSync(bin, argv, { input: prompt, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, cwd: WORK_ROOT });
    } catch (e) {
      throw new Error(`claude CLI failed: ${String(e.message).split("\n")[0]}`);
    }
    envelope = parseModelJson(raw, "the claude CLI envelope");
  }

  const text = typeof envelope.result === "string" ? envelope.result : raw;
  const output = parseModelJson(text, "the claude CLI result");

  const u = envelope.usage || {};
  return {
    output,
    cost: {
      tokensIn: Number.isFinite(u.input_tokens) ? u.input_tokens : undefined,
      tokensOut: Number.isFinite(u.output_tokens) ? u.output_tokens : undefined,
      source: "measured",
    },
    model: pinnedModel() ?? "unpinned",
  };
}, {
  // The DRIVER's version, not the CLI's (ADR-0902 / BEN-B). What varies the output of this
  // driver is its own adapter code; which model answered is the MP-F fingerprint's job, and
  // shelling out to `claude --version` would make an offline provenance field depend on a
  // binary that is not installed on any CI leg. Bump this when this file's behaviour changes.
  version: () => "claude-code@1.1.0",
});

settle();
