#!/usr/bin/env node
/**
 * drivers/hermes.mjs -- the agent-runtime shim (REQ-01, phase 05).
 *
 * The runtime adapts to arc, never the reverse. This file makes one container invocation look
 * exactly like every other driver: `run <process> <input-json> <budget>`, one JSON document on
 * stdout, a cost sidecar when a cost was MEASURED, and exit 0 ok / 1 driver-fail / 2
 * budget-declined. It adds nothing to the driver exit map (ADR-0219).
 *
 * ============================================================================================
 * THE FINDING THIS FILE IS BUILT AROUND: stdout is NEVER clean.
 * ============================================================================================
 *
 * The vendor documents `-z` as "single prompt in, final response text out, nothing else on
 * stdout or stderr". Phase 04 measured that and it is true of the AGENT and false of the
 * CONTAINER. Every run -- warm ones included, so this is not a first-boot artifact -- puts
 * boot output on the same stream ahead of the answer:
 *
 *     Syncing bundled skills into ~/.hermes/skills/ ...
 *     Done: 0 new, 0 updated, 71 unchanged. 71 total bundled.
 *     [stage2] Setup complete; starting user services
 *     reconcile: profile=default prior_state=None action=registered
 *     {"ok": true, "runtime": "hermes"}
 *
 * So `JSON.parse(stdout)` fails on EVERY run, not occasionally, and extraction is the PRIMARY
 * path rather than a fallback. See initiatives/engine/evidence/phase-04/smoke-result.md.
 *
 * WHY THE LAST PARSEABLE LINE, SCANNED BACKWARDS, AND NOT SIMPLY THE LAST LINE. A warning
 * arriving after the answer would take a naive last-line reader off the end. Scanning backwards
 * for the last line that parses survives that. It is still not a proof of correctness, which is
 * why the red corpus and the two-agent adversarial pass are exit criteria and not decoration.
 *
 * WHY AN OBJECT OR ARRAY AND NEVER A SCALAR. `JSON.parse` accepts `42`, `true` and `null`, so a
 * boot line reading `0` would satisfy a naive "does it parse" test and be returned as the
 * model's answer. A process output document is a JSON object or array; a bare scalar arriving
 * last is boot noise, and treating it as an answer is how a green run reports nothing at all.
 *
 * ============================================================================================
 * WHAT THIS FILE DELIBERATELY DOES NOT DO
 * ============================================================================================
 *
 * It does not RETRY and it does not ESCALATE. ADR-0204's ladder is arc-run's: a schema failure
 * is arc-run's judgement AFTER a 0 exit, and it produces one same-tier retry and then a
 * proposal receipt. A driver that retried on its own would multiply the run budget silently.
 *
 * It does not JUDGE the output. Validating it against the process schema is arc-run's job, and
 * a driver that pre-judges reports a process fault as a driver fault (the same reasoning
 * generic-api.mjs already carries).
 *
 * It does not START A FRESH WALL-CLOCK. The budget belongs to the RUN. `budget.min` is the
 * run's ORIGINAL allowance and using it here would hand every driver a full budget again --
 * exactly the defect arc-run.mjs:399-403 records. The deadline arrives as an ABSOLUTE epoch
 * millisecond from arc-run, so time already burned is already subtracted and cannot be
 * un-subtracted. With no deadline in the environment the shim imposes none, and arc-run's own
 * spawn timeout remains the only clock.
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";

import { EXIT, pinnedModel, runDriver, settle } from "./common.mjs";
import { taggedSha256 } from "./type-tagged-hash.mjs";

const DOCKER = process.env.ARC_HERMES_DOCKER || "docker";
const IMAGE = process.env.ARC_HERMES_IMAGE || "";
const DATA_DIR = process.env.ARC_HERMES_DATA || "";
const CONFIG_FILE = process.env.ARC_HERMES_CONFIG || "";
const EGRESS_FILE = process.env.ARC_HERMES_EGRESS || "";
const SKILLS_FILE = process.env.ARC_HERMES_SKILLS || "";
const USAGE_FILE = process.env.ARC_HERMES_USAGE_FILE || "";

// arc-run's 1 MiB default truncated a large but perfectly valid answer and then blamed the
// driver (arc-run.mjs:375-378). The same number is used here so the two layers cannot disagree.
//
// OVERRIDABLE ONLY SO THE REFUSAL BRANCH CAN BE PROVEN TO RUN. Emitting 64 MB in CI to reach
// one `if` is a minute of runner time for no extra information, and the alternative -- trusting
// that the branch works because it looks right -- is the vacuous pass this repo keeps paying
// for. The override is bounded: a value that is not a positive finite number is IGNORED rather
// than obeyed, so a malformed environment cannot silently shrink the ceiling to nothing.
const MAX_BUFFER = (() => {
  const raw = Number(process.env.ARC_HERMES_MAX_BUFFER);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 64 * 1024 * 1024;
})();

// Room to tear the container down before arc-run SIGKILLs this process. Without it a timeout
// leaves a container running with nobody holding a handle to it.
const TEARDOWN_GRACE_MS = 3000;

/**
 * Strip ANSI escape sequences.
 *
 * EVERY ESCAPE HERE IS SPELLED \u001b AND IS NEVER WRITTEN AS A LITERAL BYTE. A literal 0x1b in
 * a source file is invisible in every diff, every review and every terminal that renders this
 * file, and any tool that normalises it away silently turns these patterns into ordinary text
 * matches -- at which point the OSC pattern below would eat from the first close-bracket in
 * the output to the end of the stream, deleting the very answer this parser exists to find.
 * The first draft of this function was written with literal bytes and lost them exactly that
 * way, so the rule is written down here rather than remembered.
 *
 * Three families, stripped in this order for a reason: an OSC payload may itself contain an
 * open-bracket, so removing OSC first stops the CSI pattern from cutting an OSC sequence in
 * half and leaving its tail behind as content.
 */
const ANSI_OSC = /\u001b\][\s\S]*?(?:\u0007|\u001b\\)/g;  // title/hyperlink, BEL- or ST-terminated
const ANSI_CSI = /\u001b\[[0-9;:?]*[ -\/]*[@-~]/g;        // colour, cursor movement
const ANSI_SOLO = /\u001b[@-Z\\-_]/g;                     // two-character escapes

function stripAnsi(s) {
  return String(s).replace(ANSI_OSC, "").replace(ANSI_CSI, "").replace(ANSI_SOLO, "");
}
/**
 * The answer, extracted from a stream that carries boot output. Returns the parsed document.
 * Throws with the reason NAMED -- "not JSON" and "nothing on stdout" are different operator
 * problems and reporting them identically costs a debugging session.
 */
export function extractAnswer(rawStdout) {
  const cleaned = stripAnsi(rawStdout).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (!cleaned.trim()) {
    throw new Error("the runtime produced no output on stdout at all — that is a runtime failure, not an unparseable answer");
  }

  const lines = cleaned.split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (!line) continue;
    // A cheap shape check before parsing. It is not a security boundary -- JSON.parse is the
    // decision -- it exists so a 60 MB stream of prose is not handed to the parser line by line.
    if (!(line.startsWith("{") || line.startsWith("["))) continue;
    let parsed;
    try {
      parsed = JSON.parse(line);
    } catch {
      continue;
    }
    // Redundant with the prefix check today, and kept deliberately: the two conditions answer
    // different questions, and a later relaxation of the fast path must not silently admit a
    // scalar.
    if (parsed === null || typeof parsed !== "object") continue;
    return parsed;
  }

  const preview = cleaned.trim().split("\n").slice(-3).join(" / ").slice(0, 200);
  throw new Error(`no line of the runtime output parsed as a JSON object or array (last lines: ${preview})`);
}

/** sha256 of a file's BYTES, or an explicit absence marker. Absence is never silence. */
function fileComponent(label, path) {
  if (!path) return { named: false, reason: `${label} was not configured for this run` };
  if (!existsSync(path)) return { named: true, present: false, path, reason: "configured but the file does not exist" };
  try {
    if (!statSync(path).isFile()) return { named: true, present: false, path, reason: "configured but the path is not a file" };
  } catch (e) {
    return { named: true, present: false, path, reason: `configured but unreadable: ${String(e.message).split("\n")[0]}` };
  }
  return { named: true, present: true, path, sha256: taggedSha256(readFileSync(path, "utf8")) };
}

/**
 * The pinned config hash, and its preimage NAMED (REQ-01, ADR-0209). The preimage is three
 * things: the runtime config file, the egress/network policy, and the vetted skill list.
 *
 * An UNCONFIGURED component is encoded as unconfigured rather than dropped. Dropping it would
 * make a run with no egress policy hash identically to a run whose policy file happens to be
 * missing, which is the collision this whole encoder exists to prevent -- and those two states
 * mean opposite things about whether anyone decided anything.
 */
export function configPreimage() {
  return {
    schema: "arc.driver.hermes.config-hash.v1",
    image: IMAGE || null,
    config: fileComponent("the runtime config file", CONFIG_FILE),
    egress: fileComponent("the egress/network policy", EGRESS_FILE),
    skills: fileComponent("the vetted skill list", SKILLS_FILE),
  };
}

/**
 * A driver's version is WHAT WOULD CHANGE ITS OUTPUT (ADR-0902). For this shim that is two
 * things and they are reported together: the pinned image, because the image IS the runtime,
 * and the config hash, because the same image answers differently under a different config.
 *
 * It is deliberately NOT the result of shelling into the container to ask its version: that
 * would make an offline provenance field depend on a running docker daemon, and the digest
 * already identifies the image more precisely than any version string it could report.
 */
export function versionString() {
  const pre = configPreimage();
  const digest = String(IMAGE).match(/@(sha256:[0-9a-f]{64})$/);
  const runtime = digest ? digest[1].slice(0, 19) : "unpinned";
  return `hermes@${runtime}+cfg.${taggedSha256(pre).slice(0, 12)}`;
}

/** The remaining run time, as an absolute deadline arc-run set. Never derived from the budget. */
function msUntilDeadline() {
  const raw = process.env.ARC_DRIVER_DEADLINE_EPOCH_MS;
  if (!raw) return undefined;
  const at = Number(raw);
  if (!Number.isFinite(at)) return undefined;
  return at - Date.now();
}

function removeContainer(name) {
  try {
    spawnSync(DOCKER, ["rm", "-f", name], { encoding: "utf8", timeout: 10_000 });
  } catch {
    // Best effort by design: the run is already over and a failed cleanup must not replace the
    // outcome the caller needs to see. It is reported on stderr, which is never parsed.
    process.stderr.write(`hermes: WARN could not remove container ${name}\n`);
  }
}

await runDriver("hermes", async ({ processName, input }) => {
  if (!IMAGE) {
    throw new Error("ARC_HERMES_IMAGE is not set — the runtime image is not configured (see .env.example)");
  }
  // A pin-required class refuses an unpinned artifact. A tag can be repushed: Phase 04 measured
  // :latest moving to a different build on the same day the pinned digest stood still.
  if (!/@sha256:[0-9a-f]{64}$/.test(IMAGE)) {
    throw new Error(`ARC_HERMES_IMAGE must be pinned by digest (name@sha256:...), got ${IMAGE}`);
  }
  if (!DATA_DIR) {
    throw new Error("ARC_HERMES_DATA is not set — the runtime needs a data volume to mount at /opt/data");
  }

  const prompt = [
    `You are executing the arc process \`${processName}\`.`,
    "Reply with ONE JSON document as the final line of your output and nothing after it.",
    "",
    JSON.stringify(input),
  ].join("\n");

  const name = `arc-hermes-${process.pid}-${Date.now()}`;
  const args = [
    "run", "--rm", "--name", name,
    "-v", `${DATA_DIR}:/opt/data`,
    IMAGE,
    "-z", prompt,
  ];

  const remaining = msUntilDeadline();
  let timeoutMs;
  if (remaining !== undefined) {
    // Already past the deadline before we start: decline rather than launch a container that
    // will be killed. Launching it would spend real time and real money to reach the same answer.
    if (remaining <= TEARDOWN_GRACE_MS) {
      const e = new Error(`the run budget has ${Math.max(0, Math.round(remaining))}ms left, which is not enough to start the runtime`);
      e.arcExit = EXIT.BUDGET_DECLINED;
      throw e;
    }
    timeoutMs = Math.max(1, Math.floor(remaining - TEARDOWN_GRACE_MS));
  }

  const res = spawnSync(DOCKER, args, {
    encoding: "utf8",
    timeout: timeoutMs,
    maxBuffer: MAX_BUFFER,
    killSignal: "SIGKILL",
  });

  if (res.error && res.error.code === "ETIMEDOUT") {
    // The container outlives the CLI that started it, so `--rm` alone does not clean up here.
    removeContainer(name);
    const e = new Error("the runtime did not finish inside the time remaining for this run");
    // Budget, never driver. arc-run.mjs:399-403 records what classifying this as a driver fault
    // did: the fallback chain spent the budget again, per driver, and the receipt said the
    // driver had failed when it had not.
    e.arcExit = EXIT.BUDGET_DECLINED;
    throw e;
  }
  if (res.error && res.error.code === "ENOBUFS") {
    removeContainer(name);
    throw new Error(`the runtime produced more than ${MAX_BUFFER} bytes on stdout — refusing to parse a truncated stream`);
  }
  if (res.error) {
    removeContainer(name);
    throw new Error(`could not run the runtime: ${String(res.error.message).split("\n")[0]}`);
  }
  if (res.status !== 0) {
    const why = String(res.stderr || "").trim().split("\n").slice(-1)[0] || `exit ${res.status}`;
    throw new Error(`the runtime exited ${res.status}: ${why}`);
  }

  const output = extractAnswer(res.stdout ?? "");

  // COST IS ABSENT UNLESS IT WAS MEASURED. No usage flag is passed that has not been verified
  // against the vendor -- inventing one is how a fabricated artifact enters a repository, and
  // Phase 04 caught exactly that shape once already. When the operator points
  // ARC_HERMES_USAGE_FILE at a sidecar the runtime actually wrote, its figures are read; when
  // they are absent they stay absent, never zeroed (ADR-0069 b5).
  let cost;
  if (USAGE_FILE && existsSync(USAGE_FILE)) {
    try {
      const u = JSON.parse(readFileSync(USAGE_FILE, "utf8"));
      const tokensIn = Number(u.prompt_tokens ?? u.tokens_in);
      const tokensOut = Number(u.completion_tokens ?? u.tokens_out);
      if (Number.isFinite(tokensIn) || Number.isFinite(tokensOut)) {
        cost = {
          tokensIn: Number.isFinite(tokensIn) ? tokensIn : undefined,
          tokensOut: Number.isFinite(tokensOut) ? tokensOut : undefined,
          source: "measured",
        };
      }
    } catch {
      // A usage file we cannot read is reported and then ignored. Guessing a figure here would
      // put an estimate where a measurement is claimed.
      process.stderr.write(`hermes: WARN the usage file at ${USAGE_FILE} did not parse — cost is reported as absent\n`);
    }
  }

  return { output, cost, model: pinnedModel() ?? "unpinned" };
}, { version: versionString });

settle();
