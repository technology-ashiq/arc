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

import { execFileSync } from "node:child_process";

import { canonicalDoc, parseModelJson, pinnedModel, runDriver, settle } from "./common.mjs";
import { dispatchToolArgs } from "../adapters/claude-code.mjs";

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

  let raw;
  try {
    raw = execFileSync(CLI, args, { input: prompt, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, cwd: WORK_ROOT });
  } catch (e) {
    throw new Error(`claude CLI failed: ${String(e.message).split("\n")[0]}`);
  }

  const envelope = parseModelJson(raw, "the claude CLI envelope");
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
