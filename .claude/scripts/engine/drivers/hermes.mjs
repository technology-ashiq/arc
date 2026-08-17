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
import { createHash, randomUUID } from "node:crypto";
import { cpSync, existsSync, lstatSync, mkdtempSync, readdirSync, readFileSync, realpathSync, renameSync, rmSync, statSync } from "node:fs";
import { constants as osConstants, tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { EXIT, pinnedModel, runDriver, settle } from "./common.mjs";
import { taggedSha256 } from "../type-tagged-hash.mjs";
// The seat grammar is imported from the spine's OWN validator rather than re-spelled here.
// A second copy of a regex is a second thing to keep in sync, and the failure this guards
// against was precisely two layers disagreeing about what a model id may contain (ADR-0221).
import { MODEL_RE } from "../../hq/lib/validate.mjs";

const DOCKER = process.env.ARC_HERMES_DOCKER || "docker";

/**
 * A token count, or `undefined` — never a fabricated zero.
 *
 * `Number()` is the trap. `Number("") === 0`, and so do `Number([])`, `Number(" ")` and
 * `Number("\n")`, all of which pass `Number.isFinite`. The first version of this reader used
 * `Number(u.prompt_tokens)` directly, so a report carrying `"prompt_tokens": ""` produced
 * `{"tokens_in":0,"source":"measured"}` on an append-only receipt — and `arc-bench.mjs` sums those
 * and derives a per-token rate from them. "Absent" and "present but empty" are different inputs,
 * and MP-F's own rule (`common.mjs`: recorded, estimated and fabricated are three different
 * things) is broken by the reader that feeds it.
 *
 * The bounds are the SPINE'S OWN, taken from `validate.mjs` assertCost: a non-negative safe
 * integer, at most 1e12. They are applied HERE because a hermes run reports no `inr`, so its token
 * counts ride `payload.tokens`, which `run.completed` does not shape-check at all — the one place
 * the spine would have caught a negative or fractional count is the one place these never reach.
 */
function countOrUndefined(v) {
  if (typeof v === "number") {
    if (!Number.isInteger(v) || v < 0 || v > 1e12) return undefined;
    return v;
  }
  // A numeric STRING is accepted, but only one that is unambiguously a decimal integer. `"0x10"`
  // becomes 16 under Number() and `"1e3"` becomes 1000; neither is a token count anyone wrote.
  if (typeof v === "string" && /^[0-9]{1,15}$/.test(v.trim())) {
    const n = Number(v.trim());
    return Number.isInteger(n) && n >= 0 && n <= 1e12 ? n : undefined;
  }
  return undefined;
}

/** True when the file was last written at or after the moment this run started. */
function freshEnough(path, since) {
  try { return statSync(path).mtimeMs >= since; } catch { return false; }
}

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
// The Docker network the runtime joins, and the proxy it is pointed at. Both are orchestrated
// outside this process (Phase 06), because a driver that created networks would be arc owning
// infrastructure it cannot clean up after a SIGKILL. See the egress block in the run builder.
const EGRESS_NETWORK = process.env.ARC_HERMES_NETWORK || "";
const EGRESS_PROXY = process.env.ARC_HERMES_PROXY || "";
const SKILLS_FILE = process.env.ARC_HERMES_SKILLS || "";
const USAGE_FILE = process.env.ARC_HERMES_USAGE_FILE || "";

// arc-run's 1 MiB default truncated a large but perfectly valid answer and then blamed the
// driver (arc-run.mjs:375-378). The same number is used here so the two layers cannot disagree.
//
// OVERRIDABLE ONLY SO THE REFUSAL BRANCH CAN BE PROVEN TO RUN. Emitting 64 MB in CI to reach
// one `if` is a minute of runner time for no extra information, and the alternative -- trusting
// that the branch works because it looks right -- is the vacuous pass this repo keeps paying
// for. The override is bounded in BOTH directions: it can only ever lower the ceiling, never
// raise it, and a value that does not floor to a positive integer is ignored.
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
//
// RAISED 3000 -> 8000 ON 2026-08-17, because ADR-0222 put a second job in this window and nobody
// re-measured the budget. `removeContainer` may consume `max(500, GRACE-500)` on a wedged daemon,
// which left 500 ms to recursively delete 1,171 files -- and the copy is the artifact holding the
// runtime's memory, so the half that gets skipped under pressure is the half that matters. A grace
// that was correct before a phase added work to it is a stale constant, not a safe default.
const TEARDOWN_GRACE_MS = 8000;

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
/**
 * THE EGRESS MODE IS IN THE PREIMAGE, AND ITS ABSENCE WAS A REAL HOLE (found by both adversarial
 * surfaces, 2026-08-17).
 *
 * `versionString()` was byte-identical for two dispatches with opposite security postures: one on
 * an internal network behind the allowlisting proxy, one on default networking reaching any host.
 * The preimage named a POLICY FILE (`ARC_HERMES_EGRESS`) and not the policy actually in force --
 * and `ARC_HERMES_EGRESS` is documented nowhere, appears in no test and is set by nothing, so that
 * component has been `{named:false}` on every run ever made. The hash advertised a pin nobody had
 * while the real control sat outside it. A pin computed over the wrong thing is the same defect as
 * a pin computed over a file its own subject can rewrite, which this cycle already recorded.
 *
 * The schema version moves with the shape, because a preimage that gains a field while keeping its
 * name makes two incomparable hashes look comparable.
 */
export function configPreimage() {
  return {
    schema: "arc.driver.hermes.config-hash.v2",
    image: IMAGE || null,
    config: fileComponent("the runtime config file", CONFIG_FILE),
    egress: fileComponent("the egress/network policy", EGRESS_FILE),
    skills: fileComponent("the vetted skill list", SKILLS_FILE),
    // The MODE, not a file: what confinement was actually asked for on this invocation. `proxy` is
    // a boolean because the proxy's URL is an address, not a policy -- the policy is its allowlist,
    // which lives in the proxy's own argv and is hashed by whoever orchestrates it.
    network: EGRESS_NETWORK || null,
    proxy: Boolean(EGRESS_PROXY),
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

/**
 * The first symlink anywhere under `root`, or null. Depth-first, and it walks with `lstat` so it
 * SEES links rather than following them.
 *
 * Why this exists: `cpSync`'s `dereference` flag does not mean the same thing on all three CI legs.
 * On POSIX `dereference:false` reproduces a link, so a template holding `memories -> /srv/shared`
 * yields a "private" copy that still writes to shared state. On Windows it was MEASURED following
 * an inner junction and copying the target's CONTENTS in, dragging host files the operator never
 * placed there into the directory that is then bind-mounted into the container. Both directions
 * break the property; refusing needs no per-OS reasoning, which is the same argument that chose
 * copying over wiping in ADR-0222.
 *
 * A directory it cannot read is reported as a finding rather than skipped -- an unreadable subtree
 * is exactly where a link would hide, and "found nothing" must never be the answer to "could not
 * look".
 */
function findSymlink(root, depth = 0) {
  if (depth > 64) return `${root} (nesting deeper than 64 levels)`;
  let entries;
  try {
    entries = readdirSync(root, { withFileTypes: true });
  } catch (e) {
    return `${root} (unreadable: ${(e && e.code) || e.message})`;
  }
  for (const entry of entries) {
    const full = join(root, entry.name);
    if (entry.isSymbolicLink()) return full;
    if (entry.isDirectory()) {
      const found = findSymlink(full, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Remove `arc-hermes-ws-*` directories left by earlier dispatches this process could not clean.
 *
 * SIGKILL cannot be caught, so the signal handlers registered at copy time cover everything except
 * the one signal arc-run actually sends when a run overruns. Without this sweep, every killed
 * dispatch leaves 36 MB holding the runtime's `memories/MEMORY.md` and `state.db` in the system
 * temp dir forever. The sweep is the second half of that mechanism and neither half is sufficient
 * alone.
 *
 * It is deliberately conservative: only the exact prefix this driver creates, only inside
 * `tmpdir()`, and a failure to remove one is a warning rather than a refusal -- a stale directory
 * from a previous run is not a reason to fail the run in front of us.
 *
 * THE AGE GUARD IS LOAD-BEARING, NOT TIDINESS. The first draft of this sweep deleted every matching
 * directory, which would have destroyed a CONCURRENTLY RUNNING dispatch's live workspace out from
 * under its container -- a cleanup that causes the corruption it is cleaning up after. Only
 * directories older than the longest run this driver can survive are touched; a live workspace is
 * always younger than that because arc-run kills the dispatch first.
 */
const STALE_WORKSPACE_MS = 6 * 60 * 60 * 1000;   // 6h — comfortably past any single dispatch

function sweepStaleWorkspaces() {
  const base = tmpdir();
  let entries;
  try { entries = readdirSync(base, { withFileTypes: true }); } catch { return 0; }
  const cutoff = Date.now() - STALE_WORKSPACE_MS;
  let swept = 0;
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("arc-hermes-ws-")) continue;
    const full = join(base, entry.name);
    try {
      if (statSync(full).mtimeMs > cutoff) continue;   // young enough to belong to a live dispatch
      rmSync(full, { recursive: true, force: true, maxRetries: 2, retryDelay: 50 });
      swept++;
    } catch { /* another dispatch may hold it; the next sweep gets it */ }
  }
  return swept;
}

/**
 * Does this runtime failure say the CREDENTIAL is spent, rather than that the runtime broke?
 *
 * The distinction decides an exit code, and the exit code decides whether arc-run walks its
 * fallback chain. Against a spent key that walk cannot succeed, so misclassifying here turns one
 * refusal into a run that spends its whole budget failing.
 *
 * THE PATTERNS COME FROM A MEASUREMENT, NOT FROM DOCUMENTATION. On 2026-08-16 the live capped key
 * returned **HTTP 403 `Key limit exceeded (total limit)`** for a paid model and HTTP 200 for a
 * `:free` one. The plan had asserted 402 in four places and would have failed against a WORKING
 * cap -- and a cap that had stopped working would have been indistinguishable from a spec that was
 * simply wrong. That is ADR-0219's shape repeating inside one cycle, which is why this list names
 * the run that produced each entry.
 *
 * DELIBERATELY NARROW. Anything not matched here stays `driver`, because the cost of the two
 * mistakes is not symmetric: classifying a real driver fault as `budget` silently ends a run that
 * a retry would have completed, while the reverse is a wasted fallback and a wrong receipt. When
 * in doubt this returns false.
 */
export function isSpendRefusal(text) {
  const t = String(text || "").toLowerCase();
  return (
    t.includes("key limit exceeded") ||                 // measured 2026-08-16, per-key cap (403)
    t.includes("insufficient_quota") ||                 // OpenAI-compatible providers
    t.includes("insufficient credits") ||               // account dry (402)
    t.includes("quota exceeded") ||
    t.includes("billing_hard_limit_reached") ||
    /\b40[23]\b[^\n]*\b(limit|quota|credit|billing)\b/.test(t) ||
    /\b(limit|quota|credit|billing)\b[^\n]*\b40[23]\b/.test(t)
  );
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
 *
 * BOTH SIDES ARE REALPATH-ED, and that is a fixed defect rather than caution. `import.meta.url` is
 * already resolved through symlinks by the ESM loader; `process.argv[1]` is the path as the caller
 * typed it. Behind ANY symlink -- a linked `drivers/` dir, a symlinked checkout, a consumer tree
 * produced by sync -- the two strings differ, `isEntryPoint` is false, and the driver silently does
 * nothing: exit 0, empty stdout, and arc-run spends a retry blaming the runtime for an answer this
 * file never tried to produce. Five other main-guards in this repo (`arc-bench.mjs`,
 * `arc-growth.mjs`, `arc-legal.mjs`, `arc-recall.mjs`, `conflict-check.mjs`) already realpath both
 * sides; this file shipped the defeated form. Sixth twin-fix recurrence for this lane.
 *
 * The comparison falls back to the unresolved form when either path cannot be resolved (a deleted
 * argv[1], a permission error), because failing to resolve must not silently disable the driver --
 * that is the same failure wearing a different hat.
 */
function sameFile(a, b) {
  try { return realpathSync(a) === realpathSync(b); } catch { return a === b; }
}
const isEntryPoint = Boolean(process.argv[1]) && sameFile(process.argv[1], fileURLToPath(import.meta.url));

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
  // The SIGKILL half of the ADR-0222 cleanup. See sweepStaleWorkspaces().
  const sweptCount = sweepStaleWorkspaces();
  if (sweptCount > 0) {
    process.stderr.write(`hermes: swept ${sweptCount} stale workspace(s) left by dispatches that were killed rather than exited (ADR-0222)\n`);
  }

  const prompt = [
    `You are executing the arc process \`${processName}\`.`,
    "Reply with ONE JSON document as the final line of your output and nothing after it.",
    "",
    JSON.stringify(input),
  ].join("\n");

  // `randomUUID`, not `pid + ms`. An adversarial pass flagged the old name as too weak: two drivers
  // in separate PID namespaces (docker-in-docker, two hosts sharing a volume over SMB) can produce
  // the same pid in the same millisecond, and then `docker run --name` fails outright or one run's
  // cleanup deletes another's files. ADR-0222 makes that collision worse, because the name now also
  // keys a per-dispatch WORKSPACE.
  const name = `arc-hermes-${randomUUID()}`;

  // ADR-0222: THE DISPATCH GETS A PRIVATE COPY OF THE RUNTIME HOME.
  //
  // `ARC_HERMES_DATA` is a TEMPLATE here, not the workspace. The runtime's built-in memory cannot
  // be turned off -- `hermes memory --help` says "Built-in memory (MEMORY.md/USER.md) is always
  // active" -- and a marker planted in one run was measured on disk afterwards in BOTH
  // `memories/MEMORY.md` and `state.db`. Mounting one directory across dispatches therefore carries
  // content from pack A into dispatch B without it ever travelling as a pack, so REQ-06's boundary
  // check never sees it.
  //
  // Copying beats wiping precisely because it needs NO knowledge of the runtime's storage layout:
  // a wipe list one file short reads green while carrying data across, and the marker was already
  // in a file the vendor's own docs do not name. Measured cost: 2,235 ms for 36 MB / 1,171 files,
  // against a 145-400s cold boot for an empty volume. The cheap option and the safe option are the
  // same one here.
  // THE TEMPLATE MUST BE A REAL, READABLE, SYMLINK-FREE DIRECTORY, AND A MISS IS A REFUSAL.
  //
  // This was `if (DATA_DIR && existsSync(DATA_DIR))`, and BOTH adversarial surfaces proved the same
  // hole independently: with `ARC_HERMES_DATA` pointing at a path that does not exist yet -- a fresh
  // machine, a typo, an unmounted volume, or a directory `stat` cannot read (existsSync is false on
  // EACCES too) -- the entire copy block was SKIPPED rather than failed. `workspaceIsCopy` stayed
  // false, the template path went straight into `-v`, docker created it host-side as root, and every
  // dispatch from then on shared one directory. That is precisely the memory-carrying mechanism
  // ADR-0222 exists to stop, reached by the state `.env.example` itself describes as normal
  // ("Seed the template once"). The `catch` that promises to fail rather than fall back never ran,
  // because this path never entered the `try`.
  //
  // Three lines up, `fileComponent()` in this same file carefully separates *not configured* from
  // *configured but missing* from *configured but unreadable*. The workspace block collapsed the last
  // two into "run unconfined, exit 0". Twin readers of one rule, one failing closed and one failing
  // open -- the defect class this cycle has now hit five times.
  //
  // SYMLINKS ARE REFUSED, not copied. `dereference: false` does not mean the same thing on all three
  // legs: on POSIX it reproduces a link, so a template containing `memories -> /srv/shared/memories`
  // gives a "private" copy that still writes into shared state; on Windows it was MEASURED following
  // an inner junction and copying the target's contents in, pulling host content the operator never
  // put there into the directory that gets bind-mounted. The runtime writes into this tree and its
  // layout is explicitly unknown, so a link it created cannot be ruled out. Refusing needs no per-OS
  // reasoning and no knowledge of the layout -- the same argument that chose copying over wiping.
  let workspace = DATA_DIR;
  let workspaceIsCopy = false;
  {
    let st;
    try {
      st = lstatSync(DATA_DIR);
    } catch (e) {
      throw new Error(`ARC_HERMES_DATA is set to ${DATA_DIR}, which cannot be read (${(e && e.code) || e.message}) — refusing to dispatch rather than mounting a shared directory (ADR-0222)`);
    }
    if (st.isSymbolicLink()) {
      throw new Error(`ARC_HERMES_DATA (${DATA_DIR}) is a symlink — refusing, because the copy would be a link back at the template and every dispatch would share it (ADR-0222)`);
    }
    if (!st.isDirectory()) {
      throw new Error(`ARC_HERMES_DATA (${DATA_DIR}) is not a directory — refusing to dispatch (ADR-0222)`);
    }
    const linked = findSymlink(DATA_DIR);
    if (linked) {
      throw new Error(`the runtime template ${DATA_DIR} contains a symlink at ${linked} — refusing, because a copy cannot be private when a path inside it points out of the copy (ADR-0222)`);
    }
    let scratch;
    try {
      scratch = mkdtempSync(join(tmpdir(), "arc-hermes-ws-"));
      workspace = join(scratch, "data");
      cpSync(DATA_DIR, workspace, { recursive: true, dereference: true, force: true });
      workspaceIsCopy = true;
      // CLEANED UP ON EVERY EXIT PATH THIS PROCESS CAN OBSERVE, registered at creation rather than
      // written at each return. The usage-report cleanup was put in a `finally` that only the SUCCESS
      // path reached, and an adversarial pass found it littering the volume on all five failure
      // exits. A 36 MB copy per failed dispatch is a worse version of that same defect.
      // `rmSync` is synchronous, which is the only kind of work an exit handler may do.
      //
      // THE PREVIOUS COMMENT HERE CLAIMED `process.on("exit")` "covers the throws, the budget
      // declines and the TIMEOUTS alike", AND THE LAST THIRD WAS FALSE -- the ninth false comment
      // this cycle, found by both adversarial surfaces and PROVED by spawning a child with an exit
      // handler and SIGKILLing it: the handler does not run. Only the internal ETIMEDOUT branch,
      // which throws, was ever covered. arc-run spawns this driver with `killSignal: "SIGKILL"`
      // (arc-run.mjs) and hermes.sh `exec`s node, so the kill lands here directly -- and a killed
      // dispatch is the COMMON failure mode, not a rare one. Every one of them leaked 36 MB
      // containing the runtime's `memories/MEMORY.md` and `state.db`: the exact data-carrying
      // artifact ADR-0222 exists to destroy, accumulating in the system temp dir unreferenced.
      //
      // SIGKILL cannot be caught -- that is physics, not an omission. So this is two mechanisms:
      // handlers for the signals that CAN be caught, and a sweep at startup for the ones that
      // cannot. Neither alone is enough and the pair is stated so the gap is not re-discovered.
      const cleanScratch = () => {
        try { rmSync(scratch, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 }); }
        catch { /* a leftover scratch dir is not worth failing a completed run over */ }
      };
      process.on("exit", cleanScratch);
      // THE SIGNAL LIST IS FILTERED BY WHAT THIS PLATFORM ACTUALLY HAS. `SIGBREAK` exists only on
      // Windows and `process.on` THROWS `ERR_UNKNOWN_SIGNAL` for a name the platform does not
      // define -- so hard-coding the four names took the whole driver down on the macOS and linux
      // legs. Caught by CI within minutes of the push, which is the leg-specific class this repo
      // keeps recording: invisible on the box that wrote it, red on two of three legs.
      const signals = ["SIGINT", "SIGTERM", "SIGHUP", "SIGBREAK"]
        .filter((s) => Object.prototype.hasOwnProperty.call(osConstants.signals, s));
      for (const sig of signals) {
        process.on(sig, () => {
          cleanScratch();
          // Re-raise with the default disposition so the exit STATUS still reports the signal.
          // Swallowing it here would turn a killed dispatch into a clean exit, which is the
          // "exit 0 is not evidence" defect wearing a signal handler.
          process.removeAllListeners(sig);
          try { process.kill(process.pid, sig); } catch { process.exit(EXIT.DRIVER_FAIL); }
        });
      }
    } catch (e) {
      // FAIL, never fall back to mounting the template. A fallback here is a dispatch running
      // unconfined while every count still reads green -- the shape this cycle refused for egress
      // one commit earlier. And a mutated template would carry run N's memories into run N+1
      // through the template itself, which is the thing this whole mechanism exists to stop.
      if (scratch) { try { rmSync(scratch, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 }); } catch { /* nothing to salvage */ } }
      throw new Error(`could not make a private workspace from ${DATA_DIR}: ${e.message}`);
    }
  }
  // SAY WHICH MODE RAN, on the transcript arc-run now forwards and scrubs.
  //
  // THE LINE IS DERIVED FROM WHAT WILL BE MOUNTED, NOT FROM "DID I MAKE A COPY", and that is a
  // fixed defect. It read `workspaceIsCopy`, which is set the instant `cpSync` returns -- so the
  // minimal mutant (leave the copy intact, change the `-v` spec back to `${DATA_DIR}`) still
  // printed "workspace is a PRIVATE copy" on a dispatch that mounted the template, and the suite's
  // claimed "3 of 6 redden" was really 2. Asserting the wrong property: the real property is where
  // the bytes land, which is the same correction fixture 6 already forced on this cycle.
  if (!workspaceIsCopy || workspace === DATA_DIR) {
    throw new Error(`refusing to dispatch: the workspace to be mounted (${workspace}) is the template itself — ADR-0222 requires a private copy`);
  }
  process.stderr.write(`hermes: workspace is a PRIVATE copy of ${DATA_DIR} at ${workspace} (ADR-0222)\n`);
  process.stderr.write(`hermes: egress mode ${EGRESS_NETWORK ? `network=${EGRESS_NETWORK} proxy=${EGRESS_PROXY ? "set" : "none"}` : "UNCONFINED -- no network configured, the runtime reaches any host"}\n`);

  // THE USAGE REPORT IS ASKED FOR, BECAUSE THE RUNTIME OFFERS ONE (ADR-0221). The vendor
  // documents the flag on the pinned image itself: "One-shot mode only: after the run, write a
  // JSON usage report (estimated cost, token counts, model, api_calls) to PATH. The report is
  // written even when the run fails, so pipelines can always account for spend."
  //
  // The path is inside the mounted volume because that is the ONLY host-visible path the
  // container can write to; anywhere else and the file dies with the container. It carries the
  // container name so two concurrent runs cannot read each other's spend, and it is removed
  // after the read so a failed run can never inherit the previous run's figures.
  //
  // THE SENTENCE ABOVE WAS FALSE FOR THE OPERATOR PATH UNTIL AN ADVERSARIAL PASS SAID SO, and the
  // correction is kept in place because it is the finding. With ARC_HERMES_USAGE_FILE set, the
  // flag is NOT passed (a host path cannot be translated into the container), so nothing rewrites
  // that file -- and the cleanup below skips it because it belongs to the operator. Every
  // subsequent run of every process therefore re-read the same report and stamped its tokens
  // `measured` and its model into the MP-F seat: a model that did not run, on a run that measured
  // nothing, forever. Exactly the "stale sidecar is worse than no sidecar" outcome the comment
  // promised to prevent. Seventh comment this cycle asserting what the code did not do.
  //
  // Closed by RECENCY, not by ownership: a report is only read if it was written after this run
  // started. That makes the operator path safe without deleting a file arc does not own.
  const usageHost = USAGE_FILE || join(workspace, `${name}.usage.json`);
  const usageInContainer = USAGE_FILE ? "" : `/opt/data/${name}.usage.json`;
  const runStartedAt = Date.now();

  // FLAG BEFORE THE PROMPT, AND THE PROMPT LAST. The flag was originally pushed AFTER `-z prompt`
  // while tests/engine-usage-flag-probe.mjs sent it BEFORE, so the tripwire and production did not
  // share a command line -- and a one-shot CLI that treats the tail after `-z` as prompt text
  // would honour one and swallow the other. Both orderings were then measured against the pinned
  // image and neither wrote a report, so this is not the cause of the no-op; it is corrected
  // because a tripwire whose argv differs from production's cannot pin production's behaviour.
  //
  // An operator-supplied ARC_HERMES_USAGE_FILE is a HOST path this driver cannot translate into
  // the container's filesystem, so in that case the flag is not passed and the file is only read
  // if something else wrote it -- and then only if it is newer than this run (see usageHost).
  // THE VOLUME SPEC IS COLON-DELIMITED AND IS BUILT BY CONCATENATION, so a colon inside the host
  // path silently re-partitions it: docker reads `/tmp/a:b/ws:/opt/data` as source `/tmp/a`,
  // destination `b/ws` and MODE `/opt/data`. A colon is a legal POSIX path character, and the fake
  // docker fixture compensates with `lastIndexOf(":")` -- which means the suite cannot see this
  // class at all. Refused rather than escaped: a Windows drive prefix (`C:`) is the only colon a
  // legitimate path here carries, and everything else is a malformed mount wearing a working one.
  const drivePrefix = process.platform === "win32" && /^[A-Za-z]:[\\/]/.test(workspace) ? 2 : 0;
  if (workspace.slice(drivePrefix).includes(":")) {
    throw new Error(`the workspace path ${workspace} contains a colon, which docker would read as a volume-spec separator — refusing rather than mounting somewhere unintended`);
  }
  const args = [
    "run", "--rm", "--name", name,
    "-v", `${workspace}:/opt/data`,
  ];

  // EGRESS CONFINEMENT (Phase 06 fixture 7). Measured 2026-08-16: with default networking this
  // container reaches ANY host -- `curl https://example.com` returned 200. A config-pin diff reads
  // green against that, which is why REQ-02 wants a behavioural arm.
  //
  // Both one-line levers were measured and neither works alone: `--network none` and an
  // `--internal` bridge block everything, the model endpoint included. What does work, measured end
  // to end, is a dual-homed allowlisting proxy -- the runtime joins an `--internal` network with no
  // gateway, and the proxy is the single route out. Allowed host 200, disallowed host refused, both
  // decisions logged.
  //
  // OPT-IN, AND THAT IS A DELIBERATE WEAKNESS RATHER THAN AN OVERSIGHT. A driver that silently
  // fell back to unrestricted networking when the operator forgot the variable would be a gate that
  // cannot fail. It is opt-in because the network and proxy are orchestrated OUTSIDE this process
  // (Phase 06 owns that), and a driver that created Docker networks would be arc taking on
  // infrastructure it has no way to clean up after a SIGKILL. The receipt records which mode ran,
  // so an unconfined dispatch is visible rather than assumed.
  // THE NETWORK NAME IS VALIDATED, AND THE PAIR IS ALL-OR-NOTHING. Both adversarial surfaces proved
  // the same two holes here, independently.
  //
  // 1. `ARC_HERMES_NETWORK=host` was accepted verbatim and became `--network host`, which hands the
  //    container the HOST's network namespace: unrestricted egress plus every host-local service,
  //    while this file, its tests and its evidence all say "confined". It is the value most likely
  //    to be typed by someone debugging. `bridge`, `default`, `none` and `container:NAME` are the
  //    same class. The one guard written for exactly this, in engine-hermes-contract.bats, COULD
  //    NOT FIRE: the recorder writes JSON.stringify(argv), so the bytes are the comma-separated
  //    `"--network","host"` and the guard grepped for the space-separated spelling. A grep where the
  //    property needs a parse -- this cycle's most-repeated defect, now caught guarding itself.
  //
  // 2. `ARC_HERMES_PROXY` set without `ARC_HERMES_NETWORK` was SILENTLY DROPPED. `.env.example` says
  //    "the driver refuses that combination" and the bats test is titled "is NOT silently honoured"
  //    while asserting exit 0. The operator who sets one of two variables got full unrestricted
  //    egress and three documents telling them otherwise. Tenth false comment this cycle.
  if (EGRESS_PROXY && !EGRESS_NETWORK) {
    throw new Error("ARC_HERMES_PROXY is set but ARC_HERMES_NETWORK is not — refusing. A proxy without an internal network is unrestricted egress wearing the appearance of a control; set both or neither.");
  }
  if (EGRESS_NETWORK) {
    const RESERVED = new Set(["host", "none", "bridge", "default"]);
    if (RESERVED.has(EGRESS_NETWORK.toLowerCase()) || /^container:/i.test(EGRESS_NETWORK)) {
      throw new Error(`ARC_HERMES_NETWORK=${EGRESS_NETWORK} is a reserved docker network mode, not an isolated user network — refusing, because it would remove the confinement it appears to configure`);
    }
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/.test(EGRESS_NETWORK)) {
      throw new Error(`ARC_HERMES_NETWORK=${EGRESS_NETWORK} is not a valid docker network name`);
    }
    args.push("--network", EGRESS_NETWORK);
    if (EGRESS_PROXY) {
      // Both spellings: curl and requests read the lowercase pair, some SDKs read the uppercase.
      // NO_PROXY keeps container-to-container traffic off the proxy.
      for (const [k, v] of [["HTTPS_PROXY", EGRESS_PROXY], ["https_proxy", EGRESS_PROXY],
                            ["HTTP_PROXY", EGRESS_PROXY], ["http_proxy", EGRESS_PROXY],
                            ["NO_PROXY", "localhost,127.0.0.1"], ["no_proxy", "localhost,127.0.0.1"]]) {
        args.push("-e", `${k}=${v}`);
      }
    }
  }

  args.push(IMAGE);
  if (usageInContainer) args.push("--usage-file", usageInContainer);
  args.push("-z", prompt);

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
    // A SPENT CREDENTIAL IS **BUDGET**, NOT A DRIVER FAULT (Phase 06 fixture 10, ADR-0213).
    //
    // The runtime holds its own capped key and arc never issues the model call, so arc-run cannot
    // see the refusal directly -- it arrives only as text in the runtime's output. Everything here
    // was previously classified `driver`, which is the defect ADR-0210 already records for the
    // wall-clock: a budget failure reported as a driver failure sends arc-run down the FALLBACK
    // chain, which spends the budget again on the next driver. Against a spent key that is a loop
    // that cannot succeed and does not stop, and the receipt blames a driver that worked.
    //
    // MEASURED, NOT READ FROM DOCUMENTATION -- which is the correction ADR-0219 and fixture 10 both
    // had to make. Against the live capped key on 2026-08-16: a paid model returns
    // **HTTP 403 `Key limit exceeded (total limit)`**, and 402 is the ACCOUNT-out-of-credits code,
    // which this design does not use because ADR-0213 chose a PER-KEY limit. Both are matched
    // anyway: the account running dry is also a spend refusal, and refusing to classify it would
    // put the more expensive failure on the fallback path.
    if (isSpendRefusal(`${res.stderr || ""}\n${res.stdout || ""}`)) {
      const e = new Error(`the runtime could not spend: ${why}`);
      e.arcExit = EXIT.BUDGET_DECLINED;
      throw e;
    }
    throw new Error(`the runtime exited ${res.status}: ${why}`);
  }

  // THE RUNTIME'S TRANSCRIPT IS FORWARDED, ON EVERY RUN, AND UNTIL NOW IT WAS NOT.
  //
  // `res.stderr` was read in exactly one place -- to pull a reason line when the container exited
  // non-zero -- and on a SUCCESSFUL run it was discarded entirely. So `arc-run`'s
  // `scrub("the hermes driver's transcript", r.stderr)` only ever saw this driver's own WARN
  // lines, never the runtime's. A planted key in the container's stderr passed straight through:
  // measured, with a fixture, and the scrub did not fire.
  //
  // That is REQ-03's transcript class unprotected, and ADR-0215 says why it matters in one line:
  // the trail is reviewed alongside the draft **because injection shows in trails**. The runs
  // where that matters most are precisely the successful ones -- an injected runtime produces a
  // clean-looking answer and a dirty trail.
  //
  // Forwarded rather than parsed: it stays diagnostics (common.mjs: "stderr -- diagnostics, never
  // parsed"), it reaches the scrub, and Phase 06 stores it per dispatch from here.
  if (res.stderr) process.stderr.write(String(res.stderr));

  const output = extractAnswer(res.stdout ?? "");

  // COST IS ABSENT UNLESS IT WAS MEASURED, and the model is absent unless the runtime said so.
  //
  // THE COMMENT THAT STOOD HERE WAS FALSE and is corrected rather than deleted, because the
  // correction is the finding. It read "No usage flag is passed that has not been verified
  // against the vendor" -- implying none existed. `--usage-file` is documented on the pinned
  // image's own `--help`, was verified there on 2026-08-16, and is now passed on every run
  // (ADR-0221). Sixth comment this cycle asserting something the world did not do.
  //
  // What the report may and may not become:
  //   token counts  -> `source: "measured"`, because the runtime counted them
  //   `model`       -> the MP-F seat, because it answers WHICH MODEL RAN
  //   estimated cost-> NOTHING. REQ-05 says cost is provider-reported or absent, and the
  //                    runtime's own estimate is neither. It is not carried into `inr`.
  let cost;
  // A REPORT IS ONLY THIS RUN'S IF IT WAS WRITTEN DURING THIS RUN. Ownership is not enough: on the
  // operator path the file is never rewritten and never deleted, so `existsSync` alone re-reported
  // one stale report as `measured` on every subsequent run of every process, forever.
  //
  // RECENCY WAS STILL NOT ENOUGH ON THE OPERATOR PATH, and an adversarial pass proved it: with
  // ARC_HERMES_USAGE_FILE set the path carries no container name, so TWO CONCURRENT dispatches read
  // the same file and both stamp `source:"measured"` with the SAME token counts and the SAME model
  // into their MP-F seats. arc-bench sums those to derive a per-token rate, so the spend is
  // double-counted from a single measurement. The comment three lines up already carried one
  // correction about this exact path and left the concurrency half uncorrected -- a twin inside a
  // fix, which is how this cycle keeps re-shipping the same shape.
  //
  // CLOSED BY AN EXCLUSIVE CLAIM: the report is renamed into a per-container name before it is read.
  // `rename` is atomic on both POSIX and Windows, so exactly one of two concurrent dispatches wins
  // it and the loser reports cost absent -- which is the honest answer, because the loser genuinely
  // has no measurement of its own. An absent field is never estimated (ADR-0069 b5).
  let usageRead = usageHost;
  if (USAGE_FILE && existsSync(usageHost) && freshEnough(usageHost, runStartedAt)) {
    const claimed = `${usageHost}.${name}.claim`;
    try { renameSync(usageHost, claimed); usageRead = claimed; }
    catch (e) {
      process.stderr.write(`hermes: WARN could not claim the usage report at ${usageHost} (${(e && e.code) || e.message}) — another dispatch took it; cost and model are reported as absent\n`);
      usageRead = "";
    }
  } else if (USAGE_FILE && existsSync(usageHost)) {
    // A REAL MEASUREMENT DISCARDED IN SILENCE IS WORSE THAN NO MEASUREMENT, because the operator
    // then confirms the wrong root cause: "no report appeared" is exactly what the vendor-no-op
    // probe pins, and a clock-skewed VM or a coarse-mtime filesystem produces the same symptom from
    // a report that is perfectly good. Every other failure in this block names itself; this one did
    // not.
    process.stderr.write(`hermes: WARN a usage report exists at ${usageHost} but predates this run — ignored as stale, not as absent\n`);
  }
  if (usageRead && existsSync(usageRead) && freshEnough(usageRead, runStartedAt)) {
    let u;
    // THE PARSE IS ITS OWN TRY, so the diagnostic names the real cause. One wide try around the
    // read, the parse, the grammar check and versionString() reported EISDIR and EACCES as
    // "did not parse", sending the operator to look at the wrong thing.
    try {
      u = JSON.parse(readFileSync(usageRead, "utf8"));
    } catch (e) {
      process.stderr.write(`hermes: WARN the usage file at ${usageRead} could not be read or parsed (${e.code || e.name}) — cost and model are reported as absent\n`);
      u = null;
    }
    if (u && typeof u === "object" && !Array.isArray(u)) try {
      const tokensIn = countOrUndefined(u.prompt_tokens ?? u.tokens_in);
      const tokensOut = countOrUndefined(u.completion_tokens ?? u.tokens_out);
      // "Wrong type" and "missing" are DIFFERENT INPUTS. Collapsing them meant `{"model": 42}` was
      // dropped in total silence while only the string case was loud -- so a runtime that started
      // emitting a structured model would stop filling the seat and nothing would say so.
      let reported = "";
      if (typeof u.model === "string") reported = u.model.trim();
      else if (u.model !== undefined && u.model !== null) {
        process.stderr.write(`hermes: WARN the runtime reported a non-string model (${typeof u.model}) — seat left unpinned\n`);
      }
      // The seat is a CLEAN model id or it is nothing. An id the spine would quarantine is
      // dropped here rather than at the emitter: a rejected receipt costs the whole receipt,
      // a dropped seat costs one field. This lane has already paid the first price once.
      const model = MODEL_RE.test(reported) ? reported : "";
      if (reported && !model) {
        process.stderr.write(`hermes: WARN the runtime reported a model id the spine grammar refuses — seat left unpinned\n`);
      }
      if (tokensIn !== undefined || tokensOut !== undefined || model) {
        cost = {
          tokensIn,
          tokensOut,
          source: (tokensIn !== undefined || tokensOut !== undefined) ? "measured" : undefined,
          model: model || undefined,
          runtime: versionString(),
        };
      }
    } catch (e) {
      // Anything the grammar check or versionString() throws lands here, named as itself rather
      // than as a parse failure.
      process.stderr.write(`hermes: WARN the usage report at ${usageRead} could not be interpreted (${e.message}) — cost and model are reported as absent\n`);
    } finally {
      // Read once, then gone. The driver removes only what it owns: the report it asked the
      // container to write, or -- on the operator path -- the CLAIM it renamed for itself. The
      // operator's own ARC_HERMES_USAGE_FILE is never deleted by us; after a successful claim that
      // path no longer exists anyway, because the claim moved it.
      const mine = USAGE_FILE ? (usageRead && usageRead !== usageHost ? usageRead : "") : usageHost;
      if (mine) {
        try { rmSync(mine, { force: true, maxRetries: 3, retryDelay: 50 }); }
        catch { /* a leftover report is harmless; losing the run over it is not */ }
      }
    }
  }

  // `model` here is DEAD and has always been: the shared caller destructures `{ output, cost }`
  // and drops the rest, which is why the seat was `unpinned` on every hermes run no matter what
  // this returned. The live channel is the cost sidecar above (ADR-0221). Returned anyway so the
  // contract shape is unchanged for any caller that later starts reading it.
  return { output, cost, model: pinnedModel() ?? "unpinned" };
}, { version: versionString });

if (isEntryPoint) settle();
