/**
 * A TOTAL, type-tagged canonicaliser (ADR-1004).
 *
 * The receipt attests to bytes, so the function that produces the preimage is the whole
 * chain's weakest point. arc has shipped this defect twice already:
 *
 *   arc-evolve 2026-08-04 -- a configHash gave `floor: 1000` and `floor: "1000"` the SAME
 *   hash; the JSON.stringify "fix" then folded NaN and -Infinity to null, so a deliberately
 *   DISABLED floor hashed identically to an unset one. Two opposite states, one hash.
 *
 *   arc-absorb 2026-08-09 -- changing a preimage format silently invalidated every
 *   outstanding commitment, and the verifier then accused the owner of TAMPERING.
 *
 * So: every value carries its TYPE TAG, the encoder REFUSES what it cannot represent rather
 * than coercing it, and the preimage carries its own version so a format change is
 * diagnosable as a format change instead of as tampering.
 */
import { createHash } from "node:crypto";

export const PREIMAGE_VERSION = "arc-legal-canon/1";

export class CanonError extends Error {
  constructor(code, path, message) {
    super(`${code} at ${path || "<root>"}: ${message}`);
    this.code = code;
    this.path = path;
  }
}

/**
 * Encode a value into its canonical text. Strings are NFC-normalised BEFORE hashing, so the
 * same name typed on macOS (NFD) and on Linux (NFC) produces one hash rather than two -- byte
 * equality is not a normalisation strategy, it is the absence of one.
 *
 * Length is emitted before every string so that {"ab":"c"} and {"a":"bc"} cannot share a
 * preimage through concatenation.
 */
function enc(value, path, seen) {
  if (value === null) return "n";
  const t = typeof value;

  if (t === "boolean") return "b:" + (value ? "1" : "0");

  if (t === "number") {
    if (!Number.isFinite(value))
      throw new CanonError("NON_FINITE", path, `${String(value)} cannot be represented; a hash preimage may not contain it. If a field is deliberately disabled, say so with null or a flag, not with a non-finite number.`);
    if (!Number.isInteger(value))
      throw new CanonError("NON_INTEGER", path, `${value} is not an integer. This schema has no fractional fields, and a float's decimal form is platform-dependent.`);
    if (Object.is(value, -0)) return "i:0";
    return "i:" + String(value);
  }

  if (t === "string") {
    const s = value.normalize("NFC");
    return "s:" + s.length + ":" + s;
  }

  if (t === "bigint") throw new CanonError("BIGINT", path, "BigInt cannot be represented");
  if (t === "undefined") throw new CanonError("UNDEFINED", path, "undefined cannot be represented; an absent field is absent, a null field is null, and the two are different facts");
  if (t === "function" || t === "symbol") throw new CanonError("UNENCODABLE", path, `a ${t} cannot be represented`);

  if (t === "object") {
    if (seen.has(value)) throw new CanonError("CYCLE", path, "the value contains a cycle");
    seen.add(value);
    let out;
    if (Array.isArray(value)) {
      const parts = value.map((v, i) => enc(v, `${path}[${i}]`, seen));
      out = "a:" + parts.length + ":[" + parts.join(",") + "]";
    } else {
      const proto = Object.getPrototypeOf(value);
      if (proto !== Object.prototype && proto !== null)
        throw new CanonError("EXOTIC_OBJECT", path, "only plain objects can be represented; a Date, Map, Set or class instance has no canonical form here");
      const keys = Object.keys(value).sort();
      const parts = keys.map((k) => {
        const nk = k.normalize("NFC");
        return "s:" + nk.length + ":" + nk + "=" + enc(value[k], path ? `${path}.${k}` : k, seen);
      });
      out = "m:" + parts.length + ":{" + parts.join(",") + "}";
    }
    seen.delete(value);
    return out;
  }

  throw new CanonError("UNENCODABLE", path, `a value of type ${t} cannot be represented`);
}

/** The full preimage text, version line included. */
export function preimage(value) {
  return PREIMAGE_VERSION + "\n" + enc(value, "", new Set());
}

export function sha256(text) {
  return createHash("sha256").update(Buffer.from(text, "utf8")).digest("hex");
}

/** Canonical hash of a facts object (or any plain value). */
export function canonicalHash(value) {
  return sha256(preimage(value));
}

/** Hash of literal bytes -- used for rendered pages, where the bytes ARE the artifact. */
export function bytesHash(text) {
  return sha256(text);
}

/**
 * Hash of a template SET: every file's path and content, order-independent.
 * A page's rendered bytes carry this, so one template edit moves every page -- which is the
 * point (ADR-1005: a template fix is not done until each venture has re-approved).
 */
export function templateSetHash(files) {
  const rows = Object.keys(files)
    .sort()
    .map((p) => ({ path: p.split("\\").join("/"), sha: sha256(files[p]) }));
  return sha256(preimage(rows));
}
