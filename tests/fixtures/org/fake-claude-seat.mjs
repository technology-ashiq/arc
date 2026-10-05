#!/usr/bin/env node
// A stand-in for `claude -p --output-format json` (org Cycle 20 Phase 00). It writes the prompt it was handed to
// FAKE_CLAUDE_PROMPT_FILE, so a test observes what reached the CLI rather than what the receipt claims, then answers
// with a commit-msg-draft-shaped result.
import { writeFileSync } from "node:fs";

let prompt = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (c) => { prompt += c; });
process.stdin.on("end", () => {
  if (process.env.FAKE_CLAUDE_PROMPT_FILE) writeFileSync(process.env.FAKE_CLAUDE_PROMPT_FILE, prompt);
  const output = { commits: [{ sha: "4936371", subject: "feat(org): a seated probe" }] };
  process.stdout.write(`${JSON.stringify({ type: "result", subtype: "success", is_error: false, result: JSON.stringify(output), usage: { input_tokens: 10, output_tokens: 5 } })}\n`);
});
