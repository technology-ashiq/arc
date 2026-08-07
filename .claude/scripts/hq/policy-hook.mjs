#!/usr/bin/env node
/**
 * policy-hook -- the bridge between a PreToolUse payload and `authorizeAction` (REQ-05).
 *
 * Reads the hook payload on stdin, maps the tool to a capability and a resource, asks the ONE
 * shared library, and translates the answer into the dispatcher's exit contract:
 *
 *   0  allowed, proposed, or policy not in force in this root
 *   2  DENIED -- the reason goes to stdout and the fragment relays it to stderr
 *   1  the check could not decide; the fragment turns that into a deny
 *
 * NO POLICY LOGIC LIVES HERE (POL-D). Mapping a tool name to a capability IS the feasibility
 * matrix's job, and this file reads that matrix rather than re-deciding it -- which is what
 * keeps the interactive surface and the headless surface from drifting into two policies.
 *
 * The interactive subject is `session:interactive` (ADR-0504): one reserved action kind for a
 * whole human session. It is coarse by construction, and that is recorded rather than hidden --
 * anything needing finer interactive granularity is a v2 question, not a runtime exception.
 */

import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { authorizeAction } from "./lib/policy/authorize.mjs";
import { loadPolicyFromDisk, loadPolicyEvents, policyRoot } from "./lib/policy/run-gate.mjs";
import { recordOverreach } from "./lib/policy/incident.mjs";
import { SESSION_KIND } from "./lib/policy/model.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));

/** Read the whole of stdin. A hook payload is small; a stream API here would be theatre. */
function readStdin() {
  try { return readFileSync(0, "utf8"); } catch { return ""; }
}

/**
 * Which capability a tool exercises, and which of its inputs is the resource. Read from the
 * committed matrix (ADR-0503) so a tool nobody classified is not silently harmless.
 */
function loadMatrix() {
  const p = join(HERE, "lib", "policy", "tool-capabilities.json");
  if (!existsSync(p)) return null;
  try { return JSON.parse(readFileSync(p, "utf8")); } catch { return null; }
}

/** The field of `tool_input` that names what the tool will act on, per tool family. */
const RESOURCE_FIELD = Object.freeze({
  Bash: "command", PowerShell: "command",
  Write: "file_path", Edit: "file_path", NotebookEdit: "notebook_path",
  Read: "file_path", Glob: "path", Grep: "path",
  WebFetch: "url", WebSearch: "query",
});

function capabilitiesFor(toolName, matrix) {
  if (!matrix) return null;
  if (toolName.startsWith("mcp__")) {
    const [, server, tool] = toolName.split("__");
    const entry = matrix.servers && matrix.servers[server];
    if (!entry) return ["spend", "write", "deploy", "publish"]; // unclassified server: the worst it could be
    const own = entry.tools && Object.prototype.hasOwnProperty.call(entry.tools, tool)
      ? entry.tools[tool] : null;
    return own || entry.default || ["write"];
  }
  const b = matrix.builtin || {};
  const own = b.tools && Object.prototype.hasOwnProperty.call(b.tools, toolName) ? b.tools[toolName] : null;
  return own || b.default || null;
}

function main() {
  const raw = readStdin();
  if (!raw.trim()) return 0; // nothing to judge

  let payload;
  try { payload = JSON.parse(raw); } catch {
    // A payload we cannot read is a tool call we cannot judge. Deny: this is the one fragment
    // whose job is authority, and "unparseable, so allowed" is the fail-open being closed.
    process.stdout.write("BLOCKED by policy: the hook payload could not be parsed, so the action could not be judged\n");
    return 2;
  }

  const toolName = String(payload.tool_name || "");
  if (!toolName) return 0;

  const root = policyRoot();
  let policy;
  try { policy = loadPolicyFromDisk(root); } catch (e) {
    process.stdout.write(`BLOCKED by policy: hq.policy.yaml could not be read (${String(e.message).split("\n")[0]})\n`);
    return 2;
  }
  if (!policy) return 0; // not in force in this root -- arc-run announces the same thing

  const matrix = loadMatrix();
  const capabilities = capabilitiesFor(toolName, matrix);
  if (!capabilities || capabilities.length === 0) {
    // An unclassified TOOL, in a root where policy IS in force. Deny-by-default applied to
    // classification itself -- the same rule argv0_classes and the MCP matrix already follow.
    process.stdout.write(`BLOCKED by policy: ${toolName} is not in the capability matrix, and an unclassified tool is not an allowed one\n`);
    return 2;
  }

  const input = payload.tool_input || {};
  const field = RESOURCE_FIELD[toolName];
  const resource = field && input[field] !== undefined ? String(input[field])
    : (input.command ?? input.file_path ?? input.path ?? input.url ?? "");

  const events = loadPolicyEvents(root);
  for (const capability of capabilities) {
    if (capability === "read") continue; // reads are the deny-by-default floor, not a gate
    const verdict = authorizeAction({ kind: SESSION_KIND, capability, resource }, { policy, events, root });
    if (verdict.decision === "deny") {
      process.stdout.write(`BLOCKED by policy: ${toolName} needs ${capability} -- ${verdict.reason}\n`);
      // THE DENIAL COSTS A LEVEL, when the pair held one to lose. `recordOverreach` decides
      // whether this deny is an overreach or an ordinary deny-by-default, and writes the two
      // receipts if it is. It never throws, and its result never reaches the return value below:
      // the action is denied whether or not the receipt lands. A failed receipt is reported --
      // "the demotion could not be sealed" and "there was nothing to take" must not read alike --
      // but it does not soften the block, and it must never be able to allow.
      const bite = recordOverreach(
        { kind: SESSION_KIND, capability, effective: verdict.effective,
          what: `${toolName} denied: ${verdict.reason}`, root },
        { policy, events });
      if (bite.demoted)
        process.stdout.write(`policy: ${SESSION_KIND}/${capability} demoted ${bite.from} -> ${bite.to}, citing ${bite.incidentId}\n`);
      else if (bite.incidentId)
        process.stdout.write(`policy: incident ${bite.incidentId} raised, no demotion (${bite.reason})\n`);
      else if (!bite.skipped)
        // An overreach the ledger could not record. Saying nothing here would leave the operator
        // believing the authority chain is intact when it just lost an entry -- the same reason
        // the dispatcher announces a missing fragment instead of quietly allowing.
        process.stdout.write(`policy: WARN the overreach was NOT recorded -- ${bite.reason}\n`);
      return 2;
    }
    if (verdict.decision === "propose") {
      process.stdout.write(
        `BLOCKED by policy: ${toolName} needs ${capability}, which is at L1 (propose) for ` +
        `${SESSION_KIND}. L1 means prepare and record, never perform -- raising it is a human ` +
        `decision citing trial-ledger evidence (${verdict.reason})\n`
      );
      return 2;
    }
  }
  return 0;
}

let code;
try { code = main(); } catch (e) {
  // Fail-closed. A policy check that throws blocks (ADR-0028); the fragment maps any non-zero
  // that is not 2 into a deny as well, so this is belt and braces on purpose.
  process.stdout.write(`policy-hook threw: ${String(e && e.message).split("\n")[0]}\n`);
  code = 1;
}
process.exit(code);
