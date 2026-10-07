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
import { statSync } from "node:fs";

import { canonicalDoc, parseModelJson, pinnedModel, runDriver, seatPersona, settle } from "./common.mjs";
import { render as renderCodex } from "../adapters/codex.mjs";

const CLI = process.env.ARC_CODEX_CLI || "codex";
// The work root -- the child cwd, and nothing else. The canonical process file is read from the
// MACHINERY root instead (ADR-0220 splits them; ADR-0223 records why it matters): the policy gate
// validates the file at policyRoot(), so a driver building its prompt and its tool grant from a
// file at $ARC_ROOT is validating one read and using another.
const WORK_ROOT = process.env.ARC_ROOT || process.cwd();

// The CLI could not be STARTED at all: not there (ENOENT), not runnable (EACCES, EPERM), or a Windows shim the
// spawn cannot launch (EINVAL). That is the driver being unavailable -- the one failure it can name structurally
// (ADR-0228; attack 27dcf39 B8). Anything after the CLI started stays undeclared.
// ONLY when the work root is a usable directory: a deleted or unreadable cwd fails the spawn with the same codes, and
// that is a fault on this machine -- declaring it unavailable would hop to a gateway and send the work elsewhere
// (attack a4e3f33 B2).
const workRootUsable = () => { try { return statSync(WORK_ROOT).isDirectory(); } catch { return false; } };
const cliMissing = (e) => Boolean(e) && workRootUsable()
  && (["ENOENT", "EACCES", "EPERM"].includes(e.code) || (e.code === "EINVAL" && String(e.syscall || "").startsWith("spawn")));

await runDriver("codex", async ({ processName, input }) => {
  // ONE READER for the canonical document (canonicalDoc). This body used to open the file itself,
  // so the gate validated one read while the prompt and the tool grant came from a second, later
  // one -- and an adversarial pass showed the two can see different bytes if anything writes
  // between them. Sharing the ROOT was only half the fix; sharing the READ is the other half.
  const read = await canonicalDoc(processName);
  if (read.missing) throw new Error(`canonical file not found: ${read.path}`);
  if (!read.ok) throw new Error(`canonical file does not parse: ${read.what}`);
  const parsed = { value: read.doc };

  const persona = seatPersona();
  const prompt = [
    ...(persona ? [persona] : []),
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
    const err = new Error(`codex CLI failed: ${String(e.message).split("\n")[0]}`);
    // Not installed is structural; every other failure stays undeclared (unknown), never guessed (ADR-0228).
    if (cliMissing(e)) err.arcFailureClass = "provider-unavailable";
    throw err;
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
