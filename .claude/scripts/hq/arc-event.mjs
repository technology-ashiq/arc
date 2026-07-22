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

import { readFileSync } from "node:fs";
import { existsSync } from "node:fs";
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
// A hook must never hold a session up waiting for a lock; CI can afford to wait it out.
const HOOK_LOCK_TIMEOUT_MS = 2000;
const STRICT_LOCK_TIMEOUT_MS = 15000;

// Flags that take a value. Knowing this set is what lets strict-mode detection walk the
// argv correctly instead of grepping it: a flag VALUE that happens to be the word "ingest"
// or "--strict" must not change the mode.
const VALUE_FLAGS = new Set([
  "payload", "payload-file", "event-file", "json", "actor", "process", "model", "venture",
  "run-id", "outcome", "evidence", "supersedes", "idem", "cost", "date",
]);

// ---------- args ----------
function walkArgs(argv) {
  const positional = [];
  const flags = {};
  const errors = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--strict") { flags.strict = true; continue; }
    if (a.startsWith("--")) {
      const eq = a.indexOf("=");
      if (eq !== -1) { flags[a.slice(2, eq)] = a.slice(eq + 1); continue; }
      const name = a.slice(2);
      if (!VALUE_FLAGS.has(name)) { errors.push(`unknown flag --${name}`); continue; }
      const next = argv[i + 1];
      if (next === undefined) { errors.push(`flag --${name} needs a value`); continue; }
      flags[name] = next;
      i++; // consume the VALUE, so it can never be read as a command or as --strict
      continue;
    }
    positional.push(a);
  }
  return { positional, flags, errors };
}

// Strict is a property of the parsed command line, never of "does the word appear anywhere".
// `--strict=0` is still strict (the flag was given); the value is ignored deliberately.
function isStrict({ positional, flags }) {
  return flags.strict !== undefined || positional[0] === "ingest";
}

const envOr = (name, fallback) => {
  const v = process.env[name];
  return v === undefined || v === "" ? fallback : v;
};

// ---------- event construction ----------
function synthesize(kind, flags, { deriveIdem }) {
  const payload = flags["payload-file"]
    ? readJsonFile(flags["payload-file"])
    : flags.payload !== undefined
      ? parseStrictJson(Buffer.from(flags.payload, "utf8"), "--payload")
      : {};

  const actor = flags.actor ?? envOr("ARC_SPINE_ACTOR", "arc-event");
  const runId = flags["run-id"] ?? envOr("ARC_RUN_ID", "r-adhoc");
  const venture = flags.venture ?? envOr("ARC_VENTURE", "arc");
  const outcome = flags.outcome ?? "ok";

  // The preimage must contain every field that makes two events genuinely different.
  // Leaving `venture` out meant a second venture emitting the same kind and payload was
  // silently swallowed as a duplicate of the first venture's receipt.
  const derived = sha256Hex(`${actor}|${venture}|${kind}|${runId}|${outcome}|${canonicalize(payload)}`);
  // On the ingest path the idem is ALWAYS content-derived: accepting a caller-supplied one
  // lets anybody pre-claim an idem and permanently suppress the real receipt that follows.
  const idem = deriveIdem ? derived : (flags.idem ?? derived);
  const ms = nowMs();

  return {
    id: newUlid(ms, idem),
    v: 1,
    ts: formatIst(ms),
    idem,
    actor,
    process: flags.process ?? envOr("ARC_SPINE_PROCESS", PROCESS_ID),
    model: flags.model ?? (process.env.ARC_MODEL || null),
    venture,
    run_id: runId,
    kind,
    payload,
    outcome,
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
  // The ceiling applies to what actually gets WRITTEN: the sealed line plus its newline.
  // validateEvent sizes the pre-sha form, which is ~72 bytes shorter.
  const lineBytes = Buffer.byteLength(line, "utf8") + 1;
  if (lineBytes > MAX_EVENT_BYTES)
    throw new SpineError("OVERSIZE", `sealed record is ${lineBytes} bytes, ceiling is ${MAX_EVENT_BYTES}`);
  return { event: sealed, line };
}

// ADR-0028: a scan that could not COMPLETE means the payload is dropped and a stub-only
// redaction.applied event records that it happened -- no field names, values, or lengths.
function emitRedactionStub(root, source, timeoutMs) {
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
  appendEvent(root, sealed, canonicalize(sealed), { timeoutMs });
}

// ---------- day close (ADR-0029) ----------
function closeDay(root, date, timeoutMs) {
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
  }, { timeoutMs });
}

// ---------- main ----------
function main(parsed) {
  const { positional, flags, errors } = parsed;
  if (errors.length) throw new SpineError("BAD_ARGS", errors.join("; "));

  const command = positional[0];
  const strict = isStrict(parsed);
  const timeoutMs = strict ? STRICT_LOCK_TIMEOUT_MS : HOOK_LOCK_TIMEOUT_MS;

  if (!command || command === "help") {
    process.stdout.write("usage: arc-event emit <kind> [flags] | emit --event-file F | ingest <kind> --json F | close-day [--date D]\n");
    return 0;
  }

  const root = spineRoot();

  if (command === "close-day") {
    const { day, id } = closeDay(root, flags.date, timeoutMs);
    process.stdout.write(`${id}\n`);
    process.stderr.write(`arc-event: closed ${day}\n`);
    return 0;
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
    event = synthesize(kind, flags, { deriveIdem: command === "ingest" });
  }

  const { event: sealed, line } = seal(event);
  const result = appendEvent(root, sealed, line, { timeoutMs });
  if (result.healed)
    process.stderr.write("arc-event: WARN healed a torn tail in the day file before appending\n");
  if (!result.indexed)
    process.stderr.write("arc-event: WARN event is on the spine but the idem index was not updated -- replay will rebuild it\n");
  process.stdout.write(`${sealed.id}\n`);
  return 0;
}

// Determined ONCE, from a proper walk of the command line. Grepping argv for "--strict"
// meant a payload containing that word flipped a hook into a session-blocking exit 2.
const parsed = walkArgs(process.argv.slice(2));
const strictMode = isStrict(parsed);

/** Read back the input we were handed, so a quarantine record can carry it -- if it is safe. */
function readSourceText(flags) {
  if (flags["event-file"]) { try { return readFileSync(flags["event-file"], "utf8"); } catch { return undefined; } }
  if (flags["payload-file"] || flags.json) {
    try { return readFileSync(flags["payload-file"] ?? flags.json, "utf8"); } catch { return undefined; }
  }
  return flags.payload;
}

// Hook mode's promise -- "never blocks" -- is only as good as this handler: EVERY failure
// path below has to end in exit 0 when strict is off, including a failure to quarantine.
try {
  process.exit(main(parsed));
} catch (err) {
  const code = err instanceof SpineError ? err.code : "INTERNAL";
  const message = err && err.message ? err.message : String(err);

  try {
    const root = spineRoot();
    const day = dayOf(formatIst(nowMs()));

    // Whether the raw input is safe to persist is a QUESTION, not an assumption. Most
    // rejections (a bad ts, an unknown kind) fire before the scanner ever runs, and the
    // first version wrote those inputs to disk verbatim -- so a payload carrying a live
    // credential landed in cleartext in an append-only file. Scan first; any doubt at all,
    // including a scan that throws, means stub-only.
    let stubOnly = code === "SECRET" || code === "REDACT_FAIL";
    let raw;
    if (!stubOnly) {
      const text = readSourceText(parsed.flags);
      if (text !== undefined) {
        let parsedValue;
        try { parsedValue = JSON.parse(text); } catch { parsedValue = undefined; }
        try {
          stubOnly = scanSecrets(text, parsedValue).hit;
        } catch {
          stubOnly = true; // a scan that cannot complete is not a clean bill of health
        }
        if (!stubOnly) raw = text;
      }
    }
    quarantine(root, { code, message, day, raw, stubOnly });
    if (code === "REDACT_FAIL") {
      try { emitRedactionStub(root, "emit", strictMode ? STRICT_LOCK_TIMEOUT_MS : HOOK_LOCK_TIMEOUT_MS); } catch { /* best effort */ }
    }
  } catch { /* quarantine itself must never be the thing that blocks a session */ }

  if (strictMode) {
    process.stderr.write(`arc-event: REJECT ${code} -- ${message}\n`);
    process.exit(2);
  }
  process.stderr.write(`arc-event: SKIP ${code} -- ${message} (quarantined, session unaffected)\n`);
  process.exit(0);
}
