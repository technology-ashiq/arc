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
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { pathToFileURL } from "node:url";

import { EXIT, pinnedModel, runDriver, settle } from "./common.mjs";
import { taggedSha256 } from "./type-tagged-hash.mjs";

const DOCKER = process.env.ARC_HERMES_DOCKER || "docker";

/**
 * How to actually invoke the configured docker command.
 *
 * A `.mjs` or `.js` value is run with THIS node rather than executed directly, and that is not a
 * courtesy — it is the only form of stand-in that works on all three CI legs. A shell script
 * cannot be it: a fixture committed at mode 100644 fails with EACCES on ubuntu and macOS, and
 * Node cannot execute a shebang script on windows at ALL, so the first version of the contract
 * suite went red on every leg simultaneously. JavaScript is the one interpreter this matrix is
 * guaranteed to have.
 *
 * Production is unaffected: `docker` has no such suffix and is spawned exactly as before.
 */
function dockerArgv(args) {
  return /\.(mjs|cjs|js)$/i.test(DOCKER)
    ? { cmd: process.execPath, argv: [DOCKER, ...args] }
    : { cmd: DOCKER, argv: args };
}
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
const HARD_CEILING = 64 * 1024 * 1024;
const MAX_BUFFER = (() => {
  // FLOOR FIRST, THEN TEST, AND CLAMP ABOVE. The previous form tested `raw > 0` and floored
  // afterwards, so `ARC_HERMES_MAX_BUFFER=0.5` passed the guard and became `maxBuffer: 0` --
  // which Node reads as UNLIMITED. The comment here claimed a malformed environment could not
  // silently shrink the ceiling to nothing; what it actually did was LIFT it entirely, which is
  // the opposite failure and the worse one. `1e30` did the same from the other end.
  const n = Math.floor(Number(process.env.ARC_HERMES_MAX_BUFFER));
  if (!Number.isFinite(n) || n <= 0) return HARD_CEILING;
  return Math.min(n, HARD_CEILING);
})();

// Room to tear the container down before arc-run SIGKILLs this process. Without it a timeout
// leaves a container running with nobody holding a handle to it.
const TEARDOWN_GRACE_MS = 3000;

/**
 * Strip ANSI escape sequences.
 *
 * EVERY ESCAPE IS SPELLED \u001b AND NEVER WRITTEN AS A LITERAL BYTE. A literal 0x1b is invisible
 * in every diff and every review, and a tool that normalises it away turns these patterns into
 * ordinary text matches. This file has already lost them once that way.
 *
 * FOUR FAMILIES, and the first three were added by an adversarial pass that got an
 * attacker-chosen document returned as the answer:
 *
 * STRING SEQUENCES (DCS, APC, PM, SOS) carry a PAYLOAD between an introducer and a terminator.
 * The old patterns stripped the two-byte introducer and the terminator and left the payload
 * behind as ordinary content -- so `\u001bP {"ok":true,"pwned":"..."} \u001b\` won the backwards
 * scan and was returned, exit 0, invisible in any terminal because nothing renders these.
 *
 * OSC IS BOUNDED TO ONE LINE. `[\s\S]*?` crossed newlines to the first terminator anywhere
 * downstream, so an unterminated OSC in boot output swallowed the answer -- reported as "no
 * output on stdout at all", which is a false diagnosis -- or, worse, swallowed only as far as a
 * later terminator and left a STALE earlier line to be returned as the answer with exit 0. The
 * unbounded form was also super-quadratic: 1 MB took 237ms, 4 MB took 7.7s, and it runs AFTER
 * spawnSync returns, where no timeout can reach it.
 *
 * CSI CARRIES NO INTERMEDIATE-BYTE CLASS. `[ -/]*` let `\u001b[` plus spaces consume the next
 * printable byte, so `\u001b[  {"ok":true}` lost its opening brace. Leaving a tail behind is
 * survivable -- the line simply fails to parse -- but eating real content silently changes the
 * answer, and between those two this takes the survivable one.
 */
const ANSI_STRING_SEQ = /\u001b[P^_X][^\u001b\u0007\n]*(?:\u0007|\u001b\\)?/g;
const ANSI_OSC = /\u001b\][^\u001b\u0007\n]*(?:\u0007|\u001b\\)?/g;
const ANSI_CSI = /\u001b\[[0-9;:?]*[@-~]/g;
const ANSI_SOLO = /\u001b[@-Z\\-_]/g;

function stripAnsi(s) {
  return String(s)
    .replace(ANSI_STRING_SEQ, "")
    .replace(ANSI_OSC, "")
    .replace(ANSI_CSI, "")
    .replace(ANSI_SOLO, "");
}

/**
 * The answer, extracted from a stream that carries boot output. Returns the parsed document.
 *
 * TWO PASSES, IN THIS ORDER, and the order is the fix for the likeliest production failure:
 *
 *   1. A BALANCED DOCUMENT, taken from the EARLIEST line-starting opener that parses through to
 *      the last closer. A pretty-printed answer -- which is ordinary model behaviour -- has its
 *      own nested objects on their own lines, and a line scan finds the innermost one first and
 *      returns a FRAGMENT as the whole document. Preferring the earliest opener returns the
 *      outermost document, which is the one the model meant.
 *   2. A SINGLE LINE, scanned backwards. This is the measured shape: boot output, then the
 *      answer on one line.
 *
 * WHY BACKWARDS AT ALL: a warning printed after the answer takes a naive last-line reader off
 * the end. WHY AN OBJECT OR ARRAY AND NEVER A SCALAR: JSON.parse accepts 42, true and null, so a
 * boot line reading 0 would be returned as the model answer and the run would go green having
 * reported nothing.
 *
 * THE DOCUMENT IS VERIFIED AGAINST THE ORIGINAL BYTES. Stripping runs over the whole stream, so
 * an escape INSIDE a JSON string value was being deleted before the parse -- the driver silently
 * rewrote the answer, which is exactly what this file's own rule forbids, because a driver that
 * rewrites the answer destroys the evidence of an attack rather than surfacing it. Any candidate
 * whose text does not appear VERBATIM in the original stream had content removed from inside it,
 * and is refused by name rather than returned.
 */
export function extractAnswer(rawStdout) {
  const original = String(rawStdout).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (!original.trim()) {
    throw new Error("the runtime produced no output on stdout at all — that is a runtime failure, not an unparseable answer");
  }
  const cleaned = stripAnsi(original);

  let rewritten = null;
  const accept = (text) => {
    let parsed;
    try { parsed = JSON.parse(text); } catch { return null; }
    if (parsed === null || typeof parsed !== "object") return null;
    if (!original.includes(text)) { rewritten = text.slice(0, 120); return null; }
    return { parsed };
  };

  // Pass 1 — the outermost balanced document.
  const lastClose = Math.max(cleaned.lastIndexOf("}"), cleaned.lastIndexOf("]"));
  if (lastClose >= 0) {
    const opener = /^[ \t]*([{[])/gm;
    let m;
    while ((m = opener.exec(cleaned)) !== null) {
      const at = m.index + m[0].length - 1;
      if (at > lastClose) break;
      const got = accept(cleaned.slice(at, lastClose + 1));
      if (got) return got.parsed;
    }
  }

  // Pass 2 — the last single line that is a whole document.
  const lines = cleaned.split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (!line || !(line.startsWith("{") || line.startsWith("["))) continue;
    const got = accept(line);
    if (got) return got.parsed;
  }

  if (rewritten) {
    throw new Error(`the only parseable document required removing escape sequences from INSIDE it, so returning it would rewrite the answer: ${rewritten}`);
  }
  const preview = cleaned.trim().split("\n").slice(-3).join(" / ").slice(0, 200);
  throw new Error(`no line of the runtime output parsed as a JSON object or array (last lines: ${preview})`);
}

/**
 * sha256 of a file's BYTES, or an explicit absence marker. Absence is never silence.
 *
 * THE BYTES, AND THIS TIME ACTUALLY THE BYTES. The previous form read the file with `"utf8"` and
 * hashed the resulting STRING, so every byte sequence that is not valid UTF-8 decoded to the same
 * replacement character: config files differing only in their invalid bytes hashed IDENTICALLY,
 * and a pinned config hash reported "unchanged" across a real change. The doc comment already
 * said BYTES; the code did not.
 *
 * The read also sat OUTSIDE the try, so an existing, regular, unreadable file (EACCES, EPERM,
 * EBUSY) threw out of configPreimage and crashed `version` — in a function whose entire design is
 * that absence is reported rather than raised. All three syscalls are now in one try, which also
 * closes the check-then-use race between them.
 */
function fileComponent(label, path) {
  if (!path) return { named: false, reason: `${label} was not configured for this run` };
  try {
    if (!statSync(path).isFile()) return { named: true, present: false, path, reason: "configured but the path is not a file" };
    const bytes = readFileSync(path);
    return { named: true, present: true, path, sha256: createHash("sha256").update(bytes).digest("hex") };
  } catch (e) {
    const code = (e && e.code) || "";
    const reason = code === "ENOENT" ? "configured but the file does not exist" : `configured but unreadable: ${code || String(e.message).split("\n")[0]}`;
    return { named: true, present: false, path, reason };
  }
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
  if (raw === undefined || raw === "") return undefined;   // absent means no deadline
  // PRESENT-BUT-UNPARSEABLE IS AN ERROR, NOT SILENCE. This returned undefined for any non-finite
  // value, so `1e400` and `Infinity` meant NO CLOCK AT ALL and the shim ran unbounded under a
  // caller that believed it had set a deadline -- and `"   "` became Number 0, declining every
  // run with "0ms left". MAX_BUFFER above validates and falls back to a SAFE value; this one
  // validated and fell back to NO GUARD. Twin readers of the same rule, one failing closed and
  // one failing open, which is the defect this cycle has now hit four times.
  if (!/^\d+$/.test(String(raw).trim())) {
    const e = new Error(`ARC_DRIVER_DEADLINE_EPOCH_MS is ${JSON.stringify(raw)}, which is not an epoch millisecond — refusing to run without the clock the caller believes it set`);
    e.arcDeadlineMalformed = true;
    throw e;
  }
  return Number(String(raw).trim()) - Date.now();
}

function removeContainer(name) {
  // THE RESULT IS INSPECTED, NOT A `catch`. spawnSync REPORTS failures on the returned object --
  // it does not throw -- so the catch block that used to be here was dead code, both `error` and
  // `status` were discarded, and the comment claiming the failure "is reported on stderr" was
  // false: a failed `docker rm -f` was completely silent and the container stayed up.
  //
  // The timeout was also 10s inside a 3s grace, so a wedged daemon meant arc-run SIGKILLed the
  // shim mid-cleanup and the container leaked anyway. It is now bounded by the grace it was
  // actually given, with a signal that a wedged docker CLI cannot ignore.
  const { cmd, argv } = dockerArgv(["rm", "-f", name]);
  const res = spawnSync(cmd, argv, {
    encoding: "utf8",
    timeout: Math.max(500, TEARDOWN_GRACE_MS - 500),
    killSignal: "SIGKILL",
  });
  if (res.error || res.status !== 0) {
    const why = res.error ? res.error.code || res.error.message : `exit ${res.status}`;
    process.stderr.write(`hermes: WARN could not remove container ${name} (${why}) — it may still be running\n`);
  }
}

/**
 * RUN ONLY WHEN THIS FILE IS THE ENTRY POINT.
 *
 * `await runDriver(...)` at module top level meant that importing this module to reach the
 * exported `extractAnswer` EXECUTED the driver -- an adversarial pass trying to unit-test the
 * parser got `hermes: usage: ...` instead. Every parser assertion therefore had to go through a
 * subprocess, which is why several of its rules (the scalar guard among them) had no direct test
 * at all and why a mutant deleting one of them survived.
 */
const isEntryPoint = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isEntryPoint) await runDriver("hermes", async ({ processName, input }) => {
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

  const { cmd, argv } = dockerArgv(args);
  const res = spawnSync(cmd, argv, {
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

if (isEntryPoint) settle();
