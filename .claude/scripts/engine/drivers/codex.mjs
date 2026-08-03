#!/usr/bin/env node
/**
 * drivers/codex.mjs -- runs a process through the codex CLI, headless.
 *
 * Feeds the CODEX-target rendering (the recorded golden's dialect), not the claude-code one:
 * the whole point of two targets is that each driver receives the dialect written for it.
 * The OUTPUT CONTRACT is the equalizer -- the design source's own framing -- so this returns
 * whatever the CLI produced, unjudged, and arc-run validates it against the same schema it
 * applies to every other driver.
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { runDriver, settle } from "./common.mjs";
import { parseYamlSubset } from "../yaml-subset.mjs";
import { render as renderCodex } from "../adapters/codex.mjs";

const CLI = process.env.ARC_CODEX_CLI || "codex";
const ROOT = process.env.ARC_ROOT || process.cwd();

await runDriver("codex", async ({ processName, input }) => {
  const canonPath = join(ROOT, "processes", `${processName}.process.yaml`);
  const parsed = parseYamlSubset(readFileSync(canonPath, "utf8"));
  if (!parsed.ok) throw new Error(`canonical file does not parse: ${parsed.error.what}`);

  const prompt = [
    renderCodex(parsed.value),
    "",
    "---",
    "INPUT (JSON):",
    JSON.stringify(input),
    "",
    "Reply with ONE JSON document matching this process's output contract, and nothing else.",
  ].join("\n");

  let raw;
  try {
    raw = execFileSync(CLI, ["exec", "--json", prompt], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, cwd: ROOT });
  } catch (e) {
    throw new Error(`codex CLI failed: ${String(e.message).split("\n")[0]}`);
  }

  // The CLI's envelope shape is not a contract arc controls, so take the last JSON object on
  // stdout and let arc-run judge it. Guessing at a richer shape would break on their next
  // release and read as a model failure.
  const line = raw.trim().split("\n").filter(Boolean).pop() ?? "";
  let output;
  try { output = JSON.parse(line); } catch { output = JSON.parse(raw); }

  return { output, cost: { source: "measured" } };
});

settle();
