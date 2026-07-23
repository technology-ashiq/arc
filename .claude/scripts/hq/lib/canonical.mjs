// Canonical serialization, hashing, ULIDs, and the strict JSON reader.
//
// ADR-0024: this file defines the canonical form ONCE and everything else -- emitter,
// hasher, replayer, reader -- imports it. Its output is load-bearing: every stored `sha`
// is a hash of what canonicalize() produced, so changing this file's bytes is a schema
// migration, not a refactor. Zero dependencies, Node >= 18.
//
// Hardened by the Phase-0 adversarial pass (docs/evidence/phase-00/adversarial-report.md).
// The scanner below decodes before it compares, bounds its own recursion, and refuses
// numbers it cannot represent exactly -- each of those closes a confirmed hole where the
// spine sealed a value that was not the value it was given.

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

// Structural depth ceiling. Without it, "is this event valid?" is answered by the V8 stack
// size rather than by the schema: the same input was accepted on one runner and crashed
// with an uncatchable RangeError on another.
export const MAX_DEPTH = 64;

// ---------- canonical serialization ----------
// UTF-8, LF, keys sorted by UTF-16 code unit (NOT locale -- localeCompare would make the
// output machine-dependent), no insignificant whitespace.
export function canonicalize(value, path = "$", depth = 0) {
  if (depth > MAX_DEPTH) throw new SpineError("DEPTH_EXCEEDED", `${path}: nesting deeper than ${MAX_DEPTH}`);
  if (value === null) return "null";
  const t = typeof value;
  if (t === "boolean") return value ? "true" : "false";
  if (t === "number") {
    if (!Number.isFinite(value)) throw new SpineError("NONFINITE", `${path}: ${value} is not a finite number`);
    // -0 serializes as "0", so a -0 event and a 0 event would produce identical bytes and
    // the second would be refused as a duplicate of the first. Refuse the ambiguity itself.
    if (Object.is(value, -0)) throw new SpineError("NEGATIVE_ZERO", `${path}: -0 is not a distinct spine value`);
    return JSON.stringify(value);
  }
  if (t === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map((v, i) => canonicalize(v, `${path}[${i}]`, depth + 1)).join(",") + "]";
  if (t === "object") {
    if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)
      throw new SpineError("CANON_TYPE", `${path}: only plain objects are serializable`);
    const keys = Object.keys(value).sort();
    const parts = [];
    for (const k of keys) {
      const v = value[k];
      if (v === undefined) throw new SpineError("CANON_TYPE", `${path}.${k}: undefined is not serializable`);
      parts.push(JSON.stringify(k) + ":" + canonicalize(v, `${path}.${k}`, depth + 1));
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
//
// NOTE for consumers (ADR-0030): ULIDs from separate emitter processes within the same
// millisecond are NOT ordered relative to each other. Append order is the spine's order --
// a `--since <ulid>` cursor must resolve ties by file position, never by string compare.
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
  const year = shifted.getUTCFullYear();
  // Outside four digits the output is not RFC3339 at all (negative or 6-digit years), and
  // the day string derived from it becomes a malformed filename.
  if (!Number.isFinite(year) || year < 1000 || year > 9999)
    throw new SpineError("BAD_TS", `epoch ${ms} lands in year ${year}, outside the four-digit range schema v1 stores`);
  const p = (n, w = 2) => String(n).padStart(w, "0");
  return (
    `${year}-${p(shifted.getUTCMonth() + 1)}-${p(shifted.getUTCDate())}` +
    `T${p(shifted.getUTCHours())}:${p(shifted.getUTCMinutes())}:${p(shifted.getUTCSeconds())}+05:30`
  );
}

// The day a ts belongs to is simply its own local date -- ts is already in +05:30.
export function dayOf(ts) {
  const day = String(ts).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day))
    throw new SpineError("BAD_TS", `cannot derive a day from ts "${ts}"`);
  return day;
}

// ---------- strict JSON ----------
// JSON.parse is necessary but not sufficient. It silently takes the LAST of duplicate keys
// (council v2's first-match-on-repeat class), returns Infinity for 1e999, and rounds
// 250000000000000000001 down to ...000 -- and the sha we then compute would faithfully
// certify the wrong value. This reader validates the raw text itself and refuses all three.
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

  scanJson(text, where);

  let value;
  try {
    value = JSON.parse(text);
  } catch (e) {
    throw new SpineError("BAD_JSON", `${where}: ${e.message}`);
  }
  return value;
}

const SIMPLE_ESCAPES = { '"': '"', "\\": "\\", "/": "/", b: "\b", f: "\f", n: "\n", r: "\r", t: "\t" };

/**
 * A validating walk over the raw JSON text. It exists to see what JSON.parse hides:
 * duplicate keys (compared DECODED, because that is what JSON.parse collapses on),
 * numbers that cannot survive a round trip, and nesting deep enough to blow the stack.
 */
function scanJson(text, where) {
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
        if (e === "u") {
          const hex = text.slice(i + 2, i + 6);
          if (!/^[0-9a-fA-F]{4}$/.test(hex))
            throw new SpineError("BAD_JSON", `${where}: malformed \\u escape`);
          // DECODE it. Comparing raw escape text is the bug: "txn" and "txn" are the
          // same key to JSON.parse, so a scanner that compares undecoded text lets a
          // smuggled duplicate through and the LAST value silently wins.
          out += String.fromCharCode(parseInt(hex, 16));
          i += 6;
          continue;
        }
        if (!(e in SIMPLE_ESCAPES)) throw new SpineError("BAD_JSON", `${where}: invalid escape \\${e}`);
        out += SIMPLE_ESCAPES[e];
        i += 2;
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

  const readNumber = () => {
    const start = i;
    if (text[i] === "-") i++;
    while (i < n && text[i] >= "0" && text[i] <= "9") i++;
    if (text[i] === ".") { i++; while (i < n && text[i] >= "0" && text[i] <= "9") i++; }
    if (text[i] === "e" || text[i] === "E") {
      i++;
      if (text[i] === "+" || text[i] === "-") i++;
      while (i < n && text[i] >= "0" && text[i] <= "9") i++;
    }
    assertNumberToken(text.slice(start, i), where);
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
    if (c === "{" || c === "[") {
      stack.push(c === "{" ? { type: "obj", keys: new Set() } : { type: "arr" });
      if (stack.length > MAX_DEPTH)
        throw new SpineError("DEPTH_EXCEEDED", `${where}: nesting deeper than ${MAX_DEPTH}`);
      expectKey = c === "{";
      i++;
      continue;
    }
    if (c === "}" || c === "]") { stack.pop(); expectKey = false; i++; continue; }
    if (c === ",") { const top = stack[stack.length - 1]; expectKey = !!top && top.type === "obj"; i++; continue; }
    if (c === "-" || (c >= "0" && c <= "9")) { readNumber(); continue; }
    i++;
  }
}

// A receipt spine may not round values. If the text says 250000000000000000001, storing
// ...000 and hashing THAT produces a sha that certifies a number nobody sent.
function assertNumberToken(token, where) {
  const value = Number(token);
  if (!Number.isFinite(value))
    throw new SpineError("NONFINITE", `${where}: ${token} is not a finite number`);
  if (Object.is(value, -0))
    throw new SpineError("NEGATIVE_ZERO", `${where}: -0 is not a distinct spine value`);
  if (/^-?\d+$/.test(token)) {
    if (!Number.isSafeInteger(value))
      throw new SpineError("NUMBER_PRECISION", `${where}: integer ${token} cannot be represented exactly`);
    return;
  }
  const significant = token.replace(/^-/, "").replace(/[eE].*$/, "").replace(/\./, "").replace(/^0+/, "");
  if (significant.length > 17)
    throw new SpineError("NUMBER_PRECISION", `${where}: ${token} carries more precision than a double holds`);
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
