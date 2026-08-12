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
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { parseModelJson, pinnedModel, runDriver, settle } from "./common.mjs";
import { parseYamlSubset } from "../yaml-subset.mjs";
import { renderAllowedTools } from "../adapters/claude-code.mjs";

const CLI = process.env.ARC_CLAUDE_CLI || "claude";
const ROOT = process.env.ARC_ROOT || process.cwd();

await runDriver("claude-code", async ({ processName, input }) => {
  const canonPath = join(ROOT, "processes", `${processName}.process.yaml`);
  const parsed = parseYamlSubset(readFileSync(canonPath, "utf8"));
  if (!parsed.ok) throw new Error(`canonical file does not parse: ${parsed.error.what}`);
  const doc = parsed.value;

  // Reuse, never re-derive. If this ever cannot be reused, that is the named finding.
  const allowed = doc.permissions === "declared" ? renderAllowedTools(doc.tools) : null;

  const prompt = [
    doc.body,
    "",
    "---",
    "INPUT (JSON):",
    JSON.stringify(input),
    "",
    "Reply with ONE JSON document matching this process's output contract, and nothing else.",
  ].join("\n");

  const args = ["-p", prompt, "--output-format", "json"];
  if (allowed) args.push("--allowedTools", allowed);
  // The tier reaches the model here, or the run is unpinned and the receipt says so.
  const model = pinnedModel();
  if (model) args.push("--model", model);

  let raw;
  try {
    raw = execFileSync(CLI, args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, cwd: ROOT });
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
  version: () => "claude-code@1.0.0",
});

settle();
