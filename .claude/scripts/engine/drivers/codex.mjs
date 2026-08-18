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

import { canonicalDoc, parseModelJson, pinnedModel, runDriver, settle } from "./common.mjs";
import { render as renderCodex } from "../adapters/codex.mjs";

const CLI = process.env.ARC_CODEX_CLI || "codex";
// The work root -- the child cwd, and nothing else. The canonical process file is read from the
// MACHINERY root instead (ADR-0220 splits them; ADR-0223 records why it matters): the policy gate
// validates the file at policyRoot(), so a driver building its prompt and its tool grant from a
// file at $ARC_ROOT is validating one read and using another.
const WORK_ROOT = process.env.ARC_ROOT || process.cwd();

await runDriver("codex", async ({ processName, input }) => {
  // ONE READER for the canonical document (canonicalDoc). This body used to open the file itself,
  // so the gate validated one read while the prompt and the tool grant came from a second, later
  // one -- and an adversarial pass showed the two can see different bytes if anything writes
  // between them. Sharing the ROOT was only half the fix; sharing the READ is the other half.
  const read = await canonicalDoc(processName);
  if (read.missing) throw new Error(`canonical file not found: ${read.path}`);
  if (!read.ok) throw new Error(`canonical file does not parse: ${read.what}`);
  const parsed = { value: read.doc };

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
    raw = execFileSync(CLI, ["exec", "--json", prompt], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, cwd: WORK_ROOT });
  } catch (e) {
    throw new Error(`codex CLI failed: ${String(e.message).split("\n")[0]}`);
  }

  // The CLI's envelope shape is not a contract arc controls, so take the last JSON object on
  // stdout and let arc-run judge it. Guessing at a richer shape would break on their next
  // release and read as a model failure.
  const line = raw.trim().split("\n").filter(Boolean).pop() ?? "";
  let output;
  try { output = parseModelJson(line, "the codex last line"); } catch { output = parseModelJson(raw, "the codex output"); }

  return { output, cost: { source: "measured" }, model: pinnedModel() ?? "unpinned" };
});

settle();
