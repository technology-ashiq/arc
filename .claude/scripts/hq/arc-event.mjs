#!/usr/bin/env node
// arc-event -- the spine's only writer. Dual-mode by design (ADR-0031):
//
//   hook mode (default)  never blocks a session. Anything invalid is quarantined, a loud
//                        SKIP goes to stderr, and the exit code is ALWAYS 0.
//   --strict             CI, ingest, and tests. The same input exits 2.
//
// One validator core serves both, so what the hooks tolerate and what CI rejects can never
// drift apart. Zero dependencies, Node >= 18.
//
// Usage:
//   arc-event emit <kind> [--payload JSON | --payload-file F] [--actor A] [--process P]
//                         [--model M] [--venture V] [--run-id R] [--outcome ok|fail|partial]
//                         [--evidence PATH] [--supersedes ULID] [--idem HEX] [--cost JSON]
//   arc-event emit --event-file F      # a complete event, validated verbatim
//   arc-event ingest <kind> --json F   # provider payload -> event (strict is implied)
//   arc-event close-day [--date YYYY-MM-DD]
//
// Test-only env doors (never set in production): ARC_SPINE_ROOT, ARC_SPINE_NOW,
// ARC_SPINE_RAND, ARC_SPINE_LOCK_TIMEOUT_MS, ARC_SPINE_LOCK_STALE_MS.

import { existsSync, readFileSync } from "node:fs";
import {
  MAX_EVENT_BYTES, SpineError, canonicalize, dayOf, eventSha, formatIst, newUlid, nowMs,
  parseStrictJson, readJsonFile, sha256Hex,
} from "./lib/canonical.mjs";
import { validateEvent } from "./lib/validate.mjs";
import { scanSecrets } from "./lib/redact.mjs";
import {
  appendEvent, appendEventUnlocked, dayFile, fileSha, isDayClosed,
  quarantine, spineRoot, withLock, writeCloseMarker,
} from "./lib/spine-io.mjs";

const PROCESS_ID = "arc-event@1.0.0";

// ---------- args ----------
function parseArgs(argv) {
  const out = { _: [], flags: {} };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--strict") { out.flags.strict = true; continue; }
    if (a.startsWith("--")) {
      const eq = a.indexOf("=");
      if (eq !== -1) { out.flags[a.slice(2, eq)] = a.slice(eq + 1); continue; }
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--"))
        throw new SpineError("BAD_ARGS", `flag ${a} needs a value`);
      out.flags[a.slice(2)] = next;
      i++;
      continue;
    }
    out._.push(a);
  }
  return out;
}

const envOr = (name, fallback) => {
  const v = process.env[name];
  return v === undefined || v === "" ? fallback : v;
};

// ---------- event construction ----------
function synthesize(kind, flags) {
  const payload = flags["payload-file"]
    ? readJsonFile(flags["payload-file"])
    : flags.payload !== undefined
      ? parseStrictJson(Buffer.from(flags.payload, "utf8"), "--payload")
      : {};

  const actor = flags.actor ?? envOr("ARC_SPINE_ACTOR", "arc-event");
  const runId = flags["run-id"] ?? envOr("ARC_RUN_ID", "r-adhoc");
  const venture = flags.venture ?? envOr("ARC_VENTURE", "arc");

  // Content-derived idem: the SAME input from the SAME run is the same event, which is what
  // makes a redelivered provider payload dedupe across days (REQ-03) without extra state.
  const idem = flags.idem ?? sha256Hex(`${actor}|${kind}|${runId}|${canonicalize(payload)}`);
  const ms = nowMs();

  return {
    id: flags.id ?? newUlid(ms, idem),
    v: 1,
    ts: flags.ts ?? formatIst(ms),
    idem,
    actor,
    process: flags.process ?? envOr("ARC_SPINE_PROCESS", PROCESS_ID),
    model: flags.model ?? (process.env.ARC_MODEL || null),
    venture,
    run_id: runId,
    kind,
    payload,
    outcome: flags.outcome ?? "ok",
    cost: flags.cost !== undefined ? parseStrictJson(Buffer.from(flags.cost, "utf8"), "--cost") : null,
    evidence: flags.evidence ?? null,
    supersedes: flags.supersedes ?? null,
  };
}

/**
 * Validate -> scan -> seal. Returns { event, line }.
 * Throws SpineError; the caller maps that to exit 2 or to a quarantine record.
 */
function seal(event) {
  const canonicalNoSha = validateEvent(event);

  const scan = scanSecrets(canonicalNoSha, event); // throws REDACT_FAIL, never fails open
  if (scan.hit)
    throw new SpineError("SECRET", `payload matches deny-rule ${scan.rule} -- refused before the spine (ADR-0028)`);

  const computed = eventSha(event);
  if (event.sha !== undefined && event.sha !== computed)
    throw new SpineError("SHA_MISMATCH", "supplied sha does not match the canonical form of this event");

  const sealed = { ...event, sha: computed };
  const line = canonicalize(sealed);
  // The ceiling applies to what actually gets WRITTEN, sha included -- validateEvent sizes
  // the pre-sha form, which is 72 bytes shorter. Without this second check an event could
  // pass validation and still exceed the documented limit on disk.
  const lineBytes = Buffer.byteLength(line, "utf8");
  if (lineBytes > MAX_EVENT_BYTES)
    throw new SpineError("OVERSIZE", `sealed event is ${lineBytes} bytes, ceiling is ${MAX_EVENT_BYTES}`);
  return { event: sealed, line };
}

// ADR-0028: a scan that could not COMPLETE means the payload is dropped and a stub-only
// redaction.applied event records that it happened -- no field names, values, or lengths.
function emitRedactionStub(root, source) {
  const ms = nowMs();
  const idem = sha256Hex(`redaction.applied|${source}|${ms}`);
  const stub = {
    id: newUlid(ms, idem),
    v: 1,
    ts: formatIst(ms),
    idem,
    actor: envOr("ARC_SPINE_ACTOR", "arc-event"),
    process: PROCESS_ID,
    model: null,
    venture: envOr("ARC_VENTURE", "arc"),
    run_id: envOr("ARC_RUN_ID", "r-adhoc"),
    kind: "redaction.applied",
    payload: {},
    outcome: "fail",
    cost: null,
    evidence: null,
    supersedes: null,
  };
  const canonicalNoSha = validateEvent(stub);
  const sealed = { ...stub, sha: sha256Hex(canonicalNoSha) };
  appendEvent(root, sealed, canonicalize(sealed));
}

// ---------- day close (ADR-0029) ----------
function closeDay(root, date) {
  const day = date ?? dayOf(formatIst(nowMs()));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new SpineError("BAD_ARGS", `--date "${day}" is not YYYY-MM-DD`);

  return withLock(root, () => {
    if (isDayClosed(root, day)) throw new SpineError("DAY_CLOSED", `${day} is already closed`);
    const file = dayFile(root, day);
    if (!existsSync(file)) throw new SpineError("NO_DAY", `${day} has no events to close`);

    // The event records the sha of the day as it stood; the marker then pins the final
    // bytes, this event included. Both are verifiable after the fact.
    const shaBefore = fileSha(file);
    const ms = nowMs();
    const idem = sha256Hex(`day.closed|${day}|${shaBefore}`);
    const event = {
      id: newUlid(ms, idem),
      v: 1,
      ts: `${day}T23:59:59+05:30`,
      idem,
      actor: envOr("ARC_SPINE_ACTOR", "arc-event"),
      process: PROCESS_ID,
      model: null,
      venture: envOr("ARC_VENTURE", "arc"),
      run_id: envOr("ARC_RUN_ID", "r-adhoc"),
      kind: "day.closed",
      payload: { day, file_sha: shaBefore },
      outcome: "ok",
      cost: null,
      evidence: null,
      supersedes: null,
    };
    const { event: sealed, line } = seal(event);
    appendEventUnlocked(root, sealed, line);
    writeCloseMarker(root, day, fileSha(file));
    return { day, id: sealed.id };
  });
}

// ---------- main ----------
function main(argv) {
  const { _: positional, flags } = parseArgs(argv);
  const command = positional[0];
  const strict = !!flags.strict || command === "ingest";

  if (!command || command === "--help" || command === "help") {
    process.stdout.write("usage: arc-event emit <kind> [flags] | emit --event-file F | ingest <kind> --json F | close-day [--date D]\n");
    return { exit: 0 };
  }

  const root = spineRoot();

  if (command === "close-day") {
    const { day, id } = closeDay(root, flags.date);
    process.stdout.write(`${id}\n`);
    process.stderr.write(`arc-event: closed ${day}\n`);
    return { exit: 0 };
  }

  if (command !== "emit" && command !== "ingest")
    throw new SpineError("BAD_ARGS", `unknown command "${command}"`);

  let event;
  if (flags["event-file"]) {
    event = readJsonFile(flags["event-file"]);
  } else {
    const kind = positional[1];
    if (!kind) throw new SpineError("BAD_ARGS", "emit needs a <kind> (or --event-file)");
    if (command === "ingest") {
      if (!flags.json) throw new SpineError("BAD_ARGS", "ingest needs --json <file>");
      flags["payload-file"] = flags.json;
    }
    event = synthesize(kind, flags);
  }

  const { event: sealed, line } = seal(event);
  appendEvent(root, sealed, line);
  process.stdout.write(`${sealed.id}\n`);
  return { exit: 0, strict };
}

// Hook mode's promise -- "never blocks" -- is only as good as this handler: EVERY failure
// path below has to end in exit 0 when strict is off, including a failure to quarantine.
let strictMode = process.argv.includes("--strict") || process.argv[2] === "ingest";
try {
  const { exit } = main(process.argv.slice(2));
  process.exit(exit);
} catch (err) {
  const code = err instanceof SpineError ? err.code : "INTERNAL";
  const message = err && err.message ? err.message : String(err);

  // The event never reached the spine; record WHY, without becoming a leak in the process.
  try {
    const root = spineRoot();
    const day = dayOf(formatIst(nowMs()));
    const stubOnly = code === "SECRET" || code === "REDACT_FAIL";
    let raw;
    if (!stubOnly) {
      const src = process.argv.includes("--event-file")
        ? process.argv[process.argv.indexOf("--event-file") + 1]
        : null;
      if (src) { try { raw = readFileSync(src, "utf8"); } catch { /* unreadable is itself the finding */ } }
    }
    quarantine(root, { code, message, day, raw, stubOnly });
    if (code === "REDACT_FAIL") { try { emitRedactionStub(root, "emit"); } catch { /* stub is best-effort */ } }
  } catch { /* quarantine itself must never be the thing that blocks a session */ }

  if (strictMode) {
    process.stderr.write(`arc-event: REJECT ${code} -- ${message}\n`);
    process.exit(2);
  }
  process.stderr.write(`arc-event: SKIP ${code} -- ${message} (quarantined, session unaffected)\n`);
  process.exit(0);
}
