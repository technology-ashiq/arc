#!/usr/bin/env node
// fake-claude-spend.mjs -- a stand-in `claude -p` for the session-spend suite (engine Cycle 9, ADR-0229).
//
// It answers with the result envelope the real CLI prints (pinned by tests/fixtures/engine/real-claude-*.json): one
// JSON document for `--output-format json`, or a `system` event then the `result` event for `stream-json`.
//
//   FAKE_SPEND_COST     the envelope's total_cost_usd: a number (e.g. 0.0731), `absent`, `string`, `negative`
//   FAKE_SPEND_ANSWER   `valid` (default, FAKE_SPEND_OUTPUT's JSON) or `notjson`
//   FAKE_SPEND_OUTPUT   path to the JSON answer the session returns
//   FAKE_SPEND_FAIL     1: an is_error result and exit 1, as the real CLI fails after a session
//   FAKE_SPEND_MARK     appended `RAN` once per invocation -- the hit counter a cap fixture reads
import { appendFileSync, readFileSync } from "node:fs";

if (process.env.FAKE_SPEND_MARK) appendFileSync(process.env.FAKE_SPEND_MARK, "RAN\n");
process.stdin.resume();
process.stdin.on("data", () => {});
process.stdin.on("end", () => {
  const raw = process.env.FAKE_SPEND_COST ?? "absent";
  const cost = raw === "absent" ? undefined : raw === "string" ? "0.0731" : raw === "negative" ? -0.5 : Number(raw);
  const answer = process.env.FAKE_SPEND_ANSWER === "notjson" ? "this is not json at all" : readFileSync(process.env.FAKE_SPEND_OUTPUT, "utf8").trim();
  const fail = process.env.FAKE_SPEND_FAIL === "1";
  const result = {
    type: "result", subtype: fail ? "error_max_turns" : "success", is_error: fail, result: answer,
    session_id: "00000000-0000-4000-8000-000000000000",
    ...(cost !== undefined ? { total_cost_usd: cost } : {}),
    usage: { input_tokens: 10, output_tokens: 5 },
  };
  if (process.argv.includes("stream-json")) {
    process.stdout.write(`${JSON.stringify({ type: "system", subtype: "init" })}\n`);
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } else {
    process.stdout.write(`${JSON.stringify(result)}\n`);
  }
  if (fail) { process.stderr.write("fake claude: failing after the session on purpose\n"); process.exitCode = 1; }
});
