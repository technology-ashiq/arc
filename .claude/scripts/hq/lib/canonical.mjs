// Canonical serialization, hashing, ULIDs, and the strict JSON reader.
//
// ADR-0024: this file defines the canonical form ONCE and everything else -- emitter,
// hasher, replayer, reader -- imports it. Its output is load-bearing: every stored `sha`
// is a hash of what canonicalize() produced, so changing this file's bytes is a schema
// migration, not a refactor. Zero dependencies, Node >= 18.

import { createHash, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";

export class SpineError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "SpineError";
    this.code = code;
  }
}

// Canonical event size ceiling (PLAN Appendix B). Bounds every downstream scan and keeps
// a single append inside one write.
export const MAX_EVENT_BYTES = 64 * 1024;

// ---------- canonical serialization ----------
// UTF-8, LF, keys sorted by UTF-16 code unit (NOT locale -- localeCompare would make the
// output machine-dependent), no insignificant whitespace.
export function canonicalize(value, path = "$") {
  if (value === null) return "null";
  const t = typeof value;
  if (t === "boolean") return value ? "true" : "false";
  if (t === "number") {
    if (!Number.isFinite(value)) throw new SpineError("NONFINITE", `${path}: ${value} is not a finite number`);
    return JSON.stringify(value);
  }
  if (t === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map((v, i) => canonicalize(v, `${path}[${i}]`)).join(",") + "]";
  if (t === "object") {
    if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)
      throw new SpineError("CANON_TYPE", `${path}: only plain objects are serializable`);
    const keys = Object.keys(value).sort();
    const parts = [];
    for (const k of keys) {
      const v = value[k];
      if (v === undefined) throw new SpineError("CANON_TYPE", `${path}.${k}: undefined is not serializable`);
      parts.push(JSON.stringify(k) + ":" + canonicalize(v, `${path}.${k}`));
    }
    return "{" + parts.join(",") + "}";
  }
  throw new SpineError("CANON_TYPE", `${path}: ${t} is not serializable`);
}

export function sha256Hex(text) {
  return createHash("sha256").update(Buffer.from(text, "utf8")).digest("hex");
}

// The event's sha covers the canonical form of every field EXCEPT sha itself.
export function eventSha(event) {
  const { sha, ...rest } = event; // eslint-disable-line no-unused-vars
  return sha256Hex(canonicalize(rest));
}

// ---------- ULID ----------
// Crockford base32 (no I, L, O, U). 10 chars of ms timestamp + 16 chars of entropy.
const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export const ULID_RE = /^[0-7][0-9A-HJKMNP-TV-Z]{25}$/;

function encodeTime(ms) {
  if (!Number.isFinite(ms) || ms < 0 || ms > 281474976710655)
    throw new SpineError("BAD_TS", `timestamp ${ms} outside ULID range`);
  let out = "";
  let n = Math.floor(ms);
  for (let i = 0; i < 10; i++) {
    out = CROCKFORD[n % 32] + out;
    n = Math.floor(n / 32);
  }
  return out;
}

// `salt` makes seeded runs deterministic PER EVENT: two different events in one seeded
// process must not collide on an id. Without ARC_SPINE_RAND this is plain CSPRNG.
function encodeEntropy(salt) {
  const seed = process.env.ARC_SPINE_RAND;
  const bytes = seed
    ? createHash("sha256").update(`${seed}|${salt ?? ""}`).digest()
    : randomBytes(16);
  let out = "";
  for (let i = 0; i < 16; i++) out += CROCKFORD[bytes[i] & 31]; // &31 -- exact, no modulo bias
  return out;
}

export function newUlid(ms, salt) {
  return encodeTime(ms) + encodeEntropy(salt);
}

// ---------- clock ----------
// ARC_SPINE_NOW (epoch ms) is a TEST-ONLY door: golden fixtures need the emitter to be a
// pure function of its input. Production never sets it.
export function nowMs() {
  const override = process.env.ARC_SPINE_NOW;
  if (override === undefined) return Date.now();
  const n = Number(override);
  if (!Number.isFinite(n)) throw new SpineError("BAD_TS", `ARC_SPINE_NOW=${override} is not a number`);
  return n;
}

const IST_OFFSET_MIN = 5 * 60 + 30;

// RFC3339 in +05:30, which is what schema v1 stores (PLAN Appendix B).
export function formatIst(ms) {
  const shifted = new Date(ms + IST_OFFSET_MIN * 60_000);
  const p = (n, w = 2) => String(n).padStart(w, "0");
  return (
    `${shifted.getUTCFullYear()}-${p(shifted.getUTCMonth() + 1)}-${p(shifted.getUTCDate())}` +
    `T${p(shifted.getUTCHours())}:${p(shifted.getUTCMinutes())}:${p(shifted.getUTCSeconds())}+05:30`
  );
}

// The day a ts belongs to is simply its own local date -- ts is already in +05:30.
export function dayOf(ts) {
  return ts.slice(0, 10);
}

// ---------- strict JSON ----------
// JSON.parse is necessary but not sufficient: it silently takes the LAST of duplicate keys
// (council v2's first-match-on-repeat class) and happily returns Infinity for 1e999. This
// reader closes both holes and refuses bytes that cannot survive a canonical LF spine.
export function parseStrictJson(buf, where = "input") {
  if (!Buffer.isBuffer(buf)) buf = Buffer.from(String(buf), "utf8");

  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf)
    throw new SpineError("BOM", `${where}: UTF-8 BOM -- the canonical form has no BOM`);
  if (buf.includes(0x0d))
    throw new SpineError("CR_BYTE", `${where}: carriage return byte -- the canonical form is LF only`);

  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(buf);
  } catch {
    throw new SpineError("BAD_UTF8", `${where}: not valid UTF-8`);
  }

  assertNoDuplicateKeys(text, where);

  let value;
  try {
    value = JSON.parse(text);
  } catch (e) {
    throw new SpineError("BAD_JSON", `${where}: ${e.message}`);
  }

  assertAllFinite(value, where);
  return value;
}

// A string-aware walk: because strings are consumed atomically, a `{` or `"` inside a
// string value can never be mistaken for structure.
function assertNoDuplicateKeys(text, where) {
  const n = text.length;
  const stack = [];
  let expectKey = false;
  let i = 0;

  const readString = () => {
    i++; // opening quote
    let out = "";
    while (i < n) {
      const c = text[i];
      if (c === "\\") {
        const e = text[i + 1];
        if (e === undefined) throw new SpineError("BAD_JSON", `${where}: unterminated escape`);
        if (e === "u") { out += text.slice(i, i + 6); i += 6; } else { out += c + e; i += 2; }
        continue;
      }
      if (c === '"') { i++; return out; }
      const code = text.charCodeAt(i);
      if (code < 0x20)
        throw new SpineError("BAD_JSON", `${where}: raw control character U+${code.toString(16).padStart(4, "0")} inside a string`);
      out += c;
      i++;
    }
    throw new SpineError("BAD_JSON", `${where}: unterminated string`);
  };

  while (i < n) {
    const c = text[i];
    if (c === '"') {
      const s = readString();
      if (expectKey) {
        const top = stack[stack.length - 1];
        if (top && top.type === "obj") {
          if (top.keys.has(s)) throw new SpineError("DUP_KEY", `${where}: duplicate object key "${s}"`);
          top.keys.add(s);
        }
        expectKey = false;
      }
      continue;
    }
    if (c === "{") { stack.push({ type: "obj", keys: new Set() }); expectKey = true; i++; continue; }
    if (c === "[") { stack.push({ type: "arr" }); expectKey = false; i++; continue; }
    if (c === "}" || c === "]") { stack.pop(); expectKey = false; i++; continue; }
    if (c === ",") { const top = stack[stack.length - 1]; expectKey = !!top && top.type === "obj"; i++; continue; }
    i++;
  }
}

function assertAllFinite(value, where, path = "$") {
  if (typeof value === "number" && !Number.isFinite(value))
    throw new SpineError("NONFINITE", `${where}: ${path} is ${value} (1e999 and friends never reach the spine)`);
  if (Array.isArray(value)) { value.forEach((v, idx) => assertAllFinite(v, where, `${path}[${idx}]`)); return; }
  if (value && typeof value === "object")
    for (const k of Object.keys(value)) assertAllFinite(value[k], where, `${path}.${k}`);
}

export function readJsonFile(path) {
  let buf;
  try {
    buf = readFileSync(path);
  } catch (e) {
    throw new SpineError("NO_INPUT", `cannot read ${path}: ${e.code || e.message}`);
  }
  return parseStrictJson(buf, path);
}
