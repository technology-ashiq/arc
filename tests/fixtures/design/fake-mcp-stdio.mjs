#!/usr/bin/env node
// A fake local MCP server for tests/design-refpack-mcp.bats (Phase 05, attack fc97161 B7): it
// speaks JSON-RPC lines on stdin/stdout so the REAL stdio transport is driven, not the fixture
// path. FAKE_MCP_MODE picks the behaviour: answer (default) | exit | silent | double | junk.
// It also writes its own environment's key-shaped names to FAKE_MCP_ENV_OUT, so a test can
// prove the allow-listed environment reached it and the owner's keys did not.
import { appendFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";

const mode = process.env.FAKE_MCP_MODE || "answer";
if (process.env.FAKE_MCP_ENV_OUT) writeFileSync(process.env.FAKE_MCP_ENV_OUT, Object.keys(process.env).sort().join("\n") + "\n");
if (process.env.FAKE_MCP_PID_OUT) appendFileSync(process.env.FAKE_MCP_PID_OUT, String(process.pid) + "\n");
if (mode === "exit") process.exit(3);

const send = (m) => process.stdout.write(JSON.stringify(m) + "\n");
const LIST = "Found 3 items matching card in registries @shadcn: Showing items 1-2 of 3:\n- card (registry:ui) [@shadcn]\n- hover-card (registry:ui) [@shadcn]\nMore items available.";
if (mode === "junk") for (let i = 0; i < 30; i++) process.stdout.write("npm notice not json " + i + "\n");

createInterface({ input: process.stdin }).on("line", (line) => {
  let m;
  try { m = JSON.parse(line); } catch { return; }
  if (mode === "silent" || m.id === undefined) return;
  const reply = m.method === "initialize"
    ? { jsonrpc: "2.0", id: m.id, result: { serverInfo: { name: "fake-shadcn", version: "0" } } }
    : { jsonrpc: "2.0", id: m.id, result: { content: [{ type: "text", text: LIST }] } };
  send(reply);
  if (mode === "double" && m.method === "tools/call") send(reply);
});
